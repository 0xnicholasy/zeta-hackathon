import { useCallback } from 'react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { FaClipboard } from 'react-icons/fa';
import { SupportedChain } from '../../../contracts/deployments';
import { getChainDisplayNameFromId } from '../../../utils/chainUtils';
import { type BorrowableAssetData } from '../../../utils/directContractCalls';

interface BorrowFormSectionProps {
  selectedAsset: BorrowableAssetData;
  amount: string;
  onAmountChange: (amount: string) => void;
  recipientAddress: string;
  onRecipientAddressChange: (address: string) => void;
  onMaxClick: () => void;
  onPasteFromClipboard: () => Promise<void>;
  maxBorrowAmount: string;
  isValidRecipient: boolean;
  hasValidationErrors: boolean;
  validationErrors: string[];
  hasValidationWarnings: boolean;
  validationWarnings: string[];
}

export function BorrowFormSection({
  selectedAsset,
  amount,
  onAmountChange,
  recipientAddress,
  onRecipientAddressChange,
  onMaxClick,
  onPasteFromClipboard,
  maxBorrowAmount,
  isValidRecipient,
  hasValidationErrors,
  validationErrors,
  hasValidationWarnings,
  validationWarnings
}: BorrowFormSectionProps) {
  const isDestinationSolana = selectedAsset.externalChainId === SupportedChain.SOLANA_DEVNET;
  const chainDisplayName = getChainDisplayNameFromId(selectedAsset.externalChainId);

  const handleAmountChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onAmountChange(e.target.value);
  }, [onAmountChange]);

  const handleRecipientChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onRecipientAddressChange(e.target.value);
  }, [onRecipientAddressChange]);

  return (
    <div className="space-y-4 w-full overflow-hidden">
      {/* Amount Input */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span>Amount to Borrow</span>
          <span>Max: {Number(maxBorrowAmount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })}</span>
        </div>
        <div className="relative">
          <Input
            type="number"
            value={amount}
            onChange={handleAmountChange}
            placeholder="0.00"
            step="any"
            min="0"
            max={maxBorrowAmount}
          />
          <Button
            variant="zeta-outline"
            size="sm"
            className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 text-xs"
            onClick={onMaxClick}
          >
            MAX
          </Button>
        </div>
      </div>

      {/* Recipient Address Input */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span>Recipient Address ({chainDisplayName})</span>
          {recipientAddress && (
            <span className={`text-xs ${isValidRecipient ? 'text-green-600' : 'text-red-600'}`}>
              {isValidRecipient ? '✓ Valid' : '✗ Invalid'}
            </span>
          )}
        </div>
        <div className="relative">
          <Input
            type="text"
            value={recipientAddress}
            onChange={handleRecipientChange}
            placeholder={isDestinationSolana ? "Solana address (Base58)" : "0x..."}
            className={`pr-10 ${!isValidRecipient && recipientAddress ? 'border-red-500 focus:border-red-500' : ''}`}
          />
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
            onClick={onPasteFromClipboard}
            title="Paste from clipboard"
          >
            <FaClipboard className="h-3 w-3" />
          </Button>
        </div>
        <div className="text-xs text-muted-foreground">
          {isDestinationSolana 
            ? "Enter the Solana wallet address where you want to receive the borrowed tokens"
            : `Enter the ${chainDisplayName} address where you want to receive the borrowed tokens`
          }
        </div>
      </div>

      {/* Validation Messages */}
      <div className="min-h-[1.25rem]">
        {hasValidationErrors && (
          <div className="space-y-1">
            {validationErrors.map((error, index) => (
              <div key={index} className="text-xs text-destructive flex items-center gap-1">
                <span className="inline-block w-3 h-3 text-center">⚠</span>
                {error}
              </div>
            ))}
          </div>
        )}
        {hasValidationWarnings && (
          <div className="space-y-1">
            {validationWarnings.map((warning, index) => (
              <div key={index} className="text-xs text-yellow-600 flex items-center gap-1">
                <span className="inline-block w-3 h-3 text-center">⚠</span>
                {warning}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Asset Info */}
      <div className="p-3 bg-muted rounded-lg text-sm">
        <div className="flex justify-between">
          <span>Asset:</span>
          <span className="font-medium">{selectedAsset.symbol}</span>
        </div>
        <div className="flex justify-between mt-1">
          <span>Destination:</span>
          <span className="font-medium">{chainDisplayName}</span>
        </div>
        <div className="flex justify-between mt-1">
          <span>Available to Borrow:</span>
          <span className="font-medium">{selectedAsset.formattedMaxAvailable}</span>
        </div>
      </div>
    </div>
  );
}