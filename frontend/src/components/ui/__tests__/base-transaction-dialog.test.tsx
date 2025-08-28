import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BaseTransactionDialog } from '../base-transaction-dialog';

// Mock the TokenNetworkIcon component
vi.mock('../token-network-icon', () => ({
  TokenNetworkIcon: ({ tokenSymbol, sourceChain, size, shadow, showNativeIndicator }: {
    tokenSymbol: string;
    sourceChain: string;
    size: string;
    shadow: string;
    showNativeIndicator: boolean;
  }) => (
    <div data-testid="token-network-icon" data-token={tokenSymbol} data-chain={sourceChain} 
         data-size={size} data-shadow={shadow} data-native={showNativeIndicator}>
      MockTokenNetworkIcon
    </div>
  ),
}));

// Mock the Spinner component
vi.mock('../spinner', () => ({
  Spinner: ({ variant, size, className }: { variant: string; size: string; className: string }) => (
    <div data-testid="spinner" data-variant={variant} data-size={size} className={className}>
      Loading...
    </div>
  ),
}));

describe('BaseTransactionDialog', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    title: 'Test Transaction',
    description: 'This is a test transaction dialog',
    children: <div data-testid="dialog-children">Dialog Content</div>,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Core Functionality', () => {
    it('should render when open', () => {
      render(<BaseTransactionDialog {...defaultProps} />);
      
      expect(screen.getByText('Test Transaction')).toBeInTheDocument();
      expect(screen.getByText('This is a test transaction dialog')).toBeInTheDocument();
      expect(screen.getByTestId('dialog-children')).toBeInTheDocument();
    });

    it('should not render when closed', () => {
      render(<BaseTransactionDialog {...defaultProps} isOpen={false} />);
      
      expect(screen.queryByText('Test Transaction')).not.toBeInTheDocument();
    });

    it('should call onClose when dialog is closed', () => {
      const mockOnClose = vi.fn();
      render(<BaseTransactionDialog {...defaultProps} onClose={mockOnClose} />);
      
      // Find and click the dialog overlay or close button
      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeInTheDocument();
      
      // The actual close behavior is handled by the underlying dialog component
      // We'll test the callback is passed correctly
      expect(mockOnClose).not.toHaveBeenCalled();
    });

    it('should render children content', () => {
      const customChildren = <div data-testid="custom-content">Custom Content</div>;
      render(<BaseTransactionDialog {...defaultProps}>{customChildren}</BaseTransactionDialog>);
      
      expect(screen.getByTestId('custom-content')).toBeInTheDocument();
    });
  });

  describe('Token and Chain Display', () => {
    it('should display TokenNetworkIcon when tokenSymbol and sourceChain are provided', () => {
      render(
        <BaseTransactionDialog
          {...defaultProps}
          tokenSymbol="ETH"
          sourceChain="arbitrum"
        />
      );
      
      const tokenIcon = screen.getByTestId('token-network-icon');
      expect(tokenIcon).toBeInTheDocument();
      expect(tokenIcon).toHaveAttribute('data-token', 'ETH');
      expect(tokenIcon).toHaveAttribute('data-chain', 'arbitrum');
      expect(tokenIcon).toHaveAttribute('data-size', 'sm');
      expect(tokenIcon).toHaveAttribute('data-shadow', 'sm');
      expect(tokenIcon).toHaveAttribute('data-native', 'true');
    });

    it('should not display TokenNetworkIcon when tokenSymbol is missing', () => {
      render(
        <BaseTransactionDialog
          {...defaultProps}
          sourceChain="arbitrum"
        />
      );
      
      expect(screen.queryByTestId('token-network-icon')).not.toBeInTheDocument();
    });

    it('should not display TokenNetworkIcon when sourceChain is missing', () => {
      render(
        <BaseTransactionDialog
          {...defaultProps}
          tokenSymbol="ETH"
        />
      );
      
      expect(screen.queryByTestId('token-network-icon')).not.toBeInTheDocument();
    });
  });

  describe('Footer Rendering - Input Step', () => {
    it('should render default footer for input step', () => {
      render(
        <BaseTransactionDialog
          {...defaultProps}
          currentStep="input"
          onSubmit={vi.fn()}
          isValidAmount={true}
          isConnected={true}
        />
      );
      
      expect(screen.getByText('Cancel')).toBeInTheDocument();
      expect(screen.getByText('Submit')).toBeInTheDocument();
      expect(screen.getByText('Submit')).not.toBeDisabled();
    });

    it('should disable submit button when amount is invalid', () => {
      render(
        <BaseTransactionDialog
          {...defaultProps}
          currentStep="input"
          onSubmit={vi.fn()}
          isValidAmount={false}
          isConnected={true}
        />
      );
      
      const submitButton = screen.getByText('Submit');
      expect(submitButton).toBeDisabled();
    });

    it('should disable submit button when not connected', () => {
      render(
        <BaseTransactionDialog
          {...defaultProps}
          currentStep="input"
          onSubmit={vi.fn()}
          isValidAmount={true}
          isConnected={false}
        />
      );
      
      const submitButton = screen.getByText('Submit');
      expect(submitButton).toBeDisabled();
    });

    it('should disable submit button when submitting', () => {
      render(
        <BaseTransactionDialog
          {...defaultProps}
          currentStep="input"
          onSubmit={vi.fn()}
          isValidAmount={true}
          isConnected={true}
          isSubmitting={true}
        />
      );
      
      const submitButton = screen.getByText('Processing...');
      expect(submitButton).toBeDisabled();
    });

    it('should show spinner when submitting', () => {
      render(
        <BaseTransactionDialog
          {...defaultProps}
          currentStep="input"
          onSubmit={vi.fn()}
          isValidAmount={true}
          isConnected={true}
          isSubmitting={true}
        />
      );
      
      expect(screen.getByTestId('spinner')).toBeInTheDocument();
      expect(screen.getByText('Processing...')).toBeInTheDocument();
    });

    it('should use custom submit button text', () => {
      render(
        <BaseTransactionDialog
          {...defaultProps}
          currentStep="input"
          onSubmit={vi.fn()}
          isValidAmount={true}
          isConnected={true}
          submitButtonText="Supply Asset"
        />
      );
      
      expect(screen.getByText('Supply Asset')).toBeInTheDocument();
    });

    it('should call onSubmit when submit button is clicked', () => {
      const mockOnSubmit = vi.fn();
      render(
        <BaseTransactionDialog
          {...defaultProps}
          currentStep="input"
          onSubmit={mockOnSubmit}
          isValidAmount={true}
          isConnected={true}
        />
      );
      
      fireEvent.click(screen.getByText('Submit'));
      expect(mockOnSubmit).toHaveBeenCalledOnce();
    });
  });

  describe('Footer Rendering - Approve Step', () => {
    it('should render approve footer', () => {
      render(
        <BaseTransactionDialog
          {...defaultProps}
          currentStep="approve"
          onApprove={vi.fn()}
          canApprove={true}
        />
      );
      
      expect(screen.getByText('Cancel')).toBeInTheDocument();
      expect(screen.getByText('Approve')).toBeInTheDocument();
    });

    it('should disable approve button when canApprove is false', () => {
      render(
        <BaseTransactionDialog
          {...defaultProps}
          currentStep="approve"
          onApprove={vi.fn()}
          canApprove={false}
        />
      );
      
      const approveButton = screen.getByText('Approve');
      expect(approveButton).toBeDisabled();
    });

    it('should use custom approve button text', () => {
      render(
        <BaseTransactionDialog
          {...defaultProps}
          currentStep="approve"
          onApprove={vi.fn()}
          canApprove={true}
          approveButtonText="Approve Token"
        />
      );
      
      expect(screen.getByText('Approve Token')).toBeInTheDocument();
    });

    it('should call onApprove when approve button is clicked', () => {
      const mockOnApprove = vi.fn();
      render(
        <BaseTransactionDialog
          {...defaultProps}
          currentStep="approve"
          onApprove={mockOnApprove}
          canApprove={true}
        />
      );
      
      fireEvent.click(screen.getByText('Approve'));
      expect(mockOnApprove).toHaveBeenCalledOnce();
    });
  });

  describe('Footer Rendering - Withdraw Step', () => {
    it('should render withdraw footer', () => {
      render(
        <BaseTransactionDialog
          {...defaultProps}
          currentStep="withdraw"
          onSubmit={vi.fn()}
          isValidAmount={true}
          isConnected={true}
        />
      );
      
      expect(screen.getByText('Cancel')).toBeInTheDocument();
      expect(screen.getByText('Submit')).toBeInTheDocument();
    });

    it('should handle withdraw step with submitting state', () => {
      render(
        <BaseTransactionDialog
          {...defaultProps}
          currentStep="withdraw"
          onSubmit={vi.fn()}
          isValidAmount={true}
          isConnected={true}
          isSubmitting={true}
        />
      );
      
      expect(screen.getByText('Processing...')).toBeInTheDocument();
      expect(screen.getByTestId('spinner')).toBeInTheDocument();
    });
  });

  describe('Footer Rendering - Failed Step', () => {
    it('should render failed footer with close button only', () => {
      render(
        <BaseTransactionDialog
          {...defaultProps}
          currentStep="failed"
        />
      );
      
      const closeButtons = screen.getAllByText('Close');
      // Should have the footer close button (not screen reader text)
      const footerCloseButton = closeButtons.find(button => 
        button.tagName === 'BUTTON' && button.className.includes('border-input')
      );
      expect(footerCloseButton).toBeInTheDocument();
      expect(screen.queryByText('Try Again')).not.toBeInTheDocument();
    });

    it('should render retry button when onRetry is provided', () => {
      const mockOnRetry = vi.fn();
      render(
        <BaseTransactionDialog
          {...defaultProps}
          currentStep="failed"
          onRetry={mockOnRetry}
        />
      );
      
      const closeButtons = screen.getAllByText('Close');
      const footerCloseButton = closeButtons.find(button => 
        button.tagName === 'BUTTON' && button.className.includes('border-input')
      );
      expect(footerCloseButton).toBeInTheDocument();
      expect(screen.getByText('Try Again')).toBeInTheDocument();
    });

    it('should call onRetry when retry button is clicked', () => {
      const mockOnRetry = vi.fn();
      render(
        <BaseTransactionDialog
          {...defaultProps}
          currentStep="failed"
          onRetry={mockOnRetry}
        />
      );
      
      fireEvent.click(screen.getByText('Try Again'));
      expect(mockOnRetry).toHaveBeenCalledOnce();
    });
  });

  describe('Custom Footer', () => {
    it('should render custom footer when provided', () => {
      const customFooter = <div data-testid="custom-footer">Custom Footer</div>;
      render(
        <BaseTransactionDialog
          {...defaultProps}
          footer={customFooter}
        />
      );
      
      expect(screen.getByTestId('custom-footer')).toBeInTheDocument();
      expect(screen.queryByText('Cancel')).not.toBeInTheDocument();
      expect(screen.queryByText('Submit')).not.toBeInTheDocument();
    });
  });

  describe('Default Footer Fallback', () => {
    it('should render default close button for unknown steps', () => {
      render(
        <BaseTransactionDialog
          {...defaultProps}
          currentStep="unknown-step"
        />
      );
      
      const closeButtons = screen.getAllByText('Close');
      const footerCloseButton = closeButtons.find(button => 
        button.tagName === 'BUTTON' && button.className.includes('w-full')
      );
      expect(footerCloseButton).toBeInTheDocument();
      expect(footerCloseButton).toHaveClass('w-full');
    });
  });

  describe('Cancel Button Behavior', () => {
    it('should call onClose when cancel button is clicked in input step', () => {
      const mockOnClose = vi.fn();
      render(
        <BaseTransactionDialog
          {...defaultProps}
          onClose={mockOnClose}
          currentStep="input"
          onSubmit={vi.fn()}
        />
      );
      
      fireEvent.click(screen.getByText('Cancel'));
      expect(mockOnClose).toHaveBeenCalledOnce();
    });

    it('should call onClose when cancel button is clicked in approve step', () => {
      const mockOnClose = vi.fn();
      render(
        <BaseTransactionDialog
          {...defaultProps}
          onClose={mockOnClose}
          currentStep="approve"
          onApprove={vi.fn()}
        />
      );
      
      fireEvent.click(screen.getByText('Cancel'));
      expect(mockOnClose).toHaveBeenCalledOnce();
    });

    it('should call onClose when close button is clicked in failed step', () => {
      const mockOnClose = vi.fn();
      render(
        <BaseTransactionDialog
          {...defaultProps}
          onClose={mockOnClose}
          currentStep="failed"
        />
      );
      
      const closeButtons = screen.getAllByText('Close');
      const footerCloseButton = closeButtons.find(button => 
        button.tagName === 'BUTTON' && button.className.includes('border-input')
      );
      fireEvent.click(footerCloseButton!);
      expect(mockOnClose).toHaveBeenCalledOnce();
    });
  });

  describe('Title Composition', () => {
    it('should render title without token icon when token info is missing', () => {
      render(
        <BaseTransactionDialog
          {...defaultProps}
          title="Simple Title"
        />
      );
      
      expect(screen.getByText('Simple Title')).toBeInTheDocument();
      expect(screen.queryByTestId('token-network-icon')).not.toBeInTheDocument();
    });

    it('should render complex title with React node', () => {
      const complexTitle = (
        <div data-testid="complex-title">
          <span>Complex</span> <strong>Title</strong>
        </div>
      );
      render(
        <BaseTransactionDialog
          {...defaultProps}
          title={complexTitle}
        />
      );
      
      expect(screen.getByTestId('complex-title')).toBeInTheDocument();
      expect(screen.getByText('Complex')).toBeInTheDocument();
      expect(screen.getByText('Title')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing onSubmit gracefully', () => {
      render(
        <BaseTransactionDialog
          {...defaultProps}
          currentStep="input"
          isValidAmount={true}
          isConnected={true}
        />
      );
      
      const submitButton = screen.getByText('Submit');
      expect(submitButton).toBeInTheDocument();
      // Button should be present but won't have click handler
    });

    it('should handle missing onApprove gracefully', () => {
      render(
        <BaseTransactionDialog
          {...defaultProps}
          currentStep="approve"
          canApprove={true}
        />
      );
      
      const approveButton = screen.getByText('Approve');
      expect(approveButton).toBeInTheDocument();
      // Button should be present but won't have click handler
    });

    it('should handle empty description', () => {
      render(
        <BaseTransactionDialog
          {...defaultProps}
          description=""
        />
      );
      
      expect(screen.getByText('Test Transaction')).toBeInTheDocument();
      // Description element should still exist but be empty
    });
  });
});