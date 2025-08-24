# ZetaChain Cross-Chain Lending Protocol

*Built for the ZetaChain X Google Cloud AI Buildathon*

## 🔗 Quick Links

- **📦 GitHub Repository**: [https://github.com/0xnicholasy/zeta-hackathon](https://github.com/0xnicholasy/zeta-hackathon)
- **🌐 Live Demo**: [https://zeta-hackathon.vercel.app/](https://zeta-hackathon.vercel.app/)
- **💬 Join Our Discord**: [https://discord.gg/E3qBNnQGjG](https://discord.gg/E3qBNnQGjG)

## What is This?

A revolutionary **AI-integrated cross-chain lending platform** that combines ZetaChain's universal blockchain capabilities with Google Cloud AI to create the smartest DeFi protocol ever built. Think of it as an intelligent universal bank account that works across Ethereum, Arbitrum, BSC, Polygon, Base, Solana, and ZetaChain simultaneously.

### 🤖 **Google Cloud AI Integration**
Our protocol leverages cutting-edge AI to deliver enhanced user experience:
- **Natural Language Interface**: Chat with your DeFi positions using Google Cloud's Gemini AI
- **AI-Powered Strategy Analyzer**: Scan for yielding strategies on supported chains for yield farming opportunities

## Why Does This Matter?

Traditionally, if you have USDC on Polygon but need BNB on BSC, you'd need complex bridges and multiple transactions. Our protocol eliminates this friction - deposit from any supported chain, borrow what you need, and receive it on any other supported network.

## Key Benefits

- **🌐 True Cross-Chain**: Deposit collateral on one chain, borrow on another
- **🔄 Universal Flexibility**: Withdraw your assets to any supported blockchain  
- **🛡️ Secure & Tested**: Built with proven lending mechanics and comprehensive security measures
- **⚡ Simple to Use**: One interface for all your cross-chain lending needs
- **💰 Competitive Rates**: Dynamic interest rates that adapt to market conditions
- **🤖 AI-Powered Intelligence**: Natural language interface and yield farming strategy analysis
- **💬 Natural Language DeFi**: Ask questions and get insights in plain English

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
| **Ethereum** | ETH, USDC | Deposit, withdraw, full lending operations |
| **Arbitrum** | ETH, USDC | Deposit, withdraw, full lending operations |
| **BSC (Binance Smart Chain)** | BNB, USDC | Deposit, withdraw, full lending operations |
| **Polygon** | MATIC, USDC | Deposit, withdraw, full lending operations |
| **Base** | ETH, USDC | Deposit, withdraw, full lending operations |
| **Solana** | SOL, USDC | Deposit, withdraw, full lending operations |

## 🌐 Mainnet Deployment

The protocol is now live on **ZetaChain Mainnet** with the following deployed contracts:

| **Contract** | **Address** | **Network** |
|--------------|-------------|-------------|
| **UniversalLendingProtocol** | `0x575b07E3cC36eEeC6B94ac5D09f6285ecE2a66dd` | ZetaChain Mainnet (7000) |
| **MockPriceOracle** | `0x55E1Bd43F67BaB1E176E2A65608C151bC0d8F148` | ZetaChain Mainnet (7000) |

**Deployment Details:**
- **Deployed:** August 23, 2025
- **Deployer:** `0xe1C5Bf97A7Ffb50988DeF972E1E242072298a59C`
- **Chain ID:** 7000 (ZetaChain Mainnet)

Ready for production use across all supported cross-chain operations!

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

**The Technology**: Built on ZetaChain's Universal EVM combined with Google Cloud AI's machine learning platform. ZetaChain enables smart contracts to natively interact with multiple blockchains, while Google Cloud AI provides intelligent automation, risk management, and user experience optimization.

## Protocol Features

### 🔒 Security First
- **Overcollateralization**: 150% minimum collateral requirement ensures protocol safety
- **Automated Liquidations**: Positions are liquidated at 120% ratio to protect lenders
- **Multi-layer Validation**: Comprehensive security checks for all cross-chain operations
- **Oracle Integration**: Real-time price feeds for accurate asset valuation

### ⚡ Advanced Features
- **Dynamic Interest Rates**: Rates adjust based on supply and demand
- **Cross-Chain Gas Optimization**: Automatic handling of transaction costs
- **Flexible Withdrawals**: Withdraw to any supported network
- **Real-time Analytics**: Complete visibility into your lending positions

### 🤖 Google Cloud AI-Powered Features
- **Natural Language Interface**: Ask questions like "How much can I safely borrow?" and get instant AI-powered answers using Google Gemini AI
- **AI-Powered Strategy Analyzer**: Automatically scan for yielding strategies across supported chains and identify optimal yield farming opportunities

## Example User Journey

### Sarah's Cross-Chain Lending Experience

1. **🏦 Starting Position**: Sarah has 10 SOL on Solana (SOL/USD = $200, total value = $2,000) but needs 0.25 ETH for a transaction on Arbitrum (ETH/USD = $4,000, total value = $1,000)

2. **💰 Supply Collateral**: She deposits her 10 SOL from Solana into our protocol (becomes $2,000 collateral)

3. **📈 Borrow ETH**: With $2,000 collateral, she can safely borrow 0.25 ETH (worth $1,000) while maintaining healthy 200% collateralization ratio

4. **🔄 Receive on Arbitrum**: The borrowed 0.25 ETH is delivered directly to her Arbitrum wallet

5. **📱 Repay Later**: When ready, she repays the 0.25 ETH loan plus interest from any supported network

6. **✨ Withdraw**: She gets her original 10 SOL collateral back, plus any earned interest

**Result**: Sarah got ETH on Arbitrum using SOL from Solana, all through one simple interface!

## Ready to Build?

This protocol demonstrates the power of ZetaChain's universal blockchain capabilities. Whether you're a developer looking to integrate cross-chain lending or a user wanting to experience the future of DeFi, we've got you covered.

### For Developers
- **[📋 Technical Implementation](./lending-zeta/README.md)** - Complete development guide
- **[🏗️ Smart Contracts](./lending-zeta/contracts/README.md)** - Contract documentation and APIs
- **[🚀 Deployment Scripts](./lending-zeta/scripts/README.md)** - Automated deployment tools

### For Users
- **Test on Testnets**: Try the protocol risk-free across all supported testnets including Ethereum, Arbitrum, BSC, Polygon, Base, and Solana
- **💬 Join Our Discord**: [https://discord.gg/E3qBNnQGjG](https://discord.gg/E3qBNnQGjG) - Connect with the community and get support
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

## 🏆 ZetaChain X Google Cloud AI Buildathon

This project showcases the powerful combination of:
- **ZetaChain Universal EVM**: Native cross-chain smart contract capabilities
- **Google Cloud AI Platform**: Advanced machine learning and AI services
- **Cross-Chain DeFi Innovation**: The future of decentralized finance

### AI Services Integration
- **Vertex AI**: Custom ML models for risk assessment and yield optimization
- **Gemini AI**: Natural language interface for DeFi interactions
- **Cloud ML APIs**: Real-time fraud detection and market analysis
- **BigQuery ML**: Large-scale data analytics for protocol optimization

## 🚀 Future Roadmap

### Upcoming Features
- **AMM Liquidity Pool Integration**: Direct integration with automated market makers for enhanced liquidity
- **Dynamic Rebalancing**: Control borrowing and supplying APY to automatically rebalance collateral supply
- **DAO & Governance**: Launch governance token for community voting on supported assets and protocol parameters
- **Advanced AI Features**: 
  - Intelligent risk scoring and credit assessment
  - Predictive liquidation alerts
  - Smart portfolio optimization
  - Market sentiment analysis
  - Automated yield farming
  - Fraud detection systems
  - Personalized DeFi recommendations

---

*Built with ❤️ for the ZetaChain X Google Cloud AI Buildathon*