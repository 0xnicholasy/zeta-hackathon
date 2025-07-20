import { useMemo } from 'react';
import { useChainId } from 'wagmi';
import { 
  getContractAddress,
  getTokenAddress,
  getAllContracts,
  getAllTokens,
  isContractDeployed,
  isTokenAvailable,
  getNetworkConfig,
  CONTRACT_NAMES,
  TOKEN_SYMBOLS,
  type NetworkConfig
} from '../contracts/deployments';

/**
 * Hook to get contract and token addresses for the current chain
 */
export function useContracts() {
  const chainId = useChainId();

  const contracts = useMemo(() => {
    if (!chainId) return null;
    return getAllContracts(chainId);
  }, [chainId]);

  const tokens = useMemo(() => {
    if (!chainId) return null;
    return getAllTokens(chainId);
  }, [chainId]);

  const networkConfig = useMemo(() => {
    if (!chainId) return null;
    return getNetworkConfig(chainId);
  }, [chainId]);

  const getContract = (contractName: string) => {
    if (!chainId) return null;
    return getContractAddress(contractName, chainId);
  };

  const getToken = (tokenSymbol: string) => {
    if (!chainId) return null;
    return getTokenAddress(tokenSymbol, chainId);
  };

  const isDeployed = (contractName: string) => {
    if (!chainId) return false;
    return isContractDeployed(contractName, chainId);
  };

  const isAvailable = (tokenSymbol: string) => {
    if (!chainId) return false;
    return isTokenAvailable(tokenSymbol, chainId);
  };

  return {
    chainId,
    networkConfig,
    contracts,
    tokens,
    getContract,
    getToken,
    isDeployed,
    isAvailable,
    // Specific contract getters
    simpleLendingProtocol: getContract(CONTRACT_NAMES.SIMPLE_LENDING_PROTOCOL),
    universalLendingProtocol: getContract(CONTRACT_NAMES.UNIVERSAL_LENDING_PROTOCOL),
    depositContract: getContract(CONTRACT_NAMES.DEPOSIT_CONTRACT),
    priceOracle: getContract(CONTRACT_NAMES.PRICE_ORACLE),
    // Specific token getters
    ethArbi: getToken(TOKEN_SYMBOLS.ETH_ARBI),
    usdcArbi: getToken(TOKEN_SYMBOLS.USDC_ARBI),
    ethEth: getToken(TOKEN_SYMBOLS.ETH_ETH),
    usdcEth: getToken(TOKEN_SYMBOLS.USDC_ETH),
    zeta: getToken(TOKEN_SYMBOLS.ZETA),
    eth: getToken(TOKEN_SYMBOLS.ETH),
    usdc: getToken(TOKEN_SYMBOLS.USDC),
  };
}

/**
 * Hook to get contract address for a specific contract
 */
export function useContract(contractName: string) {
  const chainId = useChainId();
  
  return useMemo(() => {
    if (!chainId) return null;
    return getContractAddress(contractName, chainId);
  }, [contractName, chainId]);
}

/**
 * Hook to get token address for a specific token
 */
export function useToken(tokenSymbol: string) {
  const chainId = useChainId();
  
  return useMemo(() => {
    if (!chainId) return null;
    return getTokenAddress(tokenSymbol, chainId);
  }, [tokenSymbol, chainId]);
}

/**
 * Hook to check if contracts are deployed on current chain
 */
export function useDeploymentStatus() {
  const chainId = useChainId();
  
  const status = useMemo(() => {
    if (!chainId) {
      return {
        hasSimpleLendingProtocol: false,
        hasUniversalLendingProtocol: false,
        hasDepositContract: false,
        hasPriceOracle: false,
        isSupported: false,
      };
    }

    return {
      hasSimpleLendingProtocol: isContractDeployed(CONTRACT_NAMES.SIMPLE_LENDING_PROTOCOL, chainId),
      hasUniversalLendingProtocol: isContractDeployed(CONTRACT_NAMES.UNIVERSAL_LENDING_PROTOCOL, chainId),
      hasDepositContract: isContractDeployed(CONTRACT_NAMES.DEPOSIT_CONTRACT, chainId),
      hasPriceOracle: isContractDeployed(CONTRACT_NAMES.PRICE_ORACLE, chainId),
      isSupported: getNetworkConfig(chainId) !== null,
    };
  }, [chainId]);

  return status;
}