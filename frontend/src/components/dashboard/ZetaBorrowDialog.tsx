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
import { useBorrowTransactionFlow } from '../../hooks/useTransactionFlow';
import { useBorrowValidation } from '../../hooks/useBorrowValidation';
import { SupportedChain } from '../../contracts/deployments';
import { safeEVMAddressOrZeroAddress, safeEVMAddress, type UserAssetData } from './types';
import { SimpleLendingProtocol__factory } from '@/contracts/typechain-types';
import { formatHexString } from '@/utils/formatHexString';
import { getHealthFactorColorClass, formatHealthFactor } from '../../utils/healthFactorUtils';

interface ZetaBorrowDialogProps {
  isOpen: boolean;
  onClose: () => void;
  selectedAsset: UserAssetData;
}

// Contract ABI
const lendingProtocolAbi = SimpleLendingProtocol__factory.abi;

export function ZetaBorrowDialog({ isOpen, onClose, selectedAsset }: ZetaBorrowDialogProps) {
  const [amount, setAmount] = useState('');

  // Custom hooks
  const crossChain = useCrossChainTracking();
  const transactionFlow = useBorrowTransactionFlow();
  const { address } = useAccount();
  const safeAddress = safeEVMAddressOrZeroAddress(address);
  const { simpleLendingProtocol } = useContracts(SupportedChain.ZETA_TESTNET);

  // Validation hook
  const validation = useBorrowValidation({
    selectedAsset,
    amountToBorrow: amount,
    simpleLendingProtocol: safeEVMAddressOrZeroAddress(simpleLendingProtocol),
    userAddress: safeAddress,
  });

  // Computed values
  const amountBigInt = amount && selectedAsset ? parseUnits(amount, selectedAsset.decimals) : BigInt(0);

  // Destructure transaction flow state
  const { state: txState, actions: txActions, contractState } = transactionFlow;


  // Handle borrow function
  const handleBorrow = useCallback(async () => {
    if (!address || !selectedAsset || !amountBigInt || !simpleLendingProtocol) return;

    try {
      txActions.setCurrentStep('borrow');
      txActions.writeContract({
        address: safeEVMAddress(simpleLendingProtocol),
        abi: lendingProtocolAbi,
        functionName: 'borrow',
        args: [
          selectedAsset.address,
          amountBigInt, 
          address,
        ],
      });
    } catch (error) {
      console.error('Borrow failed:', error);
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
      // For local borrowing on Zeta, proceed directly to borrow (no approval needed usually)
      await handleBorrow();
    } catch (error) {
      console.error('Error borrowing', error);
      txActions.setIsSubmitting(false);
      txActions.setCurrentStep('input');
    }
  }, [amount, selectedAsset, amountBigInt, simpleLendingProtocol, txActions, handleBorrow]);

  // Handle max click
  const handleMaxClick = useCallback(() => {
    setAmount(validation.maxBorrowAmount);
  }, [validation.maxBorrowAmount]);

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
      case 'borrow':
        return 'Sign transaction to borrow from protocol';
      case 'borrowing':
        return 'Waiting for borrow confirmation...';
      case 'success':
        return 'Local borrow transaction confirmed!';
      case 'failed':
        return 'Borrow transaction failed';
      default:
        return `Enter amount to borrow locally on Zeta`;
    }
  }, [txState.currentStep]);

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
    if (contractState.isTransactionSuccess && txState.currentStep === 'borrowing') {
      txActions.setCurrentStep('success');
      txActions.setIsSubmitting(false);
    }
  }, [contractState.isTransactionSuccess, txState.currentStep, txActions]);

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


  // Early return after all hooks
  if (!selectedAsset || !simpleLendingProtocol) return null;

  return (
    <BaseTransactionDialog
      isOpen={isOpen}
      onClose={handleClose}
      title={`Zeta Borrow ${selectedAsset.unit}`}
      description={getStepText()}
      tokenSymbol={selectedAsset.unit}
      sourceChain="ZetaChain"
      currentStep={txState.currentStep}
      isSubmitting={txState.isSubmitting}
      onSubmit={() => { void handleSubmit() }}
      onRetry={handleRetry}
      isValidAmount={validation.isValid}
      isConnected={Boolean(address)}
      submitButtonText="Borrow on Zeta"
    >
      {(txState.currentStep === 'input' || txState.currentStep === 'failed') && (
        <div className="space-y-4 w-full overflow-hidden">
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

          {/* Borrow Info */}
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
              <span className="font-medium">Local Borrow</span>
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