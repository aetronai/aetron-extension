import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Eye, EyeOff, Upload } from 'lucide-react'
import { Button, Input } from '../components/ui'
import { useWallet } from '../context/WalletContext'
import { PasswordStrengthIndicator } from '../components/PasswordStrengthIndicator'
import { validatePassword } from '../../shared/utils/validation'

type ImportType = 'mnemonic' | 'privateKey' | 'json'

export default function ImportWallet() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { importFromMnemonic, importFromPrivateKey, importFromKeystore } = useWallet()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [importType, setImportType] = useState<ImportType>('mnemonic')
  const [name, setName] = useState('')
  const [mnemonic, setMnemonic] = useState('')
  const [privateKey, setPrivateKey] = useState('')
  const [keystoreFile, setKeystoreFile] = useState<string | null>(null)
  const [keystoreFileName, setKeystoreFileName] = useState('')
  const [keystorePassword, setKeystorePassword] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setKeystoreFileName(file.name)
    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target?.result as string
      setKeystoreFile(content)
    }
    reader.readAsText(file)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!name.trim()) {
      setError(t('errors.allFieldsRequired'))
      return
    }

    if (importType === 'mnemonic' && !mnemonic.trim()) {
      setError(t('errors.allFieldsRequired'))
      return
    }

    if (importType === 'privateKey' && !privateKey.trim()) {
      setError(t('errors.allFieldsRequired'))
      return
    }

    if (importType === 'json') {
      if (!keystoreFile) {
        setError(t('errors.allFieldsRequired'))
        return
      }
      if (!keystorePassword) {
        setError(t('errors.allFieldsRequired'))
        return
      }
    }

    const validation = validatePassword(password)
    if (!validation.isValid) {
      setError(t('errors.allFieldsRequired'))
      return
    }

    if (password !== confirmPassword) {
      setError(t('createWallet.passwordMismatch'))
      return
    }

    setIsLoading(true)

    try {
      if (importType === 'mnemonic') {
        await importFromMnemonic(name, mnemonic.trim(), password)
      } else if (importType === 'privateKey') {
        await importFromPrivateKey(name, privateKey.trim(), password)
      } else if (importType === 'json') {
        await importFromKeystore(name, keystoreFile!, keystorePassword, password)
      }
      navigate('/')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="w-full h-full flex flex-col bg-dark-900 p-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="p-2 text-gray-400 hover:text-white hover:bg-dark-800 rounded-lg"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-semibold text-white">{t('importWallet.title')}</h1>
      </div>

      {/* Import type tabs */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setImportType('mnemonic')}
          className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors ${
            importType === 'mnemonic'
              ? 'bg-primary-600 text-white'
              : 'bg-dark-800 text-gray-400 hover:text-white'
          }`}
        >
          {t('importWallet.tabPhrase')}
        </button>
        <button
          onClick={() => setImportType('privateKey')}
          className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors ${
            importType === 'privateKey'
              ? 'bg-primary-600 text-white'
              : 'bg-dark-800 text-gray-400 hover:text-white'
          }`}
        >
          {t('importWallet.tabKey')}
        </button>
        <button
          onClick={() => setImportType('json')}
          className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors ${
            importType === 'json'
              ? 'bg-primary-600 text-white'
              : 'bg-dark-800 text-gray-400 hover:text-white'
          }`}
        >
          {t('importWallet.tabJson')}
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 flex flex-col">
        <div className="flex-1 space-y-4 overflow-y-auto px-0.5">
          <Input
            label={t('importWallet.walletName')}
            placeholder={t('importWallet.walletNamePlaceholder')}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          {importType === 'mnemonic' && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                {t('importWallet.seedPhrase')}
              </label>
              <textarea
                placeholder={t('importWallet.enterSeedPhrase')}
                value={mnemonic}
                onChange={(e) => setMnemonic(e.target.value)}
                rows={3}
                className="w-full px-3 py-2.5 bg-dark-800 border border-dark-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
              />
            </div>
          )}

          {importType === 'privateKey' && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                {t('importWallet.privateKey')}
              </label>
              <textarea
                placeholder={t('importWallet.enterPrivateKey')}
                value={privateKey}
                onChange={(e) => setPrivateKey(e.target.value)}
                rows={2}
                className="w-full px-3 py-2.5 bg-dark-800 border border-dark-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none font-mono text-sm"
              />
            </div>
          )}

          {importType === 'json' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  {t('importWallet.keystoreFile')}
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full px-3 py-3 bg-dark-800 border border-dark-600 border-dashed rounded-lg text-gray-400 hover:text-white hover:border-primary-500 transition-colors flex items-center justify-center gap-2"
                >
                  <Upload className="w-4 h-4" />
                  {keystoreFileName || t('importWallet.selectFile')}
                </button>
              </div>

              <Input
                type="password"
                label={t('importWallet.keystorePassword')}
                placeholder={t('importWallet.keystorePasswordPlaceholder')}
                value={keystorePassword}
                onChange={(e) => setKeystorePassword(e.target.value)}
              />
            </>
          )}

          <div>
            <div className="relative">
              <Input
                label={t('importWallet.password')}
                type={showPassword ? 'text' : 'password'}
                placeholder={t('importWallet.passwordPlaceholder')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-9 text-gray-500"
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
            <PasswordStrengthIndicator password={password} />
          </div>

          <div className="relative">
            <Input
              label={t('importWallet.confirmPassword')}
              type={showPassword ? 'text' : 'password'}
              placeholder={t('createWallet.confirmPasswordPlaceholder')}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              error={error}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-9 text-gray-500"
            >
              {showPassword ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        <Button type="submit" className="w-full mt-4" loading={isLoading}>
          {t('importWallet.import')}
        </Button>
      </form>
    </div>
  )
}
