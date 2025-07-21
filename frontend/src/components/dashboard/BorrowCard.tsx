import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { TokenNetworkIcon } from '../ui/token-network-icon';
import { FaArrowDown } from 'react-icons/fa';
import { SupportedChain } from '../../contracts/deployments';
import type { UserAssetData } from './types';

interface BorrowCardProps {
    userAssets: UserAssetData[];
    selectedChain: string;
}

export function BorrowCard({ userAssets, selectedChain }: BorrowCardProps) {
    const borrowedAssets = userAssets.filter(asset => {
        const chainId = selectedChain === SupportedChain.ARBITRUM_SEPOLIA.toString() ?
            SupportedChain.ARBITRUM_SEPOLIA : SupportedChain.ETHEREUM_SEPOLIA;
        return asset.externalChainId === chainId && Number(asset.borrowedBalance) > 0;
    });

    const chainId = selectedChain === SupportedChain.ARBITRUM_SEPOLIA.toString() ?
        SupportedChain.ARBITRUM_SEPOLIA : SupportedChain.ETHEREUM_SEPOLIA;
    const availableForBorrow = userAssets.filter(asset => {
        return asset.externalChainId === chainId && asset.isSupported;
    });

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
                    Your borrows and assets available to borrow
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
                                            <div className="text-xs text-muted-foreground">{asset.borrowedUsdValue}</div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-sm font-medium">{asset.formattedBorrowedBalance}</div>
                                        <Button variant="zeta-outline" size="sm" className="mt-1 h-7 text-xs">
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
                                            <div className="text-xs text-muted-foreground">{asset.price}</div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-sm font-medium text-muted-foreground">Available</div>
                                        <Button variant="zeta-outline" size="sm" className="mt-1 h-7 text-xs">
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
        </Card>
    );
}