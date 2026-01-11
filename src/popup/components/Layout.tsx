import { useEffect, useState, useRef } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Home,
  Send,
  ArrowDownToLine,
  Layers,
  Key,
  Lock,
  Settings,
  ChevronDown,
  Check,
} from 'lucide-react'
import { useWallet } from '../context/WalletContext'
import { useNetwork } from '../context/NetworkContext'
import { Spinner } from './ui'
import { HotkeyBackupBanner } from './HotkeyBackupBanner'
import { HotkeyBackupModal } from './HotkeyBackupModal'

const navItems = [
  { path: '/', icon: Home, labelKey: 'nav.dashboard' },
  { path: '/send', icon: Send, labelKey: 'nav.send' },
  { path: '/receive', icon: ArrowDownToLine, labelKey: 'nav.receive' },
  { path: '/staking', icon: Layers, labelKey: 'nav.staking' },
  { path: '/hotkeys', icon: Key, labelKey: 'nav.hotkeys' },
]

// Network color mapping (like desktop client)
const getNetworkColor = (networkId: string) => {
  switch (networkId) {
    case 'mainnet':
      return '#06c2b0' // teal
    case 'test':
      return '#ffb347' // orange
    case 'local':
      return '#339eff' // blue
    default:
      return '#737373' // muted
  }
}

export default function Layout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useTranslation()
  const { wallets, activeWallet, setActiveWallet, hotkeys, isLoading, isLocked, lockWallets, loadHotkeys } = useWallet()
  const { currentNetwork, isConnected, isConnecting } = useNetwork()

  const [showWalletDropdown, setShowWalletDropdown] = useState(false)
  const [showBackupModal, setShowBackupModal] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Find first unbacked hotkey
  const unbackedHotkey = hotkeys.find((h) => !h.backedUp)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowWalletDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Redirect to welcome if no wallets
  useEffect(() => {
    if (!isLoading && wallets.length === 0) {
      navigate('/welcome')
    }
  }, [isLoading, wallets, navigate])

  // Redirect to unlock if locked
  useEffect(() => {
    if (!isLoading && wallets.length > 0 && isLocked) {
      navigate('/unlock')
    }
  }, [isLoading, wallets, isLocked, navigate])

  // Load hotkeys when active wallet changes
  useEffect(() => {
    if (activeWallet && !isLocked) {
      loadHotkeys(activeWallet.id)
    }
  }, [activeWallet, isLocked, loadHotkeys])

  const handleWalletChange = (walletId: string) => {
    setShowWalletDropdown(false)
    setActiveWallet(walletId)
  }

  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-background">
        <Spinner size="lg" className="text-primary" />
      </div>
    )
  }

  return (
    <div className="w-full h-full flex flex-col bg-background">
      {/* Header */}
      <header className="flex-shrink-0 px-4 py-3 bg-surface border-b border-border">
        <div className="flex items-center justify-between">
          {/* Logo & Wallet Selector */}
          <div className="flex items-center gap-3">
            {/* AETRON Logo (symbol only in header) */}
            <div className="w-8 h-8 rounded-lg bg-white/[0.08] flex items-center justify-center">
              <img
                src="/logo/aet.svg"
                alt="AETRON"
                className="w-5 h-5"
              />
            </div>

            {/* Wallet Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setShowWalletDropdown(!showWalletDropdown)}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-background hover:bg-surface-hover transition-colors"
              >
                <span className="text-xs text-foreground truncate max-w-[100px]">
                  {activeWallet?.name || t('common.selectWallet')}
                </span>
                <ChevronDown className={`w-3 h-3 text-muted transition-transform ${showWalletDropdown ? 'rotate-180' : ''}`} />
              </button>

              {/* Dropdown Menu */}
              <div
                className={`absolute left-0 top-full mt-1 w-48 bg-surface border border-border rounded-lg shadow-lg z-50 overflow-hidden transition-all duration-150 origin-top ${
                  showWalletDropdown
                    ? 'opacity-100 scale-100 translate-y-0'
                    : 'opacity-0 scale-95 -translate-y-1 pointer-events-none'
                }`}
                role="menu"
                aria-orientation="vertical"
                aria-hidden={!showWalletDropdown}
              >
                <div className="py-1">
                  <div className="px-3 py-1.5 text-[10px] text-muted uppercase tracking-wider">
                    {t('nav.wallet')}
                  </div>
                  {wallets.map((wallet) => (
                    <button
                      key={wallet.id}
                      onClick={() => handleWalletChange(wallet.id)}
                      role="menuitem"
                      className={`w-full flex items-center justify-between px-3 py-2 text-xs transition-colors ${
                        activeWallet?.id === wallet.id
                          ? 'bg-primary/10 text-primary'
                          : 'text-foreground hover:bg-surface-hover'
                      }`}
                    >
                      <div className="flex flex-col items-start">
                        <span className="font-medium">{wallet.name}</span>
                        <span className="text-[10px] text-muted font-mono">
                          {wallet.address.slice(0, 8)}...{wallet.address.slice(-4)}
                        </span>
                      </div>
                      {activeWallet?.id === wallet.id && (
                        <Check className="w-3 h-3" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Network Status & Actions */}
          <div className="flex items-center gap-2">
            {/* Network Status (non-clickable) */}
            <div className="flex items-center gap-1.5 px-2 py-1">
              <div
                className="w-2 h-2 rounded-full"
                style={{
                  backgroundColor: isConnecting
                    ? '#ffb347'
                    : isConnected
                    ? getNetworkColor(currentNetwork?.id || '')
                    : '#ff7a7a',
                  boxShadow: isConnected && !isConnecting
                    ? `0 0 6px ${getNetworkColor(currentNetwork?.id || '')}40`
                    : 'none',
                }}
              />
              <span className="text-[10px] text-muted">
                {currentNetwork?.name || 'Disconnected'}
              </span>
            </div>

            {/* Settings Button */}
            <button
              onClick={() => navigate('/settings')}
              className="p-1.5 text-muted hover:text-foreground hover:bg-surface-hover rounded-lg transition-colors"
              title={t('nav.settings')}
              aria-label={t('nav.settings')}
            >
              <Settings className="w-4 h-4" />
            </button>

            {/* Lock Button */}
            <button
              onClick={() => lockWallets()}
              className="p-1.5 text-muted hover:text-foreground hover:bg-surface-hover rounded-lg transition-colors"
              title={t('common.lock')}
              aria-label={t('common.lock')}
            >
              <Lock className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Connection Banner */}
      {isConnecting && (
        <div className="bg-yellow-500/10 border-b border-yellow-500/20 px-4 py-2 flex items-center gap-2">
          <div className="w-3 h-3 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-yellow-500">
            {t('network.connecting')}
          </span>
        </div>
      )}

      {/* Hotkey Backup Banner */}
      {unbackedHotkey && (
        <div className="px-4 pt-3">
          <HotkeyBackupBanner
            hotkey={unbackedHotkey}
            onClick={() => setShowBackupModal(true)}
          />
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4">
        <Outlet />
      </main>

      {/* Bottom Navigation */}
      <nav className="flex-shrink-0 bg-surface border-t border-border">
        <div className="flex justify-around py-2">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = location.pathname === item.path
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors ${
                  isActive
                    ? 'text-foreground'
                    : 'text-muted hover:text-foreground'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px]">{t(item.labelKey)}</span>
              </button>
            )
          })}
        </div>
      </nav>

      {/* Hotkey Backup Modal */}
      {unbackedHotkey && (
        <HotkeyBackupModal
          isOpen={showBackupModal}
          onClose={() => setShowBackupModal(false)}
          hotkey={unbackedHotkey}
          onBackupComplete={() => {
            if (activeWallet) {
              loadHotkeys(activeWallet.id)
            }
          }}
        />
      )}
    </div>
  )
}
