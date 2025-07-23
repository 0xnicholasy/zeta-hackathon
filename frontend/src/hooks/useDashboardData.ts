import { useEffect, useState, useMemo } from 'react';
import { useAccount, useReadContracts } from 'wagmi';
import { formatUnits } from 'viem';
import { useContracts } from './useContracts';
import { useMultiChainBalances } from './useMultiChainBalances';
import { SupportedChain, TOKEN_SYMBOLS, getTokenAddress } from '../contracts/deployments';
import { SimpleLendingProtocol__factory } from '../contracts/typechain-types/factories/contracts/SimpleLendingProtocol__factory';
import type { UserAssetData } from '../components/dashboard/types';
import { safeEVMAddress, safeEVMAddressOrZeroAddress } from '../components/dashboard/types';

export function useDashboardData() {
    const { isConnected, address } = useAccount();
    const [userAssets, setUserAssets] = useState<UserAssetData[]>([]);
    const [totalSupplied, setTotalSupplied] = useState('$0.00');
    const [totalBorrowed, setTotalBorrowed] = useState('$0.00');
    const [healthFactor, setHealthFactor] = useState('∞');

    // Use ZetaChain testnet for lending protocol
    const { simpleLendingProtocol } = useContracts(SupportedChain.ZETA_TESTNET);

    // Get multi-chain balances for user wallet balances
    const { balances: externalBalances, isLoading: isLoadingExternalBalances } = useMultiChainBalances();

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
            address: getTokenAddress(asset.symbol, SupportedChain.ZETA_TESTNET),
        })).filter(asset => asset.address);
    }, []);

    const assetAddresses = useMemo(() => {
        return allAssets.map(asset => asset.address);
    }, [allAssets]);

    // Get user supplies and borrows
    const { data: userSupplies } = useReadContracts({
        contracts: assetAddresses.map(asset => ({
            address: safeEVMAddressOrZeroAddress(simpleLendingProtocol),
            abi: SimpleLendingProtocol__factory.abi,
            functionName: 'getSupplyBalance',
            args: [address, asset],
        })),
        query: {
            enabled: Boolean(simpleLendingProtocol) && Boolean(address) && isConnected,
        },
    });

    const { data: userBorrows } = useReadContracts({
        contracts: assetAddresses.map(asset => ({
            address: safeEVMAddressOrZeroAddress(simpleLendingProtocol),
            abi: SimpleLendingProtocol__factory.abi,
            functionName: 'getBorrowBalance',
            args: [address, asset],
        })),
        query: {
            enabled: Boolean(simpleLendingProtocol) && Boolean(address) && isConnected,
        },
    });

    const { data: assetConfigs } = useReadContracts({
        contracts: assetAddresses.map(asset => ({
            address: safeEVMAddressOrZeroAddress(simpleLendingProtocol),
            abi: SimpleLendingProtocol__factory.abi,
            functionName: 'getAssetConfig',
            args: [asset],
        })),
        query: {
            enabled: assetAddresses.length > 0 && Boolean(simpleLendingProtocol),
        },
    });

    // Get user's health factor
    const { data: userHealthFactor } = useReadContracts({
        contracts: [{
            address: safeEVMAddress(simpleLendingProtocol),
            abi: SimpleLendingProtocol__factory.abi,
            functionName: 'getHealthFactor',
            args: [safeEVMAddressOrZeroAddress(address)],
        }],
        query: {
            enabled: Boolean(simpleLendingProtocol) && Boolean(address) && isConnected,
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
            address: safeEVMAddressOrZeroAddress(asset),
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

                // Get external chain balance for this asset
                let externalBalance = '0';
                let formattedExternalBalance = '0';
                let externalChainId: number = SupportedChain.ZETA_TESTNET; // Default to ZETA_TESTNET

                // Map asset to its source chain and token symbol
                if (asset.sourceChain === 'ARBI') {
                    externalChainId = SupportedChain.ARBITRUM_SEPOLIA;
                    const tokenSymbol = asset.unit === 'ETH' ? 'ETH' : 'USDC';
                    const balance = externalBalances[externalChainId]?.[tokenSymbol];
                    if (balance) {
                        externalBalance = balance.balance;
                        formattedExternalBalance = balance.formattedBalance;
                    }
                } else if (asset.sourceChain === 'ETH') {
                    externalChainId = SupportedChain.ETHEREUM_SEPOLIA;
                    const tokenSymbol = asset.unit === 'ETH' ? 'ETH' : 'USDC';
                    const balance = externalBalances[externalChainId]?.[tokenSymbol];
                    if (balance) {
                        externalBalance = balance.balance;
                        formattedExternalBalance = balance.formattedBalance;
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
                    externalBalance,
                    formattedExternalBalance: Number(formattedExternalBalance).toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 6,
                    }),
                    externalChainId,
                    decimals,
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
    }, [userSupplies, userBorrows, assetConfigs, assetDecimals, allAssets, isConnected, externalBalances]);

    useEffect(() => {
        if (userHealthFactor?.[0]?.result && userHealthFactor[0].status === 'success') {
            const healthFactorValue = userHealthFactor[0].result as unknown as bigint;
            const formattedHealthFactor = Number(formatUnits(healthFactorValue, 18));

            if (formattedHealthFactor === 0 || formattedHealthFactor > 1000) {
                setHealthFactor('∞');
            } else {
                setHealthFactor(formattedHealthFactor.toFixed(2));
            }
        }
    }, [userHealthFactor]);

    return {
        userAssets,
        totalSupplied,
        totalBorrowed,
        healthFactor,
        externalBalances,
        isLoadingExternalBalances,
    };
}