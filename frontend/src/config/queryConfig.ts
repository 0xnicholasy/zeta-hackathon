import { QueryClient } from '@tanstack/react-query';

/**
 * Optimized React Query configuration to reduce redundant API calls
 * and improve performance across the lending protocol interface
 */

// Stale time configuration based on data sensitivity
export const STALE_TIME_CONFIG = {
  // Critical user data that changes frequently
  USER_BALANCES: 30000,        // 30s - User supply/borrow balances
  USER_POSITIONS: 30000,       // 30s - Health factor, account data
  
  // Price data that needs to be relatively fresh
  ASSET_PRICES: 15000,         // 15s - Token prices from oracle
  
  // Allowances that change less frequently
  TOKEN_ALLOWANCES: 60000,     // 60s - ERC20 allowances
  
  // Static or slowly changing data
  ASSET_CONFIGS: 300000,       // 5m - Asset configurations
  PROTOCOL_DATA: 300000,       // 5m - Protocol global data
  CONTRACT_METADATA: 600000,   // 10m - Contract addresses, ABIs
} as const;

// Cache time configuration - how long to keep data in cache after unused
export const CACHE_TIME_CONFIG = {
  USER_DATA: 600000,          // 10m - User-specific data
  PRICE_DATA: 300000,         // 5m - Price data
  STATIC_DATA: 1800000,       // 30m - Static configurations
} as const;

// Retry configuration for different types of queries
export const RETRY_CONFIG = {
  USER_QUERIES: {
    retry: 3,
    retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 30000),
  },
  PRICE_QUERIES: {
    retry: 2,
    retryDelay: (attemptIndex: number) => Math.min(500 * 2 ** attemptIndex, 5000),
  },
  STATIC_QUERIES: {
    retry: 1,
    retryDelay: 1000,
  },
} as const;

/**
 * Create an optimized query client for the lending protocol
 */
export function createOptimizedQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Default stale time - data is fresh for 30 seconds
        staleTime: STALE_TIME_CONFIG.USER_BALANCES,
        // Default cache time - keep in cache for 10 minutes after unused
        gcTime: CACHE_TIME_CONFIG.USER_DATA,
        // Retry failed queries with exponential backoff
        retry: RETRY_CONFIG.USER_QUERIES.retry,
        retryDelay: RETRY_CONFIG.USER_QUERIES.retryDelay,
        // Refetch on window focus for critical data
        refetchOnWindowFocus: true,
        // Don't refetch on reconnect by default (can be overridden per query)
        refetchOnReconnect: 'always',
        // Background refetch interval - disabled by default
        refetchInterval: false,
      },
      mutations: {
        // Retry mutations once by default
        retry: 1,
        retryDelay: 1000,
      },
    },
  });
}

/**
 * Query key factory for consistent cache keys across the application
 */
export const queryKeys = {
  // User-specific queries
  userSupplies: (userAddress: string, assets: string[]) => 
    ['userSupplies', userAddress, assets] as const,
  userBorrows: (userAddress: string, assets: string[]) => 
    ['userBorrows', userAddress, assets] as const,
  userAccountData: (userAddress: string) => 
    ['userAccountData', userAddress] as const,
  multiChainBalances: (userAddress: string, chains: number[]) => 
    ['multiChainBalances', userAddress, chains] as const,
  
  // Price-related queries
  assetPrices: (assets: string[]) => 
    ['assetPrices', assets] as const,
  singleAssetPrice: (asset: string) => 
    ['assetPrice', asset] as const,
  
  // Token queries
  tokenAllowances: (userAddress: string, tokens: string[], spender: string) => 
    ['tokenAllowances', userAddress, tokens, spender] as const,
  tokenBalances: (userAddress: string, tokens: string[]) => 
    ['tokenBalances', userAddress, tokens] as const,
  
  // Protocol queries
  assetConfigs: (assets: string[]) => 
    ['assetConfigs', assets] as const,
  protocolGlobalData: () => 
    ['protocolGlobalData'] as const,
  supportedAssets: () => 
    ['supportedAssets'] as const,
  
  // Validation queries
  borrowValidation: (userAddress: string, asset: string, amount: string) => 
    ['borrowValidation', userAddress, asset, amount] as const,
  withdrawValidation: (userAddress: string, asset: string, amount: string, targetChain: number) => 
    ['withdrawValidation', userAddress, asset, amount, targetChain] as const,
} as const;

/**
 * Utility to invalidate related queries after transactions
 */
export function getTransactionInvalidationKeys(userAddress: string) {
  return [
    queryKeys.userSupplies(userAddress, []),
    queryKeys.userBorrows(userAddress, []),
    queryKeys.userAccountData(userAddress),
    queryKeys.multiChainBalances(userAddress, []),
    queryKeys.tokenAllowances(userAddress, [], ''),
    queryKeys.tokenBalances(userAddress, []),
  ];
}