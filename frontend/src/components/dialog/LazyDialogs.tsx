import React, { Suspense } from 'react';
import { Spinner } from '../ui/spinner';

/**
 * Lazy-loaded dialog components for optimal bundle splitting
 * This reduces the initial bundle size by loading dialogs only when needed
 */

// Lazy load transaction dialogs
const BorrowDialog = React.lazy(() => import('../dashboard/BorrowDialog').then(m => ({ default: m.BorrowDialog })));
const SupplyDialog = React.lazy(() => import('../dashboard/SupplyDialog').then(m => ({ default: m.SupplyDialog })));
const RepayDialog = React.lazy(() => import('../dashboard/RepayDialog').then(m => ({ default: m.RepayDialog })));
const WithdrawDialog = React.lazy(() => import('../dashboard/WithdrawDialog').then(m => ({ default: m.WithdrawDialog })));
const ZetaBorrowDialog = React.lazy(() => import('../dashboard/ZetaBorrowDialog').then(m => ({ default: m.ZetaBorrowDialog })));
const ZetaSupplyDialog = React.lazy(() => import('../dashboard/ZetaSupplyDialog').then(m => ({ default: m.ZetaSupplyDialog })));
const ZetaRepayDialog = React.lazy(() => import('../dashboard/ZetaRepayDialog').then(m => ({ default: m.ZetaRepayDialog })));
const ZetaWithdrawDialog = React.lazy(() => import('../dashboard/ZetaWithdrawDialog').then(m => ({ default: m.ZetaWithdrawDialog })));
const LiquidationDialog = React.lazy(() => import('../liquidation/LiquidationDialog').then(m => ({ default: m.LiquidationDialog })));

// Lazy load Solana dialogs
const SolanaSupplyDialog = React.lazy(() => import('../dashboard/solana/SolanaSupplyDialog').then(m => ({ default: m.SolanaSupplyDialog })));

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