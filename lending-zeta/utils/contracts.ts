import * as fs from 'fs';
import * as path from 'path';

// Type definitions
export type Address = `0x${string}`;
export type ChainId = number;

export interface NetworkConfig {
  name: string;
  chainId: ChainId;
  type: 'local' | 'testnet' | 'mainnet';
  rpc?: string;
  explorer?: string;
  contracts: Record<string, Address>;
  tokens: Record<string, Address>;
  lendingProtocolAddress?: Address;
}

export interface ContractsConfig {
  networks: Record<string, NetworkConfig>;
  deployments: {
    lastUpdated: string;
    deployer: Address;
  };
}

// Constants
const CONTRACTS_FILE_PATH = path.join(__dirname, '..', 'contracts.json');
const ZERO_ADDRESS: Address = "0x0000000000000000000000000000000000000000";

// Load contracts configuration
export function loadContracts(): ContractsConfig {
  try {
    const data = fs.readFileSync(CONTRACTS_FILE_PATH, 'utf8');
    return JSON.parse(data) as ContractsConfig;
  } catch (error) {
    throw new Error(`Failed to load contracts.json: ${error}`);
  }
}

// Save contracts configuration
export function saveContracts(config: ContractsConfig): void {
  try {
    config.deployments.lastUpdated = new Date().toISOString();
    fs.writeFileSync(CONTRACTS_FILE_PATH, JSON.stringify(config, null, 2));
    console.log('✅ Updated contracts.json');
  } catch (error) {
    throw new Error(`Failed to save contracts.json: ${error}`);
  }
}

// Get network configuration
export function getNetwork(chainIdOrName: ChainId | string): NetworkConfig {
  const config = loadContracts();
  const key = typeof chainIdOrName === 'number' ? chainIdOrName.toString() : chainIdOrName;

  // Try to find by chainId first, then by name
  let network = config.networks[key];
  if (!network) {
    network = Object.values(config.networks).find(n => n.name.toLowerCase() === key.toLowerCase()) as NetworkConfig;
  }

  if (!network) {
    throw new Error(`Network not found: ${chainIdOrName}`);
  }

  return network;
}

// Get contract address
export function getContractAddress(chainIdOrName: ChainId | string, contractName: string): Address {
  const network = getNetwork(chainIdOrName);
  const address = network.contracts[contractName];

  if (!address || address === ZERO_ADDRESS) {
    throw new Error(`Contract ${contractName} not deployed on ${network.name}`);
  }

  return address;
}

// Get token address
export function getTokenAddress(chainIdOrName: ChainId | string, tokenSymbol: string): Address {
  const network = getNetwork(chainIdOrName);
  const address = network.tokens[tokenSymbol];

  if (!address || address === ZERO_ADDRESS) {
    throw new Error(`Token ${tokenSymbol} not found on ${network.name}`);
  }

  return address;
}

// Update contract address
export function updateContractAddress(
  chainIdOrName: ChainId | string,
  contractName: string,
  address: Address,
  deployer?: Address
): void {
  const config = loadContracts();
  const key = typeof chainIdOrName === 'number' ? chainIdOrName.toString() : chainIdOrName;

  if (!config.networks[key]) {
    throw new Error(`Network not found: ${chainIdOrName}`);
  }

  config.networks[key].contracts[contractName] = address;

  if (deployer) {
    config.deployments.deployer = deployer;
  }

  saveContracts(config);
  console.log(`✅ Updated ${contractName} address on ${config.networks[key].name}: ${address}`);
}

// Update token address
export function updateTokenAddress(
  chainIdOrName: ChainId | string,
  tokenSymbol: string,
  address: Address
): void {
  const config = loadContracts();
  const key = typeof chainIdOrName === 'number' ? chainIdOrName.toString() : chainIdOrName;

  if (!config.networks[key]) {
    throw new Error(`Network not found: ${chainIdOrName}`);
  }

  config.networks[key].tokens[tokenSymbol] = address;
  saveContracts(config);
  console.log(`✅ Updated ${tokenSymbol} address on ${config.networks[key].name}: ${address}`);
}

// Update lending protocol address for external chains
export function updateLendingProtocolAddress(
  chainIdOrName: ChainId | string,
  address: Address
): void {
  const config = loadContracts();
  const key = typeof chainIdOrName === 'number' ? chainIdOrName.toString() : chainIdOrName;

  if (!config.networks[key]) {
    throw new Error(`Network not found: ${chainIdOrName}`);
  }

  config.networks[key].lendingProtocolAddress = address;
  saveContracts(config);
  console.log(`✅ Updated lending protocol address on ${config.networks[key].name}: ${address}`);
}

// Check if contract is deployed
export function isContractDeployed(chainIdOrName: ChainId | string, contractName: string): boolean {
  try {
    const address = getContractAddress(chainIdOrName, contractName);
    return address !== ZERO_ADDRESS;
  } catch {
    return false;
  }
}

// Check if token is available
export function isTokenAvailable(chainIdOrName: ChainId | string, tokenSymbol: string): boolean {
  try {
    const address = getTokenAddress(chainIdOrName, tokenSymbol);
    return address !== ZERO_ADDRESS;
  } catch {
    return false;
  }
}

// Get all deployed contracts for a network
export function getDeployedContracts(chainIdOrName: ChainId | string): Record<string, Address> {
  const network = getNetwork(chainIdOrName);
  const deployed: Record<string, Address> = {};

  for (const [name, address] of Object.entries(network.contracts)) {
    if (address && address !== ZERO_ADDRESS) {
      deployed[name] = address;
    }
  }

  return deployed;
}

// Get all available tokens for a network
export function getAvailableTokens(chainIdOrName: ChainId | string): Record<string, Address> {
  const network = getNetwork(chainIdOrName);
  const available: Record<string, Address> = {};

  for (const [symbol, address] of Object.entries(network.tokens)) {
    if (address && address !== ZERO_ADDRESS) {
      available[symbol] = address;
    }
  }

  return available;
}

// Validate network deployment
export function validateNetworkDeployment(chainIdOrName: ChainId | string): {
  isValid: boolean;
  missingContracts: string[];
  missingTokens: string[];
} {
  const network = getNetwork(chainIdOrName);
  const missingContracts: string[] = [];
  const missingTokens: string[] = [];

  // Check contracts
  for (const [name, address] of Object.entries(network.contracts)) {
    if (!address || address === ZERO_ADDRESS) {
      missingContracts.push(name);
    }
  }

  // Check tokens (only non-native tokens need to be deployed)
  for (const [symbol, address] of Object.entries(network.tokens)) {
    if (!address || address === ZERO_ADDRESS) {
      missingTokens.push(symbol);
    }
  }

  return {
    isValid: missingContracts.length === 0 && missingTokens.length === 0,
    missingContracts,
    missingTokens
  };
}

// Get network by type
export function getNetworksByType(type: 'local' | 'testnet' | 'mainnet'): NetworkConfig[] {
  const config = loadContracts();
  return Object.values(config.networks).filter(network => network.type === type);
}

// Get all testnet networks
export function getTestnetNetworks(): NetworkConfig[] {
  return getNetworksByType('testnet');
}

// Get all mainnet networks
export function getMainnetNetworks(): NetworkConfig[] {
  return getNetworksByType('mainnet');
}

// Print deployment summary
export function printDeploymentSummary(chainIdOrName: ChainId | string): void {
  const network = getNetwork(chainIdOrName);
  const deployedContracts = getDeployedContracts(chainIdOrName);
  const availableTokens = getAvailableTokens(chainIdOrName);

  console.log(`\n📋 Deployment Summary: ${network.name}`);
  console.log('='.repeat(50));

  console.log('\n📦 Deployed Contracts:');
  for (const [name, address] of Object.entries(deployedContracts)) {
    console.log(`  ${name}: ${address}`);
  }

  console.log('\n🪙 Available Tokens:');
  for (const [symbol, address] of Object.entries(availableTokens)) {
    console.log(`  ${symbol}: ${address}`);
  }

  if (network.lendingProtocolAddress && network.lendingProtocolAddress !== ZERO_ADDRESS) {
    console.log(`\n🏦 Lending Protocol: ${network.lendingProtocolAddress}`);
  }

  const validation = validateNetworkDeployment(chainIdOrName);
  if (!validation.isValid) {
    console.log('\n⚠️  Missing Deployments:');
    if (validation.missingContracts.length > 0) {
      console.log(`  Contracts: ${validation.missingContracts.join(', ')}`);
    }
    if (validation.missingTokens.length > 0) {
      console.log(`  Tokens: ${validation.missingTokens.join(', ')}`);
    }
  } else {
    console.log('\n✅ All deployments complete!');
  }
}

// Export utility functions for backward compatibility
export {
  ZERO_ADDRESS,
  CONTRACTS_FILE_PATH
};