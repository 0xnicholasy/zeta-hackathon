import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { TokenNetworkIcon } from '../ui/token-network-icon';
import type { UserAssetData } from './types';

interface PortfolioOverviewProps {
    userAssets: UserAssetData[];
    totalSupplied: string;
    totalBorrowed: string;
}

export function PortfolioOverview({ userAssets, totalSupplied, totalBorrowed }: PortfolioOverviewProps) {
    const suppliedAssets = userAssets.filter(asset => Number(asset.suppliedBalance) > 0);
    const borrowedAssets = userAssets.filter(asset => Number(asset.borrowedBalance) > 0);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Supplied Assets */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-xl">Your Supplies</CardTitle>
                    <CardDescription>
                        Assets you've supplied as collateral
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {suppliedAssets.length > 0 ? (
                        <div className="space-y-4">
                            {suppliedAssets.map((asset) => (
                                <div key={asset.address} className="flex items-center justify-between p-4 bg-surface-light dark:bg-surface-dark rounded-lg border border-border-light dark:border-border-dark">
                                    <div className="flex items-center space-x-3">
                                        <TokenNetworkIcon
                                            tokenSymbol={asset.unit}
                                            sourceChain={asset.sourceChain}
                                            size="default"
                                            shadow="default"
                                        />
                                        <div>
                                            <div className="font-medium text-foreground">{asset.unit}</div>
                                            <div className="text-sm text-muted-foreground">{asset.sourceChain} Chain</div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="font-medium text-foreground">{asset.formattedSuppliedBalance} {asset.unit}</div>
                                        <div className="text-sm text-muted-foreground">{asset.suppliedUsdValue}</div>
                                    </div>
                                </div>
                            ))}
                            <div className="pt-4 border-t border-border-light dark:border-border-dark">
                                <div className="flex justify-between items-center">
                                    <span className="font-medium text-foreground">Total Supplied</span>
                                    <span className="font-bold text-zeta-500">{totalSupplied}</span>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-8 text-muted-foreground">
                            <p className="mb-4">No assets supplied yet</p>
                            <Button variant="zeta" size="sm">
                                Supply Assets
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Borrowed Assets */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-xl">Your Borrows</CardTitle>
                    <CardDescription>
                        Assets you've borrowed against your collateral
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {borrowedAssets.length > 0 ? (
                        <div className="space-y-4">
                            {borrowedAssets.map((asset) => (
                                <div key={asset.address} className="flex items-center justify-between p-4 bg-surface-light dark:bg-surface-dark rounded-lg border border-border-light dark:border-border-dark">
                                    <div className="flex items-center space-x-3">
                                        <TokenNetworkIcon
                                            tokenSymbol={asset.unit}
                                            sourceChain={asset.sourceChain}
                                            size="default"
                                            shadow="default"
                                        />
                                        <div>
                                            <div className="font-medium text-foreground">{asset.unit}</div>
                                            <div className="text-sm text-muted-foreground">{asset.sourceChain} Chain</div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="font-medium text-foreground">{asset.formattedBorrowedBalance} {asset.unit}</div>
                                        <div className="text-sm text-muted-foreground">{asset.borrowedUsdValue}</div>
                                    </div>
                                </div>
                            ))}
                            <div className="pt-4 border-t border-border-light dark:border-border-dark">
                                <div className="flex justify-between items-center">
                                    <span className="font-medium text-foreground">Total Borrowed</span>
                                    <span className="font-bold text-red-500">{totalBorrowed}</span>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-8 text-muted-foreground">
                            <p className="mb-4">No borrows yet</p>
                            <Button variant="zeta-outline" size="sm">
                                Borrow Assets
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}