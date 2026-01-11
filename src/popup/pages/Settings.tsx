import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Globe, Lock, Trash2, ExternalLink, Key, Eye, EyeOff, Plus, Download, Languages, Check, X, Wifi, WifiOff, Copy } from 'lucide-react'
import { useWallet } from '../context/WalletContext'
import { useNetwork } from '../context/NetworkContext'
import { Button, Select, Modal, Input } from '../components/ui'
import { PasswordStrengthIndicator } from '../components/PasswordStrengthIndicator'
import { validatePassword } from '../../shared/utils/validation'
import { changeLanguage, languages } from '../i18n'
import * as messaging from '@lib/messaging'

export default function Settings() {
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const { activeWallet, wallets, setActiveWallet, deleteWallet, exportMnemonic, changePassword } = useWallet()
  const { networks, currentNetwork, connect, isConnecting, isConnected, addCustomNetwork, customNetworks } = useNetwork()

  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false)
  const [showAddNetworkModal, setShowAddNetworkModal] = useState(false)
  const [password, setPassword] = useState('')
  const [mnemonic, setMnemonic] = useState('')
  const [mnemonicCopied, setMnemonicCopied] = useState(false)
  const [error, setError] = useState('')

  // Change password state
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)

  // Custom network state
  const [newNetworkName, setNewNetworkName] = useState('')
  const [newNetworkUrl, setNewNetworkUrl] = useState('')
  const [isTesting, setIsTesting] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<{ success: boolean; message: string } | null>(null)

  const handleNetworkChange = (e: { target: { value: string } }) => {
    const networkId = e.target.value
    setConnectionStatus(null)

    // Find the network to get its URL
    const network = networks.find(n => n.id === networkId)
    if (network) {
      // For custom networks, pass the URL
      if (networkId.startsWith('custom_')) {
        connect(networkId, network.url)
      } else {
        connect(networkId)
      }
    }
  }

  const testConnection = async () => {
    if (!newNetworkUrl.trim()) {
      setConnectionStatus({ success: false, message: t('errors.allFieldsRequired') })
      return
    }

    setIsTesting(true)
    setConnectionStatus(null)

    try {
      const result = await messaging.sendMessage<boolean>({
        type: 'network:test',
        payload: { url: newNetworkUrl },
      })

      if (result) {
        setConnectionStatus({ success: true, message: t('settings.connectionSuccess') })
      } else {
        setConnectionStatus({ success: false, message: t('settings.connectionFailed') })
      }
    } catch {
      setConnectionStatus({ success: false, message: t('settings.connectionFailed') })
    } finally {
      setIsTesting(false)
    }
  }

  const handleAddNetwork = async () => {
    if (!newNetworkName.trim() || !newNetworkUrl.trim()) {
      setConnectionStatus({ success: false, message: t('errors.allFieldsRequired') })
      return
    }

    // Test the connection first
    setIsTesting(true)
    try {
      const result = await messaging.sendMessage<boolean>({
        type: 'network:test',
        payload: { url: newNetworkUrl },
      })

      if (result) {
        addCustomNetwork(newNetworkName, newNetworkUrl)
        setShowAddNetworkModal(false)
        setNewNetworkName('')
        setNewNetworkUrl('')
        setConnectionStatus(null)
      } else {
        setConnectionStatus({ success: false, message: t('settings.connectionFailed') })
      }
    } catch {
      setConnectionStatus({ success: false, message: t('settings.connectionFailed') })
    } finally {
      setIsTesting(false)
    }
  }

  const deleteCustomNetwork = (networkId: string) => {
    const updated = customNetworks.filter(n => n.id !== networkId)
    localStorage.setItem('aetron_custom_networks', JSON.stringify(updated))
    // Force reload by refreshing the page
    window.location.reload()
  }

  const handleLanguageChange = (e: { target: { value: string } }) => {
    changeLanguage(e.target.value)
  }

  const handleWalletChange = (e: { target: { value: string } }) => {
    setActiveWallet(e.target.value)
  }

  const handleDelete = async () => {
    if (activeWallet) {
      await deleteWallet(activeWallet.id)
      setShowDeleteModal(false)
    }
  }

  const handleExport = async () => {
    if (!activeWallet || !password) return

    try {
      const phrase = await exportMnemonic(activeWallet.id, password)
      setMnemonic(phrase)
      setError('')
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const handleChangePassword = async () => {
    if (!activeWallet || !currentPassword || !newPassword) return

    const validation = validatePassword(newPassword)
    if (!validation.isValid) {
      setError('New password does not meet requirements')
      return
    }

    if (newPassword !== confirmNewPassword) {
      setError('New passwords do not match')
      return
    }

    setIsChangingPassword(true)
    setError('')

    try {
      await changePassword(activeWallet.id, currentPassword, newPassword)
      setShowChangePasswordModal(false)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmNewPassword('')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setIsChangingPassword(false)
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-white">{t('settings.title')}</h2>

      {/* Network */}
      <div className="bg-dark-800 rounded-xl border border-dark-700 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-accent-teal" />
            <h3 className="text-sm font-medium text-white">{t('settings.network')}</h3>
          </div>
          <div className="flex items-center gap-2">
            {isConnecting ? (
              <span className="text-xs text-yellow-400">{t('network.connecting')}</span>
            ) : isConnected ? (
              <div className="flex items-center gap-1 text-xs text-accent-green">
                <Wifi className="w-3 h-3" />
                <span>{t('network.connected')}</span>
              </div>
            ) : (
              <div className="flex items-center gap-1 text-xs text-red-400">
                <WifiOff className="w-3 h-3" />
                <span>{t('network.disconnected')}</span>
              </div>
            )}
          </div>
        </div>
        <Select
          options={networks.map((n) => ({ value: n.id, label: n.name }))}
          value={currentNetwork?.id || ''}
          onChange={handleNetworkChange}
          disabled={isConnecting}
        />

        {/* Custom networks list */}
        {customNetworks.length > 0 && (
          <div className="mt-3 space-y-2">
            <p className="text-xs text-gray-400">{t('settings.customNetworks')}</p>
            {customNetworks.map((network) => (
              <div key={network.id} className="flex items-center justify-between bg-dark-700 rounded-lg px-3 py-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{network.name}</p>
                  <p className="text-xs text-gray-400 truncate">{network.url}</p>
                </div>
                <button
                  onClick={() => deleteCustomNetwork(network.id)}
                  className="p-1 text-gray-400 hover:text-red-400"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add custom network button */}
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setShowAddNetworkModal(true)}
          className="w-full mt-3"
        >
          <Plus className="w-4 h-4 mr-2" />
          {t('settings.addNetwork')}
        </Button>
      </div>

      {/* Language */}
      <div className="bg-dark-800 rounded-xl border border-dark-700 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Languages className="w-4 h-4 text-accent-teal" />
          <h3 className="text-sm font-medium text-white">{t('settings.language')}</h3>
        </div>
        <Select
          options={languages.map((l) => ({ value: l.code, label: l.nativeName }))}
          value={i18n.language}
          onChange={handleLanguageChange}
        />
      </div>

      {/* Active Wallet */}
      <div className="bg-dark-800 rounded-xl border border-dark-700 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Lock className="w-4 h-4 text-accent-teal" />
          <h3 className="text-sm font-medium text-white">{t('nav.wallet')}</h3>
        </div>
        <Select
          options={wallets.map((w) => ({ value: w.id, label: w.name }))}
          value={activeWallet?.id || ''}
          onChange={handleWalletChange}
        />
      </div>

      {/* Add Wallet */}
      <div className="flex gap-2">
        <Button
          variant="secondary"
          onClick={() => navigate('/create-wallet')}
          className="flex-1 justify-center"
        >
          <Plus className="w-4 h-4 mr-2" />
          {t('common.create')}
        </Button>
        <Button
          variant="secondary"
          onClick={() => navigate('/import-wallet')}
          className="flex-1 justify-center"
        >
          <Download className="w-4 h-4 mr-2" />
          {t('common.import')}
        </Button>
      </div>

      {/* Wallet Actions */}
      {activeWallet && (
        <div className="space-y-3">
          <Button
            variant="secondary"
            onClick={() => setShowExportModal(true)}
            className="w-full justify-start"
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            {t('settings.exportMnemonic')}
          </Button>

          <Button
            variant="secondary"
            onClick={() => setShowChangePasswordModal(true)}
            className="w-full justify-start"
          >
            <Key className="w-4 h-4 mr-2" />
            {t('settings.changePassword')}
          </Button>

          <Button
            variant="danger"
            onClick={() => setShowDeleteModal(true)}
            className="w-full justify-start"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            {t('common.delete')}
          </Button>
        </div>
      )}

      {/* Connected Sites */}
      <Button
        variant="ghost"
        onClick={() => navigate('/connected-sites')}
        className="w-full justify-start text-gray-400"
      >
        <Globe className="w-4 h-4 mr-2" />
        {t('settings.connectedSites')}
      </Button>

      {/* Delete Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title={t('common.delete')}
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-400">
            {t('contacts.confirmDelete')} "{activeWallet?.name}"
          </p>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => setShowDeleteModal(false)}
              className="flex-1"
            >
              {t('common.cancel')}
            </Button>
            <Button variant="danger" onClick={handleDelete} className="flex-1">
              {t('common.delete')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Export Modal */}
      <Modal
        isOpen={showExportModal}
        onClose={() => {
          setShowExportModal(false)
          setPassword('')
          setMnemonic('')
          setMnemonicCopied(false)
          setError('')
        }}
        title={t('settings.exportMnemonic')}
      >
        {mnemonic ? (
          <div className="space-y-4">
            <p className="text-sm text-red-400">
              {t('createWallet.warning')}
            </p>
            <div className="bg-dark-700 rounded-lg p-3">
              <p className="text-sm text-white font-mono break-all">{mnemonic}</p>
            </div>
            <Button
              onClick={() => {
                navigator.clipboard.writeText(mnemonic)
                setMnemonicCopied(true)
                setTimeout(() => setMnemonicCopied(false), 2000)
              }}
              className="w-full"
            >
              {mnemonicCopied ? (
                <>
                  <Check className="w-4 h-4 mr-2 text-accent-green" />
                  {t('common.copied')}
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-2" />
                  {t('common.copy')}
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <Input
              type="password"
              label={t('common.enterPassword')}
              placeholder={t('common.password')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={error}
            />
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={() => setShowExportModal(false)}
                className="flex-1"
              >
                {t('common.cancel')}
              </Button>
              <Button onClick={handleExport} className="flex-1">
                {t('common.export')}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Change Password Modal */}
      <Modal
        isOpen={showChangePasswordModal}
        onClose={() => {
          setShowChangePasswordModal(false)
          setCurrentPassword('')
          setNewPassword('')
          setConfirmNewPassword('')
          setError('')
        }}
        title={t('settings.changePassword')}
      >
        <div className="space-y-4">
          <Input
            type="password"
            label={t('settings.currentPassword')}
            placeholder={t('settings.currentPassword')}
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />

          <div>
            <div className="relative">
              <Input
                type={showNewPassword ? 'text' : 'password'}
                label={t('settings.newPassword')}
                placeholder={t('settings.newPassword')}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-9 text-gray-500"
              >
                {showNewPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
            <PasswordStrengthIndicator password={newPassword} />
          </div>

          <div className="relative">
            <Input
              type={showNewPassword ? 'text' : 'password'}
              label={t('settings.confirmNewPassword')}
              placeholder={t('settings.confirmNewPassword')}
              value={confirmNewPassword}
              onChange={(e) => setConfirmNewPassword(e.target.value)}
              error={error}
            />
            <button
              type="button"
              onClick={() => setShowNewPassword(!showNewPassword)}
              className="absolute right-3 top-9 text-gray-500"
            >
              {showNewPassword ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>

          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => setShowChangePasswordModal(false)}
              className="flex-1"
            >
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleChangePassword}
              className="flex-1"
              loading={isChangingPassword}
            >
              {t('settings.changePassword')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Add Network Modal */}
      <Modal
        isOpen={showAddNetworkModal}
        onClose={() => {
          setShowAddNetworkModal(false)
          setNewNetworkName('')
          setNewNetworkUrl('')
          setConnectionStatus(null)
        }}
        title={t('settings.addNetwork')}
      >
        <div className="space-y-4">
          <Input
            label={t('settings.networkName')}
            placeholder={t('settings.networkNamePlaceholder')}
            value={newNetworkName}
            onChange={(e) => setNewNetworkName(e.target.value)}
          />

          <Input
            label={t('settings.customUrl')}
            placeholder={t('settings.customUrlPlaceholder')}
            value={newNetworkUrl}
            onChange={(e) => {
              setNewNetworkUrl(e.target.value)
              setConnectionStatus(null)
            }}
          />

          {connectionStatus && (
            <div className={`flex items-center gap-2 text-sm ${connectionStatus.success ? 'text-accent-green' : 'text-accent-red'}`}>
              {connectionStatus.success ? (
                <Check className="w-4 h-4" />
              ) : (
                <X className="w-4 h-4" />
              )}
              <span>{connectionStatus.message}</span>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              onClick={testConnection}
              loading={isTesting}
              variant="secondary"
              className="flex-1"
            >
              {t('settings.testConnection')}
            </Button>
            <Button
              onClick={handleAddNetwork}
              loading={isTesting}
              className="flex-1"
              disabled={!newNetworkName.trim() || !newNetworkUrl.trim()}
            >
              {t('common.add')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
