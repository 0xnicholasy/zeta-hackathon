// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import "../interfaces/IPriceOracle.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "./CoreCalculations.sol";

/**
 * @title LiquidationLogic
 * @author ZetaChain Cross-Chain Lending Protocol
 * @notice Library containing core liquidation logic for the lending protocol
 * @dev Implements health factor calculations, liquidation validation, and collateral seizure logic
 *      Uses overcollateralization requirements to ensure protocol solvency
 *      All calculations use 1e18 precision for accurate financial computations
 */
library LiquidationLogic {
    using CoreCalculations for uint256;
    /// @dev Precision constant for percentage calculations (1e18 = 100%)
    uint256 private constant PRECISION = 1e18;

    /// @dev Liquidation threshold - positions below 120% collateralization can be liquidated
    uint256 private constant LIQUIDATION_THRESHOLD = 1.2e18; // 120%

    /// @dev Minimum health factor required for borrowing operations (150% collateralization)
    uint256 private constant MINIMUM_HEALTH_FACTOR = 1.5e18; // 150%

    /**
     * @notice Parameters required for executing a liquidation
     * @dev Contains all necessary information for validating and executing liquidation
     * @param collateralAsset Address of the ZRC-20 collateral asset to seize
     * @param debtAsset Address of the ZRC-20 debt asset being repaid
     * @param user Address of the user being liquidated
     * @param debtToCover Amount of debt to repay (in debt asset units)
     * @param collateralAmount Amount of collateral to seize (in collateral asset units)
     * @param liquidationBonus Bonus percentage for liquidator (in PRECISION units, e.g., 0.05e18 = 5%)
     */
    struct LiquidationParams {
        address collateralAsset;
        address debtAsset;
        address user;
        uint256 debtToCover;
        uint256 collateralAmount;
        uint256 liquidationBonus;
    }

    /**
     * @notice Calculates the health factor for a user's position
     * @dev Health factor = (totalCollateralValue * liquidationThreshold) / totalDebtValue
     *      A health factor below 1.2 allows liquidation
     *      Returns max uint256 if user has no debt (infinite health)
     * @param totalCollateralValue USD value of user's total collateral (in 1e18 precision)
     * @param totalDebtValue USD value of user's total debt (in 1e18 precision)
     * @param currentLiquidationThreshold Weighted average liquidation threshold of collateral assets
     * @return healthFactor Current health factor (in 1e18 precision, e.g., 1.5e18 = 150%)
     */
    function calculateHealthFactor(
        uint256 totalCollateralValue,
        uint256 totalDebtValue,
        uint256 currentLiquidationThreshold
    ) internal pure returns (uint256) {
        
        if (totalDebtValue == 0) {
            return type(uint256).max;
        }

        uint256 numerator = totalCollateralValue * currentLiquidationThreshold;
        uint256 denominator = totalDebtValue;
        
        uint256 healthFactor = numerator / denominator;
        return healthFactor;
    }

    /**
     * @notice Calculates the USD value of collateral considering collateral factor
     * @dev Value = normalizedAmount * price * collateralFactor / PRECISION^2
     *      Collateral factor determines how much of the asset can be used as collateral
     *      Normalizes token amount to 18 decimals for consistent calculations
     * @param asset Address of the ZRC-20 collateral asset
     * @param amount Amount of the asset (in asset's native decimals)
     * @param collateralFactor Percentage of asset value that counts as collateral (in PRECISION)
     * @param oracle Price oracle contract for getting asset prices
     * @return collateralValue USD value of collateral (in 1e18 precision)
     */
    function calculateCollateralValue(
        address asset,
        uint256 amount,
        uint256 collateralFactor,
        IPriceOracle oracle
    ) internal view returns (uint256) {
        uint256 price = oracle.getPrice(asset);
        uint8 decimals = IERC20Metadata(asset).decimals();
        
        // Normalize amount to 18 decimals
        uint256 normalizedAmount = CoreCalculations.normalizeToDecimals(amount, decimals);
        
        uint256 result = (normalizedAmount * price * collateralFactor) / (PRECISION * PRECISION);
        return result;
    }

    /**
     * @notice Calculates the USD value of collateral using validated price
     * @dev Secure version that accepts pre-validated price to prevent stale price usage
     *      Value = normalizedAmount * validatedPrice * collateralFactor / PRECISION^2
     * @param asset Address of the ZRC-20 collateral asset
     * @param amount Amount of the asset (in asset's native decimals)
     * @param collateralFactor Percentage of asset value that counts as collateral (in PRECISION)
     * @param validatedPrice Pre-validated asset price (in 1e18 precision)
     * @return collateralValue USD value of collateral (in 1e18 precision)
     */
    function calculateCollateralValueWithPrice(
        address asset,
        uint256 amount,
        uint256 collateralFactor,
        uint256 validatedPrice
    ) internal view returns (uint256) {
        uint8 decimals = IERC20Metadata(asset).decimals();
        
        // Normalize amount to 18 decimals
        uint256 normalizedAmount = CoreCalculations.normalizeToDecimals(amount, decimals);
        
        uint256 result = (normalizedAmount * validatedPrice * collateralFactor) / (PRECISION * PRECISION);
        return result;
    }

    /**
     * @notice Calculates the USD value of debt
     * @dev Value = normalizedAmount * price / PRECISION
     *      Debt is always counted at full value (no discount applied)
     *      Normalizes token amount to 18 decimals for consistent calculations
     * @param asset Address of the ZRC-20 debt asset
     * @param amount Amount of debt (in asset's native decimals)
     * @param oracle Price oracle contract for getting asset prices
     * @return debtValue USD value of debt (in 1e18 precision)
     */
    function calculateDebtValue(
        address asset,
        uint256 amount,
        IPriceOracle oracle
    ) internal view returns (uint256) {
        uint256 price = oracle.getPrice(asset);
        uint8 decimals = IERC20Metadata(asset).decimals();
        
        // Normalize amount to 18 decimals
        uint256 normalizedAmount = CoreCalculations.normalizeToDecimals(amount, decimals);
        
        uint256 result = (normalizedAmount * price) / PRECISION;
        return result;
    }

    /**
     * @notice Calculates the USD value of debt using validated price
     * @dev Secure version that accepts pre-validated price to prevent stale price usage
     *      Value = normalizedAmount * validatedPrice / PRECISION
     * @param asset Address of the ZRC-20 debt asset
     * @param amount Amount of debt (in asset's native decimals)
     * @param validatedPrice Pre-validated asset price (in 1e18 precision)
     * @return debtValue USD value of debt (in 1e18 precision)
     */
    function calculateDebtValueWithPrice(
        address asset,
        uint256 amount,
        uint256 validatedPrice
    ) internal view returns (uint256) {
        uint8 decimals = IERC20Metadata(asset).decimals();
        
        // Normalize amount to 18 decimals
        uint256 normalizedAmount = CoreCalculations.normalizeToDecimals(amount, decimals);
        
        uint256 result = (normalizedAmount * validatedPrice) / PRECISION;
        return result;
    }

    /**
     * @notice Validates if a liquidation is allowed and properly configured
     * @dev Checks three conditions:
     *      1. Health factor is below liquidation threshold (120%)
     *      2. Debt to cover is greater than 0
     *      3. Debt to cover doesn't exceed user's total debt
     * @param healthFactor Current health factor of the user being liquidated
     * @param debtToCover Amount of debt the liquidator wants to repay
     * @param userDebt Total debt of the user being liquidated
     * @return isValid True if liquidation is allowed, false otherwise
     */
    function validateLiquidation(
        uint256 healthFactor,
        uint256 debtToCover,
        uint256 userDebt
    ) internal pure returns (bool) {
        return
            healthFactor < LIQUIDATION_THRESHOLD &&
            debtToCover > 0 &&
            debtToCover <= userDebt;
    }

    /**
     * @notice Calculates the amount of collateral to seize during liquidation
     * @dev Formula: collateralToSeize = (debtToCover * debtPrice / collateralPrice) * (1 + liquidationBonus)
     *      Liquidator receives a bonus for performing the liquidation service
     * @param debtToCover Amount of debt being repaid (in debt asset units)
     * @param debtPrice USD price of debt asset (in 1e18 precision)
     * @param collateralPrice USD price of collateral asset (in 1e18 precision)
     * @param liquidationBonus Bonus percentage for liquidator (in PRECISION units)
     * @return collateralAmount Amount of collateral to transfer to liquidator
     */
    function calculateLiquidationAmount(
        uint256 debtToCover,
        uint256 debtPrice,
        uint256 collateralPrice,
        uint256 liquidationBonus
    ) internal pure returns (uint256) {
        uint256 collateralAmount = (debtToCover * debtPrice) / collateralPrice;
        return
            collateralAmount +
            (collateralAmount * liquidationBonus) /
            PRECISION;
    }

    /**
     * @notice Calculates the amount of collateral to seize during liquidation with proper decimal handling
     * @dev Formula: collateralToSeize = (debtToCover * debtPrice / collateralPrice) * (1 + liquidationBonus)
     *      CRITICAL: Handles decimal differences between debt and collateral assets
     *      Example: ETH (18 decimals) debt vs SOL (9 decimals) collateral
     * @param debtToCover Amount of debt being repaid (in debt asset's native decimals)
     * @param debtPrice USD price of debt asset (in 1e18 precision)
     * @param collateralPrice USD price of collateral asset (in 1e18 precision)
     * @param liquidationBonus Bonus percentage for liquidator (in PRECISION units)
     * @param debtAsset Address of debt asset (for decimal handling)
     * @param collateralAsset Address of collateral asset (for decimal handling)
     * @return collateralAmount Amount of collateral to transfer to liquidator (in collateral asset's native decimals)
     */
    function calculateLiquidationAmount(
        uint256 debtToCover,
        uint256 debtPrice,
        uint256 collateralPrice,
        uint256 liquidationBonus,
        address debtAsset,
        address collateralAsset
    ) internal view returns (uint256) {
        // Get asset decimals
        uint8 debtDecimals = IERC20Metadata(debtAsset).decimals();
        uint8 collateralDecimals = IERC20Metadata(collateralAsset).decimals();
        
        // Normalize debt amount to 18 decimals for consistent calculation
        uint256 normalizedDebtToCover = CoreCalculations.normalizeToDecimals(debtToCover, debtDecimals);
        
        // Calculate collateral amount in normalized 18 decimal precision
        uint256 normalizedCollateralAmount = (normalizedDebtToCover * debtPrice) / collateralPrice;
        
        // Apply liquidation bonus
        uint256 normalizedCollateralWithBonus = normalizedCollateralAmount +
            (normalizedCollateralAmount * liquidationBonus) / PRECISION;
        
        // Denormalize to collateral asset's native decimals
        return CoreCalculations.denormalizeFromDecimals(normalizedCollateralWithBonus, collateralDecimals);
    }

    /**
     * @notice Validates that liquidation improves the user's health factor sufficiently
     * @dev Ensures liquidation moves user back to a healthy position above minimum threshold
     *      Prevents partial liquidations that leave user still at risk
     * @param oldHealthFactor Health factor before liquidation
     * @param newHealthFactor Health factor after liquidation
     * @return isImproved True if health factor improvement is sufficient
     */
    function validateHealthFactorImprovement(
        uint256 oldHealthFactor,
        uint256 newHealthFactor
    ) internal pure returns (bool) {
        return
            newHealthFactor > oldHealthFactor &&
            newHealthFactor >= MINIMUM_HEALTH_FACTOR;
    }

}
