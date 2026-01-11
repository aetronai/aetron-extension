import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Clock } from 'lucide-react'
import { Modal } from './ui'
import { getRecentAddresses } from '@lib/storage'
import type { RecentAddress } from '@shared/types'

interface RecentAddressesModalProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (address: string, label?: string) => void
}

export function RecentAddressesModal({ isOpen, onClose, onSelect }: RecentAddressesModalProps) {
  const { t } = useTranslation()
  const [addresses, setAddresses] = useState<RecentAddress[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isOpen) return

    const loadAddresses = async () => {
      setLoading(true)
      try {
        const recent = await getRecentAddresses()
        setAddresses(recent)
      } catch (err) {
        console.error('Failed to load recent addresses:', err)
        setAddresses([])
      } finally {
        setLoading(false)
      }
    }

    loadAddresses()
  }, [isOpen])

  const handleSelect = (addr: RecentAddress) => {
    onSelect(addr.address, addr.label)
    onClose()
  }

  const formatTimeAgo = (timestamp: number): string => {
    const now = Date.now()
    const diff = now - timestamp
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return t('transaction.justNow')
    if (minutes < 60) return t('transaction.minutesAgo', { count: minutes })
    if (hours < 24) return t('transaction.hoursAgo', { count: hours })
    return t('transaction.daysAgo', { count: days })
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('recent.title')}>
      <div className="max-h-60 overflow-y-auto">
        {loading ? (
          <div className="text-center py-8">
            <p className="text-sm text-muted">{t('common.loading')}</p>
          </div>
        ) : addresses.length === 0 ? (
          <div className="text-center py-8">
            <Clock className="w-10 h-10 text-muted-dark mx-auto mb-3" />
            <p className="text-sm text-muted">{t('recent.empty')}</p>
            <p className="text-xs text-muted-dark mt-1">{t('recent.emptyHint')}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {addresses.map((addr, index) => (
              <button
                key={`${addr.address}-${index}`}
                onClick={() => handleSelect(addr)}
                className="w-full p-3 bg-dark-800 hover:bg-dark-700 border border-border-medium hover:border-accent-teal/50 rounded-lg transition-all text-left"
              >
                <div className="flex items-center gap-3">
                  {/* Avatar */}
                  <div className="w-9 h-9 rounded-full bg-accent-teal/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-semibold text-accent-teal">
                      {addr.label ? addr.label.charAt(0).toUpperCase() : addr.address.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    {addr.label && (
                      <div className="text-sm font-medium text-white truncate">
                        {addr.label}
                      </div>
                    )}
                    <div className="text-xs text-muted font-mono truncate">
                      {addr.address.slice(0, 12)}...{addr.address.slice(-6)}
                    </div>
                    <div className="text-xs text-muted-dark mt-0.5">
                      {formatTimeAgo(addr.lastUsed)}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </Modal>
  )
}
