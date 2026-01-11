import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Copy, Check } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { useWallet } from '../context/WalletContext'
import { Button } from '../components/ui'

export default function Receive() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { activeWallet } = useWallet()
  const [copied, setCopied] = useState(false)

  const copyAddress = () => {
    if (activeWallet) {
      navigator.clipboard.writeText(activeWallet.address)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (!activeWallet) return null

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
        <h1 className="text-lg font-semibold text-white">{t('receive.title')}</h1>
      </div>

      <div className="flex-1 flex flex-col items-center">
        {/* QR Code */}
        <div className="bg-white p-4 rounded-xl mb-6">
          <QRCodeSVG value={activeWallet.address} size={180} />
        </div>

        {/* Address */}
        <div className="w-full bg-dark-800 rounded-lg p-3 border border-dark-700 mb-4">
          <p className="text-xs text-gray-400 mb-1">{t('receive.yourAddress')}</p>
          <p className="text-sm text-white font-mono break-all">
            {activeWallet.address}
          </p>
        </div>

        <Button onClick={copyAddress} variant="secondary" className="w-full">
          {copied ? (
            <>
              <Check className="w-4 h-4 mr-2" />
              {t('common.copied')}
            </>
          ) : (
            <>
              <Copy className="w-4 h-4 mr-2" />
              {t('receive.copyAddress')}
            </>
          )}
        </Button>

        <p className="text-xs text-gray-500 text-center mt-4">
          {t('receive.warning')}
        </p>
      </div>
    </div>
  )
}
