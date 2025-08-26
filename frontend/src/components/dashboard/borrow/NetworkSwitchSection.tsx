import { Button } from '../../ui/button';
import { Alert, AlertDescription } from '../../ui/alert';
import { AlertTriangle, Network } from 'lucide-react';
import { SupportedChain, getNetworkConfig } from '../../../contracts/deployments';

interface NetworkSwitchSectionProps {
  isOnZetaChain: boolean;
  currentChainId: number;
  onSwitchToZeta: () => Promise<void>;
  isSubmitting: boolean;
}

export function NetworkSwitchSection({
  isOnZetaChain,
  currentChainId,
  onSwitchToZeta,
  isSubmitting
}: NetworkSwitchSectionProps) {
  const zetaNetworkConfig = getNetworkConfig(SupportedChain.ZETA_TESTNET);

  if (isOnZetaChain) {
    return null;
  }

  return (
    <div className="space-y-4">
      <Alert className="border-yellow-200 bg-yellow-50">
        <AlertTriangle className="h-4 w-4 text-yellow-600" />
        <AlertDescription className="text-yellow-800">
          <div className="font-medium mb-2">Network Switch Required</div>
          <div className="text-sm mb-3">
            Borrowing requires you to be connected to ZetaChain. Please switch your wallet to ZetaChain to continue.
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onSwitchToZeta}
            disabled={isSubmitting}
            className="flex items-center gap-2"
          >
            <Network className="h-4 w-4" />
            Switch to {zetaNetworkConfig?.name || 'ZetaChain'}
          </Button>
        </AlertDescription>
      </Alert>

      <div className="p-3 bg-muted rounded-lg text-sm">
        <div className="flex justify-between">
          <span>Current Network:</span>
          <span className="font-medium">Chain ID {currentChainId}</span>
        </div>
        <div className="flex justify-between mt-1">
          <span>Required Network:</span>
          <span className="font-medium">{zetaNetworkConfig?.name || 'ZetaChain'}</span>
        </div>
      </div>
    </div>
  );
}