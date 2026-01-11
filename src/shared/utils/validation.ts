import { decodeAddress } from '@polkadot/util-crypto'

// ==================== SS58 ADDRESS VALIDATION ====================

export interface AddressValidation {
  isValid: boolean
  error?: string
}

/**
 * Validates SS58 address format used by Substrate-based chains
 * @param address - The address to validate
 * @returns Validation result with isValid flag and optional error message
 */
export const validateSS58Address = (address: string): AddressValidation => {
  if (!address || !address.trim()) {
    return { isValid: false, error: 'Address is required' }
  }

  const trimmedAddress = address.trim()

  // SS58 addresses use base58 characters (excluding 0, O, I, l)
  if (!/^[1-9A-HJ-NP-Za-km-z]+$/.test(trimmedAddress)) {
    return { isValid: false, error: 'Invalid address format' }
  }

  // Typical Substrate address length is 47-48 characters
  if (trimmedAddress.length < 45 || trimmedAddress.length > 50) {
    return { isValid: false, error: 'Invalid address length' }
  }

  try {
    // Attempt to decode the address using Polkadot utilities
    decodeAddress(trimmedAddress)
    return { isValid: true }
  } catch {
    return { isValid: false, error: 'Invalid SS58 address' }
  }
}

// ==================== PASSWORD VALIDATION ====================

export type PasswordStrengthLevel = 'weak' | 'fair' | 'good' | 'strong';

export interface PasswordValidation {
  isValid: boolean;
  errors: string[];
}

export interface PasswordStrength {
  level: number;  // 0-4
  label: PasswordStrengthLevel;
  color: string;
}

/**
 * Validates password against complexity requirements:
 * - Minimum 8 characters
 * - At least one uppercase letter (A-Z)
 * - At least one digit (0-9)
 * - At least one special character
 */
export const validatePassword = (password: string): PasswordValidation => {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('minLength');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('uppercase');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('digit');
  }
  if (!/[!@#$%^&*()_+\-=\[\]{}|;':",./<>?\\`~]/.test(password)) {
    errors.push('special');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Calculates password strength based on various criteria
 * Returns level (0-4), label, and color for UI indicator
 */
export const getPasswordStrength = (password: string): PasswordStrength => {
  if (!password) {
    return { level: 0, label: 'weak', color: '#ef4444' };
  }

  let score = 0;

  // Length checks
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (password.length >= 16) score++;

  // Character type checks
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  // Map score (0-7) to level (0-4)
  const level = Math.min(4, Math.floor(score * 4 / 7));

  const labels: PasswordStrengthLevel[] = ['weak', 'weak', 'fair', 'good', 'strong'];
  const colors = ['#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e'];

  return {
    level,
    label: labels[level],
    color: colors[level]
  };
};

// Password error messages
export const PASSWORD_ERROR_MESSAGES: Record<string, string> = {
  minLength: 'Password must be at least 8 characters',
  uppercase: 'Password must contain at least one uppercase letter',
  digit: 'Password must contain at least one number',
  special: 'Password must contain at least one special character'
};

// Password strength labels
export const PASSWORD_STRENGTH_LABELS: Record<PasswordStrengthLevel, string> = {
  weak: 'Weak',
  fair: 'Fair',
  good: 'Good',
  strong: 'Strong'
};
