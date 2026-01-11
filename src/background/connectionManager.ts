// Connection Manager - manages WebSocket connection to blockchain
import { ApiPromise, WsProvider } from '@polkadot/api'
import { NETWORKS, type NetworkConfig, type BalanceInfo, type StakeInfo, type NeuronetInfo, type StakeInfoDetailed, type NeuronetInfoDetailed, type ValidatorHotkey } from '@shared/types'

const CONNECTION_TIMEOUT = 10000

// Sr25519 signature type prefix for MultiSignature format
const SR25519_TYPE_PREFIX = 0x01

/**
 * Wrap raw signature with MultiSignature type prefix
 * addSignature expects MultiSignature format: 1 byte type + 64 bytes signature
 * Type bytes: 0x00=Ed25519, 0x01=Sr25519, 0x02=Ecdsa
 */
function wrapSignature(rawSignature: Uint8Array): Uint8Array {
  const multiSignature = new Uint8Array(65)
  multiSignature[0] = SR25519_TYPE_PREFIX
  multiSignature.set(rawSignature, 1)
  return multiSignature
}

// AETRON custom types
const TYPE_REGISTRY = {
  types: {
    Balance: 'u64',
  },
  signedExtensions: {
    AetensorTransactionExtension: {
      extrinsic: {},
      payload: {},
    },
    DrandPriority: {
      extrinsic: {},
      payload: {},
    },
  },
}

class ConnectionManager {
  private api: ApiPromise | null = null
  private provider: WsProvider | null = null
  private currentNetwork: NetworkConfig | null = null
  private isConnecting = false
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private onConnectionChange: ((connected: boolean) => void) | null = null

  setConnectionCallback(callback: (connected: boolean) => void): void {
    this.onConnectionChange = callback
  }

  async connect(networkId: string, customUrl?: string): Promise<boolean> {
    if (this.isConnecting) {
      console.log('Connection already in progress')
      return false
    }

    let network = NETWORKS[networkId]

    // Handle custom networks (id starts with 'custom_' or is exactly 'custom')
    if ((networkId === 'custom' || networkId.startsWith('custom_')) && customUrl) {
      network = {
        id: networkId,
        name: 'Custom Node',
        url: customUrl,
      }
    }

    if (!network) {
      throw new Error(`Unknown network: ${networkId}`)
    }

    // If already connected to the same network
    if (this.api?.isConnected && this.currentNetwork?.id === networkId) {
      return true
    }

    this.isConnecting = true
    await this.disconnectInternal()

    try {
      const provider = new WsProvider(network.url, false)

      const providerPromise = new Promise<WsProvider>((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          provider.disconnect()
          reject(new Error('Connection timeout'))
        }, CONNECTION_TIMEOUT)

        provider.on('connected', () => {
          clearTimeout(timeoutId)
          resolve(provider)
        })

        provider.on('error', (error) => {
          clearTimeout(timeoutId)
          reject(error)
        })

        provider.connect()
      })

      this.provider = await providerPromise

      this.provider.on('disconnected', () => {
        this.handleDisconnect()
      })

      this.api = await Promise.race([
        ApiPromise.create({
          provider: this.provider,
          ...TYPE_REGISTRY,
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('API creation timeout')), CONNECTION_TIMEOUT)
        ),
      ])

      await Promise.race([
        this.api.isReady,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('API ready timeout')), CONNECTION_TIMEOUT)
        ),
      ])

      this.currentNetwork = network
      this.reconnectAttempts = 0
      this.isConnecting = false
      this.onConnectionChange?.(true)

      console.log(`Connected to ${network.name}`)
      return true
    } catch (error) {
      console.error('Connection error:', error)
      await this.disconnectInternal()
      this.isConnecting = false
      this.currentNetwork = network
      this.handleDisconnect()
      return false
    }
  }

  private async handleDisconnect(): Promise<void> {
    this.onConnectionChange?.(false)

    if (this.reconnectAttempts < this.maxReconnectAttempts && this.currentNetwork) {
      this.reconnectAttempts++
      const delay = Math.min(2000 * this.reconnectAttempts, 30000)

      console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`)

      setTimeout(async () => {
        try {
          await this.connect(this.currentNetwork!.id)
        } catch {
          console.error('Reconnection failed')
        }
      }, delay)
    }
  }

  private async disconnectInternal(): Promise<void> {
    if (this.api) {
      try {
        await this.api.disconnect()
      } catch {}
      this.api = null
    }
    if (this.provider) {
      try {
        await this.provider.disconnect()
      } catch {}
      this.provider = null
    }
  }

  async disconnect(): Promise<void> {
    await this.disconnectInternal()
    this.currentNetwork = null
    this.reconnectAttempts = 0
  }

  isConnected(): boolean {
    return this.api?.isConnected ?? false
  }

  getNetwork(): NetworkConfig | null {
    return this.currentNetwork
  }

  getApi(): ApiPromise | null {
    return this.api
  }

  // Keep-alive ping for service worker
  ping(): void {
    if (this.api?.isConnected) {
      // Simple query to keep connection alive
      this.api.rpc.system.health().catch(() => {})
    }
  }

  // ==================== BLOCKCHAIN QUERIES ====================

  async getBalance(address: string): Promise<BalanceInfo> {
    if (!this.api) throw new Error('Not connected')

    const { data } = (await this.api.query.system.account(address)) as any

    return {
      free: BigInt(data.free.toString()),
      reserved: BigInt(data.reserved.toString()),
      frozen: BigInt(data.frozen?.toString() || '0'),
      total: BigInt(data.free.toString()) + BigInt(data.reserved.toString()),
    }
  }

  async getBlockNumber(): Promise<number> {
    if (!this.api) throw new Error('Not connected')

    const header = await this.api.rpc.chain.getHeader()
    return header.number.toNumber()
  }

  async getNeuronets(): Promise<NeuronetInfo[]> {
    if (!this.api) throw new Error('Not connected')

    // Query all neuronets info - let errors propagate to show in UI
    const module = (this.api.query as any).aetensorModule || (this.api.query as any).subtensorModule
    const neuronetInfos = await module.networksAdded.entries()

    const neuronets: NeuronetInfo[] = []

    for (const [key, exists] of neuronetInfos) {
      if (exists.toString() === 'true') {
        const netuid = (key.args[0] as any).toNumber()

        try {
          const [identity, tempo, difficulty, maxNeurons, neuronCount] = await Promise.all([
            module.neuronetIdentity?.(netuid) || Promise.resolve(null),
            module.tempo(netuid),
            module.difficulty(netuid),
            module.maxAllowedUids(netuid),
            module.neuronetworkN(netuid),
          ])

          // Extract name from identity if available
          const name = identity?.neuronetName?.toString() || ''

          neuronets.push({
            netuid,
            name: name.toString() || `Neuronet ${netuid}`,
            emission: 0, // Would need additional query
            tempo: (tempo as any).toNumber(),
            difficulty: BigInt((difficulty as any).toString()),
            maxNeurons: (maxNeurons as any).toNumber(),
            currentNeurons: (neuronCount as any).toNumber(),
          })
        } catch {
          // Skip individual neuronets that fail to load
        }
      }
    }

    return neuronets.sort((a, b) => a.netuid - b.netuid)
  }

  async getStakeInfo(address: string): Promise<StakeInfo[]> {
    if (!this.api) throw new Error('Not connected')

    try {
      const stakes: StakeInfo[] = []
      const module = (this.api.query as any).aetensorModule || (this.api.query as any).subtensorModule

      // Get all stake entries for the coldkey
      const stakeEntries = await module.stake.entries(address)

      for (const [key, value] of stakeEntries) {
        const [, hotkey] = key.args
        const stake = BigInt((value as any).toString())

        if (stake > 0n) {
          // Try to get netuid for this hotkey
          const netuids = await module.isNetworkMember.entries(hotkey.toString())

          for (const [netKey, isMember] of netuids) {
            if (isMember.toString() === 'true') {
              const netuid = (netKey.args[1] as any).toNumber()

              stakes.push({
                hotkey: hotkey.toString(),
                coldkey: address,
                netuid,
                stake,
              })
            }
          }
        }
      }

      return stakes
    } catch (error) {
      console.error('Failed to get stake info:', error)
      return []
    }
  }

  // ==================== TRANSACTIONS ====================

  // Helper: submit signed transaction and wait for block inclusion
  private async submitAndWaitForBlock(
    tx: any
  ): Promise<{ success: boolean; hash?: string; error?: string }> {
    return new Promise((resolve) => {
      tx.send(({ status, dispatchError }: { status: any; dispatchError: any }) => {
        if (status.isInBlock || status.isFinalized) {
          if (dispatchError) {
            if (dispatchError.isModule && this.api) {
              const decoded = this.api.registry.findMetaError(dispatchError.asModule)
              resolve({
                success: false,
                error: `${decoded.section}.${decoded.name}: ${decoded.docs.join(' ')}`,
              })
              return
            }
            resolve({
              success: false,
              error: dispatchError.toString(),
            })
            return
          }

          resolve({
            success: true,
            hash: tx.hash.toHex(),
          })
        }
      }).catch((error: Error) => {
        resolve({
          success: false,
          error: error.message,
        })
      })
    })
  }

  async transfer(
    signer: { address: string; sign: (data: Uint8Array) => Promise<Uint8Array> },
    to: string,
    amount: bigint
  ): Promise<{ success: boolean; hash?: string; error?: string }> {
    if (!this.api) throw new Error('Not connected')

    try {
      const tx = this.api.tx.balances.transferKeepAlive(to, amount)

      // Get nonce
      const nonce = await this.api.rpc.system.accountNextIndex(signer.address)

      // Create signing payload
      const signPayload = this.api.registry.createType('SignerPayload', {
        method: tx.method,
        nonce,
        genesisHash: this.api.genesisHash,
        blockHash: this.api.genesisHash,
        runtimeVersion: this.api.runtimeVersion,
        version: this.api.extrinsicVersion,
      })

      const { data } = signPayload.toRaw()
      const rawSignature = await signer.sign(new Uint8Array(Buffer.from(data.slice(2), 'hex')))

      // Add signature to transaction (wrapped with Sr25519 type prefix)
      tx.addSignature(signer.address, wrapSignature(rawSignature), signPayload.toPayload())

      // Submit and wait for block inclusion
      return await this.submitAndWaitForBlock(tx)
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  }

  async addStake(
    signer: { address: string; sign: (data: Uint8Array) => Promise<Uint8Array> },
    hotkey: string,
    netuid: number,
    amount: bigint
  ): Promise<{ success: boolean; hash?: string; error?: string }> {
    if (!this.api) throw new Error('Not connected')

    try {
      // Try different extrinsic names
      const tx = (this.api.tx as any).aetensorModule?.addStake?.(hotkey, netuid, amount) ||
                 (this.api.tx as any).aetensorModule?.add_stake?.(hotkey, netuid, amount) ||
                 (this.api.tx as any).subtensorModule?.addStake?.(hotkey, netuid, amount)

      if (!tx) {
        throw new Error('Staking not available on this network')
      }

      const nonce = await this.api.rpc.system.accountNextIndex(signer.address)

      const signPayload = this.api.registry.createType('SignerPayload', {
        method: tx.method,
        nonce,
        genesisHash: this.api.genesisHash,
        blockHash: this.api.genesisHash,
        runtimeVersion: this.api.runtimeVersion,
        version: this.api.extrinsicVersion,
      })

      const { data } = signPayload.toRaw()
      const rawSignature = await signer.sign(new Uint8Array(Buffer.from(data.slice(2), 'hex')))

      tx.addSignature(signer.address, wrapSignature(rawSignature), signPayload.toPayload())

      return await this.submitAndWaitForBlock(tx)
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  }

  async removeStake(
    signer: { address: string; sign: (data: Uint8Array) => Promise<Uint8Array> },
    hotkey: string,
    netuid: number,
    amount: bigint
  ): Promise<{ success: boolean; hash?: string; error?: string }> {
    if (!this.api) throw new Error('Not connected')

    try {
      // Try different extrinsic names
      const tx = (this.api.tx as any).aetensorModule?.removeStake?.(hotkey, netuid, amount) ||
                 (this.api.tx as any).aetensorModule?.remove_stake?.(hotkey, netuid, amount) ||
                 (this.api.tx as any).subtensorModule?.removeStake?.(hotkey, netuid, amount)

      if (!tx) {
        throw new Error('Unstaking not available on this network')
      }

      const nonce = await this.api.rpc.system.accountNextIndex(signer.address)

      const signPayload = this.api.registry.createType('SignerPayload', {
        method: tx.method,
        nonce,
        genesisHash: this.api.genesisHash,
        blockHash: this.api.genesisHash,
        runtimeVersion: this.api.runtimeVersion,
        version: this.api.extrinsicVersion,
      })

      const { data } = signPayload.toRaw()
      const rawSignature = await signer.sign(new Uint8Array(Buffer.from(data.slice(2), 'hex')))

      tx.addSignature(signer.address, wrapSignature(rawSignature), signPayload.toPayload())

      return await this.submitAndWaitForBlock(tx)
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  }

  async moveStake(
    signer: { address: string; sign: (data: Uint8Array) => Promise<Uint8Array> },
    srcHotkey: string,
    destHotkey: string,
    netuid: number,
    amount: bigint
  ): Promise<{ success: boolean; hash?: string; error?: string }> {
    if (!this.api) throw new Error('Not connected')

    try {
      // Try different extrinsic names
      const tx = (this.api.tx as any).aetensorModule?.moveStake?.(srcHotkey, destHotkey, netuid, amount) ||
                 (this.api.tx as any).aetensorModule?.move_stake?.(srcHotkey, destHotkey, netuid, amount) ||
                 (this.api.tx as any).subtensorModule?.moveStake?.(srcHotkey, destHotkey, netuid, amount)

      if (!tx) {
        throw new Error('Move stake not available on this network')
      }

      const nonce = await this.api.rpc.system.accountNextIndex(signer.address)

      const signPayload = this.api.registry.createType('SignerPayload', {
        method: tx.method,
        nonce,
        genesisHash: this.api.genesisHash,
        blockHash: this.api.genesisHash,
        runtimeVersion: this.api.runtimeVersion,
        version: this.api.extrinsicVersion,
      })

      const { data } = signPayload.toRaw()
      const rawSignature = await signer.sign(new Uint8Array(Buffer.from(data.slice(2), 'hex')))

      tx.addSignature(signer.address, wrapSignature(rawSignature), signPayload.toPayload())

      return await this.submitAndWaitForBlock(tx)
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  }

  // ==================== FEE ESTIMATION ====================

  async getTransferFee(from: string, to: string, amount: bigint): Promise<bigint> {
    if (!this.api) throw new Error('Not connected')

    try {
      const tx = this.api.tx.balances.transferKeepAlive(to, amount)
      const info = await tx.paymentInfo(from)
      return BigInt(info.partialFee.toString())
    } catch (error) {
      console.error('Failed to estimate fee:', error)
      // Return default estimate (~0.001 AET)
      return BigInt(1_000_000)
    }
  }

  // ==================== TRANSACTION HISTORY ====================

  // Get transfers from Explorer API (faster and more reliable)
  private async getTransfersFromExplorer(
    address: string,
    limit: number = 20
  ): Promise<{
    hash: string
    type: 'sent' | 'received'
    amount: string
    counterparty: string
    blockNumber: number
    timestamp: number
    status: 'confirmed'
  }[]> {
    // Only works for mainnet/testnet, not custom networks
    if (!this.currentNetwork || this.currentNetwork.id.startsWith('custom')) {
      return []
    }

    const networkPath = this.currentNetwork.id === 'test' ? 'testnet' : 'mainnet'
    const url = `https://api-explorer.aetron.io/${networkPath}/api/transfers?limit=${limit}&offset=0&orderBy=timestamp:desc&account=${address}`

    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Explorer API error: ${response.status}`)
    }

    const data = await response.json()
    if (!data.data || !Array.isArray(data.data)) {
      return []
    }

    return data.data.map((item: any) => ({
      hash: item.extrinsicHash || item.hash || item.id || '',
      type: item.from === address ? 'sent' : 'received',
      amount: String(item.amount || '0'),
      counterparty: item.from === address ? item.to : item.from,
      blockNumber: item.blockNumber || 0,
      timestamp: item.timestamp ? new Date(item.timestamp).getTime() : Date.now(),
      status: 'confirmed' as const,
    }))
  }

  // Fallback: scan blocks directly
  private async getTransfersFromBlocks(
    address: string,
    limit: number = 20
  ): Promise<{
    hash: string
    type: 'sent' | 'received'
    amount: string
    counterparty: string
    blockNumber: number
    timestamp: number
    status: 'confirmed'
  }[]> {
    if (!this.api) return []

    const transfers: {
      hash: string
      type: 'sent' | 'received'
      amount: string
      counterparty: string
      blockNumber: number
      timestamp: number
      status: 'confirmed'
    }[] = []

    const currentHeader = await this.api.rpc.chain.getHeader()
    const currentBlock = currentHeader.number.toNumber()

    // Scan last 25 blocks only
    const blocksToScan = Math.min(25, currentBlock)
    const startBlock = currentBlock - blocksToScan

    for (let blockNum = currentBlock; blockNum > startBlock && transfers.length < limit; blockNum--) {
      try {
        const blockHash = await this.api.rpc.chain.getBlockHash(blockNum)
        const signedBlock = await this.api.rpc.chain.getBlock(blockHash)

        for (const extrinsic of signedBlock.block.extrinsics) {
          const { method, signer } = extrinsic
          const section = method.section
          const methodName = method.method

          if (section === 'balances' && ['transfer', 'transferKeepAlive', 'transferAllowDeath'].includes(methodName)) {
            const signerAddress = signer.toString()
            const args = method.args
            const dest = args[0]?.toString()
            const amount = args[1]?.toString()

            if (!dest || !amount) continue

            if (signerAddress === address) {
              transfers.push({
                hash: extrinsic.hash.toHex(),
                type: 'sent',
                amount,
                counterparty: dest,
                blockNumber: blockNum,
                timestamp: Date.now() - (currentBlock - blockNum) * 12000,
                status: 'confirmed',
              })
            } else if (dest === address) {
              transfers.push({
                hash: extrinsic.hash.toHex(),
                type: 'received',
                amount,
                counterparty: signerAddress,
                blockNumber: blockNum,
                timestamp: Date.now() - (currentBlock - blockNum) * 12000,
                status: 'confirmed',
              })
            }
          }
        }
      } catch {
        continue
      }
    }

    return transfers.slice(0, limit)
  }

  async getTransfers(
    address: string,
    limit: number = 20
  ): Promise<{
    hash: string
    type: 'sent' | 'received'
    amount: string
    counterparty: string
    blockNumber: number
    timestamp: number
    status: 'confirmed'
  }[]> {
    const TIMEOUT = 10000

    try {
      // Try Explorer API first (faster and more history)
      const explorerResult = await Promise.race([
        this.getTransfersFromExplorer(address, limit),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Explorer timeout')), 5000)
        ),
      ])
      // Return Explorer result even if empty (success means API works)
      return explorerResult
    } catch (error) {
      console.log('Explorer API failed, falling back to block scanning:', error)
    }

    // Fallback to block scanning
    if (!this.api) return []

    try {
      const result = await Promise.race([
        this.getTransfersFromBlocks(address, limit),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Block scan timeout')), TIMEOUT)
        ),
      ])
      return result
    } catch (error) {
      console.error('Failed to get transfers:', error)
      return []
    }
  }

  // ==================== NETWORK TESTING ====================

  async testConnection(url: string): Promise<boolean> {
    try {
      const testProvider = new WsProvider(url, false)

      const connected = await new Promise<boolean>((resolve) => {
        const timeoutId = setTimeout(() => {
          testProvider.disconnect()
          resolve(false)
        }, 5000)

        testProvider.on('connected', () => {
          clearTimeout(timeoutId)
          testProvider.disconnect()
          resolve(true)
        })

        testProvider.on('error', () => {
          clearTimeout(timeoutId)
          testProvider.disconnect()
          resolve(false)
        })

        testProvider.connect()
      })

      return connected
    } catch {
      return false
    }
  }

  // ==================== ENHANCED STAKING API ====================

  // Get all stake info for a coldkey using RuntimeAPI (efficient - single call for all neuronets)
  async getStakeInfoForColdkey(coldkeyAddress: string): Promise<StakeInfoDetailed[]> {
    if (!this.api) throw new Error('Not connected')

    try {
      const runtimeApi = (this.api.call as any).stakeInfoRuntimeApi
      if (!runtimeApi?.getStakeInfoForColdkey) {
        console.warn('stakeInfoRuntimeApi not available, falling back to manual method')
        return []
      }

      const result = await runtimeApi.getStakeInfoForColdkey(coldkeyAddress)
      const data = result?.toJSON?.() || result

      if (!data || !Array.isArray(data)) {
        console.warn('getStakeInfoForColdkey returned no data')
        return []
      }

      return data
        .filter((item: any) => {
          const stake = BigInt(item?.stake || '0')
          return stake > 0n
        })
        .map((item: any) => ({
          hotkey: item.hotkey || '',
          coldkey: item.coldkey || coldkeyAddress,
          netuid: item.netuid || 0,
          stake: BigInt(item.stake || '0'),
          locked: BigInt(item.locked || '0'),
          emission: BigInt(item.emission || '0'),
          aetEmission: BigInt(item.aetEmission || item.aet_emission || '0'),
          drain: item.drain || 0,
          isRegistered: item.isRegistered ?? item.is_registered ?? false,
        }))
    } catch (error) {
      console.error('Error getting stake info for coldkey:', error)
      return []
    }
  }

  // Get current neuronet price (QUANT/AET rate from swap pool)
  async getNeuronetPrice(netuid: number): Promise<number> {
    if (!this.api) throw new Error('Not connected')

    try {
      const swap = (this.api.query as any).swap
      if (!swap?.quantSqrtPrice) return 1

      const sqrtPriceRaw = await swap.quantSqrtPrice(netuid)
      const sqrtPrice = Number(sqrtPriceRaw?.toString() || '0') / 1_000_000_000_000 // Fixed point conversion
      return sqrtPrice * sqrtPrice
    } catch (error) {
      console.error('Error getting neuronet price:', error)
      return 1
    }
  }

  // Get all neuronets info using Runtime API
  async getAllNeuronetsInfo(): Promise<NeuronetInfoDetailed[]> {
    if (!this.api) throw new Error('Not connected')

    try {
      const runtimeApi = (this.api.call as any).neuronetInfoRuntimeApi
      if (!runtimeApi) {
        console.warn('neuronetInfoRuntimeApi not available')
        return []
      }

      // Use getAllDynamicInfo for comprehensive data on all neuronets
      const dynamicInfoResult = await runtimeApi.getAllDynamicInfo?.()
      const dynamicInfos = dynamicInfoResult?.toJSON?.() || dynamicInfoResult

      if (!dynamicInfos || !Array.isArray(dynamicInfos)) {
        console.warn('getAllDynamicInfo returned no data')
        return []
      }

      // Also get neuronets info for additional fields
      const neuronetsInfoResult = await runtimeApi.getNeuronetsInfo?.().catch(() => null)
      const neuronetsInfo = neuronetsInfoResult?.toJSON?.() || neuronetsInfoResult
      const neuronetsMap = new Map<number, any>()
      if (Array.isArray(neuronetsInfo)) {
        for (const n of neuronetsInfo) {
          if (n?.netuid !== undefined) {
            neuronetsMap.set(n.netuid, n)
          }
        }
      }

      // Decode name from bytes array
      const decodeName = (bytes: number[] | null, netuid: number): string => {
        if (!bytes || !Array.isArray(bytes)) return `Neuronet ${netuid}`
        return String.fromCharCode(...bytes)
      }

      const decodeSymbol = (bytes: number[] | null): string => {
        if (!bytes || !Array.isArray(bytes)) return ''
        return String.fromCharCode(...bytes)
      }

      return dynamicInfos.map((d: any) => {
        const netuid = d.netuid
        const info = neuronetsMap.get(netuid)

        const totalStake = BigInt(d.quantIn || 0) + BigInt(d.aetIn || 0)
        const quantIn = BigInt(d.quantIn || 0)
        const aetIn = BigInt(d.aetIn || 0)
        const aetInEmission = BigInt(d.aetInEmission || d.aet_in_emission || 0)

        return {
          netuid,
          name: decodeName(d.neuronetName, netuid),
          emission: Number(d.emission || info?.emissionValues || 0) / 1_000_000_000,
          tempo: d.tempo || info?.tempo || 360,
          difficulty: BigInt(info?.difficulty || 0),
          maxNeurons: info?.maxAllowedUids || 256,
          currentNeurons: info?.neuronetworkN || 0,
          totalStake,
          totalStakeFormatted: Number(totalStake) / 1_000_000_000,
          quantIn,
          quantInFormatted: Number(quantIn) / 1_000_000_000,
          aetIn,
          aetInFormatted: Number(aetIn) / 1_000_000_000,
          aetInEmission,
          aetInEmissionFormatted: Number(aetInEmission) / 1_000_000_000,
          owner: d.ownerColdkey || info?.owner || null,
          ownerHotkey: d.ownerHotkey || null,
          tokenSymbol: decodeSymbol(d.tokenSymbol),
          registrationAllowed: true,
          emissionStarted: (d.emission || 0) > 0,
          firstEmissionBlock: null,
        }
      })
    } catch (error) {
      console.error('Error getting all neuronets info:', error)
      return []
    }
  }

  // Get all registered hotkeys (validators) on a neuronet
  async getNeuronetHotkeys(netuid: number): Promise<ValidatorHotkey[]> {
    if (!this.api) throw new Error('Not connected')

    try {
      const module = (this.api.query as any).aetensorModule || (this.api.query as any).subtensorModule
      if (!module) return []

      // Get the number of neurons on this neuronet
      const neuronetN = await module.neuronetworkN?.(netuid)
      const numNeurons = neuronetN?.toNumber?.() || 0

      if (numNeurons === 0) return []

      const hotkeys: ValidatorHotkey[] = []

      // Get hotkeys for each UID
      for (let uid = 0; uid < numNeurons; uid++) {
        try {
          const hotkeyResult = await module.keys?.(netuid, uid)
          if (hotkeyResult && !hotkeyResult.isEmpty) {
            const hotkey = hotkeyResult.toString()

            // Get total stake for this hotkey
            const stakeResult = await module.totalHotkeyQuant?.(hotkey) || await module.totalHotkeyStake?.(hotkey)
            const stake = stakeResult ? BigInt(stakeResult.toString()) : 0n

            hotkeys.push({
              hotkey,
              uid,
              stake,
            })
          }
        } catch (err) {
          console.warn(`Failed to get hotkey for uid ${uid}:`, err)
        }
      }

      return hotkeys
    } catch (error) {
      console.error('Error getting neuronet hotkeys:', error)
      return []
    }
  }

  // Add stake with limit price (Safe Mode) - prevents frontrunning
  async addStakeLimit(
    signer: { address: string; sign: (data: Uint8Array) => Promise<Uint8Array> },
    hotkey: string,
    netuid: number,
    amount: bigint,
    limitPrice: bigint,
    allowPartial: boolean = true
  ): Promise<{ success: boolean; hash?: string; error?: string }> {
    if (!this.api) throw new Error('Not connected')

    try {
      const tx = (this.api.tx as any).aetensorModule?.addStakeLimit?.(
        hotkey,
        netuid,
        amount,
        limitPrice,
        allowPartial
      ) || (this.api.tx as any).subtensorModule?.addStakeLimit?.(
        hotkey,
        netuid,
        amount,
        limitPrice,
        allowPartial
      )

      if (!tx) {
        // Fall back to regular addStake if limit not available
        console.warn('addStakeLimit not available, falling back to addStake')
        return this.addStake(signer, hotkey, netuid, amount)
      }

      const nonce = await this.api.rpc.system.accountNextIndex(signer.address)

      const signPayload = this.api.registry.createType('SignerPayload', {
        method: tx.method,
        nonce,
        genesisHash: this.api.genesisHash,
        blockHash: this.api.genesisHash,
        runtimeVersion: this.api.runtimeVersion,
        version: this.api.extrinsicVersion,
      })

      const { data } = signPayload.toRaw()
      const rawSignature = await signer.sign(new Uint8Array(Buffer.from(data.slice(2), 'hex')))

      tx.addSignature(signer.address, wrapSignature(rawSignature), signPayload.toPayload())

      const hash = await tx.send()

      return { success: true, hash: hash.toHex() }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  }
}

export const connectionManager = new ConnectionManager()
