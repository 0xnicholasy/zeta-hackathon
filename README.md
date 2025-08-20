# ZetaChain Cross-Chain Lending Protocol

*Built for the ZetaChain Universal dApps Hackathon*

## What is This?

A revolutionary **cross-chain lending platform** that lets you borrow and lend cryptocurrency across multiple blockchain networks seamlessly. Think of it as a universal bank account that works across Ethereum, Arbitrum, BSC, Polygon, Base, Solana, and ZetaChain simultaneously.

## Why Does This Matter?

Traditionally, if you have USDC on Polygon but need BNB on BSC, you'd need complex bridges and multiple transactions. Our protocol eliminates this friction - deposit from any supported chain, borrow what you need, and receive it on any other supported network.

## Key Benefits

- **🌐 True Cross-Chain**: Deposit collateral on one chain, borrow on another
- **🔄 Universal Flexibility**: Withdraw your assets to any supported blockchain  
- **🛡️ Secure & Tested**: Built with proven lending mechanics and comprehensive security measures
- **⚡ Simple to Use**: One interface for all your cross-chain lending needs
- **💰 Competitive Rates**: Dynamic interest rates that adapt to market conditions

## How It Works (Simple Version)

### 1. 💰 Supply Collateral
Deposit your cryptocurrency (USDC, ETH, BNB, MATIC, SOL) from any supported network as collateral. Your assets are securely stored and tracked across all chains.

### 2. 📈 Borrow Assets  
Borrow against your collateral with a 150% safety margin. Want BNB but only have SOL? No problem - borrow what you need across any supported chains.

### 3. 🔄 Withdraw Anywhere
Receive your borrowed assets on any supported blockchain network. Deposit on Solana, receive on Base - it's that flexible.

### 4. ⚖️ Stay Safe
Our automated liquidation system ensures the platform remains secure. If collateral values drop too low, positions are safely liquidated.

## Supported Networks & Assets

| **Network** | **Assets** | **What You Can Do** |
|-------------|------------|---------------------|
| **Ethereum** | ETH, USDC, USDT | Deposit, withdraw, full lending operations |
| **Arbitrum** | ETH, USDC, USDT | Deposit, withdraw, full lending operations |
| **BSC (Binance Smart Chain)** | BNB, USDC, USDT | Deposit, withdraw, full lending operations |
| **Polygon** | MATIC, USDC, USDT | Deposit, withdraw, full lending operations |
| **Base** | ETH, USDC | Deposit, withdraw, full lending operations |
| **Solana** | SOL, USDC | Deposit, withdraw, full lending operations |
| **ZetaChain** | All cross-chain assets | Core protocol operations |

## Getting Started

Ready to try cross-chain lending? Check out our technical documentation:

- **[🏗️ Developer Guide](./lending-zeta/README.md)** - Complete technical implementation
- **[⚡ Quick Start](./lending-zeta/README.md#-quick-start)** - Deploy and test the protocol
- **[🔄 Cross-Chain Guide](./lending-zeta/CROSS-CHAIN-LENDING.md)** - Detailed architecture and flows

## Why We Built This

**The Problem**: DeFi is fragmented across different blockchains. Users struggle to efficiently move and utilize their assets across networks, often facing high fees, complex bridges, and security risks.

**Our Solution**: A unified lending platform that treats all supported blockchains as one seamless ecosystem. Users can:
- Deposit assets from their preferred network
- Access liquidity from the entire cross-chain pool
- Withdraw to whichever network suits their needs

**The Technology**: Built on ZetaChain's Universal EVM, which enables smart contracts to natively interact with multiple blockchains without traditional bridges or wrapped tokens.

## Protocol Features

### 🏦 Dual Protocol Architecture
Choose between two lending protocols based on your needs:

- **SimpleLendingProtocol**: Perfect for straightforward lending with predictable fixed rates
- **UniversalLendingProtocol**: Advanced features with dynamic rates, enhanced risk management, and institutional-grade capabilities

### 🔒 Security First
- **Overcollateralization**: 150% minimum collateral requirement ensures protocol safety
- **Automated Liquidations**: Positions are liquidated at 110% (Simple) or 120% (Universal) ratio to protect lenders
- **Multi-layer Validation**: Comprehensive security checks for all cross-chain operations
- **Oracle Integration**: Real-time price feeds for accurate asset valuation

### ⚡ Advanced Features
- **Dynamic Interest Rates**: Rates adjust based on supply and demand
- **Cross-Chain Gas Optimization**: Automatic handling of transaction costs
- **Flexible Withdrawals**: Withdraw to any supported network
- **Real-time Analytics**: Complete visibility into your lending positions

## Example User Journey

### Sarah's Cross-Chain Lending Experience

1. **🏦 Starting Position**: Sarah has 3,000 USDC on Polygon but needs 5 SOL for a transaction on Solana

2. **💰 Supply Collateral**: She deposits her 3,000 USDC from Polygon into our protocol (becomes collateral)

3. **📈 Borrow SOL**: With $3,000 collateral, she can safely borrow 5 SOL (worth ~$2,000)

4. **🔄 Receive on Solana**: The borrowed SOL is delivered directly to her Solana wallet

5. **📱 Repay Later**: When ready, she repays the SOL loan plus interest from any supported network

6. **✨ Withdraw**: She gets her original USDC collateral back, plus any earned interest

**Result**: Sarah got SOL on Solana using USDC from Polygon, all through one simple interface!

## Ready to Build?

This protocol demonstrates the power of ZetaChain's universal blockchain capabilities. Whether you're a developer looking to integrate cross-chain lending or a user wanting to experience the future of DeFi, we've got you covered.

### For Developers
- **[📋 Technical Implementation](./lending-zeta/README.md)** - Complete development guide
- **[🏗️ Smart Contracts](./lending-zeta/contracts/README.md)** - Contract documentation and APIs
- **[🚀 Deployment Scripts](./lending-zeta/scripts/README.md)** - Automated deployment tools

### For Users
- **Test on Testnets**: Try the protocol risk-free across all supported testnets including Ethereum, Arbitrum, BSC, Polygon, Base, and Solana
- **Join the Community**: Follow our progress and provide feedback
- **Explore DeFi**: Experience true cross-chain lending without the complexity

## Project Structure

```
zeta-hackathon/
├── lending-zeta/           # Core protocol implementation
│   ├── contracts/          # Smart contracts
│   ├── scripts/           # Deployment and testing
│   └── README.md          # Technical documentation
├── frontend/              # User interface (future)
├── UNIVERSAL-LENDING-PROTOCOL.md  # Advanced protocol details
└── README.md              # This file
```

---

*Built with ❤️ for the ZetaChain Universal dApps Hackathon*