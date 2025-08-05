import { useEffect, useState } from 'react';
import { TokenIcon } from '@web3icons/react';
import { getProtocolAssetData, getAllSupportedAssets, calculateTVL, type AssetData } from '../../utils/directContractCalls';
import { ChainIcon } from '../ui/ChainIcon';

// AssetData interface is now imported from directContractCalls

interface StatsData {
  totalValueLocked: string;
  supportedChains: number;
  supportedAssets: number;
  assets: AssetData[];
}

interface AssetDetailsModalProps {
  asset: AssetData | null;
  isOpen: boolean;
  onClose: () => void;
}

function AssetDetailsModal({ asset, isOpen, onClose }: AssetDetailsModalProps) {
  if (!isOpen || !asset) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-surface-light dark:bg-surface-dark rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-border-light dark:border-border-dark">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="relative w-12 h-12">
              <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-lg">
                {asset.unit ? (
                  <TokenIcon symbol={asset.unit} className="w-10 h-10 text-zeta-700" />
                ) : (
                  <div className="w-10 h-10 bg-gradient-to-br from-zeta-400 to-zeta-600 rounded-full flex items-center justify-center">
                    <span className="text-white font-bold text-sm">?</span>
                  </div>
                )}
              </div>
              {asset.sourceChain && (
                <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-white rounded-full flex items-center justify-center shadow-md">
                  <ChainIcon
                    chain={asset.sourceChain}
                    className="size-5 text-zeta-700"
                    fallbackClassName="w-4 h-4"
                  />
                </div>
              )}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-text-primary-light dark:text-text-primary-dark">{asset.unit}</h2>
              <p className="text-text-secondary-light dark:text-text-secondary-dark">
                {asset.sourceChain ? `${asset.sourceChain} Chain` : 'ZetaChain'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-text-secondary-light dark:text-text-secondary-dark hover:text-text-primary-light dark:hover:text-text-primary-dark transition-colors p-2"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="bg-gradient-to-r from-zeta-50 to-zeta-100 dark:from-zeta-900/20 dark:to-zeta-800/20 rounded-xl p-4">
            <div className="text-sm text-text-secondary-light dark:text-text-secondary-dark mb-1">Current Price</div>
            <div className="text-2xl font-bold text-zeta-500">{asset.price}</div>
          </div>
          <div className="bg-gradient-to-r from-zeta-50 to-zeta-100 dark:from-zeta-900/20 dark:to-zeta-800/20 rounded-xl p-4">
            <div className="text-sm text-text-secondary-light dark:text-text-secondary-dark mb-1">
              {asset.isSupported ? 'Available Liquidity' : 'Protocol Balance'}
            </div>
            <div className="text-lg font-bold text-text-primary-light dark:text-text-primary-dark">{asset.formattedBalance}</div>
            <div className="text-sm text-text-success-light dark:text-text-success-dark">{asset.usdValue}</div>
          </div>
        </div>

        {asset.isSupported && asset.config && (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-zeta-50 to-zeta-100 dark:from-zeta-900/20 dark:to-zeta-800/20 rounded-xl p-4">
              <h3 className="text-lg font-bold text-text-primary-light dark:text-text-primary-dark mb-4">Risk Parameters</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex justify-between items-center p-3 bg-surface-light dark:bg-surface-dark rounded-lg border border-border-light dark:border-border-dark">
                  <span className="text-text-secondary-light dark:text-text-secondary-dark">Collateral Factor</span>
                  <span className="text-zeta-600 dark:text-zeta-400 font-bold">
                    {(Number(asset.config.collateralFactor) / 10 ** 16).toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 bg-surface-light dark:bg-surface-dark rounded-lg border border-border-light dark:border-border-dark">
                  <span className="text-text-secondary-light dark:text-text-secondary-dark">Liquidation Threshold</span>
                  <span className="text-text-warning-light dark:text-text-warning-dark font-bold">
                    {(Number(asset.config.liquidationThreshold) / 10 ** 16).toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 bg-surface-light dark:bg-surface-dark rounded-lg border border-border-light dark:border-border-dark">
                  <span className="text-text-secondary-light dark:text-text-secondary-dark">Liquidation Bonus</span>
                  <span className="text-text-success-light dark:text-text-success-dark font-bold">
                    {(Number(asset.config.liquidationBonus) / 10 ** 16).toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 bg-surface-light dark:bg-surface-dark rounded-lg border border-border-light dark:border-border-dark">
                  <span className="text-text-secondary-light dark:text-text-secondary-dark">Supported</span>
                  <span className={`font-bold ${asset.config.isSupported ? 'text-text-success-light dark:text-text-success-dark' : 'text-text-error-light dark:text-text-error-dark'}`}>
                    {asset.config.isSupported ? 'Yes' : 'No'}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-r from-zeta-100 to-zeta-200 dark:from-zeta-800/20 dark:to-zeta-700/20 rounded-xl p-4">
              <h3 className="text-lg font-bold text-text-primary-light dark:text-text-primary-dark mb-4">Interest Rates</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex justify-between items-center p-3 bg-surface-light dark:bg-surface-dark rounded-lg border border-border-light dark:border-border-dark">
                  <span className="text-text-secondary-light dark:text-text-secondary-dark">Borrow APR</span>
                  <span className="text-text-error-light dark:text-text-error-dark font-bold">
                    {(Number(asset.config.borrowRate) / 10 ** 16).toFixed(2)}%
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 bg-surface-light dark:bg-surface-dark rounded-lg border border-border-light dark:border-border-dark">
                  <span className="text-text-secondary-light dark:text-text-secondary-dark">Supply APR</span>
                  <span className="text-text-info-light dark:text-text-info-dark font-bold">
                    {(Number(asset.config.supplyRate) / 10 ** 16).toFixed(2)}%
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-r from-zeta-200 to-zeta-300 dark:from-zeta-700/20 dark:to-zeta-600/20 rounded-xl p-4">
              <h3 className="text-lg font-bold text-text-primary-light dark:text-text-primary-dark mb-4">Market Statistics</h3>
              <div className="grid grid-cols-1 gap-4">
                <div className="flex justify-between items-center p-3 bg-surface-light dark:bg-surface-dark rounded-lg border border-border-light dark:border-border-dark">
                  <span className="text-text-secondary-light dark:text-text-secondary-dark">Total Supplied</span>
                  <span className="text-text-success-light dark:text-text-success-dark font-bold">
                    {asset.decimals && asset.decimals > 0
                      ? (Number(asset.config.totalSupply) / 10 ** asset.decimals).toFixed(6)
                      : Number(asset.config.totalSupply).toString()
                    } {asset.unit}
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 bg-surface-light dark:bg-surface-dark rounded-lg border border-border-light dark:border-border-dark">
                  <span className="text-text-secondary-light dark:text-text-secondary-dark">Total Borrowed</span>
                  <span className="text-text-error-light dark:text-text-error-dark font-bold">
                    {asset.decimals && asset.decimals > 0
                      ? (Number(asset.config.totalBorrow) / 10 ** asset.decimals).toFixed(6)
                      : Number(asset.config.totalBorrow).toString()
                    } {asset.unit}
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 bg-surface-light dark:bg-surface-dark rounded-lg border border-border-light dark:border-border-dark">
                  <span className="text-text-secondary-light dark:text-text-secondary-dark">Utilization Rate</span>
                  <span className="text-zeta-600 dark:text-zeta-400 font-bold">
                    {asset.config.totalSupply > 0
                      ? ((Number(asset.config.totalBorrow) / Number(asset.config.totalSupply)) * 100).toFixed(1)
                      : '0.0'
                    }%
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="mt-6 pt-4 border-t border-border-light dark:border-border-dark">
          <div className="text-sm text-text-secondary-light dark:text-text-secondary-dark mb-2">Contract Address</div>
          <div className="text-sm font-mono text-text-secondary-light dark:text-text-secondary-dark bg-muted dark:bg-muted p-2 rounded">
            {asset.address}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Stats() {
  const [stats, setStats] = useState<StatsData>({
    totalValueLocked: '$0',
    supportedChains: 6, // Fixed: Arbitrum, Ethereum, ZetaChain
    supportedAssets: 0,
    assets: [],
  });
  const [loading, setLoading] = useState(true);
  const [selectedAsset, setSelectedAsset] = useState<AssetData | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const handleAssetClick = (asset: AssetData) => {
    setSelectedAsset(asset);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setSelectedAsset(null);
  };

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
    }, 10000);

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
                  onClick={() => handleAssetClick(asset)}
                  className={`bg-surface-light dark:bg-surface-dark p-6 rounded-xl shadow-lg border transition-all duration-300 hover:scale-105 cursor-pointer ${asset.isSupported
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
                            <ChainIcon
                              chain={asset.sourceChain}
                              className="size-4 text-zeta-700"
                              fallbackClassName="w-3 h-3"
                            />
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

                  {/* Click indicator */}
                  <div className="text-center pt-2 border-t border-border-light dark:border-border-dark">
                    <div className="text-xs text-text-secondary-light dark:text-text-secondary-dark">
                      Click for details
                    </div>
                  </div>

                </div>
              ))
            )}
          </div>
        </div>
      )}

      <AssetDetailsModal
        asset={selectedAsset}
        isOpen={modalOpen}
        onClose={handleCloseModal}
      />
    </div>
  );
}