import { useState, useEffect, useCallback } from 'react';
import { useAccount, useSwitchChain, useChainId } from 'wagmi';
import { parseUnits } from 'viem';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { BaseTransactionDialog } from '../ui/base-transaction-dialog';
import { TransactionStatus } from '../ui/transaction-status';
import { TransactionSummary } from '../ui/transaction-summary';
import { useCrossChainTracking } from '../../hooks/useCrossChainTracking';
import { useContracts } from '../../hooks/useContracts';
import { useRepayTransactionFlow } from '../../hooks/useTransactionFlow';
import { useRepayValidation } from '../../hooks/useRepayValidation';
import { SupportedChain, isSupportedChain, getNetworkConfig, getTokenAddress } from '../../contracts/deployments';
import { safeEVMAddressOrZeroAddress, safeEVMAddress, type UserAssetData } from './types';
import { ERC20__factory, DepositContract__factory } from '@/contracts/typechain-types';
import { formatHexString } from '@/utils/formatHexString';
import { getHealthFactorColorClass, formatHealthFactor } from '../../utils/healthFactorUtils';

interface RepayDialogProps {
    isOpen: boolean;
    onClose: () => void;
    selectedAsset: UserAssetData;
    refetchUserData?: () => Promise<void>;
}

// Contract ABIs
const depositContractAbi = DepositContract__factory.abi;
const erc20Abi = ERC20__factory.abi;

export function RepayDialog({
    isOpen,
    onClose,
    selectedAsset
}: RepayDialogProps) {
    const [amount, setAmount] = useState('');

    // Custom hooks
    const crossChain = useCrossChainTracking();
    const transactionFlow = useRepayTransactionFlow();
    const { address } = useAccount();
    const currentChainId = useChainId();
    const { switchChain } = useSwitchChain();
    const safeAddress = safeEVMAddressOrZeroAddress(address);

    // Get the chain ID from the selected asset and ensure it's supported
    const targetChainId = selectedAsset.externalChainId;
    const isValidChain = targetChainId && isSupportedChain(targetChainId);
    const hasInvalidChain = targetChainId && !isSupportedChain(targetChainId);

    // Only use contracts if chain is valid, otherwise we'll show an error
    const { depositContract } = useContracts(isValidChain ? targetChainId : SupportedChain.ZETA_TESTNET);

    // Check if user is on the correct network
    const isOnCorrectNetwork = currentChainId === targetChainId;
    const targetNetworkConfig = getNetworkConfig(targetChainId);

    // Helper function to get the foreign chain token address
    const getForeignChainTokenAddress = useCallback(() => {
        if (!selectedAsset) return null;

        if (selectedAsset.sourceChain === 'ARBI') {
            if (selectedAsset.unit === 'USDC') {
                return getTokenAddress('USDC', SupportedChain.ARBITRUM_SEPOLIA);
            }
        } else if (selectedAsset.sourceChain === 'ETH') {
            if (selectedAsset.unit === 'USDC') {
                return getTokenAddress('USDC', SupportedChain.ETHEREUM_SEPOLIA);
            }
        }
        return selectedAsset.address; // Fallback to original address
    }, [selectedAsset]);

    // For validation, we need to use the UniversalLendingProtocol on ZetaChain to check debt
    // but the user's wallet balance will be checked on the foreign chain
    const { universalLendingProtocol: zetaLendingProtocol, priceOracle } = useContracts(SupportedChain.ZETA_TESTNET);

    // Validation hook
    const validation = useRepayValidation({
        selectedAsset,
        amount,
        universalLendingProtocol: safeEVMAddressOrZeroAddress(zetaLendingProtocol),
        priceOracle: safeEVMAddressOrZeroAddress(priceOracle),
        userAddress: safeAddress,
        isLocal: false,
    });

    // Computed values
    const amountBigInt = amount && selectedAsset ? parseUnits(amount, selectedAsset.decimals) : BigInt(0);

    // Destructure transaction flow state
    const { state: txState, actions: txActions, contractState } = transactionFlow;

    // Handle network switching
    const handleSwitchNetwork = useCallback(async () => {
        if (!targetChainId || !switchChain) return;

        try {
            txActions.setCurrentStep('switchNetwork');
            void switchChain({ chainId: targetChainId });
        } catch (error) {
            console.error('Error switching network:', error);
            txActions.setCurrentStep('input');
            txActions.setIsSubmitting(false);
        }
    }, [targetChainId, switchChain, txActions]);

    // Handle approval for ERC20 token
    const handleApproveToken = useCallback(() => {
        if (!selectedAsset || !depositContract || !amountBigInt) return;

        const tokenAddress = getForeignChainTokenAddress();
        if (!tokenAddress) return;

        txActions.setCurrentStep('approve');
        txActions.writeContract({
            address: tokenAddress,
            abi: erc20Abi,
            functionName: 'approve',
            args: [safeEVMAddressOrZeroAddress(depositContract), amountBigInt],
        });
    }, [selectedAsset, depositContract, amountBigInt, txActions, getForeignChainTokenAddress]);

    // Handle repay function
    const handleRepay = useCallback(async () => {
        if (!address || !selectedAsset || !amountBigInt || !depositContract) return;

        try {
            txActions.setCurrentStep('repay');

            // Check if this is a native token (ETH)
            const isNativeToken = selectedAsset.unit === 'ETH';

            if (isNativeToken) {
                // For native ETH, call repayEth
                txActions.writeContract({
                    address: safeEVMAddress(depositContract),
                    abi: depositContractAbi,
                    functionName: 'repayEth',
                    args: [address],
                    value: amountBigInt,
                });
            } else {
                // For ERC20 tokens, call repayToken with the foreign chain token address
                const tokenAddress = getForeignChainTokenAddress();
                if (!tokenAddress) {
                    throw new Error('Unable to determine token address for repayment');
                }

                txActions.writeContract({
                    address: safeEVMAddress(depositContract),
                    abi: depositContractAbi,
                    functionName: 'repayToken',
                    args: [
                        tokenAddress,
                        amountBigInt,
                        address,
                    ],
                });
            }
        } catch (error) {
            console.error('Error repaying', error);
            txActions.setIsSubmitting(false);
            txActions.setCurrentStep('input');
        }
    }, [address, selectedAsset, amountBigInt, depositContract, txActions, getForeignChainTokenAddress]);

    // Main submit handler
    const handleSubmit = useCallback(async () => {
        if (!amount || !selectedAsset || !amountBigInt || !depositContract) return;

        // Check for invalid chain first
        if (hasInvalidChain) {
            console.error('Cannot submit: Invalid chain ID', targetChainId);
            return;
        }

        txActions.setIsSubmitting(true);
        txActions.resetContract();

        try {
            // First check if user is on the correct network
            if (!isOnCorrectNetwork) {
                await handleSwitchNetwork();
                return; // Exit here, the network switch will trigger a re-render
            }

            // Check if this is a native token (ETH)
            const isNativeToken = selectedAsset.unit === 'ETH';

            if (isNativeToken) {
                // For native ETH, call repayEth directly
                txActions.setCurrentStep('repay');
                handleRepay();
            } else {
                // For ERC20 tokens, start with approval
                txActions.setCurrentStep('approve');
                handleApproveToken();
            }
        } catch (error) {
            console.error('Error repaying', error);
            txActions.setIsSubmitting(false);
            txActions.setCurrentStep('input');
        }
    }, [amount, selectedAsset, amountBigInt, depositContract, hasInvalidChain, targetChainId, txActions, isOnCorrectNetwork, handleSwitchNetwork, handleApproveToken, handleRepay]);

    // Handle max click
    const handleMaxClick = useCallback(() => {
        setAmount(validation.maxRepayAmount);
    }, [validation.maxRepayAmount]);

    // Handle close  
    const handleClose = useCallback(() => {
        setAmount('');
        txActions.reset();
        crossChain.reset();
        onClose();
    }, [onClose, txActions, crossChain]);

    // Get step text
    const getStepText = useCallback(() => {
        switch (txState.currentStep) {
            case 'switchNetwork':
                return `Switch to ${targetNetworkConfig.name} to repay`;
            case 'approve':
                return 'Click to approve token spending';
            case 'approving':
                return 'Waiting for approval confirmation...';
            case 'repay':
                return 'Sign transaction to repay debt';
            case 'repaying':
                return 'Waiting for repay confirmation...';
            case 'success':
                if (crossChain.status === 'pending') {
                    return 'Processing cross-chain repayment...';
                } else if (crossChain.status === 'success') {
                    return 'Cross-chain repayment completed!';
                } else if (crossChain.status === 'failed') {
                    return 'Cross-chain repayment failed';
                } else {
                    return 'Repay transaction confirmed!';
                }
            default:
                if (!isOnCorrectNetwork && targetNetworkConfig) {
                    return `Switch to ${targetNetworkConfig.name} to repay ${selectedAsset.unit}`;
                }
                return `Enter amount to repay ${selectedAsset.unit}`;
        }
    }, [txState.currentStep, selectedAsset.unit, crossChain.status, isOnCorrectNetwork, targetNetworkConfig]);

    // Handle amount change
    const handleAmountChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setAmount(e.target.value);
    }, []);

    // Handle approval transaction success -> proceed to repay
    useEffect(() => {
        if (contractState.isApprovalSuccess && txState.currentStep === 'approving') {
            txActions.setCurrentStep('repay');
            void handleRepay();
        }
    }, [contractState.isApprovalSuccess, txState.currentStep, handleRepay, txActions]);

    // Handle repay transaction success -> show success and start cross-chain tracking
    useEffect(() => {
        if (contractState.isTransactionSuccess && txState.currentStep === 'repaying' && txState.transactionHash) {
            txActions.setCurrentStep('success');
            txActions.setIsSubmitting(false);
            crossChain.startTracking(txState.transactionHash);
        }
    }, [contractState.isTransactionSuccess, txState.currentStep, txState.transactionHash, crossChain, txActions]);

    // Handle repay transaction failure
    useEffect(() => {
        if (contractState.isTransactionError && txState.currentStep === 'repaying') {
            txActions.setCurrentStep('input');
            txActions.setIsSubmitting(false);
        }
    }, [contractState.isTransactionError, txState.currentStep, txActions]);

    // Handle successful network switch
    useEffect(() => {
        if (txState.currentStep === 'switchNetwork' && isOnCorrectNetwork) {
            // Network switch successful, proceed with the transaction
            txActions.setCurrentStep('input');
            txActions.setIsSubmitting(false);

            // Auto-proceed with the transaction after network switch
            setTimeout(() => {
                if (amount && selectedAsset && amountBigInt && depositContract) {
                    txActions.setIsSubmitting(true);
                    const isNativeToken = selectedAsset.unit === 'ETH';
                    if (isNativeToken) {
                        txActions.setCurrentStep('repay');
                        void handleRepay();
                    } else {
                        txActions.setCurrentStep('approve');
                        handleApproveToken();
                    }
                }
            }, 500); // Small delay to ensure network switch is complete
        }
    }, [txState.currentStep, isOnCorrectNetwork, amount, selectedAsset, amountBigInt, depositContract, txActions, handleRepay, handleApproveToken]);

    // Early return after all hooks
    if (!selectedAsset) return null;

    return (
        <BaseTransactionDialog
            isOpen={isOpen}
            onClose={handleClose}
            title={`Repay ${selectedAsset.unit}`}
            description={hasInvalidChain ? `Unsupported chain (ID: ${targetChainId}). Please select an asset from a supported chain.` : getStepText()}
            tokenSymbol={selectedAsset.unit}
            sourceChain={selectedAsset.sourceChain}
            currentStep={txState.currentStep}
            isSubmitting={txState.isSubmitting}
            onSubmit={() => { void handleSubmit() }}
            isValidAmount={validation.isValid && !hasInvalidChain}
            isConnected={Boolean(address)}
            submitButtonText={!isOnCorrectNetwork ? `Switch to ${targetNetworkConfig?.name || 'Network'}` : "Repay"}
        >
            {txState.currentStep === 'input' && (
                <div className="space-y-4 w-full overflow-hidden">
                    {/* Network Warning */}
                    {!isOnCorrectNetwork && targetNetworkConfig && (
                        <div className="p-3 border border-yellow-200 dark:border-yellow-800 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 text-sm">
                            <div className="text-yellow-800 dark:text-yellow-200 font-medium">
                                Network Switch Required
                            </div>
                            <div className="text-yellow-700 dark:text-yellow-300 mt-1">
                                You need to switch to {targetNetworkConfig.name} to repay {selectedAsset.unit}.
                                Click "Repay" to switch networks automatically.
                            </div>
                        </div>
                    )}

                    {/* Invalid Chain Error */}
                    {hasInvalidChain && (
                        <div className="p-3 border border-destructive/50 rounded-lg bg-destructive/10 text-sm">
                            <div className="text-destructive font-medium">
                                Unsupported Chain
                            </div>
                            <div className="text-destructive/80 mt-1">
                                The selected asset is from an unsupported chain (ID: {targetChainId}).
                                Please select an asset from a supported chain (Arbitrum Sepolia, Ethereum Sepolia, or ZetaChain).
                            </div>
                        </div>
                    )}

                    {/* Amount Input */}
                    <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                            <span>Amount</span>
                            <span>Max Repay: {Number(validation.maxRepayAmount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })}</span>
                        </div>
                        <div className="relative">
                            <Input
                                type="number"
                                value={amount}
                                onChange={handleAmountChange}
                                placeholder="0.00"
                                step="any"
                                min="0"
                                max={validation.maxRepayAmount}
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

                    {/* Debt Information */}
                    <div className="p-3 bg-muted rounded-lg text-sm">
                        <div className="flex justify-between">
                            <span>Current Debt:</span>
                            <span className="font-medium">{validation.formattedCurrentDebt} {selectedAsset.unit}</span>
                        </div>
                        <div className="flex justify-between mt-1">
                            <span>Available Balance:</span>
                            <span className="font-medium">{validation.formattedAvailableBalance} {selectedAsset.unit}</span>
                        </div>
                        <div className="flex justify-between mt-1">
                            <span>Repaying from:</span>
                            <span className="font-medium text-xs">{formatHexString(safeAddress || '')}</span>
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
                                {amount && validation.newHealthFactor > 0 && (
                                    <div className="flex justify-between">
                                        <span>After repay:</span>
                                        <span className={`font-medium ${getHealthFactorColorClass(validation.newHealthFactor)}`}>
                                            {formatHealthFactor(validation.newHealthFactor)}
                                        </span>
                                    </div>
                                )}
                            </div>
                            {amount && validation.newHealthFactor > validation.currentHealthFactor && (
                                <div className="mt-2 text-xs text-green-600 dark:text-green-400">
                                    ↗ Health factor will improve{validation.newHealthFactor === Infinity || validation.currentHealthFactor === Infinity ? '' : ` by ${(validation.newHealthFactor - validation.currentHealthFactor).toFixed(2)}`}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Full Repayment Notice */}
                    {validation.isFullRepayment && (
                        <div className="p-3 border border-green-200 dark:border-green-800 rounded-lg bg-green-50 dark:bg-green-900/20 text-sm">
                            <div className="text-green-800 dark:text-green-200 font-medium">
                                Full Repayment
                            </div>
                            <div className="text-green-700 dark:text-green-300 mt-1">
                                This will fully repay your debt for {selectedAsset.unit}
                            </div>
                        </div>
                    )}

                    {/* Transaction Summary */}
                    {amount && (
                        <TransactionSummary
                            transactionType="repay"
                            amount={amount}
                            tokenSymbol={selectedAsset.unit}
                            className="border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/20"
                        />
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

                    {/* Contract Error Display */}
                    {contractState.error && (
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
                chainId={targetChainId}
                crossChain={crossChain}
                transactionType="repay"
            />
        </BaseTransactionDialog>
    );
}