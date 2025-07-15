// ZetaChain Cross-Chain Lending Protocol Deployments
// This file contains contract addresses for different networks

export type Address = `0x${string}`;

export interface TokenAddresses {
  // ZRC-20 Tokens on ZetaChain
  "ETH.ARBI": Address;    // Ethereum from Arbitrum
  "USDC.ARBI": Address;   // USDC from Arbitrum  
  "USDT.BASE": Address;   // USDT from Base
  "ZETA": Address;        // Native ZETA token
}

export interface CoreContracts {
  LendingProtocol: Address;
  PriceOracle: Address;
}

export interface NetworkDeployment {
  chainId: number;
  name: string;
  rpcUrl: string;
  explorer: string;
  contracts: CoreContracts;
  tokens: TokenAddresses;
  isTestnet: boolean;
}

export interface DeploymentConfig {
  [networkName: string]: NetworkDeployment;
}

// ZetaChain Network Deployments
export const DEPLOYMENTS: DeploymentConfig = {
  // Local Development Network
  localnet: {
    chainId: 1337,
    name: "Hardhat Local",
    rpcUrl: "http://127.0.0.1:8545",
    explorer: "http://localhost:8545",
    isTestnet: true,
    contracts: {
      LendingProtocol: "0xe7f1725e7734ce288f8367e1bb143e90bb3f0512", // Will be updated after deployment
      PriceOracle: "0x5fbdb2315678afecb367f032d93f642f64180aa3",     // Will be updated after deployment
    },
    tokens: {
      "ETH.ARBI": "0x9fe46736679d2d9a65f0992f2272de9f3c7fa6e0",   // Mock token for local testing
      "USDC.ARBI": "0xcf7ed3acca5a467e9e704c703e8d87f634fb0fc9",  // Mock token for local testing
      "USDT.BASE": "0xdc64a140aa3e981100a9beca4e685f962f0cf6c9",  // Mock token for local testing
      "ZETA": "0x5fc8d32690cc91d4c39d9d3abcbd16989f875707",       // Mock token for local testing
    }
  },

  // ZetaChain Athens Testnet
  "zeta-testnet": {
    chainId: 7001,
    name: "ZetaChain Athens Testnet",
    rpcUrl: "https://zetachain-athens-evm.blockpi.network/v1/rpc/public",
    explorer: "https://athens.explorer.zetachain.com",
    isTestnet: true,
    contracts: {
      LendingProtocol: "0x0000000000000000000000000000000000000000", // Deploy here for testnet
      PriceOracle: "0x0000000000000000000000000000000000000000",     // Deploy here for testnet
    },
    tokens: {
      // ZRC-20 token addresses on Athens testnet
      "ETH.ARBI": "0x0000000000000000000000000000000000000000",   // Replace with actual ZRC-20 ETH.ARBI address
      "USDC.ARBI": "0x0000000000000000000000000000000000000000",  // Replace with actual ZRC-20 USDC.ARBI address
      "USDT.BASE": "0x0000000000000000000000000000000000000000",  // Replace with actual ZRC-20 USDT.BASE address
      "ZETA": "0x0000000000000000000000000000000000000000",       // Replace with actual ZETA token address
    }
  },

  // ZetaChain Mainnet
  "zeta-mainnet": {
    chainId: 7000,
    name: "ZetaChain Mainnet",
    rpcUrl: "https://zetachain-evm.blockpi.network/v1/rpc/public",
    explorer: "https://explorer.zetachain.com",
    isTestnet: false,
    contracts: {
      LendingProtocol: "0x0000000000000000000000000000000000000000", // Deploy here for mainnet
      PriceOracle: "0x0000000000000000000000000000000000000000",     // Deploy here for mainnet
    },
    tokens: {
      // ZRC-20 token addresses on mainnet
      "ETH.ARBI": "0x0000000000000000000000000000000000000000",   // Replace with actual ZRC-20 ETH.ARBI address
      "USDC.ARBI": "0x0000000000000000000000000000000000000000",  // Replace with actual ZRC-20 USDC.ARBI address
      "USDT.BASE": "0x0000000000000000000000000000000000000000",  // Replace with actual ZRC-20 USDT.BASE address
      "ZETA": "0x0000000000000000000000000000000000000000",       // Replace with actual ZETA token address
    }
  }
};

// Helper functions for working with deployments
export function getDeployment(networkName: string): NetworkDeployment {
  const deployment = DEPLOYMENTS[networkName];
  if (!deployment) {
    throw new Error(`No deployment found for network: ${networkName}`);
  }
  return deployment;
}

export function getContractAddress(networkName: string, contractName: keyof CoreContracts): Address {
  const deployment = getDeployment(networkName);
  const address = deployment.contracts[contractName];
  
  if (address === "0x0000000000000000000000000000000000000000") {
    throw new Error(`Contract ${contractName} not deployed on network ${networkName}`);
  }
  
  return address;
}

export function getTokenAddress(networkName: string, tokenSymbol: keyof TokenAddresses): Address {
  const deployment = getDeployment(networkName);
  const address = deployment.tokens[tokenSymbol];
  
  if (address === "0x0000000000000000000000000000000000000000") {
    throw new Error(`Token ${tokenSymbol} not configured on network ${networkName}`);
  }
  
  return address;
}

export function getAllTokenAddresses(networkName: string): TokenAddresses {
  const deployment = getDeployment(networkName);
  return deployment.tokens;
}

export function getAllContractAddresses(networkName: string): CoreContracts {
  const deployment = getDeployment(networkName);
  return deployment.contracts;
}

export function isValidAddress(address: string): address is Address {
  return /^0x[a-fA-F0-9]{40}$/.test(address) && address !== "0x0000000000000000000000000000000000000000";
}

export function validateDeployment(networkName: string): {
  isValid: boolean;
  missingContracts: string[];
  missingTokens: string[];
} {
  const deployment = getDeployment(networkName);
  
  const missingContracts: string[] = [];
  const missingTokens: string[] = [];
  
  // Check contracts
  Object.entries(deployment.contracts).forEach(([name, address]) => {
    if (!isValidAddress(address)) {
      missingContracts.push(name);
    }
  });
  
  // Check tokens
  Object.entries(deployment.tokens).forEach(([symbol, address]) => {
    if (!isValidAddress(address)) {
      missingTokens.push(symbol);
    }
  });
  
  return {
    isValid: missingContracts.length === 0 && missingTokens.length === 0,
    missingContracts,
    missingTokens
  };
}

// Network configuration for Hardhat
export function getNetworkConfig(networkName: string) {
  const deployment = getDeployment(networkName);
  
  return {
    chainId: deployment.chainId,
    url: deployment.rpcUrl,
    accounts: [], // Add your private keys here for deployment
    gasPrice: "auto",
    gas: "auto",
  };
}

// Export current network (can be set via environment variable)
export const CURRENT_NETWORK = process.env.NETWORK || "localnet";
export const CURRENT_DEPLOYMENT = getDeployment(CURRENT_NETWORK);

// Asset configuration for the lending protocol
export interface AssetConfig {
  symbol: keyof TokenAddresses;
  collateralFactor: number;    // e.g., 0.8 for 80%
  liquidationThreshold: number; // e.g., 0.85 for 85%
  liquidationBonus: number;     // e.g., 0.05 for 5%
  priceInUSD: number;          // e.g., 2000 for $2000
}

export const ASSET_CONFIGS: Record<keyof TokenAddresses, AssetConfig> = {
  "ETH.ARBI": {
    symbol: "ETH.ARBI",
    collateralFactor: 0.8,        // 80%
    liquidationThreshold: 0.85,   // 85%
    liquidationBonus: 0.05,       // 5%
    priceInUSD: 2000             // $2000
  },
  "USDC.ARBI": {
    symbol: "USDC.ARBI",
    collateralFactor: 0.9,        // 90%
    liquidationThreshold: 0.9,    // 90%
    liquidationBonus: 0.05,       // 5%
    priceInUSD: 1                // $1
  },
  "USDT.BASE": {
    symbol: "USDT.BASE",
    collateralFactor: 0.9,        // 90%
    liquidationThreshold: 0.9,    // 90%
    liquidationBonus: 0.05,       // 5%
    priceInUSD: 1                // $1
  },
  "ZETA": {
    symbol: "ZETA",
    collateralFactor: 0.75,       // 75%
    liquidationThreshold: 0.8,    // 80%
    liquidationBonus: 0.1,        // 10%
    priceInUSD: 0.5              // $0.50
  }
};

export default DEPLOYMENTS;