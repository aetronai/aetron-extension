// Chrome storage wrapper for extension

import type { WalletStore, EncryptedHotkey, WalletStoreSettings } from '@shared/wallet/types'
import type { RecentAddress } from '@shared/types'

export interface ExtensionStorage {
  // Wallet store (encrypted wallets, settings)
  aetron_wallet_store: WalletStore

  // Encrypted hotkeys
  aetron_hotkey_store: EncryptedHotkey[]

  // Recent addresses
  aetron_recent_addresses: RecentAddress[]

  // Site permissions for dApps
  aetron_permissions: Record<string, SitePermission>

  // UI state
  aetron_ui_state: UIState

  // Lock state
  aetron_lock_state: LockState
}

export interface SitePermission {
  connected: boolean
  accounts: string[]
  connectedAt: number
}

export interface UIState {
  lastViewedPage: string
  expandedSections: string[]
}

export interface LockState {
  isLocked: boolean
  lastUnlockedAt: number | null
}

const DEFAULT_SETTINGS: WalletStoreSettings = {
  autoLockTimeout: 15,
  requirePasswordOnSend: true,
  showTestNetworks: true,
  language: 'en',
}

const DEFAULT_WALLET_STORE: WalletStore = {
  version: 1,
  wallets: [],
  activeWalletId: null,
  settings: DEFAULT_SETTINGS,
}

/**
 * Get value from chrome storage
 */
export async function storageGet<K extends keyof ExtensionStorage>(
  key: K
): Promise<ExtensionStorage[K] | undefined> {
  const result = await chrome.storage.local.get(key)
  return result[key] as ExtensionStorage[K] | undefined
}

/**
 * Set value in chrome storage
 */
export async function storageSet<K extends keyof ExtensionStorage>(
  key: K,
  value: ExtensionStorage[K]
): Promise<void> {
  await chrome.storage.local.set({ [key]: value })
}

/**
 * Update value in chrome storage with updater function
 */
export async function storageUpdate<K extends keyof ExtensionStorage>(
  key: K,
  updater: (current: ExtensionStorage[K] | undefined) => ExtensionStorage[K]
): Promise<void> {
  const current = await storageGet(key)
  const updated = updater(current)
  await storageSet(key, updated)
}

/**
 * Remove key from chrome storage
 */
export async function storageRemove<K extends keyof ExtensionStorage>(key: K): Promise<void> {
  await chrome.storage.local.remove(key)
}

/**
 * Clear all extension storage
 */
export async function storageClear(): Promise<void> {
  await chrome.storage.local.clear()
}

/**
 * Get wallet store with defaults
 */
export async function getWalletStore(): Promise<WalletStore> {
  const store = await storageGet('aetron_wallet_store')
  return store || DEFAULT_WALLET_STORE
}

/**
 * Save wallet store
 */
export async function saveWalletStore(store: WalletStore): Promise<void> {
  await storageSet('aetron_wallet_store', store)
}

/**
 * Get hotkey store
 */
export async function getHotkeyStore(): Promise<EncryptedHotkey[]> {
  const store = await storageGet('aetron_hotkey_store')
  return store || []
}

/**
 * Save hotkey store
 */
export async function saveHotkeyStore(hotkeys: EncryptedHotkey[]): Promise<void> {
  await storageSet('aetron_hotkey_store', hotkeys)
}

/**
 * Get recent addresses
 */
export async function getRecentAddresses(): Promise<RecentAddress[]> {
  const recent = await storageGet('aetron_recent_addresses')
  return recent || []
}

/**
 * Add a recent address (max 10, most recent first)
 */
export async function addRecentAddress(address: string, label?: string): Promise<void> {
  const recent = await getRecentAddresses()
  // Remove if already exists
  const filtered = recent.filter(r => r.address !== address)
  // Add to beginning
  filtered.unshift({ address, label, lastUsed: Date.now() })
  // Keep max 10
  const trimmed = filtered.slice(0, 10)
  await storageSet('aetron_recent_addresses', trimmed)
}

/**
 * Get site permissions
 */
export async function getPermissions(): Promise<Record<string, SitePermission>> {
  const permissions = await storageGet('aetron_permissions')
  return permissions || {}
}

/**
 * Save site permissions
 */
export async function savePermissions(permissions: Record<string, SitePermission>): Promise<void> {
  await storageSet('aetron_permissions', permissions)
}

/**
 * Get lock state
 */
export async function getLockState(): Promise<LockState> {
  const state = await storageGet('aetron_lock_state')
  return state || { isLocked: true, lastUnlockedAt: null }
}

/**
 * Save lock state
 */
export async function saveLockState(state: LockState): Promise<void> {
  await storageSet('aetron_lock_state', state)
}

/**
 * Listen for storage changes
 */
export function onStorageChange(
  callback: (changes: { [key: string]: chrome.storage.StorageChange }) => void
): () => void {
  const listener = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
    if (areaName === 'local') {
      callback(changes)
    }
  }
  chrome.storage.onChanged.addListener(listener)
  return () => chrome.storage.onChanged.removeListener(listener)
}
