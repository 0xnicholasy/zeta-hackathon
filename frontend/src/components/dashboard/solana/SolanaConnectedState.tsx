import { SolanaSupplyCard } from './SolanaSupplyCard';
import { type SolanaToken } from './SolanaSupplyDialog';

interface SolanaConnectedStateProps {
  isPhantomConnected: boolean;
  phantomPublicKey: string | null;
  onConnectPhantom: () => Promise<void>;
  onSupply: (token: SolanaToken, amount: number, evmAddress: string) => Promise<string>;
  solanaTokens: SolanaToken[];
  isLoadingTokens: boolean;
}

export function SolanaConnectedState({
  isPhantomConnected,
  phantomPublicKey,
  onConnectPhantom,
  onSupply,
  solanaTokens,
  isLoadingTokens
}: SolanaConnectedStateProps) {
  return (
    <div className="space-y-8">
      {/* Supply Section */}
      <div className="grid grid-cols-1 gap-6">
        <SolanaSupplyCard
          isPhantomConnected={isPhantomConnected}
          phantomPublicKey={phantomPublicKey}
          onConnectPhantom={onConnectPhantom}
          onSupply={onSupply}
          solanaTokens={solanaTokens}
          isLoadingTokens={isLoadingTokens}
        />
      </div>

      {/* Instructions Card */}
      <div className="bg-gradient-to-br from-zeta-50 to-zeta-100 dark:from-zeta-900/20 dark:to-zeta-800/20 p-6 rounded-xl border border-zeta-200 dark:border-zeta-800">
        <h3 className="text-lg font-semibold mb-4 text-zeta-900 dark:text-zeta-100">How Cross-Chain Supply Works</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-zeta-500 text-white rounded-full flex items-center justify-center text-xs font-bold">1</div>
              <div>
                <div className="font-medium text-zeta-900 dark:text-zeta-100">Connect Phantom Wallet</div>
                <div className="text-sm text-zeta-600 dark:text-zeta-400">Ensure you have SOL or USDC in your wallet</div>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-zeta-500 text-white rounded-full flex items-center justify-center text-xs font-bold">2</div>
              <div>
                <div className="font-medium text-zeta-900 dark:text-zeta-100">Select Token & Amount</div>
                <div className="text-sm text-zeta-600 dark:text-zeta-400">Choose the asset and amount to supply</div>
              </div>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-zeta-500 text-white rounded-full flex items-center justify-center text-xs font-bold">3</div>
              <div>
                <div className="font-medium text-zeta-900 dark:text-zeta-100">Enter ZetaChain Address</div>
                <div className="text-sm text-zeta-600 dark:text-zeta-400">Provide your EVM address on ZetaChain</div>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-zeta-500 text-white rounded-full flex items-center justify-center text-xs font-bold">4</div>
              <div>
                <div className="font-medium text-zeta-900 dark:text-zeta-100">Confirm Transaction</div>
                <div className="text-sm text-zeta-600 dark:text-zeta-400">Assets are bridged and supplied automatically</div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
          <div className="flex items-start space-x-2">
            <div className="text-yellow-500 mt-0.5">⚠️</div>
            <div>
              <div className="font-medium text-yellow-800 dark:text-yellow-200 text-sm">Important Security Notice</div>
              <div className="text-yellow-700 dark:text-yellow-300 text-sm mt-1">
                Double-check your ZetaChain EVM address before confirming. Incorrect addresses may result in permanent loss of funds.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}