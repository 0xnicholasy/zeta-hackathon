import { useState, useCallback, useEffect } from 'react';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import type { EVMTransactionHash } from '../components/dashboard/types';
import { safeEVMTransactionHashOrZeroTransactionHash } from '../components/dashboard/types';

export type TransactionStep = 'input' | 'approve' | 'approving' | 'deposit' | 'depositing' | 'withdraw' | 'withdrawing' | 'checkWithdraw' | 'checkGas' | 'success';

export interface TransactionFlowState {
    currentStep: TransactionStep;
    isSubmitting: boolean;
    approvalHash: EVMTransactionHash | null;
    transactionHash: EVMTransactionHash | null;
}

export interface TransactionFlowActions {
    setCurrentStep: (step: TransactionStep) => void;
    setIsSubmitting: (submitting: boolean) => void;
    setApprovalHash: (hash: EVMTransactionHash | null) => void;
    setTransactionHash: (hash: EVMTransactionHash | null) => void;
    reset: () => void;
    writeContract: ReturnType<typeof useWriteContract>['writeContract'];
    resetContract: ReturnType<typeof useWriteContract>['reset'];
}

export interface TransactionFlowHookReturn {
    state: TransactionFlowState;
    actions: TransactionFlowActions;
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

export function useTransactionFlow(): TransactionFlowHookReturn {
    // State
    const [currentStep, setCurrentStep] = useState<TransactionStep>('input');
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
        setCurrentStep('input');
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
                    setCurrentStep('approving');
                } else if (currentStep === 'deposit' || currentStep === 'withdraw') {
                    setTransactionHash(validHash);
                    setCurrentStep(currentStep === 'deposit' ? 'depositing' : 'withdrawing');
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