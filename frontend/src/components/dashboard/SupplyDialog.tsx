import { useCallback, useEffect, useRef } from 'react';
import { useAccount } from 'wagmi';
import { parseUnits } from 'viem';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { BaseTransactionDialog } from '../ui/base-transaction-dialog';
import { TransactionStatus } from '../ui/transaction-status';
import { TransactionSummary } from '../ui/transaction-summary';
import { useContracts } from '../../hooks/useContracts';
import { useSimpleTransactionDialog } from '../../hooks/useStandardizedTransactionDialog';
import { type SupportedChainId } from '../../contracts/deployments';
import type { TokenBalance } from '../../hooks/useMultiChainBalances';
import { safeEVMAddress, safeEVMAddressOrZeroAddress } from '@/types/address';
import { DepositContract__factory, ERC20__factory } from '@/contracts/typechain-types';
import { validateAmountInput } from '@/utils/inputValidation';
import { CategorizedErrorDisplay } from '../ui/categorized-error-display';
import { TransactionSimulationDisplay } from '../ui/transaction-simulation-display';
import { useAutoSimulation } from '@/hooks/useAutoSimulation';

interface SupplyDialogProps {
  isOpen: boolean;
  onClose: () => void;
  selectedToken: TokenBalance | null;
  chainId: SupportedChainId;
  refetchUserData?: () => Promise<void>;
}

// Contract ABIs
const depositContractAbi = DepositContract__factory.abi;
const erc20Abi = ERC20__factory.abi;


export function SupplyDialog({ isOpen, onClose, selectedToken, chainId }: SupplyDialogProps) {
  const { address } = useAccount();
  const { depositContract } = useContracts(chainId);

  // Use standardized dialog management with simulation
  const dialog = useSimpleTransactionDialog({
    transactionType: 'supply',
    onClose,
    resetOnClose: true,
    enableSimulation: true
  });

  const { state, stableCallbacks, transactionFlow, crossChain, computed } = dialog;
  const { state: txState, actions: txActions, contractState } = transactionFlow;


  // Computed values
  const isNativeToken = selectedToken?.isNative ?? false;
  const maxAmount = selectedToken?.formattedBalance ?? '0';
  const amountBigInt = state.amount && selectedToken && state.validation.isValid ?
    parseUnits(state.amount, selectedToken.decimals) : BigInt(0);

  // Comprehensive validation
  const validateCurrentAmount = useCallback(() => {
    if (!selectedToken || !state.amount) {
      stableCallbacks.clearValidation();
      return;
    }

    const validation = validateAmountInput(state.amount, {
      decimals: selectedToken.decimals,
      maxAmount: selectedToken.formattedBalance,
      minAmount: '0.000001', // Minimum meaningful amount
      tokenSymbol: selectedToken.tokenSymbol,
      allowZero: false
    });

    stableCallbacks.setValidation(validation);
  }, [selectedToken, state.amount, stableCallbacks]);

  // Validate on amount change
  useEffect(() => {
    validateCurrentAmount();
  }, [validateCurrentAmount]);

  // Auto-simulation when amount changes
  useAutoSimulation({
    amount: state.amount,
    assetAddress: selectedToken?.tokenAddress ?? '',
    decimals: selectedToken?.decimals ?? 18,
    enabled: Boolean(selectedToken && address && selectedToken.tokenAddress),
    runSimulation: stableCallbacks.runSimulation
  });

  const isValidAmount = computed.isValidForSubmission;

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
      stableCallbacks.setAmount(selectedToken.formattedBalance);
    }
  }, [selectedToken, stableCallbacks]);

  // Handle submit
  const handleSubmit = useCallback(async () => {
    if (!address || !state.amount || !selectedToken || !amountBigInt || !depositContract) return;

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
  }, [address, state.amount, selectedToken, amountBigInt, isNativeToken, depositContract, txActions]);

  // Use standardized close handler from the dialog hook
  const handleClose = stableCallbacks.closeDialog;

  // Wrapper for async submit function to match dialog interface
  const handleSubmitWrapper = useCallback(() => {
    void handleSubmit();
  }, [handleSubmit]);

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

  // Handle amount change - use standardized action
  const handleAmountChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    stableCallbacks.setAmount(e.target.value);
  }, [stableCallbacks]);

  // Handle retry after failure
  const handleRetry = useCallback(() => {
    txActions.resetContract();
    txActions.setCurrentStep('input');
    txActions.setIsSubmitting(false);
  }, [txActions]);

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
      onSubmit={handleSubmitWrapper}
      onRetry={handleRetry}
      isValidAmount={isValidAmount}
      isConnected={Boolean(address)}
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
                value={state.amount}
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

            {/* Validation Messages */}
            <div className="min-h-[1.25rem]">
              {state.validation.hasErrors && state.validation.errorMessage && (
                <div className="text-xs text-destructive flex items-center gap-1">
                  <span className="inline-block w-3 h-3 text-center">⚠</span>
                  {state.validation.errorMessage}
                </div>
              )}
              {state.validation.hasWarnings && state.validation.warningMessages && (
                <div className="space-y-1">
                  {state.validation.warningMessages.map((warning, index) => (
                    <div key={index} className="text-xs text-yellow-600 flex items-center gap-1">
                      <span className="inline-block w-3 h-3 text-center">⚠</span>
                      {warning}
                    </div>
                  ))}
                </div>
              )}
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

          {/* Transaction Simulation */}
          <TransactionSimulationDisplay
            simulation={state.simulation}
            currentAmount={state.amount}
            className="mb-4"
          />

          {/* Transaction Summary */}
          {state.amount && (
            <TransactionSummary
              transactionType="supply"
              amount={state.amount}
              tokenSymbol={selectedToken.tokenSymbol}
              className="border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20"
            />
          )}

          {/* Error Display */}
          {contractState.error && (
            <CategorizedErrorDisplay
              error={contractState.error}
              onRetry={handleRetry}
              showTechnicalDetails={process.env['NODE_ENV'] === 'development'}
              className="text-sm"
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
        chainId={chainId}
        crossChain={crossChain}
        transactionType="supply"
      />
    </BaseTransactionDialog>
  );
}