// dApp Handler - processes requests from dApps via content script
import { walletService } from './walletService'
import { connectionManager } from './connectionManager'
import { getPermissions, savePermissions, type SitePermission } from '@lib/storage'
import type { DappRequest } from '@lib/messaging'
import { RAO_PER_TAO } from '@shared/types'

// Pending approval requests
interface PendingApproval {
  id: number
  origin: string
  method: string
  params?: unknown
  resolve: (result: unknown) => void
  reject: (error: Error) => void
}

class DappHandler {
  private pendingApprovals: Map<number, PendingApproval> = new Map()
  private nextApprovalId = 1

  async handleRequest(
    request: DappRequest,
    port: chrome.runtime.Port
  ): Promise<unknown> {
    const { origin, method, params } = request

    switch (method) {
      case 'connect':
        return this.handleConnect(origin)

      case 'disconnect':
        return this.handleDisconnect(origin)

      case 'getAccounts':
        return this.handleGetAccounts(origin)

      case 'getBalance':
        return this.handleGetBalance(origin, params as { address?: string } | undefined)

      case 'signMessage':
        return this.requestApproval(origin, 'signMessage', params, port)

      case 'signTransaction':
        return this.requestApproval(origin, 'signTransaction', params, port)

      case 'sendTransaction':
        return this.requestApproval(origin, 'sendTransaction', params, port)

      case 'addStake':
        return this.requestApproval(origin, 'addStake', params, port)

      case 'removeStake':
        return this.requestApproval(origin, 'removeStake', params, port)

      default:
        throw new Error(`Unknown method: ${method}`)
    }
  }

  private async handleConnect(origin: string): Promise<string[]> {
    const permissions = await getPermissions()

    // Check if already connected
    if (permissions[origin]?.connected) {
      const wallets = await walletService.getWallets()
      const allowedAddresses = permissions[origin].accounts
      return wallets
        .filter((w) => allowedAddresses.includes(w.address))
        .map((w) => w.address)
    }

    // Need user approval - open popup
    await this.openApprovalPopup('connect', origin)

    // Return empty for now - will be updated after user approval
    return []
  }

  private async handleDisconnect(origin: string): Promise<void> {
    const permissions = await getPermissions()

    if (permissions[origin]) {
      delete permissions[origin]
      await savePermissions(permissions)
    }
  }

  private async handleGetAccounts(origin: string): Promise<string[]> {
    const permissions = await getPermissions()

    if (!permissions[origin]?.connected) {
      return []
    }

    const wallets = await walletService.getWallets()
    const allowedAddresses = permissions[origin].accounts

    return wallets
      .filter((w) => allowedAddresses.includes(w.address))
      .map((w) => w.address)
  }

  private async handleGetBalance(
    origin: string,
    params?: { address?: string }
  ): Promise<string> {
    const permissions = await getPermissions()

    if (!permissions[origin]?.connected) {
      throw new Error('Not connected')
    }

    let address = params?.address

    if (!address) {
      const activeWallet = await walletService.getActiveWallet()
      if (!activeWallet) {
        throw new Error('No active wallet')
      }
      address = activeWallet.address
    }

    // Check if address is allowed
    if (!permissions[origin].accounts.includes(address)) {
      throw new Error('Address not allowed')
    }

    const balance = await connectionManager.getBalance(address)
    // Return balance in AET as string
    return (Number(balance.free) / Number(RAO_PER_TAO)).toString()
  }

  private async requestApproval(
    origin: string,
    method: string,
    params: unknown,
    _port: chrome.runtime.Port
  ): Promise<unknown> {
    // Open popup for user approval
    await this.openApprovalPopup(method, origin, params)

    // Create pending approval
    return new Promise((resolve, reject) => {
      const id = this.nextApprovalId++
      this.pendingApprovals.set(id, {
        id,
        origin,
        method,
        params,
        resolve,
        reject,
      })

      // Timeout after 5 minutes
      setTimeout(() => {
        const pending = this.pendingApprovals.get(id)
        if (pending) {
          pending.reject(new Error('Request timeout'))
          this.pendingApprovals.delete(id)
        }
      }, 5 * 60 * 1000)
    })
  }

  private async openApprovalPopup(
    method: string,
    origin: string,
    params?: unknown
  ): Promise<void> {
    // Store request data for popup to read
    await chrome.storage.session.set({
      pendingDappRequest: {
        method,
        origin,
        params,
        timestamp: Date.now(),
      },
    })

    // Open popup
    await chrome.action.openPopup()
  }

  // Called from popup when user approves/rejects
  async resolveApproval(
    approvalId: number,
    approved: boolean,
    result?: unknown
  ): Promise<void> {
    const pending = this.pendingApprovals.get(approvalId)
    if (!pending) return

    this.pendingApprovals.delete(approvalId)

    if (approved) {
      pending.resolve(result)
    } else {
      pending.reject(new Error('User rejected'))
    }
  }

  // Grant site permission
  async grantPermission(origin: string, accounts: string[]): Promise<void> {
    const permissions = await getPermissions()

    permissions[origin] = {
      connected: true,
      accounts,
      connectedAt: Date.now(),
    }

    await savePermissions(permissions)
  }

  // Revoke site permission
  async revokePermission(origin: string): Promise<void> {
    const permissions = await getPermissions()
    delete permissions[origin]
    await savePermissions(permissions)
  }

  // Get all permissions
  async getAllPermissions(): Promise<Record<string, SitePermission>> {
    return getPermissions()
  }

  // Execute approved dApp action
  async executeApprovedAction(
    method: string,
    origin: string,
    params: unknown
  ): Promise<unknown> {
    const permissions = await getPermissions()

    if (!permissions[origin]?.connected) {
      throw new Error('Not connected')
    }

    const activeWallet = await walletService.getActiveWallet()
    if (!activeWallet) {
      throw new Error('No active wallet')
    }

    if (!walletService.isUnlocked(activeWallet.id)) {
      throw new Error('Wallet is locked')
    }

    const keypair = walletService.getKeypair(activeWallet.id)
    if (!keypair) {
      throw new Error('Failed to get keypair')
    }

    const signer = {
      address: activeWallet.address,
      sign: async (data: Uint8Array) => {
        return keypair.sign(data)
      },
    }

    switch (method) {
      case 'signMessage': {
        const { message } = params as { message: string }
        return walletService.signMessage(activeWallet.id, message)
      }

      case 'sendTransaction': {
        const { to, amount } = params as { to: string; amount: string }
        const amountBigInt = BigInt(Math.floor(parseFloat(amount) * Number(RAO_PER_TAO)))
        return connectionManager.transfer(signer, to, amountBigInt)
      }

      case 'addStake': {
        const { hotkey, netuid, amount } = params as {
          hotkey: string
          netuid: number
          amount: string
        }
        const amountBigInt = BigInt(Math.floor(parseFloat(amount) * Number(RAO_PER_TAO)))
        return connectionManager.addStake(signer, hotkey, netuid, amountBigInt)
      }

      case 'removeStake': {
        const { hotkey, netuid, amount } = params as {
          hotkey: string
          netuid: number
          amount: string
        }
        const amountBigInt = BigInt(Math.floor(parseFloat(amount) * Number(RAO_PER_TAO)))
        return connectionManager.removeStake(signer, hotkey, netuid, amountBigInt)
      }

      default:
        throw new Error(`Unknown method: ${method}`)
    }
  }
}

export const dappHandler = new DappHandler()
