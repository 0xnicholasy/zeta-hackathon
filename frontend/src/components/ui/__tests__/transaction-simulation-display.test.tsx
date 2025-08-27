import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TransactionSimulationDisplay } from '../transaction-simulation-display';
import type { SimulationResult } from '../../../utils/transactionSimulation';

describe('TransactionSimulationDisplay', () => {
  const mockSuccessfulSimulation: SimulationResult = {
    success: true,
    gasEstimate: 150000n,
    gasEstimateFormatted: '150,000',
    healthFactorAfter: '2.5',
    warnings: [],
    errors: [],
  };

  const mockFailedSimulation: SimulationResult = {
    success: false,
    gasEstimate: 0n,
    gasEstimateFormatted: '0',
    healthFactorAfter: '0.8',
    warnings: [],
    errors: ['Insufficient collateral for this transaction'],
  };

  const mockSimulationWithWarnings: SimulationResult = {
    success: true,
    gasEstimate: 200000n,
    gasEstimateFormatted: '200,000',
    healthFactorAfter: '1.6',
    warnings: ['Health factor will be close to liquidation threshold'],
    errors: [],
  };

  it('should render successful simulation results', () => {
    render(<TransactionSimulationDisplay simulation={mockSuccessfulSimulation} />);

    expect(screen.getByText('Transaction Preview')).toBeInTheDocument();
    expect(screen.getByText('150,000')).toBeInTheDocument(); // Gas estimate
    expect(screen.getByText('2.5')).toBeInTheDocument(); // Health factor
  });

  it('should render failed simulation with errors', () => {
    render(<TransactionSimulationDisplay simulation={mockFailedSimulation} />);

    expect(screen.getByText('Transaction Preview')).toBeInTheDocument();
    expect(screen.getByText('Insufficient collateral for this transaction')).toBeInTheDocument();
    expect(screen.getByText('0.8')).toBeInTheDocument(); // Health factor
  });

  it('should render warnings when present', () => {
    render(<TransactionSimulationDisplay simulation={mockSimulationWithWarnings} />);

    expect(screen.getByText('Health factor will be close to liquidation threshold')).toBeInTheDocument();
    expect(screen.getByText('1.6')).toBeInTheDocument(); // Health factor
  });

  it('should show loading state when simulation is running', () => {
    render(<TransactionSimulationDisplay simulation={null} isLoading />);

    expect(screen.getByText('Simulating transaction...')).toBeInTheDocument();
  });

  it('should display correct health factor colors', () => {
    // Mock the health factor color utility
    vi.mock('../../../utils/healthFactorUtils', () => ({
      getHealthFactorColorClassFromString: vi.fn((hf: string) => {
        if (parseFloat(hf) < 1.2) return 'text-red-500';
        if (parseFloat(hf) < 2.0) return 'text-yellow-500';
        return 'text-green-500';
      }),
    }));

    const { rerender } = render(
      <TransactionSimulationDisplay simulation={mockFailedSimulation} />
    );

    // Should show red for dangerous health factor
    expect(screen.getByText('0.8')).toHaveClass('text-red-500');

    // Rerender with warning level health factor
    rerender(<TransactionSimulationDisplay simulation={mockSimulationWithWarnings} />);
    expect(screen.getByText('1.6')).toHaveClass('text-yellow-500');

    // Rerender with safe health factor
    rerender(<TransactionSimulationDisplay simulation={mockSuccessfulSimulation} />);
    expect(screen.getByText('2.5')).toHaveClass('text-green-500');
  });

  it('should handle missing simulation gracefully', () => {
    render(<TransactionSimulationDisplay simulation={null} />);

    // Should not crash and should not show simulation content
    expect(screen.queryByText('Transaction Preview')).not.toBeInTheDocument();
  });

  it('should show gas cost estimation', () => {
    render(<TransactionSimulationDisplay simulation={mockSuccessfulSimulation} />);

    expect(screen.getByText('Estimated Gas:')).toBeInTheDocument();
    expect(screen.getByText('150,000')).toBeInTheDocument();
  });

  it('should show health factor after transaction', () => {
    render(<TransactionSimulationDisplay simulation={mockSuccessfulSimulation} />);

    expect(screen.getByText('Health Factor After:')).toBeInTheDocument();
    expect(screen.getByText('2.5')).toBeInTheDocument();
  });

  it('should handle infinite health factor display', () => {
    const infiniteHealthFactorSimulation: SimulationResult = {
      success: true,
      gasEstimate: 150000n,
      gasEstimateFormatted: '150,000',
      healthFactorAfter: '∞',
      warnings: [],
      errors: [],
    };

    render(<TransactionSimulationDisplay simulation={infiniteHealthFactorSimulation} />);

    expect(screen.getByText('∞')).toBeInTheDocument();
  });
});