import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useReadContract } from 'wagmi';
import { useBorrowValidation } from '../useBorrowValidation';
import type { UserAssetData } from '../../components/dashboard/types';

// Mock wagmi
vi.mock('wagmi');

const mockUseReadContract = useReadContract as ReturnType<typeof vi.fn>;

describe('useBorrowValidation', () => {
  const mockUserAddress = '0x1234567890123456789012345678901234567890' as const;
  const mockProtocolAddress = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as const;
  const mockOracleAddress = '0x9876543210987654321098765432109876543210' as const;

  const mockAsset: UserAssetData = {
    address: '0x5678901234567890123456789012345678901234' as const,
    symbol: 'ETH.ARBI',
    unit: 'ETH',
    sourceChain: 'ARBI',
    suppliedBalance: '0',
    borrowedBalance: '0',
    formattedSuppliedBalance: '0.00',
    formattedBorrowedBalance: '0.00',
    suppliedUsdValue: '$0.00',
    borrowedUsdValue: '$0.00',
    price: '$2,000.00',
    isSupported: true,
    externalBalance: '0',
    formattedExternalBalance: '0.00',
    externalChainId: 421614,
    decimals: 18,
  };

  const defaultParams = {
    selectedAsset: mockAsset,
    amountToBorrow: '',
    universalLendingProtocol: mockProtocolAddress,
    priceOracle: mockOracleAddress,
    userAddress: mockUserAddress,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementation returns undefined
    mockUseReadContract.mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: false,
    });
  });

  describe('Basic Functionality', () => {
    it('should return default validation result when no asset selected', () => {
      const { result } = renderHook(() => 
        useBorrowValidation({ ...defaultParams, selectedAsset: null })
      );

      expect(result.current.isValid).toBe(false);
      expect(result.current.error).toBe('Missing required parameters');
      expect(result.current.canBorrow).toBe(false);
      expect(result.current.maxBorrowAmount).toBe('0');
      expect(result.current.currentHealthFactor).toBe(0);
      expect(result.current.estimatedHealthFactor).toBe(0);
      expect(result.current.borrowValueUsd).toBe(0);
    });

    it('should return default result when contract data is loading', () => {
      mockUseReadContract.mockReturnValue({
        data: undefined,
        error: undefined,
        isLoading: true,
      });

      const { result } = renderHook(() => useBorrowValidation(defaultParams));

      expect(result.current.isValid).toBe(false);
      expect(result.current.error).toBe('Error loading user data');
    });

    it('should handle contract errors gracefully', () => {
      mockUseReadContract.mockReturnValue({
        data: undefined,
        error: new Error('Contract call failed'),
        isLoading: false,
      });

      const { result } = renderHook(() => useBorrowValidation(defaultParams));

      expect(result.current.isValid).toBe(false);
      expect(result.current.error).toBe('Error loading user data');
    });
  });

  describe('Validation Logic', () => {
    beforeEach(() => {
      // Mock successful contract calls by default
      mockUseReadContract.mockImplementation((config) => {
        const functionName = config?.functionName;

        switch (functionName) {
          case 'maxAvailableBorrows':
            return {
              data: BigInt('10000000000000000000'), // 10 ETH available
              error: undefined,
              isLoading: false,
            };
          case 'getUserPositionData':
            return {
              data: [
                BigInt('5000000000000000000000'), // $5,000 collateral
                BigInt('2000000000000000000000'), // $2,000 debt
                BigInt('2500000000000000000'),    // 2.5 health factor
              ],
              error: undefined,
              isLoading: false,
            };
          case 'getPrice':
            return {
              data: BigInt('2000000000000000000000'), // $2,000 per ETH
              error: undefined,
              isLoading: false,
            };
          case 'canBorrow':
            return {
              data: true,
              error: undefined,
              isLoading: false,
            };
          default:
            return {
              data: undefined,
              error: undefined,
              isLoading: false,
            };
        }
      });
    });

    it('should validate successful borrow within limits', async () => {
      const { result } = renderHook(() => 
        useBorrowValidation({ ...defaultParams, amountToBorrow: '1.0' })
      );

      await waitFor(() => {
        expect(result.current.isValid).toBe(true);
        expect(result.current.error).toBe('');
        expect(result.current.canBorrow).toBe(true);
        expect(result.current.maxBorrowAmount).toBe('10.0');
        expect(result.current.currentHealthFactor).toBe(2.5);
        expect(result.current.borrowValueUsd).toBe(2000);
      });
    });

    it('should reject borrow when no collateral supplied', async () => {
      mockUseReadContract.mockImplementation((config) => {
        const functionName = config?.functionName;

        switch (functionName) {
          case 'maxAvailableBorrows':
            return { data: BigInt('0'), error: undefined, isLoading: false };
          case 'getUserPositionData':
            return {
              data: [
                BigInt('0'), // $0 collateral
                BigInt('0'), // $0 debt
                BigInt('0'), // 0 health factor
              ],
              error: undefined,
              isLoading: false,
            };
          case 'getPrice':
            return { data: BigInt('2000000000000000000000'), error: undefined, isLoading: false };
          case 'canBorrow':
            return { data: false, error: undefined, isLoading: false };
          default:
            return { data: undefined, error: undefined, isLoading: false };
        }
      });

      const { result } = renderHook(() => 
        useBorrowValidation({ ...defaultParams, amountToBorrow: '1.0' })
      );

      await waitFor(() => {
        expect(result.current.isValid).toBe(false);
        expect(result.current.error).toBe('No collateral supplied. Please supply collateral first.');
        expect(result.current.canBorrow).toBe(false);
      });
    });

    it('should reject borrow when amount exceeds max available', async () => {
      mockUseReadContract.mockImplementation((config) => {
        const functionName = config?.functionName;

        switch (functionName) {
          case 'maxAvailableBorrows':
            return { data: BigInt('1000000000000000000'), error: undefined, isLoading: false }; // 1 ETH max
          case 'getUserPositionData':
            return {
              data: [
                BigInt('5000000000000000000000'), // $5,000 collateral
                BigInt('2000000000000000000000'), // $2,000 debt
                BigInt('2500000000000000000'),    // 2.5 health factor
              ],
              error: undefined,
              isLoading: false,
            };
          case 'getPrice':
            return { data: BigInt('2000000000000000000000'), error: undefined, isLoading: false };
          case 'canBorrow':
            return { data: false, error: undefined, isLoading: false };
          default:
            return { data: undefined, error: undefined, isLoading: false };
        }
      });

      const { result } = renderHook(() => 
        useBorrowValidation({ ...defaultParams, amountToBorrow: '2.0' })
      );

      await waitFor(() => {
        expect(result.current.isValid).toBe(false);
        expect(result.current.error).toContain('Amount exceeds maximum available');
        expect(result.current.error).toContain('Max borrow: 1.000000 ETH');
      });
    });

    it('should reject borrow when no tokens available in protocol', async () => {
      mockUseReadContract.mockImplementation((config) => {
        const functionName = config?.functionName;

        switch (functionName) {
          case 'maxAvailableBorrows':
            return { data: BigInt('0'), error: undefined, isLoading: false }; // 0 ETH available
          case 'getUserPositionData':
            return {
              data: [
                BigInt('5000000000000000000000'), // $5,000 collateral
                BigInt('2000000000000000000000'), // $2,000 debt
                BigInt('2500000000000000000'),    // 2.5 health factor
              ],
              error: undefined,
              isLoading: false,
            };
          case 'getPrice':
            return { data: BigInt('2000000000000000000000'), error: undefined, isLoading: false };
          case 'canBorrow':
            return { data: false, error: undefined, isLoading: false };
          default:
            return { data: undefined, error: undefined, isLoading: false };
        }
      });

      const { result } = renderHook(() => 
        useBorrowValidation({ ...defaultParams, amountToBorrow: '1.0' })
      );

      await waitFor(() => {
        expect(result.current.isValid).toBe(false);
        expect(result.current.error).toBe('No tokens available for borrowing in the protocol.');
      });
    });

    it('should reject borrow when health factor would be too low', async () => {
      mockUseReadContract.mockImplementation((config) => {
        const functionName = config?.functionName;

        switch (functionName) {
          case 'maxAvailableBorrows':
            return { data: BigInt('10000000000000000000'), error: undefined, isLoading: false };
          case 'getUserPositionData':
            return {
              data: [
                BigInt('3000000000000000000000'), // $3,000 collateral
                BigInt('2000000000000000000000'), // $2,000 debt
                BigInt('1500000000000000000'),    // 1.5 health factor
              ],
              error: undefined,
              isLoading: false,
            };
          case 'getPrice':
            return { data: BigInt('2000000000000000000000'), error: undefined, isLoading: false };
          case 'canBorrow':
            return { data: false, error: undefined, isLoading: false };
          default:
            return { data: undefined, error: undefined, isLoading: false };
        }
      });

      const { result } = renderHook(() => 
        useBorrowValidation({ ...defaultParams, amountToBorrow: '1.0' })
      );

      await waitFor(() => {
        expect(result.current.isValid).toBe(false);
        expect(result.current.error).toContain('Health factor too low');
        expect(result.current.error).toContain('Minimum required: 1.50');
      });
    });

    it('should reject borrow when contract validation fails', async () => {
      mockUseReadContract.mockImplementation((config) => {
        const functionName = config?.functionName;

        switch (functionName) {
          case 'maxAvailableBorrows':
            return { data: BigInt('10000000000000000000'), error: undefined, isLoading: false };
          case 'getUserPositionData':
            return {
              data: [
                BigInt('5000000000000000000000'), // $5,000 collateral
                BigInt('2000000000000000000000'), // $2,000 debt
                BigInt('2500000000000000000'),    // 2.5 health factor
              ],
              error: undefined,
              isLoading: false,
            };
          case 'getPrice':
            return { data: BigInt('2000000000000000000000'), error: undefined, isLoading: false };
          case 'canBorrow':
            return { data: false, error: undefined, isLoading: false };
          default:
            return { data: undefined, error: undefined, isLoading: false };
        }
      });

      const { result } = renderHook(() => 
        useBorrowValidation({ ...defaultParams, amountToBorrow: '1.0' })
      );

      await waitFor(() => {
        expect(result.current.isValid).toBe(false);
        expect(result.current.error).toBe('Contract validation failed. Please check your collateral and try a smaller amount.');
        expect(result.current.canBorrow).toBe(false);
      });
    });
  });

  describe('Health Factor Calculations', () => {
    beforeEach(() => {
      mockUseReadContract.mockImplementation((config) => {
        const functionName = config?.functionName;

        switch (functionName) {
          case 'maxAvailableBorrows':
            return { data: BigInt('10000000000000000000'), error: undefined, isLoading: false };
          case 'getPrice':
            return { data: BigInt('2000000000000000000000'), error: undefined, isLoading: false };
          case 'canBorrow':
            return { data: true, error: undefined, isLoading: false };
          default:
            return { data: undefined, error: undefined, isLoading: false };
        }
      });
    });

    it('should handle infinite health factor when no debt', async () => {
      mockUseReadContract.mockImplementation((config) => {
        const functionName = config?.functionName;

        if (functionName === 'getUserPositionData') {
          return {
            data: [
              BigInt('5000000000000000000000'), // $5,000 collateral
              BigInt('0'),                     // $0 debt
              BigInt('0'),                     // 0 health factor (infinite)
            ],
            error: undefined,
            isLoading: false,
          };
        }

        return {
          data: BigInt('10000000000000000000'),
          error: undefined,
          isLoading: false,
        };
      });

      const { result } = renderHook(() => 
        useBorrowValidation({ ...defaultParams, amountToBorrow: '1.0' })
      );

      await waitFor(() => {
        expect(result.current.currentHealthFactor).toBe(999.99);
        expect(result.current.estimatedHealthFactor).toBe(2.5); // 5000 / (0 + 2000)
      });
    });

    it('should calculate estimated health factor correctly', async () => {
      mockUseReadContract.mockImplementation((config) => {
        const functionName = config?.functionName;

        if (functionName === 'getUserPositionData') {
          return {
            data: [
              BigInt('6000000000000000000000'), // $6,000 collateral
              BigInt('2000000000000000000000'), // $2,000 debt
              BigInt('3000000000000000000'),    // 3.0 health factor
            ],
            error: undefined,
            isLoading: false,
          };
        }

        return {
          data: BigInt('10000000000000000000'),
          error: undefined,
          isLoading: false,
        };
      });

      const { result } = renderHook(() => 
        useBorrowValidation({ ...defaultParams, amountToBorrow: '1.0' })
      );

      await waitFor(() => {
        expect(result.current.currentHealthFactor).toBe(3.0);
        expect(result.current.estimatedHealthFactor).toBe(1.5); // 6000 / (2000 + 2000)
        expect(result.current.borrowValueUsd).toBe(2000);
      });
    });

    it('should not calculate estimated health factor when no amount entered', async () => {
      mockUseReadContract.mockImplementation((config) => {
        const functionName = config?.functionName;

        if (functionName === 'getUserPositionData') {
          return {
            data: [
              BigInt('6000000000000000000000'), // $6,000 collateral
              BigInt('2000000000000000000000'), // $2,000 debt
              BigInt('3000000000000000000'),    // 3.0 health factor
            ],
            error: undefined,
            isLoading: false,
          };
        }

        return {
          data: BigInt('10000000000000000000'),
          error: undefined,
          isLoading: false,
        };
      });

      const { result } = renderHook(() => 
        useBorrowValidation({ ...defaultParams, amountToBorrow: '' })
      );

      await waitFor(() => {
        expect(result.current.currentHealthFactor).toBe(3.0);
        expect(result.current.estimatedHealthFactor).toBe(3.0); // Same as current
        expect(result.current.borrowValueUsd).toBe(0);
        expect(result.current.isValid).toBe(false); // No amount means not valid
      });
    });
  });

  describe('Price Handling', () => {
    it('should handle invalid asset price', async () => {
      mockUseReadContract.mockImplementation((config) => {
        const functionName = config?.functionName;

        switch (functionName) {
          case 'maxAvailableBorrows':
            return { data: BigInt('10000000000000000000'), error: undefined, isLoading: false };
          case 'getUserPositionData':
            return {
              data: [
                BigInt('5000000000000000000000'), // $5,000 collateral
                BigInt('2000000000000000000000'), // $2,000 debt
                BigInt('2500000000000000000'),    // 2.5 health factor
              ],
              error: undefined,
              isLoading: false,
            };
          case 'getPrice':
            return { data: BigInt('0'), error: undefined, isLoading: false }; // Invalid price
          case 'canBorrow':
            return { data: true, error: undefined, isLoading: false };
          default:
            return { data: undefined, error: undefined, isLoading: false };
        }
      });

      const { result } = renderHook(() => 
        useBorrowValidation({ ...defaultParams, amountToBorrow: '1.0' })
      );

      await waitFor(() => {
        expect(result.current.isValid).toBe(false);
        expect(result.current.error).toBe('Asset price is invalid or not available');
      });
    });

    it('should handle missing asset price', async () => {
      mockUseReadContract.mockImplementation((config) => {
        const functionName = config?.functionName;

        switch (functionName) {
          case 'getPrice':
            return { data: undefined, error: undefined, isLoading: false }; // Missing price
          default:
            return { data: BigInt('10000000000000000000'), error: undefined, isLoading: false };
        }
      });

      const { result } = renderHook(() => 
        useBorrowValidation({ ...defaultParams, amountToBorrow: '1.0' })
      );

      await waitFor(() => {
        expect(result.current.isValid).toBe(false);
        expect(result.current.error).toBe('Asset price is invalid or not available');
      });
    });
  });

  describe('Empty Amount Handling', () => {
    beforeEach(() => {
      mockUseReadContract.mockImplementation((config) => {
        const functionName = config?.functionName;

        switch (functionName) {
          case 'maxAvailableBorrows':
            return { data: BigInt('10000000000000000000'), error: undefined, isLoading: false };
          case 'getUserPositionData':
            return {
              data: [
                BigInt('5000000000000000000000'), // $5,000 collateral
                BigInt('2000000000000000000000'), // $2,000 debt
                BigInt('2500000000000000000'),    // 2.5 health factor
              ],
              error: undefined,
              isLoading: false,
            };
          case 'getPrice':
            return { data: BigInt('2000000000000000000000'), error: undefined, isLoading: false };
          case 'canBorrow':
            return { data: true, error: undefined, isLoading: false };
          default:
            return { data: undefined, error: undefined, isLoading: false };
        }
      });
    });

    it('should handle empty amount input', async () => {
      const { result } = renderHook(() => 
        useBorrowValidation({ ...defaultParams, amountToBorrow: '' })
      );

      await waitFor(() => {
        expect(result.current.isValid).toBe(false); // Not valid when no amount
        expect(result.current.error).toBe(''); // But no error message
        expect(result.current.maxBorrowAmount).toBe('10.0');
        expect(result.current.borrowValueUsd).toBe(0);
      });
    });

    it('should handle zero amount input', async () => {
      const { result } = renderHook(() => 
        useBorrowValidation({ ...defaultParams, amountToBorrow: '0' })
      );

      await waitFor(() => {
        expect(result.current.isValid).toBe(false); // Not valid when zero amount
        expect(result.current.error).toBe(''); // But no error message
        expect(result.current.borrowValueUsd).toBe(0);
      });
    });

    it('should handle whitespace-only amount input', async () => {
      const { result } = renderHook(() => 
        useBorrowValidation({ ...defaultParams, amountToBorrow: '   ' })
      );

      await waitFor(() => {
        expect(result.current.isValid).toBe(false); // Not valid when whitespace only
        expect(result.current.error).toBe(''); // But no error message
        expect(result.current.borrowValueUsd).toBe(0);
      });
    });
  });

  describe('Different Asset Decimals', () => {
    it('should handle USDC with 6 decimals', async () => {
      const usdcAsset: UserAssetData = {
        ...mockAsset,
        symbol: 'USDC.ARBI',
        unit: 'USDC',
        decimals: 6,
      };

      mockUseReadContract.mockImplementation((config) => {
        const functionName = config?.functionName;

        switch (functionName) {
          case 'maxAvailableBorrows':
            return { data: BigInt('10000000000'), error: undefined, isLoading: false }; // 10,000 USDC (6 decimals)
          case 'getUserPositionData':
            return {
              data: [
                BigInt('5000000000000000000000'), // $5,000 collateral
                BigInt('2000000000000000000000'), // $2,000 debt
                BigInt('2500000000000000000'),    // 2.5 health factor
              ],
              error: undefined,
              isLoading: false,
            };
          case 'getPrice':
            return { data: BigInt('1000000000000000000'), error: undefined, isLoading: false }; // $1 per USDC
          case 'canBorrow':
            return { data: true, error: undefined, isLoading: false };
          default:
            return { data: undefined, error: undefined, isLoading: false };
        }
      });

      const { result } = renderHook(() => 
        useBorrowValidation({ 
          ...defaultParams, 
          selectedAsset: usdcAsset,
          amountToBorrow: '1000.0' 
        })
      );

      await waitFor(() => {
        expect(result.current.isValid).toBe(true);
        expect(result.current.maxBorrowAmount).toBe('10000.0');
        expect(result.current.borrowValueUsd).toBe(1000);
      });
    });
  });
});