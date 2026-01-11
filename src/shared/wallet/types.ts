// Wallet types and interfaces

export type WalletType = 'hd' | 'privateKey' | 'keystore' | 'multisig' | 'watch' | 'dev'

export interface WalletAccount {
  id: string
  name: string
  address: string
  type: WalletType
  createdAt: number
  updatedAt: number
  // For HD wallets
  derivationPath?: string
  accountIndex?: number
  // For multisig
  multisigConfig?: MultisigConfig
  // Metadata
  tags?: string[]
  isHidden?: boolean
}

export interface MultisigConfig {
  threshold: number // Required signatures
  signatories: string[] // List of signatory addresses
  // For proxy-based multisig
  proxyAddress?: string
  proxyType?: 'Any' | 'NonTransfer' | 'Governance' | 'Staking'
}

export interface EncryptedWallet {
  id: string
  version: number
  type: WalletType
  name: string
  address: string
  // Encrypted data (contains private key or mnemonic)
  encrypted: {
    ciphertext: string
    iv: string
    salt: string
    algorithm: 'aes-256-gcm'
    kdf: 'pbkdf2'
    kdfParams: {
      iterations: number
      hash: string
    }
  }
  // For HD wallets
  derivationPath?: string
  // For keystore wallets - encrypted original keystore password
  keystorePassword?: {
    ciphertext: string
    iv: string
    salt: string
    algorithm: 'aes-256-gcm'
    kdf: 'pbkdf2'
    kdfParams: {
      iterations: number
      hash: string
    }
  }
  // For multisig
  multisigConfig?: MultisigConfig
  // Metadata
  createdAt: number
  updatedAt: number
}

export interface WalletStore {
  version: number
  wallets: EncryptedWallet[]
  activeWalletId: string | null
  settings: WalletStoreSettings
}

export interface WalletStoreSettings {
  autoLockTimeout: number // minutes, 0 = never
  requirePasswordOnSend: boolean
  showTestNetworks: boolean
  customNodeUrl?: string // Custom RPC endpoint (ws:// or wss://)
  language: string // 'en' | 'ru' | 'zh'
  selectedNetworkId?: string
}

// Hotkey is a subordinate key used for signing on neuronets
export interface Hotkey {
  id: string
  name: string
  address: string
  coldkeyId: string // Parent wallet ID
  // Registration info
  registeredNeuronets: number[]
  createdAt: number
  // Backup status
  backedUp: boolean
}

// Extended interface returned when creating a hotkey (includes mnemonic for backup)
export interface CreatedHotkey extends Hotkey {
  mnemonic: string // Only available at creation time - user must back this up!
}

export interface EncryptedHotkey {
  id: string
  name: string
  address: string
  coldkeyId: string
  encrypted: {
    ciphertext: string
    iv: string
    salt: string
    algorithm: 'aes-256-gcm'
    kdf: 'pbkdf2'
    kdfParams: {
      iterations: number
      hash: string
    }
  }
  registeredNeuronets: number[]
  createdAt: number
  backedUp: boolean
}

// Transaction types
export interface UnsignedTransaction {
  method: string
  args: unknown[]
  tip?: bigint
  nonce?: number
}

export interface SignedTransaction {
  hash: string
  signature: string
  signer: string
}

// Multisig transaction
export interface MultisigTransaction {
  id: string
  callHash: string
  callData: string
  creator: string
  approvals: string[]
  threshold: number
  when: {
    height: number
    index: number
  }
  status: 'pending' | 'executed' | 'cancelled'
  createdAt: number
}
