import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useAccount, useSwitchChain, useChainId } from 'wagmi';
import { parseUnits } from 'viem';
import { isAddress } from 'viem';
import { BaseTransactionDialog } from '../ui/base-transaction-dialog';
import { TransactionStatus } from '../ui/transaction-status';
import { TransactionSummary } from '../ui/transaction-summary';
import { TransactionSimulationDisplay } from '../ui/transaction-simulation-display';
import { BorrowFormSection } from './borrow/BorrowFormSection';
import { NetworkSwitchSection } from './borrow/NetworkSwitchSection';
import { BorrowHealthFactorSection } from './borrow/BorrowHealthFactorSection';
import { useCrossChainTracking } from '../../hooks/useCrossChainTracking';
import { useContracts } from '../../hooks/useContracts';
import { useBorrowTransactionFlow } from '../../hooks/useTransactionFlow';
import { useBorrowValidation } from '../../hooks/useBorrowValidation';
import { useGasTokenApproval, getGasTokenApprovalContractCall } from '../../hooks/useGasTokenApproval';
import { useStandardizedTransactionDialog } from '../../hooks/useStandardizedTransactionDialog';
import { useAutoSimulation } from '../../hooks/useAutoSimulation';
import { SupportedChain } from '../../contracts/deployments';
import { getChainDisplayNameFromId } from '../../utils/chainUtils';
import { safeEVMAddressOrZeroAddress, validateEVMAddress } from '@/types/address';
import { type BorrowableAssetData } from '../../utils/directContractCalls';
import { UniversalLendingProtocol__factory } from '@/contracts/typechain-types';
import { isValidSolanaAddress } from '../../lib/solana-utils';
import { solanaAddressToHexBytes, addressToHexBytes } from '@/utils/viemHelpers';

interface BorrowDialogProps {
    isOpen: boolean;
    onClose: () => void;
    selectedAsset: BorrowableAssetData;
    refetchUserData?: () => Promise<void>;
}

// Contract ABI
const lendingProtocolAbi = UniversalLendingProtocol__factory.abi;

export function BorrowDialogRefactored({
    isOpen,
    onClose,
    selectedAsset
}: BorrowDialogProps) {
    const isDestinationSolana = selectedAsset.externalChainId === SupportedChain.SOLANA_DEVNET;
    const [isRecipientInitialized, setIsRecipientInitialized] = useState(false);

    // Custom hooks
    const crossChain = useCrossChainTracking();
    const transactionFlow = useBorrowTransactionFlow();
    const { address } = useAccount();
    const currentChainId = useChainId();
    const { switchChain } = useSwitchChain();
    const safeAddress = safeEVMAddressOrZeroAddress(address);
    const { universalLendingProtocol, priceOracle } = useContracts(SupportedChain.ZETA_TESTNET);

    // Use standardized dialog management with simulation
    const dialog = useStandardizedTransactionDialog({
        transactionType: 'borrow',
        onClose,
        resetOnClose: true,
        enableSimulation: true
    });

    const { state, stableCallbacks } = dialog;

    // Check if user is on ZetaChain (required for borrowing)
    const isOnZetaChain = currentChainId === SupportedChain.ZETA_TESTNET;

    // Convert BorrowableAssetData to UserAssetData for validation hook
    const userAssetData = useMemo(() => ({
        address: validateEVMAddress(selectedAsset.address),
        symbol: selectedAsset.symbol,
        unit: selectedAsset.unit,
        sourceChain: selectedAsset.sourceChain,
        suppliedBalance: '0', // Not relevant for borrowing
        borrowedBalance: '0', // Will be filled by validation hook
        formattedSuppliedBalance: '0',
        formattedBorrowedBalance: '0',
        suppliedUsdValue: '$0',
        borrowedUsdValue: '$0',
        price: selectedAsset.price,
        isSupported: selectedAsset.isSupported,
        externalBalance: selectedAsset.balance,
        formattedExternalBalance: selectedAsset.formattedBalance,
        externalChainId: selectedAsset.externalChainId,
        decimals: selectedAsset.decimals,
    }), [selectedAsset]);

    // Validation hook
    const validation = useBorrowValidation({
        selectedAsset: userAssetData,
        amountToBorrow: state.amount,
        universalLendingProtocol: safeEVMAddressOrZeroAddress(universalLendingProtocol),
        priceOracle: safeEVMAddressOrZeroAddress(priceOracle),
        userAddress: safeAddress,
    });

    // Computed values
    const amountBigInt = useMemo(() => {
        if (!state.amount || !selectedAsset) return BigInt(0);
        try {
            return parseUnits(state.amount, selectedAsset.decimals);
        } catch (error) {
            console.error('Error parsing amount:', error);
            return BigInt(0);
        }
    }, [state.amount, selectedAsset]);
    // Gas token approval hook
    const gasApproval = useGasTokenApproval({
        selectedAsset: userAssetData,
        borrowAmount: amountBigInt,
        universalLendingProtocol: safeEVMAddressOrZeroAddress(universalLendingProtocol),
    });

    // Auto-simulation when amount changes
    useAutoSimulation({
        amount: state.amount,
        assetAddress: selectedAsset.address,
        decimals: selectedAsset.decimals,
        enabled: Boolean(selectedAsset && address && isOnZetaChain),
        runSimulation: stableCallbacks.runSimulation
    });

    // Address validation
    const isValidRecipientAddress = useCallback(() => {
        if (!state.recipientAddress.trim()) return false;

        if (isDestinationSolana) {
            return isValidSolanaAddress(state.recipientAddress);
        } else {
            return isAddress(state.recipientAddress);
        }
    }, [state.recipientAddress, isDestinationSolana]);

    // Computed values
    const isValidRecipient = isValidRecipientAddress();

    // Destructure transaction flow state
    const { state: txState, actions: txActions, contractState } = transactionFlow;

    // Handle network switching to ZetaChain
    const handleSwitchToZeta = useCallback(async () => {
        if (!switchChain) return;

        try {
            txActions.setCurrentStep('switchNetwork');
            switchChain({ chainId: SupportedChain.ZETA_TESTNET });
        } catch (error) {
            console.error('Error switching to ZetaChain:', error);
            txActions.setCurrentStep('input');
            txActions.setIsSubmitting(false);
        }
    }, [switchChain, txActions]);

    // Convert recipient address to bytes for contract call
    const getRecipientBytes = useCallback((): `0x${string}` => {
        try {
            if (isDestinationSolana) {
                // For Solana addresses, convert to UTF-8 bytes
                return solanaAddressToHexBytes(state.recipientAddress);
            } else {
                // For EVM addresses, use as hex directly
                return addressToHexBytes(state.recipientAddress);
            }
        } catch (error) {
            console.error('Error converting recipient address to bytes:', error);
            return '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`;
        }
    }, [state.recipientAddress, isDestinationSolana]);

    // Main submit handler
    const handleSubmit = useCallback(async () => {
        if (!state.amount || !selectedAsset || !amountBigInt || !universalLendingProtocol) return;

        txActions.setIsSubmitting(true);
        txActions.resetContract();

        try {
            // First check if user is on ZetaChain
            if (!isOnZetaChain) {
                await handleSwitchToZeta();
                return; // Exit here, the network switch will trigger a re-render
            }

            // Check if gas token approval is needed
            if (gasApproval.needsApproval && gasApproval.gasTokenAddress) {
                txActions.setCurrentStep('approve');
                const approvalCall = getGasTokenApprovalContractCall(
                    gasApproval.gasTokenAddress,
                    safeEVMAddressOrZeroAddress(universalLendingProtocol)
                );
                txActions.writeContract(approvalCall);
                return; // Exit here, approval success will trigger borrow transaction
            }

            // Proceed with borrow transaction
            txActions.setCurrentStep('borrow');
            txActions.writeContract({
                address: safeEVMAddressOrZeroAddress(universalLendingProtocol),
                abi: lendingProtocolAbi,
                functionName: 'borrowCrossChain',
                args: [
                    validateEVMAddress(selectedAsset.address),
                    amountBigInt,
                    BigInt(selectedAsset.externalChainId),
                    getRecipientBytes(),
                ],
            });
        } catch (error) {
            console.error('Error borrowing', error);
            txActions.setIsSubmitting(false);
            txActions.setCurrentStep('input');
        }
    }, [state.amount, selectedAsset, amountBigInt, universalLendingProtocol, txActions, isOnZetaChain, handleSwitchToZeta, gasApproval, getRecipientBytes]);

    // Handle max click
    const handleMaxClick = useCallback(() => {
        stableCallbacks.setAmount(validation.maxBorrowAmount);
    }, [stableCallbacks, validation.maxBorrowAmount]);

    // Handle paste from clipboard
    const handlePasteFromClipboard = useCallback(async () => {
        try {
            const text = await navigator.clipboard.readText();
            if (text.trim()) {
                stableCallbacks.setRecipientAddress(text.trim());
            }
        } catch (error) {
            console.error('Failed to read from clipboard:', error);
        }
    }, [stableCallbacks]);

    // Initialize recipient address with user's address (for non-Solana) when address becomes available
    useEffect(() => {
        if (address && !isDestinationSolana && !isRecipientInitialized) {
            stableCallbacks.setRecipientAddress(address);
            setIsRecipientInitialized(true);
        }
    }, [address, isDestinationSolana, isRecipientInitialized, stableCallbacks, stableCallbacks.setRecipientAddress]);

    // Handle retry after failure
    const handleRetry = useCallback(() => {
        txActions.resetContract();
        txActions.setCurrentStep('input');
        txActions.setIsSubmitting(false);
    }, [txActions]);

    // Handle approval transaction success -> proceed to borrow
    useEffect(() => {
        if (contractState.isApprovalSuccess && txState.currentStep === 'approving') {
            txActions.setCurrentStep('borrow');
            txActions.writeContract({
                address: safeEVMAddressOrZeroAddress(universalLendingProtocol),
                abi: lendingProtocolAbi,
                functionName: 'borrowCrossChain',
                args: [
                    validateEVMAddress(selectedAsset.address),
                    amountBigInt,
                    BigInt(selectedAsset.externalChainId),
                    getRecipientBytes(),
                ],
            });
        }
    }, [contractState.isApprovalSuccess, txState.currentStep, universalLendingProtocol, selectedAsset, amountBigInt, getRecipientBytes, txActions]);

    // Handle borrow transaction success -> show success and start cross-chain tracking
    useEffect(() => {
        if (contractState.isTransactionSuccess && txState.currentStep === 'borrowing' && txState.transactionHash) {
            txActions.setCurrentStep('success');
            txActions.setIsSubmitting(false);
            crossChain.startTracking(txState.transactionHash);
        }
    }, [contractState.isTransactionSuccess, txState.currentStep, txState.transactionHash, crossChain, txActions]);

    // Prevent circular dialog synchronization - only sync when prop changes, not internal state
    const prevIsOpenRef = useRef(isOpen);

    useEffect(() => {
        // Only sync when the prop actually changes (external control)
        if (prevIsOpenRef.current !== isOpen) {
            prevIsOpenRef.current = isOpen;

            if (isOpen && !state.isOpen) {
                stableCallbacks.openDialog();
            } else if (!isOpen && state.isOpen) {
                stableCallbacks.closeDialog();
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, state.isOpen]); // Don't include stableCallbacks to avoid infinite loops

    // Get step text
    const getStepText = useCallback(() => {
        switch (txState.currentStep) {
            case 'switchNetwork':
                return 'Switch to ZetaChain to continue borrowing';
            case 'approve':
                return 'Click to approve gas token spending';
            case 'approving':
                return 'Waiting for approval confirmation...';
            case 'borrow':
                return 'Click to borrow from protocol';
            case 'borrowing':
                return 'Processing borrow transaction...';
            case 'success':
                if (crossChain.status === 'pending') {
                    return 'Processing cross-chain withdrawal...';
                } else if (crossChain.status === 'success') {
                    return 'Cross-chain borrow completed!';
                } else if (crossChain.status === 'failed') {
                    return 'Cross-chain withdrawal failed';
                } else {
                    return 'Borrow transaction confirmed!';
                }
            default:
                return 'Enter borrow details';
        }
    }, [txState.currentStep, crossChain.status]);

    // Wrapper for async submit function to match dialog interface
    const handleSubmitWrapper = useCallback(() => {
        void handleSubmit();
    }, [handleSubmit]);

    // Check if form is valid for submission
    const isValidForSubmission = Boolean(
        state.amount &&
        isValidRecipient &&
        !validation.error &&
        !gasApproval.error &&
        (isOnZetaChain || txState.currentStep === 'switchNetwork')
    );

    return (
        <BaseTransactionDialog
            isOpen={isOpen}
            onClose={stableCallbacks.closeDialog}
            title={`Borrow ${selectedAsset.unit}`}
            description={getStepText()}
            tokenSymbol={selectedAsset.unit}
            sourceChain={selectedAsset.sourceChain}
            currentStep={txState.currentStep}
            isSubmitting={txState.isSubmitting}
            onSubmit={handleSubmitWrapper}
            onRetry={handleRetry}
            isValidAmount={isValidForSubmission}
            isConnected={Boolean(address)}
            submitButtonText="Borrow"
        >
            {txState.currentStep === 'input' && (
                <div className="space-y-4 w-full overflow-hidden">
                    {/* Network Switch Section */}
                    <NetworkSwitchSection
                        isOnZetaChain={isOnZetaChain}
                        currentChainId={currentChainId}
                        onSwitchToZeta={handleSwitchToZeta}
                        isSubmitting={txState.isSubmitting}
                    />

                    {/* Form Section */}
                    {isOnZetaChain && (
                        <BorrowFormSection
                            selectedAsset={selectedAsset}
                            amount={state.amount}
                            onAmountChange={stableCallbacks.setAmount}
                            recipientAddress={state.recipientAddress}
                            onRecipientAddressChange={stableCallbacks.setRecipientAddress}
                            onMaxClick={handleMaxClick}
                            onPasteFromClipboard={handlePasteFromClipboard}
                            maxBorrowAmount={validation.maxBorrowAmount}
                            isValidRecipient={isValidRecipient}
                            hasValidationErrors={Boolean(validation.error)}
                            validationErrors={validation.error ? [validation.error] : []}
                            hasValidationWarnings={false}
                            validationWarnings={[]}
                        />
                    )}

                    {/* Health Factor Section */}
                    {isOnZetaChain && validation.currentHealthFactor !== null && validation.currentHealthFactor > 0 && (
                        <BorrowHealthFactorSection
                            currentHealthFactor={validation.currentHealthFactor}
                            projectedHealthFactor={validation.estimatedHealthFactor}
                            showProjection={Boolean(state.amount && !validation.error)}
                        />
                    )}
                    {/* Transaction Simulation */}
                    {isOnZetaChain && (
                        <TransactionSimulationDisplay
                            simulation={state.simulation}
                            currentAmount={state.amount}
                            className="mb-4"
                        />
                    )}

                    {/* Transaction Summary */}
                    {isOnZetaChain && state.amount && (
                        <TransactionSummary
                            transactionType="borrow"
                            amount={state.amount}
                            tokenSymbol={selectedAsset.unit}
                            destinationChain={getChainDisplayNameFromId(selectedAsset.externalChainId)}
                            recipientAddress={state.recipientAddress || ''}
                            className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20"
                        />
                    )}
                </div>
            )}

            <TransactionStatus
                currentStep={txState.currentStep}
                approvalHash={txState.approvalHash}
                transactionHash={txState.transactionHash}
                isApprovingTx={contractState.isApprovingTx}
                isApprovalSuccess={contractState.isApprovalSuccess}
                isTransactionTx={contractState.isTransactionTx}
                isTransactionSuccess={contractState.isTransactionSuccess}
                chainId={SupportedChain.ZETA_TESTNET}
                crossChain={crossChain}
                transactionType="borrow"
            />
        </BaseTransactionDialog>
    );
}