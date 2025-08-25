// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

/**
 * @title CoreCalculations
 * @author ZetaChain Cross-Chain Lending Protocol
 * @notice Library containing core calculation utilities for the lending protocol
 * @dev Consolidates decimal normalization and asset value calculation logic
 *      Eliminates code duplication across multiple contracts and libraries
 *      All calculations use 1e18 precision for accurate financial computations
 */
library CoreCalculations {
    /// @dev Precision constant for percentage and value calculations (1e18 = 100%)
    uint256 internal constant PRECISION = 1e18;

    /// @dev Minimum valid price to prevent manipulation and zero-price attacks
    uint256 internal constant MIN_VALID_PRICE = 1e6; // $0.000001 USD

    /// @dev Maximum valid price to prevent overflow and unrealistic values
    uint256 internal constant MAX_VALID_PRICE = 1e30; // $1 trillion USD

    /**
     * @notice Normalizes an amount to 18 decimal places for consistent calculations
     * @dev Handles assets with different decimal places (e.g., USDC has 6 decimals, ETH has 18)
     *      This ensures all internal calculations use the same precision
     * @param amount The amount in the asset's native decimal places
     * @param decimals The current decimal places of the asset (from ERC20Metadata)
     * @return normalizedAmount The amount converted to 18 decimal precision
     */
    function normalizeToDecimals(
        uint256 amount,
        uint256 decimals
    ) internal pure returns (uint256 normalizedAmount) {
        if (decimals < 18) {
            // Scale up: multiply by 10^(18-decimals)
            // Example: 1000 USDC (6 decimals) → 1000 * 10^12 = 1e15 (18 decimals)
            normalizedAmount = amount * (10 ** (18 - decimals));
        } else if (decimals > 18) {
            // Scale down: divide by 10^(decimals-18)
            // Example: some theoretical token with 24 decimals → divide by 10^6
            normalizedAmount = amount / (10 ** (decimals - 18));
        } else {
            // Already 18 decimals, no conversion needed
            normalizedAmount = amount;
        }
    }

    /**
     * @notice Denormalizes an amount from 18 decimal places back to asset's native decimals
     * @dev Converts normalized amounts back to asset-specific precision for transfers
     *      Essential for accurate token transfers and user-facing amounts
     * @param normalizedAmount The amount in 18 decimal precision
     * @param decimals The target decimal places for the specific asset
     * @return amount The amount converted to the asset's native decimal precision
     */
    function denormalizeFromDecimals(
        uint256 normalizedAmount,
        uint256 decimals
    ) internal pure returns (uint256 amount) {
        if (decimals < 18) {
            // Scale down: divide by 10^(18-decimals)
            // Example: 1e15 (18 decimals) → 1e15 / 10^12 = 1000 (6 decimals for USDC)
            amount = normalizedAmount / (10 ** (18 - decimals));
        } else if (decimals > 18) {
            // Scale up: multiply by 10^(decimals-18)
            // Example: for theoretical 24-decimal token → multiply by 10^6
            amount = normalizedAmount * (10 ** (decimals - 18));
        } else {
            // Already target decimals, no conversion needed
            amount = normalizedAmount;
        }
    }

    /**
     * @notice Calculates the USD value of an asset amount using current price
     * @dev Formula: value = (normalizedAmount * price) / PRECISION
     *      Normalizes the asset amount to 18 decimals before calculation
     *      Returns value in 18 decimal USD precision for consistency
     * @param amount The amount of the asset (in asset's native decimals)
     * @param asset The address of the asset (to get decimal information)
     * @param price The current USD price of the asset (in 18 decimal precision)
     * @return value The USD value of the asset amount (in 18 decimal precision)
     */
    function calculateAssetValue(
        uint256 amount,
        address asset,
        uint256 price
    ) internal view returns (uint256 value) {
        // Handle edge cases
        if (amount == 0 || price == 0) {
            return 0;
        }

        // Validate price is within reasonable bounds
        require(price >= MIN_VALID_PRICE, "CoreCalculations: price too low");
        require(price <= MAX_VALID_PRICE, "CoreCalculations: price too high");

        // Get asset decimals and normalize amount
        uint8 decimals = IERC20Metadata(asset).decimals();
        uint256 normalizedAmount = normalizeToDecimals(amount, decimals);

        // Calculate USD value: normalizedAmount * price / PRECISION
        // Division by PRECISION accounts for price being in 18 decimal format
        value = (normalizedAmount * price) / PRECISION;
    }

    /**
     * @notice Calculates the asset amount for a given USD value at current price
     * @dev Reverse calculation of calculateAssetValue()
     *      Formula: amount = (usdValue * PRECISION) / price
     *      Useful for determining how much of an asset can be bought with USD
     * @param usdValue The USD value to convert (in 18 decimal precision)
     * @param asset The address of the asset (to get decimal information)
     * @param price The current USD price of the asset (in 18 decimal precision)
     * @return amount The asset amount equivalent to the USD value (in asset's native decimals)
     */
    function calculateAssetAmountFromValue(
        uint256 usdValue,
        address asset,
        uint256 price
    ) internal view returns (uint256 amount) {
        // Handle edge cases
        if (usdValue == 0 || price == 0) {
            return 0;
        }

        // Validate price is within reasonable bounds
        require(price >= MIN_VALID_PRICE, "CoreCalculations: price too low");
        require(price <= MAX_VALID_PRICE, "CoreCalculations: price too high");

        // Calculate normalized amount: usdValue * PRECISION / price
        uint256 normalizedAmount = (usdValue * PRECISION) / price;

        // Denormalize to asset's native decimals
        uint8 decimals = IERC20Metadata(asset).decimals();
        amount = denormalizeFromDecimals(normalizedAmount, decimals);
    }

    /**
     * @notice Validates if a price is within acceptable bounds
     * @dev Checks price against minimum and maximum thresholds to prevent:
     *      - Flash loan price manipulation attacks
     *      - Overflow errors in calculations  
     *      - Division by zero or near-zero values
     * @param price The price to validate (in 18 decimal precision)
     * @return isValid True if price is within acceptable bounds
     */
    function validatePrice(uint256 price) internal pure returns (bool isValid) {
        isValid = price >= MIN_VALID_PRICE && price <= MAX_VALID_PRICE;
    }

    /**
     * @notice Safely multiplies two values with precision handling
     * @dev Prevents overflow while maintaining precision for financial calculations
     *      Uses intermediate scaling to handle large numbers safely
     * @param a First value to multiply (in 18 decimal precision)
     * @param b Second value to multiply (in 18 decimal precision)
     * @return result The product maintaining 18 decimal precision
     */
    function safeMulDiv(
        uint256 a,
        uint256 b
    ) internal pure returns (uint256 result) {
        // Handle edge cases
        if (a == 0 || b == 0) {
            return 0;
        }

        // Check for potential overflow before multiplication
        require(a <= type(uint256).max / b, "CoreCalculations: multiplication overflow");

        // Perform multiplication and maintain precision
        result = (a * b) / PRECISION;
    }

    /**
     * @notice Safely divides two values with precision handling
     * @dev Prevents division by zero while maintaining precision
     *      Scales numerator to maintain 18 decimal precision in result
     * @param a Numerator value (in 18 decimal precision)
     * @param b Denominator value (in 18 decimal precision)
     * @return result The quotient maintaining 18 decimal precision
     */
    function safeDivMul(
        uint256 a,
        uint256 b
    ) internal pure returns (uint256 result) {
        // Prevent division by zero
        require(b > 0, "CoreCalculations: division by zero");

        // Handle zero numerator
        if (a == 0) {
            return 0;
        }

        // Scale numerator to maintain precision, then divide
        result = (a * PRECISION) / b;
    }

    /**
     * @notice Calculates percentage of a value with precision
     * @dev Formula: result = (value * percentage) / PRECISION
     *      Both inputs should be in 18 decimal precision
     * @param value The base value (in 18 decimal precision)
     * @param percentage The percentage to apply (in 18 decimal precision, e.g., 0.1e18 = 10%)
     * @return result The percentage amount (in 18 decimal precision)
     */
    function calculatePercentage(
        uint256 value,
        uint256 percentage
    ) internal pure returns (uint256 result) {
        if (value == 0 || percentage == 0) {
            return 0;
        }

        // Ensure percentage is reasonable (not over 100% in most cases, but allow for bonuses)
        require(percentage <= 10 * PRECISION, "CoreCalculations: percentage too high");

        result = (value * percentage) / PRECISION;
    }

    /**
     * @notice Compares two normalized amounts with tolerance for rounding errors
     * @dev Accounts for small rounding differences that may occur in decimal conversions
     *      Useful for equality checks in financial calculations
     * @param a First amount to compare (in 18 decimal precision)
     * @param b Second amount to compare (in 18 decimal precision)
     * @param tolerance Maximum acceptable difference (in 18 decimal precision)
     * @return isEqual True if amounts are equal within tolerance
     */
    function equalWithinTolerance(
        uint256 a,
        uint256 b,
        uint256 tolerance
    ) internal pure returns (bool isEqual) {
        if (a == b) {
            return true;
        }

        uint256 difference = a > b ? a - b : b - a;
        isEqual = difference <= tolerance;
    }

    /**
     * @notice Gets the precision-adjusted decimals for an asset
     * @dev Helper function to safely get decimals with fallback
     *      Some tokens may not implement decimals() correctly
     * @param asset The address of the ERC20 token
     * @return decimals The number of decimals for the asset (defaults to 18 if not available)
     */
    function getAssetDecimals(address asset) internal view returns (uint8 decimals) {
        // Handle zero address explicitly
        if (asset == address(0)) {
            return 18;
        }
        
        try IERC20Metadata(asset).decimals() returns (uint8 d) {
            decimals = d;
        } catch {
            // Default to 18 decimals if call fails (like ETH)
            decimals = 18;
        }
    }

    /**
     * @notice Calculates weighted average of values
     * @dev Used for calculating weighted liquidation thresholds and other averaged metrics
     *      Formula: weightedAverage = sum(value[i] * weight[i]) / sum(weight[i])
     * @param values Array of values to average (in 18 decimal precision)
     * @param weights Array of corresponding weights (in 18 decimal precision)
     * @return weightedAverage The calculated weighted average (in 18 decimal precision)
     */
    function calculateWeightedAverage(
        uint256[] memory values,
        uint256[] memory weights
    ) internal pure returns (uint256 weightedAverage) {
        require(values.length == weights.length, "CoreCalculations: array length mismatch");
        
        if (values.length == 0) {
            return 0;
        }

        uint256 numerator = 0;
        uint256 denominator = 0;

        for (uint256 i = 0; i < values.length; i++) {
            numerator += (values[i] * weights[i]) / PRECISION;
            denominator += weights[i];
        }

        if (denominator == 0) {
            return 0;
        }

        weightedAverage = (numerator * PRECISION) / denominator;
    }
}