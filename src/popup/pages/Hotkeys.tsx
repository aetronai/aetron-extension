import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Key, Plus, Trash2, Copy, Check, Eye, Download } from 'lucide-react'
import { useWallet } from '../context/WalletContext'
import { Button, Spinner, Modal, Input } from '../components/ui'
import * as messaging from '@lib/messaging'
import type { Hotkey } from '@shared/wallet/types'

export default function Hotkeys() {
  const { t } = useTranslation()
  const { activeWallet, hotkeys, loadHotkeys, createHotkey, deleteHotkey } = useWallet()
  const [isLoading, setIsLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [hotkeyToExport, setHotkeyToExport] = useState<Hotkey | null>(null)

  useEffect(() => {
    const load = async () => {
      if (activeWallet) {
        setIsLoading(true)
        await loadHotkeys(activeWallet.id)
        setIsLoading(false)
      }
    }
    load()
  }, [activeWallet, loadHotkeys])

  const copyAddress = (id: string, address: string) => {
    navigator.clipboard.writeText(address)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleDelete = async (hotkeyId: string) => {
    if (confirm(t('hotkeys.confirmDelete'))) {
      await deleteHotkey(hotkeyId)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner size="lg" className="text-primary-500" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">{t('hotkeys.title')}</h2>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => setShowImportModal(true)}>
            <Download className="w-4 h-4 mr-1" />
            {t('common.import')}
          </Button>
          <Button size="sm" onClick={() => setShowCreateModal(true)}>
            <Plus className="w-4 h-4 mr-1" />
            {t('common.create')}
          </Button>
        </div>
      </div>

      {hotkeys.length === 0 ? (
        <div className="bg-dark-800 rounded-xl border border-dark-700 p-6 text-center">
          <Key className="w-10 h-10 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400 mb-2">{t('hotkeys.noHotkeys')}</p>
          <p className="text-sm text-gray-500">
            {t('hotkeys.noHotkeysDesc')}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {hotkeys.map((hotkey) => (
            <div
              key={hotkey.id}
              className="bg-dark-800 rounded-xl border border-dark-700 p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-white">
                  {hotkey.name}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setHotkeyToExport(hotkey)}
                    className="p-1.5 text-gray-400 hover:text-primary-500 hover:bg-dark-700 rounded"
                    title={t('hotkeys.viewPhrase')}
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => copyAddress(hotkey.id, hotkey.address)}
                    className="p-1.5 text-gray-400 hover:text-white hover:bg-dark-700 rounded"
                  >
                    {copiedId === hotkey.id ? (
                      <Check className="w-4 h-4 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    onClick={() => handleDelete(hotkey.id)}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-dark-700 rounded"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <p className="text-xs text-gray-500 font-mono truncate">
                {hotkey.address}
              </p>
            </div>
          ))}
        </div>
      )}

      <CreateHotkeyModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={createHotkey}
        coldkeyId={activeWallet?.id || ''}
      />

      <ImportHotkeyModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImport={async () => {
          if (activeWallet) {
            await loadHotkeys(activeWallet.id)
          }
        }}
        coldkeyId={activeWallet?.id || ''}
      />

      {hotkeyToExport && (
        <ViewPhraseModal
          isOpen={!!hotkeyToExport}
          onClose={() => setHotkeyToExport(null)}
          hotkey={hotkeyToExport}
        />
      )}
    </div>
  )
}

function CreateHotkeyModal({
  isOpen,
  onClose,
  onCreate,
  coldkeyId,
}: {
  isOpen: boolean
  onClose: () => void
  onCreate: (name: string, coldkeyId: string, password: string) => Promise<any>
  coldkeyId: string
}) {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [mnemonic, setMnemonic] = useState('')
  const [copied, setCopied] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !password) return

    setIsLoading(true)
    setError('')

    try {
      const result = await onCreate(name, coldkeyId, password)
      setMnemonic(result.mnemonic)
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

  const handleClose = () => {
    setName('')
    setPassword('')
    setMnemonic('')
    setError('')
    onClose()
  }

  if (mnemonic) {
    return (
      <Modal isOpen={isOpen} onClose={handleClose} title={t('hotkeys.backupWarning')}>
        <div className="space-y-4">
          <p className="text-sm text-gray-400">
            {t('hotkeys.backupDesc')}
          </p>

          <div className="bg-dark-700 rounded-lg p-3">
            <p className="text-sm text-white font-mono break-all">{mnemonic}</p>
          </div>

          <Button onClick={handleCopy} variant="secondary" className="w-full">
            {copied ? (
              <>
                <Check className="w-4 h-4 mr-2" />
                {t('common.copied')}
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 mr-2" />
                {t('common.copyPhrase')}
              </>
            )}
          </Button>

          <Button onClick={handleClose} className="w-full">
            {t('common.done')}
          </Button>
        </div>
      </Modal>
    )
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={t('hotkeys.createHotkey')}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label={t('common.name')}
          placeholder={t('hotkeys.hotkeyNamePlaceholder')}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <Input
          label={t('common.password')}
          type="password"
          placeholder={t('hotkeys.enterPassword')}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={error}
        />

        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={handleClose} className="flex-1">
            {t('common.cancel')}
          </Button>
          <Button type="submit" loading={isLoading} className="flex-1">
            {t('common.create')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

function ViewPhraseModal({
  isOpen,
  onClose,
  hotkey,
}: {
  isOpen: boolean
  onClose: () => void
  hotkey: Hotkey
}) {
  const { t } = useTranslation()
  const [password, setPassword] = useState('')
  const [mnemonic, setMnemonic] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
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

  const handleClose = () => {
    setPassword('')
    setMnemonic('')
    setError('')
    onClose()
  }

  if (mnemonic) {
    return (
      <Modal isOpen={isOpen} onClose={handleClose} title={t('hotkeys.exportPhrase')}>
        <div className="space-y-4">
          <p className="text-sm text-gray-400">
            {t('hotkeys.writeDownWords')}
          </p>

          <div className="bg-dark-700 rounded-lg p-3">
            <div className="grid grid-cols-3 gap-2">
              {mnemonic.split(' ').map((word, i) => (
                <div
                  key={i}
                  className="text-xs text-white font-mono bg-dark-600 rounded px-2 py-1"
                >
                  <span className="text-gray-500 mr-1">{i + 1}.</span>
                  {word}
                </div>
              ))}
            </div>
          </div>

          <Button onClick={handleCopy} variant="secondary" className="w-full">
            {copied ? (
              <>
                <Check className="w-4 h-4 mr-2" />
                {t('common.copied')}
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 mr-2" />
                {t('common.copyPhrase')}
              </>
            )}
          </Button>

          <Button onClick={handleClose} className="w-full">
            {t('common.done')}
          </Button>
        </div>
      </Modal>
    )
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={t('hotkeys.exportPhrase')}>
      <form onSubmit={handleSubmit} className="space-y-4">
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
          <Button type="button" variant="secondary" onClick={handleClose} className="flex-1">
            {t('common.cancel')}
          </Button>
          <Button type="submit" loading={isLoading} className="flex-1">
            {t('common.continue')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

function ImportHotkeyModal({
  isOpen,
  onClose,
  onImport,
  coldkeyId,
}: {
  isOpen: boolean
  onClose: () => void
  onImport: () => Promise<void>
  coldkeyId: string
}) {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [mnemonic, setMnemonic] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !mnemonic.trim() || !password) {
      setError(t('errors.allFieldsRequired'))
      return
    }

    setIsLoading(true)
    setError('')

    try {
      await messaging.importHotkey(name.trim(), mnemonic.trim(), coldkeyId, password)
      await onImport()
      handleClose()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    setName('')
    setMnemonic('')
    setPassword('')
    setError('')
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={t('hotkeys.importHotkey')}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label={t('common.name')}
          placeholder={t('hotkeys.hotkeyNamePlaceholder')}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">
            {t('importWallet.seedPhrase')}
          </label>
          <textarea
            placeholder={t('hotkeys.enterMnemonic')}
            value={mnemonic}
            onChange={(e) => setMnemonic(e.target.value)}
            rows={3}
            className="w-full px-3 py-2.5 bg-dark-800 border border-dark-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
          />
        </div>

        <Input
          label={t('common.password')}
          type="password"
          placeholder={t('hotkeys.enterPassword')}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={error}
        />

        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={handleClose} className="flex-1">
            {t('common.cancel')}
          </Button>
          <Button type="submit" loading={isLoading} className="flex-1">
            {t('common.import')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
