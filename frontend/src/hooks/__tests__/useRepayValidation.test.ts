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
      // Reset call count for each test
      let callCount = 0;
      
      // Mock successful contract calls with valid data
      mockUseReadContract.mockImplementation((...args) => {
        callCount++;
        
        // Check function name to determine which call this is
        const config = args[0];
        if (config?.functionName === 'getBorrowBalance') {
          return { 
            data: parseUnits('5', 18), 
            error: undefined, 
            isLoading: false 
          };
        } else if (config?.functionName === 'getUserPositionData') {
          return { 
            data: [
              parseUnits('20000', 18), // totalCollateralValue in USD (18 decimals)
              parseUnits('10000', 18), // totalDebtValue in USD (18 decimals)
              parseUnits('2', 18),     // healthFactor (18 decimals)
            ], 
            error: undefined, 
            isLoading: false 
          };
        } else if (config?.functionName === 'getPrice') {
          // getPrice call - return invalid price for this test suite
          return { 
            data: BigInt(0), 
            error: undefined, 
            isLoading: false 
          };
        }
        return { data: undefined, error: undefined, isLoading: false };
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
        expect(result.current.error).toBe('Asset price is invalid or not available');
      });
    });

    it('should handle NaN asset price', async () => {
      mockUseReadContract.mockImplementation((...args) => {
        const config = args[0];
        if (config?.functionName === 'getBorrowBalance') {
          return { 
            data: parseUnits('5', 18), 
            error: undefined, 
            isLoading: false 
          };
        } else if (config?.functionName === 'getUserPositionData') {
          return { 
            data: [
              parseUnits('20000', 18),
              parseUnits('10000', 18),
              parseUnits('2', 18),
            ], 
            error: undefined, 
            isLoading: false 
          };
        } else if (config?.functionName === 'getPrice') {
          // getPrice call - return undefined (NaN when converted)
          return { 
            data: undefined, 
            error: undefined, 
            isLoading: false 
          };
        }
        return { data: undefined, error: undefined, isLoading: false };
      });

      const { result } = renderHook(() => useRepayValidation(defaultParams));

      await waitFor(() => {
        expect(result.current.isValid).toBe(false);
        expect(result.current.error).toBe('Asset price is invalid or not available');
      });
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
      mockUseReadContract.mockImplementation((...args) => {
        const config = args[0];
        if (config?.functionName === 'getBorrowBalance') {
          // getBorrowBalance call - zero debt
          return { 
            data: BigInt(0), 
            error: undefined, 
            isLoading: false 
          };
        } else if (config?.functionName === 'getUserPositionData') {
          // getUserPositionData call
          return { 
            data: [
              parseUnits('20000', 18),
              parseUnits('0', 18), // zero debt
              BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'), // max uint256
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

      const { result } = renderHook(() => useRepayValidation(defaultParams));

      await waitFor(() => {
        expect(result.current.isValid).toBe(false);
        expect(result.current.error).toContain('No debt to repay');
        expect(result.current.currentDebt).toBe('0');
        expect(result.current.currentHealthFactor).toBe(999.99); // No debt = high health factor
      });
    });

    it('should handle existing debt correctly', async () => {
      mockUseReadContract.mockImplementation((...args) => {
        const config = args[0];
        if (config?.functionName === 'getBorrowBalance') {
          // getBorrowBalance call
          return { 
            data: parseUnits('5', 18), 
            error: undefined, 
            isLoading: false 
          };
        } else if (config?.functionName === 'getUserPositionData') {
          // getUserPositionData call
          return { 
            data: [
              parseUnits('20000', 18),
              parseUnits('10000', 18),
              parseUnits('2', 18),
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

      const { result } = renderHook(() => useRepayValidation(defaultParams));

      await waitFor(() => {
        expect(result.current.currentDebt).toBe('5');
        expect(result.current.formattedCurrentDebt).toBe('5.000000');
        expect(result.current.currentHealthFactor).toBe(2); // 20000/10000
        expect(result.current.availableBalance).toBe('3');
        expect(result.current.maxRepayAmount).toBe('3'); // min(debt=5, balance=3)
      });
    });
  });

  describe('Amount Validation', () => {
    beforeEach(() => {
      // Setup successful contract calls
      mockUseReadContract.mockImplementation((...args) => {
        const config = args[0];
        if (config?.functionName === 'getBorrowBalance') {
          // getBorrowBalance call
          return { 
            data: parseUnits('5', 18), 
            error: undefined, 
            isLoading: false 
          };
        } else if (config?.functionName === 'getUserPositionData') {
          // getUserPositionData call
          return { 
            data: [
              parseUnits('20000', 18),
              parseUnits('10000', 18),
              parseUnits('2', 18),
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
        expect(result.current.newHealthFactor).toBeGreaterThan(2); // Should improve health factor
      });
    });

    it('should reject repayment amount exceeding balance', async () => {
      const { result } = renderHook(() => 
        useRepayValidation({ ...defaultParams, amount: '5' }) // Available balance is 3
      );

      await waitFor(() => {
        expect(result.current.isValid).toBe(false);
        expect(result.current.error).toContain('Insufficient balance');
        expect(result.current.error).toContain('Available: 3.000000');
      });
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
      mockUseReadContract.mockImplementation((...args) => {
        const config = args[0];
        if (config?.functionName === 'getBorrowBalance') {
          // getBorrowBalance call
          return { 
            data: parseUnits('5', 18), 
            error: undefined, 
            isLoading: false 
          };
        } else if (config?.functionName === 'getUserPositionData') {
          // getUserPositionData call
          return { 
            data: [
              parseUnits('20000', 18), // $20,000 collateral
              parseUnits('10000', 18), // $10,000 debt
              parseUnits('2', 18),     // 2.0 health factor
            ], 
            error: undefined, 
            isLoading: false 
          };
        } else if (config?.functionName === 'getPrice') {
          // getPrice call - $2000 per ETH
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
    });

    it('should calculate health factor improvement correctly', async () => {
      const { result } = renderHook(() => 
        useRepayValidation({ ...defaultParams, amount: '2' }) // Repay $4000 worth (2 ETH * $2000)
      );

      await waitFor(() => {
        expect(result.current.currentHealthFactor).toBe(2); // 20000/10000
        expect(result.current.newHealthFactor).toBeCloseTo(3.33, 1); // 20000/(10000-4000) ≈ 3.33
        expect(result.current.isValid).toBe(true);
      });
    });

    it('should handle full repayment health factor calculation', async () => {
      const { result } = renderHook(() => 
        useRepayValidation({ ...defaultParams, amount: '5' }) // Full repayment
      );

      await waitFor(() => {
        expect(result.current.currentHealthFactor).toBe(2);
        expect(result.current.newHealthFactor).toBe(999.99); // No debt = infinite health factor
        expect(result.current.isFullRepayment).toBe(true);
        expect(result.current.isValid).toBe(true);
      });
    });

    it('should handle zero collateral scenario', async () => {
      mockUseReadContract.mockImplementation((...args) => {
        const config = args[0];
        if (config?.functionName === 'getBorrowBalance') {
          // getBorrowBalance call
          return { 
            data: parseUnits('5', 18), 
            error: undefined, 
            isLoading: false 
          };
        } else if (config?.functionName === 'getUserPositionData') {
          // getUserPositionData call - zero collateral
          return { 
            data: [
              BigInt(0),               // No collateral
              parseUnits('10000', 18), // $10,000 debt
              BigInt(0),               // Zero health factor
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

      const { result } = renderHook(() => 
        useRepayValidation({ ...defaultParams, amount: '2' })
      );

      await waitFor(() => {
        expect(result.current.currentHealthFactor).toBe(0);
        expect(result.current.newHealthFactor).toBe(0); // Still zero with no collateral
      });
    });

    it('should handle debt equals zero after repayment', async () => {
      mockUseReadContract.mockImplementation((...args) => {
        const config = args[0];
        if (config?.functionName === 'getBorrowBalance') {
          // getBorrowBalance call - small debt
          return { 
            data: parseUnits('1', 18), 
            error: undefined, 
            isLoading: false 
          };
        } else if (config?.functionName === 'getUserPositionData') {
          // getUserPositionData call
          return { 
            data: [
              parseUnits('20000', 18), // $20,000 collateral
              parseUnits('2000', 18),  // $2,000 debt (1 ETH * $2000)
              parseUnits('10', 18),    // 10.0 health factor
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

      const { result } = renderHook(() => 
        useRepayValidation({ ...defaultParams, amount: '1' }) // Full repayment of 1 ETH
      );

      await waitFor(() => {
        expect(result.current.currentHealthFactor).toBe(10);
        expect(result.current.newHealthFactor).toBe(999.99); // Full repayment = infinite health factor
        expect(result.current.isFullRepayment).toBe(true);
      });
    });
  });

  describe('Chain Configuration', () => {
    it('should handle local chain configuration', async () => {
      mockUseReadContract.mockImplementation((...args) => {
        const config = args[0];
        if (config?.functionName === 'getBorrowBalance') {
          return { 
            data: parseUnits('5', 18), 
            error: undefined, 
            isLoading: false 
          };
        } else if (config?.functionName === 'getUserPositionData') {
          return { 
            data: [
              parseUnits('20000', 18),
              parseUnits('10000', 18),
              parseUnits('2', 18),
            ], 
            error: undefined, 
            isLoading: false 
          };
        } else if (config?.functionName === 'getPrice') {
          return { 
            data: parseUnits('2000', 18), 
            error: undefined, 
            isLoading: false 
          };
        }
        return { data: undefined, error: undefined, isLoading: false };
      });

      // Mock balance call for local chain
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
      });

      // Verify that useBalance was called with ZETA_TESTNET chain
      expect(mockUseBalance).toHaveBeenCalledWith(
        expect.objectContaining({
          chainId: SupportedChain.ZETA_TESTNET,
        })
      );
    });

    it('should handle external chain configuration', async () => {
      mockUseReadContract.mockImplementation((...args) => {
        const config = args[0];
        if (config?.functionName === 'getBorrowBalance') {
          return { 
            data: parseUnits('5', 18), 
            error: undefined, 
            isLoading: false 
          };
        } else if (config?.functionName === 'getUserPositionData') {
          return { 
            data: [
              parseUnits('20000', 18),
              parseUnits('10000', 18),
              parseUnits('2', 18),
            ], 
            error: undefined, 
            isLoading: false 
          };
        } else if (config?.functionName === 'getPrice') {
          return { 
            data: parseUnits('2000', 18), 
            error: undefined, 
            isLoading: false 
          };
        }
        return { data: undefined, error: undefined, isLoading: false };
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
      });

      // Verify that useBalance was called with external chain ID
      expect(mockUseBalance).toHaveBeenCalledWith(
        expect.objectContaining({
          chainId: 421614, // externalChainId from mockAsset
        })
      );
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