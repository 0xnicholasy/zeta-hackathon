import { useState, useCallback, useEffect } from 'react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { BaseTransactionDialog } from '../../ui/base-transaction-dialog';
import { TransactionSummary } from '../../ui/transaction-summary';
import { SolanaTransactionStatus } from '../../ui/solana-transaction-status';
import { Alert, AlertDescription } from '../../ui/alert';
import { FaExclamationTriangle } from 'react-icons/fa';

export interface SolanaToken {
  symbol: string;
  name: string;
  balance: number;
  decimals: number;
  mintAddress?: string;
  isNative?: boolean;
}

interface SolanaSupplyDialogProps {
  isOpen: boolean;
  onClose: () => void;
  selectedToken: SolanaToken | null;
  isPhantomConnected: boolean;
  phantomPublicKey: string | null;
  onSupply: (token: SolanaToken, amount: number, evmAddress: string) => Promise<string>;
}

export function SolanaSupplyDialog({
  isOpen,
  onClose,
  selectedToken,
  isPhantomConnected,
  phantomPublicKey,
  onSupply
}: SolanaSupplyDialogProps) {
  const [amount, setAmount] = useState('');
  const [evmAddress, setEvmAddress] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState<'input' | 'signing' | 'confirming' | 'success' | 'error'>('input');
  const [error, setError] = useState<string | null>(null);
  const [transactionSignature, setTransactionSignature] = useState<string | null>(null);

  // Computed values
  const maxAmount = selectedToken?.balance ?? 0;
  const isValidAmount = Boolean(amount && parseFloat(amount) > 0 && parseFloat(amount) <= maxAmount);
  const isValidEvmAddress = Boolean(evmAddress?.match(/^0x[a-fA-F0-9]{40}$/));
  const canSubmit = isValidAmount && isValidEvmAddress && isPhantomConnected && !isSubmitting;

  // Handle max click
  const handleMaxClick = useCallback(() => {
    if (selectedToken) {
      setAmount(selectedToken.balance.toString());
    }
  }, [selectedToken]);

  // Handle submit
  const handleSubmit = useCallback(async () => {
    if (!selectedToken || !canSubmit) return;

    try {
      setIsSubmitting(true);
      setCurrentStep('signing');
      setError(null);
      setTransactionSignature(null);

      // Step 1: Sign transaction
      const signature = await onSupply(selectedToken, parseFloat(amount), evmAddress);
      setTransactionSignature(signature);
      
      // Step 2: Transaction confirmed, now move to success for cross-chain tracking
      setCurrentStep('success');

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transaction failed');
      setCurrentStep('error');
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedToken, amount, evmAddress, canSubmit, onSupply]);

  // Handle close
  const handleClose = useCallback(() => {
    setAmount('');
    setEvmAddress('');
    setIsSubmitting(false);
    setCurrentStep('input');
    setError(null);
    setTransactionSignature(null);
    onClose();
  }, [onClose]);

  // Get step text
  const getStepText = useCallback(() => {
    switch (currentStep) {
      case 'signing':
        return 'Please sign the transaction in your wallet';
      case 'confirming':
        return 'Confirming transaction on Solana...';
      case 'success':
        return 'Supply transaction completed!';
      case 'error':
        return 'Transaction failed';
      default:
        return 'Enter amount and destination address';
    }
  }, [currentStep]);

  // Handle amount change
  const handleAmountChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setAmount(e.target.value);
  }, []);

  // Handle EVM address change
  const handleEvmAddressChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setEvmAddress(e.target.value);
  }, []);

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (!isOpen) {
      setAmount('');
      setEvmAddress('');
      setCurrentStep('input');
      setError(null);
      setTransactionSignature(null);
    }
  }, [isOpen]);

  // Early return if no token selected
  if (!selectedToken) return null;

  return (
    <BaseTransactionDialog
      isOpen={isOpen}
      onClose={handleClose}
      title={`Supply ${selectedToken.symbol} from Solana`}
      description={getStepText()}
      tokenSymbol={selectedToken.symbol}
      sourceChain="Solana"
      currentStep={currentStep}
      isSubmitting={isSubmitting}
      onSubmit={handleSubmit}
      isValidAmount={canSubmit}
      isConnected={isPhantomConnected}
      submitButtonText="Supply to ZetaChain"
    >
      {currentStep === 'input' && (
        <div className="space-y-4 w-full overflow-hidden">
          {/* Phantom Wallet Connection Status */}
          {!isPhantomConnected && (
            <Alert className="border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20">
              <FaExclamationTriangle className="h-4 w-4" />
              <AlertDescription>
                Please connect your Phantom wallet to continue.
              </AlertDescription>
            </Alert>
          )}

          {isPhantomConnected && phantomPublicKey && (
            <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
              <div className="text-sm font-medium text-green-800 dark:text-green-200">
                Phantom Wallet Connected
              </div>
              <div className="text-xs text-green-600 dark:text-green-400 mt-1 break-all">
                {phantomPublicKey}
              </div>
            </div>
          )}

          {/* Amount Input */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Amount</span>
              <span>Available: {maxAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })}</span>
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
                disabled={!isPhantomConnected}
              />
              <Button
                variant="zeta-outline"
                size="sm"
                className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 text-xs"
                onClick={handleMaxClick}
                disabled={!isPhantomConnected}
              >
                MAX
              </Button>
            </div>
          </div>

          {/* EVM Address Input */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>ZetaChain EVM Address</span>
              <span className="text-xs text-muted-foreground">Required</span>
            </div>
            <Input
              type="text"
              value={evmAddress}
              onChange={handleEvmAddressChange}
              placeholder="0x..."
              disabled={!isPhantomConnected}
            />
            {evmAddress && !isValidEvmAddress && (
              <div className="text-xs text-red-600 dark:text-red-400">
                Please enter a valid EVM address (0x...)
              </div>
            )}
          </div>

          {/* Important Warning */}
          <Alert className="border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
            <FaExclamationTriangle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              <div className="font-medium text-red-800 dark:text-red-200 mb-1">
                ⚠️ Important: Double-check your EVM address
              </div>
              <div className="text-red-700 dark:text-red-300">
                Funds will be sent to the EVM address you provide above. If you enter an incorrect address,
                your funds may be permanently lost and cannot be recovered.
              </div>
            </AlertDescription>
          </Alert>

          {/* Network Info */}
          <div className="p-3 bg-muted rounded-lg text-sm">
            <div className="flex justify-between">
              <span>From Network:</span>
              <span className="font-medium">Solana</span>
            </div>
            <div className="flex justify-between mt-1">
              <span>To Network:</span>
              <span className="font-medium">ZetaChain</span>
            </div>
            <div className="flex justify-between mt-1">
              <span>Asset:</span>
              <span className="font-medium">{selectedToken.symbol}</span>
            </div>
          </div>

          {/* Transaction Summary */}
          {amount && isValidAmount && (
            <TransactionSummary
              transactionType="supply"
              amount={amount}
              tokenSymbol={selectedToken.symbol}
              className="border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20"
            />
          )}
        </div>
      )}

      {(currentStep === 'signing' || currentStep === 'confirming' || currentStep === 'success') && (
        <SolanaTransactionStatus
          currentStep={currentStep === 'signing' ? 'signing' : currentStep === 'confirming' ? 'confirming' : 'success'}
          signature={transactionSignature}
          isConfirming={currentStep === 'confirming'}
          isSuccess={currentStep === 'success'}
          evmAddress={evmAddress}
          transactionType="supply"
        />
      )}

      {currentStep === 'error' && error && (
        <div className="p-3 border border-red-200 dark:border-red-800 rounded-lg bg-red-50 dark:bg-red-900/20 text-sm">
          <div className="text-red-800 dark:text-red-200 font-medium">
            Transaction Failed
          </div>
          <div className="text-red-700 dark:text-red-300 mt-1 break-words">
            {error.length > 200 ? `${error.substring(0, 200)}...` : error}
          </div>
        </div>
      )}
    </BaseTransactionDialog>
  );
}