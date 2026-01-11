import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Layers, Plus, Minus, ArrowRightLeft, TrendingUp, RefreshCw, Coins, BarChart3 } from 'lucide-react'
import { useWallet } from '../context/WalletContext'
import { useNetwork } from '../context/NetworkContext'
import { Button, Spinner, Modal, Input, Select } from '../components/ui'
import * as messaging from '@lib/messaging'
import type { NeuronetInfo, NeuronetInfoDetailed, ValidatorHotkey } from '@shared/types'
import { RAO_PER_TAO } from '@shared/types'

// Extended stake info for UI display
interface StakeDisplay {
  hotkey: string
  hotkeyName: string
  netuid: number
  neuronetName: string
  stake: number
  stakeRaw: string
  rewards: number
  emission: number
  tempo: number
  apy: number
  price: number
  emissionPerBlock: number
}

// Calculate APY for a neuronet
const calculateAPY = (totalStake: number, emissionPerEpoch: number, tempo: number): number => {
  if (totalStake <= 0 || tempo <= 0 || emissionPerEpoch <= 0) return 0

  const BLOCKS_PER_YEAR = 2_628_000 // ~12 sec blocks
  const epochsPerYear = BLOCKS_PER_YEAR / tempo
  const annualEmission = emissionPerEpoch * epochsPerYear
  const apy = (annualEmission / totalStake) * 100

  return Math.min(apy, 999) // Cap at 999%
}

export default function Staking() {
  const { t } = useTranslation()
  const { activeWallet, hotkeys, loadHotkeys } = useWallet()
  const { isConnected } = useNetwork()

  const [stakes, setStakes] = useState<StakeDisplay[]>([])
  const [neuronets, setNeuronets] = useState<NeuronetInfoDetailed[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [neuronetsError, setNeuronetsError] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [selectedStake, setSelectedStake] = useState<StakeDisplay | null>(null)
  const [stakeToMove, setStakeToMove] = useState<StakeDisplay | null>(null)

  // Calculate totals
  const totalStaked = stakes.reduce((sum, s) => sum + s.stake, 0)
  const totalRewards = stakes.reduce((sum, s) => sum + s.rewards, 0)
  const weightedAPY = totalStaked > 0
    ? stakes.reduce((sum, s) => sum + (s.apy * s.stake), 0) / totalStaked
    : 0

  useEffect(() => {
    if (activeWallet) {
      loadHotkeys(activeWallet.id)
    }
  }, [activeWallet, loadHotkeys])

  const loadData = useCallback(async () => {
    if (!isConnected || !activeWallet) return

    setIsLoading(true)
    setError(null)
    setNeuronetsError(false)

    try {
      // Load detailed neuronets first
      let neuronetData: NeuronetInfoDetailed[] = []
      try {
        neuronetData = await messaging.getNeuronetsDetailed()
        setNeuronets(neuronetData)
      } catch (err) {
        console.error('Failed to load detailed neuronets, falling back to basic:', err)
        setNeuronetsError(true)
        // Fallback to basic neuronets
        const basicNeuronets = await messaging.getNeuronets()
        neuronetData = basicNeuronets.map(n => ({
          ...n,
          totalStake: BigInt(0),
          totalStakeFormatted: 0,
          quantIn: BigInt(0),
          quantInFormatted: 0,
          aetIn: BigInt(0),
          aetInFormatted: 0,
          aetInEmission: BigInt(0),
          aetInEmissionFormatted: 0,
          owner: null,
          ownerHotkey: null,
          tokenSymbol: '',
          registrationAllowed: true,
          emissionStarted: false,
          firstEmissionBlock: null,
        }))
        setNeuronets(neuronetData)
      }

      // Create maps for neuronet data lookup
      const neuronetNames = new Map<number, string>()
      const neuronetTempos = new Map<number, number>()
      const neuronetEmissions = new Map<number, number>()
      const neuronetTotalStakes = new Map<number, number>()
      const neuronetEmissionsPerBlock = new Map<number, number>()
      const neuronetPrices = new Map<number, number>()

      // Populate maps and fetch prices
      await Promise.all(neuronetData.map(async (neuronet) => {
        neuronetNames.set(neuronet.netuid, neuronet.name)
        neuronetTempos.set(neuronet.netuid, neuronet.tempo || 360)
        neuronetEmissions.set(neuronet.netuid, neuronet.emission || 0)
        neuronetTotalStakes.set(neuronet.netuid, neuronet.totalStakeFormatted || 0)
        neuronetEmissionsPerBlock.set(neuronet.netuid, neuronet.aetInEmissionFormatted || 0)

        // Try to get price from API
        try {
          const price = await messaging.getNeuronetPrice(neuronet.netuid)
          if (price > 0) {
            neuronetPrices.set(neuronet.netuid, price)
          } else if (neuronet.quantInFormatted > 0) {
            neuronetPrices.set(neuronet.netuid, neuronet.aetInFormatted / neuronet.quantInFormatted)
          } else {
            neuronetPrices.set(neuronet.netuid, 0)
          }
        } catch {
          // Fallback to ratio
          if (neuronet.quantInFormatted > 0) {
            neuronetPrices.set(neuronet.netuid, neuronet.aetInFormatted / neuronet.quantInFormatted)
          } else {
            neuronetPrices.set(neuronet.netuid, 0)
          }
        }
      }))

      // Try to get detailed stake info with rewards
      let stakeDisplays: StakeDisplay[] = []
      try {
        const detailedStakes = await messaging.getStakingInfoDetailed(activeWallet.address)

        stakeDisplays = detailedStakes.map(info => {
          const ownHotkey = hotkeys.find(h => h.address === info.hotkey)
          const emission = Number(info.emission) / 1_000_000_000
          const aetEmission = Number(info.aetEmission) / 1_000_000_000
          const stake = Number(info.stake) / 1_000_000_000
          const tempo = neuronetTempos.get(info.netuid) || 360
          const effectiveEmission = aetEmission || emission

          const neuronetEmission = neuronetEmissions.get(info.netuid) || 0
          const neuronetTotalStake = neuronetTotalStakes.get(info.netuid) || 0

          return {
            hotkey: info.hotkey,
            hotkeyName: ownHotkey?.name || `Validator ${info.hotkey.slice(0, 8)}...`,
            netuid: info.netuid,
            neuronetName: neuronetNames.get(info.netuid) || `Neuronet ${info.netuid}`,
            stakeRaw: info.stake.toString(),
            stake,
            rewards: effectiveEmission,
            emission: effectiveEmission,
            tempo,
            apy: calculateAPY(neuronetTotalStake, neuronetEmission, tempo),
            price: neuronetPrices.get(info.netuid) || 0,
            emissionPerBlock: neuronetEmissionsPerBlock.get(info.netuid) || 0,
          }
        })
      } catch (err) {
        console.error('Failed to load detailed stakes, falling back to basic:', err)
        // Fallback to basic stake info
        const basicStakes = await messaging.getStakingInfo(activeWallet.address)

        stakeDisplays = basicStakes.map(info => {
          const ownHotkey = hotkeys.find(h => h.address === info.hotkey)
          const stake = Number(BigInt(info.stake as unknown as string)) / Number(RAO_PER_TAO)
          const tempo = neuronetTempos.get(info.netuid) || 360
          const neuronetEmission = neuronetEmissions.get(info.netuid) || 0
          const neuronetTotalStake = neuronetTotalStakes.get(info.netuid) || 0

          return {
            hotkey: info.hotkey,
            hotkeyName: ownHotkey?.name || `Validator ${info.hotkey.slice(0, 8)}...`,
            netuid: info.netuid,
            neuronetName: neuronetNames.get(info.netuid) || `Neuronet ${info.netuid}`,
            stakeRaw: info.stake as unknown as string,
            stake,
            rewards: 0,
            emission: 0,
            tempo,
            apy: calculateAPY(neuronetTotalStake, neuronetEmission, tempo),
            price: neuronetPrices.get(info.netuid) || 0,
            emissionPerBlock: neuronetEmissionsPerBlock.get(info.netuid) || 0,
          }
        })
      }

      setStakes(stakeDisplays)
    } catch (err) {
      console.error('Failed to load staking data:', err)
      setError(t('staking.loadError'))
    } finally {
      setIsLoading(false)
    }
  }, [isConnected, activeWallet, hotkeys, t])

  useEffect(() => {
    loadData()
  }, [loadData])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner size="lg" className="text-primary-500" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-white">{t('staking.title')}</h2>
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <Button size="sm" variant="secondary" onClick={loadData}>
            <RefreshCw className="w-4 h-4 mr-1" />
            {t('common.tryAgain')}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">{t('staking.title')}</h2>
        <Button
          size="sm"
          onClick={() => setShowAddModal(true)}
          disabled={neuronets.length === 0}
        >
          <Plus className="w-4 h-4 mr-1" />
          {t('staking.addStake')}
        </Button>
      </div>

      {/* Statistics Cards */}
      {stakes.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-dark-800 rounded-xl border border-dark-700 p-3">
            <div className="flex items-center gap-2 mb-1">
              <Coins className="w-4 h-4 text-primary-500" />
              <span className="text-xs text-gray-400">{t('staking.totalStaked')}</span>
            </div>
            <p className="text-sm font-semibold text-white">
              {totalStaked.toLocaleString(undefined, { maximumFractionDigits: 2 })} AET
            </p>
          </div>

          <div className="bg-dark-800 rounded-xl border border-dark-700 p-3">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-green-500" />
              <span className="text-xs text-gray-400">{t('staking.totalRewards')}</span>
            </div>
            <p className="text-sm font-semibold text-green-400">
              +{totalRewards.toLocaleString(undefined, { maximumFractionDigits: 6 })} AET
            </p>
          </div>

          <div className="bg-dark-800 rounded-xl border border-dark-700 p-3">
            <div className="flex items-center gap-2 mb-1">
              <Layers className="w-4 h-4 text-blue-500" />
              <span className="text-xs text-gray-400">{t('staking.activeStakes')}</span>
            </div>
            <p className="text-sm font-semibold text-white">{stakes.length}</p>
          </div>

          <div className="bg-dark-800 rounded-xl border border-dark-700 p-3">
            <div className="flex items-center gap-2 mb-1">
              <BarChart3 className="w-4 h-4 text-purple-500" />
              <span className="text-xs text-gray-400">{t('staking.apyEst')}</span>
            </div>
            <p className="text-sm font-semibold text-white">
              {weightedAPY > 0 ? `${weightedAPY.toFixed(2)}%` : '---'}
            </p>
          </div>
        </div>
      )}

      {/* Neuronets Error Warning */}
      {neuronetsError && (
        <div className="bg-accent-yellow/10 border border-accent-yellow/30 rounded-xl p-3 flex items-center justify-between">
          <span className="text-xs text-accent-yellow">
            {t('staking.neuronetsLoadError')}
          </span>
          <Button size="sm" variant="ghost" onClick={loadData}>
            <RefreshCw className="w-3 h-3" />
          </Button>
        </div>
      )}

      {stakes.length === 0 ? (
        <div className="bg-dark-800 rounded-xl border border-dark-700 p-6 text-center">
          <Layers className="w-10 h-10 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400 mb-2">{t('staking.noStakes')}</p>
          <p className="text-sm text-gray-500">
            {t('staking.noStakesDesc')}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {stakes.map((stake, i) => (
            <div
              key={i}
              className="bg-dark-800 rounded-xl border border-dark-700 p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-white">
                  {stake.neuronetName}
                </span>
                <span className="text-sm text-primary-500">
                  {stake.stake.toLocaleString(undefined, { maximumFractionDigits: 4 })} AET
                </span>
              </div>

              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-gray-500 truncate max-w-[60%]">
                  {stake.hotkeyName}
                </p>
                {stake.apy > 0 && (
                  <div className="flex items-center gap-1 text-xs text-green-400">
                    <TrendingUp className="w-3 h-3" />
                    <span>{stake.apy.toFixed(1)}% {t('staking.apy')}</span>
                  </div>
                )}
              </div>

              {/* Extended info: rewards, price, emission */}
              <div className="flex items-center justify-between mb-2 text-xs">
                {stake.rewards > 0 && (
                  <span className="text-green-400">
                    +{stake.rewards.toLocaleString(undefined, { maximumFractionDigits: 6 })} {t('staking.rewards')}
                  </span>
                )}
                {stake.price > 0 && (
                  <span className="text-gray-500">
                    {t('staking.price')}: {stake.price.toFixed(6)}
                  </span>
                )}
              </div>

              {stake.emissionPerBlock > 0 && (
                <div className="text-xs text-primary-400 mb-2">
                  {stake.emissionPerBlock.toFixed(6)} AET/{t('staking.block')}
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setStakeToMove(stake)}
                  className="flex-1"
                >
                  <ArrowRightLeft className="w-3 h-3 mr-1" />
                  {t('common.move')}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setSelectedStake(stake)}
                  className="flex-1"
                >
                  <Minus className="w-3 h-3 mr-1" />
                  {t('common.remove')}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Stake Modal */}
      <AddStakeModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        hotkeys={hotkeys}
        neuronets={neuronets}
        onSuccess={loadData}
      />

      {/* Remove Stake Modal */}
      <RemoveStakeModal
        isOpen={!!selectedStake}
        onClose={() => setSelectedStake(null)}
        stake={selectedStake}
        neuronets={neuronets}
        onSuccess={loadData}
      />

      {/* Move Stake Modal */}
      <MoveStakeModal
        isOpen={!!stakeToMove}
        onClose={() => setStakeToMove(null)}
        stake={stakeToMove}
        hotkeys={hotkeys}
        neuronets={neuronets}
        onSuccess={loadData}
      />
    </div>
  )
}

function AddStakeModal({
  isOpen,
  onClose,
  hotkeys,
  neuronets,
  onSuccess,
}: {
  isOpen: boolean
  onClose: () => void
  hotkeys: any[]
  neuronets: NeuronetInfoDetailed[]
  onSuccess: () => void
}) {
  const { t } = useTranslation()
  const [hotkeySource, setHotkeySource] = useState<'own' | 'validator'>('own')
  const [hotkey, setHotkey] = useState('')
  const [netuid, setNetuid] = useState('')
  const [amount, setAmount] = useState('')
  const [safeMode, setSafeMode] = useState(false)
  const [limitPrice, setLimitPrice] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [validatorHotkeys, setValidatorHotkeys] = useState<ValidatorHotkey[]>([])
  const [loadingValidators, setLoadingValidators] = useState(false)

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setHotkeySource('own')
      setHotkey(hotkeys[0]?.address || '')
      setNetuid(neuronets[0]?.netuid.toString() || '')
      setAmount('')
      setSafeMode(false)
      setLimitPrice('')
      setError('')
      setValidatorHotkeys([])
    }
  }, [isOpen, hotkeys, neuronets])

  // Load validators when neuronet changes and source is 'validator'
  useEffect(() => {
    const loadValidators = async () => {
      if (!netuid || hotkeySource !== 'validator') return

      setLoadingValidators(true)
      try {
        const validators = await messaging.getNeuronetValidators(parseInt(netuid))
        setValidatorHotkeys(validators)
        if (validators.length > 0) {
          setHotkey(validators[0].hotkey)
        }
      } catch (err) {
        console.error('Error loading validators:', err)
        setValidatorHotkeys([])
      } finally {
        setLoadingValidators(false)
      }
    }

    loadValidators()
  }, [netuid, hotkeySource])

  // Update hotkey when source changes
  useEffect(() => {
    if (hotkeySource === 'own' && hotkeys.length > 0) {
      setHotkey(hotkeys[0].address)
    } else if (hotkeySource === 'validator' && validatorHotkeys.length > 0) {
      setHotkey(validatorHotkeys[0].hotkey)
    }
  }, [hotkeySource, hotkeys, validatorHotkeys])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!hotkey || !netuid || !amount) return

    setIsLoading(true)
    setError('')

    try {
      let result
      if (safeMode && limitPrice) {
        result = await messaging.addStakeLimit(
          hotkey,
          parseInt(netuid),
          amount,
          limitPrice,
          true // allowPartial
        )
      } else {
        result = await messaging.addStake(hotkey, parseInt(netuid), amount)
      }

      if (result.success) {
        onSuccess()
        onClose()
      } else {
        setError(result.error || 'Failed to add stake')
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('staking.addStake')}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Neuronet Selection - First for validator loading */}
        <Select
          label={t('staking.neuronet')}
          options={neuronets.map((n) => ({
            value: n.netuid.toString(),
            label: n.name,
          }))}
          value={netuid}
          onChange={(e) => setNetuid(e.target.value)}
        />

        {/* Hotkey Source Toggle */}
        <div className="space-y-2">
          <label className="text-sm text-gray-400">{t('staking.hotkeySource')}</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setHotkeySource('own')}
              className={`flex-1 py-2 px-3 rounded-lg text-sm transition-colors ${
                hotkeySource === 'own'
                  ? 'bg-primary-500 text-white'
                  : 'bg-dark-700 text-gray-400 hover:bg-dark-600'
              }`}
            >
              {t('staking.myHotkeys')}
            </button>
            <button
              type="button"
              onClick={() => setHotkeySource('validator')}
              className={`flex-1 py-2 px-3 rounded-lg text-sm transition-colors ${
                hotkeySource === 'validator'
                  ? 'bg-primary-500 text-white'
                  : 'bg-dark-700 text-gray-400 hover:bg-dark-600'
              }`}
            >
              {t('staking.validators')}
            </button>
          </div>
        </div>

        {/* Hotkey Selection */}
        {hotkeySource === 'own' ? (
          <Select
            label={t('staking.hotkey')}
            options={
              hotkeys.length === 0
                ? [{ value: '', label: t('hotkeys.noHotkeys') }]
                : hotkeys.map((h) => ({ value: h.address, label: h.name }))
            }
            value={hotkey}
            onChange={(e) => setHotkey(e.target.value)}
            disabled={hotkeys.length === 0}
          />
        ) : loadingValidators ? (
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              {t('staking.validatorHotkey')}
            </label>
            <div className="w-full px-3 py-2.5 bg-dark-800 border border-dark-600 rounded-lg text-gray-500 flex items-center gap-2">
              <Spinner size="sm" />
              {t('staking.loadingValidators')}
            </div>
          </div>
        ) : (
          <Select
            label={t('staking.validatorHotkey')}
            options={
              validatorHotkeys.length === 0
                ? [{ value: '', label: t('staking.noValidatorsFound') }]
                : validatorHotkeys.map((v) => ({
                    value: v.hotkey,
                    label: `UID ${v.uid} - ${v.hotkey.slice(0, 8)}... (${(Number(v.stake) / 1e9).toFixed(2)} AET)`
                  }))
            }
            value={hotkey}
            onChange={(e) => setHotkey(e.target.value)}
            disabled={validatorHotkeys.length === 0}
          />
        )}

        {/* Amount Input */}
        <Input
          label={t('staking.amountPlaceholder')}
          type="number"
          step="0.0001"
          min="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />

        {/* Safe Mode Toggle */}
        <label className="flex items-center gap-3 p-3 bg-dark-700 rounded-lg cursor-pointer">
          <input
            type="checkbox"
            checked={safeMode}
            onChange={(e) => setSafeMode(e.target.checked)}
            className="w-4 h-4 rounded border-dark-600 bg-dark-800 text-primary-500 focus:ring-primary-500"
          />
          <div>
            <span className="text-sm text-white font-medium">{t('staking.safeMode')}</span>
            <p className="text-xs text-gray-500">{t('staking.safeModeDesc')}</p>
          </div>
        </label>

        {/* Limit Price Input (visible when Safe Mode enabled) */}
        {safeMode && (
          <Input
            label={t('staking.limitPrice')}
            type="number"
            step="0.000001"
            min="0"
            value={limitPrice}
            onChange={(e) => setLimitPrice(e.target.value)}
            placeholder="0.000000"
          />
        )}

        {error && (
          <p className="text-sm text-red-400">{error}</p>
        )}

        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            loading={isLoading}
            className="flex-1"
            disabled={!hotkey || !netuid || !amount}
          >
            {t('staking.addStake')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

function RemoveStakeModal({
  isOpen,
  onClose,
  stake,
  neuronets,
  onSuccess,
}: {
  isOpen: boolean
  onClose: () => void
  stake: StakeDisplay | null
  neuronets: NeuronetInfo[]
  onSuccess: () => void
}) {
  const { t } = useTranslation()
  const [amount, setAmount] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const neuronet = stake ? neuronets.find((n) => n.netuid === stake.netuid) : null

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setAmount('')
      setError('')
    }
  }, [isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!stake || !amount) return

    setIsLoading(true)
    setError('')

    try {
      const result = await messaging.removeStake(stake.hotkey, stake.netuid, amount)
      if (result.success) {
        onSuccess()
        onClose()
      } else {
        setError(result.error || 'Failed to remove stake')
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleMax = () => {
    if (stake) {
      setAmount(stake.stake.toString())
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('staking.removeStake')}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-dark-700 rounded-lg p-3">
          <p className="text-sm text-gray-400">{t('staking.neuronet')}</p>
          <p className="text-white">{neuronet?.name || `Neuronet ${stake?.netuid}`}</p>
        </div>

        <div className="relative">
          <Input
            label={t('staking.amountToMove')}
            type="number"
            step="0.0001"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            error={error}
          />
          <button
            type="button"
            onClick={handleMax}
            className="absolute right-3 top-8 text-xs text-primary-500 hover:text-primary-400"
          >
            MAX
          </button>
        </div>

        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
            {t('common.cancel')}
          </Button>
          <Button type="submit" variant="danger" loading={isLoading} className="flex-1">
            {t('staking.removeStake')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

function MoveStakeModal({
  isOpen,
  onClose,
  stake,
  hotkeys,
  neuronets,
  onSuccess,
}: {
  isOpen: boolean
  onClose: () => void
  stake: StakeDisplay | null
  hotkeys: any[]
  neuronets: NeuronetInfo[]
  onSuccess: () => void
}) {
  const { t } = useTranslation()
  const [destHotkey, setDestHotkey] = useState('')
  const [destNetuid, setDestNetuid] = useState('')
  const [amount, setAmount] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [txHash, setTxHash] = useState('')

  const sourceNeuronet = stake ? neuronets.find((n) => n.netuid === stake.netuid) : null

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen && stake) {
      setDestHotkey(stake.hotkey) // Default to same hotkey
      setDestNetuid('')
      setAmount('')
      setError('')
      setSuccess(false)
      setTxHash('')
    }
  }, [isOpen, stake])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!stake || !destHotkey || !destNetuid || !amount) {
      setError('Please fill all fields')
      return
    }

    if (parseFloat(amount) <= 0) {
      setError('Amount must be greater than 0')
      return
    }

    setIsLoading(true)
    setError('')

    try {
      const result = await messaging.sendMessage<{ success: boolean; hash?: string; error?: string }>({
        type: 'staking:move',
        payload: {
          srcHotkey: stake.hotkey,
          destHotkey,
          netuid: parseInt(destNetuid),
          amount,
        },
      })

      if (result.success) {
        setSuccess(true)
        setTxHash(result.hash || '')
        onSuccess()
      } else {
        setError(result.error || 'Failed to move stake')
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  if (success) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title={t('staking.stakeMoved')}>
        <div className="text-center py-4">
          <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <ArrowRightLeft className="w-6 h-6 text-green-500" />
          </div>
          <p className="text-white mb-2">{t('staking.stakeMoved')}</p>
          {txHash && (
            <p className="text-xs text-gray-500 font-mono break-all px-4 mb-4">
              {txHash}
            </p>
          )}
          <Button onClick={onClose} className="w-full">
            {t('common.done')}
          </Button>
        </div>
      </Modal>
    )
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('staking.moveStake')}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Source info */}
        <div className="bg-dark-700 rounded-lg p-3 space-y-2">
          <div>
            <p className="text-xs text-gray-400">{t('staking.fromNeuronet')}</p>
            <p className="text-sm text-white">
              {sourceNeuronet?.name || `Neuronet ${stake?.netuid}`}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400">{t('staking.hotkey')}</p>
            <p className="text-xs text-gray-300 font-mono truncate">
              {stake?.hotkey}
            </p>
          </div>
        </div>

        {/* Destination hotkey */}
        <Select
          label={t('staking.destinationHotkey')}
          options={[
            { value: stake?.hotkey || '', label: t('staking.sameHotkey') },
            ...hotkeys
              .filter((h) => h.address !== stake?.hotkey)
              .map((h) => ({ value: h.address, label: h.name })),
          ]}
          value={destHotkey}
          onChange={(e) => setDestHotkey(e.target.value)}
        />

        {/* Destination neuronet */}
        <Select
          label={t('staking.toNeuronet')}
          options={neuronets
            .filter((n) => n.netuid !== stake?.netuid || destHotkey !== stake?.hotkey)
            .map((n) => ({
              value: n.netuid.toString(),
              label: n.name,
            }))}
          value={destNetuid}
          onChange={(e) => setDestNetuid(e.target.value)}
        />

        {/* Amount */}
        <Input
          label={t('staking.amountToMove')}
          type="number"
          step="0.0001"
          min="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          error={error}
        />

        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
            {t('common.cancel')}
          </Button>
          <Button type="submit" loading={isLoading} className="flex-1">
            {t('staking.moveStake')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
