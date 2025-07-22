#!/usr/bin/env python3
"""
Sync script for ZetaChain Cross-Chain Lending Protocol

This script syncs contract typechains and deployment configuration between:
- lending-zeta/ (smart contracts)  
- frontend/ (React app)

Usage: python sync-contracts.py
"""

import json
import shutil
import os
import sys
from pathlib import Path
from datetime import datetime

class ContractSyncer:
    def __init__(self):
        # Project root directory
        self.root_dir = Path(__file__).parent
        
        # Source directories (lending-zeta)
        self.lending_dir = self.root_dir / "lending-zeta"
        self.typechain_source = self.lending_dir / "typechain-types"
        self.contracts_json = self.lending_dir / "contracts.json"
        
        # Target directories (frontend)
        self.frontend_dir = self.root_dir / "frontend"
        self.typechain_target = self.frontend_dir / "src" / "contracts" / "typechain-types"
        self.deployments_ts = self.frontend_dir / "src" / "contracts" / "deployments.ts"
        
    def validate_directories(self):
        """Validate that required directories exist"""
        missing_dirs = []
        
        if not self.lending_dir.exists():
            missing_dirs.append(str(self.lending_dir))
        if not self.typechain_source.exists():
            missing_dirs.append(str(self.typechain_source))
        if not self.contracts_json.exists():
            missing_dirs.append(str(self.contracts_json))
        if not self.frontend_dir.exists():
            missing_dirs.append(str(self.frontend_dir))
            
        if missing_dirs:
            print("❌ Error: Missing required directories/files:")
            for dir_path in missing_dirs:
                print(f"   - {dir_path}")
            return False
            
        return True
        
    def sync_typechains(self):
        """Sync typechain-types from lending-zeta to frontend"""
        print("🔄 Syncing typechain types...")
        
        try:
            # Remove existing typechain directory if it exists
            if self.typechain_target.exists():
                shutil.rmtree(self.typechain_target)
                print(f"   ✅ Removed existing {self.typechain_target}")
            
            # Copy typechain-types directory
            shutil.copytree(self.typechain_source, self.typechain_target)
            print(f"   ✅ Copied typechain types to {self.typechain_target}")
            
            return True
            
        except Exception as e:
            print(f"   ❌ Error syncing typechains: {e}")
            return False
    
    def convert_contracts_json_to_deployments_ts(self):
        """Convert contracts.json to deployments.ts format"""
        print("🔄 Converting contracts.json to deployments.ts...")
        
        try:
            # Read contracts.json
            with open(self.contracts_json, 'r') as f:
                contracts_data = json.load(f)
            
            # Generate TypeScript content
            ts_content = self.generate_deployments_ts(contracts_data)
            
            # Write to deployments.ts
            with open(self.deployments_ts, 'w') as f:
                f.write(ts_content)
                
            print(f"   ✅ Updated {self.deployments_ts}")
            return True
            
        except Exception as e:
            print(f"   ❌ Error converting contracts.json: {e}")
            return False
    
    def generate_deployments_ts(self, contracts_data):
        """Generate TypeScript content for deployments.ts"""
        
        # Convert Python dict to TypeScript object format
        def dict_to_ts_object(obj, indent=0):
            if isinstance(obj, dict):
                lines = ["{"]
                for key, value in obj.items():
                    quoted_key = f'"{key}"' if not key.replace('_', '').replace('.', '').isalnum() else key
                    ts_value = dict_to_ts_object(value, indent + 2)
                    type_annotation = ""
                    
                    # Add type annotation for specific keys
                    if key == "type" and isinstance(value, str):
                        type_annotation = " as const"
                    
                    lines.append(f"{'  ' * (indent + 1)}{quoted_key}: {ts_value}{type_annotation},")
                lines.append(f"{'  ' * indent}}}")
                return '\n'.join(lines)
            elif isinstance(obj, str):
                return f'"{obj}"'
            elif isinstance(obj, (int, float)):
                return str(obj)
            else:
                return f'"{str(obj)}"'
        
        contracts_ts_obj = dict_to_ts_object(contracts_data)
        
        ts_content = f'''import {{ isTestnetMode }} from '../config/wagmi';

// Contract deployment data - converted from contracts.json to avoid Vite JSON parsing issues
const contractsData = {contracts_ts_obj};

// Type definitions matching the deployment utils
export interface NetworkConfig {{
  name: string;
  chainId: number;
  type: 'testnet' | 'mainnet';
  rpc?: string;
  explorer?: string;
  contracts: {{
    [contractName: string]: string;
  }};
  tokens: {{
    [tokenSymbol: string]: string;
  }};
}}

export interface DeploymentConfig {{
  networks: {{
    [chainId: string]: NetworkConfig;
  }};
  deployments: {{
    lastUpdated: string;
    deployer: string;
  }};
}}

// Cast the imported data to our type
const deployments: DeploymentConfig = contractsData as DeploymentConfig;

/**
 * Get available networks based on current environment
 */
export function getAvailableNetworks(): NetworkConfig[] {{
  return Object.values(deployments.networks).filter(network => {{
    return isTestnetMode ? network.type === 'testnet' : network.type === 'mainnet';
  }});
}}

/**
 * Get network configuration by chain ID
 */
export function getNetworkConfig(chainId: number): NetworkConfig | null {{
  const chainIdStr = chainId.toString();
  const network = deployments.networks[chainIdStr];

  if (!network) {{
    return null;
  }}

  // Only return if it matches current environment
  if (isTestnetMode && network.type !== 'testnet') {{
    return null;
  }}
  if (!isTestnetMode && network.type !== 'mainnet') {{
    return null;
  }}

  return network;
}}

/**
 * Get contract address by name and chain ID
 */
export function getContractAddress(contractName: string, chainId: number): string | null {{
  const network = getNetworkConfig(chainId);
  if (!network) {{
    return null;
  }}

  const address = network.contracts[contractName];
  if (!address || address === '0x0000000000000000000000000000000000000000') {{
    return null;
  }}

  return address;
}}

/**
 * Get token address by symbol and chain ID
 */
export function getTokenAddress(tokenSymbol: string, chainId: number): string | null {{
  const network = getNetworkConfig(chainId);
  if (!network) {{
    return null;
  }}

  const address = network.tokens[tokenSymbol];
  if (!address || address === '0x0') {{
    return null;
  }}

  // Allow zero address for native ETH
  return address;
}}

/**
 * Get all deployed contract addresses for a chain
 */
export function getAllContracts(chainId: number): Record<string, string> | null {{
  const network = getNetworkConfig(chainId);
  if (!network) {{
    return null;
  }}

  // Filter out zero addresses
  const validContracts: Record<string, string> = {{}};
  for (const [name, address] of Object.entries(network.contracts)) {{
    if (address && address !== '0x0000000000000000000000000000000000000000') {{
      validContracts[name] = address;
    }}
  }}

  return validContracts;
}}

/**
 * Get all token addresses for a chain
 */
export function getAllTokens(chainId: number): Record<string, string> | null {{
  const network = getNetworkConfig(chainId);
  if (!network) {{
    return null;
  }}

  // Filter out invalid addresses but allow zero address for native ETH
  const validTokens: Record<string, string> = {{}};
  for (const [symbol, address] of Object.entries(network.tokens)) {{
    if (address && address !== '0x0') {{
      validTokens[symbol] = address;
    }}
  }}

  return validTokens;
}}

/**
 * Check if a contract is deployed on a specific chain
 */
export function isContractDeployed(contractName: string, chainId: number): boolean {{
  const address = getContractAddress(contractName, chainId);
  return address !== null;
}}

/**
 * Check if a token is available on a specific chain
 */
export function isTokenAvailable(tokenSymbol: string, chainId: number): boolean {{
  const address = getTokenAddress(tokenSymbol, chainId);
  return address !== null;
}}

/**
 * Get deployment info
 */
export function getDeploymentInfo() {{
  return deployments.deployments;
}}

/**
 * Get supported chain IDs for current environment
 */
export function getSupportedChainIds(): number[] {{
  return getAvailableNetworks().map(network => network.chainId);
}}

// Supported chain constants for type safety
export const SupportedChain = {{
  ZETA_TESTNET: 7001,
  ARBITRUM_SEPOLIA: 421614,
  ETHEREUM_SEPOLIA: 11155111,
}} as const;

export type SupportedChainId = typeof SupportedChain[keyof typeof SupportedChain];

// Helper to check if a chain ID is supported
export const isSupportedChain = (chainId: number): chainId is SupportedChainId => {{
  return Object.values(SupportedChain).includes(chainId as SupportedChainId);
}};

// Predefined contract and token names for type safety
export const CONTRACT_NAMES = {{
  SIMPLE_LENDING_PROTOCOL: 'SimpleLendingProtocol',
  UNIVERSAL_LENDING_PROTOCOL: 'UniversalLendingProtocol',
  DEPOSIT_CONTRACT: 'DepositContract',
  PRICE_ORACLE: 'PriceOracle',
  MOCK_PRICE_ORACLE: 'MockPriceOracle',
  GATEWAY: 'Gateway',
}} as const;

export const TOKEN_SYMBOLS = {{
  ETH_ARBI: 'ETH.ARBI',
  USDC_ARBI: 'USDC.ARBI',
  ETH_ETH: 'ETH.ETH',
  USDC_ETH: 'USDC.ETH',
  ZETA: 'ZETA',
  ETH: 'ETH',
  USDC: 'USDC',
}} as const;

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
'''
        
        return ts_content
    
    def print_summary(self, contracts_data):
        """Print a summary of the sync operation"""
        print("\n📋 Sync Summary:")
        print("=" * 50)
        
        # Deployment info
        if "deployments" in contracts_data:
            deployment_info = contracts_data["deployments"]
            print(f"Last Updated: {deployment_info.get('lastUpdated', 'Unknown')}")
            print(f"Deployer: {deployment_info.get('deployer', 'Unknown')}")
        
        # Network summary
        if "networks" in contracts_data:
            for chain_id, network in contracts_data["networks"].items():
                print(f"\n🌐 {network.get('name', 'Unknown')} (Chain ID: {chain_id}):")
                
                # Deployed contracts
                contracts = network.get("contracts", {})
                deployed_contracts = [name for name, addr in contracts.items() 
                                    if addr and addr != "0x0000000000000000000000000000000000000000"]
                if deployed_contracts:
                    print(f"   📄 Deployed Contracts: {', '.join(deployed_contracts)}")
                
                # Available tokens
                tokens = network.get("tokens", {})
                available_tokens = [symbol for symbol, addr in tokens.items() 
                                  if addr and addr != "0x0"]
                if available_tokens:
                    print(f"   🪙 Available Tokens: {', '.join(available_tokens)}")
    
    def run(self):
        """Main sync process"""
        print("🚀 ZetaChain Cross-Chain Lending Protocol - Contract Sync")
        print("=" * 60)
        
        # Validate directories
        if not self.validate_directories():
            sys.exit(1)
        
        # Load contracts.json for summary
        try:
            with open(self.contracts_json, 'r') as f:
                contracts_data = json.load(f)
        except Exception as e:
            print(f"❌ Error reading contracts.json: {e}")
            sys.exit(1)
        
        # Perform sync operations
        success = True
        
        # 1. Sync typechains
        if not self.sync_typechains():
            success = False
            
        # 2. Convert contracts.json to deployments.ts
        if not self.convert_contracts_json_to_deployments_ts():
            success = False
        
        if success:
            print("\n✅ All sync operations completed successfully!")
            self.print_summary(contracts_data)
        else:
            print("\n❌ Some sync operations failed. Please check the errors above.")
            sys.exit(1)

if __name__ == "__main__":
    syncer = ContractSyncer()
    syncer.run()