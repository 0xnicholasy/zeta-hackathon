# Solana Scripts Configuration

This directory contains configuration-driven Solana scripts for cross-chain lending protocol integration. All hardcoded values have been extracted to `config.json` for easier maintenance and network switching.

## Configuration Files

### `config.json`
Main configuration file containing all network endpoints, contract addresses, token configurations, and transaction parameters.

### `config.ts`
TypeScript configuration manager with type-safe access to configuration values and utility functions.

## Configuration Structure

```json
{
  "networks": {
    "devnet": {
      "solana": {
        "rpcUrl": "https://api.devnet.solana.com",
        "commitment": "confirmed"
      },
      "zetachain": {
        "chainId": 7001,
        "blockpiUrl": "https://zetachain-athens.blockpi.network/lcd/v1/public/zeta-chain/crosschain/inboundHashToCctxData",
        "explorerUrl": "https://athens.explorer.zetachain.com"
      }
    }
  },
  "contracts": {
    "devnet": {
      "gateway": {
        "programId": "ZETAjseVjuFsxdRxo6MmTCvqFwb3ZHUx56Co3vCmGis",
        "pdaSeeds": ["meta"]
      },
      "zetachain": {
        "universalLendingProtocol": "0x32aBC46abc5bC818fF4DB0C0e75ea2dDbb2D9a13"
      }
    }
  },
  "tokens": {
    "devnet": {
      "usdc": {
        "mint": "Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr",
        "decimals": 6,
        "symbol": "USDC"
      },
      "sol": {
        "symbol": "SOL",
        "decimals": 9
      }
    }
  },
  "transaction": {
    "devnet": {
      "minBalance": 0.05,
      "solDepositAmount": 0.01,
      "solFeeAmount": 0.002,
      "usdcDepositAmount": 1.0
    }
  }
}
```

## Scripts

### 1. `deposit-sol-gateway-final.ts`
Deposits SOL to ZetaChain lending protocol via cross-chain gateway with `deposit_and_call` functionality.

**Configuration Usage:**
- Solana RPC endpoint from `networks.devnet.solana.rpcUrl`
- Gateway program ID and PDA from `contracts.devnet.gateway`
- Destination address from `contracts.devnet.zetachain.universalLendingProtocol`
- Deposit amounts from `transaction.devnet`
- Explorer URLs generated dynamically

### 2. `deposit-spl-gateway-final.ts`
Deposits USDC (SPL tokens) to ZetaChain lending protocol via cross-chain gateway with `deposit_spl_token_and_call` functionality.

**Configuration Usage:**
- USDC token mint address from `tokens.devnet.usdc.mint`
- Token decimals and symbol from `tokens.devnet.usdc`
- Whitelist validation against gateway program
- Dynamic amount calculation based on decimals

### 3. `setup-usdc-account.ts`
Helper script to create USDC token accounts and guide users through token acquisition.

**Configuration Usage:**
- Network-aware account creation
- Dynamic token information display
- Network-specific faucet recommendations

## Configuration Manager API

### Core Methods

```typescript
import { config } from "./config";

// Network configuration
config.getSolanaConfig()           // Get Solana RPC and commitment
config.getZetaChainConfig()        // Get ZetaChain chain ID and URLs
config.getNetwork()                // Get current network ("devnet" | "mainnet")

// Contract configuration
config.getGatewayProgramId()       // Get gateway program PublicKey
config.getGatewayPDA()             // Get computed PDA
config.getUniversalLendingProtocolAddress() // Get lending contract address

// Token configuration
config.getTokenMint("usdc")        // Get USDC mint PublicKey
config.getUSDCConfig()             // Get USDC decimals and symbol
config.getSOLConfig()              // Get SOL decimals and symbol

// Transaction configuration
config.getSOLDepositAmount()       // Get SOL deposit amount
config.getUSDCDepositAmount()      // Get USDC deposit amount
config.getMinBalance()             // Get minimum balance requirement

// URL generation
config.getSolanaExplorerUrl(signature)  // Generate explorer URL
config.getZetaChainCCTXUrl(signature)   // Generate cross-chain TX URL
```

### Network Switching

```typescript
import { createConfig } from "./config";

// Create config for specific network
const mainnetConfig = createConfig("mainnet");
const devnetConfig = createConfig("devnet");

// Switch network on existing instance
config.setNetwork("mainnet");
```

## Benefits of Configuration-Driven Approach

1. **Network Flexibility**: Easy switching between devnet and mainnet
2. **Maintainability**: All addresses and endpoints in one place
3. **Type Safety**: TypeScript interfaces prevent configuration errors
4. **Consistency**: Same configuration across all scripts
5. **Testability**: Easy to test with different configurations
6. **Deployment**: Simple updates for new contract deployments

## Adding New Networks

To add support for a new network (e.g., "testnet"):

1. Add network configuration to `config.json`:
```json
{
  "networks": {
    "testnet": { /* network config */ }
  },
  "contracts": {
    "testnet": { /* contract addresses */ }
  },
  "tokens": {
    "testnet": { /* token configurations */ }
  },
  "transaction": {
    "testnet": { /* transaction parameters */ }
  }
}
```

2. Update the `Network` type in `config.ts`:
```typescript
export type Network = "devnet" | "mainnet" | "testnet";
```

3. All scripts will automatically support the new network.

## Security Considerations

- **Address Validation**: All addresses are validated during configuration loading
- **Network Isolation**: Configuration prevents accidental cross-network operations
- **Type Safety**: TypeScript interfaces catch configuration errors at compile time
- **Immutable Addresses**: Configuration prevents runtime modification of critical addresses

## Usage Examples

### Running Scripts
```bash
# All scripts use devnet by default
bun run solana/scripts/deposit-sol-gateway-final.ts
bun run solana/scripts/deposit-spl-gateway-final.ts
bun run solana/scripts/setup-usdc-account.ts
```

### Custom Network Configuration
```typescript
import { createConfig } from "./config";

async function depositWithCustomConfig() {
    const config = createConfig("mainnet");
    // Use mainnet configuration
    const gatewayId = config.getGatewayProgramId();
    // ...
}
```

This configuration-driven approach makes the Solana scripts more maintainable, flexible, and production-ready! 🚀