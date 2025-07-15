// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

library InterestRateModel {
    uint256 private constant SECONDS_PER_YEAR = 365 days;
    uint256 private constant RAY = 1e27;
    
    struct RateParams {
        uint256 baseRate;
        uint256 slope1;
        uint256 slope2;
        uint256 optimalUtilization;
    }
    
    function calculateBorrowRate(
        uint256 totalSupply,
        uint256 totalBorrow,
        RateParams memory params
    ) internal pure returns (uint256) {
        if (totalSupply == 0) {
            return params.baseRate;
        }
        
        uint256 utilizationRate = (totalBorrow * RAY) / totalSupply;
        
        if (utilizationRate <= params.optimalUtilization) {
            return params.baseRate + (utilizationRate * params.slope1) / RAY;
        } else {
            uint256 excessUtilization = utilizationRate - params.optimalUtilization;
            return params.baseRate + params.slope1 + (excessUtilization * params.slope2) / RAY;
        }
    }
    
    function calculateSupplyRate(
        uint256 borrowRate,
        uint256 totalSupply,
        uint256 totalBorrow,
        uint256 reserveFactor
    ) internal pure returns (uint256) {
        if (totalSupply == 0) {
            return 0;
        }
        
        uint256 utilizationRate = (totalBorrow * RAY) / totalSupply;
        uint256 rateToPool = borrowRate * (RAY - reserveFactor) / RAY;
        
        return (utilizationRate * rateToPool) / RAY;
    }
    
    function calculateCompoundedInterest(
        uint256 rate,
        uint256 lastUpdateTimestamp
    ) internal view returns (uint256) {
        uint256 exp = block.timestamp - lastUpdateTimestamp;
        if (exp == 0) {
            return RAY;
        }
        
        uint256 expMinusOne = exp - 1;
        uint256 expMinusTwo = exp > 2 ? exp - 2 : 0;
        
        uint256 ratePerSecond = rate / SECONDS_PER_YEAR;
        
        uint256 basePowerTwo = (ratePerSecond * ratePerSecond + RAY) / RAY;
        uint256 basePowerThree = (basePowerTwo * ratePerSecond + RAY) / RAY;
        
        uint256 secondTerm = (exp * expMinusOne * basePowerTwo) / 2;
        uint256 thirdTerm = (exp * expMinusOne * expMinusTwo * basePowerThree) / 6;
        
        return RAY + (ratePerSecond * exp) + secondTerm + thirdTerm;
    }
}