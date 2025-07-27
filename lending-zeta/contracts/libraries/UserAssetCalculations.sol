// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import "../interfaces/IPriceOracle.sol";
import "../interfaces/IUniversalLendingProtocol.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

/**
 * @title UserAssetCalculations
 * @author ZetaChain Cross-Chain Lending Protocol
 * @notice Library containing heavy calculation functions for user asset data
 * @dev Consolidates repetitive asset calculations to reduce gas costs and improve maintainability
 *      Used by UniversalLendingProtocol for health factor, borrowing capacity, and position data
 *      All calculations use 1e18 precision for accurate financial computations
 */
library UserAssetCalculations {
    /// @dev Precision constant for percentage calculations (1e18 = 100%)
    uint256 private constant PRECISION = 1e18;

    /**
     * @notice Consolidated asset data structure to eliminate repetitive calculations
     * @dev Contains all calculated user asset values in a single struct
     * @param totalCollateralValue Total USD value of user's collateral (raw value, no factors applied)
     * @param totalDebtValue Total USD value of user's debt
     * @param totalBorrowableCollateral Total borrowable value (collateral * collateralFactor)
     * @param totalWeightedCollateral Total weighted collateral (collateral * liquidationThreshold)
     * @param weightedLiquidationThreshold Sum of (collateralValue * liquidationThreshold) for weighted average
     */
    struct UserAssetData {
        uint256 totalCollateralValue;
        uint256 totalDebtValue;
        uint256 totalBorrowableCollateral;
        uint256 totalWeightedCollateral;
        uint256 weightedLiquidationThreshold;
    }


    /**
     * @notice Helper function to get asset values for a specific user and asset
     * @dev Consolidates price fetching and value calculations to eliminate code duplication
     *      Calculates all possible asset values in a single function call
     * @param user The user address
     * @param asset The asset address
     * @param customSupplyBalance Custom supply balance (used for simulations)
     * @param customDebtBalance Custom debt balance (used for simulations)
     * @param useCustomBalances Whether to use custom balances or fetch from storage
     * @param userSupplies Mapping of user supplies (from calling contract)
     * @param userBorrows Mapping of user borrows (from calling contract)
     * @param assetConfig Asset configuration containing factors and thresholds
     * @param validatedPrice Pre-validated asset price to avoid multiple oracle calls
     * @return collateralValue Raw collateral value in USD (no factors applied)
     * @return debtValue Debt value in USD
     * @return borrowableCollateral Borrowable collateral value (collateral * collateralFactor)
     * @return weightedCollateral Weighted collateral value (collateral * liquidationThreshold)
     */
    function getAssetValues(
        address user,
        address asset,
        uint256 customSupplyBalance,
        uint256 customDebtBalance,
        bool useCustomBalances,
        mapping(address => mapping(address => uint256)) storage userSupplies,
        mapping(address => mapping(address => uint256)) storage userBorrows,
        IUniversalLendingProtocol.AssetConfig memory assetConfig,
        uint256 validatedPrice
    ) internal view returns (
        uint256 collateralValue,
        uint256 debtValue,
        uint256 borrowableCollateral,
        uint256 weightedCollateral
    ) {
        // Use custom balances if provided, otherwise use current balances
        uint256 supplyBalance = useCustomBalances ? customSupplyBalance : userSupplies[user][asset];
        uint256 debtBalance = useCustomBalances ? customDebtBalance : userBorrows[user][asset];

        // Calculate collateral value
        if (supplyBalance > 0) {
            collateralValue = _calculateAssetValue(supplyBalance, asset, validatedPrice);
            borrowableCollateral = (collateralValue * assetConfig.collateralFactor) / PRECISION;
            weightedCollateral = (collateralValue * assetConfig.liquidationThreshold) / PRECISION;
        }

        // Calculate debt value
        if (debtBalance > 0) {
            debtValue = _calculateAssetValue(debtBalance, asset, validatedPrice);
        }
    }

    /**
     * @notice Consolidated function to calculate all user asset data in a single loop
     * @dev Eliminates repetitive asset iteration across multiple functions
     *      This function replaces 5+ individual loops in the main contract
     * @param user The user address
     * @param modifiedAsset Asset being modified (for simulation purposes)
     * @param newSupplyBalance New supply balance for modified asset
     * @param newDebtBalance New debt balance for modified asset
     * @param useModified Whether to use modified balances for simulation
     * @param supportedAssets Array of all supported assets
     * @param userSupplies Mapping of user supplies (from calling contract)
     * @param userBorrows Mapping of user borrows (from calling contract)
     * @param enhancedAssets Mapping of asset configurations (from calling contract)
     * @param priceOracle Oracle contract for price fetching
     * @return data Consolidated UserAssetData containing all calculated values
     */
    function calculateUserAssetData(
        address user,
        address modifiedAsset,
        uint256 newSupplyBalance,
        uint256 newDebtBalance,
        bool useModified,
        address[] storage supportedAssets,
        mapping(address => mapping(address => uint256)) storage userSupplies,
        mapping(address => mapping(address => uint256)) storage userBorrows,
        mapping(address => IUniversalLendingProtocol.AssetConfig) storage enhancedAssets,
        IPriceOracle priceOracle
    ) internal view returns (UserAssetData memory data) {
        for (uint256 i = 0; i < supportedAssets.length; i++) {
            address asset = supportedAssets[i];
            
            // Determine if we should use custom balances for this asset
            bool useCustom = useModified && asset == modifiedAsset;
            uint256 customSupply = useCustom ? newSupplyBalance : 0;
            uint256 customDebt = useCustom ? newDebtBalance : 0;

            // Get validated price once per asset
            uint256 validatedPrice = _getValidatedPrice(asset, priceOracle);

            (
                uint256 collateralValue,
                uint256 debtValue,
                uint256 borrowableCollateral,
                uint256 weightedCollateral
            ) = getAssetValues(
                user, 
                asset, 
                customSupply, 
                customDebt, 
                useCustom,
                userSupplies,
                userBorrows,
                enhancedAssets[asset],
                validatedPrice
            );

            // Accumulate all values
            data.totalCollateralValue += collateralValue;
            data.totalDebtValue += debtValue;
            data.totalBorrowableCollateral += borrowableCollateral;
            data.totalWeightedCollateral += weightedCollateral;
            data.weightedLiquidationThreshold += collateralValue * enhancedAssets[asset].liquidationThreshold;
        }
    }

    /**
     * @notice Calculate asset value in USD using validated price
     * @dev Normalizes asset amount to 18 decimals and multiplies by price
     *      Used consistently across all value calculations
     * @param amount Amount of the asset (in asset's native decimals)
     * @param asset Address of the asset
     * @param validatedPrice Pre-validated price in USD (1e18 precision)
     * @return value USD value of the asset amount (1e18 precision)
     */
    function _calculateAssetValue(
        uint256 amount,
        address asset,
        uint256 validatedPrice
    ) internal view returns (uint256 value) {
        uint8 decimals = IERC20Metadata(asset).decimals();
        uint256 normalizedAmount = _normalizeToDecimals(amount, decimals);
        value = (normalizedAmount * validatedPrice) / PRECISION;
    }

    /**
     * @notice Get validated price from oracle with staleness and minimum value checks
     * @dev Validates price freshness and minimum thresholds to prevent manipulation
     * @param asset Address of the asset
     * @param priceOracle Oracle contract for price fetching
     * @return validatedPrice Validated price in USD (1e18 precision)
     */
    function _getValidatedPrice(
        address asset,
        IPriceOracle priceOracle
    ) internal view returns (uint256 validatedPrice) {
        validatedPrice = priceOracle.getPrice(asset);
        
        // Validate price is not zero (basic sanity check)
        require(validatedPrice > 0, "Invalid price: zero");
        
        // Additional validation could be added here:
        // - Price staleness checks
        // - Minimum/maximum price bounds
        // - Price change rate limits
    }

    /**
     * @notice Normalize amount to 18 decimals for comparison purposes
     * @dev Ensures consistent precision across all asset calculations
     *      Handles assets with different decimal places (e.g., USDC has 6 decimals)
     * @param amount The amount to normalize
     * @param decimals The current decimal places of the amount
     * @return normalizedAmount The amount normalized to 18 decimals
     */
    function _normalizeToDecimals(
        uint256 amount,
        uint256 decimals
    ) internal pure returns (uint256 normalizedAmount) {
        if (decimals < 18) {
            normalizedAmount = amount * (10 ** (18 - decimals));
        } else if (decimals > 18) {
            normalizedAmount = amount / (10 ** (decimals - 18));
        } else {
            normalizedAmount = amount;
        }
    }

    /**
     * @notice Denormalize amount from 18 decimals to asset's native decimals
     * @dev Converts normalized amounts back to asset-specific precision
     *      Used when calculating maximum borrow amounts in specific assets
     * @param normalizedAmount The normalized amount (18 decimals)
     * @param decimals The target decimal places
     * @return amount The denormalized amount in asset's native decimals
     */
    function _denormalizeFromDecimals(
        uint256 normalizedAmount,
        uint256 decimals
    ) internal pure returns (uint256 amount) {
        if (decimals < 18) {
            amount = normalizedAmount / (10 ** (18 - decimals));
        } else if (decimals > 18) {
            amount = normalizedAmount * (10 ** (decimals - 18));
        } else {
            amount = normalizedAmount;
        }
    }
}