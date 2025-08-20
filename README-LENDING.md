# Simple Lending Protocol Implementation Guide

A streamlined cross-chain lending protocol built on ZetaChain that serves as the foundation for multi-chain lending operations. This protocol provides essential lending functionality with fixed interest rates and basic cross-chain support across Ethereum, Arbitrum, BSC, Polygon, Base, Solana, and ZetaChain.

## 🚀 Features

- **Supply Collateral**: Deposit assets to earn interest and use as collateral
- **Borrow Assets**: Borrow assets with 150% collateralization requirement
- **Repay Loans**: Pay back borrowed assets with interest
- **Withdraw Collateral**: Remove collateral if health factor allows
- **Liquidation**: Liquidate undercollateralized positions (below 120% ratio)
- **Multi-Chain Support**: Works across Ethereum, Arbitrum, BSC, Polygon, Base, Solana via ZRC-20 tokens

## 📋 Protocol Parameters

- **Collateral Ratio**: 150% (1.5x overcollateralization required)
- **Liquidation Threshold**: 120% (positions below this can be liquidated)
- **Liquidation Bonus**: 5% (liquidators receive 5% bonus)
- **Supported Assets**: ETH, BNB, MATIC, SOL, USDC, USDT across all supported chains

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
- **SimpleLendingProtocolBase.sol** - Abstract base contract with core lending logic
- **SimpleLendingProtocol.sol** - Concrete implementation with ZetaChain gateway integration
- **DepositContract.sol** - Cross-chain deposit contracts deployed on external chains
- **MockZRC20.sol** - Mock ZRC-20 tokens for testing and development

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
// Cross-Chain Lending Example with Deployed Contracts

// 1. Supply 1000 USDC from Polygon Amoy as collateral
// Using deployed DepositContract: 0x55E1Bd43F67BaB1E176E2A65608C151bC0d8F148
const polygonDepositContract = "0x55E1Bd43F67BaB1E176E2A65608C151bC0d8F148";
const polygonUsdcAddress = "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582";

await polygonDepositContract.depositToken(
    polygonUsdcAddress, 
    parseUnits("1000", 6), 
    userAddress
);

// 2. Borrow 0.5 ETH on ZetaChain Athens
// Using deployed SimpleLendingProtocol: 0xcec503D661A9C56AFa91AcDB4D7A2BFe411a5416
const ethArbiZrc20 = "0x1de70f3e971B62A0707dA18100392af14f7fB677"; // Deployed ETH.ARBI
const simpleLendingProtocol = "0xcec503D661A9C56AFa91AcDB4D7A2BFe411a5416";

await simpleLendingProtocol.borrow(ethArbiZrc20, parseEther("0.5"), userAddress);

// 3. Check health factor
const healthFactor = await simpleLendingProtocol.getHealthFactor(userAddress);
console.log("Health Factor:", healthFactor.toString()); // Should be ~400%

// 4. Withdraw borrowed ETH to Arbitrum Sepolia
await simpleLendingProtocol.withdrawCrossChain(
    ethArbiZrc20,
    parseEther("0.5"),
    421614, // Arbitrum Sepolia chain ID
    userAddress
);

// 5. Repay loan from Arbitrum Sepolia
// Using deployed DepositContract: 0x589521F58dC8FBf99499D7Eb8B31cb1d9d228a0E
const arbitrumDepositContract = "0x589521F58dC8FBf99499D7Eb8B31cb1d9d228a0E";
const arbitrumEthAddress = "0x0000000000000000000000000000000000000000"; // Native ETH

await arbitrumDepositContract.repayEth(
    userAddress,
    { value: parseEther("0.5") }
);
```

## 🚨 Security Features

- **ReentrancyGuard**: Prevents reentrancy attacks
- **Health Factor Validation**: Ensures proper collateralization
- **Asset Whitelisting**: Only supported assets can be used
- **Decimal Normalization**: Handles different token decimals correctly
- **Liquidation Protection**: Prevents bad debt accumulation

## 🎯 SimpleLendingProtocol vs UniversalLendingProtocol

**SimpleLendingProtocol** (this implementation) focuses on:
- **Fixed Interest Rates**: Predictable, manually-set interest rates
- **Basic Health Factor**: Simple collateral-to-debt ratio calculations
- **Manual Price Management**: Owner-controlled asset pricing
- **Cross-Chain Support**: Full gateway integration for multi-chain operations
- **Educational Focus**: Ideal for learning and simple applications

**UniversalLendingProtocol** (advanced version) provides:
- **Dynamic Interest Rates**: Aave-inspired kinked rate models with RAY precision
- **Enhanced Security**: Oracle-based pricing with staleness protection
- **Advanced Calculations**: Weighted collateral factors and sophisticated health metrics
- **Gas Optimization**: Custom libraries for efficient cross-chain operations
- **Production Ready**: Institutional-grade features and comprehensive validation

## 📝 Deployment Output

After deployment, you'll get contract addresses for frontend integration:
```json
{
  "networks": {
    "7001": {
      "name": "ZetaChain Athens Testnet",
      "contracts": {
        "SimpleLendingProtocol": "0xcec503D661A9C56AFa91AcDB4D7A2BFe411a5416",
        "UniversalLendingProtocol": "0xb44df318e14d3a162589f76fbc7642a589879e4b",
        "MockPriceOracle": "0x3611ec20Ab7904E914E1Dbb47F536fE8c54ddC8E"
      },
      "tokens": {
        "ETH.ETH": "0x05BA149A7bd6dC1F937fA9046A9e05C05f3b18b0",
        "USDC.ETH": "0xcC683A782f4B30c138787CB5576a86AF66fdc31d",
        "ETH.ARBI": "0x1de70f3e971B62A0707dA18100392af14f7fB677",
        "USDC.ARBI": "0x4bC32034caCcc9B7e02536945eDbC286bACbA073",
        "BNB.BSC": "0xd97B1de3619ed2c6BEb3860147E30cA8A7dC9891",
        "USDC.BSC": "0x7c8dDa80bbBE1254a7aACf3219EBe1481c6E01d7",
        "POL.POLYGON": "0x777915D031d1e8144c90D025C594b3b8Bf07a08d",
        "USDC.POLYGON": "0xe573a6e11f8506620F123DBF930222163D46BCB6",
        "ETH.BASE": "0x236b0DE675cC8F46AE186897fCCeFe3370C9eDeD",
        "USDC.BASE": "0xd0eFed75622e7AA4555EE44F296dA3744E3ceE19",
        "SOL.SOLANA": "0xADF73ebA3Ebaa7254E859549A44c74eF7cff7501",
        "USDC.SOLANA": "0xD10932EB3616a937bd4a2652c87E9FeBbAce53e5"
      }
    },
    "11155111": {
      "name": "Ethereum Sepolia",
      "contracts": {
        "DepositContract": "0x07058282910F6a7aDC2fe307E92DA56Cd39F183D",
        "Gateway": "0x0c487a766110c85d301d96e33579c5b317fa4995"
      }
    },
    "421614": {
      "name": "Arbitrum Sepolia", 
      "contracts": {
        "DepositContract": "0x589521F58dC8FBf99499D7Eb8B31cb1d9d228a0E",
        "Gateway": "0x0dA86Dc3F9B71F84a0E97B0e2291e50B7a5df10f"
      }
    },
    "97": {
      "name": "BSC Testnet",
      "contracts": {
        "DepositContract": "0x575b07E3cC36eEeC6B94ac5D09f6285ecE2a66dd",
        "Gateway": "0x0c487a766110c85d301d96e33579c5b317fa4995"
      }
    },
    "80002": {
      "name": "Polygon Amoy",
      "contracts": {
        "DepositContract": "0x55E1Bd43F67BaB1E176E2A65608C151bC0d8F148",
        "Gateway": "0x0c487a766110c85d301d96e33579c5b317fa4995"
      }
    },
    "84532": {
      "name": "Base Sepolia",
      "contracts": {
        "DepositContract": "0x701B48270c8d2F2c84746be7CeB003A256E61145",
        "Gateway": "0x0c487a766110c85d301d96e33579c5b317fa4995"
      }
    }
  }
}
```

## 🔗 Multi-Chain Architecture

### ZetaChain Integration
The SimpleLendingProtocol leverages ZetaChain's Universal EVM capabilities:
- **ZRC-20 Tokens**: Native cross-chain token representations
- **Universal Contracts**: Single deployment, multi-chain access
- **Gateway Integration**: Seamless cross-chain message passing
- **Revert Handling**: Robust error handling for failed cross-chain transactions

### Supported Blockchain Networks
- **Ethereum** (Chain ID: 1) - ETH, USDC, USDT
- **Arbitrum** (Chain ID: 42161) - ETH, USDC, USDT
- **BSC** (Chain ID: 56) - BNB, USDC, USDT
- **Polygon** (Chain ID: 137) - MATIC, USDC, USDT
- **Base** (Chain ID: 8453) - ETH, USDC
- **Solana** (Mainnet) - SOL, USDC
- **ZetaChain** (Chain ID: 7000) - All cross-chain assets as ZRC-20

### Cross-Chain Operation Flow
1. **Deposit**: Users deposit assets on any supported chain via DepositContract
2. **Gateway**: ZetaChain gateway converts native assets to ZRC-20 tokens
3. **Lending**: Core lending operations happen on ZetaChain
4. **Withdrawal**: Users can withdraw to any supported destination chain

### Getting Started with Multi-Chain
```bash
# Deploy SimpleLendingProtocol on ZetaChain
bun hardhat run scripts/simple/deploy-and-init-simple.ts --network zeta-mainnet

# Deploy DepositContracts on all supported chains
bun hardhat run scripts/deposit-contract/deploy-deposit-contracts.ts --network ethereum
bun hardhat run scripts/deposit-contract/deploy-deposit-contracts.ts --network arbitrum
bun hardhat run scripts/deposit-contract/deploy-deposit-contracts.ts --network bsc
bun hardhat run scripts/deposit-contract/deploy-deposit-contracts.ts --network polygon
bun hardhat run scripts/deposit-contract/deploy-deposit-contracts.ts --network base
bun hardhat run scripts/deposit-contract/deploy-deposit-contracts.ts --network solana

# Test cross-chain deposit
bun hardhat run scripts/deposit-contract/simulate-deposit.ts --network polygon
```

Ready for production multi-chain lending! 🚀