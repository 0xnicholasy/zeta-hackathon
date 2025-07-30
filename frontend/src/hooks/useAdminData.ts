import { useChainId } from 'wagmi';
import { SupportedChain } from './useContracts';
import { contractsData } from '../config/contracts-data';

// Helper functions to get available assets based on network
export const getZetaChainAssets = () => {
  const zetaNetwork = contractsData.networks[7001];
  if (!zetaNetwork?.tokens) return [];

  return Object.entries(zetaNetwork.tokens)
    .filter(([, address]) => address !== "0x0000000000000000000000000000000000000000")
    .map(([symbol, address]) => ({
      symbol,
      address,
      label: `${symbol} (${address})`
    }));
};

export const getExternalChainAssets = (chainId: number) => {
  const network = contractsData.networks[chainId as keyof typeof contractsData.networks];
  if (!network?.tokens) return [];

  return Object.entries(network.tokens).map(([symbol, address]) => ({
    symbol,
    address,
    label: `${symbol} (${address === "0x0000000000000000000000000000000000000000" ? "Native ETH" : address})`
  }));
};

// Get current chain info for display
export const getCurrentChainInfo = (chainId: number) => {
  switch (chainId) {
    case SupportedChain.ARBITRUM_SEPOLIA:
      return { name: 'Arbitrum Sepolia', icon: 'arbitrum-one' };
    case SupportedChain.ETHEREUM_SEPOLIA:
      return { name: 'Ethereum Sepolia', icon: 'ethereum' };
    case SupportedChain.ZETA_TESTNET:
      return { name: 'ZetaChain Testnet', icon: 'zeta-chain' };
    case SupportedChain.POLYGON_AMOY:
      return { name: 'Polygon Amoy', icon: 'polygon' };
    case SupportedChain.BASE_SEPOLIA:
      return { name: 'Base Sepolia', icon: 'base' };
    case SupportedChain.BSC_TESTNET:
      return { name: 'BSC Testnet', icon: 'bsc' };
    default:
      return { name: 'Unknown Network', icon: 'ethereum' };
  }
};

export const useAdminData = () => {
  const chainId = useChainId();
  
  // Get current chain info
  const currentChain = getCurrentChainInfo(chainId);
  
  // Check network types
  const isOnZetaNetwork = chainId === SupportedChain.ZETA_TESTNET;
  const isOnExternalNetwork = chainId === SupportedChain.ARBITRUM_SEPOLIA || 
    chainId === SupportedChain.ETHEREUM_SEPOLIA || 
    chainId === SupportedChain.POLYGON_AMOY || 
    chainId === SupportedChain.BASE_SEPOLIA || 
    chainId === SupportedChain.BSC_TESTNET;
  
  // Get assets for current chain
  const zetaChainAssets = getZetaChainAssets();
  const externalChainAssets = getExternalChainAssets(chainId);
  
  // Get MockPriceOracle address
  const mockPriceOracleAddress = contractsData.networks[7001]?.contracts?.MockPriceOracle;
  
  return {
    chainId,
    currentChain,
    isOnZetaNetwork,
    isOnExternalNetwork,
    zetaChainAssets,
    externalChainAssets,
    mockPriceOracleAddress,
    // Re-export utility functions
    getZetaChainAssets,
    getExternalChainAssets,
    getCurrentChainInfo,
  };
};