import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useReadContract } from 'wagmi';
import { parseUnits } from 'viem';
import { useWithdrawValidation } from '../useWithdrawValidation';
import type { UserAssetData } from '../../components/dashboard/types';
import { ZERO_ADDRESS } from '@/types/address';

// Mock wagmi
vi.mock('wagmi');

const mockUseReadContract = useReadContract as ReturnType<typeof vi.fn>;

describe('useWithdrawValidation', () => {
  const mockUserAddress = '0x1234567890123456789012345678901234567890' as const;
  const mockProtocolAddress = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as const;
  const mockGasTokenAddress = '0x9876543210987654321098765432109876543210' as const;

  const mockAsset: UserAssetData = {
    address: '0x5678901234567890123456789012345678901234' as const,
    symbol: 'ETH.ARBI',
    unit: 'ETH',
    sourceChain: 'ARBI',
    suppliedBalance: parseUnits('10', 18).toString(),
    borrowedBalance: '0',
    formattedSuppliedBalance: '10.000000',
    formattedBorrowedBalance: '0.00',
    suppliedUsdValue: '$20,000.00',
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
    amount: '',
    universalLendingProtocol: mockProtocolAddress,
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
        useWithdrawValidation({ ...defaultParams, selectedAsset: null })
      );

      expect(result.current.isValid).toBe(false);
      expect(result.current.error).toBe('Missing required parameters');
      expect(result.current.needsApproval).toBe(false);
      expect(result.current.receiveAmount).toBe(BigInt(0));
      expect(result.current.formattedReceiveAmount).toBe('0');
    });

    it('should handle missing required parameters', () => {
      const { result } = renderHook(() => 
        useWithdrawValidation({ 
          selectedAsset: null,
          amount: '5',
          universalLendingProtocol: mockProtocolAddress,
          userAddress: mockUserAddress,
        })
      );

      expect(result.current.isValid).toBe(false);
      expect(result.current.error).toBe('Missing required parameters');
    });

    it('should handle contract data loading state', () => {
      mockUseReadContract.mockReturnValue({
        data: undefined,
        error: undefined,
        isLoading: false,
      });

      const { result } = renderHook(() => useWithdrawValidation(defaultParams));

      expect(result.current.isValid).toBe(false);
      expect(result.current.error).toBe('Loading data...');
    });

    it('should handle contract errors gracefully', () => {
      mockUseReadContract.mockReturnValue({
        data: undefined,
        error: new Error('Contract call failed'),
        isLoading: false,
      });

      const { result } = renderHook(() => useWithdrawValidation(defaultParams));

      expect(result.current.isValid).toBe(false);
      expect(result.current.error).toBe('Error loading data');
    });
  });

  describe('Amount Validation', () => {
    beforeEach(() => {
      // Mock successful contract calls by default
      mockUseReadContract.mockImplementation((config) => {
        const functionName = config?.functionName;
        
        if (functionName === 'canWithdraw') {
          return { data: true, error: undefined, isLoading: false };
        } else if (functionName === 'getWithdrawGasFee') {
          return { 
            data: [mockGasTokenAddress, parseUnits('0.01', 18)], 
            error: undefined, 
            isLoading: false 
          };
        } else if (functionName === 'balanceOf') {
          return { 
            data: parseUnits('1', 18), 
            error: undefined, 
            isLoading: false 
          };
        } else if (functionName === 'allowance') {
          return { 
            data: parseUnits('10', 18), 
            error: undefined, 
            isLoading: false 
          };
        }
        
        return { data: undefined, error: undefined, isLoading: false };
      });
    });

    it('should handle empty amount gracefully', () => {
      const { result } = renderHook(() => 
        useWithdrawValidation({ ...defaultParams, amount: '' })
      );

      expect(result.current.isValid).toBe(false);
      expect(result.current.error).toBe('');
      expect(result.current.receiveAmount).toBe(BigInt(0));
    });

    it('should handle zero amount', () => {
      const { result } = renderHook(() => 
        useWithdrawValidation({ ...defaultParams, amount: '0' })
      );

      expect(result.current.isValid).toBe(false);
      expect(result.current.error).toBe('');
    });

    it('should validate positive amount successfully', async () => {
      const { result } = renderHook(() => 
        useWithdrawValidation({ ...defaultParams, amount: '5' })
      );

      await waitFor(() => {
        expect(result.current.isValid).toBe(true);
        expect(result.current.error).toBe('');
        expect(result.current.receiveAmount).toBe(parseUnits('5', 18));
      });
    });
  });

  describe('Health Factor Validation', () => {
    it('should reject withdrawal when health factor check fails', async () => {
      mockUseReadContract.mockImplementation((config) => {
        const functionName = config?.functionName;
        
        if (functionName === 'canWithdraw') {
          return { data: false, error: undefined, isLoading: false };
        } else if (functionName === 'getWithdrawGasFee') {
          return { 
            data: [mockGasTokenAddress, parseUnits('0.01', 18)], 
            error: undefined, 
            isLoading: false 
          };
        }
        
        return { data: undefined, error: undefined, isLoading: false };
      });

      const { result } = renderHook(() => 
        useWithdrawValidation({ ...defaultParams, amount: '5' })
      );

      await waitFor(() => {
        expect(result.current.isValid).toBe(false);
        expect(result.current.error).toBe('Withdrawal would break collateral requirements');
      });
    });

    it('should allow withdrawal when health factor check passes', async () => {
      mockUseReadContract.mockImplementation((config) => {
        const functionName = config?.functionName;
        
        if (functionName === 'canWithdraw') {
          return { data: true, error: undefined, isLoading: false };
        } else if (functionName === 'getWithdrawGasFee') {
          return { 
            data: [mockGasTokenAddress, parseUnits('0.01', 18)], 
            error: undefined, 
            isLoading: false 
          };
        } else if (functionName === 'balanceOf') {
          return { 
            data: parseUnits('1', 18), 
            error: undefined, 
            isLoading: false 
          };
        } else if (functionName === 'allowance') {
          return { 
            data: parseUnits('10', 18), 
            error: undefined, 
            isLoading: false 
          };
        }
        
        return { data: undefined, error: undefined, isLoading: false };
      });

      const { result } = renderHook(() => 
        useWithdrawValidation({ ...defaultParams, amount: '5' })
      );

      await waitFor(() => {
        expect(result.current.isValid).toBe(true);
        expect(result.current.error).toBe('');
      });
    });
  });

  describe('Gas Token Handling - Same Token', () => {
    it('should handle gas token withdrawal correctly when withdrawal amount covers gas fee', async () => {
      const gasTokenAsset = { ...mockAsset, address: mockGasTokenAddress };
      
      mockUseReadContract.mockImplementation((config) => {
        const functionName = config?.functionName;
        
        if (functionName === 'canWithdraw') {
          return { data: true, error: undefined, isLoading: false };
        } else if (functionName === 'getWithdrawGasFee') {
          return { 
            data: [mockGasTokenAddress, parseUnits('0.01', 18)], 
            error: undefined, 
            isLoading: false 
          };
        }
        
        return { data: undefined, error: undefined, isLoading: false };
      });

      const { result } = renderHook(() => 
        useWithdrawValidation({ 
          ...defaultParams, 
          selectedAsset: gasTokenAsset,
          amount: '1' 
        })
      );

      await waitFor(() => {
        expect(result.current.isValid).toBe(true);
        expect(result.current.receiveAmount).toBe(parseUnits('0.99', 18)); // 1 - 0.01 gas fee
        expect(result.current.formattedReceiveAmount).toBe('0.990000000000000000');
      });
    });

    it('should reject gas token withdrawal when gas fee exceeds withdrawal amount', async () => {
      const gasTokenAsset = { ...mockAsset, address: mockGasTokenAddress };
      
      mockUseReadContract.mockImplementation((config) => {
        const functionName = config?.functionName;
        
        if (functionName === 'canWithdraw') {
          return { data: true, error: undefined, isLoading: false };
        } else if (functionName === 'getWithdrawGasFee') {
          return { 
            data: [mockGasTokenAddress, parseUnits('1.5', 18)], 
            error: undefined, 
            isLoading: false 
          };
        }
        
        return { data: undefined, error: undefined, isLoading: false };
      });

      const { result } = renderHook(() => 
        useWithdrawValidation({ 
          ...defaultParams, 
          selectedAsset: gasTokenAsset,
          amount: '1' 
        })
      );

      await waitFor(() => {
        expect(result.current.isValid).toBe(false);
        expect(result.current.error).toContain('Gas fee');
        expect(result.current.error).toContain('is greater than or equal to withdrawal amount');
      });
    });

    it('should reject gas token withdrawal when insufficient balance', async () => {
      const gasTokenAsset = { 
        ...mockAsset, 
        address: mockGasTokenAddress,
        formattedSuppliedBalance: '0.5',
        suppliedBalance: parseUnits('0.5', 18).toString()
      };
      
      mockUseReadContract.mockImplementation((config) => {
        const functionName = config?.functionName;
        
        if (functionName === 'canWithdraw') {
          return { data: true, error: undefined, isLoading: false };
        } else if (functionName === 'getWithdrawGasFee') {
          return { 
            data: [mockGasTokenAddress, parseUnits('0.01', 18)], 
            error: undefined, 
            isLoading: false 
          };
        }
        
        return { data: undefined, error: undefined, isLoading: false };
      });

      const { result } = renderHook(() => 
        useWithdrawValidation({ 
          ...defaultParams, 
          selectedAsset: gasTokenAsset,
          amount: '1' 
        })
      );

      await waitFor(() => {
        expect(result.current.isValid).toBe(false);
        expect(result.current.error).toContain('Insufficient balance');
      });
    });
  });

  describe('Gas Token Handling - Different Token', () => {
    it('should validate gas token balance for non-gas token withdrawal', async () => {
      mockUseReadContract.mockImplementation((config) => {
        const functionName = config?.functionName;
        
        if (functionName === 'canWithdraw') {
          return { data: true, error: undefined, isLoading: false };
        } else if (functionName === 'getWithdrawGasFee') {
          return { 
            data: [mockGasTokenAddress, parseUnits('0.01', 18)], 
            error: undefined, 
            isLoading: false 
          };
        } else if (functionName === 'balanceOf') {
          return { 
            data: parseUnits('0.005', 18), 
            error: undefined, 
            isLoading: false 
          };
        }
        
        return { data: undefined, error: undefined, isLoading: false };
      });

      const { result } = renderHook(() => 
        useWithdrawValidation({ ...defaultParams, amount: '5' })
      );

      await waitFor(() => {
        expect(result.current.isValid).toBe(false);
        expect(result.current.error).toContain('Insufficient');
        expect(result.current.error).toContain('in wallet for gas fees');
      });
    });

    it('should require gas token approval for non-gas token withdrawal', async () => {
      mockUseReadContract.mockImplementation((config) => {
        const functionName = config?.functionName;
        
        if (functionName === 'canWithdraw') {
          return { data: true, error: undefined, isLoading: false };
        } else if (functionName === 'getWithdrawGasFee') {
          return { 
            data: [mockGasTokenAddress, parseUnits('0.01', 18)], 
            error: undefined, 
            isLoading: false 
          };
        } else if (functionName === 'balanceOf') {
          return { 
            data: parseUnits('1', 18), 
            error: undefined, 
            isLoading: false 
          };
        } else if (functionName === 'allowance') {
          return { 
            data: parseUnits('0.005', 18), 
            error: undefined, 
            isLoading: false 
          };
        }
        
        return { data: undefined, error: undefined, isLoading: false };
      });

      const { result } = renderHook(() => 
        useWithdrawValidation({ ...defaultParams, amount: '5' })
      );

      await waitFor(() => {
        expect(result.current.isValid).toBe(true);
        expect(result.current.needsApproval).toBe(true);
        expect(result.current.error).toContain('Please approve');
        expect(result.current.error).toContain('spending for gas fees');
        expect(result.current.gasTokenInfo.needsApproval).toBe(true);
        expect(result.current.gasTokenInfo.address).toBe(mockGasTokenAddress);
      });
    });

    it('should validate successfully with sufficient gas token balance and allowance', async () => {
      mockUseReadContract.mockImplementation((config) => {
        const functionName = config?.functionName;
        
        if (functionName === 'canWithdraw') {
          return { data: true, error: undefined, isLoading: false };
        } else if (functionName === 'getWithdrawGasFee') {
          return { 
            data: [mockGasTokenAddress, parseUnits('0.01', 18)], 
            error: undefined, 
            isLoading: false 
          };
        } else if (functionName === 'balanceOf') {
          return { 
            data: parseUnits('1', 18), 
            error: undefined, 
            isLoading: false 
          };
        } else if (functionName === 'allowance') {
          return { 
            data: parseUnits('10', 18), 
            error: undefined, 
            isLoading: false 
          };
        }
        
        return { data: undefined, error: undefined, isLoading: false };
      });

      const { result } = renderHook(() => 
        useWithdrawValidation({ ...defaultParams, amount: '5' })
      );

      await waitFor(() => {
        expect(result.current.isValid).toBe(true);
        expect(result.current.needsApproval).toBe(false);
        expect(result.current.error).toBe('');
        expect(result.current.receiveAmount).toBe(parseUnits('5', 18));
      });
    });
  });

  describe('Gas Fee Requirements', () => {
    it('should handle missing gas fee data', async () => {
      mockUseReadContract.mockImplementation((config) => {
        const functionName = config?.functionName;
        
        if (functionName === 'canWithdraw') {
          return { data: true, error: undefined, isLoading: false };
        } else if (functionName === 'getWithdrawGasFee') {
          return { 
            data: [ZERO_ADDRESS, BigInt(0)], 
            error: undefined, 
            isLoading: false 
          };
        }
        
        return { data: undefined, error: undefined, isLoading: false };
      });

      const { result } = renderHook(() => 
        useWithdrawValidation({ ...defaultParams, amount: '5' })
      );

      await waitFor(() => {
        expect(result.current.isValid).toBe(false);
        expect(result.current.error).toBe('Unable to determine gas fee requirements');
      });
    });

    it('should handle zero gas fee amount', async () => {
      mockUseReadContract.mockImplementation((config) => {
        const functionName = config?.functionName;
        
        if (functionName === 'canWithdraw') {
          return { data: true, error: undefined, isLoading: false };
        } else if (functionName === 'getWithdrawGasFee') {
          return { 
            data: [mockGasTokenAddress, BigInt(0)], 
            error: undefined, 
            isLoading: false 
          };
        }
        
        return { data: undefined, error: undefined, isLoading: false };
      });

      const { result } = renderHook(() => 
        useWithdrawValidation({ ...defaultParams, amount: '5' })
      );

      await waitFor(() => {
        expect(result.current.isValid).toBe(false);
        expect(result.current.error).toBe('Unable to determine gas fee requirements');
      });
    });
  });

  describe('Receive Amount Calculations', () => {
    it('should calculate receive amount correctly for gas token', async () => {
      const gasTokenAsset = { ...mockAsset, address: mockGasTokenAddress };
      
      mockUseReadContract.mockImplementation((config) => {
        const functionName = config?.functionName;
        
        if (functionName === 'canWithdraw') {
          return { data: true, error: undefined, isLoading: false };
        } else if (functionName === 'getWithdrawGasFee') {
          return { 
            data: [mockGasTokenAddress, parseUnits('0.1', 18)], 
            error: undefined, 
            isLoading: false 
          };
        }
        
        return { data: undefined, error: undefined, isLoading: false };
      });

      const { result } = renderHook(() => 
        useWithdrawValidation({ 
          ...defaultParams, 
          selectedAsset: gasTokenAsset,
          amount: '2' 
        })
      );

      await waitFor(() => {
        expect(result.current.receiveAmount).toBe(parseUnits('1.9', 18)); // 2 - 0.1 gas fee
        expect(result.current.formattedReceiveAmount).toBe('1.900000000000000000');
      });
    });

    it('should calculate receive amount correctly for non-gas token', async () => {
      mockUseReadContract.mockImplementation((config) => {
        const functionName = config?.functionName;
        
        if (functionName === 'canWithdraw') {
          return { data: true, error: undefined, isLoading: false };
        } else if (functionName === 'getWithdrawGasFee') {
          return { 
            data: [mockGasTokenAddress, parseUnits('0.1', 18)], 
            error: undefined, 
            isLoading: false 
          };
        } else if (functionName === 'balanceOf') {
          return { 
            data: parseUnits('1', 18), 
            error: undefined, 
            isLoading: false 
          };
        } else if (functionName === 'allowance') {
          return { 
            data: parseUnits('10', 18), 
            error: undefined, 
            isLoading: false 
          };
        }
        
        return { data: undefined, error: undefined, isLoading: false };
      });

      const { result } = renderHook(() => 
        useWithdrawValidation({ ...defaultParams, amount: '2' })
      );

      await waitFor(() => {
        expect(result.current.receiveAmount).toBe(parseUnits('2', 18)); // Full amount for non-gas token
        expect(result.current.formattedReceiveAmount).toBe('2.000000000000000000');
      });
    });
  });
});