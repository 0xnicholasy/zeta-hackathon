import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { TokenNetworkIcon } from '../ui/token-network-icon';
import { FaArrowDown } from 'react-icons/fa';
import { SupportedChain } from '../../contracts/deployments';
import { getChainDisplayNameFromId } from '../../utils/chainUtils';
import type { UserAssetData } from './types';
import { BorrowDialog } from './BorrowDialog';
import { RepayDialog } from './RepayDialog';

interface BorrowCardProps {
    userAssets: UserAssetData[];
}

export function BorrowCard({ userAssets }: BorrowCardProps) {
    // Dialog state
    const [isBorrowDialogOpen, setIsBorrowDialogOpen] = useState(false);
    const [isRepayDialogOpen, setIsRepayDialogOpen] = useState(false);
    const [selectedAsset, setSelectedAsset] = useState<UserAssetData | null>(null);

    // Show borrowed assets from all supported foreign chains
    const borrowedAssets = userAssets.filter(asset => {
        return (asset.externalChainId === SupportedChain.ARBITRUM_SEPOLIA ||
            asset.externalChainId === SupportedChain.ETHEREUM_SEPOLIA) &&
            Number(asset.borrowedBalance) > 0;
    });

    // Show all assets available to borrow from all supported foreign chains, sorted by chain
    const availableForBorrow = userAssets
        .filter(asset => {
            return (asset.externalChainId === SupportedChain.ARBITRUM_SEPOLIA ||
                asset.externalChainId === SupportedChain.ETHEREUM_SEPOLIA) &&
                asset.isSupported;
        })
        .sort((a, b) => {
            // Sort by chain first, then by symbol
            if (a.externalChainId !== b.externalChainId) {
                return (a.externalChainId ?? 0) - (b.externalChainId ?? 0);
            }
            return a.unit.localeCompare(b.unit);
        });

    // Handle borrow click
    const handleBorrowClick = (asset: UserAssetData) => {
        setSelectedAsset(asset);
        setIsBorrowDialogOpen(true);
    };

    // Handle repay click
    const handleRepayClick = (asset: UserAssetData) => {
        setSelectedAsset(asset);
        setIsRepayDialogOpen(true);
    };

    // Handle dialog close
    const handleDialogClose = () => {
        setIsBorrowDialogOpen(false);
        setIsRepayDialogOpen(false);
        setSelectedAsset(null);
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                    <div className="w-6 h-6 bg-red-100 dark:bg-red-900 rounded-lg flex items-center justify-center">
                        <FaArrowDown className="text-red-600 dark:text-red-400 text-xs" />
                    </div>
                    Borrow
                </CardTitle>
                <CardDescription>
                    Your borrows and assets available to borrow from all supported chains
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Your Borrows */}
                <div>
                    <h3 className="text-base font-semibold mb-3 text-muted-foreground">Your Borrows</h3>
                    {borrowedAssets.length > 0 ? (
                        <div className="space-y-2">
                            {borrowedAssets.map((asset) => (
                                <div key={asset.address} className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                                    <div className="flex items-center space-x-3">
                                        <TokenNetworkIcon
                                            tokenSymbol={asset.unit}
                                            sourceChain={asset.sourceChain}
                                            size="sm"
                                            shadow="sm"
                                        />
                                        <div>
                                            <div className="font-medium text-sm">{asset.unit}</div>
                                            <div className="text-xs text-muted-foreground">
                                                {asset.borrowedUsdValue} • {getChainDisplayNameFromId(asset.externalChainId)}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-sm font-medium">{asset.formattedBorrowedBalance}</div>
                                        <Button
                                            variant="zeta-outline"
                                            size="sm"
                                            className="mt-1 h-7 text-xs"
                                            onClick={() => handleRepayClick(asset)}
                                        >
                                            Repay
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-4 text-muted-foreground border-2 border-dashed border-border-light dark:border-border-dark rounded-lg">
                            <p className="text-sm">No borrows yet</p>
                        </div>
                    )}
                </div>

                {/* Assets to Borrow */}
                <div>
                    <h3 className="text-base font-semibold mb-3 text-muted-foreground">Assets to Borrow</h3>
                    {availableForBorrow.length > 0 ? (
                        <div className="space-y-2">
                            {availableForBorrow.map((asset) => (
                                <div key={`${asset.address}-borrow`} className="flex items-center justify-between p-3 bg-background rounded-lg border border-border-light dark:border-border-dark hover:border-red-300 dark:hover:border-red-700 cursor-pointer transition-colors">
                                    <div className="flex items-center space-x-3">
                                        <TokenNetworkIcon
                                            tokenSymbol={asset.unit}
                                            sourceChain={asset.sourceChain}
                                            size="sm"
                                            shadow="sm"
                                        />
                                        <div>
                                            <div className="font-medium text-sm">{asset.unit}</div>
                                            <div className="text-xs text-muted-foreground">
                                                {asset.price} • To {getChainDisplayNameFromId(asset.externalChainId)}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-sm font-medium text-muted-foreground">Available</div>
                                        <Button
                                            variant="zeta-outline"
                                            size="sm"
                                            className="mt-1 h-7 text-xs"
                                            onClick={() => handleBorrowClick(asset)}
                                        >
                                            Borrow
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-4 text-muted-foreground border-2 border-dashed border-border-light dark:border-border-dark rounded-lg">
                            <p className="text-sm">No assets available to borrow</p>
                        </div>
                    )}
                </div>
            </CardContent>

            {/* Dialogs */}
            {selectedAsset && (
                <>
                    <BorrowDialog
                        isOpen={isBorrowDialogOpen}
                        onClose={handleDialogClose}
                        selectedAsset={selectedAsset}
                    />
                    <RepayDialog
                        isOpen={isRepayDialogOpen}
                        onClose={handleDialogClose}
                        selectedAsset={selectedAsset}
                    />
                </>
            )}
        </Card>
    );
}