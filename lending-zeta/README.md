# ZetaChain Cross-Chain Lending Protocol

A cross-chain lending protocol built on ZetaChain that enables users to supply collateral and borrow assets across Arbitrum, Ethereum, and ZetaChain using ETH and USDC.

## Features

- **Cross-Chain Deposits**: Deposit ETH and USDC from Arbitrum Sepolia and Ethereum Sepolia
- **Unified Lending**: All lending logic on ZetaChain with ZRC-20 token representation
- **Flexible Withdrawals**: Withdraw to any supported chain, not just the deposit chain
- **Aave-Inspired**: Overcollateralized lending with liquidation mechanisms
- **Gateway Integration**: Uses ZetaChain's EVM gateway for cross-chain functionality

## Quick Start

1. **Deploy Simple Lending Protocol to ZetaChain**: 
   ```bash
   npx hardhat run scripts/simple/deploy-and-init-simple.ts --network zeta-testnet
   ```

2. **Deploy Universal Lending Protocol to ZetaChain** (Advanced):
   ```bash
   npx hardhat run scripts/universal/deploy-universal-lending.ts --network zeta-testnet
   ```

3. **Deploy Deposit Contracts**:
   ```bash
   # Arbitrum Sepolia
   npx hardhat run scripts/deposit-contract/deploy-deposit-contracts.ts --network arbitrum-sepolia
   
   # Ethereum Sepolia
   npx hardhat run scripts/deposit-contract/deploy-deposit-contracts.ts --network ethereum-sepolia
   ```

4. **Test Cross-Chain Deposits**:
   ```bash
   npx hardhat run scripts/deposit-contract/simulate-deposit.ts --network arbitrum-sepolia
   ```

## Documentation

- [Scripts README](./scripts/README.md) - Deployment and testing guide
- [Root README](../README.md) - Complete protocol design
- [CLAUDE.md](../CLAUDE.md) - Development context and guidelines

## Supported Networks

- **ZetaChain Athens Testnet** (7001) - Main lending protocol
- **Arbitrum Sepolia** (421614) - ETH and USDC deposits  
- **Ethereum Sepolia** (11155111) - ETH and USDC deposits

For more information, visit: https://www.zetachain.com/docs/
Assets Deployed Contract address: https://www.zetachain.com/docs/reference/network/contracts/