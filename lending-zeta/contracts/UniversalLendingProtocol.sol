// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import "./SimpleLendingProtocol.sol";
import "./interfaces/IUniversalLendingProtocol.sol";
import "./interfaces/IPriceOracle.sol";
import "./libraries/InterestRateModel.sol";
import "./libraries/LiquidationLogic.sol";
import "./libraries/UserAssetCalculations.sol";

/**
 * @title UniversalLendingProtocol
 * @dev Enhanced lending protocol that extends SimpleLendingProtocol with advanced features
 */
contract UniversalLendingProtocol is
    SimpleLendingProtocol,
    IUniversalLendingProtocol
{
    using SafeERC20 for IERC20;
    using InterestRateModel for *;
    using LiquidationLogic for *;
    using UserAssetCalculations for *;

    uint256 private constant RESERVE_FACTOR = 0.1e18; // 10%
    uint256 private constant MAX_PRICE_AGE = 3600; // 1 hour
    uint256 private constant MIN_VALID_PRICE = 1e6; // Minimum valid price (prevents flash loan attacks)

    // Enhanced asset configuration
    mapping(address => AssetConfig) public enhancedAssets;
    mapping(address => mapping(address => uint256)) public lastInterestUpdate;
    mapping(address => uint256) public totalReserves;
    mapping(address => uint256) public lastGlobalInterestUpdate;

    // Cross-chain configuration
    mapping(uint256 => bool) public allowedSourceChains;
    mapping(address => uint256) public zrc20ToChainId;
    mapping(uint256 => mapping(string => address)) public chainAssets;

    constructor(
        address payable _gateway,
        address _priceOracle,
        address _owner
    ) SimpleLendingProtocol(_gateway, _priceOracle, _owner) {
        // Oracle is already set in parent constructor
    }

    // Enhanced admin functions
    function setAllowedSourceChain(
        uint256 chainId,
        bool allowed
    ) external onlyOwner {
        allowedSourceChains[chainId] = allowed;
        emit AllowedChainUpdated(chainId, allowed);
    }

    function mapZRC20Asset(
        address zrc20,
        uint256 chainId,
        string calldata symbol
    ) external onlyOwner {
        zrc20ToChainId[zrc20] = chainId;
        chainAssets[chainId][symbol] = zrc20;
        emit ZRC20AssetMapped(zrc20, chainId, symbol);
    }

    function addAsset(
        address asset,
        uint256 collateralFactor,
        uint256 liquidationThreshold,
        uint256 liquidationBonus
    ) external onlyOwner {
        if (enhancedAssets[asset].isSupported)
            revert("Asset already supported");
        if (collateralFactor > PRECISION) revert InvalidAmount();
        if (liquidationThreshold > PRECISION) revert InvalidAmount();
        if (liquidationBonus > PRECISION) revert InvalidAmount();

        // Add to base protocol first - manually set the asset in the base mapping
        // Note: price field is deprecated, use priceOracle.getPrice() instead
        assets[asset] = Asset({isSupported: true});

        if (!isAssetAdded[asset]) {
            supportedAssets.push(asset);
            isAssetAdded[asset] = true;
        }

        // Add enhanced configuration
        enhancedAssets[asset] = AssetConfig({
            isSupported: true,
            collateralFactor: collateralFactor,
            liquidationThreshold: liquidationThreshold,
            liquidationBonus: liquidationBonus,
            borrowRate: 0,
            supplyRate: 0,
            totalSupply: 0,
            totalBorrow: 0
        });
    }

    function setPriceOracle(address _priceOracle) external onlyOwner {
        priceOracle = IPriceOracle(_priceOracle);
    }

    // Enhanced view functions
    function isChainAllowed(uint256 chainId) external view returns (bool) {
        return allowedSourceChains[chainId];
    }

    function getZRC20ByChainAndSymbol(
        uint256 chainId,
        string calldata symbol
    ) external view returns (address) {
        return chainAssets[chainId][symbol];
    }

    // Override gateway functions to handle cross-chain logic with source chain validation
    function onCall(
        MessageContext calldata context,
        address zrc20,
        uint256 amount,
        bytes calldata message
    ) external override onlyGateway {
        // Validate source chain is allowed (Universal feature)
        if (!allowedSourceChains[context.chainID]) {
            revert ChainNotAllowed(context.chainID);
        }

        // Standard message handling - 128 bytes for basic operations
        if (message.length == 128) {
            (string memory action, address onBehalfOf) = abi.decode(
                message,
                (string, address)
            );
            if (
                keccak256(abi.encodePacked(action)) ==
                keccak256(abi.encodePacked("supply"))
            ) {
                _supply(zrc20, amount, onBehalfOf);
                return;
            } else if (
                keccak256(abi.encodePacked(action)) ==
                keccak256(abi.encodePacked("repay"))
            ) {
                _repay(zrc20, amount, onBehalfOf);
                return;
            }
        }
        // Extended message handling - 224 bytes for cross-chain operations
        else if (message.length == 224) {
            (
                string memory action,
                address user,
                uint256 operationAmount,
                uint256 destinationChain,
                address recipient
            ) = abi.decode(
                    message,
                    (string, address, uint256, uint256, address)
                );
            if (
                keccak256(abi.encodePacked(action)) ==
                keccak256(abi.encodePacked("borrowCrossChain"))
            ) {
                _borrowCrossChainFromCall(
                    zrc20,
                    operationAmount,
                    user,
                    destinationChain,
                    recipient
                );
                return;
            } else if (
                keccak256(abi.encodePacked(action)) ==
                keccak256(abi.encodePacked("withdrawCrossChain"))
            ) {
                _withdrawCrossChainFromCall(
                    zrc20,
                    operationAmount,
                    user,
                    destinationChain,
                    recipient
                );
                return;
            }
        }

        revert("Invalid operation or message format");
    }

    // Override supply to add interest updates
    function _supply(
        address asset,
        uint256 amount,
        address onBehalfOf
    ) internal override {
        _updateInterest(asset);
        super._supply(asset, amount, onBehalfOf);
        enhancedAssets[asset].totalSupply += amount;
        lastInterestUpdate[onBehalfOf][asset] = block.timestamp;

        // Update interest rates after supply operation
        _updateInterestRates(asset);
    }

    // Override repay to add interest updates
    function _repay(
        address asset,
        uint256 amount,
        address onBehalfOf
    ) internal override {
        _updateInterest(asset);

        uint256 userDebt = userBorrows[onBehalfOf][asset];
        uint256 amountToRepay = amount > userDebt ? userDebt : amount;

        super._repay(asset, amountToRepay, onBehalfOf);

        // If overpaid, convert excess to supply (Universal feature)
        if (amount > userDebt) {
            uint256 excess = amount - userDebt;
            userSupplies[onBehalfOf][asset] += excess;
            enhancedAssets[asset].totalSupply += excess;
            emit Supply(onBehalfOf, asset, excess);
        }

        // Update interest rates after repay operation
        _updateInterestRates(asset);
    }

    // Override core functions to include interest rate updates
    function supply(
        address asset,
        uint256 amount,
        address onBehalfOf
    )
        external
        override(ISimpleLendingProtocol, SimpleLendingProtocol)
        nonReentrant
    {
        if (!enhancedAssets[asset].isSupported) revert AssetNotSupported(asset);
        if (amount == 0) revert InvalidAmount();

        _updateInterest(asset);

        IERC20(asset).safeTransferFrom(msg.sender, address(this), amount);

        userSupplies[onBehalfOf][asset] += amount;
        enhancedAssets[asset].totalSupply += amount;
        lastInterestUpdate[onBehalfOf][asset] = block.timestamp;

        // Update interest rates after supply operation
        _updateInterestRates(asset);

        emit Supply(onBehalfOf, asset, amount);
    }

    function borrow(
        address asset,
        uint256 amount,
        address to
    )
        external
        override(ISimpleLendingProtocol, SimpleLendingProtocol)
        nonReentrant
    {
        if (!enhancedAssets[asset].isSupported) revert AssetNotSupported(asset);
        if (amount == 0) revert InvalidAmount();
        if (amount > _getAvailableBorrow(msg.sender, asset))
            revert InsufficientCollateral();

        _updateInterest(asset);

        userBorrows[msg.sender][asset] += amount;
        enhancedAssets[asset].totalBorrow += amount;
        lastInterestUpdate[msg.sender][asset] = block.timestamp;

        IERC20(asset).safeTransfer(to, amount);

        // Update interest rates after borrow operation
        _updateInterestRates(asset);

        emit Borrow(msg.sender, asset, amount);
    }

    // Enhanced liquidation with proper pricing
    function liquidate(
        address user,
        address collateralAsset,
        address debtAsset,
        uint256 repayAmount
    )
        external
        override(ISimpleLendingProtocol, SimpleLendingProtocol)
        nonReentrant
    {
        if (!enhancedAssets[collateralAsset].isSupported)
            revert AssetNotSupported(collateralAsset);
        if (!enhancedAssets[debtAsset].isSupported)
            revert AssetNotSupported(debtAsset);

        uint256 healthFactor = getHealthFactor(user);
        // Use the proper liquidation threshold from LiquidationLogic (1.2e18)
        if (healthFactor >= 1.2e18) revert HealthFactorTooLow();

        uint256 userDebt = userBorrows[user][debtAsset];
        if (repayAmount > userDebt) revert InvalidAmount();

        _updateInterest(collateralAsset);
        _updateInterest(debtAsset);

        uint256 debtPrice = _getValidatedPrice(debtAsset);
        uint256 collateralPrice = _getValidatedPrice(collateralAsset);

        uint256 liquidatedCollateral = LiquidationLogic
            .calculateLiquidationAmount(
                repayAmount,
                debtPrice,
                collateralPrice,
                enhancedAssets[collateralAsset].liquidationBonus
            );

        if (userSupplies[user][collateralAsset] < liquidatedCollateral)
            revert InsufficientCollateral();

        IERC20(debtAsset).safeTransferFrom(
            msg.sender,
            address(this),
            repayAmount
        );

        userBorrows[user][debtAsset] -= repayAmount;
        userSupplies[user][collateralAsset] -= liquidatedCollateral;
        enhancedAssets[debtAsset].totalBorrow -= repayAmount;
        enhancedAssets[collateralAsset].totalSupply -= liquidatedCollateral;

        IERC20(collateralAsset).safeTransfer(msg.sender, liquidatedCollateral);

        emit Liquidate(
            msg.sender,
            user,
            collateralAsset,
            debtAsset,
            repayAmount,
            liquidatedCollateral
        );
    }

    /**
     * @dev Internal function to calculate health factor with optional custom balances
     * Single source of truth for all health factor calculations - now uses consolidated helpers
     */
    function _calculateHealthFactorInternal(
        address user,
        address modifiedAsset,
        uint256 newCollateralBalance,
        uint256 newDebtBalance,
        bool isModified
    ) internal view returns (uint256) {
        UserAssetCalculations.UserAssetData memory assetData = UserAssetCalculations.calculateUserAssetData(
            user, 
            modifiedAsset, 
            newCollateralBalance, 
            newDebtBalance, 
            isModified,
            supportedAssets,
            userSupplies,
            userBorrows,
            enhancedAssets,
            priceOracle
        );

        if (assetData.totalDebtValue == 0) {
            return type(uint256).max;
        }

        return (assetData.totalWeightedCollateral * PRECISION) / assetData.totalDebtValue;
    }


    // Enhanced health factor calculation - single source of truth
    function getHealthFactor(
        address user
    )
        public
        view
        override(ISimpleLendingProtocol, SimpleLendingProtocolBase)
        returns (uint256)
    {
        return _calculateHealthFactorInternal(user, address(0), 0, 0, false);
    }

    // Override to use price oracle instead of fixed prices
    function getDebtValue(
        address user,
        address asset
    )
        public
        view
        override(ISimpleLendingProtocol, SimpleLendingProtocolBase)
        returns (uint256)
    {
        uint256 amount = userBorrows[user][asset];
        uint256 price = _getValidatedPrice(asset);
        return UserAssetCalculations._calculateAssetValue(amount, asset, price);
    }

    // Enhanced user account data with weighted liquidation thresholds - now uses consolidated helpers
    function getUserAccountData(
        address user
    )
        public
        view
        override
        returns (
            uint256 totalCollateralValue,
            uint256 totalDebtValue,
            uint256 availableBorrows,
            uint256 currentLiquidationThreshold,
            uint256 healthFactor
        )
    {
        UserAssetCalculations.UserAssetData memory assetData = UserAssetCalculations.calculateUserAssetData(
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

        // The getUserAccountData function returns borrowable collateral as totalCollateralValue 
        // (collateral * collateralFactor), not raw collateral value
        totalCollateralValue = assetData.totalBorrowableCollateral;
        totalDebtValue = assetData.totalDebtValue;

        if (totalCollateralValue > 0) {
            // Calculate weighted liquidation threshold based on borrowable collateral
            currentLiquidationThreshold = assetData.weightedLiquidationThreshold / assetData.totalCollateralValue;

            uint256 requiredCollateral = (totalDebtValue * MINIMUM_HEALTH_FACTOR) / PRECISION;
            if (totalCollateralValue > requiredCollateral) {
                availableBorrows = totalCollateralValue - requiredCollateral;
            } else {
                availableBorrows = 0;
            }

            healthFactor = getHealthFactor(user);
        } else {
            currentLiquidationThreshold = 0;
            availableBorrows = 0;
            healthFactor = type(uint256).max;
        }
    }

    /**
     * @dev Calculate and return interest rates for an asset based on current supply/borrow amounts
     * @param assetConfig The asset configuration containing totalSupply and totalBorrow
     * @return borrowRate The calculated borrow rate
     * @return supplyRate The calculated supply rate
     */
    function _calculateInterestRates(
        AssetConfig storage assetConfig
    ) internal view returns (uint256 borrowRate, uint256 supplyRate) {
        InterestRateModel.RateParams memory params = InterestRateModel
            .RateParams({
                baseRate: 0.02e18, // 2%
                slope1: 0.04e18, // 4%
                slope2: 0.75e18, // 75%
                optimalUtilization: 0.8e18 // 80%
            });

        borrowRate = InterestRateModel.calculateBorrowRate(
            assetConfig.totalSupply,
            assetConfig.totalBorrow,
            params
        );

        supplyRate = InterestRateModel.calculateSupplyRate(
            borrowRate,
            assetConfig.totalSupply,
            assetConfig.totalBorrow,
            RESERVE_FACTOR
        );
    }

    // Internal interest rate update function with proper accrual
    function _updateInterest(address asset) internal {
        AssetConfig storage assetConfig = enhancedAssets[asset];
        uint256 lastUpdate = lastGlobalInterestUpdate[asset];

        if (lastUpdate == 0) {
            lastGlobalInterestUpdate[asset] = block.timestamp;
            return;
        }

        uint256 timeElapsed = block.timestamp - lastUpdate;
        if (timeElapsed == 0) return;

        // Apply compound interest to total borrowed amounts
        if (assetConfig.totalBorrow > 0 && assetConfig.borrowRate > 0) {
            // Simple interest calculation for now (can be enhanced to compound)
            uint256 interestAccrued = (assetConfig.totalBorrow *
                assetConfig.borrowRate *
                timeElapsed) / (365 days * PRECISION);
            assetConfig.totalBorrow += interestAccrued;

            // Add to reserves
            uint256 reserveAmount = (interestAccrued * RESERVE_FACTOR) /
                PRECISION;
            totalReserves[asset] += reserveAmount;
        }

        // Calculate and update interest rates using the helper function
        (uint256 borrowRate, uint256 supplyRate) = _calculateInterestRates(
            assetConfig
        );
        assetConfig.borrowRate = borrowRate;
        assetConfig.supplyRate = supplyRate;
        lastGlobalInterestUpdate[asset] = block.timestamp;
    }

    // Update interest rates without applying accrual (for post-transaction rate updates)
    function _updateInterestRates(address asset) internal {
        AssetConfig storage assetConfig = enhancedAssets[asset];

        // Calculate and update interest rates using the helper function
        (uint256 borrowRate, uint256 supplyRate) = _calculateInterestRates(
            assetConfig
        );
        assetConfig.borrowRate = borrowRate;
        assetConfig.supplyRate = supplyRate;
    }

    function _getAvailableBorrow(
        address user,
        address asset
    ) internal view returns (uint256) {
        return maxAvailableBorrows(user, asset);
    }

    // Override getAssetConfig to return enhanced configuration
    // WARNING: The price field in returned Asset struct is deprecated and should not be used
    // Use getAssetPrice() function instead for accurate pricing
    function getAssetConfig(
        address asset
    )
        external
        view
        override(ISimpleLendingProtocol, SimpleLendingProtocolBase)
        returns (Asset memory)
    {
        // Return the simple asset config for compatibility
        // Note: price field is set to 0 and deprecated - use getAssetPrice() instead
        return assets[asset];
    }

    function getEnhancedAssetConfig(
        address asset
    ) external view returns (AssetConfig memory) {
        return enhancedAssets[asset];
    }

    /**
     * @dev Calculate the maximum USD value a user can borrow while maintaining minimum health factor
     * Uses collateral factors for max borrow calculation as expected by tests
     * @param user The user address
     * @return maxBorrowUsdValue The maximum USD value that can be borrowed (in 18 decimals)
     */
    function maxAvailableBorrowsInUsd(
        address user
    )
        public
        view
        override(ISimpleLendingProtocol, SimpleLendingProtocolBase)
        returns (uint256 maxBorrowUsdValue)
    {
        UserAssetCalculations.UserAssetData memory assetData = UserAssetCalculations.calculateUserAssetData(
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

        if (assetData.totalBorrowableCollateral == 0) return 0;

        // Max borrow = borrowable collateral / minimum health factor
        // This ensures the simple calculation that tests expect: collateral * factor / 1.5
        uint256 maxTotalDebtValue = (assetData.totalBorrowableCollateral * PRECISION) /
            MINIMUM_HEALTH_FACTOR;

        // Calculate how much more we can borrow
        if (maxTotalDebtValue <= assetData.totalDebtValue) return 0;

        maxBorrowUsdValue = maxTotalDebtValue - assetData.totalDebtValue;
    }

    /**
     * @dev Calculate the maximum amount of a specific asset a user can borrow
     * @param user The user address
     * @param asset The asset address to borrow
     * @return maxBorrowAmount The maximum amount in asset decimals that can be borrowed
     */
    function maxAvailableBorrows(
        address user,
        address asset
    )
        public
        view
        override(ISimpleLendingProtocol, SimpleLendingProtocolBase)
        returns (uint256 maxBorrowAmount)
    {
        if (!enhancedAssets[asset].isSupported) return 0;

        uint256 maxBorrowUsdValue = maxAvailableBorrowsInUsd(user);
        if (maxBorrowUsdValue == 0) return 0;

        // Convert USD value to asset amount using the price oracle
        uint256 assetPrice = _getValidatedPrice(asset);
        if (assetPrice == 0) return 0;

        // Calculate asset amount and denormalize to asset decimals
        uint256 maxBorrowValueNormalized = (maxBorrowUsdValue * PRECISION) /
            assetPrice;

        uint256 decimals = IERC20Metadata(asset).decimals();
        maxBorrowAmount = UserAssetCalculations._denormalizeFromDecimals(
            maxBorrowValueNormalized,
            decimals
        );
    }

    // Override canBorrow to use enhanced liquidation threshold calculations
    function canBorrow(
        address user,
        address asset,
        uint256 amount
    )
        public
        view
        override(ISimpleLendingProtocol, SimpleLendingProtocolBase)
        returns (bool)
    {
        // Check if contract has sufficient balance for the borrow
        if (IERC20(asset).balanceOf(address(this)) < amount) {
            return false;
        }

        if (!enhancedAssets[asset].isSupported) return false;

        uint256 additionalDebtValue = UserAssetCalculations._calculateAssetValue(
            amount,
            asset,
            _getValidatedPrice(asset)
        );
        uint256 currentDebtValue = getTotalDebtValue(user);
        uint256 newTotalDebtValue = currentDebtValue + additionalDebtValue;

        if (newTotalDebtValue == 0) return true;

        // Calculate what the health factor would be after borrowing
        uint256 currentDebt = userBorrows[user][asset];
        uint256 newDebt = currentDebt + amount;
        
        uint256 healthFactor = _calculateHealthFactorInternal(
            user, 
            asset, 
            userSupplies[user][asset], 
            newDebt, 
            true
        );
        
        return healthFactor >= MINIMUM_HEALTH_FACTOR;
    }

    // Override canWithdraw to use enhanced liquidation threshold calculations
    function canWithdraw(
        address user,
        address asset,
        uint256 amount
    )
        public
        view
        override(ISimpleLendingProtocol, SimpleLendingProtocolBase)
        returns (bool)
    {
        // Check if contract has sufficient balance for the withdrawal
        if (IERC20(asset).balanceOf(address(this)) < amount) {
            return false;
        }

        if (!enhancedAssets[asset].isSupported) return false;

        uint256 totalDebtValue = getTotalDebtValue(user);

        if (totalDebtValue == 0) return true;

        // Calculate what the health factor would be after withdrawal
        uint256 currentSupply = userSupplies[user][asset];
        uint256 newSupply = currentSupply > amount ? currentSupply - amount : 0;
        
        uint256 healthFactor = _calculateHealthFactorInternal(
            user, 
            asset, 
            newSupply, 
            userBorrows[user][asset], 
            true
        );
        
        return healthFactor >= MINIMUM_HEALTH_FACTOR;
    }

    // Override to use price oracle and collateral factor
    function getCollateralValue(
        address user,
        address asset
    )
        public
        view
        override(ISimpleLendingProtocol, SimpleLendingProtocolBase)
        returns (uint256)
    {
        uint256 amount = userSupplies[user][asset];
        uint256 price = _getValidatedPrice(asset);
        uint256 assetValue = UserAssetCalculations._calculateAssetValue(amount, asset, price);

        // Apply collateral factor to get effective collateral value
        return
            (assetValue * enhancedAssets[asset].collateralFactor) / PRECISION;
    }

    // ============ Health Factor Simulation View Functions ============

    /**
     * @dev Calculate health factor after a potential borrow (Enhanced with price oracle)
     * @param user The user address
     * @param asset The asset to borrow
     * @param amount The amount to borrow
     * @return newHealthFactor The health factor after the borrow
     */
    function getHealthFactorAfterBorrow(
        address user,
        address asset,
        uint256 amount
    )
        public
        view
        override(ISimpleLendingProtocol, SimpleLendingProtocolBase)
        returns (uint256 newHealthFactor)
    {
        if (!enhancedAssets[asset].isSupported) return 0;

        uint256 currentDebt = userBorrows[user][asset];
        uint256 newDebt = currentDebt + amount;
        
        return _calculateHealthFactorInternal(
            user, 
            asset, 
            userSupplies[user][asset], 
            newDebt, 
            true
        );
    }

    /**
     * @dev Calculate health factor after a potential repay (Enhanced with price oracle)
     * @param user The user address
     * @param asset The asset to repay
     * @param amount The amount to repay
     * @return newHealthFactor The health factor after the repay
     */
    function getHealthFactorAfterRepay(
        address user,
        address asset,
        uint256 amount
    )
        public
        view
        override(ISimpleLendingProtocol, SimpleLendingProtocolBase)
        returns (uint256 newHealthFactor)
    {
        if (!enhancedAssets[asset].isSupported) return type(uint256).max;

        uint256 currentDebt = userBorrows[user][asset];
        uint256 newDebt = currentDebt > amount ? currentDebt - amount : 0;
        
        return _calculateHealthFactorInternal(
            user, 
            asset, 
            userSupplies[user][asset], 
            newDebt, 
            true
        );
    }

    /**
     * @dev Calculate health factor after a potential withdrawal (Enhanced with price oracle)
     * @param user The user address
     * @param asset The asset to withdraw
     * @param amount The amount to withdraw
     * @return newHealthFactor The health factor after the withdrawal
     */
    function getHealthFactorAfterWithdraw(
        address user,
        address asset,
        uint256 amount
    )
        public
        view
        override(ISimpleLendingProtocol, SimpleLendingProtocolBase)
        returns (uint256 newHealthFactor)
    {
        if (!enhancedAssets[asset].isSupported) return 0;

        uint256 currentSupply = userSupplies[user][asset];
        uint256 newSupply = currentSupply > amount ? currentSupply - amount : 0;
        
        return _calculateHealthFactorInternal(
            user, 
            asset, 
            newSupply, 
            userBorrows[user][asset], 
            true
        );
    }

    /**
     * @dev Calculate the maximum liquidation amount for a user position
     * @param user The user whose position is being liquidated
     * @param collateralAsset The collateral asset to seize
     * @param debtAsset The debt asset to repay
     * @return maxRepayAmount Maximum amount of debt that can be repaid in the liquidation
     * @return liquidatedCollateral Amount of collateral that would be seized
     * @return canLiquidate Whether the position is eligible for liquidation
     */
    function getMaxLiquidation(
        address user,
        address collateralAsset,
        address debtAsset
    )
        external
        view
        override
        returns (
            uint256 maxRepayAmount,
            uint256 liquidatedCollateral,
            bool canLiquidate
        )
    {
        // Check if assets are supported
        if (!enhancedAssets[collateralAsset].isSupported || 
            !enhancedAssets[debtAsset].isSupported) {
            return (0, 0, false);
        }

        // Check if position is liquidatable
        uint256 healthFactor = getHealthFactor(user);
        if (healthFactor >= 1.2e18) {
            return (0, 0, false);
        }

        // Get user's debt in the specified asset
        uint256 userDebt = userBorrows[user][debtAsset];
        if (userDebt == 0) {
            return (0, 0, false);
        }

        // Get user's collateral in the specified asset
        uint256 userCollateral = userSupplies[user][collateralAsset];
        if (userCollateral == 0) {
            return (0, 0, false);
        }

        // Get asset prices
        uint256 debtPrice = _getValidatedPrice(debtAsset);
        uint256 collateralPrice = _getValidatedPrice(collateralAsset);

        // Calculate maximum repay amount (typically 50% of debt, but we'll use full debt for maximum)
        // In practice, protocols often limit to 50% to prevent full liquidation
        maxRepayAmount = userDebt;

        // Calculate corresponding collateral that would be liquidated
        liquidatedCollateral = LiquidationLogic.calculateLiquidationAmount(
            maxRepayAmount,
            debtPrice,
            collateralPrice,
            enhancedAssets[collateralAsset].liquidationBonus
        );

        // Ensure we don't liquidate more collateral than available
        if (liquidatedCollateral > userCollateral) {
            // If calculated liquidation exceeds available collateral, 
            // work backwards from available collateral
            liquidatedCollateral = userCollateral;
            
            // Calculate the maximum repay amount for this collateral
            // liquidatedCollateral = repayAmount * debtPrice * (1 + bonus) / collateralPrice
            // Therefore: repayAmount = liquidatedCollateral * collateralPrice / (debtPrice * (1 + bonus))
            uint256 bonusFactor = PRECISION + enhancedAssets[collateralAsset].liquidationBonus;
            maxRepayAmount = (liquidatedCollateral * collateralPrice * PRECISION) / 
                            (debtPrice * bonusFactor);
            
            // Ensure we don't repay more than the user's actual debt
            if (maxRepayAmount > userDebt) {
                maxRepayAmount = userDebt;
                // Recalculate liquidated collateral for the capped repay amount
                liquidatedCollateral = LiquidationLogic.calculateLiquidationAmount(
                    maxRepayAmount,
                    debtPrice,
                    collateralPrice,
                    enhancedAssets[collateralAsset].liquidationBonus
                );
            }
        }

        canLiquidate = true;
    }

    /**
     * @dev Get comprehensive user position data (Enhanced with price oracle and weighted liquidation thresholds)
     * @param user The user address
     * @return totalCollateralValue Total collateral value in USD
     * @return totalDebtValue Total debt value in USD
     * @return healthFactor Current health factor
     * @return maxBorrowUsdValue Maximum borrowable value in USD
     * @return liquidationThreshold Weighted liquidation threshold
     * @return suppliedAssets Array of supplied asset addresses
     * @return suppliedAmounts Array of supplied amounts
     * @return suppliedValues Array of supplied values in USD
     * @return borrowedAssets Array of borrowed asset addresses
     * @return borrowedAmounts Array of borrowed amounts
     * @return borrowedValues Array of borrowed values in USD
     */
    function getUserPositionData(
        address user
    )
        public
        view
        override(ISimpleLendingProtocol, SimpleLendingProtocolBase)
        returns (
            uint256 totalCollateralValue,
            uint256 totalDebtValue,
            uint256 healthFactor,
            uint256 maxBorrowUsdValue,
            uint256 liquidationThreshold,
            address[] memory suppliedAssets,
            uint256[] memory suppliedAmounts,
            uint256[] memory suppliedValues,
            address[] memory borrowedAssets,
            uint256[] memory borrowedAmounts,
            uint256[] memory borrowedValues
        )
    {
        // Get basic account data using consolidated helper
        (
            totalCollateralValue,
            totalDebtValue,
            maxBorrowUsdValue,
            liquidationThreshold,
            healthFactor
        ) = getUserAccountData(user);

        // Count assets and collect data in a single loop to reduce gas costs
        address[] memory tempSuppliedAssets = new address[](supportedAssets.length);
        uint256[] memory tempSuppliedAmounts = new uint256[](supportedAssets.length);
        uint256[] memory tempSuppliedValues = new uint256[](supportedAssets.length);
        address[] memory tempBorrowedAssets = new address[](supportedAssets.length);
        uint256[] memory tempBorrowedAmounts = new uint256[](supportedAssets.length);
        uint256[] memory tempBorrowedValues = new uint256[](supportedAssets.length);

        uint256 suppliedCount = 0;
        uint256 borrowedCount = 0;

        // Single loop for counting and collecting data
        for (uint256 i = 0; i < supportedAssets.length; i++) {
            address asset = supportedAssets[i];
            uint256 supplyBalance = userSupplies[user][asset];
            uint256 borrowBalance = userBorrows[user][asset];

            if (supplyBalance > 0) {
                tempSuppliedAssets[suppliedCount] = asset;
                tempSuppliedAmounts[suppliedCount] = supplyBalance;
                tempSuppliedValues[suppliedCount] = getCollateralValue(user, asset);
                suppliedCount++;
            }

            if (borrowBalance > 0) {
                tempBorrowedAssets[borrowedCount] = asset;
                tempBorrowedAmounts[borrowedCount] = borrowBalance;
                tempBorrowedValues[borrowedCount] = getDebtValue(user, asset);
                borrowedCount++;
            }
        }

        // Create final arrays with exact sizes
        suppliedAssets = new address[](suppliedCount);
        suppliedAmounts = new uint256[](suppliedCount);
        suppliedValues = new uint256[](suppliedCount);
        borrowedAssets = new address[](borrowedCount);
        borrowedAmounts = new uint256[](borrowedCount);
        borrowedValues = new uint256[](borrowedCount);

        // Copy data to final arrays
        for (uint256 i = 0; i < suppliedCount; i++) {
            suppliedAssets[i] = tempSuppliedAssets[i];
            suppliedAmounts[i] = tempSuppliedAmounts[i];
            suppliedValues[i] = tempSuppliedValues[i];
        }

        for (uint256 i = 0; i < borrowedCount; i++) {
            borrowedAssets[i] = tempBorrowedAssets[i];
            borrowedAmounts[i] = tempBorrowedAmounts[i];
            borrowedValues[i] = tempBorrowedValues[i];
        }
    }
}
