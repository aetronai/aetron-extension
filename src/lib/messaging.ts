// Chrome extension messaging utilities

import type { WalletAccount, Hotkey, CreatedHotkey, WalletStoreSettings } from '@shared/wallet/types'
import type { BalanceInfo, StakeInfo, NeuronetInfo, TransactionResult, StakeInfoDetailed, NeuronetInfoDetailed, ValidatorHotkey } from '@shared/types'

// Message types for popup <-> background communication
export type PopupMessage =
  // Wallet operations
  | { type: 'wallet:list' }
  | { type: 'wallet:get-active' }
  | { type: 'wallet:set-active'; payload: { walletId: string } }
  | { type: 'wallet:create'; payload: { name: string; password: string; mnemonic?: string } }
  | { type: 'wallet:import-mnemonic'; payload: { name: string; mnemonic: string; password: string } }
  | { type: 'wallet:import-private-key'; payload: { name: string; privateKey: string; password: string } }
  | { type: 'wallet:import-keystore'; payload: { name: string; keystoreJson: string; keystorePassword: string; newPassword: string } }
  | { type: 'wallet:delete'; payload: { walletId: string } }
  | { type: 'wallet:rename'; payload: { walletId: string; newName: string } }
  | { type: 'wallet:unlock'; payload: { walletId: string; password: string } }
  | { type: 'wallet:lock' }
  | { type: 'wallet:is-unlocked'; payload: { walletId: string } }
  | { type: 'wallet:export-mnemonic'; payload: { walletId: string; password: string } }
  | { type: 'wallet:change-password'; payload: { walletId: string; currentPassword: string; newPassword: string } }
  | { type: 'wallet:sign-message'; payload: { walletId: string; message: string } }
  | { type: 'wallet:sign-transaction'; payload: { walletId: string; payloadHex: string } }
  | { type: 'wallet:clear-all' }

  // Hotkey operations
  | { type: 'hotkey:list'; payload: { coldkeyId: string } }
  | { type: 'hotkey:create'; payload: { name: string; coldkeyId: string; password: string; wordCount?: 12 | 24 } }
  | { type: 'hotkey:import'; payload: { name: string; mnemonic: string; coldkeyId: string; password: string } }
  | { type: 'hotkey:delete'; payload: { hotkeyId: string } }
  | { type: 'hotkey:unlock'; payload: { hotkeyId: string; password: string } }
  | { type: 'hotkey:export-mnemonic'; payload: { hotkeyId: string; password: string } }
  | { type: 'hotkey:mark-backed-up'; payload: { hotkeyId: string } }

  // Network operations
  | { type: 'network:connect'; payload: { networkId: string; customUrl?: string } }
  | { type: 'network:disconnect' }
  | { type: 'network:get-status' }
  | { type: 'network:test'; payload: { url: string } }

  // Balance and blockchain queries
  | { type: 'balance:get'; payload: { address: string } }
  | { type: 'staking:get-info'; payload: { address: string } }
  | { type: 'neuronets:list' }
  | { type: 'transfers:get'; payload: { address: string; limit?: number } }
  | { type: 'fee:estimate'; payload: { from: string; to: string; amount: string } }

  // Transactions
  | { type: 'transfer:send'; payload: { to: string; amount: string } }
  | { type: 'staking:add'; payload: { hotkey: string; netuid: number; amount: string } }
  | { type: 'staking:remove'; payload: { hotkey: string; netuid: number; amount: string } }
  | { type: 'staking:move'; payload: { srcHotkey: string; destHotkey: string; netuid: number; amount: string } }

  // Enhanced staking operations
  | { type: 'staking:get-info-detailed'; payload: { address: string } }
  | { type: 'staking:add-limit'; payload: { hotkey: string; netuid: number; amount: string; limitPrice: string; allowPartial: boolean } }
  | { type: 'neuronets:list-detailed' }
  | { type: 'neuronets:get-validators'; payload: { netuid: number } }
  | { type: 'neuronets:get-price'; payload: { netuid: number } }

  // Settings
  | { type: 'settings:get' }
  | { type: 'settings:update'; payload: Partial<WalletStoreSettings> }

  // Price
  | { type: 'price:get'; payload: { networkId: string } }

  // dApp permissions
  | { type: 'permissions:get-all' }
  | { type: 'permissions:revoke'; payload: { origin: string } }

// Response types
export type MessageResponse<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string }

// dApp message types (from content script)
export type DappMessage =
  | { method: 'connect' }
  | { method: 'disconnect' }
  | { method: 'getAccounts' }
  | { method: 'getBalance'; params?: { address?: string } }
  | { method: 'signMessage'; params: { message: string; address?: string } }
  | { method: 'signTransaction'; params: { payload: unknown } }
  | { method: 'sendTransaction'; params: { to: string; amount: string } }
  | { method: 'addStake'; params: { hotkey: string; netuid: number; amount: string } }
  | { method: 'removeStake'; params: { hotkey: string; netuid: number; amount: string } }

export interface DappRequest {
  id: number
  origin: string
  method: string
  params?: unknown
}

/**
 * Send message to background script and get response
 */
export async function sendMessage<T>(message: PopupMessage): Promise<T> {
  const response = await chrome.runtime.sendMessage(message) as MessageResponse<T>
  if (!response.success) {
    throw new Error(response.error)
  }
  return response.data
}

/**
 * Get list of wallets
 */
export async function getWallets(): Promise<WalletAccount[]> {
  return sendMessage<WalletAccount[]>({ type: 'wallet:list' })
}

/**
 * Get active wallet
 */
export async function getActiveWallet(): Promise<WalletAccount | null> {
  return sendMessage<WalletAccount | null>({ type: 'wallet:get-active' })
}

/**
 * Set active wallet
 */
export async function setActiveWallet(walletId: string): Promise<void> {
  return sendMessage<void>({ type: 'wallet:set-active', payload: { walletId } })
}

/**
 * Create new wallet
 */
export async function createWallet(name: string, password: string, mnemonic?: string): Promise<WalletAccount> {
  return sendMessage<WalletAccount>({ type: 'wallet:create', payload: { name, password, mnemonic } })
}

/**
 * Import wallet from mnemonic
 */
export async function importFromMnemonic(name: string, mnemonic: string, password: string): Promise<WalletAccount> {
  return sendMessage<WalletAccount>({ type: 'wallet:import-mnemonic', payload: { name, mnemonic, password } })
}

/**
 * Import wallet from private key
 */
export async function importFromPrivateKey(name: string, privateKey: string, password: string): Promise<WalletAccount> {
  return sendMessage<WalletAccount>({ type: 'wallet:import-private-key', payload: { name, privateKey, password } })
}

/**
 * Import wallet from JSON keystore file
 */
export async function importFromKeystore(name: string, keystoreJson: string, keystorePassword: string, newPassword: string): Promise<WalletAccount> {
  return sendMessage<WalletAccount>({ type: 'wallet:import-keystore', payload: { name, keystoreJson, keystorePassword, newPassword } })
}

/**
 * Delete wallet
 */
export async function deleteWallet(walletId: string): Promise<void> {
  return sendMessage<void>({ type: 'wallet:delete', payload: { walletId } })
}

/**
 * Rename wallet
 */
export async function renameWallet(walletId: string, newName: string): Promise<void> {
  return sendMessage<void>({ type: 'wallet:rename', payload: { walletId, newName } })
}

/**
 * Unlock wallet
 */
export async function unlockWallet(walletId: string, password: string): Promise<boolean> {
  return sendMessage<boolean>({ type: 'wallet:unlock', payload: { walletId, password } })
}

/**
 * Lock all wallets
 */
export async function lockWallets(): Promise<void> {
  return sendMessage<void>({ type: 'wallet:lock' })
}

/**
 * Check if wallet is unlocked
 */
export async function isWalletUnlocked(walletId: string): Promise<boolean> {
  return sendMessage<boolean>({ type: 'wallet:is-unlocked', payload: { walletId } })
}

/**
 * Export wallet mnemonic
 */
export async function exportMnemonic(walletId: string, password: string): Promise<string> {
  return sendMessage<string>({ type: 'wallet:export-mnemonic', payload: { walletId, password } })
}

/**
 * Clear all wallets (forgot password reset)
 */
export async function clearAllWallets(): Promise<void> {
  return sendMessage<void>({ type: 'wallet:clear-all' })
}

/**
 * Sign message
 */
export async function signMessage(walletId: string, message: string): Promise<string> {
  return sendMessage<string>({ type: 'wallet:sign-message', payload: { walletId, message } })
}

/**
 * Get hotkeys for coldkey
 */
export async function getHotkeys(coldkeyId: string): Promise<Hotkey[]> {
  return sendMessage<Hotkey[]>({ type: 'hotkey:list', payload: { coldkeyId } })
}

/**
 * Create hotkey
 */
export async function createHotkey(
  name: string,
  coldkeyId: string,
  password: string,
  wordCount: 12 | 24 = 12
): Promise<CreatedHotkey> {
  return sendMessage<CreatedHotkey>({
    type: 'hotkey:create',
    payload: { name, coldkeyId, password, wordCount }
  })
}

/**
 * Import hotkey from mnemonic
 */
export async function importHotkey(
  name: string,
  mnemonic: string,
  coldkeyId: string,
  password: string
): Promise<CreatedHotkey> {
  return sendMessage<CreatedHotkey>({
    type: 'hotkey:import',
    payload: { name, mnemonic, coldkeyId, password }
  })
}

/**
 * Delete hotkey
 */
export async function deleteHotkey(hotkeyId: string): Promise<void> {
  return sendMessage<void>({ type: 'hotkey:delete', payload: { hotkeyId } })
}

/**
 * Get balance
 */
export async function getBalance(address: string): Promise<BalanceInfo> {
  return sendMessage<BalanceInfo>({ type: 'balance:get', payload: { address } })
}

/**
 * Get staking info
 */
export async function getStakingInfo(address: string): Promise<StakeInfo[]> {
  return sendMessage<StakeInfo[]>({ type: 'staking:get-info', payload: { address } })
}

/**
 * Get neuronets list
 */
export async function getNeuronets(): Promise<NeuronetInfo[]> {
  return sendMessage<NeuronetInfo[]>({ type: 'neuronets:list' })
}

/**
 * Send transfer
 */
export async function sendTransfer(to: string, amount: string): Promise<TransactionResult> {
  return sendMessage<TransactionResult>({ type: 'transfer:send', payload: { to, amount } })
}

/**
 * Add stake
 */
export async function addStake(hotkey: string, netuid: number, amount: string): Promise<TransactionResult> {
  return sendMessage<TransactionResult>({ type: 'staking:add', payload: { hotkey, netuid, amount } })
}

/**
 * Remove stake
 */
export async function removeStake(hotkey: string, netuid: number, amount: string): Promise<TransactionResult> {
  return sendMessage<TransactionResult>({ type: 'staking:remove', payload: { hotkey, netuid, amount } })
}

/**
 * Get transfer history
 */
export async function getTransfers(address: string, limit: number = 20): Promise<{
  hash: string
  type: 'sent' | 'received'
  amount: string
  counterparty: string
  blockNumber: number
  timestamp: number
  status: 'confirmed'
}[]> {
  return sendMessage({ type: 'transfers:get', payload: { address, limit } })
}

/**
 * Get settings
 */
export async function getSettings(): Promise<WalletStoreSettings> {
  return sendMessage<WalletStoreSettings>({ type: 'settings:get' })
}

/**
 * Update settings
 */
export async function updateSettings(settings: Partial<WalletStoreSettings>): Promise<void> {
  return sendMessage<void>({ type: 'settings:update', payload: settings })
}

/**
 * Connect to network
 */
export async function connectNetwork(networkId: string, customUrl?: string): Promise<boolean> {
  return sendMessage<boolean>({ type: 'network:connect', payload: { networkId, customUrl } })
}

/**
 * Disconnect from network
 */
export async function disconnectNetwork(): Promise<void> {
  return sendMessage<void>({ type: 'network:disconnect' })
}

/**
 * Get network status
 */
export async function getNetworkStatus(): Promise<{ connected: boolean; networkId: string | null }> {
  return sendMessage<{ connected: boolean; networkId: string | null }>({ type: 'network:get-status' })
}

// ==================== ENHANCED STAKING API ====================

/**
 * Get detailed staking info with rewards/emission (uses RuntimeAPI)
 */
export async function getStakingInfoDetailed(address: string): Promise<StakeInfoDetailed[]> {
  return sendMessage<StakeInfoDetailed[]>({ type: 'staking:get-info-detailed', payload: { address } })
}

/**
 * Add stake with limit price (Safe Mode) - prevents frontrunning
 */
export async function addStakeLimit(
  hotkey: string,
  netuid: number,
  amount: string,
  limitPrice: string,
  allowPartial: boolean = true
): Promise<TransactionResult> {
  return sendMessage<TransactionResult>({
    type: 'staking:add-limit',
    payload: { hotkey, netuid, amount, limitPrice, allowPartial }
  })
}

/**
 * Get detailed neuronets list with liquidity pool data
 */
export async function getNeuronetsDetailed(): Promise<NeuronetInfoDetailed[]> {
  return sendMessage<NeuronetInfoDetailed[]>({ type: 'neuronets:list-detailed' })
}

/**
 * Get validators (hotkeys) registered on a neuronet
 */
export async function getNeuronetValidators(netuid: number): Promise<ValidatorHotkey[]> {
  return sendMessage<ValidatorHotkey[]>({ type: 'neuronets:get-validators', payload: { netuid } })
}

/**
 * Get neuronet price (QUANT/AET rate from swap pool)
 */
export async function getNeuronetPrice(netuid: number): Promise<number> {
  return sendMessage<number>({ type: 'neuronets:get-price', payload: { netuid } })
}

/**
 * Get token price in USD from explorer API
 */
export async function getTokenPrice(networkId: string): Promise<number> {
  return sendMessage<number>({ type: 'price:get', payload: { networkId } })
}
