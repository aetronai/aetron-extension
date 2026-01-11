// Injected Script - creates window.aetron provider
// This script runs in the actual page context

interface AetronProvider {
  // Properties
  isAetron: true
  isConnected: boolean
  selectedAddress: string | null
  networkId: string | null

  // Methods
  connect(): Promise<string[]>
  disconnect(): Promise<void>
  getAccounts(): Promise<string[]>
  getBalance(address?: string): Promise<string>
  signMessage(message: string, address?: string): Promise<string>
  signTransaction(payload: unknown): Promise<string>
  sendTransaction(tx: { to: string; amount: string }): Promise<{ hash: string }>
  addStake(hotkey: string, netuid: number, amount: string): Promise<{ hash: string }>
  removeStake(hotkey: string, netuid: number, amount: string): Promise<{ hash: string }>

  // Events
  on(event: string, callback: (...args: unknown[]) => void): void
  removeListener(event: string, callback: (...args: unknown[]) => void): void
}

type EventCallback = (...args: unknown[]) => void

class AetronProviderImpl implements AetronProvider {
  isAetron = true as const
  isConnected = false
  selectedAddress: string | null = null
  networkId: string | null = null

  private requestId = 0
  private callbacks = new Map<
    number,
    { resolve: (value: unknown) => void; reject: (error: Error) => void }
  >()
  private eventListeners = new Map<string, Set<EventCallback>>()

  constructor() {
    // Listen for responses from content script
    window.addEventListener('message', (event) => {
      if (event.source !== window) return

      if (event.data?.type === 'AETRON_RESPONSE') {
        this.handleResponse(event.data)
      }

      if (event.data?.type === 'AETRON_EVENT') {
        this.handleEvent(event.data.event, event.data.data)
      }

      if (event.data?.type === 'AETRON_CONTENT_READY') {
        this.emit('ready')
      }
    })
  }

  private handleResponse(data: { id: number; result?: unknown; error?: string }) {
    const { id, result, error } = data
    const callback = this.callbacks.get(id)

    if (callback) {
      if (error) {
        callback.reject(new Error(error))
      } else {
        callback.resolve(result)
      }
      this.callbacks.delete(id)
    }
  }

  private handleEvent(event: string, data: unknown) {
    const listeners = this.eventListeners.get(event)
    if (listeners) {
      listeners.forEach((callback) => callback(data))
    }

    // Update internal state based on events
    switch (event) {
      case 'connect':
        this.isConnected = true
        break
      case 'disconnect':
        this.isConnected = false
        this.selectedAddress = null
        break
      case 'accountsChanged':
        const accounts = data as string[]
        this.selectedAddress = accounts[0] || null
        break
      case 'networkChanged':
        this.networkId = data as string
        break
    }
  }

  private emit(event: string, ...args: unknown[]) {
    const listeners = this.eventListeners.get(event)
    if (listeners) {
      listeners.forEach((callback) => callback(...args))
    }
  }

  private request<T>(method: string, params?: unknown): Promise<T> {
    return new Promise((resolve, reject) => {
      const id = ++this.requestId

      this.callbacks.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
      })

      window.postMessage(
        {
          type: 'AETRON_REQUEST',
          payload: { id, method, params },
        },
        '*'
      )

      // Timeout after 5 minutes
      setTimeout(() => {
        if (this.callbacks.has(id)) {
          this.callbacks.delete(id)
          reject(new Error('Request timeout'))
        }
      }, 5 * 60 * 1000)
    })
  }

  // ==================== Public API ====================

  async connect(): Promise<string[]> {
    const accounts = await this.request<string[]>('connect')
    this.isConnected = true
    this.selectedAddress = accounts[0] || null
    this.emit('connect', { accounts })
    return accounts
  }

  async disconnect(): Promise<void> {
    await this.request<void>('disconnect')
    this.isConnected = false
    this.selectedAddress = null
    this.emit('disconnect')
  }

  async getAccounts(): Promise<string[]> {
    return this.request<string[]>('getAccounts')
  }

  async getBalance(address?: string): Promise<string> {
    return this.request<string>('getBalance', { address })
  }

  async signMessage(message: string, address?: string): Promise<string> {
    return this.request<string>('signMessage', { message, address })
  }

  async signTransaction(payload: unknown): Promise<string> {
    return this.request<string>('signTransaction', { payload })
  }

  async sendTransaction(tx: { to: string; amount: string }): Promise<{ hash: string }> {
    return this.request<{ hash: string }>('sendTransaction', tx)
  }

  async addStake(
    hotkey: string,
    netuid: number,
    amount: string
  ): Promise<{ hash: string }> {
    return this.request<{ hash: string }>('addStake', { hotkey, netuid, amount })
  }

  async removeStake(
    hotkey: string,
    netuid: number,
    amount: string
  ): Promise<{ hash: string }> {
    return this.request<{ hash: string }>('removeStake', { hotkey, netuid, amount })
  }

  // ==================== Events ====================

  on(event: string, callback: EventCallback): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set())
    }
    this.eventListeners.get(event)!.add(callback)
  }

  removeListener(event: string, callback: EventCallback): void {
    const listeners = this.eventListeners.get(event)
    if (listeners) {
      listeners.delete(callback)
    }
  }
}

// Create and expose provider
const provider = new AetronProviderImpl()

// Expose to window
;(window as any).aetron = provider

// Dispatch event to notify dApps that provider is ready
window.dispatchEvent(new Event('aetron#initialized'))

console.log('AETRON Wallet provider injected')
