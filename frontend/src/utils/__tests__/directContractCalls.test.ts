import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the environment variable first
vi.stubEnv('VITE_ALCHEMY_API_KEY', 'test-api-key');

// Mock modules
vi.mock('../../contracts/deployments');
vi.mock('../chainUtils');

describe('directContractCalls', () => {
  const mockProtocolAddress = '0x1234567890123456789012345678901234567890';
  const mockOracleAddress = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcdef';
  const mockAssetAddress = '0x9876543210987654321098765432109876543210';
  const mockUserAddress = '0x1111111111111111111111111111111111111111';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Module Loading', () => {
    it('should load the module without errors', async () => {
      const { getSupportedAssetsCount } = await import('../directContractCalls');
      expect(typeof getSupportedAssetsCount).toBe('function');
    });

    it('should have all expected exports', async () => {
      const module = await import('../directContractCalls');
      
      expect(typeof module.getSupportedAssetsCount).toBe('function');
      expect(typeof module.getSupportedAsset).toBe('function');
      expect(typeof module.getAssetConfig).toBe('function');
      expect(typeof module.getTokenBalance).toBe('function');
      expect(typeof module.getAssetPrice).toBe('function');
      expect(typeof module.getTokenDecimals).toBe('function');
      expect(typeof module.getTokenSymbol).toBe('function');
      expect(typeof module.getAllSupportedAssets).toBe('function');
      expect(typeof module.getProtocolAssetData).toBe('function');
      expect(typeof module.calculateTVL).toBe('function');
      expect(typeof module.getMaxAvailableAmount).toBe('function');
      expect(typeof module.getBorrowableAssets).toBe('function');
    });
  });

  describe('getSupportedAssetsCount', () => {
    it('should return 0 when protocol address is not found', async () => {
      const deployments = await import('../../contracts/deployments');
      vi.mocked(deployments.getUniversalLendingProtocolAddress).mockReturnValue(null);

      const { getSupportedAssetsCount } = await import('../directContractCalls');
      const result = await getSupportedAssetsCount();

      expect(result).toBe(0);
    });

    it('should return 0 when contract call fails', async () => {
      const deployments = await import('../../contracts/deployments');
      vi.mocked(deployments.getUniversalLendingProtocolAddress).mockReturnValue(mockProtocolAddress);

      const { getSupportedAssetsCount } = await import('../directContractCalls');
      
      // This will test error handling since the mocked client will be called
      const result = await getSupportedAssetsCount();
      expect(result).toBe(0);
    });
  });

  describe('getAssetPrice', () => {
    it('should return 0 when oracle address is not found', async () => {
      const deployments = await import('../../contracts/deployments');
      vi.mocked(deployments.getPriceOracleAddress).mockReturnValue(null);

      const { getAssetPrice } = await import('../directContractCalls');
      const result = await getAssetPrice(mockAssetAddress);

      expect(result).toBe(BigInt(0));
    });

    it('should return 0 when asset address is invalid', async () => {
      const { getAssetPrice } = await import('../directContractCalls');
      
      const result1 = await getAssetPrice('');
      expect(result1).toBe(BigInt(0));

      const result2 = await getAssetPrice('0');
      expect(result2).toBe(BigInt(0));
    });

    it('should handle null/undefined addresses gracefully', async () => {
      const { getAssetPrice } = await import('../directContractCalls');
      
      expect(await getAssetPrice(null as any)).toBe(BigInt(0));
      expect(await getAssetPrice(undefined as any)).toBe(BigInt(0));
    });
  });

  describe('getTokenDecimals', () => {
    it('should return token decimals from deployment config', async () => {
      const deployments = await import('../../contracts/deployments');
      vi.mocked(deployments.getTokenDecimals).mockReturnValue(6);

      const { getTokenDecimals } = await import('../directContractCalls');
      const result = getTokenDecimals(mockAssetAddress);

      expect(result).toBe(6);
      expect(deployments.getTokenDecimals).toHaveBeenCalledWith(mockAssetAddress);
    });

    it('should handle 18 decimal tokens', async () => {
      const deployments = await import('../../contracts/deployments');
      vi.mocked(deployments.getTokenDecimals).mockReturnValue(18);

      const { getTokenDecimals } = await import('../directContractCalls');
      const result = getTokenDecimals(mockAssetAddress);

      expect(result).toBe(18);
    });
  });

  describe('calculateTVL', () => {
    it('should calculate total value locked from asset data', async () => {
      const { calculateTVL } = await import('../directContractCalls');
      
      const assetData = [
        {
          address: '0x1',
          symbol: 'ETH.ARBI',
          unit: 'ETH',
          sourceChain: 'ARBI',
          balance: '1000000000000000000',
          formattedBalance: '1.0',
          usdValue: '$2,000',
          price: '$2,000.00',
          isSupported: true,
          decimals: 18,
        },
        {
          address: '0x2',
          symbol: 'USDC.ARBI',
          unit: 'USDC',
          sourceChain: 'ARBI',
          balance: '1000000',
          formattedBalance: '1.0',
          usdValue: '$1,000',
          price: '$1.00',
          isSupported: true,
          decimals: 6,
        },
        {
          address: '0x3',
          symbol: 'UNSUPPORTED',
          unit: 'UNSUPPORTED',
          sourceChain: 'UNKNOWN',
          balance: '0',
          formattedBalance: '0',
          usdValue: '$5,000',
          price: '$0.00',
          isSupported: false,
          decimals: 18,
        },
      ];

      const result = calculateTVL(assetData);
      expect(result).toBe(3000); // $2000 + $1000, excluding unsupported asset
    });

    it('should handle empty asset data array', async () => {
      const { calculateTVL } = await import('../directContractCalls');
      const result = calculateTVL([]);
      expect(result).toBe(0);
    });

    it('should handle malformed USD values gracefully', async () => {
      const { calculateTVL } = await import('../directContractCalls');
      
      const assetData = [
        {
          address: '0x1',
          symbol: 'MALFORMED',
          unit: 'MALFORMED',
          sourceChain: 'TEST',
          balance: '1000',
          formattedBalance: '1000',
          usdValue: 'invalid-value',
          price: '$1.00',
          isSupported: true,
          decimals: 18,
        },
      ];

      const result = calculateTVL(assetData);
      expect(result).toBe(0); // NaN values should be treated as 0
    });
  });

  describe('Error Handling', () => {
    it('should handle concurrent contract calls', async () => {
      const deployments = await import('../../contracts/deployments');
      vi.mocked(deployments.getUniversalLendingProtocolAddress).mockReturnValue(mockProtocolAddress);
      vi.mocked(deployments.getPriceOracleAddress).mockReturnValue(mockOracleAddress);

      const { 
        getSupportedAssetsCount,
        getAssetPrice,
        getTokenBalance,
        getMaxAvailableAmount 
      } = await import('../directContractCalls');

      const promises = [
        getSupportedAssetsCount(),
        getAssetPrice(mockAssetAddress),
        getTokenBalance(mockAssetAddress, mockUserAddress),
        getMaxAvailableAmount(mockAssetAddress),
      ];

      const results = await Promise.all(promises);

      // All should return safe defaults due to mocked contract failures
      expect(results[0]).toBe(0); // count
      expect(results[1]).toBe(BigInt(0)); // price
      expect(results[2]).toBe(BigInt(0)); // balance
      expect(results[3]).toBe(BigInt(0)); // max amount
    });

    it('should maintain consistency across multiple calls', async () => {
      const deployments = await import('../../contracts/deployments');
      vi.mocked(deployments.getPriceOracleAddress).mockReturnValue(mockOracleAddress);

      const { getAssetPrice } = await import('../directContractCalls');

      const results = await Promise.all([
        getAssetPrice(mockAssetAddress),
        getAssetPrice(mockAssetAddress),
        getAssetPrice(mockAssetAddress),
      ]);

      // All should return the same value (BigInt(0) due to mock failure)
      results.forEach(result => {
        expect(result).toBe(BigInt(0));
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle null/undefined inputs gracefully', async () => {
      const { getTokenBalance } = await import('../directContractCalls');
      
      expect(await getTokenBalance(null as any, mockUserAddress)).toBe(BigInt(0));
      expect(await getTokenBalance(mockAssetAddress, null as any)).toBe(BigInt(0));
    });

    it('should handle empty string inputs', async () => {
      const { getAssetPrice, getTokenBalance } = await import('../directContractCalls');
      
      expect(await getAssetPrice('')).toBe(BigInt(0));
      expect(await getTokenBalance('', mockUserAddress)).toBe(BigInt(0));
      expect(await getTokenBalance(mockAssetAddress, '')).toBe(BigInt(0));
    });
  });
});