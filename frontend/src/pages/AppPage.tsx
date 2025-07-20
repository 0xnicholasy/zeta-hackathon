import { ConnectButton } from '@rainbow-me/rainbowkit';
import ThemeToggle from '../components/ThemeToggle';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { useNavigate } from 'react-router-dom';
import { useAccount, useReadContracts } from 'wagmi';
import { useEffect, useState, useMemo } from 'react';
import { formatUnits } from 'viem';
import { useContracts } from '../hooks/useContracts';
import { SupportedChain, TOKEN_SYMBOLS, getTokenAddress } from '../contracts/deployments';
import { SimpleLendingProtocol__factory } from '../contracts/types';
import { TokenIcon, NetworkIcon } from '@web3icons/react';
import { FaWallet, FaPlus, FaArrowDown, FaExchangeAlt, FaBolt } from 'react-icons/fa';

interface UserAssetData {
  address: string;
  symbol: string;
  unit: string;
  sourceChain: string;
  suppliedBalance: string;
  borrowedBalance: string;
  formattedSuppliedBalance: string;
  formattedBorrowedBalance: string;
  suppliedUsdValue: string;
  borrowedUsdValue: string;
  price: string;
  isSupported: boolean;
}

function AppPage() {
    const navigate = useNavigate();
    const { isConnected, address } = useAccount();
    const [userAssets, setUserAssets] = useState<UserAssetData[]>([]);
    const [totalSupplied, setTotalSupplied] = useState('$0.00');
    const [totalBorrowed, setTotalBorrowed] = useState('$0.00');
    const [healthFactor, setHealthFactor] = useState('∞');

    // Use ZetaChain testnet for lending protocol
    const { simpleLendingProtocol } = useContracts(SupportedChain.ZETA_TESTNET);

    // Define all available assets
    const allAssets = useMemo(() => {
        const assets = [
            { symbol: TOKEN_SYMBOLS.ETH_ARBI, unit: 'ETH', sourceChain: 'ARBI' },
            { symbol: TOKEN_SYMBOLS.USDC_ARBI, unit: 'USDC', sourceChain: 'ARBI' },
            { symbol: TOKEN_SYMBOLS.ETH_ETH, unit: 'ETH', sourceChain: 'ETH' },
            { symbol: TOKEN_SYMBOLS.USDC_ETH, unit: 'USDC', sourceChain: 'ETH' },
        ];

        return assets.map(asset => ({
            ...asset,
            address: getTokenAddress(asset.symbol, SupportedChain.ZETA_TESTNET) || '',
        })).filter(asset => asset.address);
    }, []);

    const assetAddresses = useMemo(() => {
        return allAssets.map(asset => asset.address);
    }, [allAssets]);

    // Get user supplies and borrows
    const { data: userSupplies } = useReadContracts({
        contracts: assetAddresses.map(asset => ({
            address: simpleLendingProtocol as `0x${string}`,
            abi: SimpleLendingProtocol__factory.abi,
            functionName: 'getSupplyBalance',
            args: [address, asset],
        })),
        query: {
            enabled: !!simpleLendingProtocol && !!address && isConnected,
        },
    });

    const { data: userBorrows } = useReadContracts({
        contracts: assetAddresses.map(asset => ({
            address: simpleLendingProtocol as `0x${string}`,
            abi: SimpleLendingProtocol__factory.abi,
            functionName: 'getBorrowBalance',
            args: [address, asset],
        })),
        query: {
            enabled: !!simpleLendingProtocol && !!address && isConnected,
        },
    });

    const { data: assetConfigs } = useReadContracts({
        contracts: assetAddresses.map(asset => ({
            address: simpleLendingProtocol as `0x${string}`,
            abi: SimpleLendingProtocol__factory.abi,
            functionName: 'getAssetConfig',
            args: [asset],
        })),
        query: {
            enabled: assetAddresses.length > 0 && !!simpleLendingProtocol,
        },
    });

    // Get user's health factor
    const { data: userHealthFactor } = useReadContracts({
        contracts: [{
            address: simpleLendingProtocol as `0x${string}`,
            abi: SimpleLendingProtocol__factory.abi,
            functionName: 'getHealthFactor',
            args: [address || "0x0"],
        }],
        query: {
            enabled: !!simpleLendingProtocol && !!address && isConnected,
        },
    });

    // ERC20 ABI for decimals
    const erc20Abi = [
        {
            name: 'decimals',
            type: 'function' as const,
            stateMutability: 'view' as const,
            inputs: [],
            outputs: [{ name: '', type: 'uint8' as const }],
        },
    ] as const;

    const { data: assetDecimals } = useReadContracts({
        contracts: assetAddresses.map(asset => ({
            address: asset as `0x${string}`,
            abi: erc20Abi,
            functionName: 'decimals',
        })),
        query: {
            enabled: assetAddresses.length > 0,
        },
    });

    useEffect(() => {
        if (userSupplies && userBorrows && assetConfigs && assetDecimals && allAssets.length > 0 && isConnected) {
            let totalSuppliedUSD = 0;
            let totalBorrowedUSD = 0;
            const assetsData: UserAssetData[] = [];

            allAssets.forEach((asset, index) => {
                const supplyResult = userSupplies[index];
                const borrowResult = userBorrows[index];
                const configResult = assetConfigs[index];
                const decimalsResult = assetDecimals[index];

                let suppliedBalance = BigInt(0);
                let borrowedBalance = BigInt(0);
                let decimals = 18;
                let price = BigInt(0);
                let isSupported = false;

                if (supplyResult?.result && supplyResult.status === 'success') {
                    suppliedBalance = supplyResult.result as unknown as bigint;
                }
                if (borrowResult?.result && borrowResult.status === 'success') {
                    borrowedBalance = borrowResult.result as unknown as bigint;
                }
                if (decimalsResult?.result && decimalsResult.status === 'success') {
                    decimals = decimalsResult.result as number;
                }
                if (configResult?.result && configResult.status === 'success') {
                    const config = configResult.result as unknown as { isSupported: boolean; price: bigint };
                    if (config?.price) {
                        price = config.price;
                        isSupported = config.isSupported;
                    }
                }

                // Convert balances to normalized amounts (18 decimals)
                let normalizedSupplyBalance = suppliedBalance;
                let normalizedBorrowBalance = borrowedBalance;
                if (decimals < 18) {
                    const multiplier = BigInt(10 ** (18 - decimals));
                    normalizedSupplyBalance = suppliedBalance * multiplier;
                    normalizedBorrowBalance = borrowedBalance * multiplier;
                } else if (decimals > 18) {
                    const divisor = BigInt(10 ** (decimals - 18));
                    normalizedSupplyBalance = suppliedBalance / divisor;
                    normalizedBorrowBalance = borrowedBalance / divisor;
                }

                // Calculate USD values
                const suppliedValue = Number(formatUnits(normalizedSupplyBalance * price, 36));
                const borrowedValue = Number(formatUnits(normalizedBorrowBalance * price, 36));
                
                totalSuppliedUSD += suppliedValue;
                totalBorrowedUSD += borrowedValue;

                // Format balances for display
                const formattedSuppliedBalance = Number(formatUnits(suppliedBalance, decimals));
                const formattedBorrowedBalance = Number(formatUnits(borrowedBalance, decimals));
                const priceInUSD = Number(formatUnits(price, 18));

                assetsData.push({
                    address: asset.address,
                    symbol: asset.symbol,
                    unit: asset.unit,
                    sourceChain: asset.sourceChain,
                    suppliedBalance: suppliedBalance.toString(),
                    borrowedBalance: borrowedBalance.toString(),
                    formattedSuppliedBalance: formattedSuppliedBalance.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 6,
                    }),
                    formattedBorrowedBalance: formattedBorrowedBalance.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 6,
                    }),
                    suppliedUsdValue: suppliedValue.toLocaleString('en-US', {
                        style: 'currency',
                        currency: 'USD',
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                    }),
                    borrowedUsdValue: borrowedValue.toLocaleString('en-US', {
                        style: 'currency',
                        currency: 'USD',
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                    }),
                    price: priceInUSD.toLocaleString('en-US', {
                        style: 'currency',
                        currency: 'USD',
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                    }),
                    isSupported,
                });
            });

            setUserAssets(assetsData);
            setTotalSupplied(totalSuppliedUSD.toLocaleString('en-US', {
                style: 'currency',
                currency: 'USD',
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
            }));
            setTotalBorrowed(totalBorrowedUSD.toLocaleString('en-US', {
                style: 'currency',
                currency: 'USD',
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
            }));
        }
    }, [userSupplies, userBorrows, assetConfigs, assetDecimals, allAssets, isConnected]);

    useEffect(() => {
        if (userHealthFactor && userHealthFactor[0]?.result && userHealthFactor[0].status === 'success') {
            const healthFactorValue = userHealthFactor[0].result as unknown as bigint;
            const formattedHealthFactor = Number(formatUnits(healthFactorValue, 18));
            
            if (formattedHealthFactor === 0 || formattedHealthFactor > 1000) {
                setHealthFactor('∞');
            } else {
                setHealthFactor(formattedHealthFactor.toFixed(2));
            }
        }
    }, [userHealthFactor]);

    return (
        <div className="min-h-screen bg-gradient-to-br from-zeta-50 to-zeta-100 dark:from-background dark:to-secondary">
            {/* Header */}
            <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="container mx-auto px-4 py-4 flex justify-between items-center">
                    <div className="flex items-center space-x-2 cursor-pointer" onClick={() => navigate('/')}>
                        <div className="w-8 h-8 bg-zeta-500 rounded-lg flex items-center justify-center">
                            <span className="text-white font-bold text-lg">Z</span>
                        </div>
                        <span className="text-xl font-bold text-foreground">
                            ZetaLend
                        </span>
                    </div>
                    <div className="flex items-center space-x-4">
                        <ThemeToggle />
                        <ConnectButton />
                    </div>
                </div>
            </header>

            {/* Main App Content */}
            <div className="container mx-auto px-4 py-8">
                {!isConnected ? (
                    // Not Connected State
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
                                    <div className="w-8 h-8 bg-gradient-to-br from-zeta-400 to-zeta-600 rounded-full flex items-center justify-center mx-auto mb-2">
                                        <span className="text-white font-bold text-sm">Z</span>
                                    </div>
                                    <div className="text-sm font-medium text-foreground">ZetaChain</div>
                                    <div className="text-xs text-muted-foreground">Universal EVM</div>
                                </div>
                            </div>
                            
                            <ConnectButton />
                        </div>
                    </div>
                ) : (
                    // Connected State - Main App Interface
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
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-lg flex items-center gap-2">
                                        <div className="w-8 h-8 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center">
                                            <FaPlus className="text-green-600 dark:text-green-400 text-sm" />
                                        </div>
                                        Supply
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <CardDescription>
                                        Deposit assets to earn interest and use as collateral.
                                    </CardDescription>
                                </CardContent>
                            </Card>

                            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-lg flex items-center gap-2">
                                        <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
                                            <FaArrowDown className="text-blue-600 dark:text-blue-400 text-sm" />
                                        </div>
                                        Borrow
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <CardDescription>
                                        Borrow assets against your supplied collateral.
                                    </CardDescription>
                                </CardContent>
                            </Card>

                            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-lg flex items-center gap-2">
                                        <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center">
                                            <FaExchangeAlt className="text-purple-600 dark:text-purple-400 text-sm" />
                                        </div>
                                        Bridge
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <CardDescription>
                                        Transfer assets between supported chains.
                                    </CardDescription>
                                </CardContent>
                            </Card>

                            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-lg flex items-center gap-2">
                                        <div className="w-8 h-8 bg-orange-100 dark:bg-orange-900 rounded-lg flex items-center justify-center">
                                            <FaBolt className="text-orange-600 dark:text-orange-400 text-sm" />
                                        </div>
                                        Liquidate
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <CardDescription>
                                        Liquidate undercollateralized positions for profit.
                                    </CardDescription>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Portfolio Overview */}
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
                                    {userAssets.filter(asset => Number(asset.suppliedBalance) > 0).length > 0 ? (
                                        <div className="space-y-4">
                                            {userAssets
                                                .filter(asset => Number(asset.suppliedBalance) > 0)
                                                .map((asset) => (
                                                <div key={asset.address} className="flex items-center justify-between p-4 bg-surface-light dark:bg-surface-dark rounded-lg border border-border-light dark:border-border-dark">
                                                    <div className="flex items-center space-x-3">
                                                        <div className="relative w-8 h-8">
                                                            <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-lg">
                                                                <TokenIcon symbol={asset.unit} className="w-6 h-6" />
                                                            </div>
                                                            {asset.sourceChain && (
                                                                <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-white rounded-full flex items-center justify-center shadow-md">
                                                                    {asset.sourceChain.slice(0, 3).toUpperCase() === 'ARB' ? (
                                                                        <NetworkIcon name="arbitrum-one" className="w-2 h-2" />
                                                                    ) : asset.sourceChain === 'ETH' ? (
                                                                        <NetworkIcon name="ethereum" className="w-2 h-2" />
                                                                    ) : (
                                                                        <div className="w-2 h-2 bg-zeta-500 rounded-full"></div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
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
                                    {userAssets.filter(asset => Number(asset.borrowedBalance) > 0).length > 0 ? (
                                        <div className="space-y-4">
                                            {userAssets
                                                .filter(asset => Number(asset.borrowedBalance) > 0)
                                                .map((asset) => (
                                                <div key={asset.address} className="flex items-center justify-between p-4 bg-surface-light dark:bg-surface-dark rounded-lg border border-border-light dark:border-border-dark">
                                                    <div className="flex items-center space-x-3">
                                                        <div className="relative w-8 h-8">
                                                            <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-lg">
                                                                <TokenIcon symbol={asset.unit} className="w-6 h-6" />
                                                            </div>
                                                            {asset.sourceChain && (
                                                                <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-white rounded-full flex items-center justify-center shadow-md">
                                                                    {asset.sourceChain.slice(0, 3).toUpperCase() === 'ARB' ? (
                                                                        <NetworkIcon name="arbitrum-one" className="w-2 h-2" />
                                                                    ) : asset.sourceChain === 'ETH' ? (
                                                                        <NetworkIcon name="ethereum" className="w-2 h-2" />
                                                                    ) : (
                                                                        <div className="w-2 h-2 bg-zeta-500 rounded-full"></div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
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

                        {/* Health Factor */}
                        <Card className="mt-8">
                            <CardHeader>
                                <CardTitle className="text-xl">Account Health</CardTitle>
                                <CardDescription>
                                    Your borrowing capacity and liquidation risk
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className="text-center">
                                        <div className={`text-2xl font-bold mb-1 ${healthFactor === '∞' || Number(healthFactor) > 1.5 ? 'text-green-500' : Number(healthFactor) > 1.2 ? 'text-yellow-500' : 'text-red-500'}`}>
                                            {healthFactor}
                                        </div>
                                        <div className="text-sm text-muted-foreground">
                                            Health Factor
                                        </div>
                                        <div className="text-xs text-muted-foreground mt-1">
                                            {healthFactor === '∞' || Number(healthFactor) > 1.5 ? 'Safe (>1.5 recommended)' : Number(healthFactor) > 1.2 ? 'At Risk (<1.5)' : 'Liquidation Risk (<1.2)'}
                                        </div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-2xl font-bold text-zeta-500 mb-1">
                                            {totalSupplied}
                                        </div>
                                        <div className="text-sm text-muted-foreground">
                                            Total Supplied
                                        </div>
                                        <div className="text-xs text-muted-foreground mt-1">
                                            Earning interest
                                        </div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-2xl font-bold text-red-500 mb-1">
                                            {totalBorrowed}
                                        </div>
                                        <div className="text-sm text-muted-foreground">
                                            Total Borrowed
                                        </div>
                                        <div className="text-xs text-muted-foreground mt-1">
                                            Accruing interest
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}
            </div>
        </div>
    );
}

export default AppPage;