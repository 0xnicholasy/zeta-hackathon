import { isTestnetMode } from '../config/wagmi';

// Contract deployment data - converted from contracts.json to avoid Vite JSON parsing issues
const contractsData = {
  "networks": {
    "7001": {
      "name": "zeta-testnet",
      "chainId": 7001,
      "type": "testnet" as const,
      "rpc": "https://zetachain-athens-evm.blockpi.network/v1/rpc/public",
      "explorer": "https://athens.explorer.zetachain.com",
      "contracts": {
        "SimpleLendingProtocol": "0x36cF9ca6756dC1882Ff4f1922C679bB631D5607E",
        "UniversalLendingProtocol": "0x0000000000000000000000000000000000000000",
        "PriceOracle": "0x0000000000000000000000000000000000000000",
        "MockPriceOracle": "0x0000000000000000000000000000000000000000",
        "Universal": "0x0000000000000000000000000000000000000000"
      },
      "tokens": {
        "ETH.ARBI": "0x1de70f3e971B62A0707dA18100392af14f7fB677",
        "USDC.ARBI": "0x4bC32034caCcc9B7e02536945eDbC286bACbA073",
        "ETH.ETH": "0x05BA149A7bd6dC1F937fA9046A9e05C05f3b18b0",
        "USDC.ETH": "0xcC683A782f4B30c138787CB5576a86AF66fdc31d",
        "ZETA": "0x0000000000000000000000000000000000000000"
      }
    },
    "421614": {
      "name": "arbitrum-sepolia",
      "chainId": 421614,
      "type": "testnet" as const,
      "contracts": {
        "DepositContract": "0xc74800e8d51c5C96b7A5B0Db6246f3D1183F9a52",
        "Gateway": "0x0dA86Dc3F9B71F84a0E97B0e2291e50B7a5df10f"
      },
      "tokens": {
        "ETH": "0x0000000000000000000000000000000000000000",
        "USDC": "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d"
      }
    },
    "11155111": {
      "name": "ethereum-sepolia",
      "chainId": 11155111,
      "type": "testnet" as const,
      "contracts": {
        "DepositContract": "0xa8631751c308552CEaD2246723081c46799E6875",
        "Gateway": "0x0c487a766110c85d301d96e33579c5b317fa4995"
      },
      "tokens": {
        "ETH": "0x0000000000000000000000000000000000000000",
        "USDC": "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"
      }
    }
  },
  "deployments": {
    "lastUpdated": "2025-07-21T03:11:14.593Z",
    "deployer": "0xe1C5Bf97A7Ffb50988DeF972E1E242072298a59C"
  }
};

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
  if (!address || address === '0x0') {
    return null;
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

  // Filter out invalid addresses but allow zero address for native ETH
  const validTokens: Record<string, string> = {};
  for (const [symbol, address] of Object.entries(network.tokens)) {
    if (address && address !== '0x0') {
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