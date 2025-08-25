# ZetaChain Cross-Chain Lending Protocol Contracts

This directory contains the smart contracts for the ZetaChain cross-chain lending protocol, featuring a **modular UniversalLendingProtocol implementation** with specialized libraries for enhanced maintainability, gas efficiency, and advanced cross-chain functionality.

## Contract Structure

### Core Contracts

1. **UniversalLendingProtocol.sol** - **Modular lending protocol** using specialized libraries for dynamic interest rates, enhanced risk management, and cross-chain operations
2. **DepositContract.sol** - Handles cross-chain deposits from external chains (Arbitrum, Ethereum) to ZetaChain
3. **PriceOracle.sol** - Price oracle for real-time asset pricing with external oracle integration

### Interfaces

1. **IUniversalLendingProtocol.sol** - Interface for UniversalLendingProtocol with advanced features and core lending functions
2. **IPriceOracle.sol** - Interface for price oracle with external price feed integration

### Modular Libraries

**The UniversalLendingProtocol uses a clean modular architecture with specialized libraries:**

1. **CoreCalculations.sol** - **Core utility library** for decimal normalization, asset value calculations, precision handling, and mathematical operations (48 functions tested)
2. **HealthFactorLogic.sol** - **Risk assessment library** for health factor calculations, borrowing/withdrawal validation, and liquidation eligibility (34 functions tested)
3. **PositionManager.sol** - **Position management library** for user account data aggregation, capacity calculations, and comprehensive position analysis (26 functions tested)
4. **UserAssetCalculations.sol** - **Heavy computation library** for user asset data calculations, collateral valuations, and borrowable capacity calculations (19 functions tested)
5. **LiquidationLogic.sol** - **Liquidation engine library** for liquidation calculations, collateral seizure logic, and cross-decimal liquidation handling (19 functions tested)
6. **InterestRateModel.sol** - **Interest rate library** for dynamic utilization-based rate calculations using kinked rate model (27 functions tested)
7. **CrossChainOperations.sol** - **Cross-chain operations library** for gateway integration, cross-chain borrow/withdraw operations (not locally tested - requires ZetaChain testnet)

**Architecture Benefits:**
- **Modular responsibility separation** with single-purpose libraries
- **Enhanced testability** with comprehensive library test coverage - see [test/README.md](../test/README.md) for detailed test coverage
- **Gas optimization** through efficient library usage patterns
- **Improved maintainability** with clear separation of concerns

### Mocks (Testing Only)

1. **MockPriceOracle.sol** - Mock price oracle for testing scenarios
2. **MockZRC20.sol** - Mock ZRC-20 token for testing cross-chain functionality

## UniversalLendingProtocol Features

The UniversalLendingProtocol design is inspired by Aave's architecture, particularly in the following aspects:

**License Acknowledgment**: This protocol implements concepts and architectural patterns inspired by [Aave Protocol v3](https://github.com/aave/aave-v3-core), which is licensed under [GPL-3.0](https://github.com/aave/aave-v3-core/blob/master/LICENSE.md). While our implementation is original code written from scratch for ZetaChain's cross-chain lending use case, we acknowledge the conceptual debt to Aave's pioneering work in DeFi lending protocols. This repository maintains compatibility with GPL-3.0 licensing terms for any components that may be considered derivative of Aave's work.

- **Dynamic Interest Rates**: Implements a dynamic interest rate model that adjusts based on asset utilization:
  - Uses a two-slope model with different rates below and above optimal utilization (similar to Aave's rate model)
  - Calculates separate borrow and supply rates
  - Implements a reserve factor to capture protocol revenue from interest (similar to Aave's reserve system)
- **Enhanced Risk Management**: 
  - Uses configurable collateral factors for each asset (similar to Aave's collateral factor concept)
  - Implements liquidation thresholds for more precise risk assessment (similar to Aave's liquidation threshold)
  - Provides liquidation bonuses to liquidators (similar to Aave's liquidation bonus)
- **Advanced Cross-Chain Configuration Management**:
  - Allows administrators to specify which source chains are allowed for cross-chain operations
  - Maps ZRC-20 assets to their source chain IDs and symbols
  - Supports deposits from Arbitrum Sepolia and Ethereum Sepolia
  - Enables withdrawals to any supported destination chain
  - Implements proper cross-chain message validation and authentication
- **External Price Oracle Integration**:
  - Integrates with an external price oracle contract for real-time asset pricing (similar to Aave's price oracle approach)
  - Provides functions to update the price oracle address
- **Detailed User Account Data**:
  - Provides comprehensive user account information including:
    - Total collateral value
    - Total debt value
    - Available borrowing capacity
    - Current liquidation threshold
    - Health factor
- **Enhanced Asset Configuration**:
  - Stores additional asset parameters including:
    - Collateral factor
    - Liquidation threshold
    - Liquidation bonus
    - Current borrow and supply rates
    - Total supply and borrow amounts
- **Interest Tracking**:
  - Tracks last interest update time for each user and asset
  - Updates interest rates when users interact with the protocol
- **Reserve System**:
  - Implements a reserve system to capture protocol revenue from interest (similar to Aave's reserve system)
  - Tracks total reserves for each asset

## Common Functions

Both protocols implement the same core lending operations with similar interfaces:

### Asset Management
- `addAsset()` - Add a new asset to the protocol
- `updatePrice()` - Update the price of an existing asset
- `getAssetConfig()` - Retrieve configuration information for an asset
- `getSupportedAssetsCount()` - Get the number of supported assets
- `getSupportedAsset()` - Get the address of a supported asset by index

### User Operations
- `supply()` - Supply assets to the protocol
  - Transfers assets from the user to the protocol
  - Updates the user's supply balance
  - Emits a Supply event
- `borrow()` - Borrow assets from the protocol
  - Transfers assets from the protocol to the user
  - Updates the user's borrow balance
  - Validates sufficient collateral
  - Emits a Borrow event
- `repay()` - Repay borrowed assets
  - Transfers assets from the user to the protocol
  - Reduces the user's borrow balance
  - Emits a Repay event
- `withdraw()` - Withdraw supplied assets
  - Transfers assets from the protocol to the user
  - Reduces the user's supply balance
  - Validates sufficient collateral remains
  - Emits a Withdraw event
- `liquidate()` - Liquidate undercollateralized positions
  - Allows users to repay another user's debt
  - Seizes collateral from the borrower
  - Validates the borrower is undercollateralized
  - Emits a Liquidate event

### Cross-Chain Operations
- `borrowCrossChain()` - Borrow assets and send them to another chain
  - Performs standard borrow validation
  - Handles cross-chain withdrawal through ZetaChain Gateway
  - Manages gas fees for cross-chain transactions
  - Supports withdrawal to any supported destination chain
- `withdrawCrossChain()` - Withdraw supplied assets to another chain
  - Performs standard withdrawal validation
  - Handles cross-chain withdrawal through ZetaChain Gateway
  - Manages gas fees for cross-chain transactions
  - Enables flexible withdrawal to any supported destination chain

### User Data Retrieval
- `getSupplyBalance()` - Get a user's supply balance for an asset
- `getBorrowBalance()` - Get a user's borrow balance for an asset
- `getHealthFactor()` - Calculate a user's health factor
- `getTotalCollateralValue()` - Calculate a user's total collateral value
- `getTotalDebtValue()` - Calculate a user's total debt value
- `getCollateralValue()` - Calculate a user's collateral value for a specific asset
- `getDebtValue()` - Calculate a user's debt value for a specific asset
- `canBorrow()` - Check if a user can borrow a specific amount
- `canWithdraw()` - Check if a user can withdraw a specific amount
- `isLiquidatable()` - Check if a user's position is liquidatable
- `maxAvailableBorrows()` - Calculate the maximum amount a user can borrow of a specific asset
- `maxAvailableBorrowsInUsd()` - Calculate the maximum USD value a user can borrow
- `maxAvailableAmount()` - Get the maximum available amount of an asset in the protocol

### Gateway Integration (Universal Contract Interface)
- `onCall()` - Handle incoming cross-chain calls from ZetaChain Gateway
  - Processes messages from external chains (Arbitrum Sepolia, Ethereum Sepolia)
  - Validates source chain is allowed for deposits
  - Supports supply and repay operations from other chains
  - Decodes cross-chain messages for proper operation routing
  - Implements proper authentication to prevent unauthorized calls
- `onRevert()` - Handle reverted cross-chain operations
  - Processes reverted cross-chain transactions
  - Implements proper rollback mechanisms
  - Emits appropriate events for transaction tracking and debugging

### Administrative Functions
- `addAsset()` - Add a new supported ZRC-20 asset with configuration
- `updatePrice()` - Update the price of an existing asset (administrative function)
- `setPriceOracle()` - Update the external price oracle address (UniversalLendingProtocol)
- `setAllowedSourceChain()` - Configure which chains are allowed for cross-chain deposits (UniversalLendingProtocol)
- `mapZRC20Asset()` - Map ZRC-20 assets to their source chain and symbol (UniversalLendingProtocol)

## Deployment Architecture

The protocol uses a multi-chain deployment architecture:

### ZetaChain Athens Testnet (7001)
- **UniversalLendingProtocol** - Advanced lending protocol with modular libraries, dynamic rates and enhanced cross-chain features
- **PriceOracle** - External price oracle integration for real-time asset pricing

### External Chains (Cross-Chain Deposits)
- **Arbitrum Sepolia (421614)** - DepositContract for ETH and USDC deposits
- **Ethereum Sepolia (11155111)** - DepositContract for ETH and USDC deposits

### Supported Assets
- **ETH.ARBI** - ZRC-20 representation of Arbitrum ETH
- **USDC.ARBI** - ZRC-20 representation of Arbitrum USDC
- **ETH.ETH** - ZRC-20 representation of Ethereum ETH  
- **USDC.ETH** - ZRC-20 representation of Ethereum USDC

## Testing Coverage

The protocol has comprehensive test coverage with **277 tests across 8 test suites** achieving 100% success rate. For detailed test documentation and coverage information, see [test/README.md](../test/README.md).

All contract addresses are automatically managed in `contracts.json` during deployment.