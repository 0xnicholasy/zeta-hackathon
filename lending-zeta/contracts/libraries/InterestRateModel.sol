// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/**
 * @title InterestRateModel
 * @author ZetaChain Cross-Chain Lending Protocol
 * @notice Library implementing variable interest rate calculations for lending protocol
 * @dev Uses a kinked interest rate model similar to Compound/Aave protocols
 *      Interest rates are calculated based on supply utilization and compound over time
 *      All rates are expressed in RAY precision (1e27) for high accuracy
 */
library InterestRateModel {
    /// @dev Seconds in a year for interest rate calculations
    uint256 private constant SECONDS_PER_YEAR = 365 days;

    /// @dev RAY precision constant (1e27) for high-precision calculations
    uint256 private constant RAY = 1e27;

    /// @dev Maximum time delta to avoid overflow in extreme scenarios (100 years)
    uint256 private constant MAX_TIME_DELTA = 100 * 365 days;

    /// @dev Half RAY for rounding
    uint256 private constant HALF_RAY = RAY / 2;

    /**
     * @notice Parameters defining the interest rate curve for an asset
     * @dev Implements a kinked interest rate model with two slopes
     * @param baseRate The minimum interest rate when utilization is 0 (in RAY)
     * @param slope1 Rate of increase per utilization point up to optimal utilization (in RAY)
     * @param slope2 Rate of increase per utilization point above optimal utilization (in RAY)
     * @param optimalUtilization Target utilization rate where the kink occurs (in RAY, e.g., 0.8e27 = 80%)
     */
    struct RateParams {
        uint256 baseRate;
        uint256 slope1;
        uint256 slope2;
        uint256 optimalUtilization;
    }

    /**
     * @notice Calculates the current borrow interest rate for an asset
     * @dev Uses kinked interest rate model:
     *      - Below optimal utilization: baseRate + (utilization * slope1)
     *      - Above optimal utilization: baseRate + slope1 + (excessUtilization * slope2)
     * @param totalSupply Total amount of asset supplied to the protocol
     * @param totalBorrow Total amount of asset borrowed from the protocol
     * @param params Interest rate parameters for the asset
     * @return Current borrow interest rate (in RAY precision, annual percentage)
     */
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
            // PRECISION FIX: Multiply before divide to minimize precision loss
            return params.baseRate + (utilizationRate * params.slope1) / RAY;
        } else {
            uint256 excessUtilization = utilizationRate -
                params.optimalUtilization;
            // PRECISION FIX: Multiply before divide to minimize precision loss
            return
                params.baseRate +
                params.slope1 +
                (excessUtilization * params.slope2) /
                RAY;
        }
    }

    /**
     * @notice Calculates the current supply interest rate for an asset
     * @dev Supply rate = borrowRate * utilizationRate * (1 - reserveFactor)
     *      Suppliers earn interest from borrowers minus protocol reserves
     * @param borrowRate Current borrow interest rate (in RAY)
     * @param totalSupply Total amount of asset supplied to the protocol
     * @param totalBorrow Total amount of asset borrowed from the protocol
     * @param reserveFactor Percentage of interest that goes to protocol reserves (in RAY)
     * @return Current supply interest rate (in RAY precision, annual percentage)
     */
    function calculateSupplyRate(
        uint256 borrowRate,
        uint256 totalSupply,
        uint256 totalBorrow,
        uint256 reserveFactor
    ) internal pure returns (uint256) {
        if (totalSupply == 0) {
            return 0;
        }

        // PRECISION FIX: Use higher precision intermediate calculations
        uint256 utilizationRate = (totalBorrow * RAY) / totalSupply;
        uint256 rateToPool = (borrowRate * (RAY - reserveFactor)) / RAY;

        // PRECISION FIX: Calculate final result with proper precision
        return (utilizationRate * rateToPool) / RAY;
    }

    /**
     * @notice Calculates compounded interest accumulated since last update
     * @dev Uses optimized Taylor series expansion for efficient gas usage:
     *      compound = 1 + ratePerSecond * exp + (ratePerSecond^2 * exp * (exp-1)) / 2 + ...
     *      This approximation is accurate for typical DeFi interest rates
     * @param rate Annual interest rate (in RAY precision)
     * @param lastUpdateTimestamp Timestamp of last interest accrual
     * @return Interest multiplier since last update (in RAY precision)
     *         Example: 1.05e27 means 5% interest has accrued
     */
    function calculateCompoundedInterest(
        uint256 rate,
        uint256 lastUpdateTimestamp
    ) internal view returns (uint256) {
        // Explicitly handle zero rate to avoid unnecessary math and rounding
        if (rate == 0) {
            return RAY;
        }

        uint256 exp = block.timestamp - lastUpdateTimestamp;
        if (exp == 0) {
            return RAY;
        }

        // Clamp extreme time deltas to avoid overflow and unrealistic growth
        if (exp > MAX_TIME_DELTA) {
            exp = MAX_TIME_DELTA;
        }

        // Convert annual rate (RAY) to per-second rate (RAY), then compute discrete compounding:
        // compound = (1 + rate_per_second) ^ exp
        uint256 ratePerSecond = rate / SECONDS_PER_YEAR; // in RAY
        uint256 base = RAY + ratePerSecond; // base in RAY

        return _rayPow(base, exp);
    }

    /// @dev Fixed-point multiply in RAY with rounding: (a * b) / RAY
    function _rayMul(uint256 a, uint256 b) private pure returns (uint256) {
        if (a == 0 || b == 0) return 0;
        return (a * b + HALF_RAY) / RAY;
    }

    /// @dev Exponentiation by squaring for RAY fixed-point base. Computes base^exp in RAY.
    function _rayPow(uint256 base, uint256 exp) private pure returns (uint256) {
        uint256 result = RAY;
        uint256 currentBase = base;
        uint256 n = exp;

        while (n > 0) {
            if (n & 1 == 1) {
                result = _rayMul(result, currentBase);
            }
            n >>= 1;
            if (n > 0) {
                currentBase = _rayMul(currentBase, currentBase);
            }
        }
        return result;
    }
}
