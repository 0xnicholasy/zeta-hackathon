import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useChainId } from 'wagmi';
import { useContracts, useContract, useToken, useDeploymentStatus } from '../useContracts';
import * as deployments from '../../contracts/deployments';

// Mock wagmi
vi.mock('wagmi');

// Mock deployments module
vi.mock('../../contracts/deployments');

const mockUseChainId = useChainId as ReturnType<typeof vi.fn>;
const mockGetAllContracts = deployments.getAllContracts as ReturnType<typeof vi.fn>;
const mockGetAllTokens = deployments.getAllTokens as ReturnType<typeof vi.fn>;
const mockGetNetworkConfig = deployments.getNetworkConfig as ReturnType<typeof vi.fn>;
const mockGetContractAddress = deployments.getContractAddress as ReturnType<typeof vi.fn>;
const mockGetTokenAddress = deployments.getTokenAddress as ReturnType<typeof vi.fn>;
const mockIsContractDeployed = deployments.isContractDeployed as ReturnType<typeof vi.fn>;
const mockIsTokenAvailable = deployments.isTokenAvailable as ReturnType<typeof vi.fn>;

describe('useContracts', () => {
  const mockZetaChainId = 7001;
  const mockArbitrumSepoliaId = 421614;
  const mockEthereumSepoliaId = 11155111;

  const mockContracts = {
    SimpleLendingProtocol: '0x1234567890123456789012345678901234567890',
    UniversalLendingProtocol: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
    DepositContract: '0x9876543210987654321098765432109876543210',
    MockPriceOracle: '0x5678901234567890123456789012345678901234',
  };

  const mockTokens = {
    'ETH.ARBI': '0xaaa1111111111111111111111111111111111111',
    'USDC.ARBI': '0xbbb2222222222222222222222222222222222222',
    'ETH.ETH': '0xccc3333333333333333333333333333333333333',
    'USDC.ETH': '0xddd4444444444444444444444444444444444444',
    ZETA: '0xeee5555555555555555555555555555555555555',
    ETH: '0xfff6666666666666666666666666666666666666',
    USDC: '0x1117777777777777777777777777777777777777',
  };

  const mockNetworkConfig = {
    name: 'ZetaChain Athens Testnet',
    chainId: mockZetaChainId,
    isTestnet: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
    mockUseChainId.mockReturnValue(mockZetaChainId);
    mockGetAllContracts.mockReturnValue(mockContracts);
    mockGetAllTokens.mockReturnValue(mockTokens);
    mockGetNetworkConfig.mockReturnValue(mockNetworkConfig);
    mockGetContractAddress.mockReturnValue(mockContracts.UniversalLendingProtocol);
    mockGetTokenAddress.mockReturnValue(mockTokens['ETH.ARBI']);
    mockIsContractDeployed.mockReturnValue(true);
    mockIsTokenAvailable.mockReturnValue(true);
  });

  describe('Basic Functionality', () => {
    it('should return contracts and tokens for current chain', () => {
      const { result } = renderHook(() => useContracts());

      expect(result.current.chainId).toBe(mockZetaChainId);
      expect(result.current.walletChainId).toBe(mockZetaChainId);
      expect(result.current.contracts).toEqual(mockContracts);
      expect(result.current.tokens).toEqual(mockTokens);
      expect(result.current.networkConfig).toEqual(mockNetworkConfig);
    });

    it('should return null when no chain ID is available', () => {
      mockUseChainId.mockReturnValue(undefined);

      const { result } = renderHook(() => useContracts());

      expect(result.current.chainId).toBeUndefined();
      expect(result.current.contracts).toBeNull();
      expect(result.current.tokens).toBeNull();
      expect(result.current.networkConfig).toBeNull();
    });

    it('should use target chain ID when provided', () => {
      const { result } = renderHook(() => useContracts(mockArbitrumSepoliaId));

      expect(result.current.chainId).toBe(mockArbitrumSepoliaId);
      expect(mockGetAllContracts).toHaveBeenCalledWith(mockArbitrumSepoliaId);
      expect(mockGetAllTokens).toHaveBeenCalledWith(mockArbitrumSepoliaId);
      expect(mockGetNetworkConfig).toHaveBeenCalledWith(mockArbitrumSepoliaId);
    });
  });

  describe('Helper Functions', () => {
    it('should return contract address via getContract', () => {
      const { result } = renderHook(() => useContracts());

      const contractAddress = result.current.getContract('UniversalLendingProtocol');
      expect(contractAddress).toBe(mockContracts.UniversalLendingProtocol);
      expect(mockGetContractAddress).toHaveBeenCalledWith('UniversalLendingProtocol', mockZetaChainId);
    });

    it('should return null from getContract when no chain ID', () => {
      mockUseChainId.mockReturnValue(undefined);
      const { result } = renderHook(() => useContracts());

      const contractAddress = result.current.getContract('UniversalLendingProtocol');
      expect(contractAddress).toBeNull();
    });

    it('should return token address via getToken', () => {
      const { result } = renderHook(() => useContracts());

      const tokenAddress = result.current.getToken('ETH.ARBI');
      expect(tokenAddress).toBe(mockTokens['ETH.ARBI']);
      expect(mockGetTokenAddress).toHaveBeenCalledWith('ETH.ARBI', mockZetaChainId);
    });

    it('should return null from getToken when no chain ID', () => {
      mockUseChainId.mockReturnValue(undefined);
      const { result } = renderHook(() => useContracts());

      const tokenAddress = result.current.getToken('ETH.ARBI');
      expect(tokenAddress).toBeNull();
    });

    it('should check contract deployment via isDeployed', () => {
      const { result } = renderHook(() => useContracts());

      const isDeployed = result.current.isDeployed('UniversalLendingProtocol');
      expect(isDeployed).toBe(true);
      expect(mockIsContractDeployed).toHaveBeenCalledWith('UniversalLendingProtocol', mockZetaChainId);
    });

    it('should return false from isDeployed when no chain ID', () => {
      mockUseChainId.mockReturnValue(undefined);
      const { result } = renderHook(() => useContracts());

      const isDeployed = result.current.isDeployed('UniversalLendingProtocol');
      expect(isDeployed).toBe(false);
    });

    it('should check token availability via isAvailable', () => {
      const { result } = renderHook(() => useContracts());

      const isAvailable = result.current.isAvailable('ETH.ARBI');
      expect(isAvailable).toBe(true);
      expect(mockIsTokenAvailable).toHaveBeenCalledWith('ETH.ARBI', mockZetaChainId);
    });

    it('should return false from isAvailable when no chain ID', () => {
      mockUseChainId.mockReturnValue(undefined);
      const { result } = renderHook(() => useContracts());

      const isAvailable = result.current.isAvailable('ETH.ARBI');
      expect(isAvailable).toBe(false);
    });
  });

  describe('Specific Contract Getters', () => {
    it('should provide specific contract addresses', () => {
      mockGetContractAddress.mockImplementation((contractName) => {
        const contractMap = {
          'SimpleLendingProtocol': mockContracts.SimpleLendingProtocol,
          'UniversalLendingProtocol': mockContracts.UniversalLendingProtocol,
          'DepositContract': mockContracts.DepositContract,
          'MockPriceOracle': mockContracts.MockPriceOracle,
        };
        return contractMap[contractName as keyof typeof contractMap] || null;
      });

      const { result } = renderHook(() => useContracts());

      expect(result.current.simpleLendingProtocol).toBe(mockContracts.SimpleLendingProtocol);
      expect(result.current.universalLendingProtocol).toBe(mockContracts.UniversalLendingProtocol);
      expect(result.current.depositContract).toBe(mockContracts.DepositContract);
      expect(result.current.priceOracle).toBe(mockContracts.MockPriceOracle);
    });

    it('should provide specific token addresses', () => {
      mockGetTokenAddress.mockImplementation((tokenSymbol) => {
        return mockTokens[tokenSymbol as keyof typeof mockTokens] || null;
      });

      const { result } = renderHook(() => useContracts());

      expect(result.current.ethArbi).toBe(mockTokens['ETH.ARBI']);
      expect(result.current.usdcArbi).toBe(mockTokens['USDC.ARBI']);
      expect(result.current.ethEth).toBe(mockTokens['ETH.ETH']);
      expect(result.current.usdcEth).toBe(mockTokens['USDC.ETH']);
      expect(result.current.zeta).toBe(mockTokens.ZETA);
      expect(result.current.eth).toBe(mockTokens.ETH);
      expect(result.current.usdc).toBe(mockTokens.USDC);
    });

    it('should include SupportedChain constant', () => {
      const { result } = renderHook(() => useContracts());

      expect(result.current.SupportedChain).toBeDefined();
    });
  });

  describe('Memoization', () => {
    it('should memoize contracts based on chain ID', () => {
      const { result, rerender } = renderHook(() => useContracts());

      const firstContracts = result.current.contracts;
      rerender();
      const secondContracts = result.current.contracts;

      expect(firstContracts).toBe(secondContracts);
      expect(mockGetAllContracts).toHaveBeenCalledTimes(1);
    });

    it('should recalculate when chain ID changes', () => {
      // Ensure mockGetAllContracts returns different objects for different chain IDs
      const zetaContracts = { ...mockContracts };
      const arbitrumContracts = {
        SimpleLendingProtocol: '0xdifferent567890123456789012345678901234567890',
        UniversalLendingProtocol: '0xdifferentabcdefabcdefabcdefabcdefabcdefabcd',
        DepositContract: '0xdifferent987654321098765432109876543210',
        MockPriceOracle: '0xdifferent678901234567890123456789012345678',
      };

      mockGetAllContracts.mockImplementation((chainId) => {
        if (chainId === mockZetaChainId) return zetaContracts;
        if (chainId === mockArbitrumSepoliaId) return arbitrumContracts;
        return mockContracts;
      });

      const { result, rerender } = renderHook(
        ({ chainId }) => useContracts(chainId),
        { initialProps: { chainId: mockZetaChainId } }
      );

      const firstContracts = result.current.contracts;

      rerender({ chainId: mockArbitrumSepoliaId });
      const secondContracts = result.current.contracts;

      expect(firstContracts).not.toBe(secondContracts);
      expect(mockGetAllContracts).toHaveBeenCalledTimes(2);
      expect(mockGetAllContracts).toHaveBeenCalledWith(mockZetaChainId);
      expect(mockGetAllContracts).toHaveBeenCalledWith(mockArbitrumSepoliaId);
    });
  });
});

describe('useContract', () => {
  const mockChainId = 7001;
  const mockContractAddress = '0x1234567890123456789012345678901234567890';

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseChainId.mockReturnValue(mockChainId);
    mockGetContractAddress.mockReturnValue(mockContractAddress);
  });

  it('should return contract address for given contract name', () => {
    const { result } = renderHook(() => useContract('UniversalLendingProtocol'));

    expect(result.current).toBe(mockContractAddress);
    expect(mockGetContractAddress).toHaveBeenCalledWith('UniversalLendingProtocol', mockChainId);
  });

  it('should use target chain ID when provided', () => {
    const targetChainId = 421614;
    const { result } = renderHook(() => useContract('UniversalLendingProtocol', targetChainId));

    expect(result.current).toBe(mockContractAddress);
    expect(mockGetContractAddress).toHaveBeenCalledWith('UniversalLendingProtocol', targetChainId);
  });

  it('should return null when no chain ID is available', () => {
    mockUseChainId.mockReturnValue(undefined);
    const { result } = renderHook(() => useContract('UniversalLendingProtocol'));

    expect(result.current).toBeNull();
  });

  it('should memoize based on contract name and chain ID', () => {
    const { result, rerender } = renderHook(
      ({ contractName }) => useContract(contractName),
      { initialProps: { contractName: 'UniversalLendingProtocol' } }
    );

    const firstResult = result.current;
    rerender({ contractName: 'UniversalLendingProtocol' });
    const secondResult = result.current;

    expect(firstResult).toBe(secondResult);
    expect(mockGetContractAddress).toHaveBeenCalledTimes(1);
  });
});

describe('useToken', () => {
  const mockChainId = 7001;
  const mockTokenAddress = '0xaaa1111111111111111111111111111111111111';

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseChainId.mockReturnValue(mockChainId);
    mockGetTokenAddress.mockReturnValue(mockTokenAddress);
  });

  it('should return token address for given token symbol', () => {
    const { result } = renderHook(() => useToken('ETH.ARBI'));

    expect(result.current).toBe(mockTokenAddress);
    expect(mockGetTokenAddress).toHaveBeenCalledWith('ETH.ARBI', mockChainId);
  });

  it('should use target chain ID when provided', () => {
    const targetChainId = 421614;
    const { result } = renderHook(() => useToken('ETH.ARBI', targetChainId));

    expect(result.current).toBe(mockTokenAddress);
    expect(mockGetTokenAddress).toHaveBeenCalledWith('ETH.ARBI', targetChainId);
  });

  it('should return null when no chain ID is available', () => {
    mockUseChainId.mockReturnValue(undefined);
    const { result } = renderHook(() => useToken('ETH.ARBI'));

    expect(result.current).toBeNull();
  });

  it('should memoize based on token symbol and chain ID', () => {
    const { result, rerender } = renderHook(
      ({ tokenSymbol }) => useToken(tokenSymbol),
      { initialProps: { tokenSymbol: 'ETH.ARBI' } }
    );

    const firstResult = result.current;
    rerender({ tokenSymbol: 'ETH.ARBI' });
    const secondResult = result.current;

    expect(firstResult).toBe(secondResult);
    expect(mockGetTokenAddress).toHaveBeenCalledTimes(1);
  });
});

describe('useDeploymentStatus', () => {
  const mockChainId = 7001;

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseChainId.mockReturnValue(mockChainId);
    mockGetNetworkConfig.mockReturnValue({ name: 'ZetaChain', chainId: mockChainId });
  });

  it('should return deployment status for all contracts', () => {
    mockIsContractDeployed.mockImplementation((contractName) => {
      const deployedContracts = {
        'SimpleLendingProtocol': true,
        'UniversalLendingProtocol': true,
        'DepositContract': false,
        'MockPriceOracle': true,
      };
      return deployedContracts[contractName as keyof typeof deployedContracts] || false;
    });

    const { result } = renderHook(() => useDeploymentStatus());

    expect(result.current.hasSimpleLendingProtocol).toBe(true);
    expect(result.current.hasUniversalLendingProtocol).toBe(true);
    expect(result.current.hasDepositContract).toBe(false);
    expect(result.current.hasPriceOracle).toBe(true);
    expect(result.current.isSupported).toBe(true);
  });

  it('should return false for all deployments when no chain ID', () => {
    mockUseChainId.mockReturnValue(undefined);

    const { result } = renderHook(() => useDeploymentStatus());

    expect(result.current.hasSimpleLendingProtocol).toBe(false);
    expect(result.current.hasUniversalLendingProtocol).toBe(false);
    expect(result.current.hasDepositContract).toBe(false);
    expect(result.current.hasPriceOracle).toBe(false);
    expect(result.current.isSupported).toBe(false);
  });

  it('should return false for isSupported when network config is null', () => {
    mockGetNetworkConfig.mockReturnValue(null);

    const { result } = renderHook(() => useDeploymentStatus());

    expect(result.current.isSupported).toBe(false);
  });

  it('should use target chain ID when provided', () => {
    const targetChainId = 421614;
    const { result } = renderHook(() => useDeploymentStatus(targetChainId));

    expect(mockIsContractDeployed).toHaveBeenCalledWith('SimpleLendingProtocol', targetChainId);
    expect(mockIsContractDeployed).toHaveBeenCalledWith('UniversalLendingProtocol', targetChainId);
    expect(mockIsContractDeployed).toHaveBeenCalledWith('DepositContract', targetChainId);
    expect(mockIsContractDeployed).toHaveBeenCalledWith('MockPriceOracle', targetChainId);
    expect(mockGetNetworkConfig).toHaveBeenCalledWith(targetChainId);
  });

  it('should memoize deployment status based on chain ID', () => {
    mockIsContractDeployed.mockReturnValue(true);

    const { result, rerender } = renderHook(() => useDeploymentStatus());

    const firstStatus = result.current;
    rerender();
    const secondStatus = result.current;

    expect(firstStatus).toBe(secondStatus);
  });
});