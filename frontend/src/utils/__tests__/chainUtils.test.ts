import { describe, it, expect, vi, beforeEach, type MockedFunction } from 'vitest';
import {
  getChainIdFromSourceChain,
  getChainDisplayName,
  getChainDisplayNameFromId,
  getGasTokenSymbol,
  getGasTokenDecimals,
  getZetaTokenSymbol,
  getZetaTokenAddress,
  getTokenInfo,
  getSupportedTokensForChain,
  isTokenSupportedOnChain,
  CHAIN_TOKEN_MAPPINGS,
  type TokenMapping,
  type TokenInfo
} from '../chainUtils';
import { SupportedChain, TOKEN_SYMBOLS } from '../../contracts/deployments';
import * as deployments from '../../contracts/deployments';

// Mock the deployments module
vi.mock('../../contracts/deployments');

const mockGetTokenAddress = deployments.getTokenAddress as MockedFunction<typeof deployments.getTokenAddress>;

describe('chainUtils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mock for getTokenAddress
    mockGetTokenAddress.mockImplementation((symbol: string) => {
      // Return mock addresses based on symbol
      const addressMap: Record<string, string> = {
        [TOKEN_SYMBOLS.ETH_ARBI]: '0x1111111111111111111111111111111111111111',
        [TOKEN_SYMBOLS.USDC_ARBI]: '0x2222222222222222222222222222222222222222',
        [TOKEN_SYMBOLS.ETH_ETH]: '0x3333333333333333333333333333333333333333',
        [TOKEN_SYMBOLS.USDC_ETH]: '0x4444444444444444444444444444444444444444',
        [TOKEN_SYMBOLS.POL_POL]: '0x5555555555555555555555555555555555555555',
        [TOKEN_SYMBOLS.USDC_POL]: '0x6666666666666666666666666666666666666666',
        [TOKEN_SYMBOLS.ETH_BASE]: '0x7777777777777777777777777777777777777777',
        [TOKEN_SYMBOLS.USDC_BASE]: '0x8888888888888888888888888888888888888888',
        [TOKEN_SYMBOLS.BNB_BSC]: '0x9999999999999999999999999999999999999999',
        [TOKEN_SYMBOLS.USDC_BSC]: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        [TOKEN_SYMBOLS.SOL_SOL]: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        [TOKEN_SYMBOLS.USDC_SOL]: '0xcccccccccccccccccccccccccccccccccccccccc',
      };
      return addressMap[symbol] || null;
    });
  });

  describe('getChainIdFromSourceChain', () => {
    it('should return correct chain ID for Arbitrum variations', () => {
      expect(getChainIdFromSourceChain('arbitrum')).toBe(SupportedChain.ARBITRUM_SEPOLIA);
      expect(getChainIdFromSourceChain('Arbitrum')).toBe(SupportedChain.ARBITRUM_SEPOLIA);
      expect(getChainIdFromSourceChain('ARBITRUM')).toBe(SupportedChain.ARBITRUM_SEPOLIA);
      expect(getChainIdFromSourceChain('arbitrum sepolia')).toBe(SupportedChain.ARBITRUM_SEPOLIA);
      expect(getChainIdFromSourceChain('Arbitrum Sepolia')).toBe(SupportedChain.ARBITRUM_SEPOLIA);
    });

    it('should return correct chain ID for Ethereum variations', () => {
      expect(getChainIdFromSourceChain('ethereum')).toBe(SupportedChain.ETHEREUM_SEPOLIA);
      expect(getChainIdFromSourceChain('Ethereum')).toBe(SupportedChain.ETHEREUM_SEPOLIA);
      expect(getChainIdFromSourceChain('ETHEREUM')).toBe(SupportedChain.ETHEREUM_SEPOLIA);
      expect(getChainIdFromSourceChain('ethereum sepolia')).toBe(SupportedChain.ETHEREUM_SEPOLIA);
      expect(getChainIdFromSourceChain('Ethereum Sepolia')).toBe(SupportedChain.ETHEREUM_SEPOLIA);
    });

    it('should return correct chain ID for ZetaChain variations', () => {
      expect(getChainIdFromSourceChain('zetachain')).toBe(SupportedChain.ZETA_TESTNET);
      expect(getChainIdFromSourceChain('ZetaChain')).toBe(SupportedChain.ZETA_TESTNET);
      expect(getChainIdFromSourceChain('ZETACHAIN')).toBe(SupportedChain.ZETA_TESTNET);
      expect(getChainIdFromSourceChain('zeta testnet')).toBe(SupportedChain.ZETA_TESTNET);
      expect(getChainIdFromSourceChain('Zeta Testnet')).toBe(SupportedChain.ZETA_TESTNET);
    });

    it('should return correct chain ID for Polygon variations', () => {
      expect(getChainIdFromSourceChain('polygon')).toBe(SupportedChain.POLYGON_AMOY);
      expect(getChainIdFromSourceChain('Polygon')).toBe(SupportedChain.POLYGON_AMOY);
      expect(getChainIdFromSourceChain('POLYGON')).toBe(SupportedChain.POLYGON_AMOY);
      expect(getChainIdFromSourceChain('polygon amoy')).toBe(SupportedChain.POLYGON_AMOY);
      expect(getChainIdFromSourceChain('Polygon Amoy')).toBe(SupportedChain.POLYGON_AMOY);
    });

    it('should return correct chain ID for Base variations', () => {
      expect(getChainIdFromSourceChain('base')).toBe(SupportedChain.BASE_SEPOLIA);
      expect(getChainIdFromSourceChain('Base')).toBe(SupportedChain.BASE_SEPOLIA);
      expect(getChainIdFromSourceChain('BASE')).toBe(SupportedChain.BASE_SEPOLIA);
      expect(getChainIdFromSourceChain('base sepolia')).toBe(SupportedChain.BASE_SEPOLIA);
      expect(getChainIdFromSourceChain('Base Sepolia')).toBe(SupportedChain.BASE_SEPOLIA);
    });

    it('should return correct chain ID for BSC variations', () => {
      expect(getChainIdFromSourceChain('bsc')).toBe(SupportedChain.BSC_TESTNET);
      expect(getChainIdFromSourceChain('BSC')).toBe(SupportedChain.BSC_TESTNET);
      expect(getChainIdFromSourceChain('bsc testnet')).toBe(SupportedChain.BSC_TESTNET);
      expect(getChainIdFromSourceChain('BSC Testnet')).toBe(SupportedChain.BSC_TESTNET);
    });

    it('should throw error for unknown chains', () => {
      expect(() => getChainIdFromSourceChain('unknown')).toThrow('getChainIdFromSourceChain: Unknown chain string: unknown');
      expect(() => getChainIdFromSourceChain('invalid-chain')).toThrow('getChainIdFromSourceChain: Unknown chain string: invalid-chain');
      expect(() => getChainIdFromSourceChain('')).toThrow('getChainIdFromSourceChain: Unknown chain string: ');
    });
  });

  describe('getChainDisplayName', () => {
    it('should return correct display names for all supported chains', () => {
      expect(getChainDisplayName('arbitrum')).toBe('Arbitrum Sepolia');
      expect(getChainDisplayName('ethereum')).toBe('Ethereum Sepolia');
      expect(getChainDisplayName('zetachain')).toBe('ZetaChain Testnet');
      expect(getChainDisplayName('polygon')).toBe('Polygon Amoy');
      expect(getChainDisplayName('base')).toBe('Base Sepolia');
      expect(getChainDisplayName('bsc')).toBe('BSC Testnet');
    });

    it('should handle case variations', () => {
      expect(getChainDisplayName('ARBITRUM SEPOLIA')).toBe('Arbitrum Sepolia');
      expect(getChainDisplayName('Ethereum Sepolia')).toBe('Ethereum Sepolia');
      expect(getChainDisplayName('ZetaChain')).toBe('ZetaChain Testnet');
    });

    it('should throw error for unknown chains', () => {
      expect(() => getChainDisplayName('unknown-chain')).toThrow('getChainDisplayName: Unknown chain string: unknown-chain');
      expect(() => getChainDisplayName('customChain')).toThrow('getChainDisplayName: Unknown chain string: customChain');
    });
  });

  describe('getChainDisplayNameFromId', () => {
    it('should return correct display names for all supported chain IDs', () => {
      expect(getChainDisplayNameFromId(SupportedChain.ARBITRUM_SEPOLIA)).toBe('Arbitrum Sepolia');
      expect(getChainDisplayNameFromId(SupportedChain.ETHEREUM_SEPOLIA)).toBe('Ethereum Sepolia');
      expect(getChainDisplayNameFromId(SupportedChain.ZETA_TESTNET)).toBe('ZetaChain Testnet');
      expect(getChainDisplayNameFromId(SupportedChain.POLYGON_AMOY)).toBe('Polygon Amoy');
      expect(getChainDisplayNameFromId(SupportedChain.BASE_SEPOLIA)).toBe('Base Sepolia');
      expect(getChainDisplayNameFromId(SupportedChain.BSC_TESTNET)).toBe('BSC Testnet');
      expect(getChainDisplayNameFromId(SupportedChain.SOLANA_DEVNET)).toBe('Solana Devnet');
    });

    it('should throw error for unsupported chain IDs', () => {
      expect(() => getChainDisplayNameFromId(999999)).toThrow('getChainDisplayNameFromId: Unknown chain ID: 999999');
      expect(() => getChainDisplayNameFromId(0)).toThrow('getChainDisplayNameFromId: Unknown chain ID: 0');
      expect(() => getChainDisplayNameFromId(-1)).toThrow('getChainDisplayNameFromId: Unknown chain ID: -1');
    });
  });

  describe('getGasTokenSymbol', () => {
    it('should return correct gas token symbols for EVM chains', () => {
      expect(getGasTokenSymbol('arbitrum')).toBe('ETH.ARBI');
      expect(getGasTokenSymbol('arbitrum sepolia')).toBe('ETH.ARBI');
      expect(getGasTokenSymbol('ethereum')).toBe('ETH.ETH');
      expect(getGasTokenSymbol('ethereum sepolia')).toBe('ETH.ETH');
      expect(getGasTokenSymbol('base')).toBe('ETH.BASE');
      expect(getGasTokenSymbol('base sepolia')).toBe('ETH.BASE');
    });

    it('should return correct gas token symbols for non-EVM chains', () => {
      expect(getGasTokenSymbol('polygon')).toBe('POL.POL');
      expect(getGasTokenSymbol('polygon amoy')).toBe('POL.POL');
      expect(getGasTokenSymbol('bsc')).toBe('BNB.BSC');
      expect(getGasTokenSymbol('bsc testnet')).toBe('BNB.BSC');
      expect(getGasTokenSymbol('zetachain')).toBe('ZETA');
      expect(getGasTokenSymbol('zeta testnet')).toBe('ZETA');
    });

    it('should handle case insensitive chain names', () => {
      expect(getGasTokenSymbol('ARBITRUM')).toBe('ETH.ARBI');
      expect(getGasTokenSymbol('Ethereum')).toBe('ETH.ETH');
      expect(getGasTokenSymbol('POLYGON')).toBe('POL.POL');
      expect(getGasTokenSymbol('BSC')).toBe('BNB.BSC');
    });

    it('should throw error for unknown chains', () => {
      expect(() => getGasTokenSymbol('unknown')).toThrow('getGasTokenSymbol: Unknown chain string: unknown');
      expect(() => getGasTokenSymbol('avalanche')).toThrow('getGasTokenSymbol: Unknown chain string: avalanche');
      expect(() => getGasTokenSymbol('')).toThrow('getGasTokenSymbol: Unknown chain string: ');
    });
  });

  describe('getGasTokenDecimals', () => {
    it('should return 18 decimals for ETH-based chains', () => {
      expect(getGasTokenDecimals('arbitrum')).toBe(18);
      expect(getGasTokenDecimals('arbitrum sepolia')).toBe(18);
      expect(getGasTokenDecimals('ethereum')).toBe(18);
      expect(getGasTokenDecimals('ethereum sepolia')).toBe(18);
      expect(getGasTokenDecimals('base')).toBe(18);
      expect(getGasTokenDecimals('base sepolia')).toBe(18);
    });

    it('should return 18 decimals for other EVM chains', () => {
      expect(getGasTokenDecimals('polygon')).toBe(18);
      expect(getGasTokenDecimals('polygon amoy')).toBe(18);
      expect(getGasTokenDecimals('bsc')).toBe(18);
      expect(getGasTokenDecimals('bsc testnet')).toBe(18);
      expect(getGasTokenDecimals('zetachain')).toBe(18);
      expect(getGasTokenDecimals('zeta testnet')).toBe(18);
    });

    it('should return 9 decimals for Solana', () => {
      expect(getGasTokenDecimals('solana')).toBe(9);
      expect(getGasTokenDecimals('solana devnet')).toBe(9);
      expect(getGasTokenDecimals('Solana')).toBe(9);
      expect(getGasTokenDecimals('SOLANA')).toBe(9);
    });

    it('should return 18 decimals as default for unknown chains', () => {
      expect(getGasTokenDecimals('unknown')).toBe(18);
      expect(getGasTokenDecimals('custom-chain')).toBe(18);
      expect(getGasTokenDecimals('')).toBe(18);
    });
  });

  describe('CHAIN_TOKEN_MAPPINGS', () => {
    it('should contain all supported chains', () => {
      const expectedChains = [
        SupportedChain.ARBITRUM_SEPOLIA,
        SupportedChain.ETHEREUM_SEPOLIA,
        SupportedChain.POLYGON_AMOY,
        SupportedChain.BASE_SEPOLIA,
        SupportedChain.BSC_TESTNET,
        SupportedChain.SOLANA_DEVNET,
      ];

      const mappingChains = CHAIN_TOKEN_MAPPINGS.map(mapping => mapping.chainId);
      
      expectedChains.forEach(chainId => {
        expect(mappingChains).toContain(chainId);
      });
    });

    it('should have correct token mappings for each chain', () => {
      // Test a few key mappings
      const arbitrumMapping = CHAIN_TOKEN_MAPPINGS.find(m => m.chainId === SupportedChain.ARBITRUM_SEPOLIA);
      expect(arbitrumMapping).toBeDefined();
      expect(arbitrumMapping?.nativeToken).toBe('ETH');
      expect(arbitrumMapping?.zetaTokenSymbol).toBe(TOKEN_SYMBOLS.ETH_ARBI);
      expect(arbitrumMapping?.usdcTokenSymbol).toBe(TOKEN_SYMBOLS.USDC_ARBI);

      const ethereumMapping = CHAIN_TOKEN_MAPPINGS.find(m => m.chainId === SupportedChain.ETHEREUM_SEPOLIA);
      expect(ethereumMapping).toBeDefined();
      expect(ethereumMapping?.nativeToken).toBe('ETH');
      expect(ethereumMapping?.zetaTokenSymbol).toBe(TOKEN_SYMBOLS.ETH_ETH);
      expect(ethereumMapping?.usdcTokenSymbol).toBe(TOKEN_SYMBOLS.USDC_ETH);

      const polygonMapping = CHAIN_TOKEN_MAPPINGS.find(m => m.chainId === SupportedChain.POLYGON_AMOY);
      expect(polygonMapping).toBeDefined();
      expect(polygonMapping?.nativeToken).toBe('POL');
      expect(polygonMapping?.zetaTokenSymbol).toBe(TOKEN_SYMBOLS.POL_POL);
      expect(polygonMapping?.usdcTokenSymbol).toBe(TOKEN_SYMBOLS.USDC_POL);
    });

    it('should not have duplicate chain IDs', () => {
      const chainIds = CHAIN_TOKEN_MAPPINGS.map(m => m.chainId);
      const uniqueChainIds = [...new Set(chainIds)];
      expect(chainIds).toHaveLength(uniqueChainIds.length);
    });
  });

  describe('getZetaTokenSymbol', () => {
    it('should return token symbol directly for ZetaChain', () => {
      expect(getZetaTokenSymbol('ETH', SupportedChain.ZETA_TESTNET)).toBe('ETH');
      expect(getZetaTokenSymbol('USDC', SupportedChain.ZETA_TESTNET)).toBe('USDC');
      expect(getZetaTokenSymbol('ZETA', SupportedChain.ZETA_TESTNET)).toBe('ZETA');
    });

    it('should return correct ZRC-20 symbols for native tokens', () => {
      expect(getZetaTokenSymbol('ETH', SupportedChain.ARBITRUM_SEPOLIA)).toBe(TOKEN_SYMBOLS.ETH_ARBI);
      expect(getZetaTokenSymbol('ETH', SupportedChain.ETHEREUM_SEPOLIA)).toBe(TOKEN_SYMBOLS.ETH_ETH);
      expect(getZetaTokenSymbol('POL', SupportedChain.POLYGON_AMOY)).toBe(TOKEN_SYMBOLS.POL_POL);
      expect(getZetaTokenSymbol('ETH', SupportedChain.BASE_SEPOLIA)).toBe(TOKEN_SYMBOLS.ETH_BASE);
      expect(getZetaTokenSymbol('BNB', SupportedChain.BSC_TESTNET)).toBe(TOKEN_SYMBOLS.BNB_BSC);
      expect(getZetaTokenSymbol('SOL', SupportedChain.SOLANA_DEVNET)).toBe(TOKEN_SYMBOLS.SOL_SOL);
    });

    it('should return correct ZRC-20 symbols for USDC', () => {
      expect(getZetaTokenSymbol('USDC', SupportedChain.ARBITRUM_SEPOLIA)).toBe(TOKEN_SYMBOLS.USDC_ARBI);
      expect(getZetaTokenSymbol('USDC', SupportedChain.ETHEREUM_SEPOLIA)).toBe(TOKEN_SYMBOLS.USDC_ETH);
      expect(getZetaTokenSymbol('USDC', SupportedChain.POLYGON_AMOY)).toBe(TOKEN_SYMBOLS.USDC_POL);
      expect(getZetaTokenSymbol('USDC', SupportedChain.BASE_SEPOLIA)).toBe(TOKEN_SYMBOLS.USDC_BASE);
      expect(getZetaTokenSymbol('USDC', SupportedChain.BSC_TESTNET)).toBe(TOKEN_SYMBOLS.USDC_BSC);
      expect(getZetaTokenSymbol('USDC', SupportedChain.SOLANA_DEVNET)).toBe(TOKEN_SYMBOLS.USDC_SOL);
    });

    it('should throw error for unsupported tokens', () => {
      expect(() => getZetaTokenSymbol('UNKNOWN', SupportedChain.ARBITRUM_SEPOLIA)).toThrow('getZetaTokenSymbol: Unknown token symbol: UNKNOWN');
      expect(() => getZetaTokenSymbol('BTC', SupportedChain.ETHEREUM_SEPOLIA)).toThrow('getZetaTokenSymbol: Unknown token symbol: BTC');
      expect(() => getZetaTokenSymbol('DAI', SupportedChain.POLYGON_AMOY)).toThrow('getZetaTokenSymbol: Unknown token symbol: DAI');
    });

    it('should throw error for unsupported chains', () => {
      expect(() => getZetaTokenSymbol('ETH', 999999)).toThrow('getZetaTokenSymbol: Unknown chain ID: 999999');
      expect(() => getZetaTokenSymbol('USDC', 0)).toThrow('getZetaTokenSymbol: Unknown chain ID: 0');
    });
  });

  describe('getZetaTokenAddress', () => {
    it('should return correct addresses for supported tokens', () => {
      expect(getZetaTokenAddress('ETH', SupportedChain.ARBITRUM_SEPOLIA)).toBe('0x1111111111111111111111111111111111111111');
      expect(getZetaTokenAddress('USDC', SupportedChain.ARBITRUM_SEPOLIA)).toBe('0x2222222222222222222222222222222222222222');
      expect(getZetaTokenAddress('ETH', SupportedChain.ETHEREUM_SEPOLIA)).toBe('0x3333333333333333333333333333333333333333');
      expect(getZetaTokenAddress('USDC', SupportedChain.ETHEREUM_SEPOLIA)).toBe('0x4444444444444444444444444444444444444444');
    });

    it('should throw error for unsupported tokens', () => {
      expect(() => getZetaTokenAddress('UNKNOWN', SupportedChain.ARBITRUM_SEPOLIA)).toThrow('getZetaTokenSymbol: Unknown token symbol: UNKNOWN');
      expect(() => getZetaTokenAddress('BTC', SupportedChain.ETHEREUM_SEPOLIA)).toThrow('getZetaTokenSymbol: Unknown token symbol: BTC');
    });

    it('should throw error for unsupported chains', () => {
      expect(() => getZetaTokenAddress('ETH', 999999)).toThrow('getZetaTokenSymbol: Unknown chain ID: 999999');
      expect(() => getZetaTokenAddress('USDC', 0)).toThrow('getZetaTokenSymbol: Unknown chain ID: 0');
    });

    it('should return null when getTokenAddress returns null', () => {
      mockGetTokenAddress.mockReturnValueOnce(null);
      expect(getZetaTokenAddress('ETH', SupportedChain.ARBITRUM_SEPOLIA)).toBeNull();
    });
  });

  describe('getTokenInfo', () => {
    it('should return correct token info for supported tokens', () => {
      const ethArbiInfo = getTokenInfo('ETH', SupportedChain.ARBITRUM_SEPOLIA);
      expect(ethArbiInfo).toEqual({
        symbol: 'ETH',
        zetaSymbol: TOKEN_SYMBOLS.ETH_ARBI,
        address: '0x1111111111111111111111111111111111111111',
        decimals: 18,
        isNative: true,
      });

      const usdcArbiInfo = getTokenInfo('USDC', SupportedChain.ARBITRUM_SEPOLIA);
      expect(usdcArbiInfo).toEqual({
        symbol: 'USDC',
        zetaSymbol: TOKEN_SYMBOLS.USDC_ARBI,
        address: '0x2222222222222222222222222222222222222222',
        decimals: 6,
        isNative: false,
      });
    });

    it('should return correct decimals for different tokens and chains', () => {
      // USDC should always have 6 decimals
      const usdcEthInfo = getTokenInfo('USDC', SupportedChain.ETHEREUM_SEPOLIA);
      expect(usdcEthInfo?.decimals).toBe(6);

      // SOL should have 9 decimals on Solana
      const solInfo = getTokenInfo('SOL', SupportedChain.SOLANA_DEVNET);
      expect(solInfo?.decimals).toBe(9);

      // ETH should have 18 decimals on other chains
      const ethEthInfo = getTokenInfo('ETH', SupportedChain.ETHEREUM_SEPOLIA);
      expect(ethEthInfo?.decimals).toBe(18);
    });

    it('should correctly identify native tokens', () => {
      expect(getTokenInfo('ETH', SupportedChain.ARBITRUM_SEPOLIA)?.isNative).toBe(true);
      expect(getTokenInfo('ETH', SupportedChain.ETHEREUM_SEPOLIA)?.isNative).toBe(true);
      expect(getTokenInfo('POL', SupportedChain.POLYGON_AMOY)?.isNative).toBe(true);
      expect(getTokenInfo('BNB', SupportedChain.BSC_TESTNET)?.isNative).toBe(true);
      expect(getTokenInfo('SOL', SupportedChain.SOLANA_DEVNET)?.isNative).toBe(true);
      
      expect(getTokenInfo('USDC', SupportedChain.ARBITRUM_SEPOLIA)?.isNative).toBe(false);
      expect(getTokenInfo('USDC', SupportedChain.ETHEREUM_SEPOLIA)?.isNative).toBe(false);
    });

    it('should throw error for unsupported tokens', () => {
      expect(() => getTokenInfo('UNKNOWN', SupportedChain.ARBITRUM_SEPOLIA)).toThrow('getZetaTokenSymbol: Unknown token symbol: UNKNOWN');
      expect(() => getTokenInfo('BTC', SupportedChain.ETHEREUM_SEPOLIA)).toThrow('getZetaTokenSymbol: Unknown token symbol: BTC');
    });

    it('should throw error for unsupported chains', () => {
      expect(() => getTokenInfo('ETH', 999999)).toThrow('getZetaTokenSymbol: Unknown chain ID: 999999');
      expect(() => getTokenInfo('USDC', 0)).toThrow('getZetaTokenSymbol: Unknown chain ID: 0');
    });
  });

  describe('getSupportedTokensForChain', () => {
    it('should return all ZRC-20 tokens for ZetaChain', () => {
      const tokens = getSupportedTokensForChain(SupportedChain.ZETA_TESTNET);
-      expect(tokens).toEqual(Object.values(TOKEN_SYMBOLS));
      const allZrc20 = Object.values(TOKEN_SYMBOLS);
      expect(tokens).toEqual(expect.arrayContaining(allZrc20));
      expect(tokens).toHaveLength(allZrc20.length);
    });

    it('should return native token and USDC for external chains', () => {
      expect(getSupportedTokensForChain(SupportedChain.ARBITRUM_SEPOLIA)).toEqual(['ETH', 'USDC']);
      expect(getSupportedTokensForChain(SupportedChain.ETHEREUM_SEPOLIA)).toEqual(['ETH', 'USDC']);
      expect(getSupportedTokensForChain(SupportedChain.POLYGON_AMOY)).toEqual(['POL', 'USDC']);
      expect(getSupportedTokensForChain(SupportedChain.BASE_SEPOLIA)).toEqual(['ETH', 'USDC']);
      expect(getSupportedTokensForChain(SupportedChain.BSC_TESTNET)).toEqual(['BNB', 'USDC']);
      expect(getSupportedTokensForChain(SupportedChain.SOLANA_DEVNET)).toEqual(['SOL', 'USDC']);
    });

    it('should throw error for unsupported chains', () => {
      expect(() => getSupportedTokensForChain(999999)).toThrow('getSupportedTokensForChain: Unknown chain ID: 999999');
      expect(() => getSupportedTokensForChain(0)).toThrow('getSupportedTokensForChain: Unknown chain ID: 0');
      expect(() => getSupportedTokensForChain(-1)).toThrow('getSupportedTokensForChain: Unknown chain ID: -1');
    });
  });

  describe('isTokenSupportedOnChain', () => {
    it('should return true for supported tokens on their respective chains', () => {
      expect(isTokenSupportedOnChain('ETH', SupportedChain.ARBITRUM_SEPOLIA)).toBe(true);
      expect(isTokenSupportedOnChain('USDC', SupportedChain.ARBITRUM_SEPOLIA)).toBe(true);
      expect(isTokenSupportedOnChain('ETH', SupportedChain.ETHEREUM_SEPOLIA)).toBe(true);
      expect(isTokenSupportedOnChain('USDC', SupportedChain.ETHEREUM_SEPOLIA)).toBe(true);
      expect(isTokenSupportedOnChain('POL', SupportedChain.POLYGON_AMOY)).toBe(true);
      expect(isTokenSupportedOnChain('USDC', SupportedChain.POLYGON_AMOY)).toBe(true);
      expect(isTokenSupportedOnChain('SOL', SupportedChain.SOLANA_DEVNET)).toBe(true);
      expect(isTokenSupportedOnChain('USDC', SupportedChain.SOLANA_DEVNET)).toBe(true);
    });

    it('should return false for unsupported tokens', () => {
      expect(isTokenSupportedOnChain('BTC', SupportedChain.ARBITRUM_SEPOLIA)).toBe(false);
      expect(isTokenSupportedOnChain('DAI', SupportedChain.ETHEREUM_SEPOLIA)).toBe(false);
      expect(isTokenSupportedOnChain('LINK', SupportedChain.POLYGON_AMOY)).toBe(false);
      expect(isTokenSupportedOnChain('UNKNOWN', SupportedChain.BSC_TESTNET)).toBe(false);
    });

    it('should return false for native tokens on wrong chains', () => {
      expect(isTokenSupportedOnChain('POL', SupportedChain.ARBITRUM_SEPOLIA)).toBe(false);
      expect(isTokenSupportedOnChain('BNB', SupportedChain.ETHEREUM_SEPOLIA)).toBe(false);
      expect(isTokenSupportedOnChain('SOL', SupportedChain.POLYGON_AMOY)).toBe(false);
    });

    it('should return false for unsupported chains', () => {
      expect(isTokenSupportedOnChain('ETH', 999999)).toThrow("getSupportedTokensForChain: Unknown chain ID: 999999");
      expect(isTokenSupportedOnChain('USDC', 0)).toThrow("getSupportedTokensForChain: Unknown chain ID: 0");
      expect(isTokenSupportedOnChain('BTC', -1)).toThrow("getSupportedTokensForChain: Unknown chain ID: -1");
    });

    it('should return true for all ZRC-20 tokens on ZetaChain', () => {
      const zetaTokens = Object.values(TOKEN_SYMBOLS);
      zetaTokens.forEach(token => {
        expect(isTokenSupportedOnChain(token, SupportedChain.ZETA_TESTNET)).toBe(true);
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty strings gracefully', () => {
      expect(() => getChainIdFromSourceChain('')).toThrow('getChainIdFromSourceChain: Unknown chain string: ');
      expect(() => getChainDisplayName('')).toThrow('getChainDisplayName: Unknown chain string: ');
      expect(() => getGasTokenSymbol('')).toThrow('getGasTokenSymbol: Unknown chain string: ');
      expect(getGasTokenDecimals('')).toBe(18);
      expect(() => getZetaTokenSymbol('', SupportedChain.ARBITRUM_SEPOLIA)).toThrow('getZetaTokenSymbol: Unknown token symbol: ');
      expect(isTokenSupportedOnChain('', SupportedChain.ARBITRUM_SEPOLIA)).toBe(false);
    });

    it('should handle null/undefined inputs gracefully', () => {
      expect(() => getSupportedTokensForChain(null as any)).toThrow();
      expect(() => getSupportedTokensForChain(undefined as any)).toThrow();
      expect(() => isTokenSupportedOnChain('ETH', null as any)).toThrow();
      expect(() => isTokenSupportedOnChain('ETH', undefined as any)).toThrow();
    });

    it('should be case insensitive where appropriate', () => {
      expect(getChainIdFromSourceChain('arbitrum')).toBe(getChainIdFromSourceChain('ARBITRUM'));
      expect(getChainDisplayName('ethereum')).toBe(getChainDisplayName('ETHEREUM'));
      expect(getGasTokenSymbol('polygon')).toBe(getGasTokenSymbol('POLYGON'));
    });

    it('should handle special characters in chain names', () => {
      expect(() => getChainIdFromSourceChain('arbitrum-sepolia')).toThrow('getChainIdFromSourceChain: Unknown chain string: arbitrum-sepolia');
      expect(() => getChainDisplayName('arbitrum_sepolia')).toThrow('getChainDisplayName: Unknown chain string: arbitrum_sepolia');
    });
  });
});