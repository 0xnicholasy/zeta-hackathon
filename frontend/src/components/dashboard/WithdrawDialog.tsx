import { useState, useEffect, useCallback } from 'react';
import { useAccount, } from 'wagmi';
import { parseUnits } from 'viem';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { BaseTransactionDialog } from '../ui/base-transaction-dialog';
import { TransactionStatus } from '../ui/transaction-status';
import { TransactionSummary } from '../ui/transaction-summary';
import { useCrossChainTracking } from '../../hooks/useCrossChainTracking';
import { useContracts } from '../../hooks/useContracts';
import { useTransactionFlow } from '../../hooks/useTransactionFlow';
import { useWithdrawValidation } from '../../hooks/useWithdrawValidation';
import { SupportedChain } from '../../contracts/deployments';
import { getChainDisplayName, getGasTokenSymbol, getGasTokenDecimals } from '../../utils/chainUtils';
import { safeEVMAddressOrZeroAddress } from '@/types/address';
import { type UserAssetData } from './types';
import { ERC20__factory, UniversalLendingProtocol__factory } from '@/contracts/typechain-types';
import { utils } from 'ethers';
import { isAddress } from 'viem';
import { isValidSolanaAddress } from '../../lib/solana-utils';
import { FaClipboard } from 'react-icons/fa';


interface WithdrawDialogProps {
    isOpen: boolean;
    onClose: () => void;
    selectedAsset: UserAssetData;
    refetchUserData?: () => Promise<void>;
}

// Contract ABIs
const lendingProtocolAbi = UniversalLendingProtocol__factory.abi;
const erc20Abi = ERC20__factory.abi;

export function WithdrawDialog({ isOpen, onClose, selectedAsset }: WithdrawDialogProps) {
    const { address } = useAccount();
    const [amount, setAmount] = useState('');
    const isDestinationSolana = selectedAsset.sourceChain === 'SOL';
    const [recipientAddress, setRecipientAddress] = useState<string>(address ?? "");

    // Custom hooks
    const crossChain = useCrossChainTracking();
    const transactionFlow = useTransactionFlow();
    const safeAddress = safeEVMAddressOrZeroAddress(address);
    const { universalLendingProtocol } = useContracts(SupportedChain.ZETA_TESTNET);

    // Validation hook
    const validation = useWithdrawValidation({
        selectedAsset,
        amount,
        universalLendingProtocol: safeEVMAddressOrZeroAddress(universalLendingProtocol),
        userAddress: safeAddress,
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
    const maxAmount = selectedAsset?.formattedSuppliedBalance || '0';
    const destinationChainName = selectedAsset ? getChainDisplayName(selectedAsset.sourceChain) : 'Unknown';
    const amountBigInt = amount && selectedAsset ? parseUnits(amount, selectedAsset.decimals) : BigInt(0);
    const isValidAmount = amount && parseFloat(amount) > 0 && parseFloat(amount) <= parseFloat(maxAmount);
    const isValidRecipient = isValidRecipientAddress();

    // Check if selected asset is a gas token based on validation results
    const isGasToken = validation.gasTokenInfo.address && selectedAsset &&
        validation.gasTokenInfo.address.toLowerCase() === selectedAsset.address.toLowerCase();

    // Calculate gas fee amount for display
    const gasFeeAmount = isGasToken && amount && validation.formattedReceiveAmount ?
        parseFloat(amount) - parseFloat(validation.formattedReceiveAmount) : 0;

    // Get gas token info for display
    const gasTokenSymbol = selectedAsset?.sourceChain ? getGasTokenSymbol(selectedAsset.sourceChain) : '';
    const gasTokenDecimals = selectedAsset?.sourceChain ? getGasTokenDecimals(selectedAsset.sourceChain) : 18;

    // Destructure transaction flow state
    const { state: txState, actions: txActions, contractState } = transactionFlow;


    // Handle token approval (withdrawal token or gas token)
    const handleApproveToken = useCallback(() => {
        if (!validation.gasTokenInfo.needsApproval || !universalLendingProtocol) return;

        txActions.setCurrentStep('approving');
        txActions.writeContract({
            address: validation.gasTokenInfo.address,
            abi: erc20Abi,
            functionName: 'approve',
            args: [safeEVMAddressOrZeroAddress(universalLendingProtocol), validation.gasTokenInfo.amount],
        });
    }, [validation.gasTokenInfo, universalLendingProtocol, txActions]);

    // Handle max click
    const handleMaxClick = useCallback(() => {
        if (selectedAsset) {
            setAmount(selectedAsset.formattedSuppliedBalance);
        }
    }, [selectedAsset]);

    // Handle close
    const handleClose = useCallback(() => {
        setAmount('');
        setRecipientAddress(address ?? '');
        txActions.reset();
        crossChain.reset();
        onClose();
    }, [onClose, txActions, crossChain, address]);

    // Get step text
    const getStepText = useCallback(() => {
        switch (txState.currentStep) {
            case 'checkWithdraw':
                return 'Checking withdrawal eligibility...';
            case 'checkGas':
                return 'Checking gas token requirements...';
            case 'approve':
                return `Approve ${gasTokenSymbol || 'gas token'} spending for withdrawal fees`;
            case 'approving':
                return 'Waiting for token approval...';
            case 'withdraw':
                return 'Click to withdraw from protocol';
            case 'withdrawing':
                return 'Waiting for withdrawal confirmation...';
            case 'success':
                if (crossChain.status === 'pending') {
                    return 'Processing cross-chain withdrawal...';
                } else if (crossChain.status === 'success') {
                    return 'Cross-chain withdrawal completed!';
                } else if (crossChain.status === 'failed') {
                    return 'Cross-chain withdrawal failed';
                } else {
                    return 'Withdrawal transaction confirmed!';
                }
            default:
                return `Enter amount to withdraw to ${destinationChainName}`;
        }
    }, [txState.currentStep, gasTokenSymbol, crossChain.status, destinationChainName]);

    // Handle amount change
    const handleAmountChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setAmount(e.target.value);
    }, []);

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

    // Handle withdrawal function
    const handleWithdraw = useCallback(async () => {
        if (!amount || !selectedAsset || !amountBigInt || !universalLendingProtocol || !isValidRecipient) return;

        try {
            txActions.setCurrentStep('withdraw');

            // Convert recipient address to hex bytes for contract call
            let recipientBytes: `0x${string}`;
            if (isDestinationSolana) {
                // For Solana addresses, convert to UTF-8 bytes (as per withdraw-all-sol-crosschain.ts:172)
                recipientBytes = utils.hexlify(utils.toUtf8Bytes(recipientAddress)) as `0x${string}`;
            } else {
                // For EVM addresses, hexlify directly 
                recipientBytes = utils.hexlify(recipientAddress) as `0x${string}`;
            }

            txActions.writeContract({
                address: safeEVMAddressOrZeroAddress(universalLendingProtocol),
                abi: lendingProtocolAbi,
                functionName: 'withdrawCrossChain',
                args: [
                    selectedAsset.address,
                    amountBigInt,
                    BigInt(selectedAsset.externalChainId),
                    recipientBytes,
                ],
            });
        } catch (error) {
            console.error('Withdrawal failed:', error);
            txActions.setIsSubmitting(false);
            txActions.setCurrentStep('input');
        }
    }, [amount, selectedAsset, amountBigInt, universalLendingProtocol, isValidRecipient, txActions, isDestinationSolana, recipientAddress]);

    // Main submit handler
    const handleSubmit = useCallback(async () => {
        if (!amount || !selectedAsset || !amountBigInt || !universalLendingProtocol || !isValidRecipient) return;

        txActions.setIsSubmitting(true);
        txActions.resetContract();

        // Step 1: Check validation
        txActions.setCurrentStep('checkWithdraw');
        txActions.setCurrentStep('checkGas');

        // First check if approval is needed
        if (validation.needsApproval) {
            txActions.setCurrentStep('approve');
            txActions.setIsSubmitting(false);
            return;
        }

        // Then check if validation passes
        if (!validation.isValid) {
            txActions.setCurrentStep('input');
            txActions.setIsSubmitting(false);
            return;
        }

        // Step 2: Proceed with withdrawal
        void handleWithdraw();
    }, [amount, selectedAsset, amountBigInt, universalLendingProtocol, txActions, validation, handleWithdraw, isValidRecipient]);

    // Handle approve success -> proceed to withdrawal
    useEffect(() => {
        if (contractState.isApprovalSuccess && txState.currentStep === 'approving') {
            // Add a small delay to ensure the approval state is fully processed
            setTimeout(() => {
                void handleWithdraw();
            }, 100);
        }
    }, [contractState.isApprovalSuccess, txState.currentStep, handleWithdraw, txActions]);

    // Handle withdraw transaction success
    useEffect(() => {
        if (contractState.isTransactionSuccess && txState.currentStep === 'withdrawing' && txState.transactionHash) {
            txActions.setCurrentStep('success');
            txActions.setIsSubmitting(false);
            crossChain.startTracking(txState.transactionHash);
        }
    }, [contractState.isTransactionSuccess, txState.currentStep, txState.transactionHash, crossChain, txActions]);

    // Handle withdraw transaction failure
    useEffect(() => {
        if (contractState.isTransactionError && txState.currentStep === 'withdrawing') {
            txActions.setCurrentStep('input');
            txActions.setIsSubmitting(false);
        }
    }, [contractState.isTransactionError, txState.currentStep, txActions]);

    // Early return after all hooks
    if (!selectedAsset || !universalLendingProtocol) return null;

    return (
        <BaseTransactionDialog
            isOpen={isOpen}
            onClose={handleClose}
            title={`Withdraw ${selectedAsset.unit}`}
            description={getStepText()}
            tokenSymbol={selectedAsset.unit}
            sourceChain={selectedAsset.sourceChain}
            currentStep={txState.currentStep}
            isSubmitting={txState.isSubmitting}
            onSubmit={() => {
                if (txState.currentStep === 'withdraw') {
                    void handleWithdraw();
                } else {
                    void handleSubmit();
                }
            }}
            onApprove={handleApproveToken}
            isValidAmount={Boolean(isValidAmount && validation.isValid && isValidRecipient)}
            isConnected={Boolean(address)}
            submitButtonText="Withdraw"
            approveButtonText={`Approve ${gasTokenSymbol || 'Gas Token'}`}
            canApprove={validation.gasTokenInfo.needsApproval}
        >
            {txState.currentStep === 'input' && (
                <div className="space-y-4 w-full overflow-hidden">
                    {/* Amount Input */}
                    <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                            <span>Amount</span>
                            <span>Supplied: {Number(maxAmount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })}</span>
                        </div>
                        <div className="relative">
                            <Input
                                type="number"
                                value={amount}
                                onChange={handleAmountChange}
                                placeholder="0.00"
                                step="any"
                                min="0"
                                max={maxAmount}
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

                    {/* Withdrawal Destination Info */}
                    <div className="p-3 bg-muted rounded-lg text-sm">
                        <div className="flex justify-between">
                            <span>Withdrawing to chain:</span>
                            <span className="font-medium">{destinationChainName}</span>
                        </div>
                        <div className="flex justify-between mt-1">
                            <span>Asset:</span>
                            <span className="font-medium">{selectedAsset.unit}</span>
                        </div>
                        <div className="flex justify-between mt-1">
                            <span>Recipient:</span>
                            <span className="font-medium text-xs">
                                {isDestinationSolana
                                    ? (recipientAddress ? `${recipientAddress.slice(0, 4)}...${recipientAddress.slice(-4)}` : 'Not set')
                                    : recipientAddress
                                }
                            </span>
                        </div>
                    </div>

                    {/* Gas Fee Information */}
                    {amount && parseFloat(amount) > 0 && (
                        <div className="p-3 border border-border rounded-lg bg-muted/50 text-sm">
                            <div className="text-foreground font-medium mb-2">
                                {isGasToken ? 'Transaction Details' : 'Gas Fee Requirements'}
                            </div>
                            <div className="space-y-2">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Withdrawal Amount:</span>
                                    <span className="font-medium">{amount} {selectedAsset.unit}</span>
                                </div>
                                {isGasToken ? (
                                    <>
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Gas Fee:</span>
                                            <span className="font-medium text-orange-600">
                                                -{gasFeeAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })} {selectedAsset.unit}
                                            </span>
                                        </div>
                                        <div className="border-t border-border pt-2">
                                            <div className="flex justify-between">
                                                <span className="text-foreground font-medium">You'll Receive:</span>
                                                <span className="font-semibold text-green-600">
                                                    {Number(validation.formattedReceiveAmount || '0').toLocaleString('en-US', {
                                                        minimumFractionDigits: 2,
                                                        maximumFractionDigits: 6
                                                    })} {selectedAsset.unit}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="text-xs text-muted-foreground mt-1">
                                            Gas fee is paid from your withdrawal amount
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Required Gas Token:</span>
                                            <span className="font-medium text-orange-600">
                                                {validation.gasTokenInfo.amount > 0 ?
                                                    (Number(validation.gasTokenInfo.amount) / Math.pow(10, gasTokenDecimals)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 }) : '0'
                                                } {gasTokenSymbol}
                                            </span>
                                        </div>
                                        <div className="border-t border-border pt-2">
                                            <div className="flex justify-between">
                                                <span className="text-foreground font-medium">You'll Receive:</span>
                                                <span className="font-semibold text-green-600">
                                                    {amount} {selectedAsset.unit}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="text-xs text-muted-foreground mt-1">
                                            Gas fee is paid separately from your gas token balance
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Transaction Summary */}
                    {amount && (
                        <TransactionSummary
                            transactionType="withdraw"
                            amount={amount}
                            tokenSymbol={selectedAsset.unit}
                            destinationChain={destinationChainName}
                            recipientAddress={recipientAddress || ''}
                            isGasToken={Boolean(isGasToken)}
                            formattedReceiveAmount={isGasToken ? validation.formattedReceiveAmount : amount}
                            className="bg-secondary/50"
                        />
                    )}

                    {/* Validation Error Display */}
                    {validation.error && validation.error.length > 0 && Boolean(amount) && (
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
                chainId={SupportedChain.ZETA_TESTNET}
                crossChain={crossChain}
                gasTokenInfo={validation.gasTokenInfo.needsApproval ? validation.gasTokenInfo : null}
                transactionType="withdraw"
            />
        </BaseTransactionDialog>
    );
} 