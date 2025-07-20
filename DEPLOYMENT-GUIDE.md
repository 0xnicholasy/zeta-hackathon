# 🚀 ZetaChain Lending Protocol - Deployment Guide

This guide shows you how to deploy and manage the ZetaChain cross-chain lending protocol across different networks using the new configuration system.

## 📋 Table of Contents

1. [Configuration System](#configuration-system)
2. [Supported Networks](#supported-networks)
3. [Deployment Commands](#deployment-commands)
4. [Asset Configuration](#asset-configuration)
5. [Frontend Integration](#frontend-integration)
6. [Troubleshooting](#troubleshooting)

## 🔧 Configuration System

### Core Files
- **`lending-zeta/contracts.json`** - Contains all contract addresses and network configurations
- **`lending-zeta/hardhat.config.ts`** - Network settings for Hardhat deployment
- **`lending-zeta/scripts/simple/deploy-and-init-simple.ts`** - Simple lending protocol deployment
- **`lending-zeta/scripts/universal/deploy-universal-lending.ts`** - Universal lending protocol deployment
- **`lending-zeta/scripts/depositcontract/deploy-deposit-contracts.ts`** - External chain deposit contracts

### TypeScript Interfaces
```typescript
// All addresses are strongly typed
type Address = `0x${string}`;

interface TokenAddresses {
  "ETH.ARBI": Address;    // Ethereum from Arbitrum
  "USDC.ARBI": Address;   // USDC from Arbitrum  
  "ETH.ETH": Address;     // Ethereum from Ethereum
  "USDC.ETH": Address;    // USDC from Ethereum
  "ZETA": Address;        // Native ZETA token
}

interface CoreContracts {
  LendingProtocol: Address;
  PriceOracle: Address;
}
```

## 🌐 Supported Networks

| Network | Chain ID | RPC URL | Explorer |
|---------|----------|---------|----------|
| **Local** | 1337 | http://127.0.0.1:8545 | http://localhost:8545 |
| **ZetaChain Athens Testnet** | 7001 | https://zetachain-athens-evm.blockpi.network/v1/rpc/public | https://athens.explorer.zetachain.com |
| **Arbitrum Sepolia** | 421614 | https://sepolia-rollup.arbitrum.io/rpc | https://sepolia.arbiscan.io |
| **Ethereum Sepolia** | 11155111 | https://sepolia.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161 | https://sepolia.etherscan.io |

## 🚀 Deployment Commands

### 1. Simple Lending Protocol (Recommended)
```bash
# Deploy Simple Lending Protocol to ZetaChain testnet
cd lending-zeta
npx hardhat run scripts/simple/deploy-and-init-simple.ts --network zeta-testnet
```

### 2. Universal Lending Protocol (Advanced)
```bash
# Deploy Universal Lending Protocol to ZetaChain testnet  
cd lending-zeta
npx hardhat run scripts/universal/deploy-universal-lending.ts --network zeta-testnet
```

### 3. External Chain Deployments (Deposit Contracts)
```bash
# Deploy deposit contracts to external chains
cd lending-zeta

# Deploy to Arbitrum Sepolia
npx hardhat run scripts/depositcontract/deploy-deposit-contracts.ts --network arbitrum-sepolia

# Deploy to Ethereum Sepolia  
npx hardhat run scripts/depositcontract/deploy-deposit-contracts.ts --network ethereum-sepolia
```

## ⚙️ Asset Configuration

### Asset Configuration
Assets are automatically configured during deployment. The scripts use real ZRC-20 token addresses that are already configured in `contracts.json`:

```json
// lending-zeta/contracts.json - ZRC-20 token addresses
"7001": {
  "tokens": {
    "ETH.ARBI": "0x1de70f3e971B62A0707dA18100392af14f7fB677",
    "USDC.ARBI": "0x4bC32034caCcc9B7e02536945eDbC286bACbA073", 
    "ETH.ETH": "0x05BA149A7bd6dC1F937fA9046A9e05C05f3b18b0",
    "USDC.ETH": "0xcC683A782f4B30c138787CB5576a86AF66fdc31d"
  }
}
```

### Verify Asset Configuration
```bash
cd lending-zeta
npx hardhat run scripts/simple/verify-assets.ts --network zeta-testnet
```

## 🎯 Asset Parameters

Each asset has the following configurable parameters:

| Asset | Collateral Factor | Liquidation Threshold | Liquidation Bonus | Price |
|-------|------------------|----------------------|-------------------|--------|
| **ETH.ARBI** | 80% | 85% | 5% | $2,000 |
| **USDC.ARBI** | 90% | 90% | 5% | $1 |
| **ETH.ETH** | 80% | 85% | 5% | $2,000 |
| **USDC.ETH** | 90% | 90% | 5% | $1 |
| **ZETA** | 75% | 80% | 10% | $0.50 |

### Updating Asset Parameters
Asset parameters are configured in the deployment scripts. To modify them, edit the asset configuration in the deployment files:

```typescript
// In scripts/simple/deploy-and-init-simple.ts or scripts/universal/deploy-universal-lending.ts
const assets = [
  { symbol: "ETH.ARBI", address: ethArbiAddress, price: 2000 },
  { symbol: "USDC.ARBI", address: usdcArbiAddress, price: 1 },
  { symbol: "ETH.ETH", address: ethEthAddress, price: 2000 },
  { symbol: "USDC.ETH", address: usdcEthAddress, price: 1 }
];
```

## 🔗 Frontend Integration

After deployment, you'll get a JSON output for frontend integration:

```json
{
  "network": "ZetaChain Athens Testnet",
  "chainId": 7001,
  "deployer": "0x...",
  "isTestnet": true,
  "explorer": "https://athens.explorer.zetachain.com",
  "contracts": {
    "LendingProtocol": "0x...",
    "PriceOracle": "0x..."
  },
  "tokens": {
    "ETH.ARBI": "0x...",
    "USDC.ARBI": "0x...",
    "ETH.ETH": "0x...",
    "USDC.ETH": "0x...",
    "ZETA": "0x..."
  },
  "timestamp": "2025-07-15T03:39:25.979Z"
}
```

### Using in Frontend
```typescript
// Read contracts.json to get deployed addresses
import contractsConfig from './lending-zeta/contracts.json';

// Get network configuration
const zetaNetwork = contractsConfig.networks['7001'];

// Get contract addresses
const lendingProtocolAddress = zetaNetwork.contracts.SimpleLendingProtocol;

// Get token addresses  
const ethArbiAddress = zetaNetwork.tokens['ETH.ARBI'];
const usdcArbiAddress = zetaNetwork.tokens['USDC.ARBI'];
```

## 🛠️ Helper Functions

The deployment system includes utility scripts in `scripts/utils/deployment-utils.ts`:

```bash
cd lending-zeta

# Verify all deployed contracts
npx hardhat run scripts/utils/deployment-utils.ts verify --network zeta-testnet

# Show deployment summary
npx hardhat run scripts/utils/deployment-utils.ts summary --network zeta-testnet

# Check account balances
npx hardhat run scripts/utils/deployment-utils.ts balances --network zeta-testnet
```

## 🔍 Verification

### Check Deployment Status
```bash
cd lending-zeta

# Verify all assets are configured
npx hardhat run scripts/simple/verify-assets.ts --network zeta-testnet

# Verify deployment completeness
npx hardhat run scripts/utils/deployment-utils.ts verify --network zeta-testnet
```

### Manual Verification
```bash
cd lending-zeta

# Check contracts.json for deployed addresses
cat contracts.json

# Verify contracts on chain
npx hardhat run scripts/utils/deployment-utils.ts summary --network zeta-testnet
```

## 🐛 Troubleshooting

### Common Issues

1. **"Contract not deployed" Error**
   ```bash
   cd lending-zeta
   # Run deployment first:
   npx hardhat run scripts/simple/deploy-and-init-simple.ts --network zeta-testnet
   ```

2. **"Token not configured" Error**
   ```bash
   cd lending-zeta
   # Verify asset configuration:
   npx hardhat run scripts/simple/verify-assets.ts --network zeta-testnet
   ```

3. **"Invalid private key" Error**
   ```bash
   # Set your private key
   export PRIVATE_KEY="0x1234567890abcdef..."
   ```

4. **Network Connection Issues**
   ```bash
   # Check network configuration in hardhat.config.ts
   # Verify RPC URL is accessible
   curl -X POST https://zetachain-athens-evm.blockpi.network/v1/rpc/public
   ```

### Debug Mode
Use Hardhat's built-in debugging features:
```bash
cd lending-zeta
# Run deployment with verbose output
npx hardhat run scripts/simple/deploy-and-init-simple.ts --network zeta-testnet --verbose
```

## 📝 Environment Variables

Create a `.env` file in your project root:

```bash
# Required for testnet/mainnet deployment
PRIVATE_KEY=0x1234567890abcdef...

# Optional: Set default network
NETWORK=zeta-testnet

# Optional: Enable debug logging
DEBUG=true
```

## 🎉 Quick Start Examples

### Testnet Deployment (Recommended)
```bash
# 1. Set private key
export PRIVATE_KEY="0x..."

# 2. Deploy Simple Lending Protocol
cd lending-zeta
npx hardhat run scripts/simple/deploy-and-init-simple.ts --network zeta-testnet

# 3. Deploy Deposit Contracts
npx hardhat run scripts/depositcontract/deploy-deposit-contracts.ts --network arbitrum-sepolia
npx hardhat run scripts/depositcontract/deploy-deposit-contracts.ts --network ethereum-sepolia

# 4. Verify assets configuration
npx hardhat run scripts/simple/verify-assets.ts --network zeta-testnet
```

### Universal Protocol Deployment (Advanced)
```bash
# 1. Set private key
export PRIVATE_KEY="0x..."

# 2. Deploy Universal Lending Protocol
cd lending-zeta
npx hardhat run scripts/universal/deploy-universal-lending.ts --network zeta-testnet

# 3. Deploy Deposit Contracts (same as above)
# 4. All addresses automatically updated in contracts.json
```

### Local Testing
```bash
# 1. Run local tests
cd lending-zeta
npx hardhat test

# 2. Start local network and deploy
npx hardhat node
# In another terminal:
npx hardhat run scripts/simple/deploy-and-init-simple.ts --network localhost
```

---

## 🔗 Quick Reference

| Command | Description |
|---------|-------------|
| `cd lending-zeta && npx hardhat compile` | Compile contracts |
| `cd lending-zeta && npx hardhat test` | Run tests |
| `cd lending-zeta && npx hardhat run scripts/simple/deploy-and-init-simple.ts --network zeta-testnet` | Deploy Simple Protocol |
| `cd lending-zeta && npx hardhat run scripts/universal/deploy-universal-lending.ts --network zeta-testnet` | Deploy Universal Protocol |
| `cd lending-zeta && npx hardhat run scripts/simple/verify-assets.ts --network zeta-testnet` | Verify assets |

Ready to build your ZetaChain lending protocol! 🚀