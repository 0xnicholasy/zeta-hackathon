import { useState, useEffect, useCallback } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits } from 'viem';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { TokenNetworkIcon } from '../ui/token-network-icon';
import { Spinner } from '../ui/spinner';
import { useContracts } from '../../hooks/useContracts';
import { isSupportedChain, type SupportedChainId } from '../../contracts/deployments';
import type { TokenBalance } from '../../hooks/useMultiChainBalances';

interface SupplyDialogProps {
  isOpen: boolean;
  onClose: () => void;
  selectedToken: TokenBalance | null;
  chainId: number;
}

// DepositContract ABI (only functions we need)
const depositContractAbi = [
  {
    name: 'depositEth',
    type: 'function',
    stateMutability: 'payable',
    inputs: [{ name: 'onBehalfOf', type: 'address' }],
    outputs: [],
  },
  {
    name: 'depositToken',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'asset', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'onBehalfOf', type: 'address' },
    ],
    outputs: [],
  },
] as const;

// ERC20 ABI for approval
const erc20Abi = [
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

export function SupplyDialog({ isOpen, onClose, selectedToken, chainId }: SupplyDialogProps) {
  const [amount, setAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState<'input' | 'approve' | 'approving' | 'deposit' | 'depositing' | 'success'>('input');
  const [approvalHash, setApprovalHash] = useState<`0x${string}` | null>(null);
  const [depositHash, setDepositHash] = useState<`0x${string}` | null>(null);

  const { address } = useAccount();

  // Type guard the chainId to ensure it's supported
  const supportedChainId: SupportedChainId | null = isSupportedChain(chainId) ? chainId : null;
  const { depositContract } = useContracts(supportedChainId as SupportedChainId);

  const { writeContract, data: hash, error: contractError, reset: resetContract } = useWriteContract();

  // Wait for approval transaction
  const { isLoading: isApprovingTx, isSuccess: isApprovalSuccess } = useWaitForTransactionReceipt({
    hash: approvalHash as `0x${string}`,
  });

  // Wait for deposit transaction
  const { isLoading: isDepositingTx, isSuccess: isDepositSuccess } = useWaitForTransactionReceipt({
    hash: depositHash as `0x${string}`,
  });

  // Move computed values to the top but after hooks
  const isNativeToken = selectedToken?.isNative ?? false;
  const maxAmount = selectedToken?.formattedBalance ?? '0';
  const amountBigInt = amount && selectedToken ? parseUnits(amount, selectedToken.decimals) : BigInt(0);
  const isValidAmount = amount && parseFloat(amount) > 0 && parseFloat(amount) <= parseFloat(maxAmount);

  // Memoize the deposit function
  const handleDeposit = useCallback(async () => {
    if (!address || !selectedToken || !amountBigInt || !depositContract) return;

    try {
      setCurrentStep('deposit');
      writeContract({
        address: depositContract as `0x${string}`,
        abi: depositContractAbi,
        functionName: 'depositToken',
        args: [
          selectedToken.tokenAddress as `0x${string}`,
          amountBigInt,
          address,
        ],
      });
    } catch (error) {
      console.error('Deposit failed:', error);
      setIsSubmitting(false);
      setCurrentStep('input');
    }
  }, [address, selectedToken, amountBigInt, depositContract, writeContract]);

  // Memoize the max click handler
  const handleMaxClick = useCallback(() => {
    if (selectedToken) {
      setAmount(selectedToken.formattedBalance);
    }
  }, [selectedToken]);

  // Memoize the submit handler
  const handleSubmit = useCallback(async () => {
    if (!address || !amount || !selectedToken || !amountBigInt || !depositContract) return;

    setIsSubmitting(true);
    resetContract(); // Clear previous errors

    try {
      if (isNativeToken) {
        // For native ETH, call depositEth directly
        setCurrentStep('deposit');
        writeContract({
          address: depositContract as `0x${string}`,
          abi: depositContractAbi,
          functionName: 'depositEth',
          args: [address],
          value: amountBigInt,
        });
      } else {
        // For ERC20 tokens, start with approval
        setCurrentStep('approve');
        writeContract({
          address: selectedToken.tokenAddress as `0x${string}`,
          abi: erc20Abi,
          functionName: 'approve',
          args: [depositContract as `0x${string}`, amountBigInt],
        });
      }
    } catch (error) {
      console.error('Transaction failed:', error);
      setIsSubmitting(false);
      setCurrentStep('input');
    }
  }, [address, amount, selectedToken, amountBigInt, isNativeToken, depositContract, writeContract, resetContract]);

  // Memoize the close handler
  const handleClose = useCallback(() => {
    setAmount('');
    setCurrentStep('input');
    setIsSubmitting(false);
    setApprovalHash(null);
    setDepositHash(null);
    resetContract(); // Clear any error states from the contract hook
    onClose();
  }, [onClose, resetContract]);

  // Memoize the step text getter
  const getStepText = useCallback(() => {
    switch (currentStep) {
      case 'approve':
        return 'Click to approve token spending';
      case 'approving':
        return 'Waiting for approval confirmation...';
      case 'deposit':
        return 'Click to deposit to protocol';
      case 'depositing':
        return 'Waiting for deposit confirmation...';
      case 'success':
        return 'Supply successful!';
      default:
        return 'Enter amount to supply';
    }
  }, [currentStep]);

  // Memoize amount change handler
  const handleAmountChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setAmount(e.target.value);
  }, []);

  // Handle approval transaction success -> proceed to deposit
  useEffect(() => {
    if (isApprovalSuccess && currentStep === 'approving') {
      setCurrentStep('deposit');
      handleDeposit();
    }
  }, [isApprovalSuccess, currentStep, handleDeposit]);

  // Handle deposit transaction success -> show success
  useEffect(() => {
    if (isDepositSuccess && currentStep === 'depositing') {
      setCurrentStep('success');
      setIsSubmitting(false);
    }
  }, [isDepositSuccess, currentStep]);

  // Update current hash when writeContract returns new hash
  useEffect(() => {
    if (hash) {
      if (currentStep === 'approve') {
        setApprovalHash(hash);
        setCurrentStep('approving');
      } else if (currentStep === 'deposit') {
        setDepositHash(hash);
        setCurrentStep('depositing');
      }
    }
  }, [hash, currentStep]);

  // Early return AFTER all hooks have been called
  if (!selectedToken || !supportedChainId || !depositContract) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md max-w-[95vw] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TokenNetworkIcon
              tokenSymbol={selectedToken.tokenSymbol}
              sourceChain={selectedToken.chainName}
              size="sm"
              shadow="sm"
              showNativeIndicator={true}
            />
            Supply {selectedToken.tokenSymbol}
          </DialogTitle>
          <DialogDescription>
            {getStepText()}
          </DialogDescription>
        </DialogHeader>

        {currentStep === 'input' && (
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

            {/* Transaction Info */}
            {amount && (
              <div className="p-3 border border-green-200 dark:border-green-800 rounded-lg bg-green-50 dark:bg-green-900/20 text-sm break-words">
                <div className="text-green-800 dark:text-green-200 font-medium mb-1">
                  Transaction Summary
                </div>
                <div className="text-green-700 dark:text-green-300 break-words">
                  You will supply {amount} {selectedToken.tokenSymbol} as collateral to the lending protocol on ZetaChain.
                </div>
              </div>
            )}

            {/* Error Display */}
            {contractError && (
              <div className="p-3 border border-red-200 dark:border-red-800 rounded-lg bg-red-50 dark:bg-red-900/20 text-sm break-words max-w-full">
                <div className="text-red-800 dark:text-red-200 font-medium">
                  Transaction Failed
                </div>
                <div className="text-red-700 dark:text-red-300 mt-1 break-words overflow-hidden text-wrap max-w-full">
                  {contractError.message.length > 200
                    ? `${contractError.message.substring(0, 200)}...`
                    : contractError.message}
                </div>
              </div>
            )}
          </div>
        )}

        {currentStep !== 'input' && (
          <div className="flex flex-col items-center py-6">
            {currentStep !== 'success' && (
              <Spinner variant="zeta" size="lg" className="mb-4" />
            )}
            {currentStep === 'success' && (
              <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center mb-4">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}
            <div className="text-center text-sm text-muted-foreground">
              {currentStep === 'approve' && 'Please confirm the approval transaction in your wallet...'}
              {currentStep === 'approving' && 'Waiting for approval transaction to be confirmed...'}
              {currentStep === 'deposit' && 'Please confirm the deposit transaction in your wallet...'}
              {currentStep === 'depositing' && 'Waiting for deposit transaction to be confirmed...'}
              {currentStep === 'success' && 'Your supply transaction has been completed successfully!'}
            </div>

            {/* Show approval transaction hash */}
            {approvalHash && (currentStep === 'approving' || currentStep === 'deposit' || currentStep === 'depositing' || currentStep === 'success') && (
              <div className="mt-2 text-xs text-muted-foreground">
                Approval: {approvalHash.slice(0, 6)}...{approvalHash.slice(-4)}
                {isApprovingTx && <span className="ml-2">⏳</span>}
                {isApprovalSuccess && <span className="ml-2 text-green-500">✓</span>}
              </div>
            )}

            {/* Show deposit transaction hash */}
            {depositHash && (currentStep === 'depositing' || currentStep === 'success') && (
              <div className="mt-1 text-xs text-muted-foreground">
                Deposit: {depositHash.slice(0, 6)}...{depositHash.slice(-4)}
                {isDepositingTx && <span className="ml-2">⏳</span>}
                {isDepositSuccess && <span className="ml-2 text-green-500">✓</span>}
              </div>
            )}

            {/* Show current transaction hash for approval/deposit steps */}
            {hash && (currentStep === 'approve' || currentStep === 'deposit') && (
              <div className="mt-2 text-xs text-muted-foreground">
                Transaction: {hash.slice(0, 6)}...{hash.slice(-4)}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {currentStep === 'input' ? (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                variant="zeta"
                onClick={handleSubmit}
                disabled={!isValidAmount || isSubmitting || !address}
              >
{isSubmitting && <Spinner variant="white" size="xs" className="mr-2" />}
                {isSubmitting ? 'Submitting...' : 'Supply'}
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={handleClose} className="w-full">
              Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}