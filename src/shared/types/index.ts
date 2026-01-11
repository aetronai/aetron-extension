// Balance units: 1 AET = 10^9 RET
export const RAO_PER_TAO = 1_000_000_000n;

export interface WalletInfo {
  name: string;
  address: string;
  publicKey: string;
  encrypted: boolean;
  createdAt: Date;
}

export interface HotkeyInfo {
  name: string;
  address: string;
  publicKey: string;
  coldkey: string;
}

export interface BalanceInfo {
  free: bigint;
  reserved: bigint;
  frozen: bigint;
  total: bigint;
}

export interface NeuronInfo {
  hotkey: string;
  coldkey: string;
  uid: number;
  netuid: number;
  stake: bigint;
  rank: number;
  trust: number;
  consensus: number;
  incentive: number;
  dividends: number;
  emission: bigint;
  isActive: boolean;
}

export interface StakeInfo {
  hotkey: string;
  coldkey: string;
  netuid: number;
  stake: bigint;
}

// Extended stake info from RuntimeAPI with rewards/emission data
export interface StakeInfoDetailed {
  hotkey: string;
  coldkey: string;
  netuid: number;
  stake: bigint;
  locked: bigint;
  emission: bigint;
  aetEmission: bigint;
  drain: number;
  isRegistered: boolean;
}

// UI-friendly stake info with calculated fields
export interface StakeDisplay {
  hotkey: string;
  hotkeyName: string;
  netuid: number;
  neuronetName: string;
  stake: number;
  stakeRaw: bigint;
  rewards: number;
  emission: number;
  tempo: number;
  apy: number;
  price: number;
  emissionPerBlock: number;
}

// Validator hotkey info for neuronet
export interface ValidatorHotkey {
  hotkey: string;
  uid: number;
  stake: bigint;
}

export interface NeuronetInfo {
  netuid: number;
  name: string;
  emission: number;
  tempo: number;
  difficulty: bigint;
  maxNeurons: number;
  currentNeurons: number;
}

// Extended neuronet info with liquidity pool data
export interface NeuronetInfoDetailed extends NeuronetInfo {
  totalStake: bigint;
  totalStakeFormatted: number;
  quantIn: bigint;
  quantInFormatted: number;
  aetIn: bigint;
  aetInFormatted: number;
  aetInEmission: bigint;
  aetInEmissionFormatted: number;
  owner: string | null;
  ownerHotkey: string | null;
  tokenSymbol: string;
  registrationAllowed: boolean;
  emissionStarted: boolean;
  firstEmissionBlock: number | null;
}

export interface DelegateInfo {
  hotkey: string;
  name: string;
  url: string;
  description: string;
  take: number;
  totalStake: bigint;
}

export interface NetworkConfig {
  id: string;
  name: string;
  url: string;
}

export const NETWORKS: Record<string, NetworkConfig> = {
  mainnet: {
    id: "mainnet",
    name: "Mainnet",
    url: "wss://entrypoint-mainnet.aetron.ai:443",
  },
  test: {
    id: "test",
    name: "Test Network",
    url: "wss://entrypoint-test.aetron.ai:443",
  },
  local: {
    id: "local",
    name: "Local Node",
    url: "ws://127.0.0.1:9944",
  },
};

export class Balance {
  private rao: bigint;

  constructor(rao: bigint) {
    this.rao = rao;
  }

  static fromAet(aet: number): Balance {
    return new Balance(BigInt(Math.floor(aet * Number(RAO_PER_TAO))));
  }

  static fromRet(ret: bigint): Balance {
    return new Balance(ret);
  }

  toAet(): number {
    return Number(this.rao) / Number(RAO_PER_TAO);
  }

  toRet(): bigint {
    return this.rao;
  }

  format(decimals = 2): string {
    return this.toAet().toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }

  add(other: Balance): Balance {
    return new Balance(this.rao + other.rao);
  }

  subtract(other: Balance): Balance {
    return new Balance(this.rao - other.rao);
  }

  isGreaterThan(other: Balance): boolean {
    return this.rao > other.rao;
  }

  isLessThan(other: Balance): boolean {
    return this.rao < other.rao;
  }

  isZero(): boolean {
    return this.rao === 0n;
  }
}

export interface TransactionResult {
  success: boolean;
  hash?: string;
  blockNumber?: number;
  error?: string;
}

export interface TransactionInfo {
  hash: string;
  type: string;
  from: string;
  to?: string;
  amount?: bigint;
  fee: bigint;
  timestamp: Date;
  status: "pending" | "confirmed" | "failed";
  blockNumber?: number;
}

export interface Transfer {
  hash: string;
  type: 'sent' | 'received';
  amount: string;
  counterparty: string;
  blockNumber: number;
  timestamp: number;
  status: 'confirmed';
}

export interface RecentAddress {
  address: string;
  lastUsed: number;
  label?: string;
}
