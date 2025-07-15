// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "../interfaces/IPriceOracle.sol";

library LiquidationLogic {
    uint256 private constant PRECISION = 1e18;
    uint256 private constant LIQUIDATION_THRESHOLD = 1.2e18; // 120%
    uint256 private constant MINIMUM_HEALTH_FACTOR = 1.5e18; // 150%
    
    struct LiquidationParams {
        address collateralAsset;
        address debtAsset;
        address user;
        uint256 debtToCover;
        uint256 collateralAmount;
        uint256 liquidationBonus;
    }
    
    function calculateHealthFactor(
        uint256 totalCollateralValue,
        uint256 totalDebtValue,
        uint256 currentLiquidationThreshold
    ) internal pure returns (uint256) {
        if (totalDebtValue == 0) {
            return type(uint256).max;
        }
        
        return (totalCollateralValue * currentLiquidationThreshold) / (totalDebtValue * PRECISION);
    }
    
    function calculateCollateralValue(
        address asset,
        uint256 amount,
        uint256 collateralFactor,
        IPriceOracle oracle
    ) internal view returns (uint256) {
        uint256 price = oracle.getPrice(asset);
        return (amount * price * collateralFactor) / (PRECISION * PRECISION);
    }
    
    function calculateDebtValue(
        address asset,
        uint256 amount,
        IPriceOracle oracle
    ) internal view returns (uint256) {
        uint256 price = oracle.getPrice(asset);
        return (amount * price) / PRECISION;
    }
    
    function validateLiquidation(
        uint256 healthFactor,
        uint256 debtToCover,
        uint256 userDebt
    ) internal pure returns (bool) {
        return healthFactor < LIQUIDATION_THRESHOLD && 
               debtToCover > 0 && 
               debtToCover <= userDebt;
    }
    
    function calculateLiquidationAmount(
        uint256 debtToCover,
        uint256 debtPrice,
        uint256 collateralPrice,
        uint256 liquidationBonus
    ) internal pure returns (uint256) {
        uint256 collateralAmount = (debtToCover * debtPrice) / collateralPrice;
        return collateralAmount + (collateralAmount * liquidationBonus) / PRECISION;
    }
    
    function validateHealthFactorImprovement(
        uint256 oldHealthFactor,
        uint256 newHealthFactor
    ) internal pure returns (bool) {
        return newHealthFactor > oldHealthFactor && newHealthFactor >= MINIMUM_HEALTH_FACTOR;
    }
}