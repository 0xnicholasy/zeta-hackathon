import { describe, it, expect } from 'vitest';
import { validateAmountInput, validateAddressInput, validateHealthFactorRequirement } from '../inputValidation';

describe('inputValidation', () => {
  describe('validateAmountInput', () => {
    it('should validate positive numbers', () => {
      const result = validateAmountInput('100.50', 6, '1000', '10');
      
      expect(result.isValid).toBe(true);
      expect(result.normalizedValue).toBe('100.50');
      expect(result.error).toBe('');
    });

    it('should reject empty input', () => {
      const result = validateAmountInput('', 6, '1000', '10');
      
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Amount is required');
    });

    it('should reject zero amounts', () => {
      const result = validateAmountInput('0', 6, '1000', '10');
      
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Amount must be greater than zero');
    });

    it('should reject negative amounts', () => {
      const result = validateAmountInput('-5.5', 6, '1000', '10');
      
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Amount must be greater than zero');
    });

    it('should reject amounts exceeding maximum', () => {
      const result = validateAmountInput('1500', 6, '1000', '10');
      
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Amount exceeds maximum available (1,000)');
    });

    it('should reject amounts below minimum', () => {
      const result = validateAmountInput('5', 6, '1000', '10');
      
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Minimum amount is 10');
    });

    it('should handle decimal precision correctly', () => {
      const result = validateAmountInput('100.1234567', 6, '1000', '10');
      
      expect(result.isValid).toBe(true);
      expect(result.normalizedValue).toBe('100.123457'); // Rounded to 6 decimals
    });

    it('should reject invalid decimal precision', () => {
      const result = validateAmountInput('100.12345678', 6, '1000', '10');
      
      expect(result.isValid).toBe(true); // Should be rounded, not rejected
      expect(result.normalizedValue).toBe('100.123457');
    });

    it('should reject non-numeric input', () => {
      const result = validateAmountInput('abc', 6, '1000', '10');
      
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid number format');
    });
  });

  describe('validateAddressInput', () => {
    it('should validate correct Ethereum address', () => {
      const validAddress = '0x1234567890123456789012345678901234567890';
      const result = validateAddressInput(validAddress);
      
      expect(result.isValid).toBe(true);
      expect(result.error).toBe('');
    });

    it('should reject empty address', () => {
      const result = validateAddressInput('');
      
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Address is required');
    });

    it('should reject invalid address format', () => {
      const result = validateAddressInput('0x123');
      
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid address format');
    });

    it('should reject non-hex address', () => {
      const result = validateAddressInput('not-an-address');
      
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid address format');
    });
  });

  describe('validateHealthFactorRequirement', () => {
    it('should accept health factor above minimum', () => {
      const result = validateHealthFactorRequirement('2.5', '1.5');
      
      expect(result.isValid).toBe(true);
      expect(result.error).toBe('');
    });

    it('should reject health factor below minimum', () => {
      const result = validateHealthFactorRequirement('1.2', '1.5');
      
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Health factor would drop below minimum requirement (1.50)');
    });

    it('should handle edge case at exactly minimum', () => {
      const result = validateHealthFactorRequirement('1.5', '1.5');
      
      expect(result.isValid).toBe(true);
      expect(result.error).toBe('');
    });

    it('should handle infinite health factor', () => {
      const result = validateHealthFactorRequirement('∞', '1.5');
      
      expect(result.isValid).toBe(true);
      expect(result.error).toBe('');
    });

    it('should handle invalid health factor format', () => {
      const result = validateHealthFactorRequirement('invalid', '1.5');
      
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid health factor format');
    });
  });
});