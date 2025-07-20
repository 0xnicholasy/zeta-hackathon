import contractsData from '../../../lending-zeta/contracts.json';
import { isTestnetMode } from '../config/wagmi';

// Type definitions matching the deployment utils
export interface NetworkConfig {
  name: string;
  chainId: number;
  type: 'testnet' | 'mainnet';
  rpc?: string;
  explorer?: string;
  contracts: {
    [contractName: string]: string;
  };
  tokens: {
    [tokenSymbol: string]: string;
  };
}

export interface DeploymentConfig {
  networks: {
    [chainId: string]: NetworkConfig;
  };
  deployments: {
    lastUpdated: string;
    deployer: string;
  };
}

// Cast the imported data to our type
const deployments: DeploymentConfig = contractsData as DeploymentConfig;

/**
 * Get available networks based on current environment
 */
export function getAvailableNetworks(): NetworkConfig[] {
  return Object.values(deployments.networks).filter(network => {
    return isTestnetMode ? network.type === 'testnet' : network.type === 'mainnet';
  });
}

/**
 * Get network configuration by chain ID
 */
export function getNetworkConfig(chainId: number): NetworkConfig | null {
  const chainIdStr = chainId.toString();
  const network = deployments.networks[chainIdStr];
  
  if (!network) {
    return null;
  }
  
  // Only return if it matches current environment
  if (isTestnetMode && network.type !== 'testnet') {
    return null;
  }
  if (!isTestnetMode && network.type !== 'mainnet') {
    return null;
  }
  
  return network;
}

/**
 * Get contract address by name and chain ID
 */
export function getContractAddress(contractName: string, chainId: number): string | null {
  const network = getNetworkConfig(chainId);
  if (!network) {
    return null;
  }
  
  const address = network.contracts[contractName];
  if (!address || address === '0x0000000000000000000000000000000000000000') {
    return null;
  }
  
  return address;
}

/**
 * Get token address by symbol and chain ID
 */
export function getTokenAddress(tokenSymbol: string, chainId: number): string | null {
  const network = getNetworkConfig(chainId);
  if (!network) {
    return null;
  }
  
  const address = network.tokens[tokenSymbol];
  if (!address || address === '0x0000000000000000000000000000000000000000' || address === '0x0') {
    return null;
  }
  
  return address;
}

/**
 * Get all deployed contract addresses for a chain
 */
export function getAllContracts(chainId: number): Record<string, string> | null {
  const network = getNetworkConfig(chainId);
  if (!network) {
    return null;
  }
  
  // Filter out zero addresses
  const validContracts: Record<string, string> = {};
  for (const [name, address] of Object.entries(network.contracts)) {
    if (address && address !== '0x0000000000000000000000000000000000000000') {
      validContracts[name] = address;
    }
  }
  
  return validContracts;
}

/**
 * Get all token addresses for a chain
 */
export function getAllTokens(chainId: number): Record<string, string> | null {
  const network = getNetworkConfig(chainId);
  if (!network) {
    return null;
  }
  
  // Filter out zero addresses
  const validTokens: Record<string, string> = {};
  for (const [symbol, address] of Object.entries(network.tokens)) {
    if (address && address !== '0x0000000000000000000000000000000000000000' && address !== '0x0') {
      validTokens[symbol] = address;
    }
  }
  
  return validTokens;
}

/**
 * Check if a contract is deployed on a specific chain
 */
export function isContractDeployed(contractName: string, chainId: number): boolean {
  const address = getContractAddress(contractName, chainId);
  return address !== null;
}

/**
 * Check if a token is available on a specific chain
 */
export function isTokenAvailable(tokenSymbol: string, chainId: number): boolean {
  const address = getTokenAddress(tokenSymbol, chainId);
  return address !== null;
}

/**
 * Get deployment info
 */
export function getDeploymentInfo() {
  return deployments.deployments;
}

/**
 * Get supported chain IDs for current environment
 */
export function getSupportedChainIds(): number[] {
  return getAvailableNetworks().map(network => network.chainId);
}

// Predefined contract and token names for type safety
export const CONTRACT_NAMES = {
  SIMPLE_LENDING_PROTOCOL: 'SimpleLendingProtocol',
  UNIVERSAL_LENDING_PROTOCOL: 'UniversalLendingProtocol',
  DEPOSIT_CONTRACT: 'DepositContract',
  PRICE_ORACLE: 'PriceOracle',
  MOCK_PRICE_ORACLE: 'MockPriceOracle',
  GATEWAY: 'Gateway',
} as const;

export const TOKEN_SYMBOLS = {
  ETH_ARBI: 'ETH.ARBI',
  USDC_ARBI: 'USDC.ARBI',
  ETH_ETH: 'ETH.ETH',
  USDC_ETH: 'USDC.ETH',
  ZETA: 'ZETA',
  ETH: 'ETH',
  USDC: 'USDC',
} as const;

// Helper functions with predefined contract names
export const getSimpleLendingProtocolAddress = (chainId: number) => 
  getContractAddress(CONTRACT_NAMES.SIMPLE_LENDING_PROTOCOL, chainId);

export const getUniversalLendingProtocolAddress = (chainId: number) => 
  getContractAddress(CONTRACT_NAMES.UNIVERSAL_LENDING_PROTOCOL, chainId);

export const getDepositContractAddress = (chainId: number) => 
  getContractAddress(CONTRACT_NAMES.DEPOSIT_CONTRACT, chainId);

export const getPriceOracleAddress = (chainId: number) => 
  getContractAddress(CONTRACT_NAMES.PRICE_ORACLE, chainId);

// Helper functions for tokens
export const getEthArbiAddress = (chainId: number) => 
  getTokenAddress(TOKEN_SYMBOLS.ETH_ARBI, chainId);

export const getUsdcArbiAddress = (chainId: number) => 
  getTokenAddress(TOKEN_SYMBOLS.USDC_ARBI, chainId);

export const getEthEthAddress = (chainId: number) => 
  getTokenAddress(TOKEN_SYMBOLS.ETH_ETH, chainId);

export const getUsdcEthAddress = (chainId: number) => 
  getTokenAddress(TOKEN_SYMBOLS.USDC_ETH, chainId);