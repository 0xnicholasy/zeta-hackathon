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
import { HourglassLoader } from '../ui/hourglass-loader';
import { useCrossChainTracking } from '../../hooks/useCrossChainTracking';
import { useContracts } from '../../hooks/useContracts';
import { type SupportedChainId, getTransactionUrl } from '../../contracts/deployments';
import type { TokenBalance } from '../../hooks/useMultiChainBalances';
import type { EVMTransactionHash } from './types';
import { safeEVMAddress, safeEVMAddressOrZeroAddress, safeEVMTransactionHashOrZeroTransactionHash } from './types';
import { FaCheck, FaTimes, FaClock } from 'react-icons/fa';
import { DepositContract__factory, ERC20__factory } from '@/contracts/typechain-types';
import { formatHexString } from '@/utils/formatHexString';

interface SupplyDialogProps {
  isOpen: boolean;
  onClose: () => void;
  selectedToken: TokenBalance | null;
  chainId: SupportedChainId;
}

// DepositContract ABI (only functions we need)
const depositContractAbi = DepositContract__factory.abi;

// ERC20 ABI for approval
const erc20Abi = ERC20__factory.abi;

export function SupplyDialog({ isOpen, onClose, selectedToken, chainId }: SupplyDialogProps) {
  const [amount, setAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState<'input' | 'approve' | 'approving' | 'deposit' | 'depositing' | 'success'>('input');
  const [approvalHash, setApprovalHash] = useState<EVMTransactionHash | null>(null);
  const [depositHash, setDepositHash] = useState<EVMTransactionHash | null>(null);

  // Use cross-chain tracking hook
  const crossChain = useCrossChainTracking();

  const { address } = useAccount();

  // Type guard the chainId to ensure it's supported
  const { depositContract } = useContracts(chainId);

  const { writeContract, data: hash, error: contractError, reset: resetContract } = useWriteContract();

  // Wait for approval transaction
  const { isLoading: isApprovingTx, isSuccess: isApprovalSuccess } = useWaitForTransactionReceipt({
    hash: approvalHash || undefined,
    query: {
      enabled: !!approvalHash,
    },
  });

  // Wait for deposit transaction
  const { isLoading: isDepositingTx, isSuccess: isDepositSuccess } = useWaitForTransactionReceipt({
    hash: depositHash || undefined,
    query: {
      enabled: !!depositHash,
    },
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
          address: safeEVMAddress(depositContract),
          abi: depositContractAbi,
          functionName: 'depositEth',
          args: [address],
          value: amountBigInt,
        });
      } else {
        // For ERC20 tokens, start with approval
        setCurrentStep('approve');
        writeContract({
          address: safeEVMAddress(selectedToken.tokenAddress),
          abi: erc20Abi,
          functionName: 'approve',
          args: [safeEVMAddressOrZeroAddress(depositContract), amountBigInt],
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
    crossChain.reset();
    resetContract(); // Clear any error states from the contract hook
    onClose();
  }, [onClose, resetContract, crossChain]);

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
  }, [currentStep, crossChain.status]);

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

  // Handle deposit transaction success -> show success and start cross-chain tracking
  useEffect(() => {
    if (isDepositSuccess && currentStep === 'depositing' && depositHash) {
      setCurrentStep('success');
      setIsSubmitting(false);
      // Start cross-chain tracking
      crossChain.startTracking(depositHash);
    }
  }, [isDepositSuccess, currentStep, depositHash, crossChain]);

  // Update current hash when writeContract returns new hash
  useEffect(() => {
    if (hash) {
      const validHash = safeEVMTransactionHashOrZeroTransactionHash(hash);
      if (validHash) {
        if (currentStep === 'approve') {
          setApprovalHash(validHash);
          setCurrentStep('approving');
        } else if (currentStep === 'deposit') {
          setDepositHash(validHash);
          setCurrentStep('depositing');
        }
      }
    }
  }, [hash, currentStep]);

  // Early return AFTER all hooks have been called
  if (!selectedToken || !depositContract) return null;

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
            {/* Show appropriate icon based on current step and cross-chain status */}
            {currentStep !== 'success' && (
              <HourglassLoader size="lg" className="mb-4" />
            )}
            {currentStep === 'success' && (
              <>
                {crossChain.status === 'pending' && (
                  <HourglassLoader size="lg" className="mb-4" />
                )}
                {(crossChain.status === 'success' || crossChain.status === 'idle') && (
                  <div className="w-8 h-8 bg-text-success-light dark:bg-text-success-dark rounded-full flex items-center justify-center mb-4">
                    <FaCheck className="w-5 h-5 text-white" />
                  </div>
                )}
                {crossChain.status === 'failed' && (
                  <div className="w-8 h-8 bg-text-error-light dark:bg-text-error-dark rounded-full flex items-center justify-center mb-4">
                    <FaTimes className="w-5 h-5 text-white" />
                  </div>
                )}
              </>
            )}
            <div className="text-center text-sm text-muted-foreground">
              {currentStep === 'approve' && 'Please confirm the approval transaction in your wallet...'}
              {currentStep === 'approving' && 'Waiting for approval transaction to be confirmed...'}
              {currentStep === 'deposit' && 'Please confirm the deposit transaction in your wallet...'}
              {currentStep === 'depositing' && 'Waiting for deposit transaction to be confirmed...'}
              {currentStep === 'success' && crossChain.status === 'pending' && 'Processing cross-chain deposit to ZetaChain...'}
              {currentStep === 'success' && crossChain.status === 'success' && 'Cross-chain deposit completed successfully! Tokens are now available for borrowing.'}
              {currentStep === 'success' && crossChain.status === 'failed' && 'Cross-chain deposit failed. Please check the transaction status or try again.'}
              {currentStep === 'success' && crossChain.status === 'idle' && 'Your supply transaction has been completed successfully! Starting cross-chain transfer...'}
            </div>

            {/* Show approval transaction hash */}
            {approvalHash && (currentStep === 'approving' || currentStep === 'deposit' || currentStep === 'depositing' || currentStep === 'success') && (
              <div className="mt-2 text-xs text-muted-foreground flex items-center">
                <span>Approval:</span>
                <a
                  href={getTransactionUrl(chainId, approvalHash) || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-1 text-primary hover:text-primary/80 underline"
                >
                  {formatHexString(approvalHash)}
                </a>
                {isApprovingTx && <FaClock className="ml-2 w-3 h-3 text-muted-foreground" />}
                {isApprovalSuccess && <FaCheck className="ml-2 w-3 h-3 text-text-success-light dark:text-text-success-dark" />}
              </div>
            )}

            {/* Show deposit transaction hash */}
            {depositHash && (currentStep === 'depositing' || currentStep === 'success') && (
              <div className="mt-1 text-xs text-muted-foreground flex items-center">
                <span>Deposit:</span>
                <a
                  href={getTransactionUrl(chainId, depositHash) || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-1 text-primary hover:text-primary/80 underline"
                >
                  {formatHexString(depositHash)}
                </a>
                {isDepositingTx && <FaClock className="ml-2 w-3 h-3 text-muted-foreground" />}
                {isDepositSuccess && <FaCheck className="ml-2 w-3 h-3 text-text-success-light dark:text-text-success-dark" />}
              </div>
            )}

            {/* TODO: fix pending cross-chain status */}
            {/* Show cross-chain transaction hash */}
            {crossChain.txHash && currentStep === 'success' && crossChain.status !== 'idle' && (
              <div className="mt-1 text-xs text-muted-foreground flex items-center">
                <span>Cross-chain:</span>
                <a
                  href={`https://zetachain-athens.blockpi.network/lcd/v1/public/zeta-chain/crosschain/inboundHashToCctxData/${crossChain.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-1 text-primary hover:text-primary/80 underline"
                >
                  {formatHexString(crossChain.txHash)}
                </a>
                {crossChain.status === 'pending' && <FaClock className="ml-2 w-3 h-3 text-muted-foreground" />}
                {crossChain.status === 'success' && <FaCheck className="ml-2 w-3 h-3 text-text-success-light dark:text-text-success-dark" />}
                {crossChain.status === 'failed' && <FaTimes className="ml-2 w-3 h-3 text-text-error-light dark:text-text-error-dark" />}
              </div>
            )}

            {/* Show current transaction hash for approval/deposit steps */}
            {hash && (currentStep === 'approve' || currentStep === 'deposit') && (
              <div className="mt-2 text-xs text-muted-foreground">
                Transaction:
                <a
                  href={getTransactionUrl(chainId, hash) || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-1 text-blue-500 hover:text-blue-700 underline"
                >
                  {formatHexString(hash)}
                </a>
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