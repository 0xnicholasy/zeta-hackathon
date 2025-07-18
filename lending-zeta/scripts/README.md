# Lending Protocol Deployment and Testing Scripts

This directory contains comprehensive deployment, initialization, and testing scripts for the ZetaChain Cross-Chain Lending Protocol.

## Scripts Overview

### Deployment Scripts

#### `deploy.ts`
Deploys the full lending protocol including:
- Mock ZRC20 tokens (ETH.ARBI, USDC.ARBI, USDT.BASE)
- Price Oracle contracts (PriceOracle, MockPriceOracle, SimplePriceOracle)
- Main LendingProtocol contract
- Simple LendingProtocol contract
- Universal contract (if applicable)

**Usage:**
```bash
npx hardhat run scripts/deploy.ts --network <network>
```

#### `deploy-simple.ts`
Deploys a simplified version for quick testing:
- SimplePriceOracle
- SimpleLendingProtocol
- Mock ZRC20 tokens (ETH.ARBI, USDC.ARBI)

**Usage:**
```bash
npx hardhat run scripts/deploy-simple.ts --network <network>
```

#### `deploy-deposit-contracts.ts`
Deploys deposit contracts on external chains (Arbitrum, Ethereum) for cross-chain deposits:
- DepositContract with gateway integration
- Configures supported assets per chain
- Validates gateway addresses
- Sets up asset whitelisting (ETH/USDC on both Arbitrum and Ethereum)

**Usage:**
```bash
# Deploy on Arbitrum Sepolia
npx hardhat run scripts/deploy-deposit-contracts.ts --network arbitrum-sepolia

# Deploy on Ethereum Sepolia
npx hardhat run scripts/deploy-deposit-contracts.ts --network ethereum-sepolia
```

**Prerequisites:**
- Update gateway addresses in the script for target networks
- Update lending protocol address (deployed on ZetaChain)
- Update asset contract addresses for each network

### Initialization Scripts

#### `initialize.ts`
Initializes the full lending protocol:
- Sets up price feeds for all assets
- Configures asset parameters (collateral factors, liquidation thresholds)
- Adds supported assets to both lending protocols

**Usage:**
```bash
npx hardhat run scripts/initialize.ts --network <network>
```

#### `initialize-simple.ts`
Initializes the simple lending protocol:
- Sets up basic price feeds
- Adds assets to simple lending protocol

**Usage:**
```bash
npx hardhat run scripts/initialize-simple.ts --network <network>
```

### Testing Scripts

#### `test-lending.ts`
Comprehensive testing of the main lending protocol:
- Supply collateral tests
- Borrow against collateral tests
- Repayment tests
- Liquidation scenario tests
- Withdrawal tests

**Usage:**
```bash
npx hardhat run scripts/test-lending.ts --network <network>
```

#### `test-simple.ts`
Testing of the simple lending protocol:
- Basic supply/borrow/repay flow
- Health factor calculations
- Liquidation scenarios
- Edge case testing

**Usage:**
```bash
npx hardhat run scripts/test-simple.ts --network <network>
```

### Utility Scripts

#### `deployment-utils.ts`
Utility functions for deployment management:
- Verify deployed contracts
- Display deployment summaries
- Gas cost estimation
- Balance checking

**Usage:**
```bash
# Verify deployment
npx hardhat run scripts/deployment-utils.ts verify [simple]

# Show deployment summary
npx hardhat run scripts/deployment-utils.ts summary [simple]

# Show gas estimates
npx hardhat run scripts/deployment-utils.ts gas

# Check balances
npx hardhat run scripts/deployment-utils.ts balances
```

#### `run-all-tests.sh`
Comprehensive test runner that:
- Compiles contracts
- Runs Foundry tests
- Starts local network
- Deploys and tests both simple and main protocols
- Generates coverage reports (if available)

**Usage:**
```bash
./scripts/run-all-tests.sh
```

## Quick Start Guide

### 1. Full Protocol Deployment and Testing

```bash
# Start local network (in separate terminal)
npx hardhat node

# Deploy, initialize, and test full protocol
npx hardhat run scripts/deploy.ts --network localhost
npx hardhat run scripts/initialize.ts --network localhost
npx hardhat run scripts/test-lending.ts --network localhost
```

### 2. Simple Protocol (Quick Testing)

```bash
# Start local network (in separate terminal)
npx hardhat node

# Deploy, initialize, and test simple protocol
npx hardhat run scripts/deploy-simple.ts --network localhost
npx hardhat run scripts/initialize-simple.ts --network localhost
npx hardhat run scripts/test-simple.ts --network localhost
```

### 3. Cross-Chain Deposit Contract Deployment

```bash
# 1. First deploy lending protocol on ZetaChain
npx hardhat run scripts/deploy.ts --network zeta-testnet
npx hardhat run scripts/initialize.ts --network zeta-testnet

# 2. Update lending protocol address in deploy-deposit-contracts.ts

# 3. Deploy deposit contracts on external chains
npx hardhat run scripts/deploy-deposit-contracts.ts --network arbitrum-sepolia
npx hardhat run scripts/deploy-deposit-contracts.ts --network ethereum-sepolia

# 4. Test cross-chain deposits
npx hardhat run scripts/test-lending.ts --network zeta-testnet
```

### 4. Run All Tests

```bash
# Automated full test suite
./scripts/run-all-tests.sh
```

## Network Configuration

The scripts support multiple networks:
- `localhost` - Local Hardhat network
- `hardhat` - Hardhat network
- `zeta-testnet` - ZetaChain testnet
- `zeta-mainnet` - ZetaChain mainnet
- `arbitrum-sepolia` - Arbitrum Sepolia testnet (for deposit contracts)
- `ethereum-sepolia` - Ethereum Sepolia testnet (for deposit contracts)

## Output Files

After deployment, the following files are created:
- `deployments-{chainId}.json` - Full deployment addresses (ZetaChain)
- `simple-deployments-{chainId}.json` - Simple deployment addresses (ZetaChain)
- `deposit-deployments.ts` - Deposit contract addresses (External chains)

**Note:** Update `deposit-deployments.ts` with actual deployed addresses after deploying to external chains.

## Prerequisites

1. **Node.js and npm/yarn/bun installed**
2. **Hardhat configured** with appropriate network settings
3. **Foundry installed** (for forge tests)
4. **Sufficient ETH balance** for deployment on target network

## Environment Variables

Create a `.env` file with:
```
PRIVATE_KEY=your_private_key_here
ZETACHAIN_RPC_URL=https://zetachain-testnet-rpc-url
ARBITRUM_SEPOLIA_RPC_URL=https://arbitrum-sepolia-rpc-url
ETHEREUM_SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc-url

# Gateway addresses (update with actual addresses)
ARBITRUM_GATEWAY_ADDRESS=0x...
ETHEREUM_GATEWAY_ADDRESS=0x...

# Asset addresses (testnet addresses already configured in script)
# ARBITRUM_USDC_ADDRESS=0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d
# ETHEREUM_USDC_ADDRESS=0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238
```

## Contract Addresses

### Example Testnet Deployments

```json
{
  "contracts": {
    "tokens": {
      "ETH.ARBI": "0x1234...5678",
      "USDC.ARBI": "0x2345...6789",
      "USDT.BASE": "0x3456...7890"
    },
    "oracles": {
      "PriceOracle": "0x4567...8901",
      "MockPriceOracle": "0x5678...9012",
      "SimplePriceOracle": "0x6789...0123"
    },
    "lending": {
      "LendingProtocol": "0x7890...1234",
      "SimpleLendingProtocol": "0x8901...2345"
    }
  }
}
```

### Example Deposit Contract Deployments

```json
{
  "arbitrum-sepolia": {
    "chainId": 421614,
    "contracts": {
      "DepositContract": "0xabcd...1234",
      "Gateway": "0x9fE4...2345"
    },
    "assets": {
      "ETH": "0x0000...0000",
      "USDC": "0x75fa...CE46AA4d"
    }
  },
  "ethereum-sepolia": {
    "chainId": 11155111,
    "contracts": {
      "DepositContract": "0xef01...5678",
      "Gateway": "0x2345...6789"
    },
    "assets": {
      "ETH": "0x0000...0000",
      "USDC": "0x1c7D...7238"
    }
  }
}
```

## Testing Scenarios

### Main Protocol Tests
1. **Supply Collateral** - Users deposit ETH, USDC, USDT as collateral
2. **Borrow Assets** - Users borrow against collateral with health factor checks
3. **Repay Debt** - Users repay borrowed amounts
4. **Liquidation** - Liquidators can liquidate undercollateralized positions
5. **Withdraw** - Users can withdraw excess collateral

### Simple Protocol Tests
1. **Basic Flow** - Supply → Borrow → Repay → Withdraw
2. **Health Factor** - Continuous health monitoring
3. **Liquidation** - Price manipulation triggers liquidation
4. **Edge Cases** - Insufficient collateral, invalid operations

### Cross-Chain Deposit Tests
1. **ETH Deposits** - Deposit ETH from Arbitrum/Ethereum → ZetaChain lending
2. **USDC Deposits** - Deposit USDC from Arbitrum/Ethereum → ZetaChain lending
3. **Gateway Integration** - Verify proper gateway message passing
4. **Asset Validation** - Only whitelisted assets accepted
5. **Revert Handling** - Failed deposits return funds to user
6. **Multi-Chain Support** - Test deposits from both supported chains

## Gas Optimization

The scripts include gas optimization features:
- Batch operations where possible
- Efficient contract deployment order
- Gas estimation utilities

## Security Considerations

1. **Price Oracle Security** - Price feeds are validated
2. **Collateral Checks** - Health factors enforced
3. **Liquidation Protection** - Proper liquidation incentives
4. **Access Control** - Owner-only functions protected

## Troubleshooting

### Common Issues

1. **"Contract not found"** - Run deployment scripts first
2. **"Insufficient balance"** - Check ETH balance for gas
3. **"Price not set"** - Run initialization scripts
4. **"Health factor too low"** - Increase collateral or reduce borrow

### Debug Commands

```bash
# Check deployment status
npx hardhat run scripts/deployment-utils.ts verify

# Check account balances
npx hardhat run scripts/deployment-utils.ts balances

# View deployment summary
npx hardhat run scripts/deployment-utils.ts summary
```

## Contributing

When adding new scripts:
1. Follow the existing naming convention
2. Include comprehensive error handling
3. Add logging for debugging
4. Update this README
5. Test on localhost before mainnet

## License

MIT License - See LICENSE file for details