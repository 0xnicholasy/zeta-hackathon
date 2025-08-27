import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mock all dependencies
vi.mock('wagmi', () => ({
  useAccount: vi.fn(),
  useReadContract: vi.fn(),
  useReadContracts: vi.fn(),
  useWriteContract: vi.fn(),
  useWaitForTransactionReceipt: vi.fn(),
}));

vi.mock('viem', () => ({
  formatUnits: vi.fn(() => '1.0'),
  parseUnits: vi.fn(() => BigInt('1000000000000000000')),
  createPublicClient: vi.fn(() => ({
    getBalance: vi.fn().mockResolvedValue(BigInt('1000000000000000000')),
    readContract: vi.fn().mockResolvedValue(BigInt('1000000000')),
    estimateGas: vi.fn().mockResolvedValue(BigInt('21000')),
  })),
  http: vi.fn(),
}));

vi.mock('@/types/address', () => ({
  safeEVMAddress: vi.fn((addr) => addr || '0x0000000000000000000000000000000000000000'),
  safeEVMAddressOrZeroAddress: vi.fn((addr) => addr || '0x0000000000000000000000000000000000000000'),
  safeEVMTransactionHashOrZeroTransactionHash: vi.fn((hash) => hash),
}));

vi.mock('../../contracts/deployments', () => ({
  SupportedChain: {
    ZETA_TESTNET: 7001,
  },
}));

vi.mock('@/utils/directContractCalls', () => ({
  getAssetPrice: vi.fn().mockResolvedValue(BigInt('2000000000000000000000')),
}));

vi.mock('@/utils/transactionSimulation', () => ({
  simulateTransaction: vi.fn().mockResolvedValue({
    success: true,
    gasEstimate: BigInt('21000'),
    healthFactorAfter: '2.5',
  }),
}));

vi.mock('../useCrossChainTracking', () => ({
  useCrossChainTracking: vi.fn(() => ({
    status: 'idle',
    reset: vi.fn(),
  })),
}));

import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';

// Import the actual hooks
import { useTransactionFlow } from '../useTransactionFlow';
import { useStandardizedTransactionDialog } from '../useStandardizedTransactionDialog';

const mockUseAccount = useAccount as ReturnType<typeof vi.fn>;
const mockUseWriteContract = useWriteContract as ReturnType<typeof vi.fn>;
const mockUseWaitForTransactionReceipt = useWaitForTransactionReceipt as ReturnType<typeof vi.fn>;

describe('Basic Hook Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    mockUseAccount.mockReturnValue({
      isConnected: true,
      address: '0x1234567890123456789012345678901234567890',
    });

    mockUseWriteContract.mockReturnValue({
      writeContract: vi.fn(),
      data: null,
      error: null,
      reset: vi.fn(),
    });

    mockUseWaitForTransactionReceipt.mockReturnValue({
      isLoading: false,
      isSuccess: false,
      isError: false,
      error: null,
    });
  });

  describe('useTransactionFlow', () => {
    it('should return initial state', () => {
      const { result } = renderHook(() => useTransactionFlow('input'));

      expect(result.current.state.currentStep).toBe('input');
      expect(result.current.state.isSubmitting).toBe(false);
      expect(result.current.state.approvalHash).toBeNull();
      expect(result.current.state.transactionHash).toBeNull();
    });

    it('should provide action functions', () => {
      const { result } = renderHook(() => useTransactionFlow('input'));

      expect(typeof result.current.actions.setCurrentStep).toBe('function');
      expect(typeof result.current.actions.setIsSubmitting).toBe('function');
      expect(typeof result.current.actions.setApprovalHash).toBe('function');
      expect(typeof result.current.actions.setTransactionHash).toBe('function');
      expect(typeof result.current.actions.reset).toBe('function');
      expect(typeof result.current.actions.writeContract).toBe('function');
      expect(typeof result.current.actions.resetContract).toBe('function');
    });

    it('should update state through actions', () => {
      const { result } = renderHook(() => useTransactionFlow('input'));

      act(() => {
        result.current.actions.setCurrentStep('approve');
      });

      expect(result.current.state.currentStep).toBe('approve');
    });

    it('should update submitting state', () => {
      const { result } = renderHook(() => useTransactionFlow('input'));

      act(() => {
        result.current.actions.setIsSubmitting(true);
      });

      expect(result.current.state.isSubmitting).toBe(true);
    });

    it('should update hashes', () => {
      const { result } = renderHook(() => useTransactionFlow('input'));

      act(() => {
        result.current.actions.setApprovalHash('0xapproval123');
        result.current.actions.setTransactionHash('0xtransaction456');
      });

      expect(result.current.state.approvalHash).toBe('0xapproval123');
      expect(result.current.state.transactionHash).toBe('0xtransaction456');
    });

    it('should reset state', () => {
      const { result } = renderHook(() => useTransactionFlow('input'));

      // Set some state first
      act(() => {
        result.current.actions.setCurrentStep('approve');
        result.current.actions.setIsSubmitting(true);
        result.current.actions.setApprovalHash('0x123');
      });

      // Reset
      act(() => {
        result.current.actions.reset();
      });

      expect(result.current.state.currentStep).toBe('input');
      expect(result.current.state.isSubmitting).toBe(false);
      expect(result.current.state.approvalHash).toBeNull();
    });
  });

  describe('useStandardizedTransactionDialog', () => {
    // Mock the dependencies that useStandardizedTransactionDialog needs
    beforeEach(() => {
      vi.doMock('../useTransactionFlow', () => ({
        useTransactionFlow: () => ({
          state: { currentStep: 'input', isSubmitting: false, approvalHash: null, transactionHash: null },
          actions: { reset: vi.fn(), writeContract: vi.fn() },
          contractState: { hash: null, error: null },
        }),
      }));

      vi.doMock('../useCrossChainTracking', () => ({
        useCrossChainTracking: () => ({
          status: 'idle',
          reset: vi.fn(),
        }),
      }));
    });

    it('should return initial dialog state', () => {
      const { result } = renderHook(() =>
        useStandardizedTransactionDialog({
          transactionType: 'supply',
        })
      );

      expect(result.current.state.amount).toBe('');
      expect(result.current.state.recipientAddress).toBe('');
      expect(result.current.state.isOpen).toBe(false);
      expect(result.current.state.validation.isValid).toBe(true);
      expect(result.current.state.validation.hasErrors).toBe(false);
      expect(result.current.state.validation.hasWarnings).toBe(false);
    });

    it('should provide action functions', () => {
      const { result } = renderHook(() =>
        useStandardizedTransactionDialog({
          transactionType: 'supply',
        })
      );

      expect(typeof result.current.actions.setAmount).toBe('function');
      expect(typeof result.current.actions.setRecipientAddress).toBe('function');
      expect(typeof result.current.actions.resetForm).toBe('function');
      expect(typeof result.current.actions.openDialog).toBe('function');
      expect(typeof result.current.actions.closeDialog).toBe('function');
      expect(typeof result.current.actions.setValidation).toBe('function');
      expect(typeof result.current.actions.clearValidation).toBe('function');
      expect(typeof result.current.actions.runSimulation).toBe('function');
      expect(typeof result.current.actions.clearSimulation).toBe('function');
    });

    it('should update amount', () => {
      const { result } = renderHook(() =>
        useStandardizedTransactionDialog({
          transactionType: 'supply',
        })
      );

      act(() => {
        result.current.actions.setAmount('100.5');
      });

      expect(result.current.state.amount).toBe('100.5');
    });

    it('should open and close dialog', () => {
      const { result } = renderHook(() =>
        useStandardizedTransactionDialog({
          transactionType: 'supply',
        })
      );

      act(() => {
        result.current.actions.openDialog();
      });

      expect(result.current.state.isOpen).toBe(true);

      act(() => {
        result.current.actions.closeDialog();
      });

      expect(result.current.state.isOpen).toBe(false);
    });

    it('should provide computed values', () => {
      const { result } = renderHook(() =>
        useStandardizedTransactionDialog({
          transactionType: 'supply',
        })
      );

      expect(typeof result.current.computed.isValidForSubmission).toBe('boolean');
      expect(typeof result.current.computed.hasFormData).toBe('boolean');
      expect(typeof result.current.computed.shouldShowValidation).toBe('boolean');
    });

    it('should calculate form validity correctly', () => {
      const { result } = renderHook(() =>
        useStandardizedTransactionDialog({
          transactionType: 'supply',
        })
      );

      // Initially invalid (no amount)
      expect(result.current.computed.isValidForSubmission).toBe(false);
      expect(result.current.computed.hasFormData).toBe(false);

      // Valid with amount
      act(() => {
        result.current.actions.setAmount('100');
      });

      expect(result.current.computed.hasFormData).toBe(true);
      // Should be valid for supply (doesn't need recipient)
      expect(result.current.computed.isValidForSubmission).toBe(true);
    });
  });
});

describe('Utility Functions', () => {
  it('should test transactionSupportsRecipient', async () => {
    const { transactionSupportsRecipient } = await import('../useStandardizedTransactionDialog');
    
    expect(transactionSupportsRecipient('withdraw')).toBe(true);
    expect(transactionSupportsRecipient('borrow')).toBe(true);
    expect(transactionSupportsRecipient('supply')).toBe(false);
    expect(transactionSupportsRecipient('repay')).toBe(false);
  });

  it('should test getDefaultMinAmount', async () => {
    const { getDefaultMinAmount } = await import('../useStandardizedTransactionDialog');
    
    expect(getDefaultMinAmount('supply')).toBe('0.000001');
    expect(getDefaultMinAmount('withdraw')).toBe('0.000001');
    expect(getDefaultMinAmount('borrow')).toBe('0.01');
    expect(getDefaultMinAmount('repay')).toBe('0.000001');
  });
});