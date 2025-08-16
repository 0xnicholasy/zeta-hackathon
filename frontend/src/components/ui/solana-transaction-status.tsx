import { FaCheck, FaTimes, FaClock } from 'react-icons/fa';
import { HourglassLoader } from './hourglass-loader';
import { useCrossChainTracking } from '@/hooks/useCrossChainTracking';
import { useEffect } from 'react';

// Helper function to format Solana signatures
function formatSolanaSignature(signature: string): string {
  if (signature.length <= 16) return signature;
  return `${signature.substring(0, 8)}...${signature.substring(signature.length - 8)}`;
}

type SolanaTransactionStep = 'signing' | 'confirming' | 'success' | 'failed' | 'crosschain';

interface SolanaTransactionStatusProps {
  currentStep: SolanaTransactionStep;
  signature?: string | null;
  isConfirming?: boolean;
  isSuccess?: boolean;
  evmAddress?: string;
  transactionType?: 'supply' | 'withdraw';
}

function getSolscanUrl(signature: string): string {
  return `https://solscan.io/tx/${signature}?cluster=devnet`;
}

function getZetaChainCrossChainUrl(signature: string): string {
  // ZetaChain cross-chain tracking URL using the Solana transaction signature
  return `https://zetachain-athens.blockpi.network/lcd/v1/public/zeta-chain/crosschain/inboundHashToCctxData/${signature}`;
}

function getTransactionLabel(transactionType: string): string {
  switch (transactionType) {
    case 'supply': return 'Supply';
    case 'withdraw': return 'Withdrawal';
    default: return 'Transaction';
  }
}

export function SolanaTransactionStatus({
  currentStep,
  signature,
  isConfirming,
  isSuccess,
  evmAddress,
  transactionType = 'supply',
}: SolanaTransactionStatusProps) {
  // Use the cross-chain tracking hook
  const { status: crossChainStatus, startTracking, reset } = useCrossChainTracking();

  // Start tracking when we have a signature and transaction is successful
  useEffect(() => {
    if (signature && isSuccess && crossChainStatus === 'idle') {
      startTracking(signature);
    }
  }, [signature, isSuccess, crossChainStatus, startTracking]);

  // Reset tracking when component unmounts or when starting a new transaction
  useEffect(() => {
    return () => {
      reset();
    };
  }, [reset]);

  // Map CrossChainStatus to the legacy status format
  const mappedCrossChainStatus = (() => {
    switch (crossChainStatus) {
      case 'submitted':
      case 'pending':
        return 'pending';
      case 'success':
        return 'success';
      case 'failed':
        return 'failed';
      case 'idle':
      default:
        return null;
    }
  })();
  // Signing step
  if (currentStep === 'signing') {
    return (
      <div className="flex flex-col items-center py-6">
        <HourglassLoader size="lg" className="mb-4" />
        <div className="text-center text-md text-muted-foreground">
          Please sign the transaction in your wallet
        </div>
        <div className="mt-2 text-sm text-muted-foreground text-center">
          {transactionType === 'supply' && evmAddress && (
            <>Supply transaction to ZetaChain address: {evmAddress}</>
          )}
        </div>
      </div>
    );
  }

  // Confirming step
  if (currentStep === 'confirming') {
    return (
      <div className="flex flex-col items-center py-6">
        <HourglassLoader size="lg" className="mb-4" />
        <div className="text-center text-sm text-muted-foreground">
          Confirming transaction on Solana...
        </div>

        {/* Show transaction signature with Solscan link */}
        {signature && (
          <div className="mt-2 text-xs text-muted-foreground flex items-center flex-nowrap">
            <span>{getTransactionLabel(transactionType)}:</span>
            <a
              href={getSolscanUrl(signature)}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-1 text-primary hover:text-primary/80 underline flex-shrink-0"
            >
              {formatSolanaSignature(signature)}
            </a>
            {isConfirming && <FaClock className="ml-2 w-3 h-3 text-muted-foreground flex-shrink-0" />}
            {isSuccess && <FaCheck className="ml-2 w-3 h-3 text-text-success-light dark:text-text-success-dark flex-shrink-0" />}
          </div>
        )}
      </div>
    );
  }

  // Failed step
  if (currentStep === 'failed') {
    return (
      <div className="flex flex-col items-center py-6">
        <div className="w-8 h-8 bg-text-error-light dark:bg-text-error-dark rounded-full flex items-center justify-center mb-4">
          <FaTimes className="w-5 h-5 text-white" />
        </div>
        <div className="text-center text-sm text-muted-foreground">
          {getTransactionLabel(transactionType)} failed. Please try again.
        </div>
      </div>
    );
  }

  // Success step
  if (currentStep === 'success') {
    return (
      <div className="flex flex-col items-center py-6">
        {/* Show appropriate icon based on cross-chain status */}
        {mappedCrossChainStatus === 'pending' && (
          <HourglassLoader size="lg" className="mb-4" />
        )}
        {(mappedCrossChainStatus === 'success' || mappedCrossChainStatus === null || !mappedCrossChainStatus) && (
          <div className="w-8 h-8 bg-text-success-light dark:bg-text-success-dark rounded-full flex items-center justify-center mb-4">
            <FaCheck className="w-5 h-5 text-white" />
          </div>
        )}
        {mappedCrossChainStatus === 'failed' && (
          <div className="w-8 h-8 bg-text-error-light dark:bg-text-error-dark rounded-full flex items-center justify-center mb-4">
            <FaTimes className="w-5 h-5 text-white" />
          </div>
        )}

        <div className="text-center text-sm text-muted-foreground">
          {!mappedCrossChainStatus && `Your ${transactionType} transaction has been completed successfully!`}
          {mappedCrossChainStatus === 'pending' && `Processing cross-chain ${transactionType} to ZetaChain...`}
          {mappedCrossChainStatus === 'success' && `Cross-chain ${transactionType} completed successfully! ${transactionType === 'supply' ? 'Tokens are now available for borrowing on ZetaChain.' : 'Assets have been transferred successfully.'}`}
          {mappedCrossChainStatus === 'failed' && `Cross-chain ${transactionType} failed. Please check the transaction status or try again.`}
        </div>

        {/* Show Solana transaction signature with Solscan link */}
        {signature && (
          <div className="mt-2 text-xs text-muted-foreground flex items-center flex-nowrap">
            <span>Solana Tx:</span>
            <a
              href={getSolscanUrl(signature)}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-1 text-primary hover:text-primary/80 underline flex-shrink-0"
            >
              {formatSolanaSignature(signature)}
            </a>
            <FaCheck className="ml-2 w-3 h-3 text-text-success-light dark:text-text-success-dark flex-shrink-0" />
          </div>
        )}

        {/* Show ZetaChain cross-chain link */}
        {signature && mappedCrossChainStatus !== null && (
          <div className="mt-1 text-xs text-muted-foreground flex items-center flex-nowrap">
            <span>ZetaChain:</span>
            <a
              href={getZetaChainCrossChainUrl(signature)}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-1 text-primary hover:text-primary/80 underline flex-shrink-0"
            >
              Cross-chain Status
            </a>
            {mappedCrossChainStatus === 'pending' && <FaClock className="ml-2 w-3 h-3 text-muted-foreground flex-shrink-0" />}
            {mappedCrossChainStatus === 'success' && <FaCheck className="ml-2 w-3 h-3 text-text-success-light dark:text-text-success-dark flex-shrink-0" />}
            {mappedCrossChainStatus === 'failed' && <FaTimes className="ml-2 w-3 h-3 text-text-error-light dark:text-text-error-dark flex-shrink-0" />}
          </div>
        )}
      </div>
    );
  }

  // Cross-chain step (alternative for when focusing on cross-chain status)
  if (currentStep === 'crosschain') {
    return (
      <div className="flex flex-col items-center py-6">
        <HourglassLoader size="lg" className="mb-4" />
        <div className="text-center text-sm text-muted-foreground">
          Processing cross-chain transfer to ZetaChain...
        </div>
        <div className="mt-2 text-xs text-muted-foreground text-center">
          This may take a few minutes to complete
        </div>

        {/* Show both links */}
        {signature && (
          <>
            <div className="mt-3 text-xs text-muted-foreground flex items-center flex-nowrap">
              <span>Solana Tx:</span>
              <a
                href={getSolscanUrl(signature)}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-1 text-primary hover:text-primary/80 underline flex-shrink-0"
              >
                {formatSolanaSignature(signature)}
              </a>
              <FaCheck className="ml-2 w-3 h-3 text-text-success-light dark:text-text-success-dark flex-shrink-0" />
            </div>
            <div className="mt-1 text-xs text-muted-foreground flex items-center flex-nowrap">
              <span>ZetaChain:</span>
              <a
                href={getZetaChainCrossChainUrl(signature)}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-1 text-primary hover:text-primary/80 underline flex-shrink-0"
              >
                Cross-chain Status
              </a>
              <FaClock className="ml-2 w-3 h-3 text-muted-foreground flex-shrink-0" />
            </div>
          </>
        )}
      </div>
    );
  }

  return null;
}