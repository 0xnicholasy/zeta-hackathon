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
import { useZetaChainBalances } from '../../hooks/useMultiChainBalances';
import { SupportedChain } from '../../contracts/deployments';
import { safeEVMAddress, safeEVMAddressOrZeroAddress } from './types';
import { ERC20__factory, UniversalLendingProtocol__factory } from '@/contracts/typechain-types';
import type { UserAssetData } from './types';

interface ZetaSupplyDialogProps {
  isOpen: boolean;
  onClose: () => void;
  selectedAsset: UserAssetData;
}

// Contract ABIs
const lendingProtocolAbi = UniversalLendingProtocol__factory.abi;
const erc20Abi = ERC20__factory.abi;

export function ZetaSupplyDialog({ isOpen, onClose, selectedAsset }: ZetaSupplyDialogProps) {
  const [amount, setAmount] = useState('');

  // Custom hooks
  const crossChain = useCrossChainTracking();
  const transactionFlow = useTransactionFlow();
  const { address } = useAccount();
  const { universalLendingProtocol } = useContracts(SupportedChain.ZETA_TESTNET);
  const { zetaBalances } = useZetaChainBalances();

  // Destructure transaction flow state
  const { state: txState, actions: txActions, contractState } = transactionFlow;

  // Helper function to get ZRC-20 token symbol and balance for an asset
  const getZetaTokenInfo = useCallback(() => {
    // Create ZRC-20 token symbol based on asset's unit and source chain
    const zrc20Symbol = `${selectedAsset.unit}.${selectedAsset.sourceChain}`;
    const zetaBalance = zetaBalances[zrc20Symbol];

    return {
      zrc20Symbol,
      zetaBalance: zetaBalance?.formattedBalance ?? '0',
      hasBalance: zetaBalance && Number(zetaBalance.formattedBalance) > 0
    };
  }, [selectedAsset.unit, selectedAsset.sourceChain, zetaBalances]);

  // Computed values
  const { zetaBalance: maxAmount } = getZetaTokenInfo();
  const amountBigInt = amount && selectedAsset ? parseUnits(amount, selectedAsset.decimals) : BigInt(0);
  const isValidAmount = Boolean(amount && parseFloat(amount) > 0 && parseFloat(amount) <= parseFloat(maxAmount));

  // Handle token approval for ERC20 tokens
  const handleApproveToken = useCallback(() => {
    if (!selectedAsset || !universalLendingProtocol || !amountBigInt) return;

    txActions.setCurrentStep('approve');
    txActions.writeContract({
      address: selectedAsset.address,
      abi: erc20Abi,
      functionName: 'approve',
      args: [safeEVMAddressOrZeroAddress(universalLendingProtocol), amountBigInt],
    });
  }, [selectedAsset, universalLendingProtocol, amountBigInt, txActions]);

  // Handle supply function
  const handleSupply = useCallback(async () => {
    if (!address || !selectedAsset || !amountBigInt || !universalLendingProtocol) return;

    try {
      txActions.setCurrentStep('deposit');
      txActions.writeContract({
        address: safeEVMAddress(universalLendingProtocol),
        abi: lendingProtocolAbi,
        functionName: 'supply',
        args: [
          selectedAsset.address,
          amountBigInt,
          address,
        ],
      });
    } catch (error) {
      console.error('Supply failed:', error);
      txActions.setIsSubmitting(false);
      txActions.setCurrentStep('input');
    }
  }, [address, selectedAsset, amountBigInt, universalLendingProtocol, txActions]);

  // Handle max click
  const handleMaxClick = useCallback(() => {
    setAmount(maxAmount);
  }, [maxAmount]);

  // Handle submit
  const handleSubmit = useCallback(async () => {
    if (!address || !amount || !selectedAsset || !amountBigInt || !universalLendingProtocol) return;

    txActions.setIsSubmitting(true);
    txActions.resetContract();

    try {
      // Check if this is a native token or needs approval
      // For ZRC-20 tokens on Zeta, we need approval
      txActions.setCurrentStep('approve');
      handleApproveToken();
    } catch (error) {
      console.error('Transaction failed:', error);
      txActions.setIsSubmitting(false);
      txActions.setCurrentStep('input');
    }
  }, [address, amount, selectedAsset, amountBigInt, universalLendingProtocol, txActions, handleApproveToken]);

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
        return 'Click to supply to protocol';
      case 'depositing':
        return 'Waiting for supply confirmation...';
      case 'success':
        return 'Local supply transaction confirmed!';
      default:
        return 'Enter amount to supply locally on Zeta';
    }
  }, [txState.currentStep]);

  // Handle amount change
  const handleAmountChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setAmount(e.target.value);
  }, []);

  // Handle approval transaction success -> proceed to supply
  useEffect(() => {
    if (contractState.isApprovalSuccess && txState.currentStep === 'approving') {
      txActions.setCurrentStep('deposit');
      handleSupply();
    }
  }, [contractState.isApprovalSuccess, txState.currentStep, handleSupply, txActions]);

  // Handle supply transaction success -> show success
  useEffect(() => {
    if (contractState.isTransactionSuccess && txState.currentStep === 'depositing') {
      txActions.setCurrentStep('success');
      txActions.setIsSubmitting(false);
    }
  }, [contractState.isTransactionSuccess, txState.currentStep, txActions]);

  // Early return AFTER all hooks have been called
  if (!selectedAsset || !universalLendingProtocol) return null;

  return (
    <BaseTransactionDialog
      isOpen={isOpen}
      onClose={handleClose}
      title={`Zeta Supply ${selectedAsset.unit}`}
      description={getStepText()}
      tokenSymbol={selectedAsset.unit}
      sourceChain="ZetaChain"
      currentStep={txState.currentStep}
      isSubmitting={txState.isSubmitting}
      onSubmit={handleSubmit as unknown as () => void}
      isValidAmount={isValidAmount}
      isConnected={Boolean(address)}
      submitButtonText="Supply on Zeta"
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
              <span className="font-medium">ZetaChain (Local)</span>
            </div>
            <div className="flex justify-between mt-1">
              <span>Asset:</span>
              <span className="font-medium">{selectedAsset.unit}</span>
            </div>
            <div className="flex justify-between mt-1 text-blue-600 dark:text-blue-400">
              <span>Type:</span>
              <span className="font-medium">Local Supply</span>
            </div>
          </div>

          {/* Transaction Summary */}
          {amount && (
            <TransactionSummary
              transactionType="supply"
              amount={amount}
              tokenSymbol={selectedAsset.unit}
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
        chainId={SupportedChain.ZETA_TESTNET}
        crossChain={crossChain}
        transactionType="supply"
      />
    </BaseTransactionDialog>
  );
}