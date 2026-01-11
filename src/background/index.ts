// Background Service Worker - main entry point
import { walletService } from './walletService'
import { connectionManager } from './connectionManager'
import { dappHandler } from './dappHandler'
import type { PopupMessage, MessageResponse, DappRequest } from '@lib/messaging'
import { RAO_PER_TAO } from '@shared/types'

// Initialize on install
chrome.runtime.onInstalled.addListener(async () => {
  console.log('AETRON Wallet extension installed')
  await walletService.initialize()
})

// Keep service worker alive with periodic alarm
chrome.alarms.create('keepAlive', { periodInMinutes: 0.5 })

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'keepAlive') {
    connectionManager.ping()
  }
})

// Handle messages from popup
chrome.runtime.onMessage.addListener(
  (message: PopupMessage, _sender, sendResponse) => {
    handlePopupMessage(message)
      .then(sendResponse)
      .catch((error) => {
        sendResponse({ success: false, error: error.message } as MessageResponse)
      })
    return true // Keep channel open for async response
  }
)

// Handle connections from content scripts
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'aetron-content') {
    port.onMessage.addListener(async (msg: DappRequest) => {
      try {
        const result = await dappHandler.handleRequest(msg, port)
        port.postMessage({
          type: 'AETRON_RESPONSE',
          id: msg.id,
          result,
        })
      } catch (error) {
        port.postMessage({
          type: 'AETRON_RESPONSE',
          id: msg.id,
          error: (error as Error).message,
        })
      }
    })
  }
})

async function handlePopupMessage(message: PopupMessage): Promise<MessageResponse> {
  await walletService.initialize()

  try {
    switch (message.type) {
      // ==================== WALLET OPERATIONS ====================

      case 'wallet:list': {
        const wallets = await walletService.getWallets()
        return { success: true, data: wallets }
      }

      case 'wallet:get-active': {
        const wallet = await walletService.getActiveWallet()
        return { success: true, data: wallet }
      }

      case 'wallet:set-active': {
        await walletService.setActiveWallet(message.payload.walletId)
        return { success: true, data: undefined }
      }

      case 'wallet:create': {
        const { name, password, mnemonic } = message.payload
        const result = await walletService.createWallet(name, password, mnemonic)
        return { success: true, data: result }
      }

      case 'wallet:import-mnemonic': {
        const { name, mnemonic, password } = message.payload
        const wallet = await walletService.importFromMnemonic(name, mnemonic, password)
        return { success: true, data: wallet }
      }

      case 'wallet:import-private-key': {
        const { name, privateKey, password } = message.payload
        const wallet = await walletService.importFromPrivateKey(name, privateKey, password)
        return { success: true, data: wallet }
      }

      case 'wallet:import-keystore': {
        const { name, keystoreJson, keystorePassword, newPassword } = message.payload
        const wallet = await walletService.importFromKeystore(name, keystoreJson, keystorePassword, newPassword)
        return { success: true, data: wallet }
      }

      case 'wallet:delete': {
        await walletService.deleteWallet(message.payload.walletId)
        return { success: true, data: undefined }
      }

      case 'wallet:clear-all': {
        await walletService.clearAllWallets()
        return { success: true, data: undefined }
      }

      case 'wallet:rename': {
        await walletService.renameWallet(message.payload.walletId, message.payload.newName)
        return { success: true, data: undefined }
      }

      case 'wallet:unlock': {
        const success = await walletService.unlockWallet(
          message.payload.walletId,
          message.payload.password
        )
        return { success: true, data: success }
      }

      case 'wallet:lock': {
        await walletService.lock()
        return { success: true, data: undefined }
      }

      case 'wallet:is-unlocked': {
        const unlocked = walletService.isUnlocked(message.payload.walletId)
        return { success: true, data: unlocked }
      }

      case 'wallet:export-mnemonic': {
        const mnemonic = await walletService.exportMnemonic(
          message.payload.walletId,
          message.payload.password
        )
        return { success: true, data: mnemonic }
      }

      case 'wallet:change-password': {
        await walletService.changePassword(
          message.payload.walletId,
          message.payload.currentPassword,
          message.payload.newPassword
        )
        return { success: true, data: undefined }
      }

      case 'wallet:sign-message': {
        const signature = await walletService.signMessage(
          message.payload.walletId,
          message.payload.message
        )
        return { success: true, data: signature }
      }

      case 'wallet:sign-transaction': {
        const signature = await walletService.signTransaction(
          message.payload.walletId,
          message.payload.payloadHex
        )
        return { success: true, data: signature }
      }

      // ==================== HOTKEY OPERATIONS ====================

      case 'hotkey:list': {
        const hotkeys = await walletService.getHotkeys(message.payload.coldkeyId)
        return { success: true, data: hotkeys }
      }

      case 'hotkey:create': {
        const { name, coldkeyId, password, wordCount } = message.payload
        const hotkey = await walletService.createHotkey(name, coldkeyId, password, wordCount)
        return { success: true, data: hotkey }
      }

      case 'hotkey:import': {
        const { name, mnemonic, coldkeyId, password } = message.payload
        const hotkey = await walletService.importHotkey(name, mnemonic, coldkeyId, password)
        return { success: true, data: hotkey }
      }

      case 'hotkey:delete': {
        await walletService.deleteHotkey(message.payload.hotkeyId)
        return { success: true, data: undefined }
      }

      case 'hotkey:unlock': {
        const success = await walletService.unlockHotkey(
          message.payload.hotkeyId,
          message.payload.password
        )
        return { success: true, data: success }
      }

      case 'hotkey:export-mnemonic': {
        const mnemonic = await walletService.exportHotkeyMnemonic(
          message.payload.hotkeyId,
          message.payload.password
        )
        return { success: true, data: mnemonic }
      }

      case 'hotkey:mark-backed-up': {
        await walletService.markHotkeyBackedUp(message.payload.hotkeyId)
        return { success: true, data: undefined }
      }

      // ==================== NETWORK OPERATIONS ====================

      case 'network:connect': {
        const connected = await connectionManager.connect(
          message.payload.networkId,
          message.payload.customUrl
        )
        return { success: true, data: connected }
      }

      case 'network:disconnect': {
        await connectionManager.disconnect()
        return { success: true, data: undefined }
      }

      case 'network:get-status': {
        const network = connectionManager.getNetwork()
        return {
          success: true,
          data: {
            connected: connectionManager.isConnected(),
            networkId: network?.id || null,
          },
        }
      }

      case 'network:test': {
        const testResult = await connectionManager.testConnection(message.payload.url)
        return { success: true, data: testResult }
      }

      // ==================== BLOCKCHAIN QUERIES ====================

      case 'balance:get': {
        const balance = await connectionManager.getBalance(message.payload.address)
        // Convert BigInt to serializable format
        return {
          success: true,
          data: {
            free: balance.free.toString(),
            reserved: balance.reserved.toString(),
            frozen: balance.frozen.toString(),
            total: balance.total.toString(),
          },
        }
      }

      case 'staking:get-info': {
        const stakes = await connectionManager.getStakeInfo(message.payload.address)
        // Convert BigInt to serializable format
        return {
          success: true,
          data: stakes.map((s) => ({
            ...s,
            stake: s.stake.toString(),
          })),
        }
      }

      case 'neuronets:list': {
        const neuronets = await connectionManager.getNeuronets()
        // Convert BigInt to serializable format
        return {
          success: true,
          data: neuronets.map((n) => ({
            ...n,
            difficulty: n.difficulty.toString(),
          })),
        }
      }

      case 'transfers:get': {
        const transfers = await connectionManager.getTransfers(
          message.payload.address,
          message.payload.limit || 20
        )
        return { success: true, data: transfers }
      }

      case 'fee:estimate': {
        const { from, to, amount } = message.payload
        const amountBigInt = BigInt(Math.floor(parseFloat(amount) * Number(RAO_PER_TAO)))
        const fee = await connectionManager.getTransferFee(from, to, amountBigInt)
        return { success: true, data: fee.toString() }
      }

      // ==================== TRANSACTIONS ====================

      case 'transfer:send': {
        const activeWallet = await walletService.getActiveWallet()
        if (!activeWallet) {
          return { success: false, error: 'No active wallet' }
        }

        if (!walletService.isUnlocked(activeWallet.id)) {
          return { success: false, error: 'Wallet is locked' }
        }

        const keypair = walletService.getKeypair(activeWallet.id)
        if (!keypair) {
          return { success: false, error: 'Failed to get keypair' }
        }

        const signer = {
          address: activeWallet.address,
          sign: async (data: Uint8Array) => keypair.sign(data),
        }

        const { to, amount } = message.payload
        const amountBigInt = BigInt(Math.floor(parseFloat(amount) * Number(RAO_PER_TAO)))

        const result = await connectionManager.transfer(signer, to, amountBigInt)
        return { success: true, data: result }
      }

      case 'staking:add': {
        const activeWallet = await walletService.getActiveWallet()
        if (!activeWallet) {
          return { success: false, error: 'No active wallet' }
        }

        if (!walletService.isUnlocked(activeWallet.id)) {
          return { success: false, error: 'Wallet is locked' }
        }

        const keypair = walletService.getKeypair(activeWallet.id)
        if (!keypair) {
          return { success: false, error: 'Failed to get keypair' }
        }

        const signer = {
          address: activeWallet.address,
          sign: async (data: Uint8Array) => keypair.sign(data),
        }

        const { hotkey, netuid, amount } = message.payload
        const amountBigInt = BigInt(Math.floor(parseFloat(amount) * Number(RAO_PER_TAO)))

        const result = await connectionManager.addStake(signer, hotkey, netuid, amountBigInt)
        return { success: true, data: result }
      }

      case 'staking:remove': {
        const activeWallet = await walletService.getActiveWallet()
        if (!activeWallet) {
          return { success: false, error: 'No active wallet' }
        }

        if (!walletService.isUnlocked(activeWallet.id)) {
          return { success: false, error: 'Wallet is locked' }
        }

        const keypair = walletService.getKeypair(activeWallet.id)
        if (!keypair) {
          return { success: false, error: 'Failed to get keypair' }
        }

        const signer = {
          address: activeWallet.address,
          sign: async (data: Uint8Array) => keypair.sign(data),
        }

        const { hotkey, netuid, amount } = message.payload
        const amountBigInt = BigInt(Math.floor(parseFloat(amount) * Number(RAO_PER_TAO)))

        const result = await connectionManager.removeStake(signer, hotkey, netuid, amountBigInt)
        return { success: true, data: result }
      }

      case 'staking:move': {
        const activeWallet = await walletService.getActiveWallet()
        if (!activeWallet) {
          return { success: false, error: 'No active wallet' }
        }

        if (!walletService.isUnlocked(activeWallet.id)) {
          return { success: false, error: 'Wallet is locked' }
        }

        const keypair = walletService.getKeypair(activeWallet.id)
        if (!keypair) {
          return { success: false, error: 'Failed to get keypair' }
        }

        const signer = {
          address: activeWallet.address,
          sign: async (data: Uint8Array) => keypair.sign(data),
        }

        const { srcHotkey, destHotkey, netuid, amount } = message.payload
        const amountBigInt = BigInt(Math.floor(parseFloat(amount) * Number(RAO_PER_TAO)))

        const result = await connectionManager.moveStake(signer, srcHotkey, destHotkey, netuid, amountBigInt)
        return { success: true, data: result }
      }

      // ==================== ENHANCED STAKING ====================

      case 'staking:get-info-detailed': {
        const stakes = await connectionManager.getStakeInfoForColdkey(message.payload.address)
        // Convert BigInt to serializable format
        return {
          success: true,
          data: stakes.map((s) => ({
            ...s,
            stake: s.stake.toString(),
            locked: s.locked.toString(),
            emission: s.emission.toString(),
            aetEmission: s.aetEmission.toString(),
          })),
        }
      }

      case 'staking:add-limit': {
        const activeWallet = await walletService.getActiveWallet()
        if (!activeWallet) {
          return { success: false, error: 'No active wallet' }
        }

        if (!walletService.isUnlocked(activeWallet.id)) {
          return { success: false, error: 'Wallet is locked' }
        }

        const keypair = walletService.getKeypair(activeWallet.id)
        if (!keypair) {
          return { success: false, error: 'Failed to get keypair' }
        }

        const signer = {
          address: activeWallet.address,
          sign: async (data: Uint8Array) => keypair.sign(data),
        }

        const { hotkey, netuid, amount, limitPrice, allowPartial } = message.payload
        const amountBigInt = BigInt(Math.floor(parseFloat(amount) * Number(RAO_PER_TAO)))
        const limitPriceBigInt = BigInt(Math.floor(parseFloat(limitPrice) * Number(RAO_PER_TAO)))

        const result = await connectionManager.addStakeLimit(
          signer, hotkey, netuid, amountBigInt, limitPriceBigInt, allowPartial
        )
        return { success: true, data: result }
      }

      case 'neuronets:list-detailed': {
        const neuronets = await connectionManager.getAllNeuronetsInfo()
        // Convert BigInt to serializable format
        return {
          success: true,
          data: neuronets.map((n) => ({
            ...n,
            difficulty: n.difficulty.toString(),
            totalStake: n.totalStake.toString(),
            quantIn: n.quantIn.toString(),
            aetIn: n.aetIn.toString(),
            aetInEmission: n.aetInEmission.toString(),
          })),
        }
      }

      case 'neuronets:get-validators': {
        const validators = await connectionManager.getNeuronetHotkeys(message.payload.netuid)
        // Convert BigInt to serializable format
        return {
          success: true,
          data: validators.map((v) => ({
            ...v,
            stake: v.stake.toString(),
          })),
        }
      }

      case 'neuronets:get-price': {
        const price = await connectionManager.getNeuronetPrice(message.payload.netuid)
        return { success: true, data: price }
      }

      // ==================== SETTINGS ====================

      case 'settings:get': {
        const settings = await walletService.getSettings()
        return { success: true, data: settings }
      }

      case 'settings:update': {
        await walletService.updateSettings(message.payload)
        return { success: true, data: undefined }
      }

      // ==================== PERMISSIONS ====================

      case 'permissions:get-all': {
        const permissions = await dappHandler.getAllPermissions()
        return { success: true, data: permissions }
      }

      case 'permissions:revoke': {
        await dappHandler.revokePermission(message.payload.origin)
        return { success: true, data: undefined }
      }

      // ==================== PRICE ====================

      case 'price:get': {
        const { networkId } = message.payload
        const networkPath = networkId === 'test' ? 'testnet' : 'mainnet'
        const apiUrl = `https://api-explorer.aetron.io/${networkPath}/api/network-stats`

        try {
          const response = await fetch(apiUrl)
          if (!response.ok) {
            throw new Error(`HTTP error: ${response.status}`)
          }
          const data = await response.json()
          return { success: true, data: data.price || 0 }
        } catch (error) {
          console.error('Failed to fetch price:', error)
          return { success: true, data: 0 }
        }
      }

      default:
        return { success: false, error: `Unknown message type: ${(message as any).type}` }
    }
  } catch (error) {
    console.error('Message handler error:', error)
    return { success: false, error: (error as Error).message }
  }
}

console.log('AETRON Wallet background service worker started')
