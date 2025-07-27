# ZetaChain Cross-Chain Lending Protocol

A comprehensive **cross-chain lending protocol** built on ZetaChain that revolutionizes decentralized lending by enabling seamless cross-chain operations. Users can deposit collateral from multiple chains, perform advanced lending operations, and withdraw assets with complete flexibility across Arbitrum, Ethereum, and ZetaChain using ETH and USDC.

## 🌟 Key Features

### 🔄 Cross-Chain Operations
- **Multi-Chain Deposits**: Deposit ETH and USDC from Arbitrum Sepolia and Ethereum Sepolia directly to ZetaChain
- **Universal Withdrawals**: Withdraw borrowed or supplied assets to any supported chain
- **Cross-Chain Borrowing**: Borrow assets on ZetaChain and receive them on external chains
- **ZRC-20 Integration**: Native ZetaChain token representation for seamless cross-chain asset management

### 💰 Dual Protocol Architecture
- **SimpleLendingProtocol**: Basic lending with fixed interest rates and cross-chain support
- **UniversalLendingProtocol**: Advanced lending with dynamic interest rates, enhanced risk management, and external oracle integration
- **Flexible Deployment**: Choose the protocol that best fits your use case

### 🛡️ Security & Risk Management
- **Overcollateralized Lending**: 150% minimum health factor for secure borrowing
- **Dynamic Liquidation System**: Automated liquidation at configurable thresholds
- **Oracle Price Integration**: Real-time asset pricing with staleness protection (UniversalLendingProtocol)
- **Multi-Layer Validation**: Comprehensive security checks for cross-chain operations

### ⚡ Advanced Features
- **Aave-Inspired Design**: Dynamic interest rates based on asset utilization
- **Enhanced Analytics**: Detailed user account data and borrowing capacity calculations
- **Reserve System**: Protocol revenue capture from interest spreads
- **Gas Fee Management**: Automatic handling of cross-chain transaction costs

## 🚀 Quick Start

### Option A: SimpleLendingProtocol (Recommended for beginners)
```bash
# 1. Deploy SimpleLendingProtocol to ZetaChain
npx hardhat run scripts/simple/deploy-and-init-simple.ts --network zeta-testnet

# 2. Deploy DepositContracts to external chains
npx hardhat run scripts/deposit-contract/deploy-deposit-contracts.ts --network arbitrum-sepolia
npx hardhat run scripts/deposit-contract/deploy-deposit-contracts.ts --network ethereum-sepolia

# 3. Test cross-chain deposits
npx hardhat run scripts/deposit-contract/simulate-deposit.ts --network arbitrum-sepolia
```

### Option B: UniversalLendingProtocol (Advanced features)
```bash
# 1. Deploy UniversalLendingProtocol to ZetaChain
npx hardhat run scripts/universal/deploy-universal-lending.ts --network zeta-testnet

# 2. Deploy DepositContracts to external chains
npx hardhat run scripts/deposit-contract/deploy-deposit-contracts.ts --network arbitrum-sepolia
npx hardhat run scripts/deposit-contract/deploy-deposit-contracts.ts --network ethereum-sepolia

# 3. Configure oracle and test operations
npx hardhat run scripts/universal/check-oracle-prices.ts --network zeta-testnet
npx hardhat run scripts/universal/withdraw-all-crosschain.ts --network zeta-testnet
```

### Complete Redeployment (Shell Scripts)
```bash
# SimpleLendingProtocol complete redeployment
./scripts/redeploy-and-init-simple.sh

# UniversalLendingProtocol complete redeployment  
./scripts/redeploy-and-init-universal.sh
```

## 📚 Comprehensive Documentation

### Core Documentation
- **[CROSS-CHAIN-LENDING.md](./CROSS-CHAIN-LENDING.md)** - Complete cross-chain protocol architecture and implementation guide
- **[contracts/README.md](./contracts/README.md)** - Detailed smart contract documentation and API reference
- **[scripts/README.md](./scripts/README.md)** - Deployment scripts, testing guides, and usage examples

### Development Resources
- **[Root Project README](../README.md)** - Complete project overview and development setup
- **[CLAUDE.md](../CLAUDE.md)** - Development context, guidelines, and protocol specifics

## 🌐 Supported Networks and Assets

### Primary Networks
| Network | Chain ID | Purpose | Assets |
|---------|----------|---------|--------|
| **ZetaChain Athens Testnet** | 7001 | Main lending protocol | ZRC-20 tokens (ETH.ARBI, USDC.ARBI, ETH.ETH, USDC.ETH) |
| **Arbitrum Sepolia** | 421614 | Cross-chain deposits | ETH, USDC |
| **Ethereum Sepolia** | 11155111 | Cross-chain deposits | ETH, USDC |

### ZRC-20 Asset Addresses (ZetaChain Athens)
- **ETH.ARBI**: `0x13A0c5930C028511Dc02665E7285134B6d11A5f4`
- **USDC.ARBI**: `0x48f80608B672DC30DC7e3dbBd0343c5F02C738Eb`
- **ETH.ETH**: `0xd97B1de3619ed2c6BEb3860147E30cA8A7dC9891`
- **USDC.ETH**: `0x0cbe0dF132a6c6B4a2974Fa1b7Fb953CF0Cc798a`

## 🏗️ Project Structure

```
lending-zeta/
├── contracts/                 # Smart contracts
│   ├── SimpleLendingProtocol.sol       # Basic lending protocol
│   ├── UniversalLendingProtocol.sol    # Advanced lending protocol
│   ├── DepositContract.sol             # Cross-chain deposits
│   ├── interfaces/                     # Contract interfaces
│   ├── libraries/                      # Shared libraries
│   └── mocks/                          # Testing contracts
├── scripts/                   # Deployment and testing scripts
│   ├── simple/                # SimpleLendingProtocol operations
│   ├── universal/             # UniversalLendingProtocol operations
│   ├── deposit-contract/      # Cross-chain deposit operations
│   └── utils/                 # Shared utilities
├── test/                      # Foundry test suite
└── contracts.json             # Deployed contract addresses
```

## 🔗 External Resources

- **[ZetaChain Documentation](https://www.zetachain.com/docs/)** - Official ZetaChain developer resources
- **[ZetaChain Contract Addresses](https://www.zetachain.com/docs/reference/network/contracts/)** - Network-specific contract addresses
- **[ZetaChain Universal Apps](https://www.zetachain.com/docs/developers/tutorials/swap/)** - Universal application development guides