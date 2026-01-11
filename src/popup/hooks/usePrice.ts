import { useState, useEffect, useCallback } from 'react'
import { useNetwork } from '../context/NetworkContext'
import { getTokenPrice } from '@lib/messaging'

// Cache price for 60 seconds
const CACHE_DURATION = 60 * 1000
const priceCache: { [key: string]: { price: number; timestamp: number } } = {}

export function usePrice() {
  const { currentNetwork } = useNetwork()
  const [price, setPrice] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchPrice = useCallback(async () => {
    if (!currentNetwork) return

    const cacheKey = currentNetwork.id

    // Check cache
    const cached = priceCache[cacheKey]
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      setPrice(cached.price)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const fetchedPrice = await getTokenPrice(currentNetwork.id)

      // Update cache
      priceCache[cacheKey] = {
        price: fetchedPrice,
        timestamp: Date.now(),
      }

      setPrice(fetchedPrice)
    } catch (err) {
      console.error('Failed to fetch price:', err)
      setError((err as Error).message)
      // Keep previous price on error
    } finally {
      setIsLoading(false)
    }
  }, [currentNetwork])

  // Fetch price on mount and when network changes
  useEffect(() => {
    fetchPrice()

    // Refresh price every 60 seconds
    const interval = setInterval(fetchPrice, CACHE_DURATION)
    return () => clearInterval(interval)
  }, [fetchPrice])

  const formatUsd = useCallback((aetAmount: number): string => {
    if (price === null || price === 0) return ''
    const usdValue = aetAmount * price
    const formatted = usdValue.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
    return `$${formatted}`
  }, [price])

  return {
    price,
    isLoading,
    error,
    refetch: fetchPrice,
    formatUsd,
  }
}
