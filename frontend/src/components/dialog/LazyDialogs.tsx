import React, { Suspense } from 'react';
import { Spinner } from '../ui/spinner';

/**
 * Lazy-loaded dialog components for optimal bundle splitting
 * This reduces the initial bundle size by loading dialogs only when needed
 */

// Lazy load transaction dialogs
const BorrowDialog = React.lazy(() => import('../dashboard/BorrowDialog'));
const SupplyDialog = React.lazy(() => import('../dashboard/SupplyDialog'));
const RepayDialog = React.lazy(() => import('../dashboard/RepayDialog'));
const WithdrawDialog = React.lazy(() => import('../dashboard/WithdrawDialog'));
const ZetaBorrowDialog = React.lazy(() => import('../dashboard/ZetaBorrowDialog'));
const ZetaSupplyDialog = React.lazy(() => import('../dashboard/ZetaSupplyDialog'));
const ZetaRepayDialog = React.lazy(() => import('../dashboard/ZetaRepayDialog'));
const ZetaWithdrawDialog = React.lazy(() => import('../dashboard/ZetaWithdrawDialog'));
const LiquidationDialog = React.lazy(() => import('../liquidation/LiquidationDialog'));

// Lazy load Solana dialogs
const SolanaSupplyDialog = React.lazy(() => import('../dashboard/solana/SolanaSupplyDialog'));

// Loading fallback component
function DialogLoadingFallback() {
    return (
        <div className="flex items-center justify-center p-8">
            <Spinner className="w-6 h-6" />
            <span className="ml-2 text-sm text-muted-foreground">Loading...</span>
        </div>
    );
}

// HOC to wrap lazy dialogs with Suspense
function withSuspense<P extends object>(Component: React.LazyExoticComponent<React.ComponentType<P>>) {
    return function SuspenseWrapper(props: P) {
        return (
            <Suspense fallback={<DialogLoadingFallback />}>
                <Component {...props} />
            </Suspense>
        );
    };
}

// Export lazy-loaded components wrapped with Suspense
export const LazyBorrowDialog = withSuspense(BorrowDialog);
export const LazySupplyDialog = withSuspense(SupplyDialog);
export const LazyRepayDialog = withSuspense(RepayDialog);
export const LazyWithdrawDialog = withSuspense(WithdrawDialog);
export const LazyZetaBorrowDialog = withSuspense(ZetaBorrowDialog);
export const LazyZetaSupplyDialog = withSuspense(ZetaSupplyDialog);
export const LazyZetaRepayDialog = withSuspense(ZetaRepayDialog);
export const LazyZetaWithdrawDialog = withSuspense(ZetaWithdrawDialog);
export const LazyLiquidationDialog = withSuspense(LiquidationDialog);
export const LazySolanaSupplyDialog = withSuspense(SolanaSupplyDialog);