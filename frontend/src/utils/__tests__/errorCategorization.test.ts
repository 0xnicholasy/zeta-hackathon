import { describe, it, expect } from 'vitest';
import { categorizeError, getSeverityClasses, getSeverityIcon } from '../errorCategorization';

describe('errorCategorization', () => {
  describe('categorizeError', () => {
    it('should categorize user rejection errors', () => {
      const error = new Error('User rejected the request');
      const result = categorizeError(error);

      expect(result.category).toBe('USER_REJECTION');
      expect(result.title).toBe('Transaction Cancelled');
      expect(result.severity).toBe('info');
      expect(result.canRetry).toBe(true);
    });

    it('should categorize insufficient funds errors', () => {
      const error = new Error('insufficient funds for gas * price + value');
      const result = categorizeError(error);

      expect(result.category).toBe('INSUFFICIENT_FUNDS');
      expect(result.title).toBe('Insufficient Funds');
      expect(result.severity).toBe('error');
      expect(result.canRetry).toBe(false);
    });

    it('should categorize health factor errors', () => {
      const error = new Error('Insufficient collateral');
      const result = categorizeError(error);

      expect(result.category).toBe('HEALTH_FACTOR_TOO_LOW');
      expect(result.title).toBe('Insufficient Collateral');
      expect(result.severity).toBe('error');
      expect(result.canRetry).toBe(false);
    });

    it('should categorize network errors', () => {
      const error = new Error('Network request failed');
      const result = categorizeError(error);

      expect(result.category).toBe('NETWORK_ERROR');
      expect(result.title).toBe('Network Error');
      expect(result.severity).toBe('warning');
      expect(result.canRetry).toBe(true);
    });

    it('should categorize contract revert errors', () => {
      const error = new Error('execution reverted: ERC20: transfer amount exceeds balance');
      const result = categorizeError(error);

      expect(result.category).toBe('CONTRACT_REVERT');
      expect(result.title).toBe('Transaction Failed');
      expect(result.severity).toBe('error');
      expect(result.canRetry).toBe(false);
    });

    it('should categorize gas estimation failures', () => {
      const error = new Error('cannot estimate gas');
      const result = categorizeError(error);

      expect(result.category).toBe('GAS_ESTIMATION_FAILED');
      expect(result.title).toBe('Gas Estimation Failed');
      expect(result.severity).toBe('warning');
      expect(result.canRetry).toBe(true);
    });

    it('should handle unknown errors', () => {
      const error = new Error('Some unknown error');
      const result = categorizeError(error);

      expect(result.category).toBe('UNKNOWN_ERROR');
      expect(result.title).toBe('Unknown Error');
      expect(result.severity).toBe('error');
      expect(result.canRetry).toBe(true);
    });

    it('should handle string errors', () => {
      const error = 'String error message';
      const result = categorizeError(error);

      expect(result.category).toBe('UNKNOWN_ERROR');
      expect(result.title).toBe('Unknown Error');
      expect(result.message).toContain('String error message');
    });

    it('should handle null/undefined errors', () => {
      const result = categorizeError(null);

      expect(result.category).toBe('UNKNOWN_ERROR');
      expect(result.title).toBe('Unknown Error');
      expect(result.message).toBe('An unexpected error occurred. Please try again.');
    });

    it('should extract specific revert reasons', () => {
      const error = new Error('execution reverted: Cannot borrow more than collateral allows');
      const result = categorizeError(error);

      expect(result.category).toBe('CONTRACT_REVERT');
      expect(result.message).toContain('Cannot borrow more than collateral allows');
    });
  });

  describe('getSeverityClasses', () => {
    it('should return correct classes for each severity', () => {
      expect(getSeverityClasses('error')).toContain('border-red');
      expect(getSeverityClasses('warning')).toContain('border-yellow');
      expect(getSeverityClasses('info')).toContain('border-blue');
    });

    it('should handle unknown severity gracefully', () => {
      const classes = getSeverityClasses('unknown' as never);
      expect(typeof classes).toBe('string');
    });
  });

  describe('getSeverityIcon', () => {
    it('should return appropriate icons for each severity', () => {
      expect(getSeverityIcon('error')).toBe('⚠️');
      expect(getSeverityIcon('warning')).toBe('⚠️');
      expect(getSeverityIcon('info')).toBe('ℹ️');
    });

    it('should handle unknown severity gracefully', () => {
      const icon = getSeverityIcon('unknown' as never);
      expect(typeof icon).toBe('string');
    });
  });
});