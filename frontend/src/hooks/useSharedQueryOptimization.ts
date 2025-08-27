import { useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Shared query optimization to reduce redundant polling across components
 * Implements centralized cache invalidation and optimized refetch intervals
 */
export function useSharedQueryOptimization() {
    const queryClient = useQueryClient();

    // Shared cache keys for common queries
    const cacheKeys = useMemo(() => ({
        USER_SUPPLIES: 'userSupplies',
        USER_BORROWS: 'userBorrows',
        USER_ACCOUNT_DATA: 'userAccountData',
        ASSET_PRICES: 'assetPrices',
        MULTI_CHAIN_BALANCES: 'multiChainBalances',
        GAS_TOKEN_ALLOWANCES: 'gasTokenAllowances',
    }), []);

    // Optimized refetch intervals based on data sensitivity
    const refetchIntervals = useMemo(() => ({
        CRITICAL_DATA: 30000,    // 30s - User balances, health factor
        PRICE_DATA: 15000,       // 15s - Asset prices
        ALLOWANCE_DATA: 60000,   // 60s - Token allowances
        STATIC_DATA: 300000,     // 5m - Asset configs, protocol data
    }), []);

    // Invalidate related queries when transaction completes
    const invalidateTransactionRelatedQueries = useCallback(async () => {
        await Promise.all([
            queryClient.invalidateQueries({ queryKey: [cacheKeys.USER_SUPPLIES] }),
            queryClient.invalidateQueries({ queryKey: [cacheKeys.USER_BORROWS] }),
            queryClient.invalidateQueries({ queryKey: [cacheKeys.USER_ACCOUNT_DATA] }),
            queryClient.invalidateQueries({ queryKey: [cacheKeys.MULTI_CHAIN_BALANCES] }),
            queryClient.invalidateQueries({ queryKey: [cacheKeys.GAS_TOKEN_ALLOWANCES] }),
        ]);
    }, [queryClient, cacheKeys]);

    // Invalidate price-related queries
    const invalidatePriceQueries = useCallback(async () => {
        await queryClient.invalidateQueries({ queryKey: [cacheKeys.ASSET_PRICES] });
    }, [queryClient, cacheKeys]);

    // Prefetch user data to warm cache
    const prefetchUserData = useCallback(async (userAddress: string) => {
        // Implementation would go here - prefetch common user queries
        console.log('Prefetching user data for:', userAddress);
    }, []);

    return {
        cacheKeys,
        refetchIntervals,
        invalidateTransactionRelatedQueries,
        invalidatePriceQueries,
        prefetchUserData,
    };
}