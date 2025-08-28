import React, { Component, ReactNode } from 'react';
import { Button } from './button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from './dialog';

interface TransactionErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
    errorInfo: React.ErrorInfo | null;
}

interface TransactionErrorBoundaryProps {
    children: ReactNode;
    fallbackTitle?: string;
    fallbackDescription?: string;
    onRetry?: () => void;
    onClose?: () => void;
}

/**
 * Error boundary specifically designed for transaction components
 * Provides a user-friendly error display with recovery options
 */
export class TransactionErrorBoundary extends Component<
    TransactionErrorBoundaryProps,
    TransactionErrorBoundaryState
> {
    constructor(props: TransactionErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error: Error): TransactionErrorBoundaryState {
        // Update state so the next render will show the fallback UI
        return { hasError: true, error, errorInfo: null };
    }

    override componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        // Log error details for debugging
        console.error('Transaction Error Boundary caught an error:', error, errorInfo);

        // Update state with error info
        this.setState({
            hasError: true,
            error,
            errorInfo,
        });

        // You could also log the error to an error reporting service here
        // Example: Sentry.captureException(error, { contexts: { react: errorInfo } });
    }

    handleRetry = () => {
        // Reset error state
        this.setState({ hasError: false, error: null, errorInfo: null });

        // Call parent retry function if provided
        if (this.props.onRetry) {
            this.props.onRetry();
        }
    };

    handleClose = () => {
        // Reset error state
        this.setState({ hasError: false, error: null, errorInfo: null });

        // Call parent close function if provided
        if (this.props.onClose) {
            this.props.onClose();
        }
    };

    /**
     * Get user-friendly error message based on error type
     */
    private getUserFriendlyMessage(error: Error): string {
        const message = error.message?.toLowerCase() || '';

        // Web3/Transaction specific errors
        if (message.includes('user rejected') || message.includes('user denied')) {
            return 'Transaction was cancelled by user';
        }

        if (message.includes('insufficient funds') || message.includes('insufficient balance')) {
            return 'Insufficient balance to complete transaction';
        }

        if (message.includes('gas')) {
            return 'Gas estimation failed. Please check your balance and try again';
        }

        if (message.includes('network') || message.includes('connection')) {
            return 'Network connection issue. Please check your connection and try again';
        }

        if (message.includes('contract') || message.includes('revert')) {
            return 'Smart contract error. The transaction cannot be completed';
        }

        if (message.includes('wallet')) {
            return 'Wallet connection error. Please reconnect your wallet';
        }

        // Generic fallback
        return 'An unexpected error occurred during the transaction';
    }

    override render() {
        if (this.state.hasError) {
            const {
                fallbackTitle = 'Transaction Error',
                fallbackDescription = 'Something went wrong with your transaction',
            } = this.props;

            const userFriendlyMessage = this.state.error
                ? this.getUserFriendlyMessage(this.state.error)
                : fallbackDescription;

            return (
                <Dialog open={true} onOpenChange={this.handleClose}>
                    <DialogContent className="sm:max-w-md max-w-[95vw]">
                        <DialogHeader>
                            <DialogTitle className="text-destructive">
                                {fallbackTitle}
                            </DialogTitle>
                            <DialogDescription className="text-muted-foreground">
                                {userFriendlyMessage}
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4">
                            {/* User-friendly error details */}
                            <div className="p-3 border border-destructive/20 rounded-lg bg-destructive/10">
                                <div className="text-sm text-destructive">
                                    <strong>What happened:</strong>
                                </div>
                                <div className="text-xs text-destructive/80 mt-1">
                                    {userFriendlyMessage}
                                </div>
                            </div>

                            {/* Technical details (collapsed by default) */}
                            {process.env['NODE_ENV'] === 'development' && this.state.error && (
                                <details className="text-xs text-muted-foreground">
                                    <summary className="cursor-pointer hover:text-foreground">
                                        Technical Details (Development)
                                    </summary>
                                    <div className="mt-2 p-2 bg-muted rounded border text-xs font-mono">
                                        <div><strong>Error:</strong> {this.state.error.message}</div>
                                        {this.state.error.stack && (
                                            <div className="mt-1">
                                                <strong>Stack:</strong>
                                                <pre className="whitespace-pre-wrap">{this.state.error.stack}</pre>
                                            </div>
                                        )}
                                    </div>
                                </details>
                            )}
                        </div>

                        <DialogFooter>
                            <Button variant="outline" onClick={this.handleClose}>
                                Close
                            </Button>
                            <Button variant="zeta" onClick={this.handleRetry}>
                                Try Again
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            );
        }

        return this.props.children;
    }
}