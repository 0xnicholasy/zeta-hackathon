import { useState, useCallback, useEffect } from 'react';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import type {
    TransactionType,
    StepsForTransactionType
} from '../types/transactions';
import { EVMTransactionHash, safeEVMTransactionHashOrZeroTransactionHash } from '@/types/address';

// Type guard to check if a step is valid for a given transaction type
function isValidStepForTransactionType<T extends TransactionType>(
    step: string
): step is StepsForTransactionType<T> {
    // This is a runtime check that validates the step against known valid steps
    // for all transaction types. In a more robust implementation, this could
    // be enhanced with a complete validation mapping.
    const commonSteps = ['input', 'approve', 'approving', 'switchNetwork', 'success', 'failed'];
    const transactionSpecificSteps = ['deposit', 'depositing', 'withdraw', 'withdrawing', 'checkWithdraw', 'checkGas', 'borrow', 'borrowing', 'repay', 'repaying', 'liquidate', 'liquidating'];
    const allValidSteps = [...commonSteps, ...transactionSpecificSteps];

    return allValidSteps.includes(step);
}

export interface TransactionFlowState<T extends TransactionType> {
    currentStep: StepsForTransactionType<T>;
    isSubmitting: boolean;
    approvalHash: EVMTransactionHash | null;
    transactionHash: EVMTransactionHash | null;
}

export interface TransactionFlowActions<T extends TransactionType> {
    setCurrentStep: (step: StepsForTransactionType<T>) => void;
    setIsSubmitting: (submitting: boolean) => void;
    setApprovalHash: (hash: EVMTransactionHash | null) => void;
    setTransactionHash: (hash: EVMTransactionHash | null) => void;
    reset: () => void;
    writeContract: ReturnType<typeof useWriteContract>['writeContract'];
    resetContract: ReturnType<typeof useWriteContract>['reset'];
}

export interface TransactionFlowHookReturn<T extends TransactionType> {
    state: TransactionFlowState<T>;
    actions: TransactionFlowActions<T>;
    contractState: {
        hash: ReturnType<typeof useWriteContract>['data'];
        error: ReturnType<typeof useWriteContract>['error'];
        isApprovingTx: boolean;
        isApprovalSuccess: boolean;
        isTransactionTx: boolean;
        isTransactionSuccess: boolean;
        isTransactionError: boolean;
        transactionError: ReturnType<typeof useWaitForTransactionReceipt>['error'];
    };
}

export function useTransactionFlow<T extends TransactionType>(initialStep: StepsForTransactionType<T> = 'input' as StepsForTransactionType<T>): TransactionFlowHookReturn<T> {
    // State
    const [currentStep, setCurrentStep] = useState<StepsForTransactionType<T>>(initialStep);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [approvalHash, setApprovalHash] = useState<EVMTransactionHash | null>(null);
    const [transactionHash, setTransactionHash] = useState<EVMTransactionHash | null>(null);

    // Contract writing
    const { writeContract, data: hash, error: contractError, reset: resetContract } = useWriteContract();

    // Transaction receipts
    const {
        isLoading: isApprovingTx,
        isSuccess: isApprovalSuccess
    } = useWaitForTransactionReceipt({
        hash: approvalHash ?? undefined,
        query: {
            enabled: Boolean(approvalHash),
        },
    });

    const {
        isLoading: isTransactionTx,
        isSuccess: isTransactionSuccess,
        isError: isTransactionError,
        error: transactionError
    } = useWaitForTransactionReceipt({
        hash: transactionHash ?? undefined,
        query: {
            enabled: Boolean(transactionHash),
        },
    });

    // Reset function
    const reset = useCallback(() => {
        setCurrentStep('input' as StepsForTransactionType<T>);
        setIsSubmitting(false);
        setApprovalHash(null);
        setTransactionHash(null);
        resetContract();
    }, [resetContract]);

    // Update current hash when writeContract returns new hash
    useEffect(() => {
        if (hash) {
            const validHash = safeEVMTransactionHashOrZeroTransactionHash(hash);
            if (validHash) {
                if (currentStep === 'approve') {
                    setApprovalHash(validHash);
                    // Type-safe way to set approving step
                    const approvingStep = 'approving' as const;
                    if (isValidStepForTransactionType<T>(approvingStep)) {
                        setCurrentStep(approvingStep);
                    }
                } else {
                    // Handle main transaction steps
                    setTransactionHash(validHash);

                    // Type-safe step transitions with proper validation
                    const stepTransitions = {
                        'deposit': 'depositing' as const,
                        'withdraw': 'withdrawing' as const,
                        'borrow': 'borrowing' as const,
                        'repay': 'repaying' as const,
                        'liquidate': 'liquidating' as const
                    } as const;

                    const currentStepKey = currentStep as keyof typeof stepTransitions;
                    const nextStep = stepTransitions[currentStepKey];

                    if (nextStep && isValidStepForTransactionType<T>(nextStep)) {
                        setCurrentStep(nextStep);
                    } else {
                        // Log warning for unexpected step transitions
                        console.warn(`Unexpected step transition from '${currentStep}' in transaction type. No valid transition found.`);
                    }
                }
            }
        }
    }, [hash, currentStep]);

    return {
        state: {
            currentStep,
            isSubmitting,
            approvalHash,
            transactionHash,
        },
        actions: {
            setCurrentStep,
            setIsSubmitting,
            setApprovalHash,
            setTransactionHash,
            reset,
            writeContract,
            resetContract,
        },
        contractState: {
            hash,
            error: contractError,
            isApprovingTx,
            isApprovalSuccess,
            isTransactionTx,
            isTransactionSuccess,
            isTransactionError,
            transactionError,
        },
    };
}

// Specific hooks for each transaction type
export function useSupplyTransactionFlow(): TransactionFlowHookReturn<'supply'> {
    return useTransactionFlow<'supply'>();
}

export function useWithdrawTransactionFlow(): TransactionFlowHookReturn<'withdraw'> {
    return useTransactionFlow<'withdraw'>();
}

export function useBorrowTransactionFlow(): TransactionFlowHookReturn<'borrow'> {
    return useTransactionFlow<'borrow'>();
}

export function useRepayTransactionFlow(): TransactionFlowHookReturn<'repay'> {
    return useTransactionFlow<'repay'>();
}

export function useLiquidateTransactionFlow(): TransactionFlowHookReturn<'liquidate'> {
    return useTransactionFlow<'liquidate'>();
}