import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useAccount, useReadContracts } from 'wagmi';
import { useDashboardData } from '../useDashboardData';
import { useContracts } from '../useContracts';
import { useMultiChainBalances } from '../useMultiChainBalances';
import { useOptimizedQueries } from '../useOptimizedQueries';
import { SupportedChain } from '../../contracts/deployments';

// Mock all dependencies
vi.mock('wagmi');
vi.mock('../useContracts');
vi.mock('../useMultiChainBalances');
vi.mock('../useOptimizedQueries');

// Mock additional React Query dependencies
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: vi.fn(() => ({
    invalidateQueries: vi.fn().mockResolvedValue(undefined),
  })),
}));

const mockUseAccount = useAccount as ReturnType<typeof vi.fn>;
const mockUseReadContracts = useReadContracts as ReturnType<typeof vi.fn>;
const mockUseContracts = useContracts as ReturnType<typeof vi.fn>;
const mockUseMultiChainBalances = useMultiChainBalances as ReturnType<typeof vi.fn>;
const mockUseOptimizedQueries = useOptimizedQueries as ReturnType<typeof vi.fn>;

describe('useDashboardData', () => {
  const mockAddress = '0x1234567890123456789012345678901234567890' as const;
  const mockContractAddress = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as const;
  const mockOracleAddress = '0x9876543210987654321098765432109876543210' as const;

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
    mockUseAccount.mockReturnValue({
      isConnected: false,
      address: undefined,
    });

    mockUseContracts.mockReturnValue({
      universalLendingProtocol: null,
      priceOracle: null,
    });

    mockUseMultiChainBalances.mockReturnValue({
      balances: {},
      isLoading: false,
    });

    mockUseOptimizedQueries.mockReturnValue({
      invalidateUserQueries: vi.fn().mockResolvedValue(undefined),
      prefetchUserData: vi.fn().mockResolvedValue(undefined),
    });

    mockUseReadContracts.mockReturnValue({
      data: undefined,
      refetch: vi.fn().mockResolvedValue({ data: undefined }),
    });
  });

  describe('Basic Functionality', () => {
    it('should return initial state when not connected', () => {
      const { result } = renderHook(() => useDashboardData());

      expect(result.current.userAssets).toEqual([]);
      expect(result.current.totalSupplied).toBe('$0.00');
      expect(result.current.totalBorrowed).toBe('$0.00');
      expect(result.current.healthFactor).toBe('∞');
      expect(result.current.externalBalances).toEqual({});
      expect(result.current.isLoadingExternalBalances).toBe(false);
      expect(typeof result.current.refetchUserData).toBe('function');
    });

    it('should provide refetchUserData function', async () => {
      const mockInvalidateUserQueries = vi.fn().mockResolvedValue(undefined);
      const mockRefetchAssetPrices = vi.fn().mockResolvedValue({ data: undefined });

      mockUseOptimizedQueries.mockReturnValue({
        invalidateUserQueries: mockInvalidateUserQueries,
        prefetchUserData: vi.fn().mockResolvedValue(undefined),
      });

      // Mock the refetch function for asset prices
      mockUseReadContracts.mockImplementation((config) => {
        if (config.contracts?.[0]?.functionName === 'getPrice') {
          return {
            data: undefined,
            refetch: mockRefetchAssetPrices,
          };
        }
        return {
          data: undefined,
          refetch: vi.fn().mockResolvedValue({ data: undefined }),
        };
      });

      mockUseAccount.mockReturnValue({
        isConnected: true,
        address: mockAddress,
      });

      const { result } = renderHook(() => useDashboardData());

      await result.current.refetchUserData();

      expect(mockInvalidateUserQueries).toHaveBeenCalledWith(mockAddress);
      expect(mockRefetchAssetPrices).toHaveBeenCalled();
    });

    it('should handle refetchUserData when no address', async () => {
      const mockInvalidateUserQueries = vi.fn().mockResolvedValue(undefined);

      mockUseOptimizedQueries.mockReturnValue({
        invalidateUserQueries: mockInvalidateUserQueries,
        prefetchUserData: vi.fn().mockResolvedValue(undefined),
      });

      mockUseAccount.mockReturnValue({
        isConnected: false,
        address: undefined,
      });

      const { result } = renderHook(() => useDashboardData());

      await result.current.refetchUserData();

      expect(mockInvalidateUserQueries).not.toHaveBeenCalled();
    });
  });

  describe('Connected State', () => {
    beforeEach(() => {
      mockUseAccount.mockReturnValue({
        isConnected: true,
        address: mockAddress,
      });

      mockUseContracts.mockReturnValue({
        universalLendingProtocol: mockContractAddress,
        priceOracle: mockOracleAddress,
      });
    });

    it('should use ZetaChain testnet for lending protocol', () => {
      renderHook(() => useDashboardData());

      expect(mockUseContracts).toHaveBeenCalledWith(SupportedChain.ZETA_TESTNET);
    });

    it('should enable contract queries when connected and contracts available', () => {
      renderHook(() => useDashboardData());

      // Check that useReadContracts was called with enabled: true for user data
      const calls = mockUseReadContracts.mock.calls;
      const userSuppliesCalls = calls.filter(call => 
        call[0].contracts?.[0]?.functionName === 'getSupplyBalance'
      );
      const userBorrowsCalls = calls.filter(call => 
        call[0].contracts?.[0]?.functionName === 'getBorrowBalance'
      );

      expect(userSuppliesCalls.length).toBeGreaterThan(0);
      expect(userBorrowsCalls.length).toBeGreaterThan(0);
      
      if (userSuppliesCalls[0]?.[0]?.query) {
        expect(userSuppliesCalls[0][0].query.enabled).toBe(true);
      }
      if (userBorrowsCalls[0]?.[0]?.query) {
        expect(userBorrowsCalls[0][0].query.enabled).toBe(true);
      }
    });

    it('should disable contract queries when not connected', () => {
      mockUseAccount.mockReturnValue({
        isConnected: false,
        address: undefined,
      });

      renderHook(() => useDashboardData());

      // Check that useReadContracts was called with enabled: false for user data
      const calls = mockUseReadContracts.mock.calls;
      const userSuppliesCalls = calls.filter(call => 
        call[0].contracts?.[0]?.functionName === 'getSupplyBalance'
      );

      expect(userSuppliesCalls.length).toBeGreaterThan(0);
      if (userSuppliesCalls[0]?.[0]?.query) {
        expect(userSuppliesCalls[0][0].query.enabled).toBe(false);
      }
    });
  });

  describe('Data Processing', () => {
    beforeEach(() => {
      mockUseAccount.mockReturnValue({
        isConnected: true,
        address: mockAddress,
      });

      mockUseContracts.mockReturnValue({
        universalLendingProtocol: mockContractAddress,
        priceOracle: mockOracleAddress,
      });
    });

    it('should process asset data when all contract data is available', async () => {
      // Mock successful contract responses
      mockUseReadContracts.mockImplementation((config) => {
        const functionName = config.contracts?.[0]?.functionName;
        
        switch (functionName) {
          case 'getSupplyBalance':
            return {
              data: [{ result: BigInt('1000000000000000000'), status: 'success' }], // 1 ETH
              refetch: vi.fn(),
            };
          case 'getBorrowBalance':
            return {
              data: [{ result: BigInt('500000000000000000'), status: 'success' }], // 0.5 ETH
              refetch: vi.fn(),
            };
          case 'getAssetConfig':
            return {
              data: [{ result: { isSupported: true }, status: 'success' }],
              refetch: vi.fn(),
            };
          case 'getPrice':
            return {
              data: [{ result: BigInt('2000000000000000000000'), status: 'success' }], // $2000
              refetch: vi.fn().mockResolvedValue({ data: undefined }),
            };
          case 'decimals':
            return {
              data: [{ result: 18, status: 'success' }],
              refetch: vi.fn(),
            };
          case 'getUserAccountData':
            return {
              data: [{ 
                result: [BigInt(0), BigInt(0), BigInt(0), BigInt(0), BigInt('2500000000000000000')], // HF = 2.5
                status: 'success' 
              }],
              refetch: vi.fn(),
            };
          default:
            return {
              data: undefined,
              refetch: vi.fn(),
            };
        }
      });

      const { result } = renderHook(() => useDashboardData());

      await waitFor(() => {
        expect(result.current.userAssets.length).toBeGreaterThan(0);
      });

      expect(result.current.totalSupplied).not.toBe('$0.00');
      expect(result.current.totalBorrowed).not.toBe('$0.00');
      expect(result.current.healthFactor).toBe('2.50');
    });

    it('should handle health factor calculation correctly', async () => {
      mockUseReadContracts.mockImplementation((config) => {
        const functionName = config.contracts?.[0]?.functionName;
        
        if (functionName === 'getUserAccountData') {
          return {
            data: [{ 
              result: [BigInt(0), BigInt(0), BigInt(0), BigInt(0), BigInt('1500000000000000000')], // HF = 1.5
              status: 'success' 
            }],
            refetch: vi.fn(),
          };
        }
        
        return {
          data: undefined,
          refetch: vi.fn(),
        };
      });

      const { result } = renderHook(() => useDashboardData());

      await waitFor(() => {
        expect(result.current.healthFactor).toBe('1.50');
      });
    });

    it('should handle infinite health factor', async () => {
      mockUseReadContracts.mockImplementation((config) => {
        const functionName = config.contracts?.[0]?.functionName;
        
        if (functionName === 'getUserAccountData') {
          return {
            data: [{ 
              result: [BigInt(0), BigInt(0), BigInt(0), BigInt(0), BigInt('0')], // HF = 0 (infinite)
              status: 'success' 
            }],
            refetch: vi.fn(),
          };
        }
        
        return {
          data: undefined,
          refetch: vi.fn(),
        };
      });

      const { result } = renderHook(() => useDashboardData());

      await waitFor(() => {
        expect(result.current.healthFactor).toBe('∞');
      });
    });

    it('should handle very high health factor as infinite', async () => {
      mockUseReadContracts.mockImplementation((config) => {
        const functionName = config.contracts?.[0]?.functionName;
        
        if (functionName === 'getUserAccountData') {
          return {
            data: [{ 
              result: [BigInt(0), BigInt(0), BigInt(0), BigInt(0), BigInt('2000000000000000000000')], // HF = 2000
              status: 'success' 
            }],
            refetch: vi.fn(),
          };
        }
        
        return {
          data: undefined,
          refetch: vi.fn(),
        };
      });

      const { result } = renderHook(() => useDashboardData());

      await waitFor(() => {
        expect(result.current.healthFactor).toBe('∞');
      });
    });
  });

  describe('External Balances Integration', () => {
    beforeEach(() => {
      mockUseAccount.mockReturnValue({
        isConnected: true,
        address: mockAddress,
      });

      mockUseContracts.mockReturnValue({
        universalLendingProtocol: mockContractAddress,
        priceOracle: mockOracleAddress,
      });
    });

    it('should integrate external balances from multi-chain hook', () => {
      const mockExternalBalances = {
        [SupportedChain.ARBITRUM_SEPOLIA]: {
          'ETH': { balance: '1000000000000000000', formattedBalance: '1.0' },
          'USDC': { balance: '1000000000', formattedBalance: '1000.0' },
        },
        [SupportedChain.ETHEREUM_SEPOLIA]: {
          'ETH': { balance: '2000000000000000000', formattedBalance: '2.0' },
          'USDC': { balance: '2000000000', formattedBalance: '2000.0' },
        },
      };

      mockUseMultiChainBalances.mockReturnValue({
        balances: mockExternalBalances,
        isLoading: false,
      });

      const { result } = renderHook(() => useDashboardData());

      expect(result.current.externalBalances).toEqual(mockExternalBalances);
      expect(result.current.isLoadingExternalBalances).toBe(false);
    });

    it('should handle loading state for external balances', () => {
      mockUseMultiChainBalances.mockReturnValue({
        balances: {},
        isLoading: true,
      });

      const { result } = renderHook(() => useDashboardData());

      expect(result.current.isLoadingExternalBalances).toBe(true);
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      mockUseAccount.mockReturnValue({
        isConnected: true,
        address: mockAddress,
      });

      mockUseContracts.mockReturnValue({
        universalLendingProtocol: mockContractAddress,
        priceOracle: mockOracleAddress,
      });
    });

    it('should handle failed contract calls gracefully', () => {
      mockUseReadContracts.mockImplementation(() => ({
        data: [{ result: undefined, status: 'failure', error: new Error('Contract call failed') }],
        refetch: vi.fn(),
      }));

      const { result } = renderHook(() => useDashboardData());

      expect(result.current.userAssets).toEqual([]);
      expect(result.current.totalSupplied).toBe('$0.00');
      expect(result.current.totalBorrowed).toBe('$0.00');
      expect(result.current.healthFactor).toBe('∞');
    });

    it('should handle missing contract addresses', () => {
      mockUseContracts.mockReturnValue({
        universalLendingProtocol: null,
        priceOracle: null,
      });

      const { result } = renderHook(() => useDashboardData());

      expect(result.current.userAssets).toEqual([]);
      expect(result.current.totalSupplied).toBe('$0.00');
      expect(result.current.totalBorrowed).toBe('$0.00');
    });

    it('should handle partial contract data gracefully', async () => {
      mockUseReadContracts.mockImplementation((config) => {
        const functionName = config.contracts?.[0]?.functionName;
        
        // Only provide supply balance, missing other data
        if (functionName === 'getSupplyBalance') {
          return {
            data: [{ result: BigInt('1000000000000000000'), status: 'success' }],
            refetch: vi.fn(),
          };
        }
        
        return {
          data: [{ result: undefined, status: 'failure' }],
          refetch: vi.fn(),
        };
      });

      const { result } = renderHook(() => useDashboardData());

      // Should not crash and should maintain initial state
      expect(result.current.userAssets).toEqual([]);
      expect(result.current.totalSupplied).toBe('$0.00');
      expect(result.current.totalBorrowed).toBe('$0.00');
    });
  });

  describe('Prefetching and Optimization', () => {
    beforeEach(() => {
      mockUseAccount.mockReturnValue({
        isConnected: true,
        address: mockAddress,
      });

      mockUseContracts.mockReturnValue({
        universalLendingProtocol: mockContractAddress,
        priceOracle: mockOracleAddress,
      });
    });

    it('should call prefetchUserData when connected and asset addresses available', () => {
      const mockPrefetchUserData = vi.fn().mockResolvedValue(undefined);
      
      mockUseOptimizedQueries.mockReturnValue({
        invalidateUserQueries: vi.fn().mockResolvedValue(undefined),
        prefetchUserData: mockPrefetchUserData,
      });

      mockUseMultiChainBalances.mockReturnValue({
        balances: {
          [SupportedChain.ARBITRUM_SEPOLIA]: {},
          [SupportedChain.ETHEREUM_SEPOLIA]: {},
        },
        isLoading: false,
      });

      renderHook(() => useDashboardData());

      expect(mockPrefetchUserData).toHaveBeenCalled();
      const [address, assetAddresses, chains] = mockPrefetchUserData.mock.calls[0];
      
      expect(address).toBe(mockAddress);
      expect(Array.isArray(assetAddresses)).toBe(true);
      expect(Array.isArray(chains)).toBe(true);
      expect(chains).toEqual([SupportedChain.ARBITRUM_SEPOLIA, SupportedChain.ETHEREUM_SEPOLIA]);
    });

    it('should not call prefetchUserData when not connected', () => {
      const mockPrefetchUserData = vi.fn().mockResolvedValue(undefined);
      
      mockUseOptimizedQueries.mockReturnValue({
        invalidateUserQueries: vi.fn().mockResolvedValue(undefined),
        prefetchUserData: mockPrefetchUserData,
      });

      mockUseAccount.mockReturnValue({
        isConnected: false,
        address: undefined,
      });

      renderHook(() => useDashboardData());

      expect(mockPrefetchUserData).not.toHaveBeenCalled();
    });
  });
});