import { useState, useCallback, useEffect } from 'react';
import { useAccount, useSwitchChain, useChainId } from 'wagmi';
import { parseUnits } from 'viem';
import { isAddress } from 'viem';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { BaseTransactionDialog } from '../ui/base-transaction-dialog';
import { TransactionStatus } from '../ui/transaction-status';
import { TransactionSummary } from '../ui/transaction-summary';
import { useCrossChainTracking } from '../../hooks/useCrossChainTracking';
import { useContracts } from '../../hooks/useContracts';
import { useBorrowTransactionFlow } from '../../hooks/useTransactionFlow';
import { useBorrowValidation } from '../../hooks/useBorrowValidation';
import { useGasTokenApproval, getGasTokenApprovalContractCall } from '../../hooks/useGasTokenApproval';
import { SupportedChain, getNetworkConfig } from '../../contracts/deployments';
import { getChainDisplayNameFromId } from '../../utils/chainUtils';
import { safeEVMAddressOrZeroAddress } from '@/types/address';
import { type UserAssetData } from './types';
import { UniversalLendingProtocol__factory } from '@/contracts/typechain-types';
import { getHealthFactorColorClass, formatHealthFactor } from '../../utils/healthFactorUtils';
import { isValidSolanaAddress } from '../../lib/solana-utils';
import { utils } from 'ethers';
import { FaClipboard } from 'react-icons/fa';

interface BorrowDialogProps {
    isOpen: boolean;
    onClose: () => void;
    selectedAsset: UserAssetData;
    refetchUserData?: () => Promise<void>;
}

// Contract ABI
const lendingProtocolAbi = UniversalLendingProtocol__factory.abi;

export function BorrowDialog({
    isOpen,
    onClose,
    selectedAsset
}: BorrowDialogProps) {
    const [amount, setAmount] = useState('');
    const isDestinationSolana = selectedAsset.sourceChain === 'SOL';
    const [recipientAddress, setRecipientAddress] = useState<string>('');

    // Custom hooks
    const crossChain = useCrossChainTracking();
    const transactionFlow = useBorrowTransactionFlow();
    const { address } = useAccount();
    const currentChainId = useChainId();
    const { switchChain } = useSwitchChain();
    const safeAddress = safeEVMAddressOrZeroAddress(address);
    const { universalLendingProtocol, priceOracle } = useContracts(SupportedChain.ZETA_TESTNET);

    // Check if user is on ZetaChain (required for borrowing)
    const isOnZetaChain = currentChainId === SupportedChain.ZETA_TESTNET;
    const zetaNetworkConfig = getNetworkConfig(SupportedChain.ZETA_TESTNET);

    // Validation hook
    const validation = useBorrowValidation({
        selectedAsset,
        amountToBorrow: amount,
        universalLendingProtocol: safeEVMAddressOrZeroAddress(universalLendingProtocol),
        priceOracle: safeEVMAddressOrZeroAddress(priceOracle),
        userAddress: safeAddress,
    });

    // Computed values
    const amountBigInt = amount && selectedAsset ? parseUnits(amount, selectedAsset.decimals) : BigInt(0);

    // Gas token approval hook
    const gasApproval = useGasTokenApproval({
        selectedAsset,
        borrowAmount: amountBigInt,
        universalLendingProtocol: safeEVMAddressOrZeroAddress(universalLendingProtocol),
    });

    // Address validation
    const isValidRecipientAddress = useCallback(() => {
        if (!recipientAddress.trim()) return false;

        if (isDestinationSolana) {
            return isValidSolanaAddress(recipientAddress);
        } else {
            return isAddress(recipientAddress);
        }
    }, [recipientAddress, isDestinationSolana]);

    // Computed values
    const isValidRecipient = isValidRecipientAddress();

    // Destructure transaction flow state
    const { state: txState, actions: txActions, contractState } = transactionFlow;

    // Handle network switching to ZetaChain
    const handleSwitchToZeta = useCallback(async () => {
        if (!switchChain) return;

        try {
            txActions.setCurrentStep('switchNetwork');
            void switchChain({ chainId: SupportedChain.ZETA_TESTNET });
        } catch (error) {
            console.error('Error switching to ZetaChain:', error);
            txActions.setCurrentStep('input');
            txActions.setIsSubmitting(false);
        }
    }, [switchChain, txActions]);

    // Convert recipient address to bytes for contract call
    const getRecipientBytes = useCallback((): `0x${string}` => {
        if (isDestinationSolana) {
            // For Solana addresses, convert to UTF-8 bytes (as per withdraw-all-sol-crosschain.ts:172)
            return utils.hexlify(utils.toUtf8Bytes(recipientAddress)) as `0x${string}`;
        } else {
            // For EVM addresses, hexlify directly 
            return utils.hexlify(recipientAddress) as `0x${string}`;
        }
    }, [recipientAddress, isDestinationSolana]);

    // Main submit handler
    const handleSubmit = useCallback(async () => {
        if (!amount || !selectedAsset || !amountBigInt || !universalLendingProtocol) return;

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
                    selectedAsset.address,
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
    }, [amount, selectedAsset, amountBigInt, universalLendingProtocol, txActions, isOnZetaChain, handleSwitchToZeta, gasApproval, getRecipientBytes]);

    // Handle max click
    const handleMaxClick = useCallback(() => {
        setAmount(validation.maxBorrowAmount);
    }, [validation.maxBorrowAmount]);

    // Handle recipient address change
    const handleRecipientAddressChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setRecipientAddress(e.target.value);
    }, []);

    // Handle paste from clipboard
    const handlePasteFromClipboard = useCallback(async () => {
        try {
            const text = await navigator.clipboard.readText();
            if (text.trim()) {
                setRecipientAddress(text.trim());
            }
        } catch (error) {
            console.error('Failed to read from clipboard:', error);
        }
    }, []);

    // Initialize recipient address with user's address (for non-Solana) when address becomes available
    useEffect(() => {
        if (address && !isDestinationSolana && !recipientAddress) {
            setRecipientAddress(address);
        }
    }, [address, isDestinationSolana, recipientAddress]);

    // Handle close
    const handleClose = useCallback(() => {
        setAmount('');
        setRecipientAddress('');
        txActions.reset();
        crossChain.reset();
        onClose();
    }, [onClose, txActions, crossChain]);

    // Get step text
    const getStepText = useCallback(() => {
        switch (txState.currentStep) {
            case 'switchNetwork':
                return `Switch to ${zetaNetworkConfig?.name || 'ZetaChain'} to borrow`;
            case 'approve':
                return 'Approve gas token for withdrawal fees';
            case 'approving':
                return 'Waiting for approval confirmation...';
            case 'borrow':
                return 'Sign transaction to borrow from protocol';
            case 'borrowing':
                return 'Waiting for borrow confirmation...';
            case 'success':
                if (crossChain.status === 'pending') {
                    return 'Processing cross-chain borrow...';
                } else if (crossChain.status === 'success') {
                    return 'Cross-chain borrow completed!';
                } else if (crossChain.status === 'failed') {
                    return 'Cross-chain borrow failed';
                } else {
                    return 'Borrow transaction confirmed!';
                }
            case 'failed':
                return 'Borrow transaction failed';
            default:
                if (!isOnZetaChain && zetaNetworkConfig) {
                    return `Switch to ${zetaNetworkConfig.name} to borrow ${selectedAsset.unit}`;
                }
                return `Enter amount to borrow ${selectedAsset.unit}`;
        }
    }, [txState.currentStep, crossChain.status, selectedAsset.unit, isOnZetaChain, zetaNetworkConfig]);

    // Handle amount change
    const handleAmountChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setAmount(e.target.value);
    }, []);

    // Handle retry after failure
    const handleRetry = useCallback(() => {
        txActions.resetContract();
        txActions.setCurrentStep('input');
        txActions.setIsSubmitting(false);
    }, [txActions]);

    // Handle borrow transaction success
    useEffect(() => {
        if (contractState.isTransactionSuccess && txState.currentStep === 'borrowing' && txState.transactionHash) {
            txActions.setCurrentStep('success');
            txActions.setIsSubmitting(false);
            crossChain.startTracking(txState.transactionHash);
        }
    }, [contractState.isTransactionSuccess, txState.currentStep, txState.transactionHash, crossChain, txActions]);

    // Handle borrow transaction failure
    useEffect(() => {
        if (contractState.isTransactionError && txState.currentStep === 'borrowing') {
            txActions.setCurrentStep('failed');
            txActions.setIsSubmitting(false);
        }
    }, [contractState.isTransactionError, txState.currentStep, txActions]);

    // Handle contract write errors (before transaction is submitted)
    useEffect(() => {
        if (contractState.error && (txState.currentStep === 'borrow' || txState.currentStep === 'borrowing')) {
            txActions.setCurrentStep('failed');
            txActions.setIsSubmitting(false);
        }
    }, [contractState.error, txState.currentStep, txActions]);

    // Handle approval success - proceed with borrow transaction
    useEffect(() => {
        if (contractState.isApprovalSuccess && txState.currentStep === 'approving' && amount && selectedAsset && amountBigInt && universalLendingProtocol) {
            // Approval successful, proceed with borrow transaction
            txActions.setCurrentStep('borrow');
            txActions.writeContract({
                address: safeEVMAddressOrZeroAddress(universalLendingProtocol),
                abi: lendingProtocolAbi,
                functionName: 'borrowCrossChain',
                args: [
                    selectedAsset.address,
                    amountBigInt,
                    BigInt(selectedAsset.externalChainId),
                    getRecipientBytes(),
                ],
            });
        }
    }, [contractState.isApprovalSuccess, txState.currentStep, amount, selectedAsset, amountBigInt, universalLendingProtocol, txActions, getRecipientBytes]);

    // Handle successful network switch to ZetaChain
    useEffect(() => {
        if (txState.currentStep === 'switchNetwork' && isOnZetaChain) {
            // Network switch successful, proceed with the borrow transaction
            txActions.setCurrentStep('input');
            txActions.setIsSubmitting(false);

            // Auto-proceed with the borrow transaction after network switch
            setTimeout(() => {
                if (amount && selectedAsset && amountBigInt && universalLendingProtocol) {
                    // Check if approval is needed first
                    if (gasApproval.needsApproval && gasApproval.gasTokenAddress) {
                        txActions.setCurrentStep('approve');
                        const approvalCall = getGasTokenApprovalContractCall(
                            gasApproval.gasTokenAddress,
                            safeEVMAddressOrZeroAddress(universalLendingProtocol)
                        );
                        txActions.writeContract(approvalCall);
                    } else {
                        // No approval needed, proceed with borrow
                        txActions.setCurrentStep('borrow');
                        txActions.writeContract({
                            address: safeEVMAddressOrZeroAddress(universalLendingProtocol),
                            abi: lendingProtocolAbi,
                            functionName: 'borrowCrossChain',
                            args: [
                                selectedAsset.address,
                                amountBigInt,
                                BigInt(selectedAsset.externalChainId),
                                getRecipientBytes(),
                            ],
                        });
                    }
                }
            }, 500); // Small delay to ensure network switch is complete
        }
    }, [txState.currentStep, isOnZetaChain, amount, selectedAsset, amountBigInt, universalLendingProtocol, txActions, gasApproval, getRecipientBytes]);

    // Early return after all hooks
    if (!selectedAsset || !universalLendingProtocol) return null;

    return (
        <BaseTransactionDialog
            isOpen={isOpen}
            onClose={handleClose}
            title={`Borrow ${selectedAsset.unit}`}
            description={getStepText()}
            tokenSymbol={selectedAsset.unit}
            sourceChain={selectedAsset.sourceChain}
            currentStep={txState.currentStep}
            isSubmitting={txState.isSubmitting}
            onSubmit={() => { void handleSubmit() }}
            onRetry={handleRetry}
            isValidAmount={validation.isValid && !gasApproval.hasInsufficientBalance && !gasApproval.error && isValidRecipient}
            isConnected={Boolean(address)}
            submitButtonText={
                !isOnZetaChain
                    ? `Switch to ${zetaNetworkConfig?.name || 'ZetaChain'}`
                    : gasApproval.needsApproval
                        ? "Approve & Borrow"
                        : "Borrow"
            }
        >
            {(txState.currentStep === 'input' || txState.currentStep === 'failed') && (
                <div className="space-y-4 w-full overflow-hidden">
                    {/* Network Warning */}
                    {!isOnZetaChain && zetaNetworkConfig && (
                        <div className="p-3 border border-yellow-200 dark:border-yellow-800 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 text-sm">
                            <div className="text-yellow-800 dark:text-yellow-200 font-medium">
                                Network Switch Required
                            </div>
                            <div className="text-yellow-700 dark:text-yellow-300 mt-1">
                                You need to switch to {zetaNetworkConfig.name} to borrow {selectedAsset.unit}.
                                Click "Borrow" to switch networks automatically.
                            </div>
                        </div>
                    )}

                    {/* Amount Input */}
                    <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                            <span>Amount</span>
                            <span>Max Borrow: {Number(validation.maxBorrowAmount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })}</span>
                        </div>
                        <div className="relative">
                            <Input
                                type="number"
                                value={amount}
                                onChange={handleAmountChange}
                                placeholder="0.00"
                                step="any"
                                min="0"
                                max={validation.maxBorrowAmount}
                            />
                            <Button
                                variant="zeta-outline"
                                size="sm"
                                className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 text-xs"
                                onClick={handleMaxClick}
                            >
                                MAX
                            </Button>
                        </div>
                    </div>

                    {/* Recipient Address Input */}
                    <div className="space-y-3">
                        <div className="flex justify-between items-center text-sm">
                            <span className="font-medium">Recipient Address</span>
                            <span className="text-xs text-muted-foreground px-2 py-1 bg-muted rounded-md">
                                {isDestinationSolana ? 'Solana Address' : 'EVM Address'}
                            </span>
                        </div>

                        <div className="space-y-2">
                            <div className="relative">
                                <Input
                                    type="text"
                                    value={recipientAddress}
                                    onChange={handleRecipientAddressChange}
                                    placeholder={isDestinationSolana
                                        ? "Enter Solana address..."
                                        : "Enter EVM address (0x...)"}
                                    className={`${address && !isDestinationSolana ? 'pr-24' : 'pr-4'} ${!isValidRecipient && recipientAddress.trim() ? 'border-destructive focus:border-destructive' : ''}`}
                                />
                                <Button
                                    variant="zeta-outline"
                                    size="sm"
                                    className="absolute right-2 top-1/2 transform -translate-y-1/2 h-7 w-7 p-0"
                                    onClick={handlePasteFromClipboard}
                                    title="Paste from clipboard"
                                >
                                    <FaClipboard className="h-3 w-3" />
                                </Button>
                            </div>

                            {/* Validation Status */}
                            <div className="min-h-[1.25rem]">
                                {recipientAddress.trim() && !isValidRecipient && (
                                    <div className="text-xs text-destructive flex items-center gap-1">
                                        <span className="inline-block w-3 h-3 text-center">⚠</span>
                                        {isDestinationSolana ? 'Invalid Solana address' : 'Invalid EVM address'}
                                    </div>
                                )}
                                {recipientAddress.trim() && isValidRecipient && (
                                    <div className="text-xs text-green-600 flex items-center gap-1">
                                        <span className="inline-block w-3 h-3 text-center">✓</span>
                                        Valid {isDestinationSolana ? 'Solana' : 'EVM'} address
                                    </div>
                                )}
                            </div>

                            {/* Helper text for Solana */}
                            {isDestinationSolana && !recipientAddress.trim() && (
                                <div className="text-xs text-muted-foreground">
                                    Example: 9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Borrow Destination Info */}
                    <div className="p-3 bg-muted rounded-lg text-sm">
                        <div className="flex justify-between">
                            <span>Borrowing to chain:</span>
                            <span className="font-medium">{getChainDisplayNameFromId(selectedAsset.externalChainId)}</span>
                        </div>
                        <div className="flex justify-between mt-1">
                            <span>Asset:</span>
                            <span className="font-medium">{selectedAsset.unit}</span>
                        </div>
                        <div className="flex justify-between mt-1">
                            <span>Recipient:</span>
                            <span className="font-medium text-xs">
                                {recipientAddress.slice(0, 4)}...{recipientAddress.slice(-4)}
                            </span>
                        </div>
                    </div>

                    {/* Health Factor Display */}
                    {validation.currentHealthFactor > 0 && (
                        <div className="p-3 bg-muted rounded-lg text-sm">
                            <div className="flex justify-between items-center mb-2">
                                <span className="font-medium">Health Factor</span>
                                <span className="text-xs text-muted-foreground">Minimum: 1.50</span>
                            </div>
                            <div className="space-y-2">
                                <div className="flex justify-between">
                                    <span>Current:</span>
                                    <span className={`font-medium ${getHealthFactorColorClass(validation.currentHealthFactor)}`}>
                                        {formatHealthFactor(validation.currentHealthFactor)}
                                    </span>
                                </div>
                                {amount && validation.estimatedHealthFactor > 0 && (
                                    <div className="flex justify-between">
                                        <span>After borrow:</span>
                                        <span className={`font-medium ${getHealthFactorColorClass(validation.estimatedHealthFactor)}`}>
                                            {formatHealthFactor(validation.estimatedHealthFactor)}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Gas Fee Info (show when borrowing different asset than gas token) */}
                    {gasApproval.gasTokenAddress && selectedAsset &&
                        selectedAsset.address.toLowerCase() !== gasApproval.gasTokenAddress.toLowerCase() && (
                            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-sm">
                                <div className="text-blue-800 dark:text-blue-200 font-medium mb-2">
                                    Gas Fee Information
                                </div>
                                <div className="space-y-1 text-blue-700 dark:text-blue-300">
                                    <div className="flex justify-between">
                                        <span>Gas fee:</span>
                                        <span>{(Number(gasApproval.gasFee) / 1e18).toFixed(6)} ETH.ARBI</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Your balance:</span>
                                        <span>{(Number(gasApproval.userGasBalance) / 1e18).toFixed(6)} ETH.ARBI</span>
                                    </div>
                                    {gasApproval.needsApproval && (
                                        <div className="text-blue-600 dark:text-blue-400 text-xs mt-2">
                                            Approval needed for gas token to pay withdrawal fees
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                    {/* Gas Token Error Display */}
                    {gasApproval.error && (
                        <div className="p-3 border border-destructive/50 rounded-lg bg-destructive/10 text-sm break-words max-w-full">
                            <div className="text-destructive font-medium">
                                Gas Token Error
                            </div>
                            <div className="text-destructive/80 mt-1 break-words overflow-hidden text-wrap max-w-full">
                                {gasApproval.error}
                            </div>
                        </div>
                    )}

                    {/* Validation Error Display */}
                    {validation.error && validation.error.length > 0 && (
                        <div className="p-3 border border-destructive/50 rounded-lg bg-destructive/10 text-sm break-words max-w-full">
                            <div className="text-destructive font-medium">
                                Validation Error
                            </div>
                            <div className="text-destructive/80 mt-1 break-words overflow-hidden text-wrap max-w-full">
                                {validation.error}
                            </div>
                        </div>
                    )}

                    {/* Transaction Summary */}
                    {amount && (
                        <TransactionSummary
                            transactionType="borrow"
                            amount={amount}
                            tokenSymbol={selectedAsset.unit}
                            destinationChain={getChainDisplayNameFromId(selectedAsset.externalChainId)}
                            recipientAddress={recipientAddress || ''}
                            className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20"
                        />
                    )}

                    {/* Failed State Error Display */}
                    {txState.currentStep === 'failed' && (
                        <div className="p-3 border border-destructive/50 rounded-lg bg-destructive/10 text-sm break-words max-w-full">
                            <div className="text-destructive font-medium">
                                Borrow Transaction Failed
                            </div>
                            <div className="text-destructive/80 mt-1 break-words overflow-hidden text-wrap max-w-full">
                                {contractState.transactionError?.message ??
                                    contractState.error?.message ??
                                    'The borrow transaction failed. This could be due to insufficient collateral, network issues, or transaction being rejected. Please check your position and try again.'}
                            </div>
                            {(contractState.transactionError ?? contractState.error) && (
                                <div className="mt-2 text-xs text-destructive/60">
                                    Technical details: {(() => {
                                        const errorMessage = contractState.transactionError?.message ?? contractState.error?.message;
                                        if (!errorMessage) return '';
                                        return errorMessage.length > 100
                                            ? `${errorMessage.substring(0, 100)}...`
                                            : errorMessage;
                                    })()}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Contract Error Display for input state */}
                    {txState.currentStep === 'input' && contractState.error && (
                        <div className="p-3 border border-destructive/50 rounded-lg bg-destructive/10 text-sm break-words max-w-full">
                            <div className="text-destructive font-medium">
                                Transaction Failed
                            </div>
                            <div className="text-destructive/80 mt-1 break-words overflow-hidden text-wrap max-w-full">
                                {contractState.error.message.length > 200
                                    ? `${contractState.error.message.substring(0, 200)}...`
                                    : contractState.error.message}
                            </div>
                        </div>
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