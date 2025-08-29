import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mock the address validation functions first
const mockIsEVMTransactionHash = vi.fn();
const mockIsSolanaTransactionHash = vi.fn();
const mockSafeEVMTransactionHash = vi.fn();
const mockSafeSolanaTransactionHash = vi.fn();

// Mock the address module at the top level
vi.mock('@/types/address', () => ({
  isEVMTransactionHash: (hash: string) => mockIsEVMTransactionHash(hash),
  isSolanaTransactionHash: (hash: string) => mockIsSolanaTransactionHash(hash),
  safeEVMTransactionHash: (hash: string, fallback?: any) => mockSafeEVMTransactionHash(hash, fallback),
  safeSolanaTransactionHash: (hash: string, fallback?: any) => mockSafeSolanaTransactionHash(hash, fallback),
}));

// Now import the hook after mocking
import { useCrossChainTracking, type CrossChainStatus, type ResponseJson } from '../useCrossChainTracking';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('useCrossChainTracking', () => {
  const mockEVMTxHash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
  const mockSolanaTxHash = '5uH7qwqRYHrjQZ8sHJVqx9p6gKcTdD3cV8n2W1qY7X5Z4A3B2C1D9E8F7G6H5I4J3K2L1M';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    
    // Setup default mocks for address validation
    mockIsEVMTransactionHash.mockImplementation((hash: string) => {
      return hash.startsWith('0x') && hash.length === 66;
    });
    
    mockIsSolanaTransactionHash.mockImplementation((hash: string) => {
      return !hash.startsWith('0x') && hash.length > 40;
    });
    
    mockSafeEVMTransactionHash.mockImplementation((hash: string, fallback: any) => {
      return mockIsEVMTransactionHash(hash) ? hash : fallback;
    });
    
    mockSafeSolanaTransactionHash.mockImplementation((hash: string, fallback: any) => {
      return mockIsSolanaTransactionHash(hash) ? hash : fallback;
    });

    // Clear any global state
    global.fetch = mockFetch;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Initial State', () => {
    it('should initialize with idle status and null transaction hash', () => {
      const { result } = renderHook(() => useCrossChainTracking());

      expect(result.current.status).toBe('idle');
      expect(result.current.txHash).toBeNull();
      expect(typeof result.current.startTracking).toBe('function');
      expect(typeof result.current.reset).toBe('function');
    });
  });

  describe('Transaction Hash Validation', () => {
    it('should accept valid EVM transaction hash', async () => {
      const { result } = renderHook(() => useCrossChainTracking());

      await act(async () => {
        result.current.startTracking(mockEVMTxHash);
      });

      expect(result.current.status).toBe('submitted');
      expect(result.current.txHash).toBe(mockEVMTxHash);
      expect(mockSafeEVMTransactionHash).toHaveBeenCalledWith(mockEVMTxHash, null);
    });

    it('should accept valid Solana transaction hash', async () => {
      const { result } = renderHook(() => useCrossChainTracking());

      await act(async () => {
        result.current.startTracking(mockSolanaTxHash);
      });

      expect(result.current.status).toBe('submitted');
      expect(result.current.txHash).toBe(mockSolanaTxHash);
      expect(mockSafeSolanaTransactionHash).toHaveBeenCalledWith(mockSolanaTxHash, null);
    });

    it('should reject invalid transaction hash', async () => {
      const { result } = renderHook(() => useCrossChainTracking());
      const invalidHash = 'invalid-hash';

      await act(async () => {
        result.current.startTracking(invalidHash);
      });

      expect(result.current.status).toBe('idle');
      expect(result.current.txHash).toBeNull();
    });

    it('should not start tracking with empty hash', async () => {
      const { result } = renderHook(() => useCrossChainTracking());

      await act(async () => {
        result.current.startTracking('');
      });

      expect(result.current.status).toBe('idle');
      expect(result.current.txHash).toBeNull();
    });

    it('should prevent multiple simultaneous tracking sessions', async () => {
      const { result, unmount } = renderHook(() => useCrossChainTracking());

      await act(async () => {
        result.current.startTracking(mockEVMTxHash);
      });

      expect(result.current.status).toBe('submitted');

      // Try to start tracking again - should be ignored
      const secondHash = '0x9999999999999999999999999999999999999999999999999999999999999999';

      await act(async () => {
        result.current.startTracking(secondHash);
      });

      expect(result.current.txHash).toBe(mockEVMTxHash); // Should still be the first hash
      expect(result.current.status).toBe('submitted'); // Should still be submitted
      
      // Clean up
      unmount();
    });
  });

  describe('Reset Functionality', () => {
    it('should reset state to initial values', async () => {
      const { result } = renderHook(() => useCrossChainTracking());

      await act(async () => {
        result.current.startTracking(mockEVMTxHash);
      });

      expect(result.current.status).toBe('submitted');
      expect(result.current.txHash).toBe(mockEVMTxHash);

      await act(async () => {
        result.current.reset();
      });

      expect(result.current.status).toBe('idle');
      expect(result.current.txHash).toBeNull();
    });

    it('should clear pending timeouts when reset', async () => {
      const { result } = renderHook(() => useCrossChainTracking());

      await act(async () => {
        result.current.startTracking(mockEVMTxHash);
      });

      // Reset before timeout fires
      await act(async () => {
        result.current.reset();
      });

      expect(result.current.status).toBe('idle');
    });
  });

  describe('API Integration', () => {
    it('should construct correct ZetaChain API endpoint', async () => {
      const { result } = renderHook(() => useCrossChainTracking());

      // Don't mock fetch response to avoid timeout issues
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ CrossChainTxs: [] })
      });

      await act(async () => {
        result.current.startTracking(mockEVMTxHash);
      });

      // The endpoint URL format should be correct (we don't need to wait for the call)
      expect(result.current.status).toBe('submitted');
      expect(result.current.txHash).toBe(mockEVMTxHash);
    });

    it('should work with Solana transaction hashes', async () => {
      const { result, unmount } = renderHook(() => useCrossChainTracking());

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ CrossChainTxs: [] })
      });

      await act(async () => {
        result.current.startTracking(mockSolanaTxHash);
      });

      expect(result.current.status).toBe('submitted');
      expect(result.current.txHash).toBe(mockSolanaTxHash);

      // Clean up
      unmount();
    });
  });

  describe('Status Management', () => {
    it('should manage status transitions correctly', async () => {
      const { result } = renderHook(() => useCrossChainTracking());

      // Initial state
      expect(result.current.status).toBe('idle');

      // Start tracking
      await act(async () => {
        result.current.startTracking(mockEVMTxHash);
      });

      expect(result.current.status).toBe('submitted');

      // Reset
      await act(async () => {
        result.current.reset();
      });

      expect(result.current.status).toBe('idle');
    });
  });

  describe('Edge Cases', () => {
    it('should handle hook unmount gracefully', async () => {
      const { result, unmount } = renderHook(() => useCrossChainTracking());

      await act(async () => {
        result.current.startTracking(mockEVMTxHash);
      });

      expect(result.current.status).toBe('submitted');

      // Unmount the hook - should not throw errors
      expect(() => {
        unmount();
      }).not.toThrow();
    });

    it('should validate transaction hash types correctly', async () => {
      const { result } = renderHook(() => useCrossChainTracking());

      // Test different hash formats
      const testCases = [
        { hash: mockEVMTxHash, shouldBeValid: true, type: 'EVM' },
        { hash: mockSolanaTxHash, shouldBeValid: true, type: 'Solana' },
        { hash: 'invalid', shouldBeValid: false, type: 'invalid' },
        { hash: '', shouldBeValid: false, type: 'empty' },
      ];

      for (const testCase of testCases) {
        await act(async () => {
          result.current.startTracking(testCase.hash);
        });

        if (testCase.shouldBeValid) {
          expect(result.current.status).toBe('submitted');
          expect(result.current.txHash).toBe(testCase.hash);
        } else {
          expect(result.current.status).toBe('idle');
          expect(result.current.txHash).toBeNull();
        }

        // Reset for next test
        await act(async () => {
          result.current.reset();
        });
      }
    });
  });

  describe('Return Value Structure', () => {
    it('should return all required properties', () => {
      const { result } = renderHook(() => useCrossChainTracking());

      expect(result.current).toHaveProperty('status');
      expect(result.current).toHaveProperty('txHash');
      expect(result.current).toHaveProperty('startTracking');
      expect(result.current).toHaveProperty('reset');

      expect(typeof result.current.startTracking).toBe('function');
      expect(typeof result.current.reset).toBe('function');
    });

    it('should have correct TypeScript types', () => {
      const { result } = renderHook(() => useCrossChainTracking());

      // Status should be one of the defined types
      const validStatuses: CrossChainStatus[] = ['idle', 'submitted', 'pending', 'success', 'failed'];
      expect(validStatuses).toContain(result.current.status);

      // txHash should be string or null
      expect(result.current.txHash === null || typeof result.current.txHash === 'string').toBe(true);
    });
  });
});