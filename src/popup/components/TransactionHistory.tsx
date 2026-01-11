import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowUpRight, ArrowDownLeft, Loader2, History, ExternalLink, Copy, Check } from 'lucide-react'
import { sendMessage } from '@lib/messaging'
import { RAO_PER_TAO } from '@shared/types'
import { Modal } from './ui'

interface Transfer {
  hash: string
  type: 'sent' | 'received'
  amount: string
  counterparty: string
  blockNumber: number
  timestamp: number
  status: 'confirmed'
}

interface TransactionHistoryProps {
  address: string
  limit?: number
  showTitle?: boolean
}

export function TransactionHistory({ address, limit = 5, showTitle = true }: TransactionHistoryProps) {
  const { t } = useTranslation()
  const [transfers, setTransfers] = useState<Transfer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedTx, setSelectedTx] = useState<Transfer | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!address) {
      setTransfers([])
      setLoading(false)
      return
    }

    const fetchTransfers = async () => {
      setLoading(true)
      setError(null)

      try {
        const transfers = await sendMessage<Transfer[]>({
          type: 'transfers:get',
          payload: { address, limit },
        })
        setTransfers(transfers)
      } catch (err) {
        setError((err as Error).message || 'Failed to load transactions')
      } finally {
        setLoading(false)
      }
    }

    fetchTransfers()
  }, [address, limit])

  const formatAmount = (amount: string): string => {
    const aet = Number(amount) / Number(RAO_PER_TAO)
    return aet.toLocaleString(undefined, { maximumFractionDigits: 4 })
  }

  const shortAddress = (addr: string): string => {
    return `${addr.slice(0, 8)}...${addr.slice(-6)}`
  }

  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return t('transaction.justNow')
    if (diffMins < 60) return t('transaction.minutesAgo', { count: diffMins })
    if (diffHours < 24) return t('transaction.hoursAgo', { count: diffHours })
    if (diffDays < 7) return t('transaction.daysAgo', { count: diffDays })
    return date.toLocaleDateString()
  }

  const formatFullDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleString()
  }

  const handleCopyHash = () => {
    if (selectedTx) {
      navigator.clipboard.writeText(selectedTx.hash)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 text-muted animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-6">
        <p className="text-sm text-accent-red">{error}</p>
      </div>
    )
  }

  if (transfers.length === 0) {
    return (
      <div className="text-center py-8">
        <History className="w-10 h-10 text-dark-700 mx-auto mb-3" />
        <p className="text-sm text-muted">{t('dashboard.noTransactions')}</p>
        <p className="text-xs text-muted-dark mt-1">
          {t('transaction.emptyHint')}
        </p>
      </div>
    )
  }

  return (
    <div>
      {showTitle && (
        <h3 className="text-sm font-medium text-white mb-3">{t('dashboard.recentActivity')}</h3>
      )}
      <div className="space-y-2">
        {transfers.map((tx) => (
          <button
            key={tx.hash}
            onClick={() => setSelectedTx(tx)}
            className="w-full p-3 bg-black/40 rounded-xl border border-white/[0.04] hover:border-white/[0.08] transition-colors cursor-pointer text-left"
          >
            <div className="flex items-center justify-between">
              {/* Icon and type */}
              <div className="flex items-center gap-3">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    tx.type === 'sent' ? 'bg-accent-red/15' : 'bg-accent-teal/15'
                  }`}
                >
                  {tx.type === 'sent' ? (
                    <ArrowUpRight className="w-4 h-4 text-accent-red" />
                  ) : (
                    <ArrowDownLeft className="w-4 h-4 text-accent-teal" />
                  )}
                </div>
                <div>
                  <div className="text-sm text-white font-medium">
                    {tx.type === 'sent' ? t('transaction.sent') : t('transaction.received')}
                  </div>
                  <div className="text-xs text-muted">
                    {tx.type === 'sent' ? `${t('common.to')}: ` : `${t('common.from')}: `}
                    {shortAddress(tx.counterparty)}
                  </div>
                </div>
              </div>

              {/* Amount and time */}
              <div className="text-right">
                <div
                  className={`text-sm font-semibold ${
                    tx.type === 'sent' ? 'text-accent-red' : 'text-accent-teal'
                  }`}
                >
                  {tx.type === 'sent' ? '-' : '+'}
                  {formatAmount(tx.amount)} AET
                </div>
                <div className="text-xs text-muted-dark">
                  {formatTime(tx.timestamp)}
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Transaction Details Modal */}
      <Modal
        isOpen={!!selectedTx}
        onClose={() => {
          setSelectedTx(null)
          setCopied(false)
        }}
        title={t('transaction.details')}
      >
        {selectedTx && (
          <div className="space-y-4">
            {/* Type and Amount */}
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  selectedTx.type === 'sent' ? 'bg-accent-red/15' : 'bg-accent-teal/15'
                }`}
              >
                {selectedTx.type === 'sent' ? (
                  <ArrowUpRight className="w-5 h-5 text-accent-red" />
                ) : (
                  <ArrowDownLeft className="w-5 h-5 text-accent-teal" />
                )}
              </div>
              <div>
                <div className="text-lg font-semibold text-white">
                  {selectedTx.type === 'sent' ? t('transaction.sent') : t('transaction.received')}
                </div>
                <div
                  className={`text-xl font-bold ${
                    selectedTx.type === 'sent' ? 'text-accent-red' : 'text-accent-teal'
                  }`}
                >
                  {selectedTx.type === 'sent' ? '-' : '+'}
                  {formatAmount(selectedTx.amount)} AET
                </div>
              </div>
            </div>

            {/* Details */}
            <div className="space-y-3 bg-dark-700 rounded-lg p-3">
              <div className="flex justify-between">
                <span className="text-sm text-muted">{t('common.status')}</span>
                <span className="text-sm text-accent-green">{t('common.confirmed')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted">{t('common.date')}</span>
                <span className="text-sm text-white">{formatFullDate(selectedTx.timestamp)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted">{t('common.block')}</span>
                <span className="text-sm text-white">#{selectedTx.blockNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted">
                  {selectedTx.type === 'sent' ? t('common.to') : t('common.from')}
                </span>
                <span className="text-sm text-white font-mono">{shortAddress(selectedTx.counterparty)}</span>
              </div>
            </div>

            {/* Transaction Hash */}
            <div className="space-y-2">
              <div className="text-sm text-muted">{t('common.transactionHash')}</div>
              <div className="flex items-center gap-2 bg-dark-700 rounded-lg p-2">
                <span className="flex-1 text-xs text-white font-mono truncate">{selectedTx.hash}</span>
                <button
                  onClick={handleCopyHash}
                  className="p-1.5 text-muted hover:text-white rounded transition-colors"
                >
                  {copied ? <Check className="w-4 h-4 text-accent-green" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Explorer Link */}
            <a
              href={`https://explorer.aetron.io/extrinsic/${selectedTx.hash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-2.5 bg-primary-600 hover:bg-primary-500 text-white rounded-lg transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              {t('send.viewOnExplorer')}
            </a>
          </div>
        )}
      </Modal>
    </div>
  )
}
