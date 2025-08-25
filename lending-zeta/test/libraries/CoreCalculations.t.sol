// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import "forge-std/Test.sol";
import "../../contracts/libraries/CoreCalculations.sol";
import "../../contracts/mocks/MockZRC20.sol";

/**
 * @title CoreCalculationsTest
 * @notice Comprehensive test suite for CoreCalculations library
 * @dev Tests all functions with edge cases, precision handling, and error conditions
 */
contract CoreCalculationsTest is Test {
    using CoreCalculations for uint256;

    MockZRC20 public mockToken6; // 6 decimals (USDC-like)
    MockZRC20 public mockToken18; // 18 decimals (ETH-like)
    MockZRC20 public mockToken8; // 8 decimals (BTC-like)

    uint256 constant PRECISION = 1e18;
    uint256 constant MIN_VALID_PRICE = 1e6;
    uint256 constant MAX_VALID_PRICE = 1e30;

    function setUp() public {
        mockToken6 = new MockZRC20("USDC Mock", "USDC", 6, 1000000 * 10**6);
        mockToken18 = new MockZRC20("ETH Mock", "ETH", 18, 1000000 * 10**18);
        mockToken8 = new MockZRC20("BTC Mock", "BTC", 8, 1000000 * 10**8);
    }

    // ==================== Decimal Normalization Tests ====================

    function testNormalizeToDecimals_6To18() public {
        uint256 amount = 1000 * 1e6; // 1000 USDC
        uint256 normalized = CoreCalculations.normalizeToDecimals(amount, 6);
        assertEq(normalized, 1000 * 1e18, "Should normalize 6 decimals to 18");
    }

    function testNormalizeToDecimals_8To18() public {
        uint256 amount = 5 * 1e8; // 5 BTC
        uint256 normalized = CoreCalculations.normalizeToDecimals(amount, 8);
        assertEq(normalized, 5 * 1e18, "Should normalize 8 decimals to 18");
    }

    function testNormalizeToDecimals_18To18() public {
        uint256 amount = 10 * 1e18; // 10 ETH
        uint256 normalized = CoreCalculations.normalizeToDecimals(amount, 18);
        assertEq(normalized, amount, "Should not change 18 decimals");
    }

    function testNormalizeToDecimals_24To18() public {
        uint256 amount = 1 * 1e24; // Theoretical 24-decimal token
        uint256 normalized = CoreCalculations.normalizeToDecimals(amount, 24);
        assertEq(normalized, 1 * 1e18, "Should normalize 24 decimals to 18");
    }

    function testDenormalizeFromDecimals_18To6() public {
        uint256 normalizedAmount = 1000 * 1e18;
        uint256 denormalized = CoreCalculations.denormalizeFromDecimals(normalizedAmount, 6);
        assertEq(denormalized, 1000 * 1e6, "Should denormalize to 6 decimals");
    }

    function testDenormalizeFromDecimals_18To8() public {
        uint256 normalizedAmount = 5 * 1e18;
        uint256 denormalized = CoreCalculations.denormalizeFromDecimals(normalizedAmount, 8);
        assertEq(denormalized, 5 * 1e8, "Should denormalize to 8 decimals");
    }

    function testDenormalizeFromDecimals_18To18() public {
        uint256 normalizedAmount = 10 * 1e18;
        uint256 denormalized = CoreCalculations.denormalizeFromDecimals(normalizedAmount, 18);
        assertEq(denormalized, normalizedAmount, "Should not change 18 decimals");
    }

    // Test edge cases for decimal normalization
    function testNormalizeToDecimals_ZeroAmount() public {
        uint256 normalized = CoreCalculations.normalizeToDecimals(0, 6);
        assertEq(normalized, 0, "Should handle zero amount");
    }

    function testNormalizeToDecimals_LargeAmount() public {
        uint256 amount = type(uint128).max; // Large but safe amount
        uint256 normalized = CoreCalculations.normalizeToDecimals(amount, 6);
        assertEq(normalized, amount * 1e12, "Should handle large amounts");
    }

    // ==================== Asset Value Calculation Tests ====================

    function testCalculateAssetValue_USDC() public {
        uint256 amount = 1000 * 1e6; // 1000 USDC
        uint256 price = 1 * 1e18; // $1.00
        uint256 value = CoreCalculations.calculateAssetValue(amount, address(mockToken6), price);
        assertEq(value, 1000 * 1e18, "Should calculate correct USD value for USDC");
    }

    function testCalculateAssetValue_ETH() public {
        uint256 amount = 2 * 1e18; // 2 ETH
        uint256 price = 2000 * 1e18; // $2000
        uint256 value = CoreCalculations.calculateAssetValue(amount, address(mockToken18), price);
        assertEq(value, 4000 * 1e18, "Should calculate correct USD value for ETH");
    }

    function testCalculateAssetValue_BTC() public {
        uint256 amount = 1 * 1e8; // 1 BTC
        uint256 price = 50000 * 1e18; // $50,000
        uint256 value = CoreCalculations.calculateAssetValue(amount, address(mockToken8), price);
        assertEq(value, 50000 * 1e18, "Should calculate correct USD value for BTC");
    }

    function testCalculateAssetValue_ZeroAmount() public {
        uint256 value = CoreCalculations.calculateAssetValue(0, address(mockToken18), 2000 * 1e18);
        assertEq(value, 0, "Should return zero for zero amount");
    }

    function testCalculateAssetValue_ZeroPrice() public {
        uint256 value = CoreCalculations.calculateAssetValue(1e18, address(mockToken18), 0);
        assertEq(value, 0, "Should return zero for zero price");
    }

    function testCalculateAssetValue_RevertLowPrice() public {
        vm.expectRevert("CoreCalculations: price too low");
        CoreCalculations.calculateAssetValue(1e18, address(mockToken18), MIN_VALID_PRICE - 1);
    }

    function testCalculateAssetValue_RevertHighPrice() public {
        vm.expectRevert("CoreCalculations: price too high");
        CoreCalculations.calculateAssetValue(1e18, address(mockToken18), MAX_VALID_PRICE + 1);
    }

    // ==================== Reverse Asset Value Calculation Tests ====================

    function testCalculateAssetAmountFromValue_USDC() public {
        uint256 usdValue = 1000 * 1e18; // $1000
        uint256 price = 1 * 1e18; // $1.00
        uint256 amount = CoreCalculations.calculateAssetAmountFromValue(usdValue, address(mockToken6), price);
        assertEq(amount, 1000 * 1e6, "Should calculate correct USDC amount from USD value");
    }

    function testCalculateAssetAmountFromValue_ETH() public {
        uint256 usdValue = 4000 * 1e18; // $4000
        uint256 price = 2000 * 1e18; // $2000
        uint256 amount = CoreCalculations.calculateAssetAmountFromValue(usdValue, address(mockToken18), price);
        assertEq(amount, 2 * 1e18, "Should calculate correct ETH amount from USD value");
    }

    function testCalculateAssetAmountFromValue_BTC() public {
        uint256 usdValue = 50000 * 1e18; // $50,000
        uint256 price = 50000 * 1e18; // $50,000
        uint256 amount = CoreCalculations.calculateAssetAmountFromValue(usdValue, address(mockToken8), price);
        assertEq(amount, 1 * 1e8, "Should calculate correct BTC amount from USD value");
    }

    function testCalculateAssetAmountFromValue_ZeroValue() public {
        uint256 amount = CoreCalculations.calculateAssetAmountFromValue(0, address(mockToken18), 2000 * 1e18);
        assertEq(amount, 0, "Should return zero for zero USD value");
    }

    function testCalculateAssetAmountFromValue_ZeroPrice() public {
        uint256 amount = CoreCalculations.calculateAssetAmountFromValue(1000 * 1e18, address(mockToken18), 0);
        assertEq(amount, 0, "Should return zero for zero price");
    }

    // ==================== Price Validation Tests ====================

    function testValidatePrice_ValidPrices() public {
        assertTrue(CoreCalculations.validatePrice(MIN_VALID_PRICE), "Should validate minimum price");
        assertTrue(CoreCalculations.validatePrice(1000 * 1e18), "Should validate normal price");
        assertTrue(CoreCalculations.validatePrice(MAX_VALID_PRICE), "Should validate maximum price");
    }

    function testValidatePrice_InvalidPrices() public {
        assertFalse(CoreCalculations.validatePrice(0), "Should reject zero price");
        assertFalse(CoreCalculations.validatePrice(MIN_VALID_PRICE - 1), "Should reject price below minimum");
        assertFalse(CoreCalculations.validatePrice(MAX_VALID_PRICE + 1), "Should reject price above maximum");
    }

    // ==================== Safe Math Operations Tests ====================

    function testSafeMulDiv_NormalOperation() public {
        uint256 a = 1000 * 1e18;
        uint256 b = 2 * 1e18;
        uint256 result = CoreCalculations.safeMulDiv(a, b);
        assertEq(result, 2000 * 1e18, "Should multiply and maintain precision");
    }

    function testSafeMulDiv_ZeroValues() public {
        assertEq(CoreCalculations.safeMulDiv(0, 1e18), 0, "Should return zero for zero first value");
        assertEq(CoreCalculations.safeMulDiv(1e18, 0), 0, "Should return zero for zero second value");
    }

    function testSafeMulDiv_RevertOnOverflow() public {
        uint256 largeValue = type(uint256).max / 2;
        vm.expectRevert("CoreCalculations: multiplication overflow");
        CoreCalculations.safeMulDiv(largeValue, largeValue);
    }

    function testSafeDivMul_NormalOperation() public {
        uint256 a = 1000 * 1e18;
        uint256 b = 2 * 1e18;
        uint256 result = CoreCalculations.safeDivMul(a, b);
        assertEq(result, 500 * 1e18, "Should divide and maintain precision");
    }

    function testSafeDivMul_ZeroNumerator() public {
        uint256 result = CoreCalculations.safeDivMul(0, 1e18);
        assertEq(result, 0, "Should return zero for zero numerator");
    }

    function testSafeDivMul_RevertOnZeroDenominator() public {
        vm.expectRevert("CoreCalculations: division by zero");
        CoreCalculations.safeDivMul(1e18, 0);
    }

    // ==================== Percentage Calculation Tests ====================

    function testCalculatePercentage_NormalOperation() public {
        uint256 value = 1000 * 1e18;
        uint256 percentage = 0.1 * 1e18; // 10%
        uint256 result = CoreCalculations.calculatePercentage(value, percentage);
        assertEq(result, 100 * 1e18, "Should calculate 10% correctly");
    }

    function testCalculatePercentage_HighPercentage() public {
        uint256 value = 1000 * 1e18;
        uint256 percentage = 1.05 * 1e18; // 105% (bonus scenario)
        uint256 result = CoreCalculations.calculatePercentage(value, percentage);
        assertEq(result, 1050 * 1e18, "Should handle percentages above 100%");
    }

    function testCalculatePercentage_ZeroValues() public {
        assertEq(CoreCalculations.calculatePercentage(0, 0.1 * 1e18), 0, "Should return zero for zero value");
        assertEq(CoreCalculations.calculatePercentage(1000 * 1e18, 0), 0, "Should return zero for zero percentage");
    }

    function testCalculatePercentage_RevertOnExcessivePercentage() public {
        uint256 value = 1000 * 1e18;
        uint256 excessivePercentage = 11 * 1e18; // 1100% - above 10x limit
        vm.expectRevert("CoreCalculations: percentage too high");
        CoreCalculations.calculatePercentage(value, excessivePercentage);
    }

    // ==================== Equality with Tolerance Tests ====================

    function testEqualWithinTolerance_ExactMatch() public {
        uint256 a = 1000 * 1e18;
        uint256 b = 1000 * 1e18;
        assertTrue(CoreCalculations.equalWithinTolerance(a, b, 1e15), "Should return true for exact match");
    }

    function testEqualWithinTolerance_WithinTolerance() public {
        uint256 a = 1000 * 1e18;
        uint256 b = 1000 * 1e18 + 1e15; // 0.001 difference
        assertTrue(CoreCalculations.equalWithinTolerance(a, b, 1e16), "Should return true within tolerance");
    }

    function testEqualWithinTolerance_OutsideTolerance() public {
        uint256 a = 1000 * 1e18;
        uint256 b = 1000 * 1e18 + 1e16; // 0.01 difference
        assertFalse(CoreCalculations.equalWithinTolerance(a, b, 1e15), "Should return false outside tolerance");
    }

    function testEqualWithinTolerance_ReverseDifference() public {
        uint256 a = 1000 * 1e18 + 1e15;
        uint256 b = 1000 * 1e18;
        assertTrue(CoreCalculations.equalWithinTolerance(a, b, 1e16), "Should handle reverse difference");
    }

    // ==================== Asset Decimals Tests ====================

    function testGetAssetDecimals_StandardTokens() public {
        assertEq(CoreCalculations.getAssetDecimals(address(mockToken6)), 6, "Should return 6 decimals for USDC-like");
        assertEq(CoreCalculations.getAssetDecimals(address(mockToken18)), 18, "Should return 18 decimals for ETH-like");
        assertEq(CoreCalculations.getAssetDecimals(address(mockToken8)), 8, "Should return 8 decimals for BTC-like");
    }

    function testGetAssetDecimals_InvalidAddress() public {
        // Should default to 18 for invalid address
        uint8 decimals = CoreCalculations.getAssetDecimals(address(0));
        assertEq(decimals, 18, "Should default to 18 decimals for invalid address");
    }

    // ==================== Weighted Average Tests ====================

    function testCalculateWeightedAverage_NormalCase() public {
        uint256[] memory values = new uint256[](3);
        values[0] = 100 * 1e18;
        values[1] = 200 * 1e18;
        values[2] = 300 * 1e18;

        uint256[] memory weights = new uint256[](3);
        weights[0] = 1 * 1e18; // Weight 1
        weights[1] = 2 * 1e18; // Weight 2
        weights[2] = 1 * 1e18; // Weight 1

        uint256 result = CoreCalculations.calculateWeightedAverage(values, weights);
        // Expected: (100*1 + 200*2 + 300*1) / (1+2+1) = 800/4 = 200
        assertEq(result, 200 * 1e18, "Should calculate weighted average correctly");
    }

    function testCalculateWeightedAverage_EmptyArrays() public {
        uint256[] memory values = new uint256[](0);
        uint256[] memory weights = new uint256[](0);
        uint256 result = CoreCalculations.calculateWeightedAverage(values, weights);
        assertEq(result, 0, "Should return zero for empty arrays");
    }

    function testCalculateWeightedAverage_ZeroWeights() public {
        uint256[] memory values = new uint256[](2);
        values[0] = 100 * 1e18;
        values[1] = 200 * 1e18;

        uint256[] memory weights = new uint256[](2);
        weights[0] = 0;
        weights[1] = 0;

        uint256 result = CoreCalculations.calculateWeightedAverage(values, weights);
        assertEq(result, 0, "Should return zero for zero weights");
    }

    function testCalculateWeightedAverage_RevertOnMismatchedLengths() public {
        uint256[] memory values = new uint256[](2);
        values[0] = 100 * 1e18;
        values[1] = 200 * 1e18;

        uint256[] memory weights = new uint256[](3);
        weights[0] = 1 * 1e18;
        weights[1] = 2 * 1e18;
        weights[2] = 1 * 1e18;

        vm.expectRevert("CoreCalculations: array length mismatch");
        CoreCalculations.calculateWeightedAverage(values, weights);
    }

    // ==================== Precision and Edge Case Tests ====================

    function testPrecisionHandling_SmallAmounts() public {
        uint256 amount = 1; // 1 wei for 18-decimal token
        uint256 price = 1e18; // $1
        uint256 value = CoreCalculations.calculateAssetValue(amount, address(mockToken18), price);
        assertEq(value, 1, "Should handle very small amounts correctly");
    }

    function testPrecisionHandling_LargePrices() public {
        uint256 amount = 1e18; // 1 token
        uint256 price = 1e24; // Very high price but within limits
        uint256 value = CoreCalculations.calculateAssetValue(amount, address(mockToken18), price);
        assertEq(value, 1e24, "Should handle large prices correctly");
    }

    function testRoundingBehavior() public {
        // Test rounding in decimal conversions
        uint256 amount = 1; // 1 unit of 6-decimal token
        uint256 normalized = CoreCalculations.normalizeToDecimals(amount, 6);
        uint256 denormalized = CoreCalculations.denormalizeFromDecimals(normalized, 6);
        assertEq(denormalized, amount, "Should maintain precision in round-trip conversion");
    }

    // ==================== Integration Tests ====================

    function testIntegration_FullCalculationCycle() public {
        // Test a complete calculation cycle: amount -> normalized -> value -> back to amount
        uint256 originalAmount = 1000 * 1e6; // 1000 USDC
        uint256 price = 1 * 1e18; // $1.00

        // Calculate USD value
        uint256 usdValue = CoreCalculations.calculateAssetValue(originalAmount, address(mockToken6), price);
        
        // Convert back to asset amount
        uint256 calculatedAmount = CoreCalculations.calculateAssetAmountFromValue(usdValue, address(mockToken6), price);
        
        assertEq(calculatedAmount, originalAmount, "Should maintain precision in full calculation cycle");
    }

    function testIntegration_CrossDecimalCalculations() public {
        // Test calculations between different decimal assets
        uint256 ethAmount = 2 * 1e18; // 2 ETH
        uint256 ethPrice = 2000 * 1e18; // $2000

        uint256 usdValue = CoreCalculations.calculateAssetValue(ethAmount, address(mockToken18), ethPrice);
        assertEq(usdValue, 4000 * 1e18, "Should calculate correct USD value for ETH");

        uint256 usdcPrice = 1 * 1e18; // $1.00
        uint256 equivalentUsdc = CoreCalculations.calculateAssetAmountFromValue(usdValue, address(mockToken6), usdcPrice);
        assertEq(equivalentUsdc, 4000 * 1e6, "Should calculate equivalent USDC amount");
    }
}