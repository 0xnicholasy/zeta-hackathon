// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import "./CoreCalculations.sol";
import "./UserAssetCalculations.sol";
import "./HealthFactorLogic.sol";
import "../interfaces/IPriceOracle.sol";
import "../interfaces/IUniversalLendingProtocol.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title PositionManager
 * @author ZetaChain Cross-Chain Lending Protocol
 * @notice Library for managing user positions and aggregating position data
 * @dev Consolidates position-related calculations to eliminate code duplication
 *      Provides comprehensive position data for user interfaces and analytics
 *      All calculations use 1e18 precision for accurate financial computations
 */
library PositionManager {
    using CoreCalculations for uint256;
    using UserAssetCalculations for *;
    using HealthFactorLogic for *;

    /// @dev Precision constant for percentage calculations (1e18 = 100%)
    uint256 private constant PRECISION = 1e18;

    /// @dev Minimum health factor required for borrowing operations (150% collateralization)
    uint256 private constant MINIMUM_HEALTH_FACTOR = 1.5e18;

    /// @dev Liquidation health factor (120% collateralization)
    uint256 private constant LIQUIDATION_HEALTH_FACTOR = 1.2e18;

    /**
     * @notice Comprehensive user position data structure
     * @dev Contains all relevant information about a user's position
     * @param totalCollateralValue Total USD value of user's collateral
     * @param totalDebtValue Total USD value of user's debt
     * @param healthFactor Current health factor (1e18 = 100%)
     * @param maxBorrowUsdValue Maximum additional USD value that can be borrowed
     * @param liquidationThreshold Weighted average liquidation threshold
     * @param suppliedAssets Array of assets the user has supplied
     * @param suppliedAmounts Array of supplied amounts (in native asset decimals)
     * @param suppliedValues Array of supplied values in USD (1e18 precision)
     * @param borrowedAssets Array of assets the user has borrowed
     * @param borrowedAmounts Array of borrowed amounts (in native asset decimals)
     * @param borrowedValues Array of borrowed values in USD (1e18 precision)
     */
    struct UserPositionData {
        uint256 totalCollateralValue;
        uint256 totalDebtValue;
        uint256 healthFactor;
        uint256 maxBorrowUsdValue;
        uint256 liquidationThreshold;
        address[] suppliedAssets;
        uint256[] suppliedAmounts;
        uint256[] suppliedValues;
        address[] borrowedAssets;
        uint256[] borrowedAmounts;
        uint256[] borrowedValues;
    }

    /**
     * @notice Detailed asset position for a user
     * @dev Contains specific information about a user's position in one asset
     * @param asset Address of the asset
     * @param suppliedAmount Amount supplied by user (native asset decimals)
     * @param borrowedAmount Amount borrowed by user (native asset decimals)
     * @param suppliedValue USD value of supplied amount (1e18 precision)
     * @param borrowedValue USD value of borrowed amount (1e18 precision)
     * @param collateralValue Effective collateral value (after collateral factor)
     * @param maxBorrowableAmount Maximum amount user can borrow of this asset
     * @param maxWithdrawableAmount Maximum amount user can withdraw of this asset
     */
    struct AssetPosition {
        address asset;
        uint256 suppliedAmount;
        uint256 borrowedAmount;
        uint256 suppliedValue;
        uint256 borrowedValue;
        uint256 collateralValue;
        uint256 maxBorrowableAmount;
        uint256 maxWithdrawableAmount;
    }

    /**
     * @notice Gets comprehensive position data for a user
     * @dev Consolidates all user position information in a single call
     *      Optimized to minimize storage reads and external calls
     * @param user The user address
     * @param supportedAssets Array of all supported asset addresses
     * @param userSupplies Mapping of user supplies from main contract
     * @param userBorrows Mapping of user borrows from main contract
     * @param enhancedAssets Mapping of asset configurations from main contract
     * @param priceOracle Price oracle contract for asset pricing
     * @return positionData Complete user position data structure
     */
    function getUserPositionData(
        address user,
        address[] storage supportedAssets,
        mapping(address => mapping(address => uint256)) storage userSupplies,
        mapping(address => mapping(address => uint256)) storage userBorrows,
        mapping(address => IUniversalLendingProtocol.AssetConfig)
            storage enhancedAssets,
        IPriceOracle priceOracle
    ) internal view returns (UserPositionData memory positionData) {
        // Get consolidated asset data
        UserAssetCalculations.UserAssetData
            memory assetData = UserAssetCalculations.calculateUserAssetData(
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

        // Set basic position metrics
        positionData.totalCollateralValue = assetData.totalCollateralValue;
        positionData.totalDebtValue = assetData.totalDebtValue;
        // Calculate how much more can be borrowed while maintaining the minimum health factor
        // Uses borrowable collateral (collateral factor) for borrowing capacity calculation
        if (assetData.totalDebtValue == 0) {
            // For zero-debt positions, max borrowable is the total borrowable collateral
            positionData.maxBorrowUsdValue = assetData.totalBorrowableCollateral;
        } else if (assetData.totalBorrowableCollateral > 0) {
            // For positions with existing debt, calculate remaining capacity at minimum health factor
            uint256 maxAllowableDebt = (assetData.totalBorrowableCollateral * PRECISION) / MINIMUM_HEALTH_FACTOR;
            // Calculate remaining borrowing capacity
            positionData.maxBorrowUsdValue = maxAllowableDebt > assetData.totalDebtValue
                ? maxAllowableDebt - assetData.totalDebtValue
                : 0;
        } else {
            positionData.maxBorrowUsdValue = 0;
        }
        // Calculate health factor
        positionData.healthFactor = assetData.totalDebtValue == 0
            ? type(uint256).max
            : (assetData.totalWeightedCollateral * PRECISION) /
                assetData.totalDebtValue;

        // Calculate weighted liquidation threshold
        positionData.liquidationThreshold = assetData.totalCollateralValue > 0
            ? assetData.weightedLiquidationThreshold /
                assetData.totalCollateralValue
            : 0;

        // Count assets with positions
        uint256 suppliedCount = 0;
        uint256 borrowedCount = 0;
        // GAS OPTIMIZATION: Cache array length to save gas
        uint256 length = supportedAssets.length;
        for (uint256 i = 0; i < length; i++) {
            if (userSupplies[user][supportedAssets[i]] > 0) suppliedCount++;
            if (userBorrows[user][supportedAssets[i]] > 0) borrowedCount++;
        }

        // Initialize arrays
        positionData.suppliedAssets = new address[](suppliedCount);
        positionData.suppliedAmounts = new uint256[](suppliedCount);
        positionData.suppliedValues = new uint256[](suppliedCount);
        positionData.borrowedAssets = new address[](borrowedCount);
        positionData.borrowedAmounts = new uint256[](borrowedCount);
        positionData.borrowedValues = new uint256[](borrowedCount);

        // Populate asset arrays
        uint256 suppliedIndex = 0;
        uint256 borrowedIndex = 0;

        // GAS OPTIMIZATION: Array length already cached as length
        for (uint256 i = 0; i < length; i++) {
            address asset = supportedAssets[i];
            uint256 suppliedAmount = userSupplies[user][asset];
            uint256 borrowedAmount = userBorrows[user][asset];

            if (suppliedAmount > 0) {
                positionData.suppliedAssets[suppliedIndex] = asset;
                positionData.suppliedAmounts[suppliedIndex] = suppliedAmount;

                uint256 price = priceOracle.getPrice(asset);
                positionData.suppliedValues[suppliedIndex] = CoreCalculations
                    .calculateAssetValue(suppliedAmount, asset, price);
                suppliedIndex++;
            }

            if (borrowedAmount > 0) {
                positionData.borrowedAssets[borrowedIndex] = asset;
                positionData.borrowedAmounts[borrowedIndex] = borrowedAmount;

                uint256 price = priceOracle.getPrice(asset);
                positionData.borrowedValues[borrowedIndex] = CoreCalculations
                    .calculateAssetValue(borrowedAmount, asset, price);
                borrowedIndex++;
            }
        }
    }

    /**
     * @notice Gets detailed position data for a specific asset
     * @dev Provides comprehensive information about user's position in one asset
     * @param user The user address
     * @param asset The specific asset address
     * @param userSupplies Mapping of user supplies from main contract
     * @param userBorrows Mapping of user borrows from main contract
     * @param enhancedAssets Mapping of asset configurations from main contract
     * @param priceOracle Price oracle contract for asset pricing
     * @param contractBalance Current balance of the asset in the contract
     * @return position Detailed asset position data
     */
    function getAssetPosition(
        address user,
        address asset,
        mapping(address => mapping(address => uint256)) storage userSupplies,
        mapping(address => mapping(address => uint256)) storage userBorrows,
        mapping(address => IUniversalLendingProtocol.AssetConfig)
            storage enhancedAssets,
        IPriceOracle priceOracle,
        uint256 contractBalance
    ) internal view returns (AssetPosition memory position) {
        position.asset = asset;
        position.suppliedAmount = userSupplies[user][asset];
        position.borrowedAmount = userBorrows[user][asset];

        if (position.suppliedAmount > 0 || position.borrowedAmount > 0) {
            uint256 price = priceOracle.getPrice(asset);

            position.suppliedValue = CoreCalculations.calculateAssetValue(
                position.suppliedAmount,
                asset,
                price
            );

            position.borrowedValue = CoreCalculations.calculateAssetValue(
                position.borrowedAmount,
                asset,
                price
            );

            // Calculate effective collateral value (with collateral factor)
            position.collateralValue =
                (position.suppliedValue *
                    enhancedAssets[asset].collateralFactor) /
                PRECISION;
        }

        // Calculate maximum borrowable amount (would need full context for accurate calculation)
        // This is a simplified version - full implementation would use HealthFactorLogic
        position.maxBorrowableAmount = contractBalance; // Placeholder

        // Calculate maximum withdrawable amount
        position.maxWithdrawableAmount = position.suppliedAmount; // Simplified - would need health factor check
    }

    /**
     * @notice Calculates user account summary with key metrics
     * @dev Provides essential position information for user interfaces
     * @param user The user address
     * @param supportedAssets Array of all supported asset addresses
     * @param userSupplies Mapping of user supplies from main contract
     * @param userBorrows Mapping of user borrows from main contract
     * @param enhancedAssets Mapping of asset configurations from main contract
     * @param priceOracle Price oracle contract for asset pricing
     * @return totalCollateralValue Total collateral value in USD (1e18 precision)
     * @return totalDebtValue Total debt value in USD (1e18 precision)
     * @return availableBorrows Available borrowing capacity in USD (1e18 precision)
     * @return currentLiquidationThreshold Weighted liquidation threshold
     * @return healthFactor Current health factor (1e18 = 100%)
     */
    function getUserAccountData(
        address user,
        address[] storage supportedAssets,
        mapping(address => mapping(address => uint256)) storage userSupplies,
        mapping(address => mapping(address => uint256)) storage userBorrows,
        mapping(address => IUniversalLendingProtocol.AssetConfig)
            storage enhancedAssets,
        IPriceOracle priceOracle
    )
        internal
        view
        returns (
            uint256 totalCollateralValue,
            uint256 totalDebtValue,
            uint256 availableBorrows,
            uint256 currentLiquidationThreshold,
            uint256 healthFactor
        )
    {
        UserAssetCalculations.UserAssetData
            memory assetData = UserAssetCalculations.calculateUserAssetData(
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

        // Return borrowable collateral as totalCollateralValue for getUserAccountData compatibility
        totalCollateralValue = assetData.totalBorrowableCollateral;
        totalDebtValue = assetData.totalDebtValue;

        if (assetData.totalCollateralValue > 0) {
            // Calculate weighted liquidation threshold
            currentLiquidationThreshold =
                assetData.weightedLiquidationThreshold /
                assetData.totalCollateralValue;

            // Calculate available borrows in USD at MINIMUM_HEALTH_FACTOR
            uint256 requiredCollateral = (totalDebtValue *
                MINIMUM_HEALTH_FACTOR) / PRECISION;
            availableBorrows = totalCollateralValue > requiredCollateral
                ? totalCollateralValue - requiredCollateral
                : 0;

            // Calculate health factor
            healthFactor = totalDebtValue == 0
                ? type(uint256).max
                : (assetData.totalWeightedCollateral * PRECISION) /
                    totalDebtValue;
        } else {
            currentLiquidationThreshold = 0;
            availableBorrows = 0;
            healthFactor = type(uint256).max;
        }
    }

    /**
     * @notice Gets maximum borrowing capacity for a specific asset
     * @dev Calculates how much of a specific asset user can borrow
     * @param user The user address
     * @param asset The asset to borrow
     * @param supportedAssets Array of all supported asset addresses
     * @param userSupplies Mapping of user supplies from main contract
     * @param userBorrows Mapping of user borrows from main contract
     * @param enhancedAssets Mapping of asset configurations from main contract
     * @param priceOracle Price oracle contract for asset pricing
     * @param contractBalance Current balance of the asset in the contract
     * @return maxBorrowAmount Maximum borrowable amount in asset's native decimals
     */
    function getMaxBorrowCapacity(
        address user,
        address asset,
        address[] storage supportedAssets,
        mapping(address => mapping(address => uint256)) storage userSupplies,
        mapping(address => mapping(address => uint256)) storage userBorrows,
        mapping(address => IUniversalLendingProtocol.AssetConfig)
            storage enhancedAssets,
        IPriceOracle priceOracle,
        uint256 contractBalance
    ) internal view returns (uint256 maxBorrowAmount) {
        return
            HealthFactorLogic.getMaxBorrowableAmount(
                user,
                asset,
                contractBalance,
                supportedAssets,
                userSupplies,
                userBorrows,
                enhancedAssets,
                priceOracle
            );
    }

    /**
     * @notice Gets maximum withdrawal capacity for a specific asset
     * @dev Calculates how much of a specific asset user can withdraw
     * @param user The user address
     * @param asset The asset to withdraw
     * @param supportedAssets Array of all supported asset addresses
     * @param userSupplies Mapping of user supplies from main contract
     * @param userBorrows Mapping of user borrows from main contract
     * @param enhancedAssets Mapping of asset configurations from main contract
     * @param priceOracle Price oracle contract for asset pricing
     * @param contractBalance Current balance of the asset in the contract
     * @return maxWithdrawAmount Maximum withdrawable amount in asset's native decimals
     */
    function getMaxWithdrawCapacity(
        address user,
        address asset,
        address[] storage supportedAssets,
        mapping(address => mapping(address => uint256)) storage userSupplies,
        mapping(address => mapping(address => uint256)) storage userBorrows,
        mapping(address => IUniversalLendingProtocol.AssetConfig)
            storage enhancedAssets,
        IPriceOracle priceOracle,
        uint256 contractBalance
    ) internal view returns (uint256 maxWithdrawAmount) {
        uint256 userSupply = userSupplies[user][asset];
        if (userSupply == 0) return 0;

        // Check contract balance limit
        uint256 contractLimit = contractBalance > userSupply
            ? userSupply
            : contractBalance;

        // Check if user has no debt - can withdraw full balance
        UserAssetCalculations.UserAssetData
            memory assetData = UserAssetCalculations.calculateUserAssetData(
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

        if (assetData.totalDebtValue == 0) {
            return contractLimit;
        }

        // Binary search for maximum withdrawable amount that maintains health factor
        uint256 low = 0;
        uint256 high = contractLimit;
        uint256 maxSafeWithdraw = 0;

        while (low <= high) {
            uint256 mid = (low + high) / 2;

            bool canWithdraw = HealthFactorLogic.canWithdraw(
                user,
                asset,
                mid,
                contractBalance,
                supportedAssets,
                userSupplies,
                userBorrows,
                enhancedAssets,
                priceOracle
            );

            if (canWithdraw) {
                maxSafeWithdraw = mid;
                low = mid + 1;
            } else {
                if (mid == 0) break;
                high = mid - 1;
            }
        }

        maxWithdrawAmount = maxSafeWithdraw;
    }

    /**
     * @notice Gets position health metrics and risk assessment
     * @dev Provides detailed health analysis for user interfaces
     * @param user The user address
     * @param supportedAssets Array of all supported asset addresses
     * @param userSupplies Mapping of user supplies from main contract
     * @param userBorrows Mapping of user borrows from main contract
     * @param enhancedAssets Mapping of asset configurations from main contract
     * @param priceOracle Price oracle contract for asset pricing
     * @return healthFactor Current health factor (1e18 = 100%)
     * @return healthStatus Risk status (0=Healthy, 1=Risky, 2=Liquidatable, 3=No Debt)
     * @return liquidationPrice Price drop % that would trigger liquidation
     * @return improvementNeeded USD value needed to reach minimum health factor
     */
    function getPositionHealthMetrics(
        address user,
        address[] storage supportedAssets,
        mapping(address => mapping(address => uint256)) storage userSupplies,
        mapping(address => mapping(address => uint256)) storage userBorrows,
        mapping(address => IUniversalLendingProtocol.AssetConfig)
            storage enhancedAssets,
        IPriceOracle priceOracle
    )
        internal
        view
        returns (
            uint256 healthFactor,
            uint8 healthStatus,
            uint256 liquidationPrice,
            uint256 improvementNeeded
        )
    {
        healthFactor = HealthFactorLogic.calculateHealthFactor(
            user,
            supportedAssets,
            userSupplies,
            userBorrows,
            enhancedAssets,
            priceOracle
        );

        healthStatus = HealthFactorLogic.getHealthFactorStatus(healthFactor);

        // Calculate liquidation price drop percentage
        if (healthFactor != type(uint256).max && healthFactor > 0) {
            // Liquidation occurs when health factor drops to LIQUIDATION_HEALTH_FACTOR
            // Drop fraction = 1 - (LIQUIDATION_HF / currentHF)
            if (healthFactor > LIQUIDATION_HEALTH_FACTOR) {
                liquidationPrice =
                    PRECISION -
                    (LIQUIDATION_HEALTH_FACTOR * PRECISION) /
                    healthFactor;
            }
        }

        // Get improvement needed
        UserAssetCalculations.UserAssetData
            memory assetData = UserAssetCalculations.calculateUserAssetData(
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

        improvementNeeded = HealthFactorLogic.getHealthFactorImprovementNeeded(
            healthFactor,
            assetData.totalDebtValue
        );
    }

    /**
     * @notice Gets list of assets where user has active positions
     * @dev Returns only assets with non-zero supply or borrow balances
     * @param user The user address
     * @param supportedAssets Array of all supported asset addresses
     * @param userSupplies Mapping of user supplies from main contract
     * @param userBorrows Mapping of user borrows from main contract
     * @return activeAssets Array of assets with active positions
     * @return hasSupply Array indicating which assets have supply positions
     * @return hasBorrow Array indicating which assets have borrow positions
     */
    function getActiveAssets(
        address user,
        address[] storage supportedAssets,
        mapping(address => mapping(address => uint256)) storage userSupplies,
        mapping(address => mapping(address => uint256)) storage userBorrows
    )
        internal
        view
        returns (
            address[] memory activeAssets,
            bool[] memory hasSupply,
            bool[] memory hasBorrow
        )
    {
        // Count active assets
        uint256 activeCount = 0;
        // GAS OPTIMIZATION: Cache array length to save gas
        uint256 length = supportedAssets.length;
        for (uint256 i = 0; i < length; i++) {
            address asset = supportedAssets[i];
            if (userSupplies[user][asset] > 0 || userBorrows[user][asset] > 0) {
                activeCount++;
            }
        }

        // Initialize arrays
        activeAssets = new address[](activeCount);
        hasSupply = new bool[](activeCount);
        hasBorrow = new bool[](activeCount);

        // Populate arrays
        uint256 index = 0;
        // GAS OPTIMIZATION: Array length already cached as length
        for (uint256 i = 0; i < length; i++) {
            address asset = supportedAssets[i];
            uint256 supply = userSupplies[user][asset];
            uint256 borrow = userBorrows[user][asset];

            if (supply > 0 || borrow > 0) {
                activeAssets[index] = asset;
                hasSupply[index] = supply > 0;
                hasBorrow[index] = borrow > 0;
                index++;
            }
        }
    }
}
