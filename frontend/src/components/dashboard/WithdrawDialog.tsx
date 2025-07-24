import { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';
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
import { getChainDisplayName } from '../../utils/chainUtils';
import { safeEVMAddressOrZeroAddress, type UserAssetData } from './types';
import { ERC20__factory, SimpleLendingProtocol__factory } from '@/contracts/typechain-types';
import { formatHexString } from '@/utils/formatHexString';

interface WithdrawDialogProps {
    isOpen: boolean;
    onClose: () => void;
    selectedAsset: UserAssetData;
}

// Contract ABIs
const lendingProtocolAbi = SimpleLendingProtocol__factory.abi;
const erc20Abi = ERC20__factory.abi;

export function WithdrawDialog({ isOpen, onClose, selectedAsset }: WithdrawDialogProps) {
    const [amount, setAmount] = useState('');

    // Custom hooks
    const crossChain = useCrossChainTracking();
    const transactionFlow = useTransactionFlow();
    const { address } = useAccount();
    const safeAddress = safeEVMAddressOrZeroAddress(address);
    const { simpleLendingProtocol } = useContracts(SupportedChain.ZETA_TESTNET);

    // Validation hook
    const validation = useWithdrawValidation({
        selectedAsset,
        amount,
        simpleLendingProtocol: safeEVMAddressOrZeroAddress(simpleLendingProtocol),
        userAddress: safeAddress,
    });

    // Computed values
    const maxAmount = selectedAsset?.formattedSuppliedBalance || '0';
    const destinationChainName = selectedAsset ? getChainDisplayName(selectedAsset.sourceChain) : 'Unknown';
    const amountBigInt = amount && selectedAsset ? parseUnits(amount, selectedAsset.decimals) : BigInt(0);
    const isValidAmount = amount && parseFloat(amount) > 0 && parseFloat(amount) <= parseFloat(maxAmount);

    // Destructure transaction flow state
    const { state: txState, actions: txActions, contractState } = transactionFlow;


    // Handle gas token approval
    const handleApproveGasToken = useCallback(() => {
        if (!validation.gasTokenInfo.needsApproval || !simpleLendingProtocol) return;

        txActions.setCurrentStep('approving');
        txActions.writeContract({
            address: validation.gasTokenInfo.address,
            abi: erc20Abi,
            functionName: 'approve',
            args: [safeEVMAddressOrZeroAddress(simpleLendingProtocol), validation.gasTokenInfo.amount],
        });
    }, [validation.gasTokenInfo, simpleLendingProtocol, txActions]);

    // Main submit handler
    const handleSubmit = useCallback(async () => {
        if (!amount || !selectedAsset || !amountBigInt || !simpleLendingProtocol) return;

        txActions.setIsSubmitting(true);
        txActions.resetContract();

        // Step 1: Check validation
        txActions.setCurrentStep('checkWithdraw');
        txActions.setCurrentStep('checkGas');

        if (!validation.isValid) {
            if (validation.needsApproval) {
                txActions.setCurrentStep('approve');
            } else {
                txActions.setCurrentStep('input');
            }
            txActions.setIsSubmitting(false);
            return;
        }

        // Step 2: Proceed with withdrawal
        txActions.setCurrentStep('withdraw');
        txActions.writeContract({
            address: safeEVMAddressOrZeroAddress(simpleLendingProtocol),
            abi: lendingProtocolAbi,
            functionName: 'withdrawCrossChain',
            args: [
                selectedAsset.address,
                amountBigInt,
                BigInt(SupportedChain.ARBITRUM_SEPOLIA), // Using default for now
                safeAddress,
            ],
        });
    }, [amount, selectedAsset, amountBigInt, simpleLendingProtocol, txActions, validation, safeAddress]);

    // Handle max click
    const handleMaxClick = useCallback(() => {
        if (selectedAsset) {
            setAmount(selectedAsset.formattedSuppliedBalance);
        }
    }, [selectedAsset]);

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
            case 'checkWithdraw':
                return 'Checking withdrawal eligibility...';
            case 'checkGas':
                return 'Checking gas token requirements...';
            case 'approve':
                return 'Gas token approval required';
            case 'approving':
                return 'Waiting for gas token approval...';
            case 'withdraw':
                return 'Sign transaction to withdraw from protocol';
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
    }, [txState.currentStep, destinationChainName, crossChain.status]);

    // Handle amount change
    const handleAmountChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setAmount(e.target.value);
    }, []);

    // Handle approve success -> retry withdrawal
    useEffect(() => {
        if (contractState.isApprovalSuccess && txState.currentStep === 'approving') {
            setTimeout(() => {
                void handleSubmit();
            }, 2000);
        }
    }, [contractState.isApprovalSuccess, txState.currentStep, handleSubmit]);

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
    if (!selectedAsset || !simpleLendingProtocol) return null;

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
            onSubmit={() => { void handleSubmit() }}
            onApprove={handleApproveGasToken}
            isValidAmount={Boolean(isValidAmount && validation.isValid)}
            isConnected={Boolean(address)}
            submitButtonText="Withdraw"
            approveButtonText="Approve Gas Tokens"
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
                            <span className="font-medium text-xs">{formatHexString(safeAddress || '')}</span>
                        </div>
                    </div>

                    {/* Transaction Summary */}
                    {amount && (
                        <TransactionSummary
                            transactionType="withdraw"
                            amount={amount}
                            tokenSymbol={selectedAsset.unit}
                            destinationChain={destinationChainName}
                            recipientAddress={safeAddress || ''}
                            formattedReceiveAmount={validation.formattedReceiveAmount}
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