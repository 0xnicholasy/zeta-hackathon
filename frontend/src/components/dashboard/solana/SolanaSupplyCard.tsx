import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { TokenNetworkIcon } from '../../ui/token-network-icon';
import { Spinner } from '../../ui/spinner';
import { FaPlus } from 'react-icons/fa';
import { SolanaSupplyDialog, type SolanaToken } from './SolanaSupplyDialog';
import { Alert, AlertDescription } from '../../ui/alert';
import { FaExclamationTriangle } from 'react-icons/fa';

interface SolanaSupplyCardProps {
  isPhantomConnected: boolean;
  phantomPublicKey: string | null;
  onConnectPhantom: () => Promise<void>;
  onSupply: (token: SolanaToken, amount: number, evmAddress: string) => Promise<string>;
  solanaTokens: SolanaToken[];
  isLoadingTokens: boolean;
}

export function SolanaSupplyCard({
  isPhantomConnected,
  phantomPublicKey,
  onConnectPhantom,
  onSupply,
  solanaTokens,
  isLoadingTokens
}: SolanaSupplyCardProps) {
  const [isSupplyDialogOpen, setIsSupplyDialogOpen] = useState(false);
  const [selectedToken, setSelectedToken] = useState<SolanaToken | null>(null);

  const handleSupplyClick = (token: SolanaToken) => {
    setSelectedToken(token);
    setIsSupplyDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsSupplyDialogOpen(false);
    setSelectedToken(null);
  };

  // Show all tokens, even with 0 balance for better UX
  const availableTokens = solanaTokens;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <div className="w-6 h-6 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center">
            <FaPlus className="text-purple-600 dark:text-purple-400 text-xs" />
          </div>
          Supply from Solana
        </CardTitle>
        <CardDescription>
          Supply SOL and USDC from Solana to ZetaChain lending protocol
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Phantom Wallet Connection */}
        {!isPhantomConnected ? (
          <div className="space-y-4">
            <Alert className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20">
              <FaExclamationTriangle className="h-4 w-4" />
              <AlertDescription>
                Connect your Phantom wallet to supply Solana tokens to the lending protocol.
              </AlertDescription>
            </Alert>
            <Button
              onClick={onConnectPhantom}
              className="w-full"
              variant="zeta"
            >
              Connect Phantom Wallet
            </Button>
          </div>
        ) : (
          <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
            <div className="text-sm font-medium text-green-800 dark:text-green-200">
              Phantom Wallet Connected
            </div>
            <div className="text-xs text-green-600 dark:text-green-400 mt-1 break-all">
              {phantomPublicKey}
            </div>
          </div>
        )}

        {/* Available Tokens */}
        {isPhantomConnected && (
          <div>
            <h3 className="text-base font-semibold mb-3 text-muted-foreground">
              Available Assets to Supply
            </h3>
            {isLoadingTokens ? (
              <div className="text-center py-4">
                <Spinner variant="zeta" size="sm" text="Loading Solana assets..." textPosition="bottom" />
              </div>
            ) : availableTokens.length > 0 ? (
              <div className="space-y-2">
                {availableTokens.map((token) => (
                  <div
                    key={token.symbol}
                    className="flex items-center justify-between p-3 bg-background rounded-lg border border-border-light dark:border-border-dark hover:border-purple-300 dark:hover:border-purple-700 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center space-x-3">
                      <TokenNetworkIcon
                        tokenSymbol={token.symbol}
                        sourceChain="SOL"
                        size="sm"
                        shadow="sm"
                        isNative={token.isNative ?? false}
                        showNativeIndicator={true}
                      />
                      <div>
                        <div className="font-medium text-sm">{token.symbol}</div>
                        <div className="text-xs text-purple-600 dark:text-purple-400">
                          {token.name}
                        </div>
                        {token.isNative && (
                          <div className="text-xs text-green-600 dark:text-green-400">Native</div>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium">
                        {token.balance.toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 6
                        })}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {token.symbol === 'SOL' ? 'Solana Native' : 'SPL Token'}
                      </div>
                      <Button
                        variant="zeta"
                        size="sm"
                        className="mt-1 h-7 text-xs"
                        onClick={() => handleSupplyClick(token)}
                        disabled={token.balance === 0}
                      >
                        Supply
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4 text-muted-foreground border-2 border-dashed border-border-light dark:border-border-dark rounded-lg">
                <p className="text-sm">No assets available to supply</p>
                <p className="text-xs mt-1">
                  Make sure you have SOL or USDC in your Phantom wallet
                </p>
              </div>
            )}
          </div>
        )}

        {/* Cross-chain Information */}
        {isPhantomConnected && (
          <div className="p-3 bg-muted rounded-lg text-sm">
            <div className="font-medium mb-2">Cross-chain Supply Process:</div>
            <ol className="text-xs space-y-1 text-muted-foreground">
              <li>1. Select asset and amount to supply</li>
              <li>2. Enter your ZetaChain EVM address</li>
              <li>3. Confirm transaction in Phantom wallet</li>
              <li>4. Assets are bridged to ZetaChain and supplied to the lending protocol</li>
            </ol>
          </div>
        )}
      </CardContent>

      <SolanaSupplyDialog
        isOpen={isSupplyDialogOpen}
        onClose={handleCloseDialog}
        selectedToken={selectedToken}
        isPhantomConnected={isPhantomConnected}
        phantomPublicKey={phantomPublicKey}
        onSupply={onSupply}
      />
    </Card>
  );
}