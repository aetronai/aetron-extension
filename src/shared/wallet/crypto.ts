// Cryptographic utilities for wallet encryption
// Using native Web Crypto API for cross-browser compatibility

import { mnemonicGenerate, mnemonicValidate } from '@polkadot/util-crypto'

// Encryption parameters (following industry standards)
const PBKDF2_ITERATIONS = 900000 // MetaMask standard
const SALT_BYTES = 32
const IV_BYTES = 12 // GCM standard

/**
 * Convert Uint8Array to base64 string using native browser API
 */
function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

/**
 * Convert base64 string to Uint8Array using native browser API
 */
function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64)
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  return bytes
}

/**
 * Derive encryption key from password using PBKDF2
 */
async function deriveKey(
  password: string,
  salt: Uint8Array,
  iterations: number = PBKDF2_ITERATIONS
): Promise<CryptoKey> {
  const encoder = new TextEncoder()
  const passwordBytes = encoder.encode(password)

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passwordBytes,
    'PBKDF2',
    false,
    ['deriveKey']
  )

  // Create a copy of salt buffer to ensure it's a proper ArrayBuffer
  const saltBuffer = new Uint8Array(salt).buffer as ArrayBuffer

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBuffer,
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

/**
 * Encrypt data with password using AES-256-GCM
 */
export async function encrypt(
  data: string,
  password: string
): Promise<{
  ciphertext: string
  iv: string
  salt: string
  algorithm: 'aes-256-gcm'
  kdf: 'pbkdf2'
  kdfParams: { iterations: number; hash: string }
}> {
  const encoder = new TextEncoder()
  const dataBytes = encoder.encode(data)

  // Generate random salt and IV
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES))
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES))

  // Derive key
  const key = await deriveKey(password, salt)

  // Encrypt
  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: new Uint8Array(iv).buffer as ArrayBuffer },
    key,
    dataBytes
  )

  const encryptedBytes = new Uint8Array(encryptedBuffer)

  const result = {
    ciphertext: uint8ArrayToBase64(encryptedBytes),
    iv: uint8ArrayToBase64(iv),
    salt: uint8ArrayToBase64(salt),
    algorithm: 'aes-256-gcm' as const,
    kdf: 'pbkdf2' as const,
    kdfParams: {
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
  }

  console.log('[Crypto] encrypt result:', {
    saltPrefix: result.salt.substring(0, 10) + '...',
    ivPrefix: result.iv.substring(0, 10) + '...',
  })

  return result
}

/**
 * Decrypt data with password using AES-256-GCM
 */
export async function decrypt(
  encryptedData: {
    ciphertext: string
    iv: string
    salt: string
    kdfParams?: { iterations?: number; hash?: string }
  },
  password: string
): Promise<string> {
  console.log('[Crypto] decrypt input:', {
    saltPrefix: encryptedData.salt?.substring(0, 10) + '...',
    ivPrefix: encryptedData.iv?.substring(0, 10) + '...',
  })

  const ciphertext = base64ToUint8Array(encryptedData.ciphertext)
  const iv = base64ToUint8Array(encryptedData.iv)
  const salt = base64ToUint8Array(encryptedData.salt)
  const iterations = encryptedData.kdfParams?.iterations || PBKDF2_ITERATIONS

  // Derive key with same parameters
  const key = await deriveKey(password, salt, iterations)

  // Decrypt - ensure proper ArrayBuffer types
  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(iv).buffer as ArrayBuffer },
    key,
    new Uint8Array(ciphertext).buffer as ArrayBuffer
  )

  const decoder = new TextDecoder()
  const result = decoder.decode(decryptedBuffer)

  console.log('[Crypto] decrypt successful')
  return result
}

/**
 * Generate a secure random mnemonic
 */
export function generateMnemonicPhrase(wordCount: 12 | 24 = 12): string {
  return mnemonicGenerate(wordCount)
}

/**
 * Validate mnemonic phrase
 */
export function validateMnemonicPhrase(mnemonic: string): boolean {
  return mnemonicValidate(mnemonic)
}

/**
 * Hash password for verification (not for encryption)
 */
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = new Uint8Array(hashBuffer)
  return uint8ArrayToBase64(hashArray)
}

/**
 * Verify password by attempting to decrypt test data
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  try {
    const currentHash = await hashPassword(password)
    return currentHash === storedHash
  } catch {
    return false
  }
}
