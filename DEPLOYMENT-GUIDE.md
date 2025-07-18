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
- **`deployments.ts`** - Contains all contract addresses and network configurations
- **`hardhat.config.ts`** - Network settings for Hardhat deployment
- **`scripts/deploy-with-config.ts`** - Smart deployment script with auto-configuration
- **`scripts/setup-assets.ts`** - Asset configuration script

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

### 1. Local Development
```bash
# Deploy to local Hardhat network
bun hardhat run scripts/deploy-with-config.ts

# Or explicitly specify network
NETWORK=localnet bun hardhat run scripts/deploy-with-config.ts
```

### 2. ZetaChain Testnet
```bash
# Set your private key
export PRIVATE_KEY="your_private_key_here"

# Deploy to testnet
NETWORK=zeta-testnet bun hardhat run scripts/deploy-with-config.ts --network zeta-testnet
```

### 3. External Chain Deployments (Deposit Contracts)
```bash
# Deploy deposit contracts to external chains
export PRIVATE_KEY="your_private_key_here"

# Deploy to Arbitrum Sepolia
npx hardhat run scripts/deploy-deposit-contracts.ts --network arbitrum-sepolia

# Deploy to Ethereum Sepolia  
npx hardhat run scripts/deploy-deposit-contracts.ts --network ethereum-sepolia
```

## ⚙️ Asset Configuration

### Automatic Configuration (Local)
For local development, mock tokens are automatically deployed and configured:

```bash
# Everything is done automatically
bun hardhat run scripts/deploy-with-config.ts
```

### Manual Configuration (Testnet/Mainnet)
For testnet/mainnet, update ZRC-20 addresses in `deployments.ts` first:

```typescript
// Update these addresses in deployments.ts
"zeta-testnet": {
  tokens: {
    "ETH.ARBI": "0x1234...", // Real ZRC-20 ETH.ARBI address
    "USDC.ARBI": "0x5678...", // Real ZRC-20 USDC.ARBI address
    "ETH.ETH": "0x9abc...", // Real ZRC-20 ETH.ETH address
    "USDC.ETH": "0xdef0...", // Real ZRC-20 USDC.ETH address
    "ZETA": "0x3456...",       // Real ZETA token address
  }
}
```

Then run asset setup:
```bash
NETWORK=zeta-testnet bun hardhat run scripts/setup-assets.ts --network zeta-testnet
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
Edit `ASSET_CONFIGS` in `deployments.ts`:

```typescript
export const ASSET_CONFIGS = {
  "ETH.ARBI": {
    symbol: "ETH.ARBI",
    collateralFactor: 0.8,        // 80%
    liquidationThreshold: 0.85,   // 85%
    liquidationBonus: 0.05,       // 5%
    priceInUSD: 2000             // $2000
  },
  // ... other assets
};
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
import { getDeployment, getContractAddress, getTokenAddress } from './deployments';

// Get deployment for current network
const deployment = getDeployment('zeta-testnet');

// Get specific contract address
const lendingProtocolAddress = getContractAddress('zeta-testnet', 'LendingProtocol');

// Get specific token address
const ethTokenAddress = getTokenAddress('zeta-testnet', 'ETH.ARBI');

// Validate deployment
const validation = validateDeployment('zeta-testnet');
if (!validation.isValid) {
  console.error('Missing addresses:', validation.missingContracts, validation.missingTokens);
}
```

## 🛠️ Helper Functions

The deployment system includes several utility functions:

```typescript
// Get deployment info
const deployment = getDeployment('zeta-testnet');

// Get contract addresses
const contractAddresses = getAllContractAddresses('zeta-testnet');

// Get token addresses  
const tokenAddresses = getAllTokenAddresses('zeta-testnet');

// Validate addresses
const isValid = isValidAddress('0x1234...'); // returns boolean

// Validate entire deployment
const validation = validateDeployment('zeta-testnet');
```

## 🔍 Verification

### Check Deployment Status
```bash
# Verify all assets are configured
NETWORK=zeta-testnet bun hardhat run scripts/setup-assets.ts --network zeta-testnet
```

### Manual Verification
```typescript
import { validateDeployment } from './deployments';

const validation = validateDeployment('zeta-testnet');
console.log('Valid:', validation.isValid);
console.log('Missing contracts:', validation.missingContracts);
console.log('Missing tokens:', validation.missingTokens);
```

## 🐛 Troubleshooting

### Common Issues

1. **"Contract not deployed" Error**
   ```bash
   # Check if addresses are updated in deployments.ts
   # Run deployment first:
   NETWORK=zeta-testnet bun hardhat run scripts/deploy-with-config.ts --network zeta-testnet
   ```

2. **"Token not configured" Error**
   ```bash
   # Update ZRC-20 addresses in deployments.ts
   # Then run asset setup:
   NETWORK=zeta-testnet bun hardhat run scripts/setup-assets.ts --network zeta-testnet
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
Set `DEBUG=true` for verbose logging:
```bash
DEBUG=true NETWORK=zeta-testnet bun hardhat run scripts/deploy-with-config.ts --network zeta-testnet
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

### Local Development
```bash
# 1. Deploy everything locally
bun hardhat run scripts/deploy-with-config.ts

# 2. Start building your frontend!
# All addresses are automatically updated in deployments.ts
```

### Testnet Deployment
```bash
# 1. Set private key
export PRIVATE_KEY="0x..."

# 2. Update ZRC-20 addresses in deployments.ts (if needed)
# 3. Deploy contracts
NETWORK=zeta-testnet bun hardhat run scripts/deploy-with-config.ts --network zeta-testnet

# 4. Configure assets (if not already done)
NETWORK=zeta-testnet bun hardhat run scripts/setup-assets.ts --network zeta-testnet
```

### Production Deployment
```bash
# 1. Set private key
export PRIVATE_KEY="0x..."

# 2. Update all mainnet addresses in deployments.ts
# 3. Deploy to mainnet
NETWORK=zeta-mainnet bun hardhat run scripts/deploy-with-config.ts --network zeta-mainnet

# 4. Verify on explorer
# 5. Configure frontend with production addresses
```

---

## 🔗 Quick Reference

| Command | Description |
|---------|-------------|
| `bun hardhat compile` | Compile contracts |
| `bun hardhat test` | Run tests |
| `NETWORK=localnet bun hardhat run scripts/deploy-with-config.ts` | Deploy locally |
| `NETWORK=zeta-testnet bun hardhat run scripts/deploy-with-config.ts --network zeta-testnet` | Deploy to testnet |
| `NETWORK=zeta-testnet bun hardhat run scripts/setup-assets.ts --network zeta-testnet` | Configure assets |

Ready to build your ZetaChain lending protocol! 🚀