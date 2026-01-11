import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Globe, Trash2 } from 'lucide-react'
import { Spinner } from '../components/ui'
import * as messaging from '@lib/messaging'
import type { SitePermission } from '@lib/storage'

export default function ConnectedSites() {
  const { t } = useTranslation()
  const [permissions, setPermissions] = useState<Record<string, SitePermission>>({})
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const data = await messaging.sendMessage<Record<string, SitePermission>>({
          type: 'permissions:get-all',
        })
        setPermissions(data)
      } catch (err) {
        console.error('Failed to load permissions:', err)
      } finally {
        setIsLoading(false)
      }
    }

    load()
  }, [])

  const handleRevoke = async (origin: string) => {
    try {
      await messaging.sendMessage({ type: 'permissions:revoke', payload: { origin } })
      const newPermissions = { ...permissions }
      delete newPermissions[origin]
      setPermissions(newPermissions)
    } catch (err) {
      console.error('Failed to revoke permission:', err)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner size="lg" className="text-primary-500" />
      </div>
    )
  }

  const sites = Object.entries(permissions)

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-white">{t('connectedSites.title')}</h2>

      {sites.length === 0 ? (
        <div className="bg-dark-800 rounded-xl border border-dark-700 p-6 text-center">
          <Globe className="w-10 h-10 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400 mb-2">{t('connectedSites.noSites')}</p>
          <p className="text-sm text-gray-500">
            {t('connectedSites.noSitesDesc')}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {sites.map(([origin, permission]) => (
            <div
              key={origin}
              className="bg-dark-800 rounded-xl border border-dark-700 p-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-white">{origin}</p>
                  <p className="text-xs text-gray-500">
                    {permission.accounts.length} account(s) connected
                  </p>
                </div>
                <button
                  onClick={() => handleRevoke(origin)}
                  className="p-2 text-gray-400 hover:text-red-500 hover:bg-dark-700 rounded-lg"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
