import { describe, it, expect } from 'vitest';
import {
  // Types and constants
  EVMAddress,
  EVMTransactionHash,
  SolanaTransactionHash,
  ZERO_ADDRESS,
  ZERO_TRANSACTION_HASH,
  
  // Type guard functions
  isValidHexString,
  isEVMAddress,
  isEVMTransactionHash,
  isSolanaTransactionHash,
  
  // Validation functions
  validateEVMAddress,
  validateEVMTransactionHash,
  validateSolanaTransactionHash,
  
  // Safe conversion functions
  safeEVMAddress,
  safeEVMTransactionHash,
  safeSolanaTransactionHash,
  safeEVMAddressOrZeroAddress,
  safeEVMTransactionHashOrZeroTransactionHash,
  
  // Utility functions
  addressesEqual,
  isZeroAddress,
  assertEVMAddress,
  assertEVMTransactionHash
} from '../address';

describe('address', () => {
  // Test data constants
  const VALID_EVM_ADDRESS = '0x742d35cc6635c0532925a3b8d5c9828f2f7b0da0';
  const VALID_EVM_ADDRESS_UPPERCASE = '0x742D35CC6635C0532925A3B8D5C9828F2F7B0DA0';
  const VALID_EVM_ADDRESS_MIXED_CASE = '0x742d35Cc6635c0532925A3b8d5C9828F2f7B0Da0';
  const VALID_TRANSACTION_HASH = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
  const VALID_SOLANA_HASH = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz123456789ABCDEFGHJKLMNPQRSTab';
  const INVALID_SHORT_ADDRESS = '0x742d35cc6635c0532925a3b8d5c9828';
  const INVALID_LONG_ADDRESS = '0x742d35cc6635c0532925a3b8d5c9828f2f7b0da012345';
  const INVALID_NO_PREFIX_ADDRESS = '742d35cc6635c0532925a3b8d5c9828f2f7b0da0';
  const INVALID_NON_HEX_ADDRESS = '0x742g35cc6635c0532925a3b8d5c9828f2f7b0da0';

  describe('Constants', () => {
    it('should have correct zero address format', () => {
      expect(ZERO_ADDRESS).toBe('0x0000000000000000000000000000000000000000');
      expect(ZERO_ADDRESS.length).toBe(42);
      expect(isEVMAddress(ZERO_ADDRESS)).toBe(true);
    });

    it('should have correct zero transaction hash format', () => {
      expect(ZERO_TRANSACTION_HASH).toBe('0x0000000000000000000000000000000000000000000000000000000000000000');
      expect(ZERO_TRANSACTION_HASH.length).toBe(66);
      expect(isEVMTransactionHash(ZERO_TRANSACTION_HASH)).toBe(true);
    });
  });

  describe('isValidHexString', () => {
    it('should validate hex strings with 0x prefix', () => {
      expect(isValidHexString('0x123abc')).toBe(true);
      expect(isValidHexString('0x123ABC')).toBe(true);
      expect(isValidHexString('0x0000')).toBe(true);
      expect(isValidHexString('0x')).toBe(true); // Empty hex is valid
    });

    it('should reject non-hex strings', () => {
      expect(isValidHexString('0x123g')).toBe(false);
      expect(isValidHexString('123abc')).toBe(false); // No prefix
      expect(isValidHexString('0xzzz')).toBe(false);
      expect(isValidHexString('')).toBe(false);
    });

    it('should handle edge cases', () => {
      expect(isValidHexString('0x ')).toBe(false); // Space after prefix
      expect(isValidHexString('0X123')).toBe(false); // Uppercase X
      expect(isValidHexString('  0x123  ')).toBe(false); // Whitespace
    });
  });

  describe('isEVMAddress', () => {
    it('should validate correct EVM addresses', () => {
      expect(isEVMAddress(VALID_EVM_ADDRESS)).toBe(true);
      expect(isEVMAddress(VALID_EVM_ADDRESS_UPPERCASE)).toBe(true);
      expect(isEVMAddress(VALID_EVM_ADDRESS_MIXED_CASE)).toBe(true);
      expect(isEVMAddress(ZERO_ADDRESS)).toBe(true);
    });

    it('should reject invalid addresses', () => {
      expect(isEVMAddress(INVALID_SHORT_ADDRESS)).toBe(false);
      expect(isEVMAddress(INVALID_LONG_ADDRESS)).toBe(false);
      expect(isEVMAddress(INVALID_NO_PREFIX_ADDRESS)).toBe(false);
      expect(isEVMAddress(INVALID_NON_HEX_ADDRESS)).toBe(false);
    });

    it('should handle edge cases', () => {
      expect(isEVMAddress('')).toBe(false);
      expect(isEVMAddress('0x')).toBe(false);
      expect(isEVMAddress('0x000')).toBe(false);
      expect(isEVMAddress(null as unknown as string)).toBe(false);
      expect(isEVMAddress(undefined as unknown as string)).toBe(false);
    });

    it('should handle type guard correctly', () => {
      const testValue: string = VALID_EVM_ADDRESS;
      if (isEVMAddress(testValue)) {
        // TypeScript should recognize testValue as EVMAddress here
        const address: EVMAddress = testValue;
        expect(address).toBe(VALID_EVM_ADDRESS);
      }
    });
  });

  describe('isEVMTransactionHash', () => {
    it('should validate correct transaction hashes', () => {
      expect(isEVMTransactionHash(VALID_TRANSACTION_HASH)).toBe(true);
      expect(isEVMTransactionHash(ZERO_TRANSACTION_HASH)).toBe(true);
    });

    it('should reject invalid transaction hashes', () => {
      expect(isEVMTransactionHash('0x1234')).toBe(false); // Too short
      expect(isEVMTransactionHash('0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef12')).toBe(false); // Too long
      expect(isEVMTransactionHash('1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef')).toBe(false); // No prefix
      expect(isEVMTransactionHash('0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdeg')).toBe(false); // Invalid hex
    });

    it('should handle edge cases', () => {
      expect(isEVMTransactionHash('')).toBe(false);
      expect(isEVMTransactionHash(null as unknown as string)).toBe(false);
      expect(isEVMTransactionHash(undefined as unknown as string)).toBe(false);
    });
  });

  describe('isSolanaTransactionHash', () => {
    it('should validate correct Solana hashes', () => {
      expect(isSolanaTransactionHash(VALID_SOLANA_HASH)).toBe(true);
      expect(isSolanaTransactionHash('123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz123456789ABCDEFGHJKLMNPqr')).toBe(true);
    });

    it('should reject invalid Solana hashes', () => {
      expect(isSolanaTransactionHash('too-short')).toBe(false);
      expect(isSolanaTransactionHash('0x1234567890abcdef')).toBe(false); // EVM format
      expect(isSolanaTransactionHash('5j7s1QjMsSPWAc1ceShAgQFbshVDVfEvjJ1BzV9EyBqd4J2g7jPJ8Sj5FZK7sVs9tAb0')).toBe(false); // Contains invalid base58 char '0'
      expect(isSolanaTransactionHash('5j7s1QjMsSPWAc1ceShAgQFbshVDVfEvjJ1BzV9EyBqd4J2g7jPJ8Sj5FZK7sVs9tAbO')).toBe(false); // Contains invalid base58 char 'O'
    });

    it('should handle edge cases', () => {
      expect(isSolanaTransactionHash('')).toBe(false);
      expect(isSolanaTransactionHash(null as unknown as string)).toBe(false);
      expect(isSolanaTransactionHash(undefined as unknown as string)).toBe(false);
    });
  });

  describe('validateEVMAddress', () => {
    it('should return valid addresses as-is', () => {
      expect(validateEVMAddress(VALID_EVM_ADDRESS)).toBe(VALID_EVM_ADDRESS);
      expect(validateEVMAddress(ZERO_ADDRESS)).toBe(ZERO_ADDRESS);
    });

    it('should throw error for invalid addresses', () => {
      expect(() => validateEVMAddress(INVALID_SHORT_ADDRESS))
        .toThrow('Invalid EVM address: 0x742d35cc6635c0532925a3b8d5c9828. Expected format: 0x followed by 40 hex characters.');
      
      expect(() => validateEVMAddress(''))
        .toThrow('Invalid EVM address: . Expected format: 0x followed by 40 hex characters.');
      
      expect(() => validateEVMAddress(INVALID_NON_HEX_ADDRESS))
        .toThrow('Invalid EVM address: 0x742g35cc6635c0532925a3b8d5c9828f2f7b0da0. Expected format: 0x followed by 40 hex characters.');
    });
  });

  describe('validateEVMTransactionHash', () => {
    it('should return valid hashes as-is', () => {
      expect(validateEVMTransactionHash(VALID_TRANSACTION_HASH)).toBe(VALID_TRANSACTION_HASH);
      expect(validateEVMTransactionHash(ZERO_TRANSACTION_HASH)).toBe(ZERO_TRANSACTION_HASH);
    });

    it('should throw error for invalid hashes', () => {
      expect(() => validateEVMTransactionHash('0x1234'))
        .toThrow('Invalid EVM transaction hash: 0x1234. Expected format: 0x followed by 64 hex characters.');
      
      expect(() => validateEVMTransactionHash(''))
        .toThrow('Invalid EVM transaction hash: . Expected format: 0x followed by 64 hex characters.');
    });
  });

  describe('validateSolanaTransactionHash', () => {
    it('should return valid hashes as-is', () => {
      expect(validateSolanaTransactionHash(VALID_SOLANA_HASH)).toBe(VALID_SOLANA_HASH);
    });

    it('should throw error for invalid hashes', () => {
      expect(() => validateSolanaTransactionHash('invalid'))
        .toThrow('Invalid Solana transaction hash: invalid. Expected base58 encoded string.');
      
      expect(() => validateSolanaTransactionHash(''))
        .toThrow('Invalid Solana transaction hash: . Expected base58 encoded string.');
    });
  });

  describe('safeEVMAddress', () => {
    it('should return valid addresses', () => {
      expect(safeEVMAddress(VALID_EVM_ADDRESS)).toBe(VALID_EVM_ADDRESS);
    });

    it('should return fallback for invalid input', () => {
      const fallback = '0x1111111111111111111111111111111111111111' as EVMAddress;
      expect(safeEVMAddress('invalid', fallback)).toBe(fallback);
      expect(safeEVMAddress(null, fallback)).toBe(fallback);
      expect(safeEVMAddress(undefined, fallback)).toBe(fallback);
    });

    it('should throw when no fallback provided and input is invalid', () => {
      expect(() => safeEVMAddress('invalid'))
        .toThrow('Invalid EVM address: invalid. Expected format: 0x followed by 40 hex characters.');
      
      expect(() => safeEVMAddress(null))
        .toThrow('Invalid EVM address: null. Expected format: 0x followed by 40 hex characters.');
    });
  });

  describe('safeEVMTransactionHash', () => {
    it('should return valid hashes', () => {
      expect(safeEVMTransactionHash(VALID_TRANSACTION_HASH)).toBe(VALID_TRANSACTION_HASH);
    });

    it('should return fallback for invalid input', () => {
      const fallback = '0x1111111111111111111111111111111111111111111111111111111111111111' as EVMTransactionHash;
      expect(safeEVMTransactionHash('invalid', fallback)).toBe(fallback);
      expect(safeEVMTransactionHash(null, fallback)).toBe(fallback);
    });

    it('should throw when no fallback provided and input is invalid', () => {
      expect(() => safeEVMTransactionHash('invalid'))
        .toThrow('Invalid EVM transaction hash: invalid. Expected format: 0x followed by 64 hex characters.');
    });
  });

  describe('safeSolanaTransactionHash', () => {
    it('should return valid hashes', () => {
      expect(safeSolanaTransactionHash(VALID_SOLANA_HASH)).toBe(VALID_SOLANA_HASH);
    });

    it('should return fallback for invalid input', () => {
      const fallback = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz123456789ABCDEFGHJKLMNPqrs' as SolanaTransactionHash;
      expect(safeSolanaTransactionHash('invalid', fallback)).toBe(fallback);
    });

    it('should throw when no fallback provided and input is invalid', () => {
      expect(() => safeSolanaTransactionHash('invalid'))
        .toThrow('Invalid Solana transaction hash: invalid. Expected base58 encoded string.');
    });
  });

  describe('safeEVMAddressOrZeroAddress', () => {
    it('should return valid addresses', () => {
      expect(safeEVMAddressOrZeroAddress(VALID_EVM_ADDRESS)).toBe(VALID_EVM_ADDRESS);
    });

    it('should return zero address for invalid input', () => {
      expect(safeEVMAddressOrZeroAddress('invalid')).toBe(ZERO_ADDRESS);
      expect(safeEVMAddressOrZeroAddress(null)).toBe(ZERO_ADDRESS);
      expect(safeEVMAddressOrZeroAddress(undefined)).toBe(ZERO_ADDRESS);
    });
  });

  describe('safeEVMTransactionHashOrZeroTransactionHash', () => {
    it('should return valid hashes', () => {
      expect(safeEVMTransactionHashOrZeroTransactionHash(VALID_TRANSACTION_HASH)).toBe(VALID_TRANSACTION_HASH);
    });

    it('should return zero hash for invalid input', () => {
      expect(safeEVMTransactionHashOrZeroTransactionHash('invalid')).toBe(ZERO_TRANSACTION_HASH);
      expect(safeEVMTransactionHashOrZeroTransactionHash(null)).toBe(ZERO_TRANSACTION_HASH);
      expect(safeEVMTransactionHashOrZeroTransactionHash(undefined)).toBe(ZERO_TRANSACTION_HASH);
    });
  });

  describe('addressesEqual', () => {
    it('should compare addresses case-insensitively', () => {
      expect(addressesEqual(VALID_EVM_ADDRESS, VALID_EVM_ADDRESS_UPPERCASE)).toBe(true);
      expect(addressesEqual(VALID_EVM_ADDRESS, VALID_EVM_ADDRESS_MIXED_CASE)).toBe(true);
      expect(addressesEqual(VALID_EVM_ADDRESS_UPPERCASE, VALID_EVM_ADDRESS_MIXED_CASE)).toBe(true);
    });

    it('should return false for different addresses', () => {
      expect(addressesEqual(VALID_EVM_ADDRESS, ZERO_ADDRESS)).toBe(false);
      expect(addressesEqual(VALID_EVM_ADDRESS, '0x742d35cc6635c0532925a3b8d5c9828f2f7b0da1')).toBe(false);
    });

    it('should handle string and branded types', () => {
      const address1 = VALID_EVM_ADDRESS as EVMAddress;
      const address2: string = VALID_EVM_ADDRESS_UPPERCASE;
      expect(addressesEqual(address1, address2)).toBe(true);
    });
  });

  describe('isZeroAddress', () => {
    it('should identify zero address', () => {
      expect(isZeroAddress(ZERO_ADDRESS)).toBe(true);
      expect(isZeroAddress('0x0000000000000000000000000000000000000000')).toBe(true);
      expect(isZeroAddress('0X0000000000000000000000000000000000000000')).toBe(true); // Case insensitive
    });

    it('should return false for non-zero addresses', () => {
      expect(isZeroAddress(VALID_EVM_ADDRESS)).toBe(false);
      expect(isZeroAddress('0x0000000000000000000000000000000000000001')).toBe(false);
    });
  });

  describe('assertEVMAddress', () => {
    it('should return valid addresses', () => {
      expect(assertEVMAddress(VALID_EVM_ADDRESS)).toBe(VALID_EVM_ADDRESS);
    });

    it('should throw for non-string input', () => {
      expect(() => assertEVMAddress(123))
        .toThrow('Expected string for EVM address, got number');
      
      expect(() => assertEVMAddress(null))
        .toThrow('Expected string for EVM address, got object');
      
      expect(() => assertEVMAddress(undefined))
        .toThrow('Expected string for EVM address, got undefined');
    });

    it('should throw for invalid string addresses', () => {
      expect(() => assertEVMAddress('invalid'))
        .toThrow('Invalid EVM address: invalid. Expected format: 0x followed by 40 hex characters.');
    });

    it('should include context in error messages', () => {
      expect(() => assertEVMAddress(123, 'user input'))
        .toThrow('Expected string for EVM address in user input, got number');
      
      expect(() => assertEVMAddress('invalid', 'contract response'))
        .toThrow('Invalid EVM address: invalid. Expected format: 0x followed by 40 hex characters.');
    });
  });

  describe('assertEVMTransactionHash', () => {
    it('should return valid hashes', () => {
      expect(assertEVMTransactionHash(VALID_TRANSACTION_HASH)).toBe(VALID_TRANSACTION_HASH);
    });

    it('should throw for non-string input', () => {
      expect(() => assertEVMTransactionHash(123))
        .toThrow('Expected string for EVM transaction hash, got number');
      
      expect(() => assertEVMTransactionHash(null))
        .toThrow('Expected string for EVM transaction hash, got object');
    });

    it('should throw for invalid string hashes', () => {
      expect(() => assertEVMTransactionHash('invalid'))
        .toThrow('Invalid EVM transaction hash: invalid. Expected format: 0x followed by 64 hex characters.');
    });

    it('should include context in error messages', () => {
      expect(() => assertEVMTransactionHash(123, 'blockchain response'))
        .toThrow('Expected string for EVM transaction hash in blockchain response, got number');
    });
  });

  describe('Type System Integration', () => {
    it('should maintain type safety with branded types', () => {
      const address: EVMAddress = validateEVMAddress(VALID_EVM_ADDRESS);
      const hash: EVMTransactionHash = validateEVMTransactionHash(VALID_TRANSACTION_HASH);
      const solanaHash: SolanaTransactionHash = validateSolanaTransactionHash(VALID_SOLANA_HASH);
      
      // These should compile without issues
      expect(address).toBe(VALID_EVM_ADDRESS);
      expect(hash).toBe(VALID_TRANSACTION_HASH);
      expect(solanaHash).toBe(VALID_SOLANA_HASH);
    });

    it('should work with utility functions', () => {
      const addr1 = validateEVMAddress(VALID_EVM_ADDRESS);
      const addr2 = validateEVMAddress(VALID_EVM_ADDRESS_UPPERCASE);
      
      expect(addressesEqual(addr1, addr2)).toBe(true);
      expect(isZeroAddress(addr1)).toBe(false);
      expect(isZeroAddress(ZERO_ADDRESS)).toBe(true);
    });
  });

  describe('Edge Cases and Error Scenarios', () => {
    it('should handle malformed input gracefully', () => {
      const malformedInputs = [
        '0x',
        '0X742d35cc6635c0532925a3b8d5c9828f2f7b0da0',
        '0x742d35cc6635c0532925a3b8d5c9828f2f7b0da0 ',
        ' 0x742d35cc6635c0532925a3b8d5c9828f2f7b0da0',
        '742d35cc6635c0532925a3b8d5c9828f2f7b0da0',
        '\n0x742d35cc6635c0532925a3b8d5c9828f2f7b0da0\n',
        '0x742d35cc6635c0532925a3b8d5c9828f2f7b0da0\0'
      ];

      malformedInputs.forEach(input => {
        expect(isEVMAddress(input)).toBe(false);
        expect(() => validateEVMAddress(input)).toThrow();
        expect(safeEVMAddress(input, ZERO_ADDRESS)).toBe(ZERO_ADDRESS);
      });
    });

    it('should handle unicode and special characters', () => {
      const unicodeInputs = [
        '0x742d35cc6635c0532925a3b8d5c9828f2f7b0da\u0000',
        '0x742d35cc6635c0532925a3b8d5c9828f2f7b0da\u200B', // Zero-width space
        '0x742d35cc6635c0532925a3b8d5c9828f2f7b0da🚀',
      ];

      unicodeInputs.forEach(input => {
        expect(isEVMAddress(input)).toBe(false);
      });
    });

    it('should handle very large and very small inputs', () => {
      const veryLongInput = '0x' + 'a'.repeat(1000);
      const veryShortInput = '0x';
      
      expect(isEVMAddress(veryLongInput)).toBe(false);
      expect(isEVMAddress(veryShortInput)).toBe(false);
      expect(isEVMTransactionHash(veryLongInput)).toBe(false);
      expect(isEVMTransactionHash(veryShortInput)).toBe(false);
    });
  });

  describe('Performance and Memory', () => {
    it('should handle validation calls efficiently', () => {
      const start = Date.now();
      
      // Test with a smaller number to avoid memory issues
      for (let i = 0; i < 10; i++) {
        isEVMAddress(VALID_EVM_ADDRESS);
        isEVMTransactionHash(VALID_TRANSACTION_HASH);
        isSolanaTransactionHash(VALID_SOLANA_HASH);
      }
      
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(50); // Should be very fast
    });

    it('should validate functions work consistently', () => {
      // Test that validation functions work consistently
      const results: EVMAddress[] = [];
      
      for (let i = 0; i < 5; i++) {
        results.push(validateEVMAddress(VALID_EVM_ADDRESS));
        results.push(safeEVMAddress(VALID_EVM_ADDRESS));
      }

      // All results should be the same valid address
      expect(results.every(addr => addressesEqual(addr, VALID_EVM_ADDRESS))).toBe(true);
    });
  });
});