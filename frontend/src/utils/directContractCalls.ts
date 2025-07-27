import { createPublicClient, http, formatUnits, type Address } from 'viem';
import { SupportedChain, getUniversalLendingProtocolAddress, getTokenAddress, TOKEN_SYMBOLS, getPriceOracleAddress } from '../contracts/deployments';
import { UniversalLendingProtocol__factory } from '../contracts/typechain-types/factories/contracts/UniversalLendingProtocol__factory';
import { ERC20__factory, IPriceOracle__factory } from '../contracts/typechain-types';

const ALCHEMY_API_KEY = import.meta.env['VITE_ALCHEMY_API_KEY'] ?? '';
if (!ALCHEMY_API_KEY) {
  throw new Error('ALCHEMY_API_KEY is not set');
}

// ZetaChain Testnet configuration
const ZETA_TESTNET_RPC = `https://zetachain-testnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;

// Create a public client for ZetaChain testnet
const zetaTestnetClient = createPublicClient({
  transport: http(ZETA_TESTNET_RPC),
  chain: {
    id: SupportedChain.ZETA_TESTNET,
    name: 'ZetaChain Athens Testnet',
    network: 'zetachain-athens',
    nativeCurrency: {
      name: 'ZETA',
      symbol: 'ZETA',
      decimals: 18,
    },
    rpcUrls: {
      default: {
        http: [ZETA_TESTNET_RPC],
      },
      public: {
        http: [ZETA_TESTNET_RPC],
      },
    },
  },
});

export interface AssetConfig {
  isSupported: boolean;
  collateralFactor: bigint;
  liquidationThreshold: bigint;
  liquidationBonus: bigint;
  borrowRate: bigint;
  supplyRate: bigint;
  totalSupply: bigint;
  totalBorrow: bigint;
}

export interface AssetData {
  address: string;
  symbol: string;
  unit: string;
  sourceChain: string;
  balance: string;
  formattedBalance: string;
  usdValue: string;
  price: string;
  isSupported: boolean;
  decimals: number;
  config?: AssetConfig | null;
}

/**
 * Get supported assets count from the lending protocol
 */
export async function getSupportedAssetsCount(): Promise<number> {
  try {
    const protocolAddress = getUniversalLendingProtocolAddress(SupportedChain.ZETA_TESTNET);
    if (!protocolAddress) {
      // eslint-disable-next-line no-console
      console.warn('UniversalLendingProtocol address not found');
      return 0;
    }

    const result = await zetaTestnetClient.readContract({
      address: protocolAddress as Address,
      abi: UniversalLendingProtocol__factory.abi,
      functionName: 'getSupportedAssetsCount',
    });

    return Number(result);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error getting supported assets count:', error);
    return 0;
  }
}

/**
 * Get supported asset address by index
 */
export async function getSupportedAsset(index: number): Promise<string | null> {
  try {
    const protocolAddress = getUniversalLendingProtocolAddress(SupportedChain.ZETA_TESTNET);
    if (!protocolAddress) {
      // eslint-disable-next-line no-console
      console.warn('UniversalLendingProtocol address not found');
      return null;
    }

    const result = await zetaTestnetClient.readContract({
      address: protocolAddress as Address,
      abi: UniversalLendingProtocol__factory.abi,
      functionName: 'getSupportedAsset',
      args: [BigInt(index)],
    });

    return result;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`Error getting supported asset at index ${index}:`, error);
    return null;
  }
}

/**
 * Get asset configuration from the lending protocol
 */
export async function getAssetConfig(assetAddress: string): Promise<AssetConfig | null> {
  try {
    const protocolAddress = getUniversalLendingProtocolAddress(SupportedChain.ZETA_TESTNET);
    if (!protocolAddress) {
      // eslint-disable-next-line no-console
      console.warn('UniversalLendingProtocol address not found');
      return null;
    }

    const result = await zetaTestnetClient.readContract({
      address: protocolAddress as Address,
      abi: UniversalLendingProtocol__factory.abi,
      functionName: 'enhancedAssets',
      args: [assetAddress as Address],
    });

    return {
      isSupported: result[0],
      collateralFactor: result[1],
      liquidationThreshold: result[2],
      liquidationBonus: result[3],
      borrowRate: result[4],
      supplyRate: result[5],
      totalSupply: result[6],
      totalBorrow: result[7],
    };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`Error getting asset config for ${assetAddress}:`, error);
    return null;
  }
}

/**
 * Get ERC20 token balance
 */
export async function getTokenBalance(tokenAddress: string, holderAddress: string): Promise<bigint> {
  try {
    const result = await zetaTestnetClient.readContract({
      address: tokenAddress as Address,
      abi: ERC20__factory.abi,
      functionName: 'balanceOf',
      args: [holderAddress as Address],
    });

    return result;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`Error getting token balance for ${tokenAddress}:`, error);
    return BigInt(0);
  }
}

export async function getAssetPrice(assetAddress: string): Promise<bigint> {
  try {
    // Use the contract's public getAssetPrice function which includes validation
    const oracleAddress = getPriceOracleAddress(SupportedChain.ZETA_TESTNET);
    if (!oracleAddress) {
      // eslint-disable-next-line no-console
      console.error('PriceOracle address not found');
      return BigInt(0);
    }

    // Call the contract's getAssetPrice function (uses _getValidatedPrice internally) 
    const price = await zetaTestnetClient.readContract({
      address: oracleAddress as Address,
      abi: IPriceOracle__factory.abi,
      functionName: 'getPrice',
      args: [assetAddress as Address],
    });

    return price;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`Error getting asset price for ${assetAddress}:`, error);
    return BigInt(0);
  }
}

/**
 * Get ERC20 token decimals
 */
export async function getTokenDecimals(tokenAddress: string): Promise<number> {
  try {
    const result = await zetaTestnetClient.readContract({
      address: tokenAddress as Address,
      abi: ERC20__factory.abi,
      functionName: 'decimals',
    });

    return result;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`Error getting token decimals for ${tokenAddress}:`, error);
    return 18; // Default to 18 decimals
  }
}

/**
 * Get ERC20 token symbol
 */
export async function getTokenSymbol(tokenAddress: string): Promise<string> {
  try {
    const result = await zetaTestnetClient.readContract({
      address: tokenAddress as Address,
      abi: ERC20__factory.abi,
      functionName: 'symbol',
    });

    return result;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`Error getting token symbol for ${tokenAddress}:`, error);
    return 'UNKNOWN';
  }
}

/**
 * Get all supported assets from the protocol
 */
export async function getAllSupportedAssets(): Promise<string[]> {
  try {
    const count = await getSupportedAssetsCount();
    const assets: string[] = [];

    for (let i = 0; i < count; i++) {
      const asset = await getSupportedAsset(i);
      if (asset) {
        assets.push(asset);
      }
    }

    return assets;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error getting all supported assets:', error);
    return [];
  }
}

/**
 * Get comprehensive asset data for the protocol
 */
export async function getProtocolAssetData(): Promise<AssetData[]> {
  try {
    const protocolAddress = getUniversalLendingProtocolAddress(SupportedChain.ZETA_TESTNET);
    if (!protocolAddress) {
      // eslint-disable-next-line no-console
      console.warn('UniversalLendingProtocol address not found');
      return [];
    }

    // Define all available assets from deployment config
    const allAssets = [
      { symbol: TOKEN_SYMBOLS.ETH_ARBI, unit: 'ETH', sourceChain: 'ARBI' },
      { symbol: TOKEN_SYMBOLS.USDC_ARBI, unit: 'USDC', sourceChain: 'ARBI' },
      { symbol: TOKEN_SYMBOLS.ETH_ETH, unit: 'ETH', sourceChain: 'ETH' },
      { symbol: TOKEN_SYMBOLS.USDC_ETH, unit: 'USDC', sourceChain: 'ETH' },
    ];

    // Get supported assets from protocol
    const supportedAssets = await getAllSupportedAssets();

    const assetsData: AssetData[] = [];

    for (const asset of allAssets) {
      const address = getTokenAddress(asset.symbol, SupportedChain.ZETA_TESTNET);
      if (!address) continue;

      const isSupported = supportedAssets.includes(address);

      // Get asset data in parallel
      const [config, balance, decimals, price] = await Promise.all([
        getAssetConfig(address),
        getTokenBalance(address, protocolAddress),
        getTokenDecimals(address),
        getAssetPrice(address),
      ]);

      // Calculate values
      // Convert balance to normalized amount (18 decimals)
      let normalizedBalance = balance;
      if (decimals < 18) {
        normalizedBalance = balance * BigInt(10 ** (18 - decimals));
      } else if (decimals > 18) {
        normalizedBalance = balance / BigInt(10 ** (decimals - 18));
      }

      // Calculate USD value: (normalizedBalance * price) / 1e18
      const balanceValue = Number(formatUnits(normalizedBalance * price, 36)); // 18 + 18 decimals

      // Format balance for display
      const formattedBalance = Number(formatUnits(balance, decimals));
      const priceInUSD = Number(formatUnits(price, 18));


      assetsData.push({
        address,
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
        decimals,
        config,
      });
    }

    return assetsData;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error getting protocol asset data:', error);
    return [];
  }
}

/**
 * Calculate total value locked (TVL) from asset data
 */
export function calculateTVL(assets: AssetData[]): number {
  return assets
    .filter(asset => asset.isSupported)
    .reduce((total, asset) => {
      // Parse USD value (remove currency formatting)
      const value = parseFloat(asset.usdValue.replace(/[$,]/g, ''));
      return total + (isNaN(value) ? 0 : value);
    }, 0);
}

/**
 * Get maximum available amount to borrow for an asset
 */
export async function getMaxAvailableAmount(assetAddress: string): Promise<bigint> {
  try {
    const protocolAddress = getUniversalLendingProtocolAddress(SupportedChain.ZETA_TESTNET);
    if (!protocolAddress) {
      // eslint-disable-next-line no-console
      console.warn('UniversalLendingProtocol address not found');
      return BigInt(0);
    }

    const result = await zetaTestnetClient.readContract({
      address: protocolAddress as Address,
      abi: UniversalLendingProtocol__factory.abi,
      functionName: 'maxAvailableAmount',
      args: [assetAddress as Address],
    });

    return result;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`Error getting max available amount for ${assetAddress}:`, error);
    return BigInt(0);
  }
}

export interface BorrowableAssetData extends AssetData {
  maxAvailableAmount: string;
  formattedMaxAvailable: string;
  isAvailableToBorrow: boolean;
  externalChainId: number;
}

/**
 * Get all borrowable assets with their availability
 */
export async function getBorrowableAssets(): Promise<BorrowableAssetData[]> {
  try {
    const protocolAddress = getUniversalLendingProtocolAddress(SupportedChain.ZETA_TESTNET);
    if (!protocolAddress) {
      // eslint-disable-next-line no-console
      console.warn('UniversalLendingProtocol address not found');
      return [];
    }

    // Define all available assets from deployment config
    const allAssets = [
      { symbol: TOKEN_SYMBOLS.ETH_ARBI, unit: 'ETH', sourceChain: 'ARBI', externalChainId: 421614 },
      { symbol: TOKEN_SYMBOLS.USDC_ARBI, unit: 'USDC', sourceChain: 'ARBI', externalChainId: 421614 },
      { symbol: TOKEN_SYMBOLS.ETH_ETH, unit: 'ETH', sourceChain: 'ETH', externalChainId: 11155111 },
      { symbol: TOKEN_SYMBOLS.USDC_ETH, unit: 'USDC', sourceChain: 'ETH', externalChainId: 11155111 },
    ];

    // Get supported assets from protocol
    const supportedAssets = await getAllSupportedAssets();

    const borrowableAssets: BorrowableAssetData[] = [];

    for (const asset of allAssets) {
      const address = getTokenAddress(asset.symbol, SupportedChain.ZETA_TESTNET);
      if (!address) continue;

      const isSupported = supportedAssets.includes(address);
      if (!isSupported) continue; // Only include supported assets for borrowing

      // Get asset data in parallel
      const [config, decimals, maxAvailable] = await Promise.all([
        getAssetConfig(address),
        getTokenDecimals(address),
        getMaxAvailableAmount(address),
      ]);

      // Calculate values
      const price = await getAssetPrice(address);

      // Format available amount for display
      const formattedMaxAvailable = Number(formatUnits(maxAvailable, decimals));
      const priceInUSD = Number(formatUnits(price, 18));
      const isAvailableToBorrow = maxAvailable > BigInt(0);

      borrowableAssets.push({
        address,
        symbol: asset.symbol,
        unit: asset.unit,
        sourceChain: asset.sourceChain,
        balance: '0', // Not relevant for borrowing
        formattedBalance: '0',
        usdValue: '$0',
        price: priceInUSD.toLocaleString('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }),
        isSupported,
        decimals,
        config,
        maxAvailableAmount: maxAvailable.toString(),
        formattedMaxAvailable: formattedMaxAvailable.toLocaleString('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 6,
        }),
        isAvailableToBorrow,
        externalChainId: asset.externalChainId,
      });
    }

    // Sort by chain first, then by symbol
    return borrowableAssets.sort((a, b) => {
      if (a.externalChainId !== b.externalChainId) {
        return a.externalChainId - b.externalChainId;
      }
      return a.unit.localeCompare(b.unit);
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error getting borrowable assets:', error);
    return [];
  }
}