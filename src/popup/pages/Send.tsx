import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Send as SendIcon, Clock, ExternalLink, Loader2 } from 'lucide-react'
import { Button } from '../components/ui'
import { RecentAddressesModal } from '../components/RecentAddressesModal'
import { useWallet } from '../context/WalletContext'
import { useNetwork } from '../context/NetworkContext'
import * as messaging from '@lib/messaging'
import { addRecentAddress } from '@lib/storage'
import { RAO_PER_TAO } from '@shared/types'
import { validateSS58Address } from '@shared/utils/validation'

export default function Send() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { activeWallet, refreshBalance } = useWallet()
  const { isConnected } = useNetwork()

  const [recipient, setRecipient] = useState('')
  const [amount, setAmount] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [txHash, setTxHash] = useState('')
  const [estimatedFee, setEstimatedFee] = useState<string>('~0.001')
  const [isEstimatingFee, setIsEstimatingFee] = useState(false)
  const [showRecentAddresses, setShowRecentAddresses] = useState(false)
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null)

  // Refresh balance on mount
  useEffect(() => {
    if (isConnected) {
      refreshBalance()
    }
  }, [isConnected, refreshBalance])

  // Handle Max amount button
  const handleMaxAmount = () => {
    if (!activeWallet?.balance) return

    const freeBalance = BigInt(activeWallet.balance.free)
    // Subtract estimated fee (~0.001 AET = 1_000_000_000 RAO)
    const estimatedFeeRao = BigInt(1_000_000_000)
    const maxAmount = freeBalance - estimatedFeeRao

    if (maxAmount <= 0n) {
      setAmount('0')
      return
    }

    const maxAet = Number(maxAmount) / Number(RAO_PER_TAO)
    setAmount(maxAet.toFixed(4))
  }

  // Estimate fee when amount or recipient changes
  useEffect(() => {
    if (!activeWallet || !recipient || !amount || !isConnected) {
      setEstimatedFee('~0.001')
      return
    }

    const amountNum = parseFloat(amount)
    if (isNaN(amountNum) || amountNum <= 0) {
      setEstimatedFee('~0.001')
      return
    }

    // Debounce the fee estimation
    const timeoutId = setTimeout(async () => {
      setIsEstimatingFee(true)
      try {
        const feeRaw = await messaging.sendMessage<string>({
          type: 'fee:estimate',
          payload: {
            from: activeWallet.address,
            to: recipient,
            amount: amount,
          },
        })
        const feeAet = Number(feeRaw) / Number(RAO_PER_TAO)
        setEstimatedFee(feeAet.toFixed(6))
      } catch {
        setEstimatedFee('~0.001')
      } finally {
        setIsEstimatingFee(false)
      }
    }, 500)

    return () => clearTimeout(timeoutId)
  }, [activeWallet?.address, recipient, amount, isConnected])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const addressValidation = validateSS58Address(recipient)
    if (!addressValidation.isValid) {
      setError(t('send.invalidAddress'))
      return
    }

    if (!amount || parseFloat(amount) <= 0) {
      setError(t('send.invalidAmount'))
      return
    }

    setIsLoading(true)

    try {
      const result = await messaging.sendTransfer(recipient.trim(), amount)
      if (result.success && result.hash) {
        // Save to recent addresses
        await addRecentAddress(recipient.trim(), selectedLabel || undefined)
        setSuccess(true)
        setTxHash(result.hash)
      } else {
        setError(result.error || t('errors.transactionFailed'))
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4">
        <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mb-4">
          <SendIcon className="w-8 h-8 text-green-500" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">{t('send.success')}</h2>
        <p className="text-sm text-gray-400 text-center mb-4">
          {t('send.successDesc')}
        </p>
        <p className="text-xs text-gray-500 font-mono break-all px-4 mb-4">
          {txHash}
        </p>
        <a
          href={`https://explorer.aetron.io/extrinsic/${txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-primary-500 hover:text-primary-400 mb-6 flex items-center gap-1"
        >
          <ExternalLink className="w-4 h-4" />
          {t('send.viewOnExplorer')}
        </a>
        <Button onClick={() => navigate('/')} className="w-full">
          {t('common.done')}
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate('/')}
          className="p-2 text-gray-400 hover:text-white hover:bg-dark-800 rounded-lg"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-semibold text-white">{t('send.title')}</h1>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 flex flex-col">
        <div className="flex-1 space-y-4">
          {/* Recipient Address with Contact Picker */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              {t('send.recipient')}
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="5..."
                value={recipient}
                onChange={(e) => {
                  setRecipient(e.target.value)
                  setSelectedLabel(null)
                }}
                className="w-full px-3 py-2.5 bg-dark-800 border border-dark-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 pr-12"
              />
              <button
                type="button"
                onClick={() => setShowRecentAddresses(true)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-primary-500 hover:bg-dark-700 rounded transition-colors"
                title={t('recent.title')}
              >
                <Clock className="w-4 h-4" />
              </button>
            </div>
            {selectedLabel && (
              <div className="flex items-center gap-2 mt-1.5 text-xs text-primary-500">
                <div className="w-4 h-4 rounded-full bg-primary-500/20 flex items-center justify-center">
                  <span className="text-[10px] font-semibold">
                    {selectedLabel.charAt(0).toUpperCase()}
                  </span>
                </div>
                <span>{selectedLabel}</span>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              {t('send.amount')}
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.0001"
                min="0"
                placeholder={t('send.amountPlaceholder')}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-3 py-2.5 bg-dark-800 border border-dark-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 pr-24"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleMaxAmount}
                  className="text-xs text-primary-500 hover:text-primary-400 font-medium"
                >
                  MAX
                </button>
                <span className="text-gray-400 text-sm">AET</span>
              </div>
            </div>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="bg-dark-800 rounded-lg p-3 border border-dark-700">
            <p className="text-xs text-gray-400">{t('common.from')}</p>
            <p className="text-sm text-white font-mono truncate">
              {activeWallet?.address}
            </p>
          </div>

          {/* Fee Estimate */}
          <div className="bg-dark-800 rounded-lg p-3 border border-dark-700 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">{t('send.estimatedFee')}</span>
              <span className="text-sm text-white">
                {isEstimatingFee ? '...' : `${estimatedFee} AET`}
              </span>
            </div>
            {amount && parseFloat(amount) > 0 && (
              <div className="flex items-center justify-between pt-2 border-t border-dark-600">
                <span className="text-xs text-gray-400">{t('send.total')}</span>
                <span className="text-sm text-white font-semibold">
                  {(parseFloat(amount) + parseFloat(estimatedFee.replace('~', ''))).toFixed(6)} AET
                </span>
              </div>
            )}
          </div>
        </div>

        <Button type="submit" className="w-full" loading={isLoading}>
          <SendIcon className="w-4 h-4 mr-2" />
          {t('send.send')}
        </Button>
      </form>

      {/* Recent Addresses Modal */}
      <RecentAddressesModal
        isOpen={showRecentAddresses}
        onClose={() => setShowRecentAddresses(false)}
        onSelect={(address, label) => {
          setRecipient(address)
          setSelectedLabel(label || null)
        }}
      />

      {/* Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center z-50">
          <div className="w-16 h-16 bg-primary-500/20 rounded-full flex items-center justify-center mb-4">
            <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">{t('send.sending')}</h2>
          <p className="text-sm text-gray-400 text-center">
            {t('send.waitingConfirmation')}
          </p>
        </div>
      )}
    </div>
  )
}
