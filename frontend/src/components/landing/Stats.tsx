import { useEffect, useState, useMemo } from 'react';
import { useReadContract, useReadContracts } from 'wagmi';
import { formatUnits } from 'viem';
import { useContracts } from '../../hooks/useContracts';
import { SupportedChain, TOKEN_SYMBOLS, getTokenAddress } from '../../contracts/deployments';
import { SimpleLendingProtocol__factory } from '../../contracts/typechain-types/factories/contracts/SimpleLendingProtocol__factory';
import { EVMAddress, isZeroAddress, safeEVMAddressOrZeroAddress } from '../dashboard/types';
import { TokenIcon, NetworkIcon, } from '@web3icons/react';
import { ERC20__factory } from '@/contracts/typechain-types';

interface AssetData {
  address: string;
  symbol: string;
  unit: string;
  sourceChain: string;
  balance: string;
  formattedBalance: string;
  usdValue: string;
  price: string;
  isSupported: boolean;
}

interface StatsData {
  totalValueLocked: string;
  supportedChains: number;
  supportedAssets: number;
  assets: AssetData[];
}

export default function Stats() {
  const [stats, setStats] = useState<StatsData>({
    totalValueLocked: '$0',
    supportedChains: 3, // Fixed: Arbitrum, Ethereum, ZetaChain
    supportedAssets: 0,
    assets: [],
  });

  // Use ZetaChain testnet specifically for stats since that's where the lending protocol is deployed
  // This component ONLY fetches protocol data from ZetaChain, not user balances from external chains
  const { simpleLendingProtocol } = useContracts(SupportedChain.ZETA_TESTNET);

  // Define all available assets from deployment config
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
    })).filter(asset => asset.address); // Only include assets with valid addresses
  }, []);

  const simpleLendingProtocolAddress = safeEVMAddressOrZeroAddress(simpleLendingProtocol);
  // Get supported assets count from protocol
  const { data: supportedAssetsCount } = useReadContract({
    address: simpleLendingProtocolAddress,
    abi: SimpleLendingProtocol__factory.abi,
    functionName: 'getSupportedAssetsCount',
    query: {
      enabled: !isZeroAddress(simpleLendingProtocolAddress),
    },
  });

  // Get list of supported assets from protocol
  const { data: supportedAssets } = useReadContracts({
    contracts: supportedAssetsCount ?
      Array.from({ length: Number(supportedAssetsCount) }, (_, i) => ({
        address: simpleLendingProtocolAddress,
        abi: SimpleLendingProtocol__factory.abi,
        functionName: 'getSupportedAsset',
        args: [BigInt(i)],
      })) : [],
    query: {
      enabled: !isZeroAddress(simpleLendingProtocolAddress) && Boolean(supportedAssetsCount),
    },
  });

  // Get supported asset addresses for comparison
  const supportedAssetAddresses: EVMAddress[] = useMemo(() => {
    return supportedAssets?.map(result => safeEVMAddressOrZeroAddress(result.result as string)).filter(Boolean) ?? [];
  }, [supportedAssets]);

  // Use all assets for display
  const assetAddresses = useMemo(() => {
    return allAssets.map(asset => asset.address);
  }, [allAssets]);

  const { data: assetConfigs } = useReadContracts({
    contracts: assetAddresses.map(asset => ({
      address: simpleLendingProtocolAddress,
      abi: SimpleLendingProtocol__factory.abi,
      functionName: 'getAssetConfig',
      args: [asset],
    })),
    query: {
      enabled: assetAddresses.length > 0 && !isZeroAddress(simpleLendingProtocolAddress),
    },
  });

  // ERC20 ABI for balance, decimals, and symbol
  const erc20Abi = ERC20__factory.abi;

  // Get contract balance for each asset to calculate TVL
  const { data: assetBalances } = useReadContracts({
    contracts: assetAddresses.map(asset => ({
      address: safeEVMAddressOrZeroAddress(asset),
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [simpleLendingProtocolAddress],
    })),
    query: {
      enabled: assetAddresses.length > 0 && !isZeroAddress(simpleLendingProtocolAddress),
    },
  });

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

  const { data: assetSymbols } = useReadContracts({
    contracts: assetAddresses.map(asset => ({
      address: safeEVMAddressOrZeroAddress(asset),
      abi: erc20Abi,
      functionName: 'symbol',
    })),
    query: {
      enabled: assetAddresses.length > 0,
    },
  });

  useEffect(() => {
    if (assetConfigs && assetBalances && assetDecimals && assetSymbols && allAssets.length > 0) {
      let totalValueUSD = 0;
      const assetsData: AssetData[] = [];

      allAssets.forEach((asset, index) => {
        const configResult = assetConfigs[index];
        const balanceResult = assetBalances[index];
        const decimalsResult = assetDecimals[index];
        // const symbolResult = assetSymbols[index];

        // Check if this asset is supported by the protocol
        const isSupported = supportedAssetAddresses.includes(asset.address);

        // Default values for unsupported assets
        let balance = BigInt(0);
        let decimals = 18;
        let price = BigInt(0);

        // Use real data if available
        if (balanceResult?.result && balanceResult.status === 'success') {
          balance = balanceResult.result as unknown as bigint;
        }
        if (decimalsResult?.result && decimalsResult.status === 'success') {
          decimals = decimalsResult.result as number;
        }
        if (configResult?.result && configResult.status === 'success') {
          const config = configResult.result as unknown as { isSupported: boolean; price: bigint };
          if (config?.price) {
            price = config.price;
          }
        }

        // Convert balance to normalized amount (18 decimals)
        let normalizedBalance = balance;
        if (decimals < 18) {
          normalizedBalance = balance * BigInt(10 ** (18 - decimals));
        } else if (decimals > 18) {
          normalizedBalance = balance / BigInt(10 ** (decimals - 18));
        }

        // Calculate USD value: (normalizedBalance * price) / 1e18
        const balanceValue = Number(formatUnits(normalizedBalance * price, 36)); // 18 + 18 decimals
        if (isSupported) {
          totalValueUSD += balanceValue;
        }

        // Format balance for display
        const formattedBalance = Number(formatUnits(balance, decimals));
        const priceInUSD = Number(formatUnits(price, 18));

        // Add to assets array
        assetsData.push({
          address: asset.address,
          symbol: asset.symbol,
          unit: asset.unit,
          sourceChain: asset.sourceChain,
          balance: balance.toString(),
          formattedBalance: formattedBalance.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 6,
          }),
          usdValue: balanceValue.toLocaleString('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
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

      setStats(prev => ({
        ...prev,
        totalValueLocked: `$${totalValueUSD.toLocaleString('en-US', {
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        })}`,
        supportedAssets: supportedAssetAddresses.length,
        assets: assetsData,
      }));
    }
  }, [assetConfigs, assetBalances, assetDecimals, assetSymbols, allAssets, supportedAssetAddresses]);

  // For now, we'll keep active users as 0 since tracking unique users requires more complex logic
  // In a real implementation, you might emit events for user interactions and count unique addresses

  return (
    <div className="mt-16 bg-surface-light dark:bg-surface-dark rounded-2xl p-8 border border-border-light dark:border-border-dark">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="text-center">
          <div className="text-3xl font-bold text-zeta-500 mb-2">
            {stats.totalValueLocked}
          </div>
          <div className="text-text-secondary-light dark:text-text-secondary-dark">
            Total Value Locked
          </div>
        </div>
        <div className="text-center">
          <div className="text-3xl font-bold text-zeta-500 mb-2">
            {stats.supportedChains}
          </div>
          <div className="text-text-secondary-light dark:text-text-secondary-dark">
            Supported Chains
          </div>
        </div>
        <div className="text-center">
          <div className="text-3xl font-bold text-zeta-500 mb-2">
            {stats.supportedAssets}
          </div>
          <div className="text-text-secondary-light dark:text-text-secondary-dark">
            Supported Assets
          </div>
        </div>
      </div>

      {/* Asset Balances Section */}
      {stats.assets.length > 0 && (
        <div className="mt-8 bg-gradient-to-r from-zeta-50 to-zeta-100 dark:from-zeta-900/20 dark:to-zeta-800/20 rounded-2xl p-6 border border-zeta-200 dark:border-zeta-700">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-2xl font-bold text-text-primary-light dark:text-text-primary-dark">
              Protocol Liquidity
            </h3>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-zeta-500 rounded-full animate-pulse"></div>
              <span className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
                Live Data
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {stats.assets.sort((a, b) => Number(b.usdValue) - Number(a.usdValue)).map((asset) => (
              <div
                key={asset.address}
                className={`bg-surface-light dark:bg-surface-dark p-6 rounded-xl shadow-lg border transition-all duration-300 hover:scale-105 ${asset.isSupported
                  ? 'border-border-light dark:border-border-dark hover:shadow-xl'
                  : 'border-gray-300 dark:border-gray-600 opacity-60 hover:shadow-md'
                  }`}
              >
                {/* Status Badge */}
                {!asset.isSupported && (
                  <div className="absolute top-2 right-2 bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 text-xs px-2 py-1 rounded-full">
                    Not Supported
                  </div>
                )}

                {/* Asset Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="relative w-10 h-10">
                      {/* Main Asset Icon */}
                      <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-lg">
                        {asset.unit ? (
                          <TokenIcon symbol={asset.unit} className="w-8 h-8 text-zeta-700" />
                        ) : (
                          <div className="w-8 h-8 bg-gradient-to-br from-zeta-400 to-zeta-600 rounded-full flex items-center justify-center">
                            <span className="text-white font-bold text-xs">
                              {asset.unit}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Chain Indicator */}
                      {asset.sourceChain && (
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-white rounded-full flex items-center justify-center shadow-md">
                          {asset.sourceChain.slice(0, 3).toUpperCase() === 'ARB' ? (
                            <NetworkIcon name="arbitrum-one" className='size-4 text-zeta-700' />
                          ) : asset.sourceChain === 'ETH' ? (
                            <NetworkIcon name="ethereum" className='size-4 text-zeta-700' />
                          ) : (
                            <div className="w-3 h-3 bg-gradient-to-br from-zeta-400 to-zeta-600 rounded-full flex items-center justify-center">
                              <span className="text-white font-bold text-sm">
                                {asset.sourceChain.charAt(0)}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="text-lg font-bold text-text-primary-light dark:text-text-primary-dark">
                        {asset.unit}
                      </div>
                      <div className="text-xs text-text-secondary-light dark:text-text-secondary-dark">
                        {asset.sourceChain ? `${asset.sourceChain} Chain` : 'ZetaChain'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Price */}
                <div className="mb-4 flex flex-row justify-between items-center">
                  <div className="text-md text-text-secondary-light dark:text-text-secondary-dark">
                    Current Price
                  </div>
                  <div className="text-xl font-bold text-zeta-500">
                    {asset.price}
                  </div>
                </div>

                {/* Balance */}
                <div className="mb-4 flex flex-col">
                  <div className="text-md text-text-secondary-light dark:text-text-secondary-dark mb-1">
                    {asset.isSupported ? 'Available Liquidity' : 'Protocol Balance'}
                  </div>
                  <div className='flex flex-row items-center justify-between'>
                    <div className='text-sm text-text-secondary-light dark:text-text-secondary-dark'>in Asset</div>
                    <div className="text-md font-bold text-text-primary-light dark:text-text-primary-dark">
                      {asset.formattedBalance}
                    </div>
                  </div>
                  <div className='flex flex-row items-center justify-between'>
                    <div className='text-sm text-text-secondary-light dark:text-text-secondary-dark'>in USD</div>
                    <div className="text-sm font-medium text-zeta-600 dark:text-zeta-400 text-right">
                      {asset.usdValue}
                    </div>
                  </div>
                </div>

                {/* Contract Address */}
                <div className="pt-3 border-t border-border-light dark:border-border-dark">
                  <div className="text-xs text-text-secondary-light dark:text-text-secondary-dark mb-1">
                    Contract Address
                  </div>
                  <div className="text-xs font-mono text-text-secondary-light dark:text-text-secondary-dark truncate">
                    {asset.address}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}