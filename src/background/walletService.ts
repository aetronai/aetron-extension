// Wallet Service - manages wallets and keys in background
import { Keyring } from '@polkadot/keyring'
import type { KeyringPair } from '@polkadot/keyring/types'
import { mnemonicGenerate, mnemonicValidate, cryptoWaitReady } from '@polkadot/util-crypto'
import { hexToU8a, u8aToHex, isHex } from '@polkadot/util'
import { encrypt, decrypt } from '@shared/wallet/crypto'
import type {
  WalletAccount,
  EncryptedWallet,
  Hotkey,
  CreatedHotkey,
  EncryptedHotkey,
  WalletStoreSettings,
} from '@shared/wallet/types'
import {
  getWalletStore,
  saveWalletStore,
  getHotkeyStore,
  saveHotkeyStore,
  saveLockState,
} from '@lib/storage'

const WALLET_STORE_VERSION = 1
const DEFAULT_DERIVATION_PATH = ''

// Rate limiting for unlock attempts
interface UnlockAttempt {
  count: number
  lastAttempt: number
}

class WalletService {
  private keyring: Keyring
  private unlockedWallets: Map<string, KeyringPair> = new Map()
  private unlockedHotkeys: Map<string, KeyringPair> = new Map()
  private unlockAttempts: Map<string, UnlockAttempt> = new Map()
  private lockTimeout: ReturnType<typeof setTimeout> | null = null
  private isInitialized = false

  constructor() {
    this.keyring = new Keyring({ type: 'sr25519', ss58Format: 42 })
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return
    await cryptoWaitReady()
    this.isInitialized = true
  }

  // ==================== WALLET OPERATIONS ====================

  async getWallets(): Promise<WalletAccount[]> {
    const store = await getWalletStore()
    return store.wallets.map((w) => ({
      id: w.id,
      name: w.name,
      address: w.address,
      type: w.type,
      derivationPath: w.derivationPath,
      createdAt: w.createdAt,
      updatedAt: w.updatedAt,
    }))
  }

  async getActiveWallet(): Promise<WalletAccount | null> {
    const store = await getWalletStore()
    if (!store.activeWalletId) return null

    const wallet = store.wallets.find((w) => w.id === store.activeWalletId)
    if (!wallet) return null

    return {
      id: wallet.id,
      name: wallet.name,
      address: wallet.address,
      type: wallet.type,
      derivationPath: wallet.derivationPath,
      createdAt: wallet.createdAt,
      updatedAt: wallet.updatedAt,
    }
  }

  async setActiveWallet(walletId: string): Promise<void> {
    const store = await getWalletStore()
    const wallet = store.wallets.find((w) => w.id === walletId)
    if (wallet) {
      store.activeWalletId = walletId
      await saveWalletStore(store)
    }
  }

  async createWallet(
    name: string,
    password: string,
    mnemonic?: string
  ): Promise<{ wallet: WalletAccount; mnemonic: string }> {
    await this.initialize()

    const seedPhrase = mnemonic || mnemonicGenerate(24)

    if (!mnemonicValidate(seedPhrase)) {
      throw new Error('Invalid mnemonic phrase')
    }

    const path = DEFAULT_DERIVATION_PATH
    const pair = this.keyring.addFromUri(`${seedPhrase}${path}`)
    const id = crypto.randomUUID()

    const encrypted = await encrypt(seedPhrase, password)
    console.log('[WalletService] Created encrypted data:', { salt: encrypted.salt.substring(0, 10) + '...', iv: encrypted.iv.substring(0, 10) + '...' })

    const store = await getWalletStore()

    // Check for duplicate address
    const existingWallet = store.wallets.find((w) => w.address === pair.address)
    if (existingWallet) {
      throw new Error(`Wallet with this address already exists: ${existingWallet.name}`)
    }

    const wallet: EncryptedWallet = {
      id,
      version: WALLET_STORE_VERSION,
      type: 'hd',
      name,
      address: pair.address,
      encrypted,
      derivationPath: path,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    store.wallets.push(wallet)
    store.activeWalletId = id
    await saveWalletStore(store)
    console.log('[WalletService] Saved wallet to store, verifying...')
    const verifyStore = await getWalletStore()
    const savedWallet = verifyStore.wallets.find(w => w.id === id)
    console.log('[WalletService] Verified saved wallet encrypted:', { salt: savedWallet?.encrypted?.salt?.substring(0, 10) + '...', iv: savedWallet?.encrypted?.iv?.substring(0, 10) + '...' })

    // Keep wallet unlocked
    this.unlockedWallets.set(id, pair)
    this.resetLockTimeout(store.settings.autoLockTimeout)

    // Create default hotkey
    await this.createDefaultHotkey(id, password)

    return {
      wallet: {
        id,
        name,
        address: pair.address,
        type: 'hd',
        derivationPath: path,
        createdAt: wallet.createdAt,
        updatedAt: wallet.updatedAt,
      },
      mnemonic: seedPhrase,
    }
  }

  async importFromMnemonic(
    name: string,
    mnemonic: string,
    password: string
  ): Promise<WalletAccount> {
    await this.initialize()

    if (!mnemonicValidate(mnemonic)) {
      throw new Error('Invalid mnemonic phrase')
    }

    const path = DEFAULT_DERIVATION_PATH
    const pair = this.keyring.addFromUri(`${mnemonic}${path}`)
    const id = crypto.randomUUID()

    const encrypted = await encrypt(mnemonic, password)

    const store = await getWalletStore()

    const existingWallet = store.wallets.find((w) => w.address === pair.address)
    if (existingWallet) {
      throw new Error(`Wallet with this address already exists: ${existingWallet.name}`)
    }

    const wallet: EncryptedWallet = {
      id,
      version: WALLET_STORE_VERSION,
      type: 'hd',
      name,
      address: pair.address,
      encrypted,
      derivationPath: path,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    store.wallets.push(wallet)
    store.activeWalletId = id
    await saveWalletStore(store)

    this.unlockedWallets.set(id, pair)
    this.resetLockTimeout(store.settings.autoLockTimeout)

    await this.createDefaultHotkey(id, password)

    return {
      id,
      name,
      address: pair.address,
      type: 'hd',
      derivationPath: path,
      createdAt: wallet.createdAt,
      updatedAt: wallet.updatedAt,
    }
  }

  async importFromPrivateKey(
    name: string,
    privateKey: string,
    password: string
  ): Promise<WalletAccount> {
    await this.initialize()

    let keyBytes: Uint8Array
    if (isHex(privateKey)) {
      keyBytes = hexToU8a(privateKey)
    } else {
      keyBytes = hexToU8a(`0x${privateKey}`)
    }

    if (keyBytes.length !== 32 && keyBytes.length !== 64) {
      throw new Error('Invalid private key length. Expected 32 or 64 bytes.')
    }

    const pair = this.keyring.addFromSeed(keyBytes.slice(0, 32))
    const id = crypto.randomUUID()

    const encrypted = await encrypt(privateKey, password)

    const store = await getWalletStore()

    const existingWallet = store.wallets.find((w) => w.address === pair.address)
    if (existingWallet) {
      throw new Error(`Wallet with this address already exists: ${existingWallet.name}`)
    }

    const wallet: EncryptedWallet = {
      id,
      version: WALLET_STORE_VERSION,
      type: 'privateKey',
      name,
      address: pair.address,
      encrypted,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    store.wallets.push(wallet)
    store.activeWalletId = id
    await saveWalletStore(store)

    this.unlockedWallets.set(id, pair)
    this.resetLockTimeout(store.settings.autoLockTimeout)

    await this.createDefaultHotkey(id, password)

    return {
      id,
      name,
      address: pair.address,
      type: 'privateKey',
      createdAt: wallet.createdAt,
      updatedAt: wallet.updatedAt,
    }
  }

  async importFromKeystore(
    name: string,
    keystoreJson: string,
    keystorePassword: string,
    newPassword: string
  ): Promise<WalletAccount> {
    await this.initialize()

    let jsonData: { encoded: string; encoding: { content: string[]; type: string[]; version: string }; address: string; meta: Record<string, unknown> }
    try {
      jsonData = JSON.parse(keystoreJson)
    } catch {
      throw new Error('Invalid JSON keystore file')
    }

    // Validate keystore format (Polkadot format)
    if (!jsonData.encoded || !jsonData.encoding || !jsonData.address) {
      throw new Error('Invalid keystore format. Expected Polkadot JSON keystore.')
    }

    let pair: KeyringPair
    try {
      // Create a temporary keyring to decode the JSON
      const tempKeyring = new Keyring({ type: 'sr25519', ss58Format: 42 })
      pair = tempKeyring.addFromJson(jsonData as unknown as Parameters<typeof tempKeyring.addFromJson>[0])
      pair.decodePkcs8(keystorePassword)
    } catch {
      throw new Error('Failed to decrypt keystore. Check your password.')
    }

    // Now we have the unlocked keypair, add it to our keyring
    const addedPair = this.keyring.addPair(pair)
    const id = crypto.randomUUID()

    const store = await getWalletStore()

    const existingWallet = store.wallets.find((w) => w.address === addedPair.address)
    if (existingWallet) {
      throw new Error(`Wallet with this address already exists: ${existingWallet.name}`)
    }

    // Store the original keystore JSON re-encrypted for later export
    const keystoreEncrypted = await encrypt(keystoreJson, newPassword)

    const wallet: EncryptedWallet = {
      id,
      version: WALLET_STORE_VERSION,
      type: 'keystore',
      name,
      address: addedPair.address,
      encrypted: keystoreEncrypted,
      keystorePassword: await encrypt(keystorePassword, newPassword), // Store original keystore password
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    store.wallets.push(wallet)
    store.activeWalletId = id
    await saveWalletStore(store)

    this.unlockedWallets.set(id, addedPair)
    this.resetLockTimeout(store.settings.autoLockTimeout)

    await this.createDefaultHotkey(id, newPassword)

    return {
      id,
      name,
      address: addedPair.address,
      type: 'keystore',
      createdAt: wallet.createdAt,
      updatedAt: wallet.updatedAt,
    }
  }

  async unlockWallet(walletId: string, password: string): Promise<boolean> {
    await this.initialize()

    // Rate limiting
    const attempts = this.unlockAttempts.get(walletId) || { count: 0, lastAttempt: 0 }
    const now = Date.now()

    // Reset after 15 minutes
    if (now - attempts.lastAttempt > 15 * 60 * 1000) {
      attempts.count = 0
    }

    if (attempts.count >= 5) {
      throw new Error('Too many failed attempts. Please wait 15 minutes.')
    }

    const store = await getWalletStore()
    const wallet = store.wallets.find((w) => w.id === walletId)

    if (!wallet) {
      throw new Error('Wallet not found')
    }

    if (wallet.type === 'watch' || wallet.type === 'multisig') {
      return true
    }

    console.log('[WalletService] Attempting to unlock wallet, encrypted data:', { salt: wallet.encrypted?.salt?.substring(0, 10) + '...', iv: wallet.encrypted?.iv?.substring(0, 10) + '...' })

    try {
      const decrypted = await decrypt(wallet.encrypted, password)
      console.log('[WalletService] Decrypt successful')

      let pair: KeyringPair

      switch (wallet.type) {
        case 'hd':
          pair = this.keyring.addFromUri(`${decrypted}${wallet.derivationPath || ''}`)
          break
        case 'privateKey':
          pair = this.keyring.addFromSeed(hexToU8a(decrypted).slice(0, 32))
          break
        case 'keystore': {
          // For keystore wallets, decrypted contains the original JSON keystore
          const keystoreJson = JSON.parse(decrypted)
          // Get the original keystore password
          if (!wallet.keystorePassword) {
            throw new Error('Keystore password not found')
          }
          const keystorePass = await decrypt(wallet.keystorePassword, password)
          const tempKeyring = new Keyring({ type: 'sr25519', ss58Format: 42 })
          pair = tempKeyring.addFromJson(keystoreJson)
          pair.decodePkcs8(keystorePass)
          pair = this.keyring.addPair(pair)
          break
        }
        default:
          throw new Error('Unknown wallet type')
      }

      this.unlockedWallets.set(walletId, pair)
      this.unlockAttempts.delete(walletId)
      this.resetLockTimeout(store.settings.autoLockTimeout)

      await saveLockState({ isLocked: false, lastUnlockedAt: Date.now() })

      return true
    } catch (err) {
      console.error('[WalletService] Decrypt failed:', err)
      attempts.count++
      attempts.lastAttempt = now
      this.unlockAttempts.set(walletId, attempts)
      return false
    }
  }

  async lock(): Promise<void> {
    this.unlockedWallets.clear()
    this.unlockedHotkeys.clear()

    if (this.lockTimeout) {
      clearTimeout(this.lockTimeout)
      this.lockTimeout = null
    }

    await saveLockState({ isLocked: true, lastUnlockedAt: null })
  }

  isUnlocked(walletId: string): boolean {
    return this.unlockedWallets.has(walletId)
  }

  hasUnlockedWallets(): boolean {
    return this.unlockedWallets.size > 0
  }

  getKeypair(walletId: string): KeyringPair | null {
    return this.unlockedWallets.get(walletId) || null
  }

  async signMessage(walletId: string, message: string): Promise<string> {
    const pair = this.getKeypair(walletId)
    if (!pair) {
      throw new Error('Wallet is locked')
    }

    const messageBytes = new TextEncoder().encode(message)
    const signature = pair.sign(messageBytes)

    return u8aToHex(signature)
  }

  async signTransaction(walletId: string, payloadHex: string): Promise<string> {
    const pair = this.getKeypair(walletId)
    if (!pair) {
      throw new Error('Wallet is locked')
    }

    const payload = hexToU8a(payloadHex)
    const signature = pair.sign(payload)

    return u8aToHex(signature)
  }

  async deleteWallet(walletId: string): Promise<void> {
    const store = await getWalletStore()
    store.wallets = store.wallets.filter((w) => w.id !== walletId)
    this.unlockedWallets.delete(walletId)

    if (store.activeWalletId === walletId) {
      store.activeWalletId = store.wallets[0]?.id || null
    }

    await saveWalletStore(store)

    // Delete associated hotkeys
    const hotkeys = await getHotkeyStore()
    const filtered = hotkeys.filter((h) => h.coldkeyId !== walletId)
    await saveHotkeyStore(filtered)
  }

  async clearAllWallets(): Promise<void> {
    // Clear all unlocked state
    this.unlockedWallets.clear()
    this.unlockedHotkeys.clear()
    this.unlockAttempts.clear()

    if (this.lockTimeout) {
      clearTimeout(this.lockTimeout)
      this.lockTimeout = null
    }

    // Clear wallet store
    const store = await getWalletStore()
    store.wallets = []
    store.activeWalletId = null
    await saveWalletStore(store)

    // Clear all hotkeys
    await saveHotkeyStore([])

    // Reset lock state
    await saveLockState({ isLocked: true, lastUnlockedAt: null })
  }

  async renameWallet(walletId: string, newName: string): Promise<void> {
    const store = await getWalletStore()
    const wallet = store.wallets.find((w) => w.id === walletId)

    if (wallet) {
      wallet.name = newName
      wallet.updatedAt = Date.now()
      await saveWalletStore(store)
    }
  }

  async exportMnemonic(walletId: string, password: string): Promise<string> {
    const store = await getWalletStore()
    const wallet = store.wallets.find((w) => w.id === walletId)

    if (!wallet) {
      throw new Error('Wallet not found')
    }

    if (wallet.type !== 'hd') {
      throw new Error('Only HD wallets have mnemonic')
    }

    return await decrypt(wallet.encrypted, password)
  }

  async changePassword(
    walletId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    const store = await getWalletStore()
    const wallet = store.wallets.find((w) => w.id === walletId)

    if (!wallet) {
      throw new Error('Wallet not found')
    }

    if (wallet.type === 'watch' || wallet.type === 'multisig') {
      throw new Error('Cannot change password for this wallet type')
    }

    // Decrypt with current password
    let decrypted: string
    try {
      decrypted = await decrypt(wallet.encrypted, currentPassword)
    } catch {
      throw new Error('Current password is incorrect')
    }

    // Re-encrypt with new password
    wallet.encrypted = await encrypt(decrypted, newPassword)
    wallet.updatedAt = Date.now()
    await saveWalletStore(store)

    // Re-encrypt associated hotkeys
    const hotkeys = await getHotkeyStore()
    for (const hotkey of hotkeys) {
      if (hotkey.coldkeyId === walletId) {
        try {
          const hotkeyMnemonic = await decrypt(hotkey.encrypted, currentPassword)
          hotkey.encrypted = await encrypt(hotkeyMnemonic, newPassword)
        } catch {
          // Hotkey might use different password, skip
        }
      }
    }
    await saveHotkeyStore(hotkeys)
  }

  // ==================== HOTKEY OPERATIONS ====================

  private async createDefaultHotkey(coldkeyId: string, password: string): Promise<void> {
    try {
      const mnemonic = mnemonicGenerate(12)
      const pair = this.keyring.addFromUri(mnemonic)
      const id = crypto.randomUUID()

      const encrypted = await encrypt(mnemonic, password)

      const encryptedHotkey: EncryptedHotkey = {
        id,
        name: 'default',
        address: pair.address,
        coldkeyId,
        encrypted,
        registeredNeuronets: [],
        createdAt: Date.now(),
        backedUp: false,
      }

      const hotkeys = await getHotkeyStore()
      hotkeys.push(encryptedHotkey)
      await saveHotkeyStore(hotkeys)

      this.unlockedHotkeys.set(id, pair)
    } catch (error) {
      console.error('Failed to create default hotkey:', error)
    }
  }

  async createHotkey(
    name: string,
    coldkeyId: string,
    password: string,
    wordCount: 12 | 24 = 12
  ): Promise<CreatedHotkey> {
    await this.initialize()

    const store = await getWalletStore()
    const coldkey = store.wallets.find((w) => w.id === coldkeyId)
    if (!coldkey) {
      throw new Error('Coldkey wallet not found')
    }

    // Verify password by attempting to decrypt coldkey
    try {
      await decrypt(coldkey.encrypted, password)
    } catch {
      throw new Error('Invalid password')
    }

    const mnemonic = mnemonicGenerate(wordCount)
    const pair = this.keyring.addFromUri(mnemonic)
    const id = crypto.randomUUID()

    const encrypted = await encrypt(mnemonic, password)

    const encryptedHotkey: EncryptedHotkey = {
      id,
      name,
      address: pair.address,
      coldkeyId,
      encrypted,
      registeredNeuronets: [],
      createdAt: Date.now(),
      backedUp: false,
    }

    const hotkeys = await getHotkeyStore()
    hotkeys.push(encryptedHotkey)
    await saveHotkeyStore(hotkeys)

    this.unlockedHotkeys.set(id, pair)

    return {
      id,
      name,
      address: pair.address,
      coldkeyId,
      registeredNeuronets: [],
      createdAt: encryptedHotkey.createdAt,
      backedUp: false,
      mnemonic,
    }
  }

  async importHotkey(
    name: string,
    mnemonic: string,
    coldkeyId: string,
    password: string
  ): Promise<CreatedHotkey> {
    await this.initialize()

    if (!mnemonicValidate(mnemonic)) {
      throw new Error('Invalid mnemonic phrase')
    }

    const store = await getWalletStore()
    const coldkey = store.wallets.find((w) => w.id === coldkeyId)
    if (!coldkey) {
      throw new Error('Coldkey wallet not found')
    }

    // Verify password by attempting to decrypt coldkey
    try {
      await decrypt(coldkey.encrypted, password)
    } catch {
      throw new Error('Invalid password')
    }

    const pair = this.keyring.addFromUri(mnemonic)
    const id = crypto.randomUUID()

    const encrypted = await encrypt(mnemonic, password)

    const encryptedHotkey: EncryptedHotkey = {
      id,
      name,
      address: pair.address,
      coldkeyId,
      encrypted,
      registeredNeuronets: [],
      createdAt: Date.now(),
      backedUp: true, // Imported hotkeys are considered backed up
    }

    const hotkeys = await getHotkeyStore()
    hotkeys.push(encryptedHotkey)
    await saveHotkeyStore(hotkeys)

    this.unlockedHotkeys.set(id, pair)

    return {
      id,
      name,
      address: pair.address,
      coldkeyId,
      registeredNeuronets: [],
      createdAt: encryptedHotkey.createdAt,
      backedUp: true,
      mnemonic,
    }
  }

  async getHotkeys(coldkeyId: string): Promise<Hotkey[]> {
    const hotkeys = await getHotkeyStore()
    return hotkeys
      .filter((h) => h.coldkeyId === coldkeyId)
      .map((h) => ({
        id: h.id,
        name: h.name,
        address: h.address,
        coldkeyId: h.coldkeyId,
        registeredNeuronets: h.registeredNeuronets,
        createdAt: h.createdAt,
        backedUp: h.backedUp ?? false,
      }))
  }

  async markHotkeyBackedUp(hotkeyId: string): Promise<void> {
    const hotkeys = await getHotkeyStore()
    const hotkey = hotkeys.find((h) => h.id === hotkeyId)
    if (hotkey) {
      hotkey.backedUp = true
      await saveHotkeyStore(hotkeys)
    }
  }

  async unlockHotkey(hotkeyId: string, password: string): Promise<boolean> {
    const hotkeys = await getHotkeyStore()
    const hotkey = hotkeys.find((h) => h.id === hotkeyId)

    if (!hotkey) {
      throw new Error('Hotkey not found')
    }

    try {
      const mnemonic = await decrypt(hotkey.encrypted, password)
      const pair = this.keyring.addFromUri(mnemonic)
      this.unlockedHotkeys.set(hotkeyId, pair)
      return true
    } catch {
      return false
    }
  }

  async deleteHotkey(hotkeyId: string): Promise<void> {
    const hotkeys = await getHotkeyStore()
    const filtered = hotkeys.filter((h) => h.id !== hotkeyId)
    await saveHotkeyStore(filtered)
    this.unlockedHotkeys.delete(hotkeyId)
  }

  async exportHotkeyMnemonic(hotkeyId: string, password: string): Promise<string> {
    const hotkeys = await getHotkeyStore()
    const hotkey = hotkeys.find((h) => h.id === hotkeyId)

    if (!hotkey) {
      throw new Error('Hotkey not found')
    }

    return await decrypt(hotkey.encrypted, password)
  }

  getHotkeyPair(hotkeyId: string): KeyringPair | null {
    return this.unlockedHotkeys.get(hotkeyId) || null
  }

  // ==================== SETTINGS ====================

  async getSettings(): Promise<WalletStoreSettings> {
    const store = await getWalletStore()
    return store.settings
  }

  async updateSettings(settings: Partial<WalletStoreSettings>): Promise<void> {
    const store = await getWalletStore()
    store.settings = { ...store.settings, ...settings }
    await saveWalletStore(store)

    // Update lock timeout if changed
    if (settings.autoLockTimeout !== undefined) {
      this.resetLockTimeout(settings.autoLockTimeout)
    }
  }

  // ==================== AUTO-LOCK ====================

  private resetLockTimeout(minutes: number): void {
    if (this.lockTimeout) {
      clearTimeout(this.lockTimeout)
      this.lockTimeout = null
    }

    if (minutes > 0) {
      this.lockTimeout = setTimeout(() => {
        this.lock()
      }, minutes * 60 * 1000)
    }
  }
}

export const walletService = new WalletService()
