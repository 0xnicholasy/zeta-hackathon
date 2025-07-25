// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import "./SimpleLendingProtocol.sol";
import "./interfaces/IUniversalLendingProtocol.sol";
import "./interfaces/IPriceOracle.sol";
import "./libraries/InterestRateModel.sol";
import "./libraries/LiquidationLogic.sol";

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

    uint256 private constant RESERVE_FACTOR = 0.1e18; // 10%
    uint256 private constant MAX_PRICE_AGE = 3600; // 1 hour
    uint256 private constant MIN_VALID_PRICE = 1e6; // Minimum valid price (prevents flash loan attacks)

    IPriceOracle public priceOracle;

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
    ) SimpleLendingProtocol(_gateway, _owner) {
        priceOracle = IPriceOracle(_priceOracle);
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
        if (enhancedAssets[asset].isSupported) revert("Asset already supported");
        if (collateralFactor > PRECISION) revert InvalidAmount();
        if (liquidationThreshold > PRECISION) revert InvalidAmount();
        if (liquidationBonus > PRECISION) revert InvalidAmount();

        // Add to base protocol first - manually set the asset in the base mapping
        assets[asset] = Asset({
            isSupported: true,
            price: 2000 * PRECISION // Default price, will be updated via oracle
        });

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
        if (healthFactor >= LIQUIDATION_THRESHOLD) revert HealthFactorTooLow();

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

    // Enhanced health factor calculation
    function getHealthFactor(
        address user
    )
        public
        view
        override(ISimpleLendingProtocol, SimpleLendingProtocolBase)
        returns (uint256)
    {
        uint256 totalDebtValue = getTotalDebtValue(user);

        if (totalDebtValue == 0) {
            return type(uint256).max;
        }

        // Calculate weighted collateral value using liquidation thresholds
        uint256 totalWeightedCollateral = 0;

        for (uint256 i = 0; i < supportedAssets.length; i++) {
            address asset = supportedAssets[i];
            uint256 supplyBalance = userSupplies[user][asset];

            if (supplyBalance > 0) {
                uint256 assetPrice = _getValidatedPrice(asset);
                uint256 collateralValue = (supplyBalance * assetPrice) /
                    PRECISION;

                // Use only liquidation threshold for health factor calculation
                uint256 weightedCollateral = (collateralValue *
                    enhancedAssets[asset].liquidationThreshold) / PRECISION;
                totalWeightedCollateral += weightedCollateral;
            }
        }

        return (totalWeightedCollateral * PRECISION) / totalDebtValue;
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

        uint256 decimals = IERC20Metadata(asset).decimals();
        uint256 normalizedAmount = _normalizeToDecimals(amount, decimals);
        return (normalizedAmount * price) / PRECISION;
    }

    // Enhanced user account data with weighted liquidation thresholds
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
        uint256 totalCollateral;
        uint256 totalDebt;
        uint256 weightedLiquidationThreshold;

        for (uint256 i = 0; i < supportedAssets.length; i++) {
            address asset = supportedAssets[i];
            uint256 supplyBalance = userSupplies[user][asset];
            uint256 borrowBalance = userBorrows[user][asset];

            if (supplyBalance > 0 || borrowBalance > 0) {
                // uint256 price = priceOracle.getPrice(asset);

                if (supplyBalance > 0) {
                    uint256 collateralValue = LiquidationLogic
                        .calculateCollateralValue(
                            asset,
                            supplyBalance,
                            enhancedAssets[asset].collateralFactor,
                            priceOracle
                        );
                    totalCollateral += collateralValue;
                    weightedLiquidationThreshold +=
                        collateralValue *
                        enhancedAssets[asset].liquidationThreshold;
                }

                if (borrowBalance > 0) {
                    uint256 debtValue = LiquidationLogic.calculateDebtValue(
                        asset,
                        borrowBalance,
                        priceOracle
                    );
                    totalDebt += debtValue;
                }
            }
        }

        totalCollateralValue = totalCollateral;
        totalDebtValue = totalDebt;

        if (totalCollateral > 0) {
            currentLiquidationThreshold =
                weightedLiquidationThreshold /
                totalCollateral;

            uint256 requiredCollateral = (totalDebt * MINIMUM_HEALTH_FACTOR) /
                PRECISION;
            if (totalCollateral > requiredCollateral) {
                availableBorrows = totalCollateral - requiredCollateral;
            } else {
                availableBorrows = 0;
            }

            healthFactor = LiquidationLogic.calculateHealthFactor(
                totalCollateral,
                totalDebt,
                currentLiquidationThreshold
            );
        } else {
            currentLiquidationThreshold = 0;
            availableBorrows = 0;
            healthFactor = type(uint256).max;
        }
    }

    // Internal helper function for validated price retrieval
    function _getValidatedPrice(address asset) internal view returns (uint256) {
        uint256 price = priceOracle.getPrice(asset);
        
        // Basic validation checks
        require(price > 0, "Invalid price: zero");
        require(price >= MIN_VALID_PRICE, "Invalid price: too low");
        
        // Additional staleness check would go here if oracle supports timestamps
        // This is a placeholder for more sophisticated oracle validation
        
        return price;
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
            uint256 interestAccrued = (assetConfig.totalBorrow * assetConfig.borrowRate * timeElapsed) / (365 days * PRECISION);
            assetConfig.totalBorrow += interestAccrued;
            
            // Add to reserves
            uint256 reserveAmount = (interestAccrued * RESERVE_FACTOR) / PRECISION;
            totalReserves[asset] += reserveAmount;
        }

        InterestRateModel.RateParams memory params = InterestRateModel
            .RateParams({
                baseRate: 0.02e18, // 2%
                slope1: 0.04e18, // 4%
                slope2: 0.75e18, // 75%
                optimalUtilization: 0.8e18 // 80%
            });

        uint256 borrowRate = InterestRateModel.calculateBorrowRate(
            assetConfig.totalSupply,
            assetConfig.totalBorrow,
            params
        );

        uint256 supplyRate = InterestRateModel.calculateSupplyRate(
            borrowRate,
            assetConfig.totalSupply,
            assetConfig.totalBorrow,
            RESERVE_FACTOR
        );

        assetConfig.borrowRate = borrowRate;
        assetConfig.supplyRate = supplyRate;
        lastGlobalInterestUpdate[asset] = block.timestamp;
    }

    function _getAvailableBorrow(
        address user,
        address asset
    ) internal view returns (uint256) {
        return maxAvailableBorrows(user, asset);
    }

    // Override getAssetConfig to return enhanced configuration
    function getAssetConfig(
        address asset
    )
        external
        view
        override(ISimpleLendingProtocol, SimpleLendingProtocolBase)
        returns (Asset memory)
    {
        // Return the simple asset config for compatibility
        return assets[asset];
    }

    function getEnhancedAssetConfig(
        address asset
    ) external view returns (AssetConfig memory) {
        return enhancedAssets[asset];
    }

    /**
     * @dev Calculate the maximum USD value a user can borrow while maintaining minimum health factor
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
        uint256 totalCollateralValue = getTotalCollateralValue(user);
        uint256 totalDebtValue = getTotalDebtValue(user);

        if (totalCollateralValue == 0) return 0;

        // Calculate max total debt value while maintaining minimum health factor
        // healthFactor = totalCollateralValue / totalDebtValue >= MINIMUM_HEALTH_FACTOR
        // So: totalDebtValue <= totalCollateralValue / MINIMUM_HEALTH_FACTOR
        uint256 maxTotalDebtValue = (totalCollateralValue * PRECISION) /
            MINIMUM_HEALTH_FACTOR;

        // Calculate how much more we can borrow
        if (maxTotalDebtValue <= totalDebtValue) return 0;

        maxBorrowUsdValue = maxTotalDebtValue - totalDebtValue;
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
        maxBorrowAmount = _denormalizeFromDecimals(maxBorrowValueNormalized, decimals);
    }
}
