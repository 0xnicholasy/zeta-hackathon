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
import { type SupportedChainId } from '../../contracts/deployments';
import type { TokenBalance } from '../../hooks/useMultiChainBalances';
import { safeEVMAddress, safeEVMAddressOrZeroAddress } from './types';
import { DepositContract__factory, ERC20__factory } from '@/contracts/typechain-types';

interface SupplyDialogProps {
  isOpen: boolean;
  onClose: () => void;
  selectedToken: TokenBalance | null;
  chainId: SupportedChainId;
}

// Contract ABIs
const depositContractAbi = DepositContract__factory.abi;
const erc20Abi = ERC20__factory.abi;

export function SupplyDialog({ isOpen, onClose, selectedToken, chainId }: SupplyDialogProps) {
  const [amount, setAmount] = useState('');

  // Custom hooks
  const crossChain = useCrossChainTracking();
  const transactionFlow = useTransactionFlow();
  const { address } = useAccount();
  const { depositContract } = useContracts(chainId);
  
  // Destructure transaction flow state
  const { state: txState, actions: txActions, contractState } = transactionFlow;


  // Computed values
  const isNativeToken = selectedToken?.isNative ?? false;
  const maxAmount = selectedToken?.formattedBalance ?? '0';
  const amountBigInt = amount && selectedToken ? parseUnits(amount, selectedToken.decimals) : BigInt(0);
  const isValidAmount = amount && parseFloat(amount) > 0 && parseFloat(amount) <= parseFloat(maxAmount);

  // Handle deposit function
  const handleDeposit = useCallback(async () => {
    if (!address || !selectedToken || !amountBigInt || !depositContract) return;

    try {
      txActions.setCurrentStep('deposit');
      txActions.writeContract({
        address: safeEVMAddress(depositContract),
        abi: depositContractAbi,
        functionName: 'depositToken',
        args: [
          selectedToken.tokenAddress,
          amountBigInt,
          address,
        ],
      });
    } catch (error) {
      console.error('Deposit failed:', error);
      txActions.setIsSubmitting(false);
      txActions.setCurrentStep('input');
    }
  }, [address, selectedToken, amountBigInt, depositContract, txActions]);

  // Handle max click
  const handleMaxClick = useCallback(() => {
    if (selectedToken) {
      setAmount(selectedToken.formattedBalance);
    }
  }, [selectedToken]);

  // Handle submit
  const handleSubmit = useCallback(async () => {
    if (!address || !amount || !selectedToken || !amountBigInt || !depositContract) return;

    txActions.setIsSubmitting(true);
    txActions.resetContract();

    try {
      if (isNativeToken) {
        // For native ETH, call depositEth directly
        txActions.setCurrentStep('deposit');
        txActions.writeContract({
          address: safeEVMAddress(depositContract),
          abi: depositContractAbi,
          functionName: 'depositEth',
          args: [address],
          value: amountBigInt,
        });
      } else {
        // For ERC20 tokens, start with approval
        txActions.setCurrentStep('approve');
        txActions.writeContract({
          address: safeEVMAddress(selectedToken.tokenAddress),
          abi: erc20Abi,
          functionName: 'approve',
          args: [safeEVMAddressOrZeroAddress(depositContract), amountBigInt],
        });
      }
    } catch (error) {
      console.error('Transaction failed:', error);
      txActions.setIsSubmitting(false);
      txActions.setCurrentStep('input');
    }
  }, [address, amount, selectedToken, amountBigInt, isNativeToken, depositContract, txActions]);

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
      case 'deposit':
        return 'Click to deposit to protocol';
      case 'depositing':
        return 'Waiting for deposit confirmation...';
      case 'success':
        if (crossChain.status === 'pending') {
          return 'Processing cross-chain deposit...';
        } else if (crossChain.status === 'success') {
          return 'Cross-chain deposit completed!';
        } else if (crossChain.status === 'failed') {
          return 'Cross-chain deposit failed';
        } else {
          return 'Supply transaction confirmed!';
        }
      default:
        return 'Enter amount to supply';
    }
  }, [txState.currentStep, crossChain.status]);

  // Handle amount change
  const handleAmountChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setAmount(e.target.value);
  }, []);

  // Handle approval transaction success -> proceed to deposit
  useEffect(() => {
    if (contractState.isApprovalSuccess && txState.currentStep === 'approving') {
      txActions.setCurrentStep('deposit');
      handleDeposit();
    }
  }, [contractState.isApprovalSuccess, txState.currentStep, handleDeposit, txActions]);

  // Handle deposit transaction success -> show success and start cross-chain tracking
  useEffect(() => {
    if (contractState.isTransactionSuccess && txState.currentStep === 'depositing' && txState.transactionHash) {
      txActions.setCurrentStep('success');
      txActions.setIsSubmitting(false);
      crossChain.startTracking(txState.transactionHash);
    }
  }, [contractState.isTransactionSuccess, txState.currentStep, txState.transactionHash, crossChain, txActions]);

  // Early return AFTER all hooks have been called
  if (!selectedToken || !depositContract) return null;

  return (
    <BaseTransactionDialog
      isOpen={isOpen}
      onClose={handleClose}
      title={`Supply ${selectedToken.tokenSymbol}`}
      description={getStepText()}
      tokenSymbol={selectedToken.tokenSymbol}
      sourceChain={selectedToken.chainName}
      currentStep={txState.currentStep}
      isSubmitting={txState.isSubmitting}
      onSubmit={handleSubmit}
      isValidAmount={!!isValidAmount}
      isConnected={!!address}
      submitButtonText="Supply"
    >
      {txState.currentStep === 'input' && (
        <div className="space-y-4 w-full overflow-hidden">
          {/* Amount Input */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Amount</span>
              <span>Available: {Number(maxAmount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })}</span>
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

          {/* Network Info */}
          <div className="p-3 bg-muted rounded-lg text-sm">
            <div className="flex justify-between">
              <span>Network:</span>
              <span className="font-medium">{selectedToken.chainName}</span>
            </div>
            <div className="flex justify-between mt-1">
              <span>Asset:</span>
              <span className="font-medium">{selectedToken.tokenSymbol}</span>
            </div>
          </div>

          {/* Transaction Summary */}
          {amount && (
            <TransactionSummary
              transactionType="supply"
              amount={amount}
              tokenSymbol={selectedToken.tokenSymbol}
              className="border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20"
            />
          )}

          {/* Error Display */}
          {contractState.error && (
            <div className="p-3 border border-red-200 dark:border-red-800 rounded-lg bg-red-50 dark:bg-red-900/20 text-sm break-words max-w-full">
              <div className="text-red-800 dark:text-red-200 font-medium">
                Transaction Failed
              </div>
              <div className="text-red-700 dark:text-red-300 mt-1 break-words overflow-hidden text-wrap max-w-full">
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
        chainId={chainId}
        crossChain={crossChain}
        transactionType="supply"
      />
    </BaseTransactionDialog>
  );
}