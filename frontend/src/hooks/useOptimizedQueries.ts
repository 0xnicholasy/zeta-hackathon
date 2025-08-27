import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { queryKeys, getTransactionInvalidationKeys } from '../config/queryConfig';

/**
 * Hook for optimized query management and cache invalidation
 * Provides utilities to efficiently manage the shared query cache
 */
export function useOptimizedQueries() {
  const queryClient = useQueryClient();

  // Invalidate all user-related queries after a transaction
  const invalidateUserQueries = useCallback(async (userAddress: string) => {
    const keysToInvalidate = getTransactionInvalidationKeys(userAddress);
    
    await Promise.all(
      keysToInvalidate.map(key => 
        queryClient.invalidateQueries({ queryKey: key })
      )
    );
  }, [queryClient]);

  // Invalidate price queries when prices might have changed
  const invalidatePriceQueries = useCallback(async (assets?: string[]) => {
    if (assets && assets.length > 0) {
      // Invalidate specific asset prices
      await Promise.all(
        assets.map(asset =>
          queryClient.invalidateQueries({ queryKey: queryKeys.singleAssetPrice(asset) })
        )
      );
    } else {
      // Invalidate all price queries
      await queryClient.invalidateQueries({ 
        predicate: (query) => 
          Array.isArray(query.queryKey) && 
          (query.queryKey[0] === 'assetPrices' || query.queryKey[0] === 'assetPrice')
      });
    }
  }, [queryClient]);

  // Prefetch commonly needed data
  const prefetchUserData = useCallback(async (
    userAddress: string, 
    assets: string[],
    chains: number[]
  ) => {
    // Prefetch user supplies and borrows
    await Promise.all([
      queryClient.prefetchQuery({
        queryKey: queryKeys.userSupplies(userAddress, assets),
        staleTime: 30000, // Consider fresh for 30s
      }),
      queryClient.prefetchQuery({
        queryKey: queryKeys.userBorrows(userAddress, assets),
        staleTime: 30000,
      }),
      queryClient.prefetchQuery({
        queryKey: queryKeys.userAccountData(userAddress),
        staleTime: 30000,
      }),
      queryClient.prefetchQuery({
        queryKey: queryKeys.multiChainBalances(userAddress, chains),
        staleTime: 30000,
      }),
    ]);
  }, [queryClient]);

  // Clear cache for specific data types
  const clearUserCache = useCallback((userAddress: string) => {
    const keysToRemove = getTransactionInvalidationKeys(userAddress);
    
    keysToRemove.forEach(key => {
      queryClient.removeQueries({ queryKey: key });
    });
  }, [queryClient]);

  // Get cache statistics for debugging
  const getCacheStats = useCallback(() => {
    const cache = queryClient.getQueryCache();
    const queries = cache.getAll();
    
    const stats = {
      totalQueries: queries.length,
      userQueries: queries.filter(q => 
        Array.isArray(q.queryKey) && 
        ['userSupplies', 'userBorrows', 'userAccountData'].includes(q.queryKey[0] as string)
      ).length,
      priceQueries: queries.filter(q => 
        Array.isArray(q.queryKey) && 
        ['assetPrices', 'assetPrice'].includes(q.queryKey[0] as string)
      ).length,
      staleQueries: queries.filter(q => q.isStale()).length,
      fetchingQueries: queries.filter(q => q.state.fetchStatus === 'fetching').length,
    };

    return stats;
  }, [queryClient]);

  // Batch invalidate multiple query types
  const batchInvalidate = useCallback(async (options: {
    userAddress?: string;
    invalidatePrices?: boolean;
    invalidateAllowances?: boolean;
    assets?: string[];
  }) => {
    const promises: Promise<void>[] = [];

    if (options.userAddress) {
      promises.push(invalidateUserQueries(options.userAddress));
    }

    if (options.invalidatePrices) {
      promises.push(invalidatePriceQueries(options.assets));
    }

    if (options.invalidateAllowances && options.userAddress) {
      promises.push(
        queryClient.invalidateQueries({
          predicate: (query) =>
            Array.isArray(query.queryKey) && 
            query.queryKey[0] === 'tokenAllowances' &&
            query.queryKey[1] === options.userAddress
        })
      );
    }

    await Promise.all(promises);
  }, [queryClient, invalidateUserQueries, invalidatePriceQueries]);

  return {
    // Cache invalidation
    invalidateUserQueries,
    invalidatePriceQueries,
    batchInvalidate,
    
    // Cache management
    prefetchUserData,
    clearUserCache,
    
    // Debugging
    getCacheStats,
    
    // Direct access to query client if needed
    queryClient,
  };
}