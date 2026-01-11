import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Send, ArrowDownToLine, Copy, Check } from 'lucide-react'
import { useWallet } from '../context/WalletContext'
import { useNetwork } from '../context/NetworkContext'
import { usePrice } from '../hooks/usePrice'
import { Button, Spinner } from '../components/ui'
import { TransactionHistory } from '../components/TransactionHistory'
import { RAO_PER_TAO } from '@shared/types'

export default function Dashboard() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { activeWallet, refreshBalance } = useWallet()
  const { isConnected } = useNetwork()
  const { price, formatUsd } = usePrice()
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (isConnected && activeWallet) {
      refreshBalance()
    }
  }, [isConnected, activeWallet, refreshBalance])

  const getBalanceAet = (balance: { free: string } | null): number | null => {
    if (!balance) return null
    const free = BigInt(balance.free)
    return Number(free) / Number(RAO_PER_TAO)
  }

  const formatBalance = (balance: { free: string } | null) => {
    const aet = getBalanceAet(balance)
    if (aet === null) return '...'
    return aet.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    })
  }

  const copyAddress = () => {
    if (activeWallet) {
      navigator.clipboard.writeText(activeWallet.address)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (!activeWallet) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner size="lg" className="text-accent-teal" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Balance Card */}
      <div className="bg-gradient-to-br from-surface-secondary to-background rounded-2xl p-5 text-white border border-border-medium">
        <p className="text-sm opacity-80 mb-1">{t('dashboard.totalBalance')}</p>
        <h2 className="text-3xl font-bold">
          {formatBalance(activeWallet.balance as { free: string } | null)} AET
        </h2>
        {price !== null && getBalanceAet(activeWallet.balance as { free: string } | null) !== null && (
          <p className="text-sm opacity-60 mb-4">
            {formatUsd(getBalanceAet(activeWallet.balance as { free: string } | null)!)}
          </p>
        )}
        {(price === null || getBalanceAet(activeWallet.balance as { free: string } | null) === null) && (
          <div className="mb-4" />
        )}

        {/* Address */}
        <div className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-2">
          <span className="text-sm font-mono truncate flex-1">
            {activeWallet.address}
          </span>
          <button
            onClick={copyAddress}
            className="p-1 hover:bg-white/10 rounded"
            title={copied ? t('common.copied') : t('common.copy')}
          >
            {copied ? (
              <Check className="w-4 h-4 text-accent-green" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
        <Button
          onClick={() => navigate('/send')}
          className="flex-col gap-2 py-4"
        >
          <Send className="w-5 h-5" />
          <span>{t('common.send')}</span>
        </Button>
        <Button
          onClick={() => navigate('/receive')}
          variant="secondary"
          className="flex-col gap-2 py-4"
        >
          <ArrowDownToLine className="w-5 h-5" />
          <span>{t('common.receive')}</span>
        </Button>
      </div>

      {/* Transaction History */}
      <div className="bg-dark-800 rounded-xl border border-dark-700 p-4">
        <TransactionHistory address={activeWallet.address} limit={5} />
      </div>
    </div>
  )
}
