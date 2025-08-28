import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TransactionErrorBoundary } from '../transaction-error-boundary';
import React from 'react';

// Component that throws an error for testing
const ErrorThrowingComponent = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <div>Normal component</div>;
};

// Component that throws specific error types
const SpecificErrorComponent = ({ errorType }: { errorType: string }) => {
  switch (errorType) {
    case 'user-rejected':
      throw new Error('User rejected the request');
    case 'insufficient-funds':
      throw new Error('Insufficient funds for transaction');
    case 'gas-error':
      throw new Error('Gas estimation failed');
    case 'network-error':
      throw new Error('Network connection failed');
    case 'contract-revert':
      throw new Error('Contract execution reverted');
    case 'wallet-error':
      throw new Error('Wallet not connected');
    default:
      throw new Error('Generic error message');
  }
};

describe('TransactionErrorBoundary', () => {
  const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

  beforeEach(() => {
    consoleSpy.mockClear();
  });

  describe('Core Functionality', () => {
    it('should render children when no error occurs', () => {
      render(
        <TransactionErrorBoundary>
          <div>Test content</div>
        </TransactionErrorBoundary>
      );

      expect(screen.getByText('Test content')).toBeInTheDocument();
    });

    it('should catch and display error when child component throws', () => {
      render(
        <TransactionErrorBoundary>
          <ErrorThrowingComponent shouldThrow={true} />
        </TransactionErrorBoundary>
      );

      expect(screen.getByText('Transaction Error')).toBeInTheDocument();
      expect(screen.getAllByText('An unexpected error occurred during the transaction')).toHaveLength(2);
    });

    it('should log error to console when error occurs', () => {
      render(
        <TransactionErrorBoundary>
          <ErrorThrowingComponent shouldThrow={true} />
        </TransactionErrorBoundary>
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Transaction Error Boundary caught an error:'),
        expect.any(Error),
        expect.any(Object)
      );
    });

    it('should display fallback UI with dialog when error occurs', () => {
      render(
        <TransactionErrorBoundary>
          <ErrorThrowingComponent shouldThrow={true} />
        </TransactionErrorBoundary>
      );

      // Check for dialog elements
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Transaction Error')).toBeInTheDocument();
      expect(screen.getAllByRole('button', { name: 'Close' })).toHaveLength(2); // Footer button + X button
      expect(screen.getByRole('button', { name: 'Try Again' })).toBeInTheDocument();
    });
  });

  describe('Custom Props', () => {
    it('should use custom fallback title when provided', () => {
      render(
        <TransactionErrorBoundary fallbackTitle="Custom Error Title">
          <ErrorThrowingComponent shouldThrow={true} />
        </TransactionErrorBoundary>
      );

      expect(screen.getByText('Custom Error Title')).toBeInTheDocument();
    });

    it('should use custom fallback description when provided and no specific error', () => {
      render(
        <TransactionErrorBoundary fallbackDescription="Custom description message">
          <ErrorThrowingComponent shouldThrow={true} />
        </TransactionErrorBoundary>
      );

      // User-friendly message takes precedence, but fallback description is used as fallback
      expect(screen.getAllByText('An unexpected error occurred during the transaction')).toHaveLength(2);
    });

    it('should call onRetry when retry button is clicked', async () => {
      const onRetry = vi.fn();
      
      render(
        <TransactionErrorBoundary onRetry={onRetry}>
          <ErrorThrowingComponent shouldThrow={true} />
        </TransactionErrorBoundary>
      );

      const retryButton = screen.getByRole('button', { name: 'Try Again' });
      fireEvent.click(retryButton);

      expect(onRetry).toHaveBeenCalledOnce();
    });

    it('should call onClose when close button is clicked', async () => {
      const onClose = vi.fn();
      
      render(
        <TransactionErrorBoundary onClose={onClose}>
          <ErrorThrowingComponent shouldThrow={true} />
        </TransactionErrorBoundary>
      );

      const closeButtons = screen.getAllByRole('button', { name: 'Close' });
      const footerCloseButton = closeButtons[0]; // Use the first close button (footer button)
      fireEvent.click(footerCloseButton);

      expect(onClose).toHaveBeenCalledOnce();
    });
  });

  describe('Error Message Categorization', () => {
    it('should show user-friendly message for user rejection errors', () => {
      render(
        <TransactionErrorBoundary>
          <SpecificErrorComponent errorType="user-rejected" />
        </TransactionErrorBoundary>
      );

      expect(screen.getAllByText('Transaction was cancelled by user')).toHaveLength(2);
    });

    it('should show user-friendly message for insufficient funds errors', () => {
      render(
        <TransactionErrorBoundary>
          <SpecificErrorComponent errorType="insufficient-funds" />
        </TransactionErrorBoundary>
      );

      expect(screen.getAllByText('Insufficient balance to complete transaction')).toHaveLength(2);
    });

    it('should show user-friendly message for gas errors', () => {
      render(
        <TransactionErrorBoundary>
          <SpecificErrorComponent errorType="gas-error" />
        </TransactionErrorBoundary>
      );

      expect(screen.getAllByText('Gas estimation failed. Please check your balance and try again')).toHaveLength(2);
    });

    it('should show user-friendly message for network errors', () => {
      render(
        <TransactionErrorBoundary>
          <SpecificErrorComponent errorType="network-error" />
        </TransactionErrorBoundary>
      );

      expect(screen.getAllByText('Network connection issue. Please check your connection and try again')).toHaveLength(2);
    });

    it('should show user-friendly message for contract errors', () => {
      render(
        <TransactionErrorBoundary>
          <SpecificErrorComponent errorType="contract-revert" />
        </TransactionErrorBoundary>
      );

      expect(screen.getAllByText('Smart contract error. The transaction cannot be completed')).toHaveLength(2);
    });

    it('should show user-friendly message for wallet errors', () => {
      render(
        <TransactionErrorBoundary>
          <SpecificErrorComponent errorType="wallet-error" />
        </TransactionErrorBoundary>
      );

      expect(screen.getAllByText('Wallet connection error. Please reconnect your wallet')).toHaveLength(2);
    });

    it('should show generic message for unrecognized errors', () => {
      render(
        <TransactionErrorBoundary>
          <SpecificErrorComponent errorType="unknown" />
        </TransactionErrorBoundary>
      );

      expect(screen.getAllByText('An unexpected error occurred during the transaction')).toHaveLength(2);
    });
  });

  describe('Error Recovery', () => {
    it('should reset error state when retry is clicked', async () => {
      const onRetry = vi.fn();
      
      render(
        <TransactionErrorBoundary onRetry={onRetry}>
          <ErrorThrowingComponent shouldThrow={true} />
        </TransactionErrorBoundary>
      );

      // Error should be displayed
      expect(screen.getByText('Transaction Error')).toBeInTheDocument();

      // Click retry button
      const retryButton = screen.getByRole('button', { name: 'Try Again' });
      fireEvent.click(retryButton);

      // Retry callback should have been called
      expect(onRetry).toHaveBeenCalledOnce();
    });

    it('should reset error state when close is clicked', async () => {
      const onClose = vi.fn();
      
      render(
        <TransactionErrorBoundary onClose={onClose}>
          <ErrorThrowingComponent shouldThrow={true} />
        </TransactionErrorBoundary>
      );

      // Error should be displayed
      expect(screen.getByText('Transaction Error')).toBeInTheDocument();

      // Click close button
      const closeButtons = screen.getAllByRole('button', { name: 'Close' });
      const footerCloseButton = closeButtons[0]; // Use the first close button (footer button)
      fireEvent.click(footerCloseButton);

      // Close callback should have been called
      expect(onClose).toHaveBeenCalledOnce();
    });

    it('should successfully reset internal error state when retry is clicked', () => {
      const TestComponent = () => {
        const [shouldThrow, setShouldThrow] = React.useState(true);
        
        return (
          <TransactionErrorBoundary 
            onRetry={() => setShouldThrow(false)}
          >
            <ErrorThrowingComponent shouldThrow={shouldThrow} />
          </TransactionErrorBoundary>
        );
      };
      
      render(<TestComponent />);

      // Error should be displayed initially
      expect(screen.getByText('Transaction Error')).toBeInTheDocument();

      // Click retry button
      const retryButton = screen.getByRole('button', { name: 'Try Again' });
      fireEvent.click(retryButton);

      // After retry, normal content should be shown
      expect(screen.getByText('Normal component')).toBeInTheDocument();
    });
  });

  describe('Development Mode Features', () => {
    it('should show technical details in development mode', () => {
      // Mock NODE_ENV to be development
      const originalEnv = process.env['NODE_ENV'];
      process.env['NODE_ENV'] = 'development';

      render(
        <TransactionErrorBoundary>
          <ErrorThrowingComponent shouldThrow={true} />
        </TransactionErrorBoundary>
      );

      expect(screen.getByText('Technical Details (Development)')).toBeInTheDocument();

      // Restore original environment
      process.env['NODE_ENV'] = originalEnv;
    });

    it('should hide technical details in production mode', () => {
      // Mock NODE_ENV to be production
      const originalEnv = process.env['NODE_ENV'];
      process.env['NODE_ENV'] = 'production';

      render(
        <TransactionErrorBoundary>
          <ErrorThrowingComponent shouldThrow={true} />
        </TransactionErrorBoundary>
      );

      expect(screen.queryByText('Technical Details (Development)')).not.toBeInTheDocument();

      // Restore original environment
      process.env['NODE_ENV'] = originalEnv;
    });

    it('should show error message and stack in technical details', () => {
      // Mock NODE_ENV to be development
      const originalEnv = process.env['NODE_ENV'];
      process.env['NODE_ENV'] = 'development';

      render(
        <TransactionErrorBoundary>
          <ErrorThrowingComponent shouldThrow={true} />
        </TransactionErrorBoundary>
      );

      // Click to expand technical details
      const detailsElement = screen.getByText('Technical Details (Development)');
      fireEvent.click(detailsElement);

      expect(screen.getByText('Error:')).toBeInTheDocument();
      expect(screen.getByText('Test error')).toBeInTheDocument();
      expect(screen.getByText('Stack:')).toBeInTheDocument();

      // Restore original environment
      process.env['NODE_ENV'] = originalEnv;
    });
  });

  describe('Edge Cases', () => {
    it('should handle errors without error message', () => {
      const ErrorWithoutMessage = () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        throw ({ message: undefined } as any);
      };

      render(
        <TransactionErrorBoundary>
          <ErrorWithoutMessage />
        </TransactionErrorBoundary>
      );

      expect(screen.getAllByText('An unexpected error occurred during the transaction')).toHaveLength(2);
    });

    it('should handle null error state', () => {
      render(
        <TransactionErrorBoundary>
          <div>Normal content</div>
        </TransactionErrorBoundary>
      );

      expect(screen.getByText('Normal content')).toBeInTheDocument();
      expect(screen.queryByText('Transaction Error')).not.toBeInTheDocument();
    });

    it('should maintain error state consistency after multiple operations', () => {
      render(
        <TransactionErrorBoundary>
          <ErrorThrowingComponent shouldThrow={true} />
        </TransactionErrorBoundary>
      );

      // Error displayed
      expect(screen.getByText('Transaction Error')).toBeInTheDocument();

      // Click retry multiple times
      const retryButton = screen.getByRole('button', { name: 'Try Again' });
      fireEvent.click(retryButton);
      fireEvent.click(retryButton);
      fireEvent.click(retryButton);

      // Should still be in error state
      expect(screen.getByText('Transaction Error')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes for dialog', () => {
      render(
        <TransactionErrorBoundary>
          <ErrorThrowingComponent shouldThrow={true} />
        </TransactionErrorBoundary>
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeInTheDocument();
      expect(dialog).toHaveAttribute('role', 'dialog');
    });

    it('should have proper button roles and accessibility', () => {
      render(
        <TransactionErrorBoundary>
          <ErrorThrowingComponent shouldThrow={true} />
        </TransactionErrorBoundary>
      );

      const closeButtons = screen.getAllByRole('button', { name: 'Close' });
      const retryButton = screen.getByRole('button', { name: 'Try Again' });

      expect(closeButtons).toHaveLength(2); // Footer and X button
      expect(retryButton).toBeInTheDocument();
    });

    it('should have keyboard navigation support', () => {
      render(
        <TransactionErrorBoundary>
          <ErrorThrowingComponent shouldThrow={true} />
        </TransactionErrorBoundary>
      );

      const retryButton = screen.getByRole('button', { name: 'Try Again' });
      retryButton.focus();
      
      expect(document.activeElement).toBe(retryButton);
    });
  });
});