import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Network } from 'lucide-react'
import { useNetwork } from '../context/NetworkContext'
import { Spinner } from '../components/ui'
import * as messaging from '@lib/messaging'
import type { NeuronetInfo } from '@shared/types'

export default function Neuronets() {
  const { t } = useTranslation()
  const { isConnected } = useNetwork()
  const [neuronets, setNeuronets] = useState<NeuronetInfo[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      if (!isConnected) return

      setIsLoading(true)
      try {
        const data = await messaging.getNeuronets()
        setNeuronets(data)
      } catch (err) {
        console.error('Failed to load neuronets:', err)
      } finally {
        setIsLoading(false)
      }
    }

    load()
  }, [isConnected])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner size="lg" className="text-primary-500" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-white">{t('neuronets.title')}</h2>

      {neuronets.length === 0 ? (
        <div className="bg-dark-800 rounded-xl border border-dark-700 p-6 text-center">
          <Network className="w-10 h-10 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400">{t('neuronets.noNeuronets')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {neuronets.map((neuronet) => (
            <div
              key={neuronet.netuid}
              className="bg-dark-800 rounded-xl border border-dark-700 p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-primary-600/20 rounded-lg flex items-center justify-center">
                    <span className="text-sm font-bold text-primary-500">
                      {neuronet.netuid}
                    </span>
                  </div>
                  <span className="text-sm font-medium text-white">
                    {neuronet.name}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-dark-700 rounded px-2 py-1.5">
                  <span className="text-gray-500">{t('neuronets.neurons')}: </span>
                  <span className="text-gray-300">
                    {neuronet.currentNeurons}/{neuronet.maxNeurons}
                  </span>
                </div>
                <div className="bg-dark-700 rounded px-2 py-1.5">
                  <span className="text-gray-500">{t('neuronets.tempo')}: </span>
                  <span className="text-gray-300">{neuronet.tempo}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
