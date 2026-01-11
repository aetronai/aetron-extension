import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Copy, Check } from 'lucide-react'
import { Modal, Button, Input } from './ui'
import type { Hotkey } from '@shared/wallet/types'
import * as messaging from '@lib/messaging'

type Step = 'password' | 'backup' | 'verify'

// Get 2 random word positions from mnemonic for verification
function getRandomWordPositions(wordCount: number): [number, number] {
  const first = Math.floor(Math.random() * wordCount)
  let second = Math.floor(Math.random() * wordCount)
  while (second === first) {
    second = Math.floor(Math.random() * wordCount)
  }
  return first < second ? [first, second] : [second, first]
}

interface HotkeyBackupModalProps {
  isOpen: boolean
  onClose: () => void
  hotkey: Hotkey
  onBackupComplete: () => void
}

export function HotkeyBackupModal({
  isOpen,
  onClose,
  hotkey,
  onBackupComplete,
}: HotkeyBackupModalProps) {
  const { t } = useTranslation()
  const [step, setStep] = useState<Step>('password')
  const [password, setPassword] = useState('')
  const [mnemonic, setMnemonic] = useState('')
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  // Verification state
  const [verifyPositions, setVerifyPositions] = useState<[number, number]>([0, 0])
  const [verifyWord1, setVerifyWord1] = useState('')
  const [verifyWord2, setVerifyWord2] = useState('')

  const resetState = () => {
    setStep('password')
    setPassword('')
    setMnemonic('')
    setCopied(false)
    setError('')
    setIsLoading(false)
    setVerifyWord1('')
    setVerifyWord2('')
  }

  const handleClose = () => {
    resetState()
    onClose()
  }

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!password) {
      setError(t('errors.allFieldsRequired'))
      return
    }

    setIsLoading(true)
    setError('')

    try {
      const phrase = await messaging.sendMessage<string>({
        type: 'hotkey:export-mnemonic',
        payload: { hotkeyId: hotkey.id, password },
      })
      setMnemonic(phrase)
      setStep('backup')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(mnemonic)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleProceedToVerify = () => {
    setError('')
    const words = mnemonic.split(' ')
    setVerifyPositions(getRandomWordPositions(words.length))
    setVerifyWord1('')
    setVerifyWord2('')
    setStep('verify')
  }

  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const words = mnemonic.split(' ')
    const word1Correct = verifyWord1.toLowerCase().trim() === words[verifyPositions[0]].toLowerCase()
    const word2Correct = verifyWord2.toLowerCase().trim() === words[verifyPositions[1]].toLowerCase()

    if (!word1Correct || !word2Correct) {
      setError(t('createWallet.verifyError'))
      return
    }

    setIsLoading(true)
    setError('')

    try {
      await messaging.sendMessage({
        type: 'hotkey:mark-backed-up',
        payload: { hotkeyId: hotkey.id },
      })
      onBackupComplete()
      handleClose()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={t('hotkeys.backupHotkeyTitle', { name: hotkey.name })}
    >
      {/* Step indicator */}
      <div className="flex gap-2 mb-4">
        {['password', 'backup', 'verify'].map((s, i) => (
          <div
            key={s}
            className={`flex-1 h-1 rounded-full ${
              ['password', 'backup', 'verify'].indexOf(step) >= i
                ? 'bg-primary-500'
                : 'bg-dark-700'
            }`}
          />
        ))}
      </div>

      {/* Step: Password */}
      {step === 'password' && (
        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          <p className="text-sm text-gray-400">
            {t('hotkeys.enterPasswordDesc')}
          </p>
          <Input
            type="password"
            label={t('common.password')}
            placeholder={t('common.enterPassword')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={error}
            autoFocus
          />
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={handleClose}
              className="flex-1"
            >
              {t('common.cancel')}
            </Button>
            <Button type="submit" className="flex-1" loading={isLoading}>
              {t('common.continue')}
            </Button>
          </div>
        </form>
      )}

      {/* Step: Backup */}
      {step === 'backup' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-400">
            {t('hotkeys.writeDownWords')}
          </p>

          <div className="bg-dark-800 border border-dark-700 rounded-lg p-4">
            <div className="grid grid-cols-3 gap-2">
              {mnemonic.split(' ').map((word, i) => (
                <div
                  key={i}
                  className="text-sm text-white font-mono bg-dark-700 rounded px-2 py-1"
                >
                  <span className="text-gray-500 mr-1">{i + 1}.</span>
                  {word}
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={handleCopy}
            className="flex items-center gap-2 text-sm text-primary-500 hover:text-primary-400"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4" />
                {t('common.copied')}
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                {t('common.copyPhrase')}
              </>
            )}
          </button>

          <p className="text-xs text-yellow-500/80">
            {t('createWallet.verifyHint')}
          </p>

          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => setStep('password')}
              className="flex-1"
            >
              {t('common.back')}
            </Button>
            <Button onClick={handleProceedToVerify} className="flex-1">
              {t('common.continue')}
            </Button>
          </div>
        </div>
      )}

      {/* Step: Verify */}
      {step === 'verify' && (
        <form onSubmit={handleVerifySubmit} className="space-y-4">
          <p className="text-sm text-gray-400">
            {t('createWallet.verifyDesc')}
          </p>

          <div className="space-y-3">
            <Input
              label={`${t('createWallet.word')} #${verifyPositions[0] + 1}`}
              placeholder={`${t('createWallet.enterWord')} #${verifyPositions[0] + 1}`}
              value={verifyWord1}
              onChange={(e) => setVerifyWord1(e.target.value)}
              autoFocus
            />

            <Input
              label={`${t('createWallet.word')} #${verifyPositions[1] + 1}`}
              placeholder={`${t('createWallet.enterWord')} #${verifyPositions[1] + 1}`}
              value={verifyWord2}
              onChange={(e) => setVerifyWord2(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setStep('backup')}
              className="flex-1"
            >
              {t('common.back')}
            </Button>
            <Button type="submit" className="flex-1" loading={isLoading}>
              {t('createWallet.verifyAndFinish')}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  )
}
