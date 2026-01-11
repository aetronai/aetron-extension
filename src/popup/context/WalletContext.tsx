import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react'
import type { WalletAccount, Hotkey, CreatedHotkey } from '@shared/wallet/types'
import type { BalanceInfo } from '@shared/types'
import * as messaging from '@lib/messaging'

interface WalletWithBalance extends WalletAccount {
  balance: BalanceInfo | null
}

interface WalletContextValue {
  // State
  wallets: WalletWithBalance[]
  activeWallet: WalletWithBalance | null
  hotkeys: Hotkey[]
  isLoading: boolean
  isLocked: boolean
  error: string | null

  // Wallet operations
  createWallet: (name: string, password: string, mnemonic?: string) => Promise<{ wallet: WalletAccount; mnemonic: string }>
  importFromMnemonic: (name: string, mnemonic: string, password: string) => Promise<WalletAccount>
  importFromPrivateKey: (name: string, privateKey: string, password: string) => Promise<WalletAccount>
  importFromKeystore: (name: string, keystoreJson: string, keystorePassword: string, newPassword: string) => Promise<WalletAccount>
  deleteWallet: (walletId: string) => Promise<void>
  renameWallet: (walletId: string, newName: string) => Promise<void>
  setActiveWallet: (walletId: string) => Promise<void>
  unlockWallet: (walletId: string, password: string) => Promise<boolean>
  lockWallets: () => Promise<void>
  exportMnemonic: (walletId: string, password: string) => Promise<string>
  changePassword: (walletId: string, currentPassword: string, newPassword: string) => Promise<void>

  // Hotkey operations
  createHotkey: (name: string, coldkeyId: string, password: string, wordCount?: 12 | 24) => Promise<CreatedHotkey>
  deleteHotkey: (hotkeyId: string) => Promise<void>
  loadHotkeys: (coldkeyId: string) => Promise<void>

  // Balance
  refreshBalance: () => Promise<void>
  refreshWallets: () => Promise<void>
}

const WalletContext = createContext<WalletContextValue | null>(null)

export function WalletProvider({ children }: { children: ReactNode }) {
  const [wallets, setWallets] = useState<WalletWithBalance[]>([])
  const [activeWallet, setActiveWalletState] = useState<WalletWithBalance | null>(null)
  const [hotkeys, setHotkeys] = useState<Hotkey[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLocked, setIsLocked] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load wallets on mount
  const loadWallets = useCallback(async () => {
    try {
      setIsLoading(true)
      const walletList = await messaging.getWallets()
      const active = await messaging.getActiveWallet()

      // Add empty balance to each wallet
      const walletsWithBalance: WalletWithBalance[] = walletList.map((w) => ({
        ...w,
        balance: null,
      }))

      setWallets(walletsWithBalance)

      if (active) {
        const activeWithBalance = walletsWithBalance.find((w) => w.id === active.id)
        setActiveWalletState(activeWithBalance || null)

        // Check if locked
        const unlocked = await messaging.isWalletUnlocked(active.id)
        setIsLocked(!unlocked)
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadWallets()
  }, [loadWallets])

  // Refresh balance for active wallet
  const refreshBalance = useCallback(async () => {
    if (!activeWallet) return

    try {
      const balance = await messaging.getBalance(activeWallet.address)
      setActiveWalletState((prev) =>
        prev ? { ...prev, balance } : null
      )
      setWallets((prev) =>
        prev.map((w) =>
          w.id === activeWallet.id ? { ...w, balance } : w
        )
      )
    } catch (err) {
      console.error('Failed to refresh balance:', err)
    }
  }, [activeWallet])

  // Load hotkeys for active wallet
  const loadHotkeys = useCallback(async (coldkeyId: string) => {
    try {
      const hotkeyList = await messaging.getHotkeys(coldkeyId)
      setHotkeys(hotkeyList)
    } catch (err) {
      console.error('Failed to load hotkeys:', err)
    }
  }, [])

  // Create wallet
  const createWallet = useCallback(
    async (name: string, password: string, mnemonic?: string) => {
      const result = await messaging.sendMessage<{ wallet: WalletAccount; mnemonic: string }>({
        type: 'wallet:create',
        payload: { name, password, mnemonic },
      })
      await loadWallets()
      setIsLocked(false)
      return result
    },
    [loadWallets]
  )

  // Import from mnemonic
  const importFromMnemonic = useCallback(
    async (name: string, mnemonic: string, password: string) => {
      const wallet = await messaging.importFromMnemonic(name, mnemonic, password)
      await loadWallets()
      setIsLocked(false)
      return wallet
    },
    [loadWallets]
  )

  // Import from private key
  const importFromPrivateKey = useCallback(
    async (name: string, privateKey: string, password: string) => {
      const wallet = await messaging.importFromPrivateKey(name, privateKey, password)
      await loadWallets()
      setIsLocked(false)
      return wallet
    },
    [loadWallets]
  )

  // Import from JSON keystore
  const importFromKeystore = useCallback(
    async (name: string, keystoreJson: string, keystorePassword: string, newPassword: string) => {
      const wallet = await messaging.importFromKeystore(name, keystoreJson, keystorePassword, newPassword)
      await loadWallets()
      setIsLocked(false)
      return wallet
    },
    [loadWallets]
  )

  // Delete wallet
  const deleteWallet = useCallback(
    async (walletId: string) => {
      await messaging.deleteWallet(walletId)
      await loadWallets()
    },
    [loadWallets]
  )

  // Rename wallet
  const renameWallet = useCallback(
    async (walletId: string, newName: string) => {
      await messaging.renameWallet(walletId, newName)
      await loadWallets()
    },
    [loadWallets]
  )

  // Set active wallet
  const setActiveWallet = useCallback(
    async (walletId: string) => {
      await messaging.setActiveWallet(walletId)
      await loadWallets()
    },
    [loadWallets]
  )

  // Unlock wallet
  const unlockWallet = useCallback(
    async (walletId: string, password: string) => {
      const success = await messaging.unlockWallet(walletId, password)
      if (success) {
        setIsLocked(false)
        await refreshBalance()
      }
      return success
    },
    [refreshBalance]
  )

  // Lock wallets
  const lockWallets = useCallback(async () => {
    await messaging.lockWallets()
    setIsLocked(true)
  }, [])

  // Export mnemonic
  const exportMnemonic = useCallback(
    async (walletId: string, password: string) => {
      return messaging.exportMnemonic(walletId, password)
    },
    []
  )

  // Change password
  const changePassword = useCallback(
    async (walletId: string, currentPassword: string, newPassword: string) => {
      await messaging.sendMessage({
        type: 'wallet:change-password',
        payload: { walletId, currentPassword, newPassword },
      })
    },
    []
  )

  // Create hotkey
  const createHotkey = useCallback(
    async (name: string, coldkeyId: string, password: string, wordCount: 12 | 24 = 12) => {
      const hotkey = await messaging.createHotkey(name, coldkeyId, password, wordCount)
      await loadHotkeys(coldkeyId)
      return hotkey
    },
    [loadHotkeys]
  )

  // Delete hotkey
  const deleteHotkey = useCallback(
    async (hotkeyId: string) => {
      await messaging.deleteHotkey(hotkeyId)
      if (activeWallet) {
        await loadHotkeys(activeWallet.id)
      }
    },
    [activeWallet, loadHotkeys]
  )

  return (
    <WalletContext.Provider
      value={{
        wallets,
        activeWallet,
        hotkeys,
        isLoading,
        isLocked,
        error,
        createWallet,
        importFromMnemonic,
        importFromPrivateKey,
        importFromKeystore,
        deleteWallet,
        renameWallet,
        setActiveWallet,
        unlockWallet,
        lockWallets,
        exportMnemonic,
        changePassword,
        createHotkey,
        deleteHotkey,
        loadHotkeys,
        refreshBalance,
        refreshWallets: loadWallets,
      }}
    >
      {children}
    </WalletContext.Provider>
  )
}

export function useWallet() {
  const context = useContext(WalletContext)
  if (!context) {
    throw new Error('useWallet must be used within WalletProvider')
  }
  return context
}
