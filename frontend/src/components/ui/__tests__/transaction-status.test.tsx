import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { TransactionStatus } from '../transaction-status';
import { EVMTransactionHash } from '@/types/address';
import { SupportedChain } from '../../../contracts/deployments';
import type { TransactionType } from '../../../types/transactions';

// Mock dependencies
vi.mock('../hourglass-loader', () => ({
  HourglassLoader: ({ className, size }: { className?: string; size?: string }) => (
    <div data-testid="hourglass-loader" className={className} data-size={size}>Loading...</div>
  ),
}));

vi.mock('../../../contracts/deployments', () => ({
  getTransactionUrl: vi.fn((chainId: number, hash: string) => `https://explorer.example.com/tx/${hash}`),
  SupportedChain: {
    ZETA_TESTNET: 7001,
    ARBITRUM_SEPOLIA: 421614,
    ETHEREUM_SEPOLIA: 11155111,
  },
}));

vi.mock('../../../utils/formatHexString', () => ({
  formatHexString: vi.fn((hash: string) => {
    if (hash === '0xabcdef1234567890abcdef1234567890abcdef12') {
      return '0xabcd...ef12';
    }
    if (hash === '0xcrosschainabcdef1234567890abcdef1234567890') {
      return '0xcros...7890';
    }
    return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
  }),
}));

vi.mock('../../../hooks/useCrossChainTracking', () => ({
  useCrossChainTracking: vi.fn(),
}));

vi.mock('../../../utils/chainUtils', () => ({
  getChainDisplayNameFromId: vi.fn((chainId: number) => {
    switch (chainId) {
      case 7001: return 'ZetaChain Testnet';
      case 421614: return 'Arbitrum Sepolia';
      case 11155111: return 'Ethereum Sepolia';
      default: return 'Unknown Chain';
    }
  }),
}));

describe('TransactionStatus', () => {
  const mockTransactionHash = '0x1234567890abcdef1234567890abcdef12345678' as EVMTransactionHash;
  const mockApprovalHash = '0xabcdef1234567890abcdef1234567890abcdef12' as EVMTransactionHash;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Core Functionality', () => {
    it('should render switch network step', () => {
      render(
        <TransactionStatus
          currentStep="switchNetwork"
          transactionType="supply"
        />
      );

      expect(screen.getByTestId('hourglass-loader')).toBeInTheDocument();
      expect(screen.getByText('Switching network...')).toBeInTheDocument();
      expect(screen.getByText('Please approve the network switch in your wallet')).toBeInTheDocument();
    });

    it('should render approval step for token approval', () => {
      render(
        <TransactionStatus
          currentStep="approve"
          transactionType="supply"
        />
      );

      expect(screen.getByText('You need to approve tokens before proceeding.')).toBeInTheDocument();
    });

    it('should render approval step for gas token approval on withdraw', () => {
      const gasTokenInfo = {
        amount: BigInt('1000000000000000000'), // 1 ETH
        needsApproval: true,
      };

      render(
        <TransactionStatus
          currentStep="approve"
          transactionType="withdraw"
          gasTokenInfo={gasTokenInfo}
          gasTokenSymbol="ETH"
          gasTokenDecimals={18}
        />
      );

      expect(screen.getByText('You need to approve gas tokens before proceeding.')).toBeInTheDocument();
      expect(screen.getByText(/Approving .* ETH for withdrawal fees/)).toBeInTheDocument();
    });

    it('should render success step', () => {
      render(
        <TransactionStatus
          currentStep="success"
          transactionType="supply"
          transactionHash={mockTransactionHash}
          isTransactionSuccess={true}
        />
      );

      expect(screen.getByText('Your supply transaction has been completed successfully!')).toBeInTheDocument();
    });

    it('should render failed step', () => {
      render(
        <TransactionStatus
          currentStep="failed"
          transactionType="supply"
        />
      );

      expect(screen.getByText('Deposit failed. Please try again.')).toBeInTheDocument();
    });

    it('should return null for unhandled steps', () => {
      const { container } = render(
        <TransactionStatus
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          currentStep={'unknown-step' as any}
          transactionType="supply"
        />
      );

      expect(container.firstChild).toBeNull();
    });
  });

  describe('Loading States', () => {
    const loadingSteps = ['checkWithdraw', 'checkGas', 'approving', 'depositing', 'withdrawing', 'borrowing', 'repaying'];

    loadingSteps.forEach(step => {
      it(`should render loading state for ${step} step`, () => {
        render(
          <TransactionStatus
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            currentStep={step as any}
            transactionType="supply"
          />
        );

        expect(screen.getByTestId('hourglass-loader')).toBeInTheDocument();
      });
    });

    it('should show appropriate loading messages', () => {
      render(
        <TransactionStatus
          currentStep="checkWithdraw"
          transactionType="withdraw"
        />
      );
      expect(screen.getByText('Validating withdrawal eligibility...')).toBeInTheDocument();

      render(
        <TransactionStatus
          currentStep="checkGas"
          transactionType="withdraw"
        />
      );
      expect(screen.getByText('Checking gas token requirements...')).toBeInTheDocument();

      render(
        <TransactionStatus
          currentStep="approving"
          transactionType="supply"
        />
      );
      expect(screen.getByText('Waiting for approval confirmation...')).toBeInTheDocument();

      render(
        <TransactionStatus
          currentStep="depositing"
          transactionType="supply"
        />
      );
      expect(screen.getByText('Waiting for supply confirmation...')).toBeInTheDocument();
    });
  });

  describe('Transaction Hash Display', () => {
    it('should display approval hash during approval step', () => {
      render(
        <TransactionStatus
          currentStep="approving"
          approvalHash={mockApprovalHash}
          isApprovingTx={true}
          transactionType="supply"
        />
      );

      expect(screen.getByText('Approval:')).toBeInTheDocument();
      const link = screen.getByRole('link');
      expect(link).toHaveTextContent('0xabcd...ef12');
      expect(link).toHaveAttribute('href', `https://explorer.example.com/tx/${mockApprovalHash}`);
    });

    it('should display transaction hash during transaction execution', () => {
      render(
        <TransactionStatus
          currentStep="depositing"
          transactionHash={mockTransactionHash}
          isTransactionTx={true}
          transactionType="supply"
        />
      );

      expect(screen.getByText('Deposit:')).toBeInTheDocument();
      expect(screen.getByText('0x1234...5678')).toBeInTheDocument();
    });

    it('should show success icons when transactions complete', () => {
      render(
        <TransactionStatus
          currentStep="approving"
          approvalHash={mockApprovalHash}
          isApprovalSuccess={true}
          transactionType="supply"
        />
      );

      // Check that success icon is rendered (represented by FaCheck component)
      const link = screen.getByRole('link');
      expect(link).toHaveTextContent('0xabcd...ef12');
      const successIcon = link.parentElement?.querySelector('svg');
      expect(successIcon).toBeInTheDocument();
    });

    it('should show pending icons during transaction execution', () => {
      render(
        <TransactionStatus
          currentStep="depositing"
          transactionHash={mockTransactionHash}
          isTransactionTx={true}
          transactionType="supply"
        />
      );

      // Check that pending icon is rendered (represented by FaClock component)
      const pendingIcon = screen.getByText('0x1234...5678').parentElement?.querySelector('svg');
      expect(pendingIcon).toBeInTheDocument();
    });
  });

  describe('Transaction Type Labels', () => {
    const transactionTypes: Array<{ type: TransactionType; expectedLabel: string }> = [
      { type: 'supply', expectedLabel: 'Deposit' },
      { type: 'withdraw', expectedLabel: 'Withdrawal' },
      { type: 'borrow', expectedLabel: 'Borrow' },
      { type: 'repay', expectedLabel: 'Repay' },
    ];

    transactionTypes.forEach(({ type, expectedLabel }) => {
      it(`should display correct label for ${type} transaction`, () => {
        render(
          <TransactionStatus
            currentStep="depositing"
            transactionHash={mockTransactionHash}
            transactionType={type}
          />
        );

        expect(screen.getByText(`${expectedLabel}:`)).toBeInTheDocument();
      });

      it(`should display correct failed message for ${type} transaction`, () => {
        render(
          <TransactionStatus
            currentStep="failed"
            transactionType={type}
          />
        );

        expect(screen.getByText(`${expectedLabel} failed. Please try again.`)).toBeInTheDocument();
      });
    });
  });

  describe('Cross-Chain Integration', () => {
    const crossChainMock = {
      status: 'pending' as const,
      txHash: '0xcrosschainabcdef1234567890abcdef1234567890' as EVMTransactionHash,
    };

    it('should show cross-chain pending status', () => {
      render(
        <TransactionStatus
          currentStep="success"
          transactionType="supply"
          transactionHash={mockTransactionHash}
          crossChain={crossChainMock}
          chainId={SupportedChain.ARBITRUM_SEPOLIA}
        />
      );

      expect(screen.getByText('Processing cross-chain supply to ZetaChain...')).toBeInTheDocument();
      expect(screen.getByTestId('hourglass-loader')).toBeInTheDocument();
    });

    it('should show cross-chain success status', () => {
      const successfulCrossChain = {
        ...crossChainMock,
        status: 'success' as const,
      };

      render(
        <TransactionStatus
          currentStep="success"
          transactionType="supply"
          transactionHash={mockTransactionHash}
          crossChain={successfulCrossChain}
        />
      );

      expect(screen.getByText(/Cross-chain supply completed successfully!/)).toBeInTheDocument();
      expect(screen.getByText(/Tokens are now available for borrowing./)).toBeInTheDocument();
    });

    it('should show cross-chain failed status', () => {
      const failedCrossChain = {
        ...crossChainMock,
        status: 'failed' as const,
      };

      render(
        <TransactionStatus
          currentStep="success"
          transactionType="supply"
          transactionHash={mockTransactionHash}
          crossChain={failedCrossChain}
        />
      );

      expect(screen.getByText(/Cross-chain supply failed/)).toBeInTheDocument();
    });

    it('should display cross-chain transaction hash with proper link', () => {
      render(
        <TransactionStatus
          currentStep="success"
          transactionType="supply"
          transactionHash={mockTransactionHash}
          crossChain={crossChainMock}
        />
      );

      expect(screen.getByText('Cross-chain:')).toBeInTheDocument();
      const links = screen.getAllByRole('link');
      const crossChainLink = links.find(link => 
        link.getAttribute('href')?.includes('zetachain-athens.blockpi.network')
      );
      expect(crossChainLink).toBeDefined();
      expect(crossChainLink).toHaveAttribute(
        'href',
        `https://zetachain-athens.blockpi.network/lcd/v1/public/zeta-chain/crosschain/inboundHashToCctxData/${crossChainMock.txHash}`
      );
    });

    it('should handle cross-chain idle status', () => {
      const idleCrossChain = {
        ...crossChainMock,
        status: 'idle' as const,
      };

      render(
        <TransactionStatus
          currentStep="success"
          transactionType="supply"
          transactionHash={mockTransactionHash}
          crossChain={idleCrossChain}
        />
      );

      expect(screen.getByText(/Your supply transaction has been completed successfully! Starting cross-chain transfer.../)).toBeInTheDocument();
    });

    it('should show different messages for different transaction types in cross-chain', () => {
      const successfulCrossChain = {
        ...crossChainMock,
        status: 'success' as const,
      };

      // Test borrow
      render(
        <TransactionStatus
          currentStep="success"
          transactionType="borrow"
          transactionHash={mockTransactionHash}
          crossChain={successfulCrossChain}
          chainId={SupportedChain.ARBITRUM_SEPOLIA}
        />
      );
      expect(screen.getByText(/Borrowed assets have been sent to Arbitrum Sepolia./)).toBeInTheDocument();

      // Test withdraw
      render(
        <TransactionStatus
          currentStep="success"
          transactionType="withdraw"
          transactionHash={mockTransactionHash}
          crossChain={successfulCrossChain}
          chainId={SupportedChain.ETHEREUM_SEPOLIA}
        />
      );
      expect(screen.getByText(/Assets have been sent to Ethereum Sepolia./)).toBeInTheDocument();

      // Test repay
      render(
        <TransactionStatus
          currentStep="success"
          transactionType="repay"
          transactionHash={mockTransactionHash}
          crossChain={successfulCrossChain}
        />
      );
      expect(screen.getByText(/Debt has been successfully repaid./)).toBeInTheDocument();
    });
  });

  describe('Chain Display Names', () => {
    it('should display correct chain name for different chain IDs', () => {
      render(
        <TransactionStatus
          currentStep="success"
          transactionType="borrow"
          transactionHash={mockTransactionHash}
          crossChain={{
            status: 'pending',
            txHash: '0x123' as EVMTransactionHash,
          }}
          chainId={SupportedChain.ETHEREUM_SEPOLIA}
        />
      );

      expect(screen.getByText(/to Ethereum Sepolia/)).toBeInTheDocument();
    });
  });

  describe('Gas Token Information', () => {
    it('should format gas token amount correctly', () => {
      const gasTokenInfo = {
        amount: BigInt('1500000000000000000'), // 1.5 ETH
        needsApproval: true,
      };

      render(
        <TransactionStatus
          currentStep="approve"
          transactionType="withdraw"
          gasTokenInfo={gasTokenInfo}
          gasTokenSymbol="ETH"
          gasTokenDecimals={18}
        />
      );

      // Should format to 6 decimal places max
      expect(screen.getByText(/Approving.*1\.5.*ETH.*for withdrawal fees/)).toBeInTheDocument();
    });

    it('should handle small gas token amounts', () => {
      const gasTokenInfo = {
        amount: BigInt('1000000000000000'), // 0.001 ETH
        needsApproval: true,
      };

      render(
        <TransactionStatus
          currentStep="approve"
          transactionType="withdraw"
          gasTokenInfo={gasTokenInfo}
          gasTokenSymbol="ETH"
          gasTokenDecimals={18}
        />
      );

      expect(screen.getByText(/Approving.*0\.001.*ETH.*for withdrawal fees/)).toBeInTheDocument();
    });

    it('should handle different gas token symbols', () => {
      const gasTokenInfo = {
        amount: BigInt('1000000'), // 1 USDC (6 decimals)
        needsApproval: true,
      };

      render(
        <TransactionStatus
          currentStep="approve"
          transactionType="withdraw"
          gasTokenInfo={gasTokenInfo}
          gasTokenSymbol="USDC"
          gasTokenDecimals={6}
        />
      );

      expect(screen.getByText(/Approving.*1.*USDC.*for withdrawal fees/)).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing transaction hashes gracefully', () => {
      render(
        <TransactionStatus
          currentStep="depositing"
          transactionType="supply"
        />
      );

      expect(screen.queryByText('Deposit:')).not.toBeInTheDocument();
      expect(screen.getByText('Waiting for supply confirmation...')).toBeInTheDocument();
    });

    it('should handle undefined cross-chain data', () => {
      render(
        <TransactionStatus
          currentStep="success"
          transactionType="supply"
          transactionHash={mockTransactionHash}
        />
      );

      expect(screen.getByText('Your supply transaction has been completed successfully!')).toBeInTheDocument();
      expect(screen.queryByText('Cross-chain:')).not.toBeInTheDocument();
    });

    it('should handle default chain ID', () => {
      render(
        <TransactionStatus
          currentStep="success"
          transactionType="borrow"
          crossChain={{
            status: 'pending',
            txHash: '0x123' as EVMTransactionHash,
          }}
        />
      );

      // Should default to ZetaChain Testnet
      expect(screen.getByText(/to ZetaChain Testnet/)).toBeInTheDocument();
    });

    it('should handle missing gas token info on withdraw approval', () => {
      render(
        <TransactionStatus
          currentStep="approve"
          transactionType="withdraw"
        />
      );

      expect(screen.getByText('You need to approve gas tokens before proceeding.')).toBeInTheDocument();
      expect(screen.queryByText(/Approving .* for withdrawal fees/)).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper link attributes for external links', () => {
      render(
        <TransactionStatus
          currentStep="success"
          transactionType="supply"
          transactionHash={mockTransactionHash}
        />
      );

      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('should maintain proper link structure for cross-chain transactions', () => {
      render(
        <TransactionStatus
          currentStep="success"
          transactionType="supply"
          transactionHash={mockTransactionHash}
          crossChain={{
            status: 'success',
            txHash: '0xcrosschainabcdef1234567890abcdef1234567890' as EVMTransactionHash,
          }}
        />
      );

      const links = screen.getAllByRole('link');
      expect(links).toHaveLength(2); // Main transaction and cross-chain transaction

      links.forEach(link => {
        expect(link).toHaveAttribute('target', '_blank');
        expect(link).toHaveAttribute('rel', 'noopener noreferrer');
      });
    });

    it('should provide meaningful text for screen readers', () => {
      render(
        <TransactionStatus
          currentStep="success"
          transactionType="supply"
          transactionHash={mockTransactionHash}
        />
      );

      expect(screen.getByText('Deposit:')).toBeInTheDocument();
      expect(screen.getByText('0x1234...5678')).toBeInTheDocument();
    });
  });
});