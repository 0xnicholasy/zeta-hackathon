import { useChainId } from 'wagmi';
import { SupportedChain, isSupportedChain } from '../../contracts/deployments';
import { QuickActions } from './QuickActions';
import { AccountHealth } from './AccountHealth';
import { SupplyCard } from './SupplyCard';
import { BorrowCard } from './BorrowCard';
import { useDashboardData } from '../../hooks/useDashboardData';
import { NetworkSelector } from '../admin/NetworkSelector';

export function ConnectedState() {
    const walletChainId = useChainId();

    // Determine the selected chain directly from wallet chain ID
    // Default to Arbitrum Sepolia if wallet is on ZetaChain or unsupported chain
    const selectedChain = (walletChainId === SupportedChain.ARBITRUM_SEPOLIA || walletChainId === SupportedChain.ETHEREUM_SEPOLIA || walletChainId === SupportedChain.POLYGON_AMOY || walletChainId === SupportedChain.BASE_SEPOLIA || walletChainId === SupportedChain.BSC_TESTNET)
        ? walletChainId.toString()
        : SupportedChain.ARBITRUM_SEPOLIA.toString();

    // Get current chain info for display
    const getCurrentChainInfo = () => {
        switch (walletChainId) {
            case SupportedChain.ARBITRUM_SEPOLIA:
                return { name: 'Arbitrum Sepolia', icon: 'arbitrum-one' };
            case SupportedChain.ETHEREUM_SEPOLIA:
                return { name: 'Ethereum Sepolia', icon: 'ethereum' };
            case SupportedChain.ZETA_TESTNET:
                return { name: 'ZetaChain Testnet', icon: 'zeta-chain' };
            case SupportedChain.POLYGON_AMOY:
                return { name: 'Polygon Amoy', icon: 'polygon' };
            case SupportedChain.BASE_SEPOLIA:
                return { name: 'Base Sepolia', icon: 'base' };
            case SupportedChain.BSC_TESTNET:
                return { name: 'BSC Testnet', icon: 'bsc' };
            default:
                return { name: 'Unknown Network', icon: 'ethereum' };
        }
    };

    const currentChain = getCurrentChainInfo();

    const {
        userAssets,
        totalSupplied,
        totalBorrowed,
        healthFactor,
        externalBalances,
        isLoadingExternalBalances,
        refetchUserData,
    } = useDashboardData();

    return (
        <div>
            <div className="mb-8">
                <h1 className="text-4xl font-bold text-foreground mb-2">
                    ZetaLend Protocol
                </h1>
                <p className="text-muted-foreground">
                    Manage your cross-chain lending positions across Arbitrum, Ethereum, and ZetaChain.
                </p>
            </div>

            {/* Quick Actions */}
            <QuickActions />

            {/* Network Switcher */}
            <div className="mb-6">
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h2 className="text-2xl font-bold">Markets</h2>
                        <p className="text-muted-foreground">Lend and borrow assets on the selected chain</p>
                    </div>

                    {/* RainbowKit Network Selector */}
                    <NetworkSelector
                        currentChain={currentChain}
                    />
                </div>

                {/* Network Status Info */}
                {walletChainId && !isSupportedChain(walletChainId) && (
                    <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                        <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                        <span>
                            Your wallet is on an unsupported network. Click the network selector above to switch to a supported chain.
                        </span>
                    </div>
                )}

                {walletChainId === SupportedChain.ZETA_TESTNET && (
                    <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        <span>
                            You're connected to ZetaChain. Use the network selector above to switch to Arbitrum or Ethereum to access markets.
                        </span>
                    </div>
                )}
            </div>

            {/* Supply and Borrow Cards Side by Side */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                <SupplyCard
                    userAssets={userAssets}
                    selectedChain={selectedChain}
                    walletChainId={walletChainId}
                    externalBalances={externalBalances}
                    isLoadingExternalBalances={isLoadingExternalBalances}
                    refetchUserData={refetchUserData}
                />
                <BorrowCard
                    userAssets={userAssets}
                    refetchUserData={refetchUserData}
                />
            </div>
            {/* Account Health */}
            {walletChainId === SupportedChain.ZETA_TESTNET && (
                <AccountHealth
                    healthFactor={healthFactor}
                    totalSupplied={totalSupplied}
                    totalBorrowed={totalBorrowed}
                />
            )}
        </div>
    );
}