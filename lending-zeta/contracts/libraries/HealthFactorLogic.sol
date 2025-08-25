// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import "./CoreCalculations.sol";
import "./UserAssetCalculations.sol";
import "../interfaces/IPriceOracle.sol";
import "../interfaces/IUniversalLendingProtocol.sol";

/**
 * @title HealthFactorLogic
 * @author ZetaChain Cross-Chain Lending Protocol
 * @notice Library containing health factor calculation and position validation logic
 * @dev Consolidates health factor calculations to eliminate code duplication
 *      Provides simulation capabilities for borrowing/withdrawal validation
 *      All calculations use 1e18 precision for accurate financial computations
 */
library HealthFactorLogic {
    using CoreCalculations for uint256;
    using UserAssetCalculations for *;

    /// @dev Precision constant for percentage calculations (1e18 = 100%)
    uint256 private constant PRECISION = 1e18;

    /// @dev Minimum health factor required for borrowing operations (150% collateralization)
    uint256 private constant MINIMUM_HEALTH_FACTOR = 1.5e18;

    /// @dev Liquidation threshold - positions below 120% collateralization can be liquidated
    uint256 private constant LIQUIDATION_THRESHOLD = 1.2e18;

    /// @dev Maximum health factor value to represent infinite health (no debt)
    uint256 private constant MAX_HEALTH_FACTOR = type(uint256).max;

    /**
     * @notice Calculates the current health factor for a user
     * @dev Health factor = (totalWeightedCollateral) / totalDebtValue
     *      Uses liquidation thresholds as weights for collateral value
     *      Returns MAX_HEALTH_FACTOR if user has no debt
     * @param user The user address to calculate health factor for
     * @param supportedAssets Array of all supported asset addresses
     * @param userSupplies Mapping of user supplies from main contract
     * @param userBorrows Mapping of user borrows from main contract
     * @param enhancedAssets Mapping of asset configurations from main contract
     * @param priceOracle Price oracle contract for asset pricing
     * @return healthFactor The current health factor (in 1e18 precision)
     */
    function calculateHealthFactor(
        address user,
        address[] storage supportedAssets,
        mapping(address => mapping(address => uint256)) storage userSupplies,
        mapping(address => mapping(address => uint256)) storage userBorrows,
        mapping(address => IUniversalLendingProtocol.AssetConfig) storage enhancedAssets,
        IPriceOracle priceOracle
    ) internal view returns (uint256 healthFactor) {
        // Use consolidated calculation helper to avoid code duplication
        UserAssetCalculations.UserAssetData memory assetData = UserAssetCalculations
            .calculateUserAssetData(
                user,
                address(0), // No asset modification for current calculation
                0, // No modified supply balance
                0, // No modified debt balance
                false, // Not using modifications
                supportedAssets,
                userSupplies,
                userBorrows,
                enhancedAssets,
                priceOracle
            );

        // Return max health factor if no debt exists
        if (assetData.totalDebtValue == 0) {
            return MAX_HEALTH_FACTOR;
        }

        // Calculate health factor: weighted collateral / total debt
        healthFactor = (assetData.totalWeightedCollateral * PRECISION) / assetData.totalDebtValue;
    }

    /**
     * @notice Calculates health factor after a potential modification to user's position
     * @dev Simulates position changes without actually modifying state
     *      Used for validating borrow/withdraw operations before execution
     * @param user The user address
     * @param modifiedAsset The asset being modified (supplied, borrowed, withdrawn, repaid)
     * @param newSupplyBalance New supply balance for the modified asset
     * @param newDebtBalance New debt balance for the modified asset
     * @param supportedAssets Array of all supported asset addresses
     * @param userSupplies Mapping of user supplies from main contract
     * @param userBorrows Mapping of user borrows from main contract
     * @param enhancedAssets Mapping of asset configurations from main contract
     * @param priceOracle Price oracle contract for asset pricing
     * @return newHealthFactor The health factor after the proposed modification
     */
    function calculateHealthFactorWithModification(
        address user,
        address modifiedAsset,
        uint256 newSupplyBalance,
        uint256 newDebtBalance,
        address[] storage supportedAssets,
        mapping(address => mapping(address => uint256)) storage userSupplies,
        mapping(address => mapping(address => uint256)) storage userBorrows,
        mapping(address => IUniversalLendingProtocol.AssetConfig) storage enhancedAssets,
        IPriceOracle priceOracle
    ) internal view returns (uint256 newHealthFactor) {
        // Use consolidated calculation helper with modifications
        UserAssetCalculations.UserAssetData memory assetData = UserAssetCalculations
            .calculateUserAssetData(
                user,
                modifiedAsset,
                newSupplyBalance,
                newDebtBalance,
                true, // Using modifications
                supportedAssets,
                userSupplies,
                userBorrows,
                enhancedAssets,
                priceOracle
            );

        // Return max health factor if no debt exists after modification
        if (assetData.totalDebtValue == 0) {
            return MAX_HEALTH_FACTOR;
        }

        // Calculate health factor with modifications
        newHealthFactor = (assetData.totalWeightedCollateral * PRECISION) / assetData.totalDebtValue;
    }

    /**
     * @notice Validates if a user can borrow a specific amount of an asset
     * @dev Checks if borrowing would maintain health factor above minimum threshold
     *      Also verifies contract has sufficient balance for the borrow
     * @param user The user requesting to borrow
     * @param asset The asset to borrow
     * @param amount The amount to borrow (in asset's native decimals)
     * @param contractBalance Current balance of the asset in the contract
     * @param supportedAssets Array of all supported asset addresses
     * @param userSupplies Mapping of user supplies from main contract
     * @param userBorrows Mapping of user borrows from main contract
     * @param enhancedAssets Mapping of asset configurations from main contract
     * @param priceOracle Price oracle contract for asset pricing
     * @return canBorrowResult True if the borrow is allowed, false otherwise
     */
    function canBorrow(
        address user,
        address asset,
        uint256 amount,
        uint256 contractBalance,
        address[] storage supportedAssets,
        mapping(address => mapping(address => uint256)) storage userSupplies,
        mapping(address => mapping(address => uint256)) storage userBorrows,
        mapping(address => IUniversalLendingProtocol.AssetConfig) storage enhancedAssets,
        IPriceOracle priceOracle
    ) internal view returns (bool canBorrowResult) {
        // Check if asset is supported
        if (!enhancedAssets[asset].isSupported) {
            return false;
        }

        // Check if contract has sufficient balance
        if (contractBalance < amount) {
            return false;
        }

        // Calculate new debt balance after borrow
        uint256 currentDebt = userBorrows[user][asset];
        uint256 newDebtBalance = currentDebt + amount;

        // Calculate health factor after the proposed borrow
        uint256 healthFactor = calculateHealthFactorWithModification(
            user,
            asset,
            userSupplies[user][asset], // Supply balance unchanged
            newDebtBalance, // New debt balance
            supportedAssets,
            userSupplies,
            userBorrows,
            enhancedAssets,
            priceOracle
        );

        // Allow borrow if health factor remains above minimum threshold
        return healthFactor >= MINIMUM_HEALTH_FACTOR;
    }

    /**
     * @notice Validates if a user can withdraw a specific amount of an asset
     * @dev Checks if withdrawal would maintain health factor above minimum threshold
     *      Also verifies contract has sufficient balance for the withdrawal
     * @param user The user requesting to withdraw
     * @param asset The asset to withdraw
     * @param amount The amount to withdraw (in asset's native decimals)
     * @param contractBalance Current balance of the asset in the contract
     * @param supportedAssets Array of all supported asset addresses
     * @param userSupplies Mapping of user supplies from main contract
     * @param userBorrows Mapping of user borrows from main contract
     * @param enhancedAssets Mapping of asset configurations from main contract
     * @param priceOracle Price oracle contract for asset pricing
     * @return canWithdrawResult True if the withdrawal is allowed, false otherwise
     */
    function canWithdraw(
        address user,
        address asset,
        uint256 amount,
        uint256 contractBalance,
        address[] storage supportedAssets,
        mapping(address => mapping(address => uint256)) storage userSupplies,
        mapping(address => mapping(address => uint256)) storage userBorrows,
        mapping(address => IUniversalLendingProtocol.AssetConfig) storage enhancedAssets,
        IPriceOracle priceOracle
    ) internal view returns (bool canWithdrawResult) {
        // Check if asset is supported
        if (!enhancedAssets[asset].isSupported) {
            return false;
        }

        // Check if user has sufficient supply balance
        uint256 userSupply = userSupplies[user][asset];
        if (userSupply < amount) {
            return false;
        }

        // Check if contract has sufficient balance
        if (contractBalance < amount) {
            return false;
        }

        // If user has no debt, allow withdrawal
        UserAssetCalculations.UserAssetData memory currentData = UserAssetCalculations
            .calculateUserAssetData(
                user,
                address(0),
                0,
                0,
                false,
                supportedAssets,
                userSupplies,
                userBorrows,
                enhancedAssets,
                priceOracle
            );

        if (currentData.totalDebtValue == 0) {
            return true;
        }

        // Calculate new supply balance after withdrawal
        uint256 newSupplyBalance = userSupply - amount;

        // Calculate health factor after the proposed withdrawal
        uint256 healthFactor = calculateHealthFactorWithModification(
            user,
            asset,
            newSupplyBalance, // New supply balance
            userBorrows[user][asset], // Debt balance unchanged
            supportedAssets,
            userSupplies,
            userBorrows,
            enhancedAssets,
            priceOracle
        );

        // Allow withdrawal if health factor remains above minimum threshold
        return healthFactor >= MINIMUM_HEALTH_FACTOR;
    }

    /**
     * @notice Validates if a position is eligible for liquidation
     * @dev A position can be liquidated if health factor falls below liquidation threshold
     *      Also checks that the user has actual debt to liquidate
     * @param user The user whose position to check
     * @param supportedAssets Array of all supported asset addresses
     * @param userSupplies Mapping of user supplies from main contract
     * @param userBorrows Mapping of user borrows from main contract
     * @param enhancedAssets Mapping of asset configurations from main contract
     * @param priceOracle Price oracle contract for asset pricing
     * @return isLiquidatableResult True if the position can be liquidated
     */
    function isLiquidatable(
        address user,
        address[] storage supportedAssets,
        mapping(address => mapping(address => uint256)) storage userSupplies,
        mapping(address => mapping(address => uint256)) storage userBorrows,
        mapping(address => IUniversalLendingProtocol.AssetConfig) storage enhancedAssets,
        IPriceOracle priceOracle
    ) internal view returns (bool isLiquidatableResult) {
        uint256 healthFactor = calculateHealthFactor(
            user,
            supportedAssets,
            userSupplies,
            userBorrows,
            enhancedAssets,
            priceOracle
        );

        // Position is liquidatable if health factor is below threshold and not infinite
        return healthFactor < LIQUIDATION_THRESHOLD && healthFactor != MAX_HEALTH_FACTOR;
    }

    /**
     * @notice Calculates the maximum USD value a user can borrow while maintaining minimum health factor
     * @dev Uses collateral factors to determine borrowing capacity
     *      Formula: maxBorrow = (totalBorrowableCollateral / minimumHealthFactor) - currentDebt
     * @param user The user address
     * @param supportedAssets Array of all supported asset addresses
     * @param userSupplies Mapping of user supplies from main contract
     * @param userBorrows Mapping of user borrows from main contract
     * @param enhancedAssets Mapping of asset configurations from main contract
     * @param priceOracle Price oracle contract for asset pricing
     * @return maxBorrowUsd Maximum borrowable USD value (in 1e18 precision)
     */
    function getMaxBorrowableUsd(
        address user,
        address[] storage supportedAssets,
        mapping(address => mapping(address => uint256)) storage userSupplies,
        mapping(address => mapping(address => uint256)) storage userBorrows,
        mapping(address => IUniversalLendingProtocol.AssetConfig) storage enhancedAssets,
        IPriceOracle priceOracle
    ) internal view returns (uint256 maxBorrowUsd) {
        UserAssetCalculations.UserAssetData memory assetData = UserAssetCalculations
            .calculateUserAssetData(
                user,
                address(0),
                0,
                0,
                false,
                supportedAssets,
                userSupplies,
                userBorrows,
                enhancedAssets,
                priceOracle
            );

        if (assetData.totalBorrowableCollateral == 0) {
            return 0;
        }

        // Calculate maximum total debt allowed while maintaining minimum health factor
        uint256 maxTotalDebt = (assetData.totalBorrowableCollateral * PRECISION) / MINIMUM_HEALTH_FACTOR;

        // Subtract current debt to get additional borrowing capacity
        if (maxTotalDebt <= assetData.totalDebtValue) {
            return 0;
        }

        maxBorrowUsd = maxTotalDebt - assetData.totalDebtValue;
    }

    /**
     * @notice Calculates the maximum amount of a specific asset a user can borrow
     * @dev Converts USD borrowing capacity to specific asset amount
     * @param user The user address
     * @param asset The asset to borrow
     * @param contractBalance Current balance of the asset in the contract
     * @param supportedAssets Array of all supported asset addresses
     * @param userSupplies Mapping of user supplies from main contract
     * @param userBorrows Mapping of user borrows from main contract
     * @param enhancedAssets Mapping of asset configurations from main contract
     * @param priceOracle Price oracle contract for asset pricing
     * @return maxBorrowAmount Maximum borrowable amount in asset's native decimals
     */
    function getMaxBorrowableAmount(
        address user,
        address asset,
        uint256 contractBalance,
        address[] storage supportedAssets,
        mapping(address => mapping(address => uint256)) storage userSupplies,
        mapping(address => mapping(address => uint256)) storage userBorrows,
        mapping(address => IUniversalLendingProtocol.AssetConfig) storage enhancedAssets,
        IPriceOracle priceOracle
    ) internal view returns (uint256 maxBorrowAmount) {
        // Check if asset is supported
        if (!enhancedAssets[asset].isSupported) {
            return 0;
        }

        // Get maximum borrowable USD value
        uint256 maxBorrowUsd = getMaxBorrowableUsd(
            user,
            supportedAssets,
            userSupplies,
            userBorrows,
            enhancedAssets,
            priceOracle
        );

        if (maxBorrowUsd == 0) {
            return 0;
        }

        // Get validated asset price
        uint256 assetPrice = priceOracle.getPrice(asset);
        require(CoreCalculations.validatePrice(assetPrice), "HealthFactorLogic: invalid asset price");

        // Convert USD value to asset amount
        uint256 maxBorrowAssetAmount = CoreCalculations.calculateAssetAmountFromValue(
            maxBorrowUsd,
            asset,
            assetPrice
        );

        // Limit by contract's available balance
        maxBorrowAmount = maxBorrowAssetAmount > contractBalance ? contractBalance : maxBorrowAssetAmount;
    }

    /**
     * @notice Validates that a health factor improvement is sufficient after liquidation
     * @dev Ensures liquidation moves user back to a healthy position
     *      Prevents partial liquidations that leave user still at risk
     * @param oldHealthFactor Health factor before liquidation
     * @param newHealthFactor Health factor after liquidation
     * @return isImproved True if health factor improvement is sufficient
     */
    function validateHealthFactorImprovement(
        uint256 oldHealthFactor,
        uint256 newHealthFactor
    ) internal pure returns (bool isImproved) {
        // Health factor must improve and reach minimum threshold
        isImproved = newHealthFactor > oldHealthFactor && newHealthFactor >= MINIMUM_HEALTH_FACTOR;
    }

    /**
     * @notice Gets the health factor status category for user interface
     * @dev Categorizes health factors into risk levels for better user experience
     * @param healthFactor The current health factor
     * @return status Risk status: 0=Healthy, 1=Risky, 2=Liquidatable, 3=No Debt
     */
    function getHealthFactorStatus(uint256 healthFactor) internal pure returns (uint8 status) {
        if (healthFactor == MAX_HEALTH_FACTOR) {
            return 3; // No debt - infinite health
        } else if (healthFactor >= MINIMUM_HEALTH_FACTOR) {
            return 0; // Healthy - above minimum required
        } else if (healthFactor >= LIQUIDATION_THRESHOLD) {
            return 1; // Risky - between liquidation threshold and minimum
        } else {
            return 2; // Liquidatable - below liquidation threshold
        }
    }

    /**
     * @notice Calculates the health factor improvement needed to reach minimum threshold
     * @dev Useful for UI to show users how much they need to repay or supply
     * @param currentHealthFactor The current health factor
     * @param totalDebtValue Current total debt value
     * @return improvementNeeded USD value needed to reach minimum health factor
     */
    function getHealthFactorImprovementNeeded(
        uint256 currentHealthFactor,
        uint256 totalDebtValue
    ) internal pure returns (uint256 improvementNeeded) {
        if (currentHealthFactor >= MINIMUM_HEALTH_FACTOR || totalDebtValue == 0) {
            return 0;
        }

        // Calculate additional collateral value needed
        // Formula: neededCollateral = (totalDebt * minHealthFactor) - currentCollateral
        // Since currentCollateral = (currentHealthFactor * totalDebt) / PRECISION
        uint256 currentWeightedCollateral = (currentHealthFactor * totalDebtValue) / PRECISION;
        uint256 neededWeightedCollateral = (MINIMUM_HEALTH_FACTOR * totalDebtValue) / PRECISION;

        improvementNeeded = neededWeightedCollateral - currentWeightedCollateral;
    }
}