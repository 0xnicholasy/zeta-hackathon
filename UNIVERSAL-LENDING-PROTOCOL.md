# Universal Lending Protocol Detailed Explanation

## Overview

The Universal Lending Protocol is an advanced cross-chain lending protocol built on ZetaChain that extends the functionality of the Simple Lending Protocol. It introduces sophisticated features like dynamic interest rate calculations, enhanced health factor computations, and cross-chain transaction fee handling.

## Core Components

### 1. Protocol Architecture

The protocol consists of several key contracts:

1. **SimpleLendingProtocolBase.sol** - Base implementation with core lending functionality
2. **SimpleLendingProtocol.sol** - Extends base with cross-chain capabilities
3. **UniversalLendingProtocol.sol** - Enhanced version with advanced features
4. **InterestRateModel.sol** - Library for calculating dynamic interest rates
5. **LiquidationLogic.sol** - Library for liquidation calculations
6. **PriceOracle.sol** - Oracle for asset price feeds

## Key Features

### 1. Cross-Chain Transaction Fee Calculation

Cross-chain transactions in the Universal Lending Protocol involve gas fees that are handled in a specific way:

1. **Gas Fee Retrieval**: Each ZRC-20 token has an associated gas fee that is retrieved using `IZRC20(asset).withdrawGasFee()`. This returns:
   - `gasZRC20`: The ZRC-20 token used for gas payment
   - `gasFee`: The amount of gas tokens required

2. **Fee Deduction**: When a user initiates a cross-chain withdrawal or borrow:
   - If the asset being transferred is the same as the gas token, the gas fee is deducted from the withdrawal amount
   - If they're different, the gas fee is collected separately from the user's balance

3. **Fee Validation**: The protocol ensures that the withdrawal amount is sufficient to cover gas fees using `_validateAmountVsGasFee()` function.

4. **Fee Transfer**: Gas fees are transferred from the user to the protocol contract before initiating the cross-chain transaction.

### 2. Health Factor Changes

The health factor is a critical metric that determines a user's position health:

1. **Calculation Formula**:
   ```
   Health Factor = (Total Weighted Collateral Value) / (Total Debt Value)
   ```

2. **Weighted Collateral**: Unlike simple collateral value, the protocol uses a weighted value based on each asset's liquidation threshold:
   ```
   Weighted Collateral = Σ(Collateral Value * Liquidation Threshold)
   ```

3. **Thresholds**:
   - **Minimum Health Factor**: 1.5 (150%) - Required for borrowing/withdrawing
   - **Liquidation Threshold**: 1.2 (120%) - Below this, position can be liquidated

4. **Dynamic Updates**: The health factor changes in real-time as:
   - Prices of assets fluctuate (through the price oracle)
   - Users supply/borrow/repay/withdraw assets
   - Interest accrues on borrowed amounts

### 3. Interest Rate Adjustments

The protocol implements a dynamic interest rate model:

1. **Borrow Interest Rate**:
   - Uses a kinked model with two slopes based on utilization rate
   - Formula when utilization ≤ optimal (80%):
     ```
     Borrow Rate = Base Rate + (Utilization Rate * Slope1)
     ```
   - Formula when utilization > optimal:
     ```
     Borrow Rate = Base Rate + Slope1 + ((Utilization - Optimal) * Slope2)
     ```

2. **Supply Interest Rate**:
   ```
   Supply Rate = Borrow Rate * Utilization Rate * (1 - Reserve Factor)
   ```

3. **Parameters**:
   - Base Rate: 2% annually
   - Slope1: 4% (up to optimal utilization)
   - Slope2: 75% (beyond optimal utilization)
   - Optimal Utilization: 80%
   - Reserve Factor: 10%

4. **Interest Accrual**:
   - Interest is compounded over time using a Taylor series approximation
   - Applied to total borrowed amounts periodically during transactions
   - Part of the interest (10%) goes to protocol reserves

### 4. Liquidation Examples

Liquidations occur when a user's health factor drops below 1.2 (120%). Here's how they work:

#### Example 1: Simple Liquidation

1. **User Position**:
   - Supplied: 1000 USDC ($1000)
   - Borrowed: 600 DAI ($600)
   - Health Factor: 1.18 (below threshold)

2. **Liquidation Process**:
   - Liquidator repays 300 DAI debt
   - Protocol calculates collateral to seize:
     ```
     Collateral Amount = (Debt Repaid * Debt Price / Collateral Price) * (1 + Liquidation Bonus)
     Collateral Amount = (300 * 1 / 1) * (1 + 0.05) = 315 USDC
     ```
   - Liquidator receives 315 USDC for repaying 300 DAI

#### Example 2: Partial Liquidation

1. **User Position**:
   - Supplied: 2000 USDC ($2000)
   - Borrowed: 1500 DAI ($1500)
   - Health Factor: 1.15

2. **Liquidation Process**:
   - Liquidator can repay up to 50% of the debt (protocol limit)
   - Repays 750 DAI
   - Seizes:
     ```
     Collateral Amount = (750 * 1 / 1) * (1 + 0.05) = 787.5 USDC
     ```
   - User's new position:
     - Supplied: 1212.5 USDC
     - Borrowed: 750 DAI
     - Health Factor: ~1.35 (above threshold)

## Cross-Chain Functionality

The protocol supports cross-chain operations through ZetaChain's universal contracts:

1. **Cross-Chain Supply**: Users can supply assets from any connected chain
2. **Cross-Chain Borrow**: Users can borrow assets and receive them on any chain
3. **Cross-Chain Withdrawal**: Users can withdraw supplied assets to any chain
4. **Cross-Chain Repayment**: Users can repay debts from any chain

All cross-chain operations are handled through the `onCall` function which processes messages from the ZetaChain gateway.

## Security Features

1. **Price Validation**: Prices are validated for staleness (max 1 hour old)
2. **Reentrancy Protection**: All state-changing functions are protected
3. **Access Control**: Admin functions are restricted to owner
4. **Health Factor Checks**: All borrowing/withdrawal operations validate health factor
5. **Liquidation Thresholds**: Conservative thresholds prevent undercollateralization

## Reserve Management

10% of all interest goes to protocol reserves:
- Used for covering bad debts
- Can be withdrawn by the protocol owner
- Helps maintain protocol solvency during market volatility

## Conclusion

The Universal Lending Protocol provides a robust, secure, and efficient cross-chain lending solution with sophisticated risk management features. Its dynamic interest rate model, comprehensive health factor calculations, and proper liquidation mechanics make it suitable for professional DeFi applications.