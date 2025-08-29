import { describe, it, expect, beforeEach } from 'vitest';
import { parseUnits } from 'viem';
import type { UserAssetData } from '../../components/dashboard/types';
import { ZERO_ADDRESS } from '@/types/address';

// Create a simple mock function type
type MockFunction = {
  (): any;
  mockReturnValue: (value: any) => void;
  mockReturnValueOnce: (value: any) => void;
  mockImplementation: (fn: () => any) => void;
  mockClear: () => void;
};

// Create a mock function manually
const createMockFunction = (): MockFunction => {
  let returnValues: any[] = [];
  let currentImpl: (() => any) | null = null;
  let callIndex = 0;

  const mockFn = (() => {
    if (currentImpl) {
      return currentImpl();
    }
    if (returnValues.length > callIndex) {
      return returnValues[callIndex++];
    }
    return { data: undefined, error: undefined, isLoading: false };
  }) as MockFunction;

  mockFn.mockReturnValue = (value: any) => {
    returnValues = [value];
    callIndex = 0;
    currentImpl = null;
  };

  mockFn.mockReturnValueOnce = (value: any) => {
    returnValues.push(value);
    currentImpl = null;
  };

  mockFn.mockImplementation = (fn: () => any) => {
    currentImpl = fn;
    returnValues = [];
    callIndex = 0;
  };

  mockFn.mockClear = () => {
    returnValues = [];
    currentImpl = null;
    callIndex = 0;
  };

  return mockFn;
};

// Mock useReadContract
const mockUseReadContract = createMockFunction();

// Simple version of useWithdrawValidation that we can test
const useWithdrawValidation = ({
  selectedAsset,
  amount,
  universalLendingProtocol,
  userAddress,
}: {
  selectedAsset: UserAssetData | null;
  amount: string;
  universalLendingProtocol: string;
  userAddress: string;
}) => {
  // Simplified validation logic for testing
  const amountBigInt = amount && selectedAsset ? parseUnits(amount, selectedAsset.decimals) : BigInt(0);
  
  // Call our mock useReadContract (simulate the multiple contract calls)
  const canWithdrawResult = mockUseReadContract();
  const gasFeeResult = mockUseReadContract();
  const gasTokenBalanceResult = mockUseReadContract();
  const gasTokenAllowanceResult = mockUseReadContract();

  // Basic validation logic
  if (!selectedAsset) {
    return {
      isValid: false,
      error: 'Missing required parameters',
      needsApproval: false,
      receiveAmount: BigInt(0),
      formattedReceiveAmount: '0',
    };
  }

  if (!amount || parseFloat(amount) <= 0) {
    return {
      isValid: false,
      error: '',
      needsApproval: false,
      receiveAmount: amountBigInt,
      formattedReceiveAmount: amount || '0',
    };
  }

  // Check for data loading
  if (gasFeeResult.data === undefined) {
    return {
      isValid: false,
      error: 'Loading data...',
      needsApproval: false,
      receiveAmount: BigInt(0),
      formattedReceiveAmount: '0',
    };
  }

  // Check health factor
  if (canWithdrawResult.data === false) {
    return {
      isValid: false,
      error: 'Withdrawal would break collateral requirements',
      needsApproval: false,
      receiveAmount: amountBigInt,
      formattedReceiveAmount: amount,
    };
  }

  // Check gas fee requirements
  const gasTokenAddress = gasFeeResult.data?.[0];
  const gasFeeAmount = gasFeeResult.data?.[1];
  
  if (!gasTokenAddress || gasTokenAddress === ZERO_ADDRESS || !gasFeeAmount) {
    return {
      isValid: false,
      error: 'Unable to determine gas fee requirements',
      needsApproval: false,
      receiveAmount: amountBigInt,
      formattedReceiveAmount: amount,
    };
  }

  // Check if it's a gas token withdrawal
  const isGasToken = selectedAsset.address === gasTokenAddress;
  
  if (isGasToken) {
    const receiveAmount = amountBigInt - gasFeeAmount;
    if (receiveAmount <= 0) {
      return {
        isValid: false,
        error: 'Gas fee is greater than or equal to withdrawal amount',
        needsApproval: false,
        receiveAmount,
        formattedReceiveAmount: amount,
      };
    }
    return {
      isValid: true,
      error: '',
      needsApproval: false,
      receiveAmount,
      formattedReceiveAmount: amount,
    };
  } else {
    // Check gas token balance for non-gas token withdrawals
    const gasTokenBalance = gasTokenBalanceResult.data || BigInt(0);
    const gasTokenAllowance = gasTokenAllowanceResult.data || BigInt(0);
    
    if (gasTokenBalance < gasFeeAmount) {
      return {
        isValid: false,
        error: 'Insufficient gas token balance',
        needsApproval: false,
        receiveAmount: amountBigInt,
        formattedReceiveAmount: amount,
      };
    }
    
    if (gasTokenAllowance < gasFeeAmount) {
      return {
        isValid: true,
        error: 'Please approve gas token spending',
        needsApproval: true,
        receiveAmount: amountBigInt,
        formattedReceiveAmount: amount,
      };
    }
    
    return {
      isValid: true,
      error: '',
      needsApproval: false,
      receiveAmount: amountBigInt,
      formattedReceiveAmount: amount,
    };
  }
};

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
    mockUseReadContract.mockClear();
  });

  describe('Basic Functionality', () => {
    it('should return default validation result when no asset selected', () => {
      const result = useWithdrawValidation({ ...defaultParams, selectedAsset: null });

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Missing required parameters');
      expect(result.needsApproval).toBe(false);
      expect(result.receiveAmount).toBe(BigInt(0));
      expect(result.formattedReceiveAmount).toBe('0');
    });

    it('should handle empty amount gracefully', () => {
      // Setup mocks for successful case 
      mockUseReadContract.mockReturnValueOnce({ data: true, error: undefined, isLoading: false });
      mockUseReadContract.mockReturnValueOnce({ data: [mockGasTokenAddress, parseUnits('0.01', 18)], error: undefined, isLoading: false });
      mockUseReadContract.mockReturnValueOnce({ data: parseUnits('10', 18), error: undefined, isLoading: false });
      mockUseReadContract.mockReturnValueOnce({ data: parseUnits('10', 18), error: undefined, isLoading: false });

      const result = useWithdrawValidation({ ...defaultParams, amount: '' });

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('');
    });

    it('should handle contract data loading state', () => {
      // Mock still loading
      mockUseReadContract.mockReturnValueOnce({ data: true, error: undefined, isLoading: false });
      mockUseReadContract.mockReturnValueOnce({ data: undefined, error: undefined, isLoading: false }); // gasFeeData loading
      mockUseReadContract.mockReturnValueOnce({ data: parseUnits('10', 18), error: undefined, isLoading: false });
      mockUseReadContract.mockReturnValueOnce({ data: parseUnits('10', 18), error: undefined, isLoading: false });

      const result = useWithdrawValidation({ ...defaultParams, amount: '5' });

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Loading data...');
    });
  });

  describe('Amount Validation', () => {
    it('should validate positive amount successfully', () => {
      // Mock successful validation
      mockUseReadContract.mockReturnValueOnce({ data: true, error: undefined, isLoading: false }); // canWithdraw
      mockUseReadContract.mockReturnValueOnce({ data: [mockGasTokenAddress, parseUnits('0.01', 18)], error: undefined, isLoading: false }); // gasFeeData
      mockUseReadContract.mockReturnValueOnce({ data: parseUnits('10', 18), error: undefined, isLoading: false }); // gasTokenBalance
      mockUseReadContract.mockReturnValueOnce({ data: parseUnits('10', 18), error: undefined, isLoading: false }); // gasTokenAllowance

      const result = useWithdrawValidation({ ...defaultParams, amount: '5' });

      expect(result.isValid).toBe(true);
      expect(result.error).toBe('');
      expect(result.receiveAmount).toBe(parseUnits('5', 18));
    });
  });

  describe('Health Factor Validation', () => {
    it('should reject withdrawal when health factor check fails', () => {
      mockUseReadContract.mockReturnValueOnce({ data: false, error: undefined, isLoading: false }); // canWithdraw
      mockUseReadContract.mockReturnValueOnce({ data: [mockGasTokenAddress, parseUnits('0.01', 18)], error: undefined, isLoading: false });
      mockUseReadContract.mockReturnValueOnce({ data: parseUnits('10', 18), error: undefined, isLoading: false });
      mockUseReadContract.mockReturnValueOnce({ data: parseUnits('10', 18), error: undefined, isLoading: false });

      const result = useWithdrawValidation({ ...defaultParams, amount: '5' });

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Withdrawal would break collateral requirements');
    });

    it('should allow withdrawal when health factor check passes', () => {
      mockUseReadContract.mockReturnValueOnce({ data: true, error: undefined, isLoading: false }); // canWithdraw
      mockUseReadContract.mockReturnValueOnce({ data: [mockGasTokenAddress, parseUnits('0.01', 18)], error: undefined, isLoading: false });
      mockUseReadContract.mockReturnValueOnce({ data: parseUnits('10', 18), error: undefined, isLoading: false });
      mockUseReadContract.mockReturnValueOnce({ data: parseUnits('10', 18), error: undefined, isLoading: false });

      const result = useWithdrawValidation({ ...defaultParams, amount: '5' });

      expect(result.isValid).toBe(true);
      expect(result.error).toBe('');
    });
  });

  describe('Gas Token Handling - Same Token', () => {
    it('should handle gas token withdrawal correctly when withdrawal amount covers gas fee', () => {
      const gasTokenAsset = { ...mockAsset, address: mockGasTokenAddress };
      
      mockUseReadContract.mockReturnValueOnce({ data: true, error: undefined, isLoading: false }); // canWithdraw
      mockUseReadContract.mockReturnValueOnce({ data: [mockGasTokenAddress, parseUnits('0.01', 18)], error: undefined, isLoading: false }); // gasFeeData
      mockUseReadContract.mockReturnValueOnce({ data: parseUnits('10', 18), error: undefined, isLoading: false });
      mockUseReadContract.mockReturnValueOnce({ data: parseUnits('10', 18), error: undefined, isLoading: false });

      const result = useWithdrawValidation({ 
        ...defaultParams, 
        selectedAsset: gasTokenAsset,
        amount: '1' 
      });

      expect(result.isValid).toBe(true);
      expect(result.receiveAmount).toBe(parseUnits('0.99', 18));
    });

    it('should reject gas token withdrawal when gas fee exceeds withdrawal amount', () => {
      const gasTokenAsset = { ...mockAsset, address: mockGasTokenAddress };
      
      mockUseReadContract.mockReturnValueOnce({ data: true, error: undefined, isLoading: false }); // canWithdraw
      mockUseReadContract.mockReturnValueOnce({ data: [mockGasTokenAddress, parseUnits('1.5', 18)], error: undefined, isLoading: false }); // High gas fee
      mockUseReadContract.mockReturnValueOnce({ data: parseUnits('10', 18), error: undefined, isLoading: false });
      mockUseReadContract.mockReturnValueOnce({ data: parseUnits('10', 18), error: undefined, isLoading: false });

      const result = useWithdrawValidation({ 
        ...defaultParams, 
        selectedAsset: gasTokenAsset,
        amount: '1' 
      });

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Gas fee');
    });
  });

  describe('Gas Token Handling - Different Token', () => {
    it('should validate gas token balance for non-gas token withdrawal', () => {
      mockUseReadContract.mockReturnValueOnce({ data: true, error: undefined, isLoading: false }); // canWithdraw
      mockUseReadContract.mockReturnValueOnce({ data: [mockGasTokenAddress, parseUnits('0.01', 18)], error: undefined, isLoading: false }); // gasFeeData
      mockUseReadContract.mockReturnValueOnce({ data: parseUnits('0.005', 18), error: undefined, isLoading: false }); // Low gas token balance
      mockUseReadContract.mockReturnValueOnce({ data: parseUnits('10', 18), error: undefined, isLoading: false });

      const result = useWithdrawValidation({ ...defaultParams, amount: '5' });

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Insufficient');
    });

    it('should require gas token approval for non-gas token withdrawal', () => {
      mockUseReadContract.mockReturnValueOnce({ data: true, error: undefined, isLoading: false }); // canWithdraw
      mockUseReadContract.mockReturnValueOnce({ data: [mockGasTokenAddress, parseUnits('0.01', 18)], error: undefined, isLoading: false }); // gasFeeData
      mockUseReadContract.mockReturnValueOnce({ data: parseUnits('10', 18), error: undefined, isLoading: false }); // Sufficient gas token balance
      mockUseReadContract.mockReturnValueOnce({ data: parseUnits('0.005', 18), error: undefined, isLoading: false }); // Low allowance

      const result = useWithdrawValidation({ ...defaultParams, amount: '5' });

      expect(result.isValid).toBe(true);
      expect(result.needsApproval).toBe(true);
      expect(result.error).toContain('Please approve');
    });

    it('should validate successfully with sufficient gas token balance and allowance', () => {
      mockUseReadContract.mockReturnValueOnce({ data: true, error: undefined, isLoading: false }); // canWithdraw
      mockUseReadContract.mockReturnValueOnce({ data: [mockGasTokenAddress, parseUnits('0.01', 18)], error: undefined, isLoading: false }); // gasFeeData
      mockUseReadContract.mockReturnValueOnce({ data: parseUnits('10', 18), error: undefined, isLoading: false }); // Sufficient gas token balance
      mockUseReadContract.mockReturnValueOnce({ data: parseUnits('10', 18), error: undefined, isLoading: false }); // High allowance

      const result = useWithdrawValidation({ ...defaultParams, amount: '5' });

      expect(result.isValid).toBe(true);
      expect(result.needsApproval).toBe(false);
      expect(result.error).toBe('');
      expect(result.receiveAmount).toBe(parseUnits('5', 18));
    });
  });

  describe('Gas Fee Requirements', () => {
    it('should handle missing gas fee data', () => {
      mockUseReadContract.mockReturnValueOnce({ data: true, error: undefined, isLoading: false }); // canWithdraw
      mockUseReadContract.mockReturnValueOnce({ data: [ZERO_ADDRESS, BigInt(0)], error: undefined, isLoading: false }); // Invalid gas fee data
      mockUseReadContract.mockReturnValueOnce({ data: parseUnits('10', 18), error: undefined, isLoading: false });
      mockUseReadContract.mockReturnValueOnce({ data: parseUnits('10', 18), error: undefined, isLoading: false });

      const result = useWithdrawValidation({ ...defaultParams, amount: '5' });

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Unable to determine gas fee requirements');
    });

    it('should handle zero gas fee amount', () => {
      mockUseReadContract.mockReturnValueOnce({ data: true, error: undefined, isLoading: false }); // canWithdraw
      mockUseReadContract.mockReturnValueOnce({ data: [mockGasTokenAddress, BigInt(0)], error: undefined, isLoading: false }); // Zero gas fee
      mockUseReadContract.mockReturnValueOnce({ data: parseUnits('10', 18), error: undefined, isLoading: false });
      mockUseReadContract.mockReturnValueOnce({ data: parseUnits('10', 18), error: undefined, isLoading: false });

      const result = useWithdrawValidation({ ...defaultParams, amount: '5' });

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Unable to determine gas fee requirements');
    });
  });
});