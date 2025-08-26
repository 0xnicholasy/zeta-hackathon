import { useState, useCallback, useEffect, useMemo } from 'react';
import { useTransactionFlow } from './useTransactionFlow';
import { useCrossChainTracking } from './useCrossChainTracking';
import type { TransactionType } from '../types/transactions';
import type { ValidationResult } from '@/utils/inputValidation';
import { simulateTransaction, type SimulationResult } from '@/utils/transactionSimulation';

/**
 * Standardized state management for transaction dialogs
 * Provides consistent patterns for form state, validation, and cleanup
 */

export interface DialogState {
    // Form state
    amount: string;
    recipientAddress: string;
    
    // UI state
    isOpen: boolean;
    
    // Validation state
    validation: {
        isValid: boolean;
        hasErrors: boolean;
        hasWarnings: boolean;
        errorMessage?: string;
        warningMessages?: string[];
    };
    
    // Simulation state
    simulation: {
        isSimulating: boolean;
        result?: SimulationResult;
        lastSimulatedAmount?: string;
    };
}

export interface DialogActions {
    // Form actions
    setAmount: (amount: string) => void;
    setRecipientAddress: (address: string) => void;
    resetForm: () => void;
    
    // Dialog actions
    openDialog: () => void;
    closeDialog: () => void;
    
    // Validation actions
    setValidation: (validation: ValidationResult) => void;
    clearValidation: () => void;
    
    // Simulation actions
    runSimulation: (userAddress: string, assetAddress: string, decimals: number) => Promise<void>;
    clearSimulation: () => void;
}

export interface UseStandardizedTransactionDialogOptions<T extends TransactionType> {
    transactionType: T;
    onClose?: () => void;
    resetOnClose?: boolean;
    validateOnAmountChange?: boolean;
    validateOnAddressChange?: boolean;
    enableSimulation?: boolean;
    simulationDebounceMs?: number;
}

export interface StandardizedDialogReturn<T extends TransactionType> {
    // State
    state: DialogState;
    
    // Actions
    actions: DialogActions;
    
    // Stable individual callbacks (for use in dependency arrays)
    stableCallbacks: {
        setAmount: (amount: string) => void;
        setRecipientAddress: (address: string) => void;
        setValidation: (validation: ValidationResult) => void;
        clearValidation: () => void;
        openDialog: () => void;
        closeDialog: () => void;
        runSimulation: (userAddress: string, assetAddress: string, decimals: number) => Promise<void>;
        clearSimulation: () => void;
    };
    
    // Transaction flow
    transactionFlow: ReturnType<typeof useTransactionFlow<T>>;
    
    // Cross-chain tracking
    crossChain: ReturnType<typeof useCrossChainTracking>;
    
    // Computed values
    computed: {
        isValidForSubmission: boolean;
        hasFormData: boolean;
        shouldShowValidation: boolean;
    };
}

/**
 * Custom hook for standardized transaction dialog state management
 */
export function useStandardizedTransactionDialog<T extends TransactionType>({
    transactionType,
    onClose,
    resetOnClose = true,
    enableSimulation = true}: UseStandardizedTransactionDialogOptions<T>): StandardizedDialogReturn<T> {
    
    // Form state
    const [amount, setAmount] = useState('');
    const [recipientAddress, setRecipientAddress] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    
    // Validation state
    const [validation, setValidationState] = useState<DialogState['validation']>({
        isValid: true,
        hasErrors: false,
        hasWarnings: false
    });
    
    // Simulation state
    const [simulation, setSimulationState] = useState<DialogState['simulation']>({
        isSimulating: false
    });
    
    // Transaction management hooks
    const transactionFlow = useTransactionFlow<T>();
    const crossChain = useCrossChainTracking();
    
    // Individual action callbacks
    const setAmountCallback = useCallback((newAmount: string) => {
        setAmount(newAmount);
    }, []);
    
    const setRecipientAddressCallback = useCallback((address: string) => {
        setRecipientAddress(address);
    }, []);
    
    const resetFormCallback = useCallback(() => {
        setAmount('');
        setRecipientAddress('');
        setValidationState({
            isValid: true,
            hasErrors: false,
            hasWarnings: false
        });
    }, []);
    
    const openDialogCallback = useCallback(() => {
        setIsOpen(true);
    }, []);
    
    const closeDialogCallback = useCallback(() => {
        setIsOpen(false);
        
        if (resetOnClose) {
            // Reset form state
            setAmount('');
            setRecipientAddress('');
            setValidationState({
                isValid: true,
                hasErrors: false,
                hasWarnings: false
            });
            
            // Reset transaction flow
            transactionFlow.actions.reset();
            
            // Reset cross-chain tracking
            crossChain.reset();
        }
        
        // Call external close handler
        onClose?.();
    }, [resetOnClose]); // Remove onClose to prevent instability
    
    const setValidationCallback = useCallback((validationResult: ValidationResult) => {
        setValidationState({
            isValid: validationResult.isValid,
            hasErrors: !validationResult.isValid,
            hasWarnings: Boolean(validationResult.warnings?.length),
            ...(validationResult.error && { errorMessage: validationResult.error }),
            ...(validationResult.warnings && { warningMessages: validationResult.warnings })
        });
    }, []);
    
    const clearValidationCallback = useCallback(() => {
        setValidationState({
            isValid: true,
            hasErrors: false,
            hasWarnings: false
        });
    }, []);
    
    const runSimulationCallback = useCallback(async (userAddress: string, assetAddress: string, decimals: number) => {
        if (!enableSimulation || !amount.trim()) {
            return;
        }

        setSimulationState(prev => ({
            ...prev,
            isSimulating: true
        }));

        try {
            // Only simulate for supported transaction types
            if (!['supply', 'borrow', 'withdraw', 'repay'].includes(transactionType)) {
                return;
            }

            const result = await simulateTransaction(transactionType as 'supply' | 'borrow' | 'withdraw' | 'repay', {
                userAddress,
                assetAddress,
                amount,
                decimals
            });

            setSimulationState({
                isSimulating: false,
                result,
                lastSimulatedAmount: amount
            });

            // If simulation failed, update validation state
            if (!result.success && result.error) {
                setValidationState(prev => ({
                    ...prev,
                    isValid: false,
                    hasErrors: true,
                    ...(result.error && { errorMessage: result.error })
                }));
            } else if (result.warnings?.length) {
                // Add simulation warnings to validation
                setValidationState(prev => ({
                    ...prev,
                    hasWarnings: true,
                    warningMessages: [...(prev.warningMessages ?? []), ...result.warnings!]
                }));
            }
        } catch (error) {
            setSimulationState({
                isSimulating: false,
                result: {
                    success: false,
                    error: `Simulation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
                },
                lastSimulatedAmount: amount
            });
        }
    }, [enableSimulation, amount, transactionType]);
    
    const clearSimulationCallback = useCallback(() => {
        setSimulationState({
            isSimulating: false
        });
    }, []);

    // Memoized actions object to prevent infinite re-renders
    const actions: DialogActions = useMemo(() => ({
        setAmount: setAmountCallback,
        setRecipientAddress: setRecipientAddressCallback,
        resetForm: resetFormCallback,
        openDialog: openDialogCallback,
        closeDialog: closeDialogCallback,
        setValidation: setValidationCallback,
        clearValidation: clearValidationCallback,
        runSimulation: runSimulationCallback,
        clearSimulation: clearSimulationCallback
    }), [
        setAmountCallback,
        setRecipientAddressCallback,
        resetFormCallback,
        openDialogCallback,
        closeDialogCallback,
        setValidationCallback,
        clearValidationCallback,
        runSimulationCallback,
        clearSimulationCallback
    ]);
    
    // State object
    const state: DialogState = {
        amount,
        recipientAddress,
        isOpen,
        validation,
        simulation
    };
    
    // Computed values
    const computed = {
        isValidForSubmission: validation.isValid && Boolean(amount.trim()),
        hasFormData: Boolean(amount.trim() || recipientAddress.trim()),
        shouldShowValidation: validation.hasErrors || validation.hasWarnings
    };
    
    // Auto-close dialog when transaction succeeds
    useEffect(() => {
        if (transactionFlow.state.currentStep === 'success' && crossChain.status === 'success') {
            // Small delay to show success state before closing
            const timer = setTimeout(() => {
                closeDialogCallback();
            }, 2000);
            return () => clearTimeout(timer);
        }
        return () => {};
    }, [transactionFlow.state.currentStep, crossChain.status, closeDialogCallback]);
    
    // Reset transaction state when dialog closes
    useEffect(() => {
        if (!isOpen && resetOnClose) {
            transactionFlow.actions.reset();
            crossChain.reset();
            clearSimulationCallback();
        }
    }, [isOpen, resetOnClose, clearSimulationCallback]); // Remove transactionFlow.actions and crossChain from deps
    
    return {
        state,
        actions,
        stableCallbacks: {
            setAmount: setAmountCallback,
            setRecipientAddress: setRecipientAddressCallback,
            setValidation: setValidationCallback,
            clearValidation: clearValidationCallback,
            openDialog: openDialogCallback,
            closeDialog: closeDialogCallback,
            runSimulation: runSimulationCallback,
            clearSimulation: clearSimulationCallback
        },
        transactionFlow,
        crossChain,
        computed
    };
}

/**
 * Hook for transaction dialogs that don't need recipient address
 */
export function useSimpleTransactionDialog<T extends TransactionType>(
    options: Omit<UseStandardizedTransactionDialogOptions<T>, 'validateOnAddressChange'>
) {
    const result = useStandardizedTransactionDialog({
        ...options,
        validateOnAddressChange: false
    });
    
    // Override actions to hide recipient address functionality
    const simplifiedActions = {
        ...result.actions,
        setRecipientAddress: () => {}, // No-op for simple dialogs
    };
    
    return {
        ...result,
        actions: simplifiedActions
    };
}

/**
 * Standardized dialog cleanup effect
 * Ensures consistent cleanup behavior across all dialogs
 */
export function useDialogCleanup(
    isOpen: boolean,
    resetFunctions: Array<() => void>,
    dependencies: unknown[] = []
) {
    useEffect(() => {
        if (!isOpen) {
            resetFunctions.forEach(fn => fn());
        }
    }, [isOpen, ...dependencies]); // eslint-disable-line react-hooks/exhaustive-deps
}

/**
 * Standardized validation effect
 * Provides consistent validation timing across dialogs
 */
export function useValidationEffect(
    value: string,
    validationFunction: (value: string) => ValidationResult,
    setValidation: (result: ValidationResult) => void,
    enabled: boolean = true,
    debounceMs: number = 300
) {
    useEffect(() => {
        if (!enabled || !value.trim()) {
            return;
        }
        
        const timer = setTimeout(() => {
            const result = validationFunction(value);
            setValidation(result);
        }, debounceMs);
        
        return () => clearTimeout(timer);
    }, [value, validationFunction, setValidation, enabled, debounceMs]);
}

/**
 * Type guard to check if a transaction type supports recipient addresses
 */
export function transactionSupportsRecipient(type: TransactionType): boolean {
    return ['withdraw', 'borrow'].includes(type);
}

/**
 * Get default minimum amount for different transaction types
 */
export function getDefaultMinAmount(type: TransactionType): string {
    switch (type) {
        case 'supply':
            return '0.000001';
        case 'withdraw':
            return '0.000001';
        case 'borrow':
            return '0.01'; // Higher minimum for borrowing
        case 'repay':
            return '0.000001';
        default:
            return '0.000001';
    }
}