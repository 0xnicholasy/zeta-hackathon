import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  stringToHexBytes,
  valueToHex,
  addressToHexBytes,
  solanaAddressToHexBytes
} from '../viemHelpers';
import { isAddress, getAddress } from 'viem';

// Mock viem functions
vi.mock('viem', async () => {
  const actual = await vi.importActual('viem');
  return {
    ...actual,
    isAddress: vi.fn(),
    getAddress: vi.fn(),
  };
});

// Mock @scure/base
vi.mock('@scure/base', () => ({
  base58: {
    decode: vi.fn(),
  },
}));

import { base58 } from '@scure/base';

describe('viemHelpers', () => {
  describe('stringToHexBytes', () => {
    it('should convert simple ASCII strings to hex', () => {
      const result = stringToHexBytes('hello');
      expect(result).toMatch(/^0x[0-9a-fA-F]+$/);
      expect(result).toBe('0x68656c6c6f');
    });

    it('should convert empty string to hex', () => {
      const result = stringToHexBytes('');
      expect(result).toBe('0x');
    });

    it('should handle special characters', () => {
      const result = stringToHexBytes('hello world!');
      expect(result).toMatch(/^0x[0-9a-fA-F]+$/);
      expect(result).toBe('0x68656c6c6f20776f726c6421');
    });

    it('should handle unicode characters', () => {
      const result = stringToHexBytes('🚀');
      expect(result).toMatch(/^0x[0-9a-fA-F]+$/);
      // Unicode rocket emoji as UTF-8 bytes
      expect(result).toBe('0xf09f9a80');
    });

    it('should handle numbers in string format', () => {
      const result = stringToHexBytes('12345');
      expect(result).toMatch(/^0x[0-9a-fA-F]+$/);
      expect(result).toBe('0x3132333435');
    });

    it('should handle very long strings', () => {
      const longString = 'a'.repeat(1000);
      const result = stringToHexBytes(longString);
      expect(result).toMatch(/^0x[0-9a-fA-F]+$/);
      expect(result.length).toBe(2 + 1000 * 2); // '0x' + 2 hex chars per byte
    });
  });

  describe('valueToHex', () => {
    it('should convert numeric strings correctly', () => {
      const result = valueToHex('255');
      expect(result).toMatch(/^0x[0-9a-fA-F]+$/);
      // The function processes string '255' as hex bytes, giving '0x323535'
      expect(result).toBe('0x323535');
    });

    it('should convert regular numbers to hex', () => {
      const result = valueToHex(255);
      expect(result).toMatch(/^0x[0-9a-fA-F]+$/);
      expect(result).toBe('0xff');
    });

    it('should convert BigInt to hex', () => {
      const result = valueToHex(BigInt(255));
      expect(result).toMatch(/^0x[0-9a-fA-F]+$/);
      expect(result).toBe('0xff');
    });

    it('should convert Uint8Array to hex', () => {
      const bytes = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]); // "Hello"
      const result = valueToHex(bytes);
      expect(result).toMatch(/^0x[0-9a-fA-F]+$/);
      expect(result).toBe('0x48656c6c6f');
    });

    it('should handle zero values', () => {
      expect(valueToHex(0)).toBe('0x0');
      expect(valueToHex('0')).toBe('0x30'); // String '0' as hex bytes
      expect(valueToHex(BigInt(0))).toBe('0x0');
    });

    it('should throw error for negative numbers', () => {
      // viem doesn't support negative numbers
      expect(() => valueToHex(-1)).toThrow();
    });

    it('should handle very large BigInt values', () => {
      const largeBigInt = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');
      const result = valueToHex(largeBigInt);
      expect(result).toMatch(/^0x[0-9a-fA-F]+$/);
      expect(result).toBe('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');
    });

    it('should handle empty Uint8Array', () => {
      const emptyBytes = new Uint8Array([]);
      const result = valueToHex(emptyBytes);
      expect(result).toBe('0x');
    });
  });

  describe('addressToHexBytes', () => {
    const validAddress = '0x1234567890123456789012345678901234567890';
    const checksumAddress = '0x1234567890123456789012345678901234567890';

    beforeEach(() => {
      // Reset mocks
      vi.mocked(isAddress).mockClear();
      vi.mocked(getAddress).mockClear();
    });

    it('should return checksummed address for valid EVM address', () => {
      vi.mocked(isAddress).mockReturnValue(true);
      vi.mocked(getAddress).mockReturnValue(checksumAddress as any);

      const result = addressToHexBytes(validAddress);

      expect(isAddress).toHaveBeenCalledWith(validAddress);
      expect(getAddress).toHaveBeenCalledWith(validAddress);
      expect(result).toBe(checksumAddress);
    });

    it('should handle lowercase addresses', () => {
      const lowercaseAddress = validAddress.toLowerCase();
      vi.mocked(isAddress).mockReturnValue(true);
      vi.mocked(getAddress).mockReturnValue(checksumAddress as any);

      const result = addressToHexBytes(lowercaseAddress);

      expect(isAddress).toHaveBeenCalledWith(lowercaseAddress);
      expect(getAddress).toHaveBeenCalledWith(lowercaseAddress);
      expect(result).toBe(checksumAddress);
    });

    it('should handle uppercase addresses', () => {
      const uppercaseAddress = validAddress.toUpperCase();
      vi.mocked(isAddress).mockReturnValue(true);
      vi.mocked(getAddress).mockReturnValue(checksumAddress as any);

      const result = addressToHexBytes(uppercaseAddress);

      expect(isAddress).toHaveBeenCalledWith(uppercaseAddress);
      expect(getAddress).toHaveBeenCalledWith(uppercaseAddress);
      expect(result).toBe(checksumAddress);
    });

    it('should handle mixed case addresses', () => {
      const mixedCaseAddress = '0x1234567890abcDEF1234567890abcDEF12345678';
      const expectedChecksumAddress = '0x1234567890abcDEF1234567890abcDEF12345678';
      
      vi.mocked(isAddress).mockReturnValue(true);
      vi.mocked(getAddress).mockReturnValue(expectedChecksumAddress as any);

      const result = addressToHexBytes(mixedCaseAddress);

      expect(result).toBe(expectedChecksumAddress);
    });

    it('should throw error for invalid EVM address', () => {
      vi.mocked(isAddress).mockReturnValue(false);

      expect(() => addressToHexBytes('invalid-address')).toThrow('Invalid EVM address');
      expect(isAddress).toHaveBeenCalledWith('invalid-address');
      expect(getAddress).not.toHaveBeenCalled();
    });

    it('should throw error for too short address', () => {
      vi.mocked(isAddress).mockReturnValue(false);

      expect(() => addressToHexBytes('0x123')).toThrow('Invalid EVM address');
    });

    it('should throw error for too long address', () => {
      vi.mocked(isAddress).mockReturnValue(false);

      expect(() => addressToHexBytes('0x12345678901234567890123456789012345678901')).toThrow('Invalid EVM address');
    });

    it('should throw error for address without 0x prefix', () => {
      vi.mocked(isAddress).mockReturnValue(false);

      expect(() => addressToHexBytes('1234567890123456789012345678901234567890')).toThrow('Invalid EVM address');
    });

    it('should throw error for address with invalid characters', () => {
      vi.mocked(isAddress).mockReturnValue(false);

      expect(() => addressToHexBytes('0x123456789012345678901234567890123456789g')).toThrow('Invalid EVM address');
    });

    it('should throw error for empty string', () => {
      vi.mocked(isAddress).mockReturnValue(false);

      expect(() => addressToHexBytes('')).toThrow('Invalid EVM address');
    });

    it('should throw error for null/undefined inputs', () => {
      vi.mocked(isAddress).mockReturnValue(false);

      expect(() => addressToHexBytes(null as any)).toThrow('Invalid EVM address');
      expect(() => addressToHexBytes(undefined as any)).toThrow('Invalid EVM address');
    });
  });

  describe('solanaAddressToHexBytes', () => {
    const validSolanaAddress = '11111111111111111111111111111112'; // Valid base58 string
    const validSolanaBytes = new Uint8Array(32).fill(0); // 32 zero bytes
    validSolanaBytes[31] = 1; // Make it slightly different

    beforeEach(() => {
      vi.mocked(base58.decode).mockClear();
    });

    it('should convert valid Solana address to hex', () => {
      vi.mocked(base58.decode).mockReturnValue(validSolanaBytes);

      const result = solanaAddressToHexBytes(validSolanaAddress);

      expect(base58.decode).toHaveBeenCalledWith(validSolanaAddress);
      expect(result).toMatch(/^0x[0-9a-fA-F]{64}$/); // 32 bytes = 64 hex chars
      expect(result).toBe('0x0000000000000000000000000000000000000000000000000000000000000001');
    });

    it('should handle different valid Solana addresses', () => {
      const customBytes = new Uint8Array(32);
      customBytes[0] = 0xff;
      customBytes[31] = 0xff;
      
      vi.mocked(base58.decode).mockReturnValue(customBytes);

      const result = solanaAddressToHexBytes('SomeValidBase58Address');

      expect(base58.decode).toHaveBeenCalledWith('SomeValidBase58Address');
      expect(result).toMatch(/^0x[0-9a-fA-F]{64}$/);
      expect(result).toBe('0xff000000000000000000000000000000000000000000000000000000000000ff');
    });

    it('should handle all zero bytes', () => {
      const zeroBytes = new Uint8Array(32).fill(0);
      vi.mocked(base58.decode).mockReturnValue(zeroBytes);

      const result = solanaAddressToHexBytes('AllZeroValidAddress');

      expect(result).toBe('0x0000000000000000000000000000000000000000000000000000000000000000');
    });

    it('should handle all max bytes', () => {
      const maxBytes = new Uint8Array(32).fill(255);
      vi.mocked(base58.decode).mockReturnValue(maxBytes);

      const result = solanaAddressToHexBytes('AllMaxValidAddress');

      expect(result).toBe('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');
    });

    it('should throw error for invalid base58 address', () => {
      vi.mocked(base58.decode).mockImplementation(() => {
        throw new Error('Invalid base58');
      });

      expect(() => solanaAddressToHexBytes('InvalidBase58!')).toThrow('Invalid Solana Base58 address');
      expect(base58.decode).toHaveBeenCalledWith('InvalidBase58!');
    });

    it('should throw error when decoded bytes length is not 32', () => {
      const invalidLengthBytes = new Uint8Array(31); // Wrong length
      vi.mocked(base58.decode).mockReturnValue(invalidLengthBytes);

      expect(() => solanaAddressToHexBytes(validSolanaAddress)).toThrow('Invalid Solana Base58 address');
    });

    it('should throw error when decoded bytes length is too long', () => {
      const invalidLengthBytes = new Uint8Array(33); // Too long
      vi.mocked(base58.decode).mockReturnValue(invalidLengthBytes);

      expect(() => solanaAddressToHexBytes(validSolanaAddress)).toThrow('Invalid Solana Base58 address');
    });

    it('should throw error when decoded bytes length is zero', () => {
      const emptyBytes = new Uint8Array(0);
      vi.mocked(base58.decode).mockReturnValue(emptyBytes);

      expect(() => solanaAddressToHexBytes(validSolanaAddress)).toThrow('Invalid Solana Base58 address');
    });

    it('should throw error for empty string', () => {
      vi.mocked(base58.decode).mockImplementation(() => {
        throw new Error('Empty string');
      });

      expect(() => solanaAddressToHexBytes('')).toThrow('Invalid Solana Base58 address');
    });

    it('should throw error for null/undefined inputs', () => {
      vi.mocked(base58.decode).mockImplementation(() => {
        throw new Error('Invalid input');
      });

      expect(() => solanaAddressToHexBytes(null as any)).toThrow('Invalid Solana Base58 address');
      expect(() => solanaAddressToHexBytes(undefined as any)).toThrow('Invalid Solana Base58 address');
    });

    it('should handle addresses with special base58 characters', () => {
      const validBytes = new Uint8Array(32);
      validBytes[15] = 0xab;
      validBytes[16] = 0xcd;
      
      vi.mocked(base58.decode).mockReturnValue(validBytes);

      const result = solanaAddressToHexBytes('AddressWithSpecialChars123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz');

      expect(result).toMatch(/^0x[0-9a-fA-F]{64}$/);
      expect(result).toBe('0x000000000000000000000000000000abcd000000000000000000000000000000');
    });

    it('should preserve exact byte values in conversion', () => {
      // Create a specific byte pattern
      const specificBytes = new Uint8Array(32);
      for (let i = 0; i < 32; i++) {
        specificBytes[i] = i * 8 % 256;
      }
      
      vi.mocked(base58.decode).mockReturnValue(specificBytes);

      const result = solanaAddressToHexBytes('SpecificPatternAddress');

      // Verify each byte is correctly converted
      const hexWithoutPrefix = result.slice(2);
      for (let i = 0; i < 32; i++) {
        const byteHex = hexWithoutPrefix.slice(i * 2, (i + 1) * 2);
        const expectedByte = (i * 8 % 256).toString(16).padStart(2, '0');
        expect(byteHex).toBe(expectedByte);
      }
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle boundary values correctly', () => {
      // Test max safe integer
      const maxSafeInt = Number.MAX_SAFE_INTEGER;
      const result = valueToHex(maxSafeInt);
      expect(result).toMatch(/^0x[0-9a-fA-F]+$/);
    });

    it('should handle very large BigInt values', () => {
      const veryLargeBigInt = BigInt('0x' + 'f'.repeat(128)); // 64-byte number
      const result = valueToHex(veryLargeBigInt);
      expect(result).toMatch(/^0x[0-9a-fA-F]+$/);
      expect(result.length).toBe(130); // '0x' + 128 hex chars
    });

    it('should handle Uint8Array with max values', () => {
      const maxBytes = new Uint8Array(256).fill(255);
      const result = valueToHex(maxBytes);
      expect(result).toMatch(/^0x[0-9a-fA-F]+$/);
      expect(result.length).toBe(514); // '0x' + 512 hex chars
    });

    it('should handle single byte Uint8Array', () => {
      const singleByte = new Uint8Array([42]);
      const result = valueToHex(singleByte);
      expect(result).toBe('0x2a');
    });

    it('should handle string with all possible characters', () => {
    it('should handle string with all printable ASCII characters', () => {
      const allChars = Array.from({ length: 126 - 32 + 1 }, (_, i) => String.fromCharCode(32 + i)).join('');
      const result = stringToHexBytes(allChars);
      expect(result).toMatch(/^0x[0-9a-fA-F]+$/);
      expect(result.length).toBe(2 + allChars.length * 2); // '0x' + 2 hex chars per byte
    });
  });

  describe('Type Safety and Integration', () => {
    it('should return proper hex string format for all functions', () => {
      // All functions should return strings starting with 0x
      expect(stringToHexBytes('test')).toMatch(/^0x/);
      expect(valueToHex(123)).toMatch(/^0x/);
    });

    it('should handle concurrent calls correctly', async () => {
      // Test that functions can be called concurrently without issues
      const promises = [
        Promise.resolve(stringToHexBytes('test1')),
        Promise.resolve(stringToHexBytes('test2')),
        Promise.resolve(valueToHex(123)),
        Promise.resolve(valueToHex(456)),
      ];

      const results = await Promise.all(promises);
      
      expect(results[0]).toBe('0x7465737431');
      expect(results[1]).toBe('0x7465737432');
      expect(results[2]).toBe('0x7b');
      expect(results[3]).toBe('0x1c8');
    });

    it('should maintain consistency across multiple calls', () => {
      // Same input should always produce same output
      const input = 'consistent-test';
      const result1 = stringToHexBytes(input);
      const result2 = stringToHexBytes(input);
      const result3 = stringToHexBytes(input);

      expect(result1).toBe(result2);
      expect(result2).toBe(result3);
    });
  });
})
});