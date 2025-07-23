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
import { useRepayTransactionFlow } from '../../hooks/useTransactionFlow';
import { useRepayValidation } from '../../hooks/useRepayValidation';
import { SupportedChain } from '../../contracts/deployments';
import { safeEVMAddressOrZeroAddress, type UserAssetData } from './types';
import { ERC20__factory, SimpleLendingProtocol__factory } from '@/contracts/typechain-types';
import { formatHexString } from '@/utils/formatHexString';

interface RepayDialogProps {
    isOpen: boolean;
    onClose: () => void;
    selectedAsset: UserAssetData;
}

// Contract ABIs
const lendingProtocolAbi = SimpleLendingProtocol__factory.abi;
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
    const safeAddress = safeEVMAddressOrZeroAddress(address);
    const { simpleLendingProtocol } = useContracts(SupportedChain.ZETA_TESTNET);

    // Validation hook
    const validation = useRepayValidation({
        selectedAsset,
        amount,
        simpleLendingProtocol: safeEVMAddressOrZeroAddress(simpleLendingProtocol),
        userAddress: safeAddress,
    });

    // Computed values
    const amountBigInt = amount && selectedAsset ? parseUnits(amount, selectedAsset.decimals) : BigInt(0);

    // Destructure transaction flow state
    const { state: txState, actions: txActions, contractState } = transactionFlow;

    // Handle approval for ZRC-20 token
    const handleApproveToken = useCallback(() => {
        if (!selectedAsset || !simpleLendingProtocol || !amountBigInt) return;

        txActions.setCurrentStep('approving');
        txActions.writeContract({
            address: selectedAsset.address,
            abi: erc20Abi,
            functionName: 'approve',
            args: [safeEVMAddressOrZeroAddress(simpleLendingProtocol), amountBigInt],
        });
    }, [selectedAsset, simpleLendingProtocol, amountBigInt, txActions]);

    // Handle repay function
    const handleRepay = useCallback(async () => {
        if (!address || !selectedAsset || !amountBigInt || !simpleLendingProtocol) return;

        try {
            txActions.setCurrentStep('repay');
            txActions.writeContract({
                address: safeEVMAddressOrZeroAddress(simpleLendingProtocol),
                abi: lendingProtocolAbi,
                functionName: 'repay',
                args: [
                    selectedAsset.address,
                    amountBigInt,
                    address,
                ],
            });
        } catch (error) {
            console.error('Error repaying', error);
            txActions.setIsSubmitting(false);
            txActions.setCurrentStep('input');
        }
    }, [address, selectedAsset, amountBigInt, simpleLendingProtocol, txActions]);

    // Main submit handler
    const handleSubmit = useCallback(async () => {
        if (!amount || !selectedAsset || !amountBigInt || !simpleLendingProtocol) return;

        txActions.setIsSubmitting(true);
        txActions.resetContract();

        try {
            // Start with token approval
            txActions.setCurrentStep('approve');
            handleApproveToken();
        } catch (error) {
            console.error('Error repaying', error);
            txActions.setIsSubmitting(false);
            txActions.setCurrentStep('input');
        }
    }, [amount, selectedAsset, amountBigInt, simpleLendingProtocol, txActions, handleApproveToken]);

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
            case 'approve':
                return 'Click to approve token spending';
            case 'approving':
                return 'Waiting for approval confirmation...';
            case 'repay':
                return 'Sign transaction to repay debt';
            case 'repaying':
                return 'Waiting for repay confirmation...';
            case 'success':
                return 'Repay transaction confirmed!';
            default:
                return `Enter amount to repay ${selectedAsset.unit}`;
        }
    }, [txState.currentStep, selectedAsset.unit]);

    // Handle amount change
    const handleAmountChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setAmount(e.target.value);
    }, []);

    // Handle approval transaction success -> proceed to repay
    useEffect(() => {
        if (contractState.isApprovalSuccess && txState.currentStep === 'approving') {
            txActions.setCurrentStep('repay');
            handleRepay();
        }
    }, [contractState.isApprovalSuccess, txState.currentStep, handleRepay, txActions]);

    // Handle repay transaction success
    useEffect(() => {
        if (contractState.isTransactionSuccess && txState.currentStep === 'repaying' && txState.transactionHash) {
            txActions.setCurrentStep('success');
            txActions.setIsSubmitting(false);
        }
    }, [contractState.isTransactionSuccess, txState.currentStep, txState.transactionHash, txActions]);

    // Handle repay transaction failure
    useEffect(() => {
        if (contractState.isTransactionError && txState.currentStep === 'repaying') {
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
            title={`Repay ${selectedAsset.unit}`}
            description={getStepText()}
            tokenSymbol={selectedAsset.unit}
            sourceChain={selectedAsset.sourceChain}
            currentStep={txState.currentStep}
            isSubmitting={txState.isSubmitting}
            onSubmit={() => { void handleSubmit() }}
            isValidAmount={validation.isValid}
            isConnected={Boolean(address)}
            submitButtonText="Repay"
        >
            {txState.currentStep === 'input' && (
                <div className="space-y-4 w-full overflow-hidden">
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
                chainId={SupportedChain.ZETA_TESTNET}
                crossChain={crossChain}
                transactionType="repay"
            />
        </BaseTransactionDialog>
    );
}