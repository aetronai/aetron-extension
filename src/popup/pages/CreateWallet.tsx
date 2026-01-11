import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Eye, EyeOff, Copy, Check } from 'lucide-react'
import { mnemonicGenerate } from '@polkadot/util-crypto'
import { Button, Input } from '../components/ui'
import { useWallet } from '../context/WalletContext'
import { PasswordStrengthIndicator } from '../components/PasswordStrengthIndicator'
import { validatePassword } from '../../shared/utils/validation'
import * as messaging from '@lib/messaging'

type Step = 'name' | 'password' | 'backup' | 'verify'

const STORAGE_KEY = 'aetron_create_wallet_state'
const STATE_EXPIRY_MS = 30 * 60 * 1000 // 30 minutes

interface CreateWalletState {
  step: Step
  name: string
  mnemonic: string
  verifyPositions: [number, number]
  timestamp: number
}

// Get 2 random word positions from mnemonic for verification
function getRandomWordPositions(wordCount: number): [number, number] {
  const first = Math.floor(Math.random() * wordCount)
  let second = Math.floor(Math.random() * wordCount)
  while (second === first) {
    second = Math.floor(Math.random() * wordCount)
  }
  return first < second ? [first, second] : [second, first]
}

// Load saved state from localStorage (with expiry check)
function loadSavedState(): Omit<CreateWalletState, 'timestamp'> | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const state: CreateWalletState = JSON.parse(saved)
      // Check if state has expired
      if (Date.now() - state.timestamp > STATE_EXPIRY_MS) {
        localStorage.removeItem(STORAGE_KEY)
        return null
      }
      return state
    }
  } catch {}
  return null
}

// Save state to localStorage
function saveState(state: Omit<CreateWalletState, 'timestamp'>) {
  try {
    const stateWithTimestamp: CreateWalletState = {
      ...state,
      timestamp: Date.now(),
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stateWithTimestamp))
  } catch {}
}

// Clear saved state
export function clearSavedState() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {}
}

// Check if there's pending creation (exported for Welcome page)
export function hasPendingWalletCreation(): boolean {
  const state = loadSavedState()
  return !!(state && state.step && state.step !== 'name' && state.mnemonic)
}

export default function CreateWallet() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { createWallet, refreshWallets } = useWallet()
  const creationInProgress = useRef(false)

  // Load initial state from sessionStorage
  const savedState = loadSavedState()

  // Check if wallet was created while popup was closed
  useEffect(() => {
    const checkExistingWallet = async () => {
      try {
        // Only check if we have a saved state with mnemonic and name
        if (!savedState?.mnemonic || !savedState?.name) return

        const wallets = await messaging.getWallets()
        // Check if wallet with this specific name already exists
        const walletWithSameName = wallets.find(w => w.name === savedState.name)
        if (walletWithSameName) {
          // Wallet with this name exists - it was created while popup was closed
          clearSavedState()
          await refreshWallets()
          navigate('/')
        }
      } catch {
        // Ignore errors
      }
    }
    checkExistingWallet()
  }, [navigate, refreshWallets, savedState?.mnemonic, savedState?.name])

  // Validate restored state - always require password re-entry after restore
  const getInitialStep = (): Step => {
    if (!savedState) return 'name'
    // If we have mnemonic but popup was closed, require password re-entry
    if (savedState.mnemonic && (savedState.step === 'backup' || savedState.step === 'verify')) {
      return 'password' // Go back to password step - user must re-enter
    }
    if ((savedState.step === 'backup' || savedState.step === 'verify') && !savedState.mnemonic) {
      return 'password'
    }
    return savedState.step
  }

  const [step, setStep] = useState<Step>(getInitialStep())
  const [name, setName] = useState(savedState?.name || '')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [mnemonic, setMnemonic] = useState(savedState?.mnemonic || '')
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  // Verification state
  const [verifyPositions, setVerifyPositions] = useState<[number, number]>(savedState?.verifyPositions || [0, 0])
  const [verifyWord1, setVerifyWord1] = useState('')
  const [verifyWord2, setVerifyWord2] = useState('')

  // Save state when it changes (except passwords for security)
  const persistState = useCallback(() => {
    if (step !== 'name' || name) {
      saveState({
        step,
        name,
        mnemonic,
        verifyPositions,
      })
    }
  }, [step, name, mnemonic, verifyPositions])

  useEffect(() => {
    persistState()
  }, [persistState])

  const handleNameSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError(t('errors.allFieldsRequired'))
      return
    }
    setError('')
    setStep('password')
  }

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const validation = validatePassword(password)
    if (!validation.isValid) {
      setError(t('errors.allFieldsRequired'))
      return
    }
    if (password !== confirmPassword) {
      setError(t('createWallet.passwordMismatch'))
      return
    }

    setError('')
    // Only generate new mnemonic if we don't have one (restored from previous session)
    if (!mnemonic) {
      const generatedMnemonic = mnemonicGenerate(24)
      setMnemonic(generatedMnemonic)
    }
    setStep('backup')
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(mnemonic)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleProceedToVerify = () => {
    setError('')
    // Generate random positions for verification
    const words = mnemonic.split(' ')
    setVerifyPositions(getRandomWordPositions(words.length))
    setVerifyWord1('')
    setVerifyWord2('')
    setStep('verify')
  }

  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Prevent double submission
    if (creationInProgress.current || isLoading) return

    const words = mnemonic.split(' ')
    const word1Correct = verifyWord1.toLowerCase().trim() === words[verifyPositions[0]].toLowerCase()
    const word2Correct = verifyWord2.toLowerCase().trim() === words[verifyPositions[1]].toLowerCase()

    if (!word1Correct || !word2Correct) {
      setError(t('createWallet.verifyError'))
      return
    }

    // Create wallet only after successful verification
    setError('')
    setIsLoading(true)
    creationInProgress.current = true

    try {
      await createWallet(name, password, mnemonic)
      clearSavedState() // Clear saved state on success
      navigate('/')
    } catch (err) {
      const errorMsg = (err as Error).message
      // If wallet already exists, it was created while popup was closed
      if (errorMsg.includes('already exists')) {
        clearSavedState()
        await refreshWallets()
        navigate('/')
        return
      }
      setError(errorMsg)
    } finally {
      setIsLoading(false)
      creationInProgress.current = false
    }
  }

  return (
    <div className="w-full h-full flex flex-col bg-dark-900 p-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => {
            if (step === 'name') {
              clearSavedState() // Clear state when leaving create flow
              navigate(-1)
            }
            else if (step === 'password') setStep('name')
            else if (step === 'backup') setStep('password')
            else if (step === 'verify') setStep('backup')
          }}
          className="p-2 text-gray-400 hover:text-white hover:bg-dark-800 rounded-lg"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-semibold text-white">{t('createWallet.title')}</h1>
      </div>

      {/* Step indicator */}
      <div className="flex gap-2 mb-6">
        {['name', 'password', 'backup', 'verify'].map((s, i) => {
          const currentIndex = ['name', 'password', 'backup', 'verify'].indexOf(step)
          const isCompleted = i < currentIndex
          const isActive = i === currentIndex
          return (
            <div
              key={s}
              className={`flex-1 h-1 rounded-full ${
                isActive
                  ? 'bg-white'
                  : isCompleted
                  ? 'bg-gray-500'
                  : 'bg-dark-700'
              }`}
            />
          )
        })}
      </div>

      {/* Step: Name */}
      {step === 'name' && (
        <form onSubmit={handleNameSubmit} className="flex-1 flex flex-col">
          <div className="flex-1">
            <h2 className="text-lg font-medium text-white mb-2">{t('createWallet.walletName')}</h2>
            <p className="text-sm text-gray-400 mb-4">
              {t('createWallet.walletNameDesc')}
            </p>
            <Input
              placeholder={t('createWallet.walletNamePlaceholder')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={error}
              autoFocus
            />
          </div>
          <Button type="submit" className="w-full">
            {t('common.continue')}
          </Button>
        </form>
      )}

      {/* Step: Password */}
      {step === 'password' && (
        <form onSubmit={handlePasswordSubmit} className="flex-1 flex flex-col">
          <div className="flex-1 space-y-4">
            <div>
              <h2 className="text-lg font-medium text-white mb-2">
                {t('createWallet.password')}
              </h2>
              <p className="text-sm text-gray-400 mb-4">
                {t('createWallet.passwordDesc')}
              </p>
            </div>

            <div>
              <Input
                type={showPassword ? 'text' : 'password'}
                placeholder={t('createWallet.passwordPlaceholder')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                rightIcon={
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-gray-500 hover:text-gray-300"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                }
              />
              <PasswordStrengthIndicator password={password} />
            </div>

            <Input
              type={showPassword ? 'text' : 'password'}
              placeholder={t('createWallet.confirmPasswordPlaceholder')}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              error={error}
              rightIcon={
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-gray-500 hover:text-gray-300"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              }
            />
          </div>
          <Button type="submit" className="w-full">
            {t('common.continue')}
          </Button>
        </form>
      )}

      {/* Step: Backup */}
      {step === 'backup' && (
        <div className="flex-1 flex flex-col">
          <div className="flex-1">
            <h2 className="text-lg font-medium text-white mb-2">
              {t('createWallet.recoveryPhrase')}
            </h2>
            <p className="text-sm text-gray-400 mb-4">
              {t('createWallet.recoveryPhraseDesc')}
            </p>

            <div className="bg-dark-800 border border-dark-700 rounded-lg p-4 mb-4">
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

            <p className="text-sm text-yellow-500/80 mt-4">
              {t('createWallet.verifyHint')}
            </p>
          </div>

          <Button onClick={handleProceedToVerify} className="w-full">
            {t('common.continue')}
          </Button>
        </div>
      )}

      {/* Step: Verify */}
      {step === 'verify' && (
        <form onSubmit={handleVerifySubmit} className="flex-1 flex flex-col">
          <div className="flex-1">
            <h2 className="text-lg font-medium text-white mb-2">
              {t('createWallet.verifyTitle')}
            </h2>
            <p className="text-sm text-gray-400 mb-4">
              {t('createWallet.verifyDesc')}
            </p>

            <div className="space-y-4">
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

            {error && <p className="text-sm text-red-500 mt-4">{error}</p>}
          </div>

          <Button type="submit" className="w-full" loading={isLoading}>
            {t('createWallet.verifyAndFinish')}
          </Button>
        </form>
      )}
    </div>
  )
}
