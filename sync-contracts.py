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
import sys
import re
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, Union

class ContractSyncer:
    def __init__(self) -> None:
        # Project root directory
        self.root_dir = Path(__file__).parent
        
        # Source directories (lending-zeta)
        self.lending_dir = self.root_dir / "lending-zeta"
        self.typechain_source = self.lending_dir / "typechain-types"
        self.contracts_json = self.lending_dir / "contracts.json"
        
        # Target directories (frontend)
        self.frontend_dir = self.root_dir / "frontend"
        self.typechain_target = self.frontend_dir / "src" / "contracts" / "typechain-types"
        self.contracts_data_ts = self.frontend_dir / "src" / "config" / "contracts-data.ts"
        
    def validate_directories(self) -> bool:
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
        
    def sync_typechains(self) -> bool:
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
    
    def process_contracts_data(self, contracts_data: Dict[str, Any]) -> Dict[str, Any]:
        """Process contracts data to flatten token structure for frontend compatibility"""
        processed_data = contracts_data.copy()
        
        # Process each network to flatten token structure
        if "networks" in processed_data:
            for chain_id, network in processed_data["networks"].items():
                if "tokens" in network:
                    flattened_tokens = {}
                    for symbol, token_data in network["tokens"].items():
                        # If token_data is a dict with address, flatten to just the address
                        if isinstance(token_data, dict) and "address" in token_data:
                            flattened_tokens[symbol] = token_data["address"]
                        else:
                            # Keep as-is if already a string
                            flattened_tokens[symbol] = token_data
                    
                    # Update the network with flattened tokens
                    processed_data["networks"][chain_id]["tokens"] = flattened_tokens
        
        return processed_data
    
    def convert_contracts_json_to_data_ts(self) -> bool:
        """Convert contracts.json to contracts-data.ts format"""
        print("🔄 Converting contracts.json to contracts-data.ts...")
        
        try:
            # Read contracts.json
            with open(self.contracts_json, 'r') as f:
                contracts_data = json.load(f)
            
            # Process contracts data to flatten token structure for frontend compatibility
            processed_data = self.process_contracts_data(contracts_data)
            
            # Generate TypeScript content for data only
            ts_content = self.generate_contracts_data_ts(processed_data)
            
            # Ensure config directory exists
            config_dir = self.contracts_data_ts.parent
            config_dir.mkdir(parents=True, exist_ok=True)
            
            # Write to contracts-data.ts
            with open(self.contracts_data_ts, 'w') as f:
                f.write(ts_content)
                
            print(f"   ✅ Updated {self.contracts_data_ts}")
            return True
            
        except Exception as e:
            print(f"   ❌ Error converting contracts.json: {e}")
            return False

    def should_quote_key(self, key: Union[str, int]) -> bool:
        """Determine if a key should be quoted in TypeScript"""
        # Convert to string for checking
        key_str = str(key)
        
        # Check if it's a valid JavaScript identifier
        # Valid identifiers: start with letter, $, or _, followed by letters, digits, $, or _
        js_identifier_pattern = r'^[a-zA-Z_$][a-zA-Z0-9_$]*$'
        
        # Check if it's a valid numeric key (pure numbers are valid unquoted)
        if key_str.isdigit():
            return False
            
        # Check if it's a valid identifier
        if re.match(js_identifier_pattern, key_str):
            return False
            
        # If it contains special characters or doesn't match identifier pattern, quote it
        return True
    
    def generate_contracts_data_ts(self, contracts_data: Dict[str, Any]) -> str:
        """Generate TypeScript content for contracts-data.ts (data only)"""
        
        # Convert Python dict to TypeScript object format
        def dict_to_ts_object(obj: Any, indent: int = 0) -> str:
            if isinstance(obj, dict):
                lines = ["{"]
                for key, value in obj.items():
                    # Only quote keys that need quoting (special characters, reserved words, etc.)
                    if self.should_quote_key(key):
                        quoted_key = f'"{key}"'
                    else:
                        quoted_key = str(key)
                    
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
        
        # Generate timestamp for when this was generated
        timestamp = datetime.now().isoformat()
        
        ts_content = f'''// Auto-generated contract deployment data
// This file is generated by sync-contracts.py - DO NOT EDIT MANUALLY
// Generated on: {timestamp}

export const contractsData = {contracts_ts_obj};
'''
        
        return ts_content
    
    def print_summary(self, contracts_data: Dict[str, Any]) -> None:
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
                
                # Explorer URL
                if network.get("explorer"):
                    print(f"   🔗 Explorer: {network['explorer']}")
                
                # RPC URL
                if network.get("rpc"):
                    print(f"   🌐 RPC: {network['rpc']}")
                
                # Deployed contracts
                contracts = network.get("contracts", {})
                deployed_contracts = [name for name, addr in contracts.items() 
                                    if addr and addr != "0x0000000000000000000000000000000000000000"]
                if deployed_contracts:
                    print(f"   📄 Deployed Contracts: {', '.join(deployed_contracts)}")
                
                # Available tokens
                tokens = network.get("tokens", {})
                available_tokens = []
                for symbol, token_data in tokens.items():
                    # Handle both old format (string) and new format (object with address)
                    if isinstance(token_data, dict):
                        addr = token_data.get("address", "")
                    else:
                        addr = token_data
                    
                    if addr and addr != "0x0000000000000000000000000000000000000000":
                        available_tokens.append(symbol)
                if available_tokens:
                    print(f"   🪙 Available Tokens: {', '.join(available_tokens)}")

        print("\n📁 Generated Files:")
        print(f"   - {self.contracts_data_ts}")
        print(f"   - {self.typechain_target}")
    
    def run(self) -> None:
        """Main sync process"""
        print("🚀 ZetaChain Cross-Chain Lending Protocol - Contract Sync")
        print("=" * 60)
        
        # Validate directories
        if not self.validate_directories():
            sys.exit(1)
        
        # Load contracts.json for summary
        try:
            with open(self.contracts_json, 'r') as f:
                contracts_data: Dict[str, Any] = json.load(f)
        except Exception as e:
            print(f"❌ Error reading contracts.json: {e}")
            sys.exit(1)
        
        # Perform sync operations
        success = True
        
        # 1. Sync typechains
        if not self.sync_typechains():
            success = False
            
        # 2. Convert contracts.json to contracts-data.ts
        if not self.convert_contracts_json_to_data_ts():
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