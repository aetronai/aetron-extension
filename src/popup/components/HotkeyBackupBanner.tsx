import { AlertTriangle, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { Hotkey } from '@shared/wallet/types'

interface HotkeyBackupBannerProps {
  hotkey: Hotkey
  onClick: () => void
}

export function HotkeyBackupBanner({ hotkey, onClick }: HotkeyBackupBannerProps) {
  const { t } = useTranslation()

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg hover:bg-yellow-500/15 transition-colors text-left"
    >
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center">
        <AlertTriangle className="w-4 h-4 text-yellow-500" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-yellow-500">{t('hotkeys.backupRequired')}</p>
        <p className="text-xs text-yellow-500/70 truncate">
          {t('hotkeys.backupRequiredDesc', { name: hotkey.name })}
        </p>
      </div>
      <ChevronRight className="w-4 h-4 text-yellow-500/50 flex-shrink-0" />
    </button>
  )
}
