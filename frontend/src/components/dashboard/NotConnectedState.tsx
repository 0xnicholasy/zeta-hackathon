import { ConnectButton } from '@rainbow-me/rainbowkit';
import { FaWallet } from 'react-icons/fa';
import { NetworkIcon } from '@web3icons/react';

export function NotConnectedState() {
    return (
        <div className="text-center py-16">
            <div className="max-w-lg mx-auto">
                <div className="w-20 h-20 bg-gradient-to-br from-zeta-400 to-zeta-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
                    <FaWallet className="text-white text-3xl" />
                </div>
                <h2 className="text-3xl font-bold text-foreground mb-4">
                    Connect Your Wallet
                </h2>
                <p className="text-muted-foreground mb-8 text-lg">
                    Connect your wallet to start lending and borrowing assets across multiple chains including Arbitrum, Ethereum, and ZetaChain.
                </p>

                {/* Supported Wallets Preview */}
                <div className="flex justify-center space-x-4 mb-8">
                    <div className="flex items-center space-x-2 bg-surface-light dark:bg-surface-dark px-4 py-2 rounded-lg border border-border-light dark:border-border-dark">
                        <NetworkIcon name="metamask" className="w-6 h-6" />
                        <span className="text-sm text-muted-foreground">MetaMask</span>
                    </div>
                    <div className="flex items-center space-x-2 bg-surface-light dark:bg-surface-dark px-4 py-2 rounded-lg border border-border-light dark:border-border-dark">
                        <NetworkIcon name="walletconnect" className="w-6 h-6" />
                        <span className="text-sm text-muted-foreground">WalletConnect</span>
                    </div>
                    <div className="flex items-center space-x-2 bg-surface-light dark:bg-surface-dark px-4 py-2 rounded-lg border border-border-light dark:border-border-dark">
                        <NetworkIcon name="coinbase-wallet" className="w-6 h-6" />
                        <span className="text-sm text-muted-foreground">Coinbase</span>
                    </div>
                </div>

                {/* Supported Chains */}
                <div className="grid grid-cols-3 gap-4 mb-8">
                    <div className="bg-surface-light dark:bg-surface-dark p-4 rounded-lg border border-border-light dark:border-border-dark">
                        <NetworkIcon name="arbitrum-one" className="w-8 h-8 mx-auto mb-2" />
                        <div className="text-sm font-medium text-foreground">Arbitrum</div>
                        <div className="text-xs text-muted-foreground">ETH, USDC</div>
                    </div>
                    <div className="bg-surface-light dark:bg-surface-dark p-4 rounded-lg border border-border-light dark:border-border-dark">
                        <NetworkIcon name="ethereum" className="w-8 h-8 mx-auto mb-2" />
                        <div className="text-sm font-medium text-foreground">Ethereum</div>
                        <div className="text-xs text-muted-foreground">ETH, USDC</div>
                    </div>
                    <div className="bg-surface-light dark:bg-surface-dark p-4 rounded-lg border border-border-light dark:border-border-dark">
                        <NetworkIcon name="zeta-chain" className="w-8 h-8 mx-auto mb-2" />
                        <div className="text-sm font-medium text-foreground">ZetaChain</div>
                        <div className="text-xs text-muted-foreground">Universal EVM</div>
                    </div>
                </div>

                <ConnectButton />
            </div>
        </div>
    );
}