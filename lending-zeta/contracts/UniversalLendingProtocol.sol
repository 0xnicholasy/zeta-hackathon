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

    IPriceOracle public priceOracle;

    // Enhanced asset configuration
    mapping(address => AssetConfig) public enhancedAssets;
    mapping(address => mapping(address => uint256)) public lastInterestUpdate;
    mapping(address => uint256) public totalReserves;

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
        if (enhancedAssets[asset].isSupported) revert AssetNotSupported(asset);
        if (collateralFactor > PRECISION) revert InvalidAmount();
        if (liquidationThreshold > PRECISION) revert InvalidAmount();

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

    // Override gateway functions to handle cross-chain logic
    function onCall(
        MessageContext calldata context,
        address zrc20,
        uint256 amount,
        bytes calldata message
    ) external override onlyGateway {
        // Validate source chain is allowed
        if (!allowedSourceChains[context.chainID]) {
            revert ChainNotAllowed(context.chainID);
        }

        // Use SimpleLendingProtocol's approach for message handling
        if (message.length == 64) {
            (string memory action, address onBehalfOf) = abi.decode(
                message,
                (string, address)
            );

            if (
                keccak256(abi.encodePacked(action)) ==
                keccak256(abi.encodePacked("supply"))
            ) {
                _handleCrossChainSupply(onBehalfOf, zrc20, amount, context);
                return;
            } else if (
                keccak256(abi.encodePacked(action)) ==
                keccak256(abi.encodePacked("repay"))
            ) {
                _handleCrossChainRepay(onBehalfOf, zrc20, amount, context);
                return;
            }
        } else if (message.length == 160) {
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

    function onRevert(
        RevertContext calldata revertContext
    ) external override onlyGateway {
        // Enhanced revert handling
        uint256 destinationChain = 0;
        if (revertContext.revertMessage.length >= 32) {
            (destinationChain) = abi.decode(
                revertContext.revertMessage,
                (uint256)
            );
        }

        emit CrossChainWithdrawal(
            address(0),
            revertContext.asset,
            revertContext.amount,
            destinationChain,
            address(0)
        );
    }

    // Enhanced cross-chain supply with interest updates
    function _handleCrossChainSupply(
        address user,
        address zrc20,
        uint256 amount,
        MessageContext calldata context
    ) internal {
        _updateInterest(zrc20);

        userSupplies[user][zrc20] += amount;
        enhancedAssets[zrc20].totalSupply += amount;
        lastInterestUpdate[user][zrc20] = block.timestamp;

        emit Supply(user, zrc20, amount);
        emit CrossChainDeposit(
            user,
            zrc20,
            amount,
            context.chainID,
            keccak256(context.sender)
        );
    }

    // Enhanced cross-chain repayment
    function _handleCrossChainRepay(
        address user,
        address zrc20,
        uint256 amount,
        MessageContext calldata context
    ) internal {
        _updateInterest(zrc20);

        uint256 userDebt = userBorrows[user][zrc20];
        uint256 amountToRepay = amount > userDebt ? userDebt : amount;

        userBorrows[user][zrc20] -= amountToRepay;
        enhancedAssets[zrc20].totalBorrow -= amountToRepay;

        // If overpaid, convert excess to supply
        if (amount > userDebt) {
            uint256 excess = amount - userDebt;
            userSupplies[user][zrc20] += excess;
            enhancedAssets[zrc20].totalSupply += excess;
        }

        emit Repay(user, zrc20, amountToRepay);
        emit CrossChainDeposit(
            user,
            zrc20,
            amount,
            context.chainID,
            keccak256(context.sender)
        );
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

        uint256 debtPrice = priceOracle.getPrice(debtAsset);
        uint256 collateralPrice = priceOracle.getPrice(collateralAsset);

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
                uint256 assetPrice = priceOracle.getPrice(asset);
                uint256 collateralValue = (supplyBalance * assetPrice) /
                    PRECISION;

                // Apply both collateral factor and liquidation threshold for health factor calculation
                uint256 adjustedCollateral = (collateralValue *
                    enhancedAssets[asset].collateralFactor) / PRECISION;
                uint256 weightedCollateral = (adjustedCollateral *
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
        uint256 price = priceOracle.getPrice(asset);

        uint256 decimals = IERC20Metadata(asset).decimals();
        uint256 normalizedAmount = amount;

        if (decimals < 18) {
            normalizedAmount = amount * (10 ** (18 - decimals));
        } else if (decimals > 18) {
            normalizedAmount = amount / (10 ** (decimals - 18));
        }

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

    // Internal interest rate update function
    function _updateInterest(address asset) internal {
        AssetConfig storage assetConfig = enhancedAssets[asset];

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
        uint256 assetPrice = priceOracle.getPrice(asset);
        if (assetPrice == 0) return 0;

        // Calculate asset amount and denormalize to asset decimals
        uint256 maxBorrowValueNormalized = (maxBorrowUsdValue * PRECISION) /
            assetPrice;

        uint256 decimals = IERC20Metadata(asset).decimals();
        if (decimals < 18) {
            maxBorrowAmount =
                maxBorrowValueNormalized /
                (10 ** (18 - decimals));
        } else if (decimals > 18) {
            maxBorrowAmount =
                maxBorrowValueNormalized *
                (10 ** (decimals - 18));
        } else {
            maxBorrowAmount = maxBorrowValueNormalized;
        }
    }
}
