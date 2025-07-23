import { useState, useCallback, useEffect } from 'react';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import type { EVMTransactionHash } from '../components/dashboard/types';
import { safeEVMTransactionHashOrZeroTransactionHash } from '../components/dashboard/types';
import type { 
    TransactionType, 
    StepsForTransactionType
} from '../types/transactions';

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

export function useTransactionFlow<T extends TransactionType>(): TransactionFlowHookReturn<T> {
    // State
    const [currentStep, setCurrentStep] = useState<StepsForTransactionType<T>>('input' as StepsForTransactionType<T>);
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
        hash: approvalHash || undefined,
        query: {
            enabled: !!approvalHash,
        },
    });

    const { 
        isLoading: isTransactionTx, 
        isSuccess: isTransactionSuccess, 
        isError: isTransactionError, 
        error: transactionError 
    } = useWaitForTransactionReceipt({
        hash: transactionHash || undefined,
        query: {
            enabled: !!transactionHash,
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
                    setCurrentStep('approving' as StepsForTransactionType<T>);
                } else {
                    // Handle main transaction steps
                    setTransactionHash(validHash);
                    
                    // Map current step to its corresponding pending step
                    if (currentStep === 'deposit') {
                        setCurrentStep('depositing' as StepsForTransactionType<T>);
                    } else if (currentStep === 'withdraw') {
                        setCurrentStep('withdrawing' as StepsForTransactionType<T>);
                    } else if (currentStep === 'borrow') {
                        setCurrentStep('borrowing' as StepsForTransactionType<T>);
                    } else if (currentStep === 'repay') {
                        setCurrentStep('repaying' as StepsForTransactionType<T>);
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