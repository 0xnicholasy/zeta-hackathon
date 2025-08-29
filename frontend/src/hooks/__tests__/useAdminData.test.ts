import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAdminData, getZetaChainAssets, getExternalChainAssets, getCurrentChainInfo } from '../useAdminData';

// Define SupportedChain constants directly to avoid mocking issues
const SupportedChain = {
  ZETA_TESTNET: 7001,
  ARBITRUM_SEPOLIA: 421614,
  ETHEREUM_SEPOLIA: 11155111,
  POLYGON_AMOY: 80002,
  BASE_SEPOLIA: 84532,
  BSC_TESTNET: 97,
  SOLANA_DEVNET: 901,
} as const;

// Mock contracts data
vi.mock('../../config/contracts-data', () => ({
  contractsData: {
    networks: {
      7001: {
        tokens: {
          'ETH.ARBI': '0x1234567890123456789012345678901234567890',
          'USDC.ARBI': '0x2345678901234567890123456789012345678901',
          'ETH.ETH': '0x3456789012345678901234567890123456789012',
          'USDC.ETH': '0x4567890123456789012345678901234567890123',
          'ZETA': '0x0000000000000000000000000000000000000000'
        },
        contracts: {
          MockPriceOracle: '0x5678901234567890123456789012345678901234'
        }
      },
      421614: { // Arbitrum Sepolia
        tokens: {
          'ETH': '0x0000000000000000000000000000000000000000',
          'USDC': '0x7890123456789012345678901234567890123456'
        }
      },
      11155111: { // Ethereum Sepolia
        tokens: {
          'ETH': '0x0000000000000000000000000000000000000000',
          'USDC': '0x8901234567890123456789012345678901234567'
        }
      }
    }
  }
}));

// Mock useContracts to provide the correct SupportedChain
vi.mock('../useContracts', () => ({
  SupportedChain: {
    ZETA_TESTNET: 7001,
    ARBITRUM_SEPOLIA: 421614,
    ETHEREUM_SEPOLIA: 11155111,
    POLYGON_AMOY: 80002,
    BASE_SEPOLIA: 84532,
    BSC_TESTNET: 97,
    SOLANA_DEVNET: 901,
  }
}));

// Mock wagmi
const mockUseChainId = vi.fn();
vi.mock('wagmi', () => ({
  useChainId: () => mockUseChainId(),
}));

describe('useAdminData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Core Hook Functionality', () => {
    it('should return admin data for ZetaChain network', () => {
      mockUseChainId.mockReturnValue(SupportedChain.ZETA_TESTNET);

      const { result } = renderHook(() => useAdminData());

      expect(result.current.chainId).toBe(SupportedChain.ZETA_TESTNET);
      expect(result.current.isOnZetaNetwork).toBe(true);
      expect(result.current.isOnExternalNetwork).toBe(false);
      expect(result.current.currentChain).toEqual({
        name: 'ZetaChain Testnet',
        icon: 'zeta-chain'
      });
      expect(result.current.mockPriceOracleAddress).toBe('0x5678901234567890123456789012345678901234');
    });

    it('should return admin data for external network (Arbitrum)', () => {
      mockUseChainId.mockReturnValue(SupportedChain.ARBITRUM_SEPOLIA);

      const { result } = renderHook(() => useAdminData());

      expect(result.current.chainId).toBe(SupportedChain.ARBITRUM_SEPOLIA);
      expect(result.current.isOnZetaNetwork).toBe(false);
      expect(result.current.isOnExternalNetwork).toBe(true);
      expect(result.current.currentChain).toEqual({
        name: 'Arbitrum Sepolia',
        icon: 'arbitrum-one'
      });
    });

    it('should handle unknown network', () => {
      mockUseChainId.mockReturnValue(999999);

      const { result } = renderHook(() => useAdminData());

      expect(result.current.chainId).toBe(999999);
      expect(result.current.isOnZetaNetwork).toBe(false);
      expect(result.current.isOnExternalNetwork).toBe(false);
      expect(result.current.currentChain).toEqual({
        name: 'Unknown Network',
        icon: 'ethereum'
      });
    });
  });

  describe('Asset Data Retrieval', () => {
    it('should return ZetaChain assets when on ZetaChain', () => {
      mockUseChainId.mockReturnValue(SupportedChain.ZETA_TESTNET);

      const { result } = renderHook(() => useAdminData());

      expect(result.current.zetaChainAssets).toHaveLength(4); // Excluding zero address
      expect(result.current.zetaChainAssets).toEqual([
        {
          symbol: 'ETH.ARBI',
          address: '0x1234567890123456789012345678901234567890',
          label: 'ETH.ARBI (0x1234567890123456789012345678901234567890)'
        },
        {
          symbol: 'USDC.ARBI',
          address: '0x2345678901234567890123456789012345678901',
          label: 'USDC.ARBI (0x2345678901234567890123456789012345678901)'
        },
        {
          symbol: 'ETH.ETH',
          address: '0x3456789012345678901234567890123456789012',
          label: 'ETH.ETH (0x3456789012345678901234567890123456789012)'
        },
        {
          symbol: 'USDC.ETH',
          address: '0x4567890123456789012345678901234567890123',
          label: 'USDC.ETH (0x4567890123456789012345678901234567890123)'
        }
      ]);
    });
  });

  describe('Utility Functions Integration', () => {
    it('should export utility functions', () => {
      mockUseChainId.mockReturnValue(SupportedChain.ZETA_TESTNET);

      const { result } = renderHook(() => useAdminData());

      expect(typeof result.current.getZetaChainAssets).toBe('function');
      expect(typeof result.current.getExternalChainAssets).toBe('function');
      expect(typeof result.current.getCurrentChainInfo).toBe('function');
    });
  });
});

describe('getZetaChainAssets', () => {
  it('should return filtered ZetaChain assets excluding zero addresses', () => {
    const assets = getZetaChainAssets();

    expect(assets).toHaveLength(4);
    expect(assets.every(asset => asset.address !== '0x0000000000000000000000000000000000000000')).toBe(true);
    expect(assets[0]).toEqual({
      symbol: 'ETH.ARBI',
      address: '0x1234567890123456789012345678901234567890',
      label: 'ETH.ARBI (0x1234567890123456789012345678901234567890)'
    });
  });
});

describe('getExternalChainAssets', () => {
  it('should return external chain assets with native ETH detection', () => {
    const assets = getExternalChainAssets(SupportedChain.ARBITRUM_SEPOLIA);

    expect(assets).toEqual([
      {
        symbol: 'ETH',
        address: '0x0000000000000000000000000000000000000000',
        label: 'ETH (Native ETH)'
      },
      {
        symbol: 'USDC',
        address: '0x7890123456789012345678901234567890123456',
        label: 'USDC (0x7890123456789012345678901234567890123456)'
      }
    ]);
  });

  it('should return empty array for unsupported chain', () => {
    const assets = getExternalChainAssets(999999);
    expect(assets).toEqual([]);
  });
});

describe('getCurrentChainInfo', () => {
  it('should return correct chain info for supported chains', () => {
    // Test Arbitrum Sepolia
    expect(getCurrentChainInfo(SupportedChain.ARBITRUM_SEPOLIA)).toEqual({
      name: 'Arbitrum Sepolia', 
      icon: 'arbitrum-one' 
    });

    // Test Ethereum Sepolia
    expect(getCurrentChainInfo(SupportedChain.ETHEREUM_SEPOLIA)).toEqual({
      name: 'Ethereum Sepolia', 
      icon: 'ethereum' 
    });

    // Test ZetaChain Testnet
    expect(getCurrentChainInfo(SupportedChain.ZETA_TESTNET)).toEqual({
      name: 'ZetaChain Testnet', 
      icon: 'zeta-chain' 
    });

    // Test unknown chain
    expect(getCurrentChainInfo(999999)).toEqual({
      name: 'Unknown Network', 
      icon: 'ethereum' 
    });
  });
});

describe('MockPriceOracle Integration', () => {
  it('should return MockPriceOracle address from contracts data', () => {
    mockUseChainId.mockReturnValue(SupportedChain.ZETA_TESTNET);

    const { result } = renderHook(() => useAdminData());

    expect(result.current.mockPriceOracleAddress).toBe('0x5678901234567890123456789012345678901234');
  });
});

describe('Edge Cases', () => {
  it('should handle undefined chainId gracefully', () => {
    mockUseChainId.mockReturnValue(undefined);

    const { result } = renderHook(() => useAdminData());


    expect(result.current.chainId).toBeUndefined();
    expect(result.current.isOnZetaNetwork).toBe(false);
    expect(result.current.isOnExternalNetwork).toBe(false);
    expect(result.current.currentChain).toEqual({
      name: 'Unknown Network',
      icon: 'ethereum'
    });
  });

  it('should handle null chainId gracefully', () => {
    mockUseChainId.mockReturnValue(null);

    const { result } = renderHook(() => useAdminData());

    expect(result.current.chainId).toBeNull();
    expect(result.current.isOnZetaNetwork).toBe(false);
    expect(result.current.isOnExternalNetwork).toBe(false);
  });
});