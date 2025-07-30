import { useEffect, useState, useMemo, useCallback } from 'react';
import { useAccount, useReadContracts } from 'wagmi';
import { formatUnits } from 'viem';
import { useContracts } from './useContracts';
import { useMultiChainBalances } from './useMultiChainBalances';
import { SupportedChain, getTokenAddress } from '../contracts/deployments';
import { CHAIN_TOKEN_MAPPINGS } from '@/utils/chainUtils';
import { UniversalLendingProtocol__factory } from '../contracts/typechain-types/factories/contracts/UniversalLendingProtocol__factory';
import type { UserAssetData } from '../components/dashboard/types';
import { safeEVMAddress, safeEVMAddressOrZeroAddress } from '@/types/address';
import { ERC20__factory, IPriceOracle__factory } from '@/contracts/typechain-types';

// Helper function to get source chain name from chain ID
function getSourceChainName(chainId: number): string {
  switch (chainId) {
    case SupportedChain.ARBITRUM_SEPOLIA:
      return 'ARBI';
    case SupportedChain.ETHEREUM_SEPOLIA:
      return 'ETH';
    case SupportedChain.POLYGON_AMOY:
      return 'POL';
    case SupportedChain.BASE_SEPOLIA:
      return 'BASE';
    case SupportedChain.BSC_TESTNET:
      return 'BSC';
    default:
      return 'UNKNOWN';
  }
}

export function useDashboardData() {
    const { isConnected, address } = useAccount();
    const [userAssets, setUserAssets] = useState<UserAssetData[]>([]);
    const [totalSupplied, setTotalSupplied] = useState('$0.00');
    const [totalBorrowed, setTotalBorrowed] = useState('$0.00');
    const [healthFactor, setHealthFactor] = useState('∞');

    // Use ZetaChain testnet for lending protocol
    const { universalLendingProtocol, priceOracle } = useContracts(SupportedChain.ZETA_TESTNET);

    // Get multi-chain balances for user wallet balances
    const { balances: externalBalances, isLoading: isLoadingExternalBalances } = useMultiChainBalances();

    // Define all available assets using chain token mappings
    const allAssets = useMemo(() => {
        const assets = CHAIN_TOKEN_MAPPINGS.flatMap(mapping => [
            { 
                symbol: mapping.zetaTokenSymbol, 
                unit: mapping.nativeToken, 
                sourceChain: getSourceChainName(mapping.chainId) 
            },
            { 
                symbol: mapping.usdcTokenSymbol, 
                unit: 'USDC', 
                sourceChain: getSourceChainName(mapping.chainId) 
            },
        ]);

        return assets.map(asset => ({
            ...asset,
            address: getTokenAddress(asset.symbol, SupportedChain.ZETA_TESTNET),
        })).filter(asset => asset.address);
    }, []);

    const assetAddresses = useMemo(() => {
        return allAssets.map(asset => asset.address);
    }, [allAssets]);

    // Get user supplies and borrows
    const { data: userSupplies, refetch: refetchUserSupplies } = useReadContracts({
        contracts: assetAddresses.map(asset => ({
            address: safeEVMAddressOrZeroAddress(universalLendingProtocol),
            abi: UniversalLendingProtocol__factory.abi,
            functionName: 'getSupplyBalance',
            args: [address, asset],
            chainId: SupportedChain.ZETA_TESTNET,
        })),
        query: {
            enabled: Boolean(universalLendingProtocol) && Boolean(address) && isConnected,
            // Refetch to keep balances current
            refetchInterval: 15000, // 15 seconds
        },
    });

    const { data: userBorrows, refetch: refetchUserBorrows } = useReadContracts({
        contracts: assetAddresses.map(asset => ({
            address: safeEVMAddressOrZeroAddress(universalLendingProtocol),
            abi: UniversalLendingProtocol__factory.abi,
            functionName: 'getBorrowBalance',
            args: [address, asset],
            chainId: SupportedChain.ZETA_TESTNET,
        })),
        query: {
            enabled: Boolean(universalLendingProtocol) && Boolean(address) && isConnected,
            // Refetch to keep balances current  
            refetchInterval: 15000, // 15 seconds
        },
    });

    const { data: assetConfigs } = useReadContracts({
        contracts: assetAddresses.map(asset => ({
            address: safeEVMAddressOrZeroAddress(universalLendingProtocol),
            abi: UniversalLendingProtocol__factory.abi,
            functionName: 'getAssetConfig',
            args: [asset],
            chainId: SupportedChain.ZETA_TESTNET,
        })),
        query: {
            enabled: assetAddresses.length > 0 && Boolean(universalLendingProtocol),
        },
    });

    // Get asset prices from oracle (not from deprecated config.price)
    const { data: assetPrices, refetch: refetchAssetPrices } = useReadContracts({
        contracts: assetAddresses.map(asset => ({
            address: safeEVMAddressOrZeroAddress(priceOracle),
            abi: IPriceOracle__factory.abi,
            functionName: 'getPrice',
            args: [asset],
            chainId: SupportedChain.ZETA_TESTNET,
        })),
        query: {
            enabled: assetAddresses.length > 0 && Boolean(priceOracle),
            // Refetch prices regularly to keep them current
            refetchInterval: 10000, // 10 seconds - same as Stats component
        },
    });

    // // Get user's health factor (refetch when asset prices change)
    // const { data: userHealthFactor, refetch: refetchHealthFactor } = useReadContracts({
    //     contracts: [{
    //         address: safeEVMAddress(universalLendingProtocol),
    //         abi: UniversalLendingProtocol__factory.abi,
    //         functionName: 'getHealthFactor',
    //         args: [safeEVMAddressOrZeroAddress(address)],
    //         chainId: SupportedChain.ZETA_TESTNET,
    //     }],
    //     query: {
    //         enabled: Boolean(universalLendingProtocol) && Boolean(address) && isConnected,
    //         // Refetch periodically to ensure health factor stays updated with price changes
    //         refetchInterval: 10000, // 10 seconds
    //     },
    // });

    const { data: userAccountData, refetch: refetchUserAccountData } = useReadContracts({
        contracts: [{
            address: safeEVMAddress(universalLendingProtocol),
            abi: UniversalLendingProtocol__factory.abi,
            functionName: 'getUserAccountData',
            args: [safeEVMAddressOrZeroAddress(address)],
            chainId: SupportedChain.ZETA_TESTNET,
        }],
        query: {
            enabled: Boolean(universalLendingProtocol) && Boolean(address) && isConnected,
            // Refetch periodically to ensure health factor stays updated with price changes
            refetchInterval: 10000, // 10 seconds
        },
    });

    // ERC20 ABI for decimals
    const { data: assetDecimals } = useReadContracts({
        contracts: assetAddresses.map(asset => ({
            address: safeEVMAddressOrZeroAddress(asset),
            abi: ERC20__factory.abi,
            functionName: 'decimals',
            chainId: SupportedChain.ZETA_TESTNET,
        })),
        query: {
            enabled: assetAddresses.length > 0,
        },
    });

    useEffect(() => {
        if (userSupplies && userBorrows && assetConfigs && assetPrices && assetDecimals && allAssets.length > 0 && isConnected) {
            let totalSuppliedUSD = 0;
            let totalBorrowedUSD = 0;
            const assetsData: UserAssetData[] = [];

            allAssets.forEach((asset, index) => {
                const supplyResult = userSupplies[index];
                const borrowResult = userBorrows[index];
                const configResult = assetConfigs[index];
                const priceResult = assetPrices[index];
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
                    const config = configResult.result as unknown as { isSupported: boolean };
                    isSupported = config.isSupported;
                }
                if (priceResult?.result && priceResult.status === 'success') {
                    price = priceResult.result as unknown as bigint;
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
    }, [userSupplies, userBorrows, assetConfigs, assetPrices, assetDecimals, allAssets, isConnected, externalBalances]);

    useEffect(() => {
        if (userAccountData?.[0]?.result && userAccountData[0].status === 'success') {
            const healthFactorValue = userAccountData[0].result[4];
            const formattedHealthFactor = Number(formatUnits(healthFactorValue, 18));

            if (formattedHealthFactor === 0 || formattedHealthFactor > 1000) {
                setHealthFactor('∞');
            } else {
                setHealthFactor(formattedHealthFactor.toFixed(2));
            }
        }
    }, [userAccountData]);

    // Create a refetch function that refetches all user data
    const refetchUserData = useCallback(async () => {
        await Promise.all([
            refetchUserSupplies(),
            refetchUserBorrows(),
            refetchUserAccountData(),
            refetchAssetPrices(),
        ]);
    }, [refetchUserSupplies, refetchUserBorrows, refetchUserAccountData, refetchAssetPrices]);

    return {
        userAssets,
        totalSupplied,
        totalBorrowed,
        healthFactor,
        externalBalances,
        isLoadingExternalBalances,
        refetchUserData,
    };
}