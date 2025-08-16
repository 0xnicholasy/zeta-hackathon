import { FaWallet } from 'react-icons/fa';
import { NetworkIcon, NetworkSolana, TokenUSDC } from '@web3icons/react';
import { SolanaWalletButton } from '../../wallet/SolanaWalletButton';
import { useWallet } from '@solana/wallet-adapter-react';

export function SolanaNotConnectedState() {
  const { wallets } = useWallet();

  // Check if no wallets are available at all
  const hasWallets = wallets && wallets.length > 0;

  if (!hasWallets) {
    return (
      <div className="text-center py-16">
        <div className="max-w-lg mx-auto">
          <div className="w-20 h-20 bg-gradient-to-br from-purple-400 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
            <FaWallet className="text-white text-3xl" />
          </div>
          <h2 className="text-3xl font-bold text-foreground mb-4">
            Solana Wallet Required
          </h2>
          <p className="text-muted-foreground mb-8 text-lg">
            To supply Solana tokens to ZetaChain's Universal Lending Protocol, you need to install a compatible Solana wallet.
          </p>

          <div className="flex flex-col gap-4 mb-8">
            <button
              onClick={() => window.open('https://phantom.app/', '_blank')}
              className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              Install Phantom Wallet
            </button>
            <button
              onClick={() => window.open('https://solflare.com/', '_blank')}
              className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              Install Solflare Wallet
            </button>
          </div>

          {/* Supported Tokens */}
          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="bg-surface-light dark:bg-surface-dark p-4 rounded-lg border border-border-light dark:border-border-dark">
              <NetworkIcon name="solana" className="w-8 h-8 mx-auto" />
              <div className="text-sm font-medium text-foreground">SOL</div>
              <div className="text-xs text-muted-foreground">Native Solana</div>
            </div>
            <div className="bg-surface-light dark:bg-surface-dark p-4 rounded-lg border border-border-light dark:border-border-dark">
              <TokenUSDC className="w-8 h-8 mx-auto" />
              <div className="text-sm font-medium text-foreground">USDC</div>
              <div className="text-xs text-muted-foreground">SPL Token</div>
            </div>
          </div>

          <div className="text-sm text-muted-foreground">
            Cross-chain supply to ZetaChain Universal EVM
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="text-center py-16">
      <div className="max-w-lg mx-auto">
        <div className="w-20 h-20 bg-gradient-to-br from-purple-400 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
          <FaWallet className="text-white text-3xl" />
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-4">
          Connect Your Solana Wallet
        </h2>
        <p className="text-muted-foreground mb-8 text-lg">
          Connect your Solana wallet to supply SOL and USDC tokens to ZetaChain's Universal Lending Protocol.
        </p>

        {/* Wallet Connect Button */}
        <div className="flex justify-center mb-8">
          <SolanaWalletButton />
        </div>

        {/* Supported Tokens */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-surface-light dark:bg-surface-dark p-4 rounded-lg border border-border-light dark:border-border-dark">
            <NetworkSolana className="w-8 h-8 mx-auto" />
            <div className="text-sm font-medium text-foreground">SOL</div>
            <div className="text-xs text-muted-foreground">Native Solana</div>
          </div>
          <div className="bg-surface-light dark:bg-surface-dark p-4 rounded-lg border border-border-light dark:border-border-dark">
            <TokenUSDC className="w-8 h-8 mx-auto" />
            <div className="text-sm font-medium text-foreground">USDC</div>
            <div className="text-xs text-muted-foreground">SPL Token</div>
          </div>
        </div>
      </div>
    </div>
  );
}