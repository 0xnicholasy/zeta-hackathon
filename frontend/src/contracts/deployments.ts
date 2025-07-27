import { contractsData } from '@/config/contracts-data';
import { isTestnetMode } from '../config/wagmi';
import { isEVMAddress, isZeroAddress, ZERO_ADDRESS, type EVMAddress } from '../components/dashboard/types';

// Type definitions
export interface NetworkConfig {
  name: string;
  chainId: number;
  type: 'testnet' | 'mainnet';
  rpc?: string;
  explorer?: string;
  contracts: Record<string, string>;
  tokens: Record<string, string>;
}

export interface DeploymentConfig {
  networks: Record<string, NetworkConfig>;
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
export function getNetworkConfig(chainId: number): NetworkConfig {
  const chainIdStr = chainId.toString();
  const network = deployments.networks[chainIdStr];

  if (!network) {
    throw new Error(`Network config not found for chain ID: ${chainId}`);
  }

  // Only return if it matches current environment
  if (isTestnetMode && network.type !== 'testnet') {
    throw new Error(`Testnet mode: Network config not found for chain ID: ${chainId}`);
  }
  if (!isTestnetMode && network.type !== 'mainnet') {
    throw new Error(`Mainnet mode: Network config not found for chain ID: ${chainId}`);
  }

  return network;
}

/**
 * Get contract address by name and chain ID
 */
export function getContractAddress(contractName: string, chainId: number): EVMAddress {
  const network = getNetworkConfig(chainId);
  if (!network) {
    return ZERO_ADDRESS;
  }

  const address = network.contracts[contractName];
  if (!address || isZeroAddress(address) || !isEVMAddress(address)) {
    return ZERO_ADDRESS;
  }

  return address;
}

/**
 * Get token address by symbol and chain ID
 */
export function getTokenAddress(tokenSymbol: string, chainId: number): EVMAddress {
  const network = getNetworkConfig(chainId);
  if (!network) {
    return ZERO_ADDRESS;
  }

  const address = network.tokens[tokenSymbol];
  if (!address || isZeroAddress(address) || !isEVMAddress(address)) {
    return ZERO_ADDRESS;
  }

  // Allow zero address for native ETH
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
    if (address && !isZeroAddress(address)) {
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

  // Filter out invalid addresses but allow zero address for native ETH
  const validTokens: Record<string, string> = {};
  for (const [symbol, address] of Object.entries(network.tokens)) {
    if (address && !isZeroAddress(address)) {
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

/**
 * Get explorer URL for a chain
 */
export function getExplorerUrl(chainId: number): string | null {
  const network = getNetworkConfig(chainId);
  return network?.explorer ?? null;
}

/**
 * Get transaction URL for a specific transaction hash on a chain
 */
export function getTransactionUrl(chainId: number, txHash: string): string | null {
  const explorerUrl = getExplorerUrl(chainId);
  if (!explorerUrl) return null;

  return `${explorerUrl}/tx/${txHash}`;
}

/**
 * Get address URL for a specific address on a chain
 */
export function getAddressUrl(chainId: number, address: string): string | null {
  const explorerUrl = getExplorerUrl(chainId);
  if (!explorerUrl) return null;

  return `${explorerUrl}/address/${address}`;
}

// Supported chain constants for type safety
export const SupportedChain = {
  ZETA_TESTNET: 7001,
  ARBITRUM_SEPOLIA: 421614,
  ETHEREUM_SEPOLIA: 11155111,
} as const;

export type SupportedChainId = typeof SupportedChain[keyof typeof SupportedChain];

// Helper to check if a chain ID is supported
export const isSupportedChain = (chainId: number): chainId is SupportedChainId => {
  return Object.values(SupportedChain).includes(chainId as SupportedChainId);
};

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
  getContractAddress(CONTRACT_NAMES.MOCK_PRICE_ORACLE, chainId);

// Helper functions for tokens
export const getEthArbiAddress = (chainId: number) =>
  getTokenAddress(TOKEN_SYMBOLS.ETH_ARBI, chainId);

export const getUsdcArbiAddress = (chainId: number) =>
  getTokenAddress(TOKEN_SYMBOLS.USDC_ARBI, chainId);

export const getEthEthAddress = (chainId: number) =>
  getTokenAddress(TOKEN_SYMBOLS.ETH_ETH, chainId);

export const getUsdcEthAddress = (chainId: number) =>
  getTokenAddress(TOKEN_SYMBOLS.USDC_ETH, chainId);

/**
 * Get token decimals by address across all supported chains
 */
export function getTokenDecimals(assetAddress: EVMAddress): number {
  // Check all supported chains for this asset
  for (const chainId of getSupportedChainIds()) {
    try {
      const network = getNetworkConfig(chainId);
      if (!network) continue;

      // Find the token symbol for this address
      for (const [symbol, address] of Object.entries(network.tokens)) {
        if (address?.toLowerCase() === assetAddress.toLowerCase()) {
          // USDC tokens use 6 decimals, everything else uses 18
          return symbol.includes('USDC') ? 6 : 18;
        }
      }
    } catch {
      // Ignore errors for unsupported chains
      continue;
    }
  }

  // Default to 18 decimals if token not found
  return 18;
}

/**
 * Get token symbol by address across all supported chains
 */
export function getTokenSymbol(assetAddress: EVMAddress): string {
  // Check all supported chains for this asset
  for (const chainId of getSupportedChainIds()) {
    try {
      const network = getNetworkConfig(chainId);
      if (!network) continue;

      // Find the token symbol for this address
      for (const [symbol, address] of Object.entries(network.tokens)) {
        if (address?.toLowerCase() === assetAddress.toLowerCase()) {
          return symbol;
        }
      }
    } catch {
      // Ignore errors for unsupported chains
      continue;
    }
  }

  // Return truncated address if token not found
  return assetAddress.slice(0, 8) + '...';
}
