import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CategorizedErrorDisplay } from '../categorized-error-display';
import type { CategorizedError } from '../../../utils/errorCategorization';

// Mock the error categorization utility
vi.mock('../../../utils/errorCategorization', () => ({
  categorizeError: vi.fn(),
  getSeverityClasses: vi.fn(() => 'border-red-500 bg-red-50'),
  getSeverityIcon: vi.fn(() => '⚠️'),
}));

describe('CategorizedErrorDisplay', () => {
  const mockError: CategorizedError = {
    category: 'INSUFFICIENT_FUNDS',
    title: 'Insufficient Funds',
    message: 'You do not have enough ETH to complete this transaction.',
    userAction: 'Add more ETH to your wallet or reduce the transaction amount.',
    severity: 'error',
    canRetry: false,
    technicalDetails: 'Error: insufficient funds for gas * price + value',
  };

  it('should render error title and message', () => {
    render(<CategorizedErrorDisplay error={mockError} />);

    expect(screen.getByText('Insufficient Funds')).toBeInTheDocument();
    expect(screen.getByText('You do not have enough ETH to complete this transaction.')).toBeInTheDocument();
  });

  it('should render user action when provided', () => {
    render(<CategorizedErrorDisplay error={mockError} />);

    expect(screen.getByText('Add more ETH to your wallet or reduce the transaction amount.')).toBeInTheDocument();
  });

  it('should render retry button when canRetry is true', () => {
    const retryableError = { ...mockError, canRetry: true };
    const onRetry = vi.fn();

    render(<CategorizedErrorDisplay error={retryableError} onRetry={onRetry} />);

    const retryButton = screen.getByText('Try Again');
    expect(retryButton).toBeInTheDocument();

    fireEvent.click(retryButton);
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('should not render retry button when canRetry is false', () => {
    render(<CategorizedErrorDisplay error={mockError} />);

    expect(screen.queryByText('Try Again')).not.toBeInTheDocument();
  });

  it('should render dismiss button when onDismiss is provided', () => {
    const onDismiss = vi.fn();

    render(<CategorizedErrorDisplay error={mockError} onDismiss={onDismiss} />);

    const dismissButton = screen.getByText('Dismiss');
    expect(dismissButton).toBeInTheDocument();

    fireEvent.click(dismissButton);
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('should toggle technical details when button is clicked', () => {
    render(<CategorizedErrorDisplay error={mockError} showTechnicalDetails />);

    const toggleButton = screen.getByText('Show Technical Details');
    expect(toggleButton).toBeInTheDocument();

    // Technical details should not be visible initially
    expect(screen.queryByText('Error: insufficient funds for gas * price + value')).not.toBeInTheDocument();

    // Click to show technical details
    fireEvent.click(toggleButton);
    expect(screen.getByText('Error: insufficient funds for gas * price + value')).toBeInTheDocument();
    expect(screen.getByText('Hide Technical Details')).toBeInTheDocument();

    // Click to hide technical details
    fireEvent.click(screen.getByText('Hide Technical Details'));
    expect(screen.queryByText('Error: insufficient funds for gas * price + value')).not.toBeInTheDocument();
    expect(screen.getByText('Show Technical Details')).toBeInTheDocument();
  });

  it('should not render technical details toggle when showTechnicalDetails is false', () => {
    render(<CategorizedErrorDisplay error={mockError} showTechnicalDetails={false} />);

    expect(screen.queryByText('Show Technical Details')).not.toBeInTheDocument();
  });

  it('should handle error without technical details gracefully', () => {
    const errorWithoutTechnical = { ...mockError, technicalDetails: undefined };

    render(<CategorizedErrorDisplay error={errorWithoutTechnical} showTechnicalDetails />);

    expect(screen.queryByText('Show Technical Details')).not.toBeInTheDocument();
  });

  it('should apply correct styling classes based on severity', () => {
    const { container } = render(<CategorizedErrorDisplay error={mockError} />);

    // The component should have applied the mocked severity classes
    expect(container.querySelector('.border-red-500')).toBeInTheDocument();
    expect(container.querySelector('.bg-red-50')).toBeInTheDocument();
  });

  it('should render severity icon', () => {
    render(<CategorizedErrorDisplay error={mockError} />);

    expect(screen.getByText('⚠️')).toBeInTheDocument();
  });
});