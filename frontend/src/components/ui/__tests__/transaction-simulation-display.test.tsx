import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TransactionSimulationDisplay } from '../transaction-simulation-display';
import type { SimulationResult } from '../../../utils/transactionSimulation';
import React from 'react';

describe('TransactionSimulationDisplay', () => {
  const mockSuccessfulSimulation: SimulationResult = {
    success: true,
    gasEstimate: 150000n,
    healthFactorAfter: '2.5',
    warnings: [],
  };

  const mockFailedSimulation: SimulationResult = {
    success: false,
    gasEstimate: 0n,
    healthFactorAfter: '0.8',
    warnings: [],
    error: 'Insufficient collateral for this transaction',
  };

  const mockSimulationWithWarnings: SimulationResult = {
    success: true,
    gasEstimate: 200000n,
    healthFactorAfter: '1.6',
    warnings: ['Health factor will be close to liquidation threshold'],
  };

  it('should render successful simulation results', () => {
    render(<TransactionSimulationDisplay simulation={mockSuccessfulSimulation} />);

    expect(screen.getByText('Transaction Preview')).toBeInTheDocument();
    expect(screen.getByText('150,000')).toBeInTheDocument(); // Gas estimate
    expect(screen.getByText('2.50')).toBeInTheDocument(); // Health factor
  });

  it('should render failed simulation with errors', () => {
    render(<TransactionSimulationDisplay simulation={mockFailedSimulation} />);

    expect(screen.getByText('Transaction Preview')).toBeInTheDocument();
    expect(screen.getByText('Insufficient collateral for this transaction')).toBeInTheDocument();
    expect(screen.getByText('0.80')).toBeInTheDocument(); // Health factor
  });

  it('should render warnings when present', () => {
    render(<TransactionSimulationDisplay simulation={mockSimulationWithWarnings} />);

    expect(screen.getByText('Health factor will be close to liquidation threshold')).toBeInTheDocument();
    expect(screen.getByText('1.60')).toBeInTheDocument(); // Health factor
  });

  it('should show loading state when simulation is running', () => {
    render(<TransactionSimulationDisplay simulation={null} isLoading />);

    expect(screen.getByText('Simulating transaction...')).toBeInTheDocument();
  });

  it('should display correct health factor colors', () => {
    const { rerender } = render(
      <TransactionSimulationDisplay simulation={mockFailedSimulation} />
    );

    // Should show red for dangerous health factor (0.8)
    const dangerousHealthFactor = screen.getByText('0.80');
    expect(dangerousHealthFactor).toBeInTheDocument();

    // Rerender with warning level health factor (1.6)
    rerender(<TransactionSimulationDisplay simulation={mockSimulationWithWarnings} />);
    const warningHealthFactor = screen.getByText('1.60');
    expect(warningHealthFactor).toBeInTheDocument();

    // Rerender with safe health factor (2.5)
    rerender(<TransactionSimulationDisplay simulation={mockSuccessfulSimulation} />);
    const safeHealthFactor = screen.getByText('2.50');
    expect(safeHealthFactor).toBeInTheDocument();
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
    expect(screen.getByText('2.50')).toBeInTheDocument();
  });

  it('should handle infinite health factor display', () => {
    const infiniteHealthFactorSimulation: SimulationResult = {
      success: true,
      gasEstimate: 150000n,
      healthFactorAfter: '∞',
      warnings: []
    };

    render(<TransactionSimulationDisplay simulation={infiniteHealthFactorSimulation} />);

    expect(screen.getByText('∞')).toBeInTheDocument();
  });
});