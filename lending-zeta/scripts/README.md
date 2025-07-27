# ZetaChain Cross-Chain Lending Protocol Scripts

This directory contains deployment scripts for the ZetaChain cross-chain lending protocol, organized by component type for cross-chain testing focus.

## Directory Structure

```
scripts/
├── deposit-contract/          # Cross-chain deposit contract deployment and testing
│   ├── deploy-deposit-contracts.ts    # Deploy DepositContract on external chains
│   ├── simulate-deposit.ts            # Test cross-chain deposits from external chains
│   ├── add-assets.ts                  # Add supported assets to DepositContract
│   ├── verify-assets.ts               # Verify DepositContract asset configuration
│   ├── script-helpers.ts              # Helper functions for deposit scripts
│   └── update-lending-protocol-address.ts  # Update lending protocol address reference
├── simple/                   # SimpleLendingProtocol deployment and operations
│   ├── deploy-and-init-simple.ts      # Deploy and initialize SimpleLendingProtocol
│   ├── verify-assets.ts               # Verify supported assets in SimpleLendingProtocol
│   ├── supply-test-amount.ts          # Supply test tokens for testing
│   ├── borrow-cross-chain.ts          # Test cross-chain borrowing operations
│   ├── check-balances.ts              # Check user balances across assets
│   ├── provide-gas-tokens.ts          # Provide gas tokens for cross-chain operations
│   └── withdraw-all-fixed.ts          # Withdraw all supplied assets
├── universal/                # UniversalLendingProtocol deployment and operations
│   ├── deploy-universal-lending.ts    # Deploy and initialize UniversalLendingProtocol
│   ├── check-oracle-prices.ts         # Check external oracle price feeds
│   ├── update-oracle-prices.ts        # Update oracle prices manually
│   ├── withdraw-all-crosschain.ts     # Test cross-chain withdrawals
│   └── withdraw-all-local.ts          # Test local withdrawals on ZetaChain
├── utils/                   # Shared deployment utilities
│   └── deployment-utils.ts            # Common deployment and verification utilities
├── check-balances.ts        # Global balance checking across all protocols
├── redeploy-and-init-simple.sh        # Shell script for complete SimpleLendingProtocol redeployment
├── redeploy-and-init-universal.sh     # Shell script for complete UniversalLendingProtocol redeployment
└── package-scripts.json     # NPM script shortcuts for common operations
```

## Usage Examples

### Deploy SimpleLendingProtocol (ZetaChain)
```bash
# Deploy and initialize SimpleLendingProtocol with ZRC-20 assets
npx hardhat run scripts/simple/deploy-and-init-simple.ts --network zeta-testnet

# Complete redeployment using shell script
./scripts/redeploy-and-init-simple.sh
```

### Deploy UniversalLendingProtocol (ZetaChain) 
```bash
# Deploy and initialize UniversalLendingProtocol with advanced features
npx hardhat run scripts/universal/deploy-universal-lending.ts --network zeta-testnet

# Complete redeployment using shell script
./scripts/redeploy-and-init-universal.sh
```

### Deploy DepositContracts (External Chains)
```bash
# Deploy DepositContract on Arbitrum Sepolia
npx hardhat run scripts/deposit-contract/deploy-deposit-contracts.ts --network arbitrum-sepolia

# Deploy DepositContract on Ethereum Sepolia
npx hardhat run scripts/deposit-contract/deploy-deposit-contracts.ts --network ethereum-sepolia

# Add supported assets to DepositContract
npx hardhat run scripts/deposit-contract/add-assets.ts --network arbitrum-sepolia
```

### Test Cross-Chain Operations
```bash
# Test cross-chain deposits from external chains
npx hardhat run scripts/deposit-contract/simulate-deposit.ts --network arbitrum-sepolia

# Test cross-chain borrowing operations
npx hardhat run scripts/simple/borrow-cross-chain.ts --network zeta-testnet

# Test cross-chain withdrawals
npx hardhat run scripts/universal/withdraw-all-crosschain.ts --network zeta-testnet
```

### Asset and Balance Management
```bash
# Verify supported assets configuration
npx hardhat run scripts/simple/verify-assets.ts --network zeta-testnet
npx hardhat run scripts/deposit-contract/verify-assets.ts --network arbitrum-sepolia

# Check user balances across all assets
npx hardhat run scripts/simple/check-balances.ts --network zeta-testnet
npx hardhat run scripts/check-balances.ts --network zeta-testnet

# Supply test amounts for testing
npx hardhat run scripts/simple/supply-test-amount.ts --network zeta-testnet
```

### Oracle and Price Management (UniversalLendingProtocol)
```bash
# Check external oracle price feeds
npx hardhat run scripts/universal/check-oracle-prices.ts --network zeta-testnet

# Update oracle prices manually
npx hardhat run scripts/universal/update-oracle-prices.ts --network zeta-testnet
```

## Available NPM Scripts

The project includes comprehensive NPM scripts for common operations. Refer to `package-scripts.json` for full configuration:

### Protocol Deployment Scripts
- **SimpleLendingProtocol Deployment**: Complete deployment and initialization on ZetaChain
- **UniversalLendingProtocol Deployment**: Advanced protocol deployment with dynamic features
- **DepositContract Deployment**: Cross-chain deposit contract deployment on external chains

### Testing and Simulation Scripts  
- **Cross-Chain Deposit Simulation**: Test deposits from Arbitrum/Ethereum to ZetaChain
- **Cross-Chain Borrowing Tests**: Validate borrowing operations across chains
- **Cross-Chain Withdrawal Tests**: Test withdrawals to external chains

### Asset and Balance Management Scripts
- **Asset Verification**: Verify supported assets across all contracts
- **Balance Checking**: Monitor user balances across all protocols and assets
- **Gas Token Provision**: Provide gas tokens for cross-chain operations

### Oracle and Price Management Scripts (UniversalLendingProtocol)
- **Oracle Price Checking**: Validate external oracle price feeds
- **Manual Price Updates**: Update asset prices manually for testing

## Deployment Order and Best Practices

### Recommended Deployment Sequence

1. **Deploy Main Protocol on ZetaChain**
   ```bash
   # Option A: Deploy SimpleLendingProtocol (Basic features)
   npx hardhat run scripts/simple/deploy-and-init-simple.ts --network zeta-testnet
   
   # Option B: Deploy UniversalLendingProtocol (Advanced features)
   npx hardhat run scripts/universal/deploy-universal-lending.ts --network zeta-testnet
   ```

2. **Deploy DepositContracts on External Chains**
   ```bash
   # Deploy on Arbitrum Sepolia
   npx hardhat run scripts/deposit-contract/deploy-deposit-contracts.ts --network arbitrum-sepolia
   
   # Deploy on Ethereum Sepolia  
   npx hardhat run scripts/deposit-contract/deploy-deposit-contracts.ts --network ethereum-sepolia
   ```

3. **Configure Cross-Chain Integration**
   ```bash
   # Update lending protocol addresses in DepositContracts
   npx hardhat run scripts/deposit-contract/update-lending-protocol-address.ts --network arbitrum-sepolia
   
   # Add supported assets to DepositContracts
   npx hardhat run scripts/deposit-contract/add-assets.ts --network arbitrum-sepolia
   ```

4. **Test Cross-Chain Functionality**
   ```bash
   # Test cross-chain deposits from external chains
   npx hardhat run scripts/deposit-contract/simulate-deposit.ts --network arbitrum-sepolia
   
   # Verify assets configuration across all contracts
   npx hardhat run scripts/simple/verify-assets.ts --network zeta-testnet
   ```

## Important Notes

- **Automated Address Management**: `contracts.json` is automatically updated with deployed contract addresses
- **Cross-Chain Focus**: Scripts are designed for testnet and mainnet cross-chain deployment and testing
- **ZetaChain Gateway Integration**: All cross-chain operations require proper gateway configuration
- **Sequential Deployment**: Deploy ZetaChain protocol first, then external chain contracts
- **Testing Priority**: Thoroughly test on testnets before mainnet deployment
- **Asset Configuration**: Ensure all ZRC-20 token addresses are correctly configured across chains

## Cross-Chain Testing and Integration Focus

The script organization is designed to comprehensively test cross-chain lending functionality:

### Cross-Chain Deposit Testing
- **DepositContract Deployment**: Deploy contracts on Arbitrum Sepolia and Ethereum Sepolia
- **Cross-Chain Deposit Simulation**: Test ETH and USDC deposits from external chains to ZetaChain
- **Asset Validation**: Verify supported assets across all chains
- **Gateway Integration**: Test ZetaChain Gateway functionality for cross-chain operations

### Protocol Testing and Operations
- **SimpleLendingProtocol Testing**: Basic lending operations with fixed rates
- **UniversalLendingProtocol Testing**: Advanced lending with dynamic rates and enhanced features
- **Cross-Chain Borrowing**: Test borrowing assets and withdrawing to external chains
- **Oracle Integration**: Test external price oracle functionality (UniversalLendingProtocol)

## Detailed Script Descriptions

### DepositContract Scripts (`deposit-contract/`)
- **deploy-deposit-contracts.ts**: Deploy DepositContract with ZetaChain Gateway integration
- **simulate-deposit.ts**: End-to-end testing of cross-chain ETH/USDC deposits
- **add-assets.ts**: Configure supported assets (ETH, USDC) in DepositContract
- **verify-assets.ts**: Validate DepositContract asset configuration
- **update-lending-protocol-address.ts**: Update reference to main lending protocol address
- **script-helpers.ts**: Shared utility functions for deposit contract operations

### SimpleLendingProtocol Scripts (`simple/`)
- **deploy-and-init-simple.ts**: Deploy and initialize with ZRC-20 asset support
- **supply-test-amount.ts**: Supply test tokens for protocol testing
- **borrow-cross-chain.ts**: Test cross-chain borrowing functionality
- **check-balances.ts**: Monitor user balances across all supported assets
- **provide-gas-tokens.ts**: Provide gas tokens for cross-chain transaction fees
- **withdraw-all-fixed.ts**: Withdraw all supplied assets from the protocol
- **verify-assets.ts**: Verify supported ZRC-20 assets configuration

### UniversalLendingProtocol Scripts (`universal/`)
- **deploy-universal-lending.ts**: Deploy with advanced features and oracle integration
- **check-oracle-prices.ts**: Validate external price oracle feeds
- **update-oracle-prices.ts**: Manually update asset prices for testing
- **withdraw-all-crosschain.ts**: Test cross-chain withdrawal functionality
- **withdraw-all-local.ts**: Test local withdrawals on ZetaChain

### Utility Scripts (`utils/`)
- **deployment-utils.ts**: Shared utilities for deployment, verification, and contract management

## Supported Networks and Assets

### ZetaChain Networks (Main Protocol)
- **ZetaChain Athens Testnet (7001)**: Primary testnet for protocol deployment
- **ZetaChain Mainnet (7000)**: Production network (future deployment)

### External Networks (Cross-Chain Deposits)
- **Arbitrum Sepolia (421614)**: ETH and USDC deposit support
- **Ethereum Sepolia (11155111)**: ETH and USDC deposit support

### Supported Cross-Chain Assets
- **ETH.ARBI**: ZRC-20 representation of Arbitrum ETH deposits
- **USDC.ARBI**: ZRC-20 representation of Arbitrum USDC deposits  
- **ETH.ETH**: ZRC-20 representation of Ethereum ETH deposits
- **USDC.ETH**: ZRC-20 representation of Ethereum USDC deposits

## Cross-Chain Asset Flow Architecture

```mermaid
graph LR
    A[User on Arbitrum] --> B[DepositContract.depositToken()]
    B --> C[ZetaChain Gateway]
    C --> D[UniversalLendingProtocol.onCall()]
    D --> E[Supply ZRC-20 as Collateral]
    E --> F[Borrow Other Assets]
    F --> G[Cross-Chain Withdrawal]
    G --> H[Any Supported Chain]
```

1. **Cross-Chain Deposit**: User deposits ETH/USDC on external chains via DepositContract
2. **Gateway Processing**: ZetaChain Gateway converts assets to ZRC-20 tokens
3. **Protocol Integration**: ZRC-20 tokens automatically supplied as collateral
4. **Lending Operations**: Users can borrow against collateral with proper health factors
5. **Cross-Chain Withdrawal**: Borrowed or supplied assets can be withdrawn to any supported chain