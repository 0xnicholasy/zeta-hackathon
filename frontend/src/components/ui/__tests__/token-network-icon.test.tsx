import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TokenNetworkIcon } from '../token-network-icon';

// Mock @web3icons/react
vi.mock('@web3icons/react', () => ({
  TokenIcon: ({ symbol, className }: { symbol: string; className: string }) => (
    <div data-testid="token-icon" data-symbol={symbol} className={className}>
      Token-{symbol}
    </div>
  ),
  NetworkIcon: ({ name, className }: { name: string; className: string }) => (
    <div data-testid="network-icon" data-name={name} className={className}>
      Network-{name}
    </div>
  ),
}));

// Mock the utils function
vi.mock('../../lib/utils', () => ({
  cn: (...classes: Array<string | undefined>) => classes.filter(Boolean).join(' '),
}));

// Mock the variants
vi.mock('../token-network-icon-variants', () => ({
  tokenNetworkIconVariants: vi.fn(({ size, shadow, className }) => {
    const baseClasses = 'relative bg-white rounded-full flex items-center justify-center';
    const sizeClasses = {
      sm: 'w-6 h-6',
      default: 'w-8 h-8',
      lg: 'w-10 h-10',
      xl: 'w-12 h-12',
    };
    const shadowClasses = {
      none: '',
      sm: 'shadow-sm',
      default: 'shadow-lg',
    };
    
    return [
      baseClasses,
      sizeClasses[size || 'default'],
      shadowClasses[shadow || 'default'],
      className
    ].filter(Boolean).join(' ');
  }),
}));

describe('TokenNetworkIcon', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Core Functionality', () => {
    it('should render token icon with base token symbol', () => {
      render(<TokenNetworkIcon tokenSymbol="ETH" />);
      
      const tokenIcon = screen.getByTestId('token-icon');
      expect(tokenIcon).toBeInTheDocument();
      expect(tokenIcon).toHaveAttribute('data-symbol', 'ETH');
      expect(tokenIcon).toHaveTextContent('Token-ETH');
    });

    it('should extract base token symbol from compound symbols', () => {
      render(<TokenNetworkIcon tokenSymbol="ETH.ARBI" />);
      
      const tokenIcon = screen.getByTestId('token-icon');
      expect(tokenIcon).toHaveAttribute('data-symbol', 'ETH');
      expect(tokenIcon).toHaveTextContent('Token-ETH');
    });

    it('should handle token symbols without network suffix', () => {
      render(<TokenNetworkIcon tokenSymbol="USDC" />);
      
      const tokenIcon = screen.getByTestId('token-icon');
      expect(tokenIcon).toHaveAttribute('data-symbol', 'USDC');
    });

    it('should handle empty token symbol in compound format', () => {
      render(<TokenNetworkIcon tokenSymbol=".ARBI" />);
      
      const tokenIcon = screen.getByTestId('token-icon');
      expect(tokenIcon).toHaveAttribute('data-symbol', '');
    });
  });

  describe('Size Variants', () => {
    it('should apply default size when not specified', () => {
      render(<TokenNetworkIcon tokenSymbol="ETH" />);
      
      const container = screen.getByTestId('token-icon').parentElement;
      expect(container).toHaveClass('w-8 h-8'); // default size
    });

    it('should apply small size classes', () => {
      render(<TokenNetworkIcon tokenSymbol="ETH" size="sm" />);
      
      const container = screen.getByTestId('token-icon').parentElement;
      expect(container).toHaveClass('w-6 h-6');
    });

    it('should apply large size classes', () => {
      render(<TokenNetworkIcon tokenSymbol="ETH" size="lg" />);
      
      const container = screen.getByTestId('token-icon').parentElement;
      expect(container).toHaveClass('w-10 h-10');
    });

    it('should apply extra large size classes', () => {
      render(<TokenNetworkIcon tokenSymbol="ETH" size="xl" />);
      
      const container = screen.getByTestId('token-icon').parentElement;
      expect(container).toHaveClass('w-12 h-12');
    });

    it('should apply correct token icon sizes based on container size', () => {
      render(<TokenNetworkIcon tokenSymbol="ETH" size="sm" />);
      
      const tokenIcon = screen.getByTestId('token-icon');
      expect(tokenIcon).toHaveClass('w-4 h-4'); // sm token size
    });
  });

  describe('Shadow Variants', () => {
    it('should apply default shadow when not specified', () => {
      render(<TokenNetworkIcon tokenSymbol="ETH" />);
      
      const container = screen.getByTestId('token-icon').parentElement;
      expect(container).toHaveClass('shadow-lg'); // default shadow
    });

    it('should apply no shadow', () => {
      render(<TokenNetworkIcon tokenSymbol="ETH" shadow="none" />);
      
      const container = screen.getByTestId('token-icon').parentElement;
      expect(container).not.toHaveClass('shadow-lg');
      expect(container).not.toHaveClass('shadow-sm');
    });

    it('should apply small shadow', () => {
      render(<TokenNetworkIcon tokenSymbol="ETH" shadow="sm" />);
      
      const container = screen.getByTestId('token-icon').parentElement;
      expect(container).toHaveClass('shadow-sm');
    });
  });

  describe('Network Icon Rendering', () => {
    it('should render network icon when networkSymbol is provided', () => {
      render(<TokenNetworkIcon tokenSymbol="ETH" networkSymbol="ethereum" />);
      
      const networkIcon = screen.getByTestId('network-icon');
      expect(networkIcon).toBeInTheDocument();
      expect(networkIcon).toHaveAttribute('data-name', 'ethereum');
      expect(networkIcon).toHaveTextContent('Network-ethereum');
    });

    it('should render arbitrum network icon for arb sourceChain', () => {
      render(<TokenNetworkIcon tokenSymbol="ETH" sourceChain="arbitrum" />);
      
      const networkIcon = screen.getByTestId('network-icon');
      expect(networkIcon).toHaveAttribute('data-name', 'arbitrum-one');
    });

    it('should render ethereum network icon for eth sourceChain', () => {
      render(<TokenNetworkIcon tokenSymbol="ETH" sourceChain="ethereum" />);
      
      const networkIcon = screen.getByTestId('network-icon');
      expect(networkIcon).toHaveAttribute('data-name', 'ethereum');
    });

    it('should render base network icon for base sourceChain', () => {
      render(<TokenNetworkIcon tokenSymbol="USDC" sourceChain="base" />);
      
      const networkIcon = screen.getByTestId('network-icon');
      expect(networkIcon).toHaveAttribute('data-name', 'base');
    });

    it('should render bsc network icon for bsc sourceChain', () => {
      render(<TokenNetworkIcon tokenSymbol="BNB" sourceChain="bsc" />);
      
      const networkIcon = screen.getByTestId('network-icon');
      expect(networkIcon).toHaveAttribute('data-name', 'bsc');
    });

    it('should render polygon network icon for polygon sourceChain', () => {
      render(<TokenNetworkIcon tokenSymbol="MATIC" sourceChain="polygon" />);
      
      const networkIcon = screen.getByTestId('network-icon');
      expect(networkIcon).toHaveAttribute('data-name', 'polygon');
    });

    it('should render solana network icon for solana sourceChain', () => {
      render(<TokenNetworkIcon tokenSymbol="SOL" sourceChain="solana" />);
      
      const networkIcon = screen.getByTestId('network-icon');
      expect(networkIcon).toHaveAttribute('data-name', 'solana');
    });

    it('should render default ZetaChain icon for unknown sourceChain', () => {
      render(<TokenNetworkIcon tokenSymbol="ETH" sourceChain="unknown" />);
      
      // Should render a default div instead of network icon
      const container = screen.getByTestId('token-icon').parentElement;
      expect(container?.querySelector('.bg-zeta-500')).toBeInTheDocument();
      expect(screen.queryByTestId('network-icon')).not.toBeInTheDocument();
    });

    it('should not render network indicator when no network info provided', () => {
      render(<TokenNetworkIcon tokenSymbol="ETH" />);
      
      expect(screen.queryByTestId('network-icon')).not.toBeInTheDocument();
      const container = screen.getByTestId('token-icon').parentElement;
      expect(container?.querySelector('.bg-zeta-500')).not.toBeInTheDocument();
    });

    it('should prioritize networkSymbol over sourceChain', () => {
      render(
        <TokenNetworkIcon
          tokenSymbol="ETH"
          networkSymbol="ethereum"
          sourceChain="arbitrum"
        />
      );
      
      const networkIcon = screen.getByTestId('network-icon');
      expect(networkIcon).toHaveAttribute('data-name', 'ethereum');
    });
  });

  describe('Native Token Indicator', () => {
    it('should render native indicator when isNative and showNativeIndicator are true', () => {
      render(
        <TokenNetworkIcon
          tokenSymbol="ETH"
          isNative={true}
          showNativeIndicator={true}
        />
      );
      
      const container = screen.getByTestId('token-icon').parentElement;
      const nativeIndicator = container?.querySelector('.bg-green-500');
      expect(nativeIndicator).toBeInTheDocument();
      expect(nativeIndicator).toHaveClass('absolute', '-top-1', '-right-1', 'w-2', 'h-2');
    });

    it('should not render native indicator when isNative is false', () => {
      render(
        <TokenNetworkIcon
          tokenSymbol="ETH"
          isNative={false}
          showNativeIndicator={true}
        />
      );
      
      const container = screen.getByTestId('token-icon').parentElement;
      const nativeIndicator = container?.querySelector('.bg-green-500');
      expect(nativeIndicator).not.toBeInTheDocument();
    });

    it('should not render native indicator when showNativeIndicator is false', () => {
      render(
        <TokenNetworkIcon
          tokenSymbol="ETH"
          isNative={true}
          showNativeIndicator={false}
        />
      );
      
      const container = screen.getByTestId('token-icon').parentElement;
      const nativeIndicator = container?.querySelector('.bg-green-500');
      expect(nativeIndicator).not.toBeInTheDocument();
    });

    it('should not render native indicator by default', () => {
      render(<TokenNetworkIcon tokenSymbol="ETH" />);
      
      const container = screen.getByTestId('token-icon').parentElement;
      const nativeIndicator = container?.querySelector('.bg-green-500');
      expect(nativeIndicator).not.toBeInTheDocument();
    });
  });

  describe('CSS Classes and Styling', () => {
    it('should apply base CSS classes', () => {
      render(<TokenNetworkIcon tokenSymbol="ETH" />);
      
      const container = screen.getByTestId('token-icon').parentElement;
      expect(container).toHaveClass(
        'relative',
        'bg-white',
        'rounded-full',
        'flex',
        'items-center',
        'justify-center'
      );
    });

    it('should apply custom className', () => {
      render(<TokenNetworkIcon tokenSymbol="ETH" className="custom-class" />);
      
      const container = screen.getByTestId('token-icon').parentElement;
      expect(container).toHaveClass('custom-class');
    });

    it('should apply zeta color classes to token icon', () => {
      render(<TokenNetworkIcon tokenSymbol="ETH" />);
      
      const tokenIcon = screen.getByTestId('token-icon');
      expect(tokenIcon).toHaveClass('text-zeta-700');
    });

    it('should apply zeta color classes to network icon', () => {
      render(<TokenNetworkIcon tokenSymbol="ETH" networkSymbol="ethereum" />);
      
      const networkIcon = screen.getByTestId('network-icon');
      expect(networkIcon).toHaveClass('text-zeta-700');
    });
  });

  describe('Size Mapping Consistency', () => {
    it('should apply consistent network icon sizes', () => {
      const { rerender } = render(<TokenNetworkIcon tokenSymbol="ETH" sourceChain="eth" size="sm" />);
      let networkIcon = screen.getByTestId('network-icon');
      expect(networkIcon).toHaveClass('w-3 h-3');

      rerender(<TokenNetworkIcon tokenSymbol="ETH" sourceChain="eth" size="lg" />);
      networkIcon = screen.getByTestId('network-icon');
      expect(networkIcon).toHaveClass('w-4 h-4');

      rerender(<TokenNetworkIcon tokenSymbol="ETH" sourceChain="eth" size="xl" />);
      networkIcon = screen.getByTestId('network-icon');
      expect(networkIcon).toHaveClass('w-5 h-5');
    });

    it('should handle default size for network icons', () => {
      render(<TokenNetworkIcon tokenSymbol="ETH" sourceChain="eth" />);
      
      const networkIcon = screen.getByTestId('network-icon');
      expect(networkIcon).toHaveClass('w-3 h-3'); // default network size
    });
  });

  describe('Source Chain Matching', () => {
    it('should be case insensitive for source chain matching', () => {
      const { rerender } = render(<TokenNetworkIcon tokenSymbol="ETH" sourceChain="ARB" />);
      let networkIcon = screen.getByTestId('network-icon');
      expect(networkIcon).toHaveAttribute('data-name', 'arbitrum-one');

      rerender(<TokenNetworkIcon tokenSymbol="ETH" sourceChain="ETH" />);
      networkIcon = screen.getByTestId('network-icon');
      expect(networkIcon).toHaveAttribute('data-name', 'ethereum');

      rerender(<TokenNetworkIcon tokenSymbol="ETH" sourceChain="BASE" />);
      networkIcon = screen.getByTestId('network-icon');
      expect(networkIcon).toHaveAttribute('data-name', 'base');
    });

    it('should match partial chain names', () => {
      const { rerender } = render(<TokenNetworkIcon tokenSymbol="ETH" sourceChain="arbitrum-sepolia" />);
      let networkIcon = screen.getByTestId('network-icon');
      expect(networkIcon).toHaveAttribute('data-name', 'arbitrum-one');

      rerender(<TokenNetworkIcon tokenSymbol="ETH" sourceChain="ethereum-mainnet" />);
      networkIcon = screen.getByTestId('network-icon');
      expect(networkIcon).toHaveAttribute('data-name', 'ethereum');
    });
  });

  describe('Component Props', () => {
    it('should forward ref correctly', () => {
      const ref = React.createRef<HTMLDivElement>();
      render(<TokenNetworkIcon ref={ref} tokenSymbol="ETH" />);
      
      expect(ref.current).toBeInstanceOf(HTMLDivElement);
    });

    it('should spread additional HTML attributes', () => {
      render(
        <TokenNetworkIcon
          tokenSymbol="ETH"
          data-testid="custom-token-icon"
          aria-label="Ethereum token icon"
        />
      );
      
      const container = screen.getByTestId('custom-token-icon');
      expect(container).toHaveAttribute('aria-label', 'Ethereum token icon');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty tokenSymbol', () => {
      render(<TokenNetworkIcon tokenSymbol="" />);
      
      const tokenIcon = screen.getByTestId('token-icon');
      expect(tokenIcon).toHaveAttribute('data-symbol', '');
    });

    it('should handle multiple dots in tokenSymbol', () => {
      render(<TokenNetworkIcon tokenSymbol="TOKEN.CHAIN.EXTRA" />);
      
      const tokenIcon = screen.getByTestId('token-icon');
      expect(tokenIcon).toHaveAttribute('data-symbol', 'TOKEN');
    });

    it('should handle tokenSymbol with only dots', () => {
      render(<TokenNetworkIcon tokenSymbol="..." />);
      
      const tokenIcon = screen.getByTestId('token-icon');
      expect(tokenIcon).toHaveAttribute('data-symbol', '');
    });

    it('should render both native indicator and network icon when both conditions are met', () => {
      render(
        <TokenNetworkIcon
          tokenSymbol="ETH"
          sourceChain="ethereum"
          isNative={true}
          showNativeIndicator={true}
        />
      );
      
      const container = screen.getByTestId('token-icon').parentElement;
      const nativeIndicator = container?.querySelector('.bg-green-500');
      const networkIcon = screen.getByTestId('network-icon');
      
      expect(nativeIndicator).toBeInTheDocument();
      expect(networkIcon).toBeInTheDocument();
    });
  });
});