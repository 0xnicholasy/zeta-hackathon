import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { TokenNetworkIcon } from '../ui/token-network-icon';
import { Spinner } from '../ui/spinner';
import { FaPlus } from 'react-icons/fa';
import { isSupportedChain, SupportedChain } from '../../contracts/deployments';
import { SupplyDialog } from './SupplyDialog';
import { WithdrawDialog } from './WithdrawDialog';
import type { UserAssetData } from './types';
import type { TokenBalance } from '../../hooks/useMultiChainBalances';

interface SupplyCardProps {
    userAssets: UserAssetData[];
    selectedChain: string;
    walletChainId?: number;
    externalBalances: Record<number, Record<string, TokenBalance>>;
    isLoadingExternalBalances: boolean;
}

export function SupplyCard({ userAssets, selectedChain, walletChainId, externalBalances, isLoadingExternalBalances }: SupplyCardProps) {
    const chainId = parseInt(selectedChain);
    if (!isSupportedChain(chainId)) {
        throw new Error(`Invalid chain ID: ${chainId}`);
    }
    const [isSupplyDialogOpen, setIsSupplyDialogOpen] = useState(false);
    const [selectedToken, setSelectedToken] = useState<TokenBalance | null>(null);
    const [isWithdrawDialogOpen, setIsWithdrawDialogOpen] = useState(false);
    const [selectedAssetForWithdraw, setSelectedAssetForWithdraw] = useState<UserAssetData | null>(null);

    // Check if we're on ZetaChain
    const isOnZetaChain = walletChainId === SupportedChain.ZETA_TESTNET;

    // Filter supplied assets based on network
    const suppliedAssets = userAssets.filter(asset => {
        if (isOnZetaChain) {
            // On ZetaChain: show all supplied assets regardless of chain
            return Number(asset.suppliedBalance) > 0;
        } else {
            // On other chains: filter by selected chain
            const chainId = selectedChain === SupportedChain.ARBITRUM_SEPOLIA.toString() ?
                SupportedChain.ARBITRUM_SEPOLIA : SupportedChain.ETHEREUM_SEPOLIA;
            return asset.externalChainId === chainId && Number(asset.suppliedBalance) > 0;
        }
    });

    const chainBalances = externalBalances[parseInt(selectedChain)];
    const availableAssets: [string, TokenBalance][] = chainBalances ? Object.entries(chainBalances).map(([key, value]) => [key, value as TokenBalance]) : [];

    const handleSupplyClick = (balance: TokenBalance) => {
        setSelectedToken(balance);
        setIsSupplyDialogOpen(true);
    };

    const handleWithdrawClick = (asset: UserAssetData) => {
        setSelectedAssetForWithdraw(asset);
        setIsWithdrawDialogOpen(true);
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                    <div className="w-6 h-6 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center">
                        <FaPlus className="text-green-600 dark:text-green-400 text-xs" />
                    </div>
                    Supply
                </CardTitle>
                <CardDescription>
                    Your supplies and assets available to supply
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Your Supplies - Show on ZetaChain or when user has supplied assets on other chains */}
                {(isOnZetaChain || (!isOnZetaChain && suppliedAssets.length > 0)) && (
                    <div>
                        <h3 className="text-base font-semibold mb-3 text-muted-foreground">
                            {isOnZetaChain ? 'All Your Supplies' : 'Your Supplies'}
                        </h3>
                        {suppliedAssets.length > 0 ? (
                            <div className="space-y-2">
                                {suppliedAssets.map((asset) => (
                                    <div key={asset.address} className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                                        <div className="flex items-center space-x-3">
                                            <TokenNetworkIcon
                                                tokenSymbol={asset.unit}
                                                sourceChain={asset.sourceChain}
                                                size="sm"
                                                shadow="sm"
                                            />
                                            <div>
                                                <div className="font-medium text-sm">{asset.unit}</div>
                                                <div className="text-xs text-muted-foreground">{asset.suppliedUsdValue}</div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-sm font-medium">{asset.formattedSuppliedBalance}</div>
                                            <Button
                                                variant="zeta-outline"
                                                size="sm"
                                                className="mt-1 h-7 text-xs"
                                                onClick={() => handleWithdrawClick(asset)}
                                            >
                                                Withdraw
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-4 text-muted-foreground border-2 border-dashed border-border-light dark:border-border-dark rounded-lg">
                                <p className="text-sm">No assets supplied yet</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Assets to Supply - Show only on non-ZetaChain networks */}
                {!isOnZetaChain && (
                    <div>
                        <h3 className="text-base font-semibold mb-3 text-muted-foreground">Assets to Supply</h3>
                        {availableAssets.length > 0 ? (
                            <div className="space-y-2">
                                {availableAssets.map(([tokenSymbol, balance]) => {
                                    const { isNative, formattedBalance, chainName } = balance;
                                    return (
                                        <div key={`${selectedChain}-${tokenSymbol}-supply`} className="flex items-center justify-between p-3 bg-background rounded-lg border border-border-light dark:border-border-dark hover:border-green-300 dark:hover:border-green-700 cursor-pointer transition-colors">
                                            <div className="flex items-center space-x-3">
                                                <TokenNetworkIcon
                                                    tokenSymbol={tokenSymbol}
                                                    sourceChain={chainName}
                                                    size="sm"
                                                    shadow="sm"
                                                    isNative={isNative}
                                                    showNativeIndicator={true}
                                                />
                                                <div>
                                                    <div className="font-medium text-sm">{tokenSymbol}</div>
                                                    {isNative && (
                                                        <div className="text-xs text-green-600 dark:text-green-400">Native</div>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-sm font-medium">{Number(formattedBalance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })}</div>
                                                <Button
                                                    variant="zeta"
                                                    size="sm"
                                                    className="mt-1 h-7 text-xs"
                                                    onClick={() => handleSupplyClick(balance)}
                                                >
                                                    Supply
                                                </Button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="text-center py-4 text-muted-foreground border-2 border-dashed border-border-light dark:border-border-dark rounded-lg">
                                {isLoadingExternalBalances ? (
                                    <Spinner variant="zeta" size="sm" text="Loading assets..." textPosition="bottom" />
                                ) : (
                                    <p className="text-sm">No assets available</p>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </CardContent>

            <SupplyDialog
                isOpen={isSupplyDialogOpen}
                onClose={() => setIsSupplyDialogOpen(false)}
                selectedToken={selectedToken}
                chainId={chainId}
            />

            {selectedAssetForWithdraw && <WithdrawDialog
                isOpen={isWithdrawDialogOpen}
                onClose={() => setIsWithdrawDialogOpen(false)}
                selectedAsset={selectedAssetForWithdraw}
            />}
        </Card>
    );
}