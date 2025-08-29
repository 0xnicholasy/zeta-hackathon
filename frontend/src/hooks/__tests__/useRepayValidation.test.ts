import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { parseUnits } from 'viem';
import { useRepayValidation } from '../useRepayValidation';
import type { UserAssetData } from '../../components/dashboard/types';
import { SupportedChain } from '../../contracts/deployments';

// Mock wagmi
vi.mock('wagmi', () => ({
  useAccount: vi.fn(),
  useReadContract: vi.fn(),
  useBalance: vi.fn(),
}));

vi.mock('viem', () => ({
  parseUnits: vi.fn((value: string, decimals: number) => {
    const [whole, fraction = ''] = value.split('.');
    const paddedFraction = fraction.padEnd(decimals, '0').slice(0, decimals);
    return BigInt(whole + paddedFraction);
  }),
}));

vi.mock('@/contracts/typechain-types', () => ({
  UniversalLendingProtocol__factory: {
    abi: [],
  },
  IPriceOracle__factory: {
    abi: [],
  },
}));

vi.mock('@/types/address', () => ({
  safeEVMAddressOrZeroAddress: vi.fn((addr) => addr || '0x0000000000000000000000000000000000000000'),
  ZERO_ADDRESS: '0x0000000000000000000000000000000000000000',
  isZeroAddress: vi.fn((addr) => addr?.toLowerCase() === '0x0000000000000000000000000000000000000000'),
  addressesEqual: vi.fn((a, b) => a?.toLowerCase() === b?.toLowerCase()),
}));

vi.mock('../../contracts/deployments', () => ({
  SupportedChain: {
    ZETA_TESTNET: 7001,
  },
  getTokenAddress: vi.fn(() => '0x1234567890123456789012345678901234567890'),
}));

// Import after mocking
import { useReadContract, useBalance, useAccount } from 'wagmi';

const mockUseReadContract = useReadContract as ReturnType<typeof vi.fn>;
const mockUseBalance = useBalance as ReturnType<typeof vi.fn>;
const mockUseAccount = useAccount as ReturnType<typeof vi.fn>;

describe('useRepayValidation', () => {
  const mockUserAddress = '0x1234567890123456789012345678901234567890' as const;
  const mockProtocolAddress = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as const;
  const mockOracleAddress = '0x9876543210987654321098765432109876543210' as const;

  const mockAsset: UserAssetData = {
    address: '0x5678901234567890123456789012345678901234' as const,
    symbol: 'ETH.ARBI',
    unit: 'ETH',
    sourceChain: 'ARBI',
    suppliedBalance: parseUnits('10', 18).toString(),
    borrowedBalance: parseUnits('5', 18).toString(),
    formattedSuppliedBalance: '10.000000',
    formattedBorrowedBalance: '5.000000',
    suppliedUsdValue: '$20,000.00',
    borrowedUsdValue: '$10,000.00',
    price: '$2,000.00',
    isSupported: true,
    externalBalance: parseUnits('3', 18).toString(),
    formattedExternalBalance: '3.000000',
    externalChainId: 421614,
    decimals: 18,
  };

  const defaultParams = {
    selectedAsset: mockAsset,
    amount: '',
    universalLendingProtocol: mockProtocolAddress,
    priceOracle: mockOracleAddress,
    userAddress: mockUserAddress,
    isLocal: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
    mockUseAccount.mockReturnValue({
      address: mockUserAddress,
      isConnected: true,
    });

    mockUseReadContract.mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: false,
    });

    mockUseBalance.mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: false,
    });
  });

  describe('Basic Functionality', () => {
    it('should return default validation result when no asset selected', () => {
      const { result } = renderHook(() => 
        useRepayValidation({ ...defaultParams, selectedAsset: null })
      );

      expect(result.current.isValid).toBe(false);
      expect(result.current.error).toBe('Missing required parameters');
      expect(result.current.maxRepayAmount).toBe('0');
      expect(result.current.currentDebt).toBe('0');
      expect(result.current.currentHealthFactor).toBe(0);
      expect(result.current.newHealthFactor).toBe(0);
      expect(result.current.isFullRepayment).toBe(false);
    });

    it('should handle contract data loading errors', () => {
      mockUseReadContract.mockReturnValue({
        data: undefined,
        error: new Error('Contract call failed'),
        isLoading: false,
      });

      const { result } = renderHook(() => useRepayValidation(defaultParams));

      expect(result.current.isValid).toBe(false);
      expect(result.current.error).toBe('Error loading user data');
    });

    it('should handle loading state when data is undefined', () => {
      mockUseReadContract.mockReturnValue({
        data: undefined,
        error: undefined,
        isLoading: false,
      });

      mockUseBalance.mockReturnValue({
        data: undefined,
        error: undefined,
        isLoading: false,
      });

      const { result } = renderHook(() => useRepayValidation(defaultParams));

      expect(result.current.isValid).toBe(false);
      expect(result.current.error).toBe('Loading data...');
    });
  });

  describe('Asset Price Validation', () => {
    beforeEach(() => {
      // Simplified mock setup
      mockUseReadContract.mockReturnValue({
        data: BigInt(0), // Invalid price for this test suite
        error: undefined,
        isLoading: false,
      });

      mockUseBalance.mockReturnValue({
        data: { value: parseUnits('3', 18), decimals: 18 },
        error: undefined,
        isLoading: false,
      });
    });

    it('should handle invalid asset price', async () => {
      const { result } = renderHook(() => useRepayValidation(defaultParams));

      await waitFor(() => {
        expect(result.current.isValid).toBe(false);
      }, { timeout: 3000 });
    });

    it('should handle NaN asset price', async () => {
      mockUseReadContract.mockReturnValue({
        data: undefined, // NaN when converted
        error: undefined,
        isLoading: false,
      });

      const { result } = renderHook(() => useRepayValidation(defaultParams));

      await waitFor(() => {
        expect(result.current.isValid).toBe(false);
      }, { timeout: 3000 });
    });
  });

  describe('Debt Validation', () => {
    beforeEach(() => {
      mockUseBalance.mockReturnValue({
        data: { value: parseUnits('3', 18), decimals: 18 },
        error: undefined,
        isLoading: false,
      });
    });

    it('should handle zero debt scenario', async () => {
      mockUseReadContract.mockReturnValue({
        data: BigInt(0), // Zero debt
        error: undefined,
        isLoading: false,
      });

      const { result } = renderHook(() => useRepayValidation(defaultParams));

      await waitFor(() => {
        expect(result.current.isValid).toBe(false);
        expect(result.current.currentDebt).toBe('0');
      }, { timeout: 3000 });
    });

    it('should handle existing debt correctly', async () => {
      mockUseReadContract.mockReturnValue({
        data: parseUnits('5', 18),
        error: undefined,
        isLoading: false,
      });

      const { result } = renderHook(() => useRepayValidation(defaultParams));

      await waitFor(() => {
        expect(result.current.currentDebt).toBe('5');
        expect(typeof result.current.formattedCurrentDebt).toBe('string');
        expect(typeof result.current.availableBalance).toBe('string');
      }, { timeout: 3000 });
    });
  });

  describe('Amount Validation', () => {
    beforeEach(() => {
      // Simplified successful mock
      mockUseReadContract.mockReturnValue({
        data: parseUnits('5', 18),
        error: undefined,
        isLoading: false,
      });

      mockUseBalance.mockReturnValue({
        data: { value: parseUnits('3', 18), decimals: 18 },
        error: undefined,
        isLoading: false,
      });
    });

    it('should handle empty amount', async () => {
      const { result } = renderHook(() => 
        useRepayValidation({ ...defaultParams, amount: '' })
      );

      await waitFor(() => {
        expect(result.current.isValid).toBe(false);
        expect(result.current.error).toBe('');
        expect(result.current.isFullRepayment).toBe(false);
      });
    });

    it('should handle zero amount', async () => {
      const { result } = renderHook(() => 
        useRepayValidation({ ...defaultParams, amount: '0' })
      );

      await waitFor(() => {
        expect(result.current.isValid).toBe(false);
        expect(result.current.error).toBe('');
        expect(result.current.isFullRepayment).toBe(false);
      });
    });

    it('should validate successful repayment with valid amount', async () => {
      const { result } = renderHook(() => 
        useRepayValidation({ ...defaultParams, amount: '2' })
      );

      await waitFor(() => {
        expect(result.current.isValid).toBe(true);
        expect(result.current.error).toBe('');
        expect(result.current.isFullRepayment).toBe(false);
      }, { timeout: 3000 });
    });

    it('should reject repayment amount exceeding balance', async () => {
      const { result } = renderHook(() => 
        useRepayValidation({ ...defaultParams, amount: '5' }) // Available balance is 3
      );

      await waitFor(() => {
        expect(result.current.isValid).toBe(false);
        expect(result.current.error).toContain('Insufficient balance');
      }, { timeout: 3000 });
    });

    it('should reject repayment amount exceeding debt', async () => {
      // Mock higher balance
      mockUseBalance.mockReturnValue({
        data: { value: parseUnits('10', 18), decimals: 18 },
        error: undefined,
        isLoading: false,
      });

      const { result } = renderHook(() => 
        useRepayValidation({ ...defaultParams, amount: '7' }) // Debt is 5
      );

      await waitFor(() => {
        expect(result.current.isValid).toBe(false);
        expect(result.current.error).toContain('Repay amount exceeds debt');
        expect(result.current.error).toContain('Current debt: 5.000000');
      });
    });
  });

  describe('Health Factor Calculations', () => {
    beforeEach(() => {
      mockUseReadContract.mockReturnValue({
        data: parseUnits('5', 18),
        error: undefined,
        isLoading: false,
      });

      mockUseBalance.mockReturnValue({
        data: { value: parseUnits('10', 18), decimals: 18 },
        error: undefined,
        isLoading: false,
      });
    });

    it('should calculate health factor improvement correctly', async () => {
      const { result } = renderHook(() => 
        useRepayValidation({ ...defaultParams, amount: '2' })
      );

      await waitFor(() => {
        expect(typeof result.current.currentHealthFactor).toBe('number');
        expect(typeof result.current.newHealthFactor).toBe('number');
        expect(result.current.isValid).toBe(true);
      }, { timeout: 3000 });
    });

    it('should handle full repayment health factor calculation', async () => {
      const { result } = renderHook(() => 
        useRepayValidation({ ...defaultParams, amount: '5' })
      );

      await waitFor(() => {
        expect(typeof result.current.currentHealthFactor).toBe('number');
        expect(typeof result.current.newHealthFactor).toBe('number');
        expect(result.current.isFullRepayment).toBe(true);
        expect(result.current.isValid).toBe(true);
      }, { timeout: 3000 });
    });

    it('should handle zero collateral scenario', async () => {
      mockUseReadContract.mockReturnValue({
        data: BigInt(0), // Zero collateral scenario
        error: undefined,
        isLoading: false,
      });

      const { result } = renderHook(() => 
        useRepayValidation({ ...defaultParams, amount: '2' })
      );

      await waitFor(() => {
        expect(typeof result.current.currentHealthFactor).toBe('number');
        expect(typeof result.current.newHealthFactor).toBe('number');
      }, { timeout: 3000 });
    });

    it('should handle debt equals zero after repayment', async () => {
      mockUseReadContract.mockReturnValue({
        data: parseUnits('1', 18), // Small debt
        error: undefined,
        isLoading: false,
      });

      const { result } = renderHook(() => 
        useRepayValidation({ ...defaultParams, amount: '1' })
      );

      await waitFor(() => {
        expect(typeof result.current.currentHealthFactor).toBe('number');
        expect(typeof result.current.newHealthFactor).toBe('number');
        expect(result.current.isFullRepayment).toBe(true);
      }, { timeout: 3000 });
    });
  });

  describe('Chain Configuration', () => {
    it('should handle local chain configuration', async () => {
      mockUseReadContract.mockReturnValue({
        data: parseUnits('5', 18),
        error: undefined,
        isLoading: false,
      });

      mockUseBalance.mockReturnValue({
        data: { value: parseUnits('3', 18), decimals: 18 },
        error: undefined,
        isLoading: false,
      });

      const { result } = renderHook(() => 
        useRepayValidation({ ...defaultParams, isLocal: true })
      );

      await waitFor(() => {
        expect(result.current.availableBalance).toBe('3');
        expect(result.current.currentDebt).toBe('5');
      }, { timeout: 3000 });

      expect(mockUseBalance).toHaveBeenCalled();
    });

    it('should handle external chain configuration', async () => {
      mockUseReadContract.mockReturnValue({
        data: parseUnits('5', 18),
        error: undefined,
        isLoading: false,
      });

      mockUseBalance.mockReturnValue({
        data: { value: parseUnits('3', 18), decimals: 18 },
        error: undefined,
        isLoading: false,
      });

      const { result } = renderHook(() => 
        useRepayValidation({ ...defaultParams, isLocal: false })
      );

      await waitFor(() => {
        expect(result.current.availableBalance).toBe('3');
      }, { timeout: 3000 });

      expect(mockUseBalance).toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle undefined position data gracefully', async () => {
      mockUseReadContract.mockReturnValue({
        data: undefined,
        error: undefined,
        isLoading: false,
      });

      mockUseBalance.mockReturnValue({
        data: undefined,
        error: undefined,
        isLoading: false,
      });

      const { result } = renderHook(() => useRepayValidation(defaultParams));

      await waitFor(() => {
        expect(result.current.isValid).toBe(false);
        expect(result.current.error).toBe('Loading data...');
      });
    });

    it('should handle very large debt values', async () => {
      mockUseReadContract.mockImplementation((...args) => {
        const config = args[0];
        if (config?.functionName === 'getBorrowBalance') {
          // getBorrowBalance call - very large debt
          return { 
            data: parseUnits('1000000', 18), 
            error: undefined, 
            isLoading: false 
          };
        } else if (config?.functionName === 'getUserPositionData') {
          // getUserPositionData call
          return { 
            data: [
              parseUnits('3000000000', 18), // $3B collateral
              parseUnits('2000000000', 18), // $2B debt
              parseUnits('1.5', 18),        // 1.5 health factor
            ], 
            error: undefined, 
            isLoading: false 
          };
        } else if (config?.functionName === 'getPrice') {
          // getPrice call
          return { 
            data: parseUnits('2000', 18), 
            error: undefined, 
            isLoading: false 
          };
        }
        return { data: undefined, error: undefined, isLoading: false };
      });

      mockUseBalance.mockReturnValue({
        data: { value: parseUnits('10', 18), decimals: 18 },
        error: undefined,
        isLoading: false,
      });

      const { result } = renderHook(() => 
        useRepayValidation({ ...defaultParams, amount: '5' })
      );

      await waitFor(() => {
        expect(result.current.currentDebt).toBe('1000000');
        expect(result.current.availableBalance).toBe('10');
        expect(result.current.maxRepayAmount).toBe('10'); // Limited by balance
        expect(result.current.isValid).toBe(true);
      });
    });
  });
});