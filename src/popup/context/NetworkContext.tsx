import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react'
import { NETWORKS, type NetworkConfig } from '@shared/types'
import * as messaging from '@lib/messaging'

// Storage keys
const STORAGE_KEY_SELECTED_NETWORK = 'aetron_selected_network'
const STORAGE_KEY_CUSTOM_URL = 'aetron_custom_url'

// Default network
const DEFAULT_NETWORK_ID = 'mainnet'

interface NetworkContextValue {
  networks: NetworkConfig[]
  currentNetwork: NetworkConfig | null
  isConnected: boolean
  isConnecting: boolean
  error: string | null
  connect: (networkId: string, customUrl?: string) => Promise<void>
  disconnect: () => Promise<void>
  addCustomNetwork: (name: string, url: string) => void
  customNetworks: NetworkConfig[]
}

const NetworkContext = createContext<NetworkContextValue | null>(null)

export function NetworkProvider({ children }: { children: ReactNode }) {
  const [currentNetwork, setCurrentNetwork] = useState<NetworkConfig | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [customNetworks, setCustomNetworks] = useState<NetworkConfig[]>([])
  const [hasInitialized, setHasInitialized] = useState(false)

  // Build networks list (default + custom)
  const networks: NetworkConfig[] = [
    ...Object.values(NETWORKS),
    ...customNetworks,
  ]

  // Load custom networks from storage
  useEffect(() => {
    const loadCustomNetworks = () => {
      try {
        const saved = localStorage.getItem('aetron_custom_networks')
        if (saved) {
          const parsed = JSON.parse(saved)
          if (Array.isArray(parsed)) {
            setCustomNetworks(parsed)
          }
        }
      } catch (err) {
        console.error('Failed to load custom networks:', err)
      }
    }
    loadCustomNetworks()
  }, [])

  // Check connection status and auto-connect on mount
  useEffect(() => {
    const initializeConnection = async () => {
      if (hasInitialized) return
      setHasInitialized(true)

      try {
        // First check current status
        const status = await messaging.getNetworkStatus()

        if (status.connected && status.networkId) {
          // Already connected
          const network = NETWORKS[status.networkId] || {
            id: status.networkId,
            name: 'Custom',
            url: localStorage.getItem(STORAGE_KEY_CUSTOM_URL) || '',
          }
          setCurrentNetwork(network)
          setIsConnected(true)
          return
        }

        // Not connected - auto-connect to saved or default network
        const savedNetworkId = localStorage.getItem(STORAGE_KEY_SELECTED_NETWORK) || DEFAULT_NETWORK_ID
        const savedCustomUrl = localStorage.getItem(STORAGE_KEY_CUSTOM_URL)

        setIsConnecting(true)

        let networkToConnect = NETWORKS[savedNetworkId]
        let customUrl: string | undefined

        // Handle custom networks (id starts with 'custom_' or is exactly 'custom')
        if (savedNetworkId === 'custom' || savedNetworkId.startsWith('custom_')) {
          // Try to find in saved custom networks
          const savedCustomNetworks = localStorage.getItem('aetron_custom_networks')
          let foundNetwork: NetworkConfig | undefined

          if (savedCustomNetworks) {
            try {
              const parsed = JSON.parse(savedCustomNetworks)
              if (Array.isArray(parsed)) {
                foundNetwork = parsed.find((n: NetworkConfig) => n.id === savedNetworkId)
              }
            } catch {}
          }

          if (foundNetwork) {
            networkToConnect = foundNetwork
            customUrl = foundNetwork.url
          } else if (savedCustomUrl) {
            networkToConnect = {
              id: savedNetworkId,
              name: 'Custom Node',
              url: savedCustomUrl,
            }
            customUrl = savedCustomUrl
          }
        }

        if (!networkToConnect) {
          // Fallback to mainnet
          networkToConnect = NETWORKS[DEFAULT_NETWORK_ID]
        }

        setCurrentNetwork(networkToConnect)

        try {
          const connected = await messaging.connectNetwork(
            networkToConnect.id,
            customUrl || (networkToConnect.id.startsWith('custom') ? networkToConnect.url : undefined)
          )
          setIsConnected(connected)
          if (!connected) {
            setError('Failed to connect to network')
          }
        } catch (err) {
          console.error('Auto-connect failed:', err)
          setError((err as Error).message)
          setIsConnected(false)
        } finally {
          setIsConnecting(false)
        }
      } catch (err) {
        console.error('Failed to initialize network:', err)
        setHasInitialized(false)
      }
    }

    initializeConnection()
  }, [hasInitialized])

  const connect = useCallback(async (networkId: string, customUrl?: string) => {
    setIsConnecting(true)
    setError(null)

    try {
      const connected = await messaging.connectNetwork(networkId, customUrl)

      // Find network in our list or create custom
      let network = networks.find(n => n.id === networkId)
      if (!network) {
        network = {
          id: networkId,
          name: 'Custom',
          url: customUrl || '',
        }
      }

      setCurrentNetwork(network)
      setIsConnected(connected)

      if (!connected) {
        setError('Failed to connect to network')
      }

      // Save selected network
      localStorage.setItem(STORAGE_KEY_SELECTED_NETWORK, networkId)
      if (customUrl) {
        localStorage.setItem(STORAGE_KEY_CUSTOM_URL, customUrl)
      }
    } catch (err) {
      setError((err as Error).message)
      setIsConnected(false)
    } finally {
      setIsConnecting(false)
    }
  }, [networks])

  const disconnect = useCallback(async () => {
    try {
      await messaging.disconnectNetwork()
      setIsConnected(false)
      setCurrentNetwork(null)
    } catch (err) {
      setError((err as Error).message)
    }
  }, [])

  const addCustomNetwork = useCallback((name: string, url: string) => {
    const newNetwork: NetworkConfig = {
      id: `custom_${Date.now()}`,
      name,
      url,
    }

    const updated = [...customNetworks, newNetwork]
    setCustomNetworks(updated)
    localStorage.setItem('aetron_custom_networks', JSON.stringify(updated))
  }, [customNetworks])

  return (
    <NetworkContext.Provider
      value={{
        networks,
        currentNetwork,
        isConnected,
        isConnecting,
        error,
        connect,
        disconnect,
        addCustomNetwork,
        customNetworks,
      }}
    >
      {children}
    </NetworkContext.Provider>
  )
}

export function useNetwork() {
  const context = useContext(NetworkContext)
  if (!context) {
    throw new Error('useNetwork must be used within NetworkProvider')
  }
  return context
}
