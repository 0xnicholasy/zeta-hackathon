# Lending Protocol Contracts

This directory contains the smart contracts for the ZetaChain lending protocol, including both SimpleLendingProtocol and UniversalLendingProtocol implementations.

## Contract Structure

### Core Contracts

1. **SimpleLendingProtocol.sol** - Basic lending protocol implementation with fixed interest rates
2. **UniversalLendingProtocol.sol** - Enhanced lending protocol with dynamic interest rates and advanced features
3. **SimpleLendingProtocolBase.sol** - Base contract with shared functionality
4. **DepositContract.sol** - Handles cross-chain deposits
5. **PriceOracle.sol** - Price oracle for asset pricing
6. **Universal.sol** - Universal contract for cross-chain operations

### Interfaces

1. **ISimpleLendingProtocol.sol** - Interface for basic lending protocol
2. **IUniversalLendingProtocol.sol** - Interface for enhanced lending protocol
3. **IPriceOracle.sol** - Interface for price oracle
4. **IZRC20.sol** - Interface for ZRC20 tokens

### Libraries

1. **InterestRateModel.sol** - Interest rate calculation logic
2. **LiquidationLogic.sol** - Liquidation calculation logic

### Mocks

1. **MockPriceOracle.sol** - Mock price oracle for testing
2. **MockZRC20.sol** - Mock ZRC20 token for testing

## Key Differences

### SimpleLendingProtocol

- **Fixed Interest Rates**: Uses fixed interest rates with no dynamic adjustment based on utilization
- **Basic Asset Management**: Assets are added with a fixed price in USD
- **Simple Health Factor Calculation**: Health factor is calculated using fixed collateral factors
- **Fixed Price Model**: Asset prices are set manually by administrators
- **Basic Cross-Chain Support**: Supports cross-chain operations but with limited configuration options
- **No Reserve System**: Does not implement a reserve system for protocol revenue

### UniversalLendingProtocol

The UniversalLendingProtocol design is inspired by Aave's architecture, particularly in the following aspects:

- **Dynamic Interest Rates**: Implements a dynamic interest rate model that adjusts based on asset utilization:
  - Uses a two-slope model with different rates below and above optimal utilization (similar to Aave's rate model)
  - Calculates separate borrow and supply rates
  - Implements a reserve factor to capture protocol revenue from interest (similar to Aave's reserve system)
- **Enhanced Risk Management**: 
  - Uses configurable collateral factors for each asset (similar to Aave's collateral factor concept)
  - Implements liquidation thresholds for more precise risk assessment (similar to Aave's liquidation threshold)
  - Provides liquidation bonuses to liquidators (similar to Aave's liquidation bonus)
- **Cross-Chain Configuration Management**:
  - Allows administrators to specify which source chains are allowed for cross-chain operations
  - Maps ZRC20 assets to their source chain IDs and symbols
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
  - Handles cross-chain withdrawal through the gateway
  - Manages gas fees for cross-chain transactions
- `withdrawCrossChain()` - Withdraw supplied assets to another chain
  - Performs standard withdrawal validation
  - Handles cross-chain withdrawal through the gateway
  - Manages gas fees for cross-chain transactions

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

### Gateway Integration
- `onCall()` - Handle incoming cross-chain calls
  - Processes messages from other chains
  - Supports supply and repay operations from other chains
  - Supports borrow and withdraw operations initiated on other chains
- `onRevert()` - Handle reverted cross-chain operations
  - Processes reverted cross-chain transactions
  - Emits appropriate events for tracking

### Administrative Functions
- `addAsset()` - Add a new supported asset
- `updatePrice()` - Update the price of an existing asset

## Deployment

The contracts are deployed on ZetaChain testnet with supporting contracts on Arbitrum Sepolia and Ethereum Sepolia for cross-chain operations.