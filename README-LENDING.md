# Simple Lending Protocol

A minimal cross-chain lending protocol built for ZetaChain hackathon. This protocol allows users to supply collateral and borrow assets with proper health factor management.

## 🚀 Features

- **Supply Collateral**: Deposit assets to earn interest and use as collateral
- **Borrow Assets**: Borrow assets with 150% collateralization requirement
- **Repay Loans**: Pay back borrowed assets with interest
- **Withdraw Collateral**: Remove collateral if health factor allows
- **Liquidation**: Liquidate undercollateralized positions (below 120% ratio)
- **Cross-Chain Ready**: Designed for ZRC-20 tokens on ZetaChain

## 📋 Protocol Parameters

- **Collateral Ratio**: 150% (1.5x overcollateralization required)
- **Liquidation Threshold**: 120% (positions below this can be liquidated)
- **Liquidation Bonus**: 5% (liquidators receive 5% bonus)
- **Supported Assets**: ETH, USDC, USDT (configurable)

## 🛠️ Quick Start

### Install Dependencies
```bash
bun install
```

### Compile Contracts
```bash
bun hardhat compile
```

### Run Tests
```bash
bun hardhat test test/SimpleLendingProtocol.test.ts
```

### Deploy Locally
```bash
bun hardhat run scripts/deploy-simple.ts
```

## 📄 Smart Contracts

### Core Contracts
- **SimpleLendingProtocol.sol** - Main lending protocol logic
- **SimplePriceOracle.sol** - Price oracle for asset valuation
- **MockZRC20.sol** - Mock ZRC-20 tokens for testing

### Key Functions

#### User Functions
```solidity
// Supply collateral
function supply(address asset, uint256 amount) external

// Borrow assets
function borrow(address asset, uint256 amount) external

// Repay borrowed assets
function repay(address asset, uint256 amount) external

// Withdraw collateral
function withdraw(address asset, uint256 amount) external
```

#### Liquidation
```solidity
// Liquidate undercollateralized position
function liquidate(
    address user,
    address collateralAsset,
    address debtAsset,
    uint256 repayAmount
) external
```

#### View Functions
```solidity
// Get user's health factor
function getHealthFactor(address user) external view returns (uint256)

// Get collateral/debt values
function getCollateralValue(address user, address asset) external view returns (uint256)
function getDebtValue(address user, address asset) external view returns (uint256)
```

## 🔧 Configuration

### Add New Assets
```solidity
// Add asset with USD price
lendingProtocol.addAsset(tokenAddress, priceInUSD);
```

### Update Asset Prices
```solidity
// Update price in USD
lendingProtocol.updatePrice(tokenAddress, newPriceInUSD);
```

## 📊 Example Usage

```typescript
// 1. Supply 10 ETH as collateral
await ethToken.approve(lendingProtocol.address, parseEther("10"));
await lendingProtocol.supply(ethToken.address, parseEther("10"));

// 2. Borrow 10,000 USDC (with 10 ETH = $20,000 collateral)
await lendingProtocol.borrow(usdcToken.address, parseUnits("10000", 6));

// 3. Check health factor
const healthFactor = await lendingProtocol.getHealthFactor(userAddress);
console.log("Health Factor:", healthFactor.toString()); // Should be ~200%

// 4. Repay loan
await usdcToken.approve(lendingProtocol.address, parseUnits("5000", 6));
await lendingProtocol.repay(usdcToken.address, parseUnits("5000", 6));

// 5. Withdraw collateral
await lendingProtocol.withdraw(ethToken.address, parseEther("5"));
```

## 🚨 Security Features

- **ReentrancyGuard**: Prevents reentrancy attacks
- **Health Factor Validation**: Ensures proper collateralization
- **Asset Whitelisting**: Only supported assets can be used
- **Decimal Normalization**: Handles different token decimals correctly
- **Liquidation Protection**: Prevents bad debt accumulation

## 🎯 Hackathon Simplifications

For hackathon purposes, this protocol includes these simplifications:
- Fixed collateral ratios (no dynamic risk parameters)
- Simple price oracle (manual price updates)
- No interest rate calculations (focus on core lending logic)
- Basic liquidation mechanism (5% fixed bonus)

## 📝 Deployment Output

After deployment, you'll get contract addresses for frontend integration:
```json
{
  "network": "local",
  "chainId": 1337,
  "contracts": {
    "SimpleLendingProtocol": "0x...",
    "SimplePriceOracle": "0x...",
    "ETH": "0x...",
    "USDC": "0x...",
    "USDT": "0x..."
  }
}
```

## 🔗 ZetaChain Integration

This protocol is designed to work with ZetaChain's:
- **ZRC-20 Tokens**: Cross-chain token standard
- **Universal EVM**: Deploy once, access everywhere
- **Cross-Chain Messaging**: For multi-chain operations

Ready for hackathon development! 🎉