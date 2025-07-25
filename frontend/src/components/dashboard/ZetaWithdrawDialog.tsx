import { useState, useCallback, useEffect } from 'react';
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
import { SupportedChain } from '../../contracts/deployments';
import { safeEVMAddress, safeEVMAddressOrZeroAddress, type UserAssetData } from './types';
import { UniversalLendingProtocol__factory } from '@/contracts/typechain-types';
import { formatHexString } from '@/utils/formatHexString';

interface ZetaWithdrawDialogProps {
  isOpen: boolean;
  onClose: () => void;
  selectedAsset: UserAssetData;
}

// Contract ABI
const lendingProtocolAbi = UniversalLendingProtocol__factory.abi;

export function ZetaWithdrawDialog({ isOpen, onClose, selectedAsset }: ZetaWithdrawDialogProps) {
  const [amount, setAmount] = useState('');

  // Custom hooks
  const crossChain = useCrossChainTracking();
  const transactionFlow = useTransactionFlow();
  const { address } = useAccount();
  const safeAddress = safeEVMAddressOrZeroAddress(address);
  const { universalLendingProtocol } = useContracts(SupportedChain.ZETA_TESTNET);

  // Computed values
  const maxAmount = selectedAsset?.formattedSuppliedBalance || '0';
  const amountBigInt = amount && selectedAsset ? parseUnits(amount, selectedAsset.decimals) : BigInt(0);
  const isValidAmount = amount && parseFloat(amount) > 0 && parseFloat(amount) <= parseFloat(maxAmount);

  // Destructure transaction flow state
  const { state: txState, actions: txActions, contractState } = transactionFlow;

  // Handle withdraw function
  const handleWithdraw = useCallback(async () => {
    if (!address || !selectedAsset || !amountBigInt || !universalLendingProtocol) return;

    try {
      txActions.setCurrentStep('withdraw');
      txActions.writeContract({
        address: safeEVMAddress(universalLendingProtocol),
        abi: lendingProtocolAbi,
        functionName: 'withdraw',
        args: [
          selectedAsset.address,
          amountBigInt,
          address,
        ],
      });
    } catch (error) {
      console.error('Withdraw failed:', error);
      txActions.setIsSubmitting(false);
      txActions.setCurrentStep('input');
    }
  }, [address, selectedAsset, amountBigInt, universalLendingProtocol, txActions]);

  // Main submit handler
  const handleSubmit = useCallback(async () => {
    if (!amount || !selectedAsset || !amountBigInt || !universalLendingProtocol) return;

    txActions.setIsSubmitting(true);
    txActions.resetContract();

    // Proceed directly with withdrawal (no approval needed for withdrawing)
    await handleWithdraw();
  }, [amount, selectedAsset, amountBigInt, universalLendingProtocol, txActions, handleWithdraw]);

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
      case 'withdraw':
        return 'Sign transaction to withdraw from protocol';
      case 'withdrawing':
        return 'Waiting for withdrawal confirmation...';
      case 'success':
        return 'Local withdrawal transaction confirmed!';
      default:
        return 'Enter amount to withdraw locally on Zeta';
    }
  }, [txState.currentStep]);

  // Handle amount change
  const handleAmountChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setAmount(e.target.value);
  }, []);

  // Handle withdraw transaction success
  useEffect(() => {
    if (contractState.isTransactionSuccess && txState.currentStep === 'withdrawing') {
      txActions.setCurrentStep('success');
      txActions.setIsSubmitting(false);
    }
  }, [contractState.isTransactionSuccess, txState.currentStep, txActions]);

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
      title={`Zeta Withdraw ${selectedAsset.unit}`}
      description={getStepText()}
      tokenSymbol={selectedAsset.unit}
      sourceChain="ZetaChain"
      currentStep={txState.currentStep}
      isSubmitting={txState.isSubmitting}
      onSubmit={() => { void handleSubmit() }}
      isValidAmount={Boolean(isValidAmount)}
      isConnected={Boolean(address)}
      submitButtonText="Withdraw on Zeta"
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

          {/* Withdrawal Info */}
          <div className="p-3 bg-muted rounded-lg text-sm">
            <div className="flex justify-between">
              <span>Network:</span>
              <span className="font-medium">ZetaChain (Local)</span>
            </div>
            <div className="flex justify-between mt-1">
              <span>Asset:</span>
              <span className="font-medium">{selectedAsset.unit}</span>
            </div>
            <div className="flex justify-between mt-1">
              <span>Recipient:</span>
              <span className="font-medium text-xs">{formatHexString(safeAddress || '')}</span>
            </div>
            <div className="flex justify-between mt-1 text-blue-600 dark:text-blue-400">
              <span>Type:</span>
              <span className="font-medium">Local Withdraw</span>
            </div>
          </div>

          {/* Transaction Summary */}
          {amount && (
            <TransactionSummary
              transactionType="withdraw"
              amount={amount}
              tokenSymbol={selectedAsset.unit}
              recipientAddress={safeAddress || ''}
              className="bg-secondary/50"
            />
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
        transactionType="withdraw"
      />
    </BaseTransactionDialog>
  );
}