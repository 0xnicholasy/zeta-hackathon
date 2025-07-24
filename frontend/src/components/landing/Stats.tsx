import { useEffect, useState } from 'react';
import { TokenIcon, NetworkIcon } from '@web3icons/react';
import { getProtocolAssetData, getAllSupportedAssets, calculateTVL, type AssetData } from '../../utils/directContractCalls';

// AssetData interface is now imported from directContractCalls

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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch protocol data directly from ZetaChain testnet using Alchemy RPC
    // This ensures the component works regardless of wallet connection status
    const fetchProtocolData = async () => {
      try {
        if (stats.assets.length === 0) {
          setLoading(true);
        }

        // Fetch all data in parallel for better performance
        const [assetsData, supportedAssets] = await Promise.all([
          getProtocolAssetData(),
          getAllSupportedAssets(),
        ]);

        // Calculate TVL from asset data
        const totalValueUSD = calculateTVL(assetsData);

        setStats(prev => ({
          ...prev,
          totalValueLocked: `$${totalValueUSD.toLocaleString('en-US', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
          })}`,
          supportedAssets: supportedAssets.length,
          assets: assetsData,
        }));
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Error fetching protocol data:', error);
      } finally {
        setLoading(false);
      }
    };

    void fetchProtocolData();

    // Set up periodic refresh every 30 seconds to keep data current
    const interval = setInterval(() => {
      void fetchProtocolData();
    }, 30000);

    return () => clearInterval(interval);
  }, [stats.assets.length]);

  // For now, we'll keep active users as 0 since tracking unique users requires more complex logic
  // In a real implementation, you might emit events for user interactions and count unique addresses

  return (
    <div className="mt-16 bg-surface-light dark:bg-surface-dark rounded-2xl p-8 border border-border-light dark:border-border-dark">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="text-center">
          <div className="text-3xl font-bold text-zeta-500 mb-2">
            {loading ? (
              <div className="animate-pulse bg-zeta-200 dark:bg-zeta-700 rounded h-8 w-24 mx-auto"></div>
            ) : (
              stats.totalValueLocked
            )}
          </div>
          <div className="text-text-secondary-light dark:text-text-secondary-dark">
            Total Value Locked
          </div>
        </div>
        <div className="text-center">
          <div className="text-3xl font-bold text-zeta-500 mb-2">
            {loading ? (
              <div className="animate-pulse bg-zeta-200 dark:bg-zeta-700 rounded h-8 w-16 mx-auto"></div>
            ) : (
              stats.supportedChains
            )}
          </div>
          <div className="text-text-secondary-light dark:text-text-secondary-dark">
            Supported Chains
          </div>
        </div>
        <div className="text-center">
          <div className="text-3xl font-bold text-zeta-500 mb-2">
            {loading ? (
              <div className="animate-pulse bg-zeta-200 dark:bg-zeta-700 rounded h-8 w-16 mx-auto"></div>
            ) : (
              stats.supportedAssets
            )}
          </div>
          <div className="text-text-secondary-light dark:text-text-secondary-dark">
            Supported Assets
          </div>
        </div>
      </div>

      {/* Asset Balances Section */}
      {(stats.assets.length > 0 || loading) && (
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
            {loading ? (
              // Loading skeleton for asset cards
              Array.from({ length: 4 }, (_, i) => (
                <div
                  key={i}
                  className="bg-surface-light dark:bg-surface-dark p-6 rounded-xl shadow-lg border border-border-light dark:border-border-dark"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse"></div>
                    <div>
                      <div className="w-16 h-5 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-1"></div>
                      <div className="w-20 h-3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="w-24 h-6 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                    <div className="w-32 h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                    <div className="w-28 h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                  </div>
                </div>
              ))
            ) : (
              stats.assets.sort((a, b) => Number(b.usdValue.replace(/[$,]/g, '')) - Number(a.usdValue.replace(/[$,]/g, ''))).map((asset) => (
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
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}