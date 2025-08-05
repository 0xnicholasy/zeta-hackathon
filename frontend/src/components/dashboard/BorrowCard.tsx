import { useState, useEffect } from 'react';
import { useChainId } from 'wagmi';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { TokenNetworkIcon } from '../ui/token-network-icon';
import { FaArrowDown } from 'react-icons/fa';
import { getChainDisplayNameFromId } from '../../utils/chainUtils';
import type { UserAssetData } from './types';
import { EVMAddress } from '@/types/address';
import { BorrowDialog } from './BorrowDialog';
import { RepayDialog } from './RepayDialog';
import { ZetaBorrowDialog } from './ZetaBorrowDialog';
import { ZetaRepayDialog } from './ZetaRepayDialog';
import { getBorrowableAssets, type BorrowableAssetData } from '../../utils/directContractCalls';
import { SupportedChain } from '../../contracts/deployments';

interface BorrowCardProps {
    userAssets: UserAssetData[];
    refetchUserData?: () => Promise<void>;
}

export function BorrowCard({ userAssets, refetchUserData }: BorrowCardProps) {
    // Wallet chain detection
    const walletChainId = useChainId();
    const isOnZetaChain = walletChainId === SupportedChain.ZETA_TESTNET;

    // Dialog state
    const [isBorrowDialogOpen, setIsBorrowDialogOpen] = useState(false);
    const [isRepayDialogOpen, setIsRepayDialogOpen] = useState(false);
    const [selectedAsset, setSelectedAsset] = useState<UserAssetData | null>(null);

    // Zeta dialog states
    const [isZetaBorrowDialogOpen, setIsZetaBorrowDialogOpen] = useState(false);
    const [selectedAssetForZetaBorrow, setSelectedAssetForZetaBorrow] = useState<UserAssetData | null>(null);
    const [isZetaRepayDialogOpen, setIsZetaRepayDialogOpen] = useState(false);
    const [selectedAssetForZetaRepay, setSelectedAssetForZetaRepay] = useState<UserAssetData | null>(null);

    // State for borrowable assets - fetched directly from protocol
    const [borrowableAssets, setBorrowableAssets] = useState<BorrowableAssetData[]>([]);
    const [loadingBorrowable, setLoadingBorrowable] = useState(true);

    // Show all borrowed assets across all supported chains (from user's actual borrows)
    const borrowedAssets = userAssets.filter(asset => {
        return Number(asset.borrowedBalance) > 0;
    });

    // Fetch borrowable assets from protocol directly (independent of wallet network)
    useEffect(() => {
        const fetchBorrowableAssets = async () => {
            try {
                if (borrowableAssets.length === 0) {
                    setLoadingBorrowable(true);
                }
                const assets = await getBorrowableAssets();
                assets.sort((_a, b) => b.isAvailableToBorrow ? 1 : -1);
                assets.filter(asset => asset.isAvailableToBorrow);
                setBorrowableAssets(assets);
            } catch (error) {
                // eslint-disable-next-line no-console
                console.error('Error fetching borrowable assets:', error);
            } finally {
                setLoadingBorrowable(false);
            }
        };

        void fetchBorrowableAssets();

        // Refresh borrowable assets every 30 seconds
        const interval = setInterval(() => {
            void fetchBorrowableAssets();
        }, 30000);

        return () => clearInterval(interval);
    }, [borrowableAssets.length]);

    // Handle borrow click for borrowable assets
    const handleBorrowClick = (asset: BorrowableAssetData) => {
        if (asset.isAvailableToBorrow) {
            // Convert BorrowableAssetData to UserAssetData format for the dialog
            const userAssetData: UserAssetData = {
                address: asset.address as EVMAddress,
                symbol: asset.symbol,
                unit: asset.unit,
                sourceChain: asset.sourceChain,
                decimals: asset.decimals,
                borrowedBalance: '0',
                formattedBorrowedBalance: '0',
                borrowedUsdValue: '$0',
                suppliedBalance: '0',
                formattedSuppliedBalance: '0',
                suppliedUsdValue: '$0',
                price: asset.price,
                isSupported: asset.isSupported,
                externalChainId: asset.externalChainId,
            };
            setSelectedAsset(userAssetData);
            setIsBorrowDialogOpen(true);
        }
    };

    // Handle repay click for borrowed assets
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

    // Zeta-specific handlers
    const handleZetaBorrowClick = (asset: BorrowableAssetData) => {
        if (asset.isAvailableToBorrow) {
            // Convert BorrowableAssetData to UserAssetData format for the dialog
            const userAssetData: UserAssetData = {
                address: asset.address as EVMAddress,
                symbol: asset.symbol,
                unit: asset.unit,
                sourceChain: asset.sourceChain,
                decimals: asset.decimals,
                borrowedBalance: '0',
                formattedBorrowedBalance: '0',
                borrowedUsdValue: '$0',
                suppliedBalance: '0',
                formattedSuppliedBalance: '0',
                suppliedUsdValue: '$0',
                price: asset.price,
                isSupported: asset.isSupported,
                externalChainId: asset.externalChainId,
            };
            setSelectedAssetForZetaBorrow(userAssetData);
            setIsZetaBorrowDialogOpen(true);
        }
    };

    const handleZetaRepayClick = (asset: UserAssetData) => {
        setSelectedAssetForZetaRepay(asset);
        setIsZetaRepayDialogOpen(true);
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
                    Your borrows and all assets available to borrow (displayed for all supported chains regardless of wallet network)
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
                                        {isOnZetaChain ? (
                                            <div className="flex gap-1 mt-1">
                                                <Button
                                                    variant="zeta-outline"
                                                    size="sm"
                                                    className="h-7 text-xs"
                                                    onClick={() => handleZetaRepayClick(asset)}
                                                >
                                                    Zeta Repay
                                                </Button>
                                                <Button
                                                    variant="zeta-outline"
                                                    size="sm"
                                                    className="h-7 text-xs"
                                                    onClick={() => handleRepayClick(asset)}
                                                >
                                                    Repay
                                                </Button>
                                            </div>
                                        ) : (
                                            <Button
                                                variant="zeta-outline"
                                                size="sm"
                                                className="mt-1 h-7 text-xs"
                                                onClick={() => handleRepayClick(asset)}
                                            >
                                                Repay
                                            </Button>
                                        )}
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
                    {loadingBorrowable ? (
                        <div className="space-y-2">
                            {/* Loading skeleton */}
                            {Array.from({ length: 10 }, (_, i) => (
                                <div key={i} className="flex items-center justify-between p-3 bg-background rounded-lg border border-border-light dark:border-border-dark">
                                    <div className="flex items-center space-x-3">
                                        <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse"></div>
                                        <div>
                                            <div className="w-12 h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-1"></div>
                                            <div className="w-16 h-3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="w-20 h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-1"></div>
                                        <div className="w-16 h-7 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : borrowableAssets.length > 0 ? (
                        <div className="space-y-2">
                            {borrowableAssets.map((asset) => (
                                <div key={`${asset.address}-borrow`} className={`flex items-center justify-between p-3 bg-background rounded-lg border transition-colors ${asset.isAvailableToBorrow
                                    ? 'border-border-light dark:border-border-dark hover:border-zeta-accent-light dark:hover:border-zeta-accent-dark cursor-pointer'
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
                                            {asset.isAvailableToBorrow
                                                ? `${asset.formattedMaxAvailable} available`
                                                : 'No tokens available'
                                            }
                                        </div>
                                        {isOnZetaChain && asset.isAvailableToBorrow ? (
                                            <div className="flex gap-1 mt-1">
                                                <Button
                                                    variant='outline'
                                                    size="sm"
                                                    className="h-7 text-xs"
                                                    onClick={() => handleZetaBorrowClick(asset)}
                                                >
                                                    Zeta Borrow
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant='zeta'
                                                    className="h-7 text-xs"
                                                    onClick={() => handleBorrowClick(asset)}
                                                >
                                                    Borrow
                                                </Button>
                                            </div>
                                        ) : (
                                            <Button
                                                size="sm"
                                                className="mt-1 h-7 text-xs"
                                                disabled={!asset.isAvailableToBorrow}
                                                onClick={() => handleBorrowClick(asset)}
                                            >
                                                Borrow
                                            </Button>
                                        )}
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
            {
                selectedAsset && (
                    <>
                        <BorrowDialog
                            isOpen={isBorrowDialogOpen}
                            onClose={handleDialogClose}
                            selectedAsset={selectedAsset}
                            {...(refetchUserData && { refetchUserData })}
                        />
                        <RepayDialog
                            isOpen={isRepayDialogOpen}
                            onClose={handleDialogClose}
                            selectedAsset={selectedAsset}
                            {...(refetchUserData && { refetchUserData })}
                        />
                    </>
                )
            }

            {selectedAssetForZetaBorrow && (
                <ZetaBorrowDialog
                    isOpen={isZetaBorrowDialogOpen}
                    onClose={() => setIsZetaBorrowDialogOpen(false)}
                    selectedAsset={selectedAssetForZetaBorrow}
                    {...(refetchUserData && { refetchUserData })}
                />
            )}

            {selectedAssetForZetaRepay && (
                <ZetaRepayDialog
                    isOpen={isZetaRepayDialogOpen}
                    onClose={() => setIsZetaRepayDialogOpen(false)}
                    selectedAsset={selectedAssetForZetaRepay}
                    {...(refetchUserData && { refetchUserData })}
                />
            )}
        </Card >
    );
}