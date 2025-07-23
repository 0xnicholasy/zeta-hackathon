import { useState } from 'react';
import { useReadContracts } from 'wagmi';
import { formatUnits } from 'viem';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { TokenNetworkIcon } from '../ui/token-network-icon';
import { FaArrowDown } from 'react-icons/fa';
import { SupportedChain } from '../../contracts/deployments';
import { getChainDisplayNameFromId } from '../../utils/chainUtils';
import { useContracts } from '../../hooks/useContracts';
import { SimpleLendingProtocol__factory } from '@/contracts/typechain-types';
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

    // Get contract instance
    const { simpleLendingProtocol } = useContracts(SupportedChain.ZETA_TESTNET);

    // Show all borrowed assets across all supported chains
    const borrowedAssets = userAssets.filter(asset => {
        return Number(asset.borrowedBalance) > 0;
    });

    // Show all assets available to borrow from all supported chains, sorted by chain
    const availableForBorrow = userAssets
        .filter(asset => {
            return asset.isSupported && asset.externalChainId !== undefined;
        })
        .sort((a, b) => {
            // Sort by chain first, then by symbol
            if (a.externalChainId !== b.externalChainId) {
                return (a.externalChainId ?? 0) - (b.externalChainId ?? 0);
            }
            return a.unit.localeCompare(b.unit);
        });

    // Check available amounts for each asset in the protocol
    const { data: availableAmounts } = useReadContracts({
        contracts: simpleLendingProtocol && availableForBorrow.length > 0
            ? availableForBorrow.map((asset) => ({
                address: simpleLendingProtocol,
                abi: SimpleLendingProtocol__factory.abi,
                functionName: 'maxAvailableAmount',
                args: [asset.address],
                chainId: SupportedChain.ZETA_TESTNET, // Add this line
            }))
            : [],
        query: {
            enabled: Boolean(simpleLendingProtocol) && availableForBorrow.length > 0,
            refetchInterval: 10000,
        },
    });

    // Create a map of asset availability
    const assetAvailability = new Map<string, { available: string; isAvailable: boolean }>();

    if (availableAmounts) {
        availableForBorrow.forEach((asset, index) => {
            const result = availableAmounts[index];
            if (result?.status === 'success' && result.result !== undefined) {
                const availableAmount = result.result as bigint;
                const formattedAmount = formatUnits(availableAmount, asset.decimals);
                const isAvailable = availableAmount > BigInt(0);

                assetAvailability.set(asset.address, {
                    available: formattedAmount,
                    isAvailable
                });
            } else {
                // Default to unavailable if we can't determine
                assetAvailability.set(asset.address, {
                    available: '0',
                    isAvailable: false
                });
            }
        });
    }

    // Handle borrow click
    const handleBorrowClick = (asset: UserAssetData) => {
        const availability = assetAvailability.get(asset.address);
        if (availability?.isAvailable) {
            setSelectedAsset(asset);
            setIsBorrowDialogOpen(true);
        }
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
                            {availableForBorrow.map((asset) => {
                                const availability = assetAvailability.get(asset.address);
                                const isAvailable = availability?.isAvailable ?? false;
                                const availableAmount = availability?.available ?? '0';

                                return (
                                    <div key={`${asset.address}-borrow`} className={`flex items-center justify-between p-3 bg-background rounded-lg border transition-colors ${isAvailable
                                        ? 'border-border-light dark:border-border-dark hover:border-red-300 dark:hover:border-red-700 cursor-pointer'
                                        : 'border-muted-foreground/20 opacity-60'
                                        }`}>
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
                                            <div className="text-sm font-medium text-muted-foreground">
                                                {isAvailable
                                                    ? `${Number(availableAmount).toLocaleString('en-US', { maximumFractionDigits: 6 })} available`
                                                    : 'No tokens available'
                                                }
                                            </div>
                                            <Button
                                                size="sm"
                                                className="mt-1 h-7 text-xs"
                                                disabled={!isAvailable}
                                                onClick={() => handleBorrowClick(asset)}
                                            >
                                                Borrow
                                            </Button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="text-center py-4 text-muted-foreground border-2 border-dashed border-border-light dark:border-border-dark rounded-lg">
                            <p className="text-sm">No assets available to borrow</p>
                        </div>
                    )}
                </div>
            </CardContent>

            {/* Dialogs */}
            {
                selectedAsset && (
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
                )
            }
        </Card >
    );
}