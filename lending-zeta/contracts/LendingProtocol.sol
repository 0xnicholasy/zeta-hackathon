// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/ILendingProtocol.sol";
import "./interfaces/IPriceOracle.sol";
import "./interfaces/IZRC20.sol";
import "./libraries/InterestRateModel.sol";
import "./libraries/LiquidationLogic.sol";

contract LendingProtocol is ILendingProtocol, ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;
    using InterestRateModel for *;
    using LiquidationLogic for *;

    uint256 private constant PRECISION = 1e18;
    uint256 private constant MINIMUM_HEALTH_FACTOR = 1.5e18;
    uint256 private constant LIQUIDATION_THRESHOLD = 1.2e18;
    uint256 private constant RESERVE_FACTOR = 0.1e18; // 10%

    IPriceOracle public priceOracle;
    
    mapping(address => AssetConfig) public assets;
    mapping(address => mapping(address => uint256)) public userSupplies;
    mapping(address => mapping(address => uint256)) public userBorrows;
    mapping(address => mapping(address => uint256)) public lastInterestUpdate;
    mapping(address => uint256) public totalReserves;
    
    address[] public supportedAssets;

    modifier onlySupportedAsset(address asset) {
        require(assets[asset].isSupported, "Asset not supported");
        _;
    }

    modifier healthFactorCheck(address user) {
        _;
        require(getHealthFactor(user) >= MINIMUM_HEALTH_FACTOR, "Insufficient collateral");
    }

    constructor(address _priceOracle, address owner) Ownable(owner) {
        priceOracle = IPriceOracle(_priceOracle);
    }

    function addAsset(
        address asset,
        uint256 collateralFactor,
        uint256 liquidationThreshold,
        uint256 liquidationBonus
    ) external onlyOwner {
        require(!assets[asset].isSupported, "Asset already supported");
        require(collateralFactor <= PRECISION, "Invalid collateral factor");
        require(liquidationThreshold <= PRECISION, "Invalid liquidation threshold");
        
        assets[asset] = AssetConfig({
            isSupported: true,
            collateralFactor: collateralFactor,
            liquidationThreshold: liquidationThreshold,
            liquidationBonus: liquidationBonus,
            borrowRate: 0,
            supplyRate: 0,
            totalSupply: 0,
            totalBorrow: 0
        });
        
        supportedAssets.push(asset);
    }

    function supply(
        address asset,
        uint256 amount,
        address onBehalfOf
    ) external nonReentrant onlySupportedAsset(asset) {
        require(amount > 0, "Amount must be greater than 0");
        
        _updateInterest(asset);
        
        IERC20(asset).safeTransferFrom(msg.sender, address(this), amount);
        
        userSupplies[onBehalfOf][asset] += amount;
        assets[asset].totalSupply += amount;
        
        lastInterestUpdate[onBehalfOf][asset] = block.timestamp;
        
        emit Supply(onBehalfOf, asset, amount);
    }

    function borrow(
        address asset,
        uint256 amount,
        address to
    ) external nonReentrant onlySupportedAsset(asset) healthFactorCheck(msg.sender) {
        require(amount > 0, "Amount must be greater than 0");
        require(amount <= _getAvailableBorrow(msg.sender, asset), "Insufficient collateral");
        
        _updateInterest(asset);
        
        userBorrows[msg.sender][asset] += amount;
        assets[asset].totalBorrow += amount;
        
        lastInterestUpdate[msg.sender][asset] = block.timestamp;
        
        IERC20(asset).safeTransfer(to, amount);
        
        emit Borrow(msg.sender, asset, amount);
    }

    function repay(
        address asset,
        uint256 amount,
        address onBehalfOf
    ) external nonReentrant onlySupportedAsset(asset) {
        require(amount > 0, "Amount must be greater than 0");
        
        _updateInterest(asset);
        
        uint256 userDebt = userBorrows[onBehalfOf][asset];
        uint256 amountToRepay = amount > userDebt ? userDebt : amount;
        
        IERC20(asset).safeTransferFrom(msg.sender, address(this), amountToRepay);
        
        userBorrows[onBehalfOf][asset] -= amountToRepay;
        assets[asset].totalBorrow -= amountToRepay;
        
        emit Repay(onBehalfOf, asset, amountToRepay);
    }

    function withdraw(
        address asset,
        uint256 amount,
        address to
    ) external nonReentrant onlySupportedAsset(asset) healthFactorCheck(msg.sender) {
        require(amount > 0, "Amount must be greater than 0");
        require(userSupplies[msg.sender][asset] >= amount, "Insufficient balance");
        
        _updateInterest(asset);
        
        userSupplies[msg.sender][asset] -= amount;
        assets[asset].totalSupply -= amount;
        
        IERC20(asset).safeTransfer(to, amount);
        
        emit Withdraw(msg.sender, asset, amount);
    }

    function liquidate(
        address collateralAsset,
        address debtAsset,
        address user,
        uint256 debtToCover
    ) external nonReentrant onlySupportedAsset(collateralAsset) onlySupportedAsset(debtAsset) {
        uint256 healthFactor = getHealthFactor(user);
        require(healthFactor < LIQUIDATION_THRESHOLD, "Health factor above liquidation threshold");
        
        uint256 userDebt = userBorrows[user][debtAsset];
        require(debtToCover <= userDebt, "Cannot cover more debt than user has");
        
        _updateInterest(collateralAsset);
        _updateInterest(debtAsset);
        
        uint256 debtPrice = priceOracle.getPrice(debtAsset);
        uint256 collateralPrice = priceOracle.getPrice(collateralAsset);
        
        uint256 liquidatedCollateral = LiquidationLogic.calculateLiquidationAmount(
            debtToCover,
            debtPrice,
            collateralPrice,
            assets[collateralAsset].liquidationBonus
        );
        
        require(userSupplies[user][collateralAsset] >= liquidatedCollateral, "Insufficient collateral");
        
        IERC20(debtAsset).safeTransferFrom(msg.sender, address(this), debtToCover);
        
        userBorrows[user][debtAsset] -= debtToCover;
        userSupplies[user][collateralAsset] -= liquidatedCollateral;
        assets[debtAsset].totalBorrow -= debtToCover;
        
        IERC20(collateralAsset).safeTransfer(msg.sender, liquidatedCollateral);
        
        emit Liquidate(msg.sender, user, collateralAsset, debtAsset, debtToCover, liquidatedCollateral);
    }

    function getHealthFactor(address user) public view returns (uint256) {
        (uint256 totalCollateralValue, uint256 totalDebtValue, , uint256 currentLiquidationThreshold, ) = 
            getUserAccountData(user);
        
        return LiquidationLogic.calculateHealthFactor(
            totalCollateralValue,
            totalDebtValue,
            currentLiquidationThreshold
        );
    }

    function getSupplyBalance(address user, address asset) external view returns (uint256) {
        return userSupplies[user][asset];
    }

    function getBorrowBalance(address user, address asset) external view returns (uint256) {
        return userBorrows[user][asset];
    }

    function getAssetConfig(address asset) external view returns (AssetConfig memory) {
        return assets[asset];
    }

    function getUserAccountData(address user) public view returns (
        uint256 totalCollateralValue,
        uint256 totalDebtValue,
        uint256 availableBorrows,
        uint256 currentLiquidationThreshold,
        uint256 healthFactor
    ) {
        uint256 totalCollateral;
        uint256 totalDebt;
        uint256 weightedLiquidationThreshold;
        
        for (uint256 i = 0; i < supportedAssets.length; i++) {
            address asset = supportedAssets[i];
            uint256 supplyBalance = userSupplies[user][asset];
            uint256 borrowBalance = userBorrows[user][asset];
            
            if (supplyBalance > 0 || borrowBalance > 0) {
                uint256 price = priceOracle.getPrice(asset);
                
                if (supplyBalance > 0) {
                    uint256 collateralValue = LiquidationLogic.calculateCollateralValue(
                        asset,
                        supplyBalance,
                        assets[asset].collateralFactor,
                        priceOracle
                    );
                    totalCollateral += collateralValue;
                    weightedLiquidationThreshold += collateralValue * assets[asset].liquidationThreshold;
                }
                
                if (borrowBalance > 0) {
                    totalDebt += LiquidationLogic.calculateDebtValue(asset, borrowBalance, priceOracle);
                }
            }
        }
        
        totalCollateralValue = totalCollateral;
        totalDebtValue = totalDebt;
        
        if (totalCollateral > 0) {
            currentLiquidationThreshold = weightedLiquidationThreshold / totalCollateral;
            availableBorrows = (totalCollateral * PRECISION) / MINIMUM_HEALTH_FACTOR - totalDebt;
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

    function _updateInterest(address asset) internal {
        AssetConfig storage assetConfig = assets[asset];
        
        InterestRateModel.RateParams memory params = InterestRateModel.RateParams({
            baseRate: 0.02e18, // 2%
            slope1: 0.04e18,   // 4%
            slope2: 0.75e18,   // 75%
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

    function _getAvailableBorrow(address user, address asset) internal view returns (uint256) {
        (, , uint256 availableBorrows, , ) = getUserAccountData(user);
        uint256 assetPrice = priceOracle.getPrice(asset);
        return (availableBorrows * PRECISION) / assetPrice;
    }

    function setSupportedAsset(address asset, bool supported) external onlyOwner {
        assets[asset].isSupported = supported;
    }

    function setPriceOracle(address _priceOracle) external onlyOwner {
        priceOracle = IPriceOracle(_priceOracle);
    }
}