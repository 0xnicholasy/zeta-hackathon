// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test, console} from "forge-std/Test.sol";
import {LiquidationLogic} from "../../contracts/libraries/LiquidationLogic.sol";
import {CoreCalculations} from "../../contracts/libraries/CoreCalculations.sol";
import {MockZRC20} from "../../contracts/mocks/MockZRC20.sol";
import {MockPriceOracle} from "../../contracts/mocks/MockPriceOracle.sol";

contract LiquidationLogicTest is Test {
    MockZRC20 public eth;
    MockZRC20 public usdc;
    MockZRC20 public btc;
    MockPriceOracle public priceOracle;

    // Test asset prices (in 1e18 precision)
    uint256 public constant ETH_PRICE = 2000 * 1e18; // $2000
    uint256 public constant USDC_PRICE = 1 * 1e18;   // $1
    uint256 public constant BTC_PRICE = 50000 * 1e18; // $50000

    // Liquidation constants
    uint256 public constant LIQUIDATION_THRESHOLD = 120e16; // 1.2 in 1e18 precision
    uint256 public constant PRECISION = 1e18;

    function setUp() public {
        // Deploy mock tokens
        eth = new MockZRC20("Ethereum", "ETH", 18, 1000000 * 1e18);
        usdc = new MockZRC20("USD Coin", "USDC", 6, 1000000 * 1e6);
        btc = new MockZRC20("Bitcoin", "BTC", 8, 10000 * 1e8);

        // Deploy mock price oracle
        priceOracle = new MockPriceOracle();

        // Set prices
        priceOracle.setPrice(address(eth), ETH_PRICE);
        priceOracle.setPrice(address(usdc), USDC_PRICE);
        priceOracle.setPrice(address(btc), BTC_PRICE);
    }

    // ==================== Health Factor Calculation Tests ====================

    function testCalculateHealthFactor_HealthyPosition() public {
        uint256 totalCollateralValue = 5000 * 1e18; // $5000
        uint256 totalDebtValue = 2000 * 1e18;       // $2000
        uint256 liquidationThreshold = 85e16;       // 0.85 in 1e18 precision

        uint256 healthFactor = LiquidationLogic.calculateHealthFactor(
            totalCollateralValue,
            totalDebtValue,
            liquidationThreshold
        );

        // Health factor = ($5000 * 0.85) / $2000 = $4250 / $2000 = 2.125
        assertEq(healthFactor, 2125e15, "Health factor should be 2.125");
    }

    function testCalculateHealthFactor_CriticalPosition() public {
        uint256 totalCollateralValue = 3000 * 1e18; // $3000
        uint256 totalDebtValue = 2500 * 1e18;       // $2500
        uint256 liquidationThreshold = 80e16;       // 0.80 in 1e18 precision

        uint256 healthFactor = LiquidationLogic.calculateHealthFactor(
            totalCollateralValue,
            totalDebtValue,
            liquidationThreshold
        );

        // Health factor = ($3000 * 0.80) / $2500 = $2400 / $2500 = 0.96
        assertEq(healthFactor, 96e16, "Health factor should be 0.96");
        assertTrue(healthFactor < LIQUIDATION_THRESHOLD, "Position should be liquidatable");
    }

    function testCalculateHealthFactor_NoDebt() public {
        uint256 totalCollateralValue = 5000 * 1e18; // $5000
        uint256 totalDebtValue = 0;                 // No debt
        uint256 liquidationThreshold = 85e16;       // 0.85 in 1e18 precision

        uint256 healthFactor = LiquidationLogic.calculateHealthFactor(
            totalCollateralValue,
            totalDebtValue,
            liquidationThreshold
        );

        // No debt should return maximum uint256 (infinite health)
        assertEq(healthFactor, type(uint256).max, "No debt should have infinite health factor");
    }

    function testCalculateHealthFactor_NoCollateral() public {
        uint256 totalCollateralValue = 0;           // No collateral
        uint256 totalDebtValue = 1000 * 1e18;      // $1000 debt
        uint256 liquidationThreshold = 85e16;       // 0.85 in 1e18 precision

        uint256 healthFactor = LiquidationLogic.calculateHealthFactor(
            totalCollateralValue,
            totalDebtValue,
            liquidationThreshold
        );

        // No collateral with debt should return 0 health factor
        assertEq(healthFactor, 0, "No collateral with debt should have 0 health factor");
    }

    // ==================== Collateral Value Calculation Tests ====================

    function testCalculateCollateralValue_ETH() public {
        uint256 ethAmount = 2 * 1e18; // 2 ETH
        uint256 collateralFactor = 80e16; // 80% collateral factor

        uint256 collateralValue = LiquidationLogic.calculateCollateralValue(
            address(eth),
            ethAmount,
            collateralFactor,
            priceOracle
        );

        // Expected: 2 ETH * $2000 * 0.80 = $3200
        assertEq(collateralValue, 3200 * 1e18, "ETH collateral value should be $3200");
    }

    function testCalculateCollateralValue_USDC() public {
        uint256 usdcAmount = 5000 * 1e6; // 5000 USDC (6 decimals)
        uint256 collateralFactor = 90e16; // 90% collateral factor

        uint256 collateralValue = LiquidationLogic.calculateCollateralValue(
            address(usdc),
            usdcAmount,
            collateralFactor,
            priceOracle
        );

        // Expected: 5000 USDC * $1 * 0.90 = $4500
        assertEq(collateralValue, 4500 * 1e18, "USDC collateral value should be $4500");
    }

    function testCalculateCollateralValue_BTC() public {
        uint256 btcAmount = 1e7; // 0.1 BTC (8 decimals)
        uint256 collateralFactor = 75e16; // 75% collateral factor

        uint256 collateralValue = LiquidationLogic.calculateCollateralValue(
            address(btc),
            btcAmount,
            collateralFactor,
            priceOracle
        );

        // Expected: 0.1 BTC * $50000 * 0.75 = $3750
        assertEq(collateralValue, 3750 * 1e18, "BTC collateral value should be $3750");
    }

    function testCalculateCollateralValue_ZeroAmount() public {
        uint256 collateralValue = LiquidationLogic.calculateCollateralValue(
            address(eth),
            0, // Zero amount
            80e16,
            priceOracle
        );

        assertEq(collateralValue, 0, "Zero amount should result in zero collateral value");
    }

    function testCalculateCollateralValue_ZeroCollateralFactor() public {
        uint256 ethAmount = 1 * 1e18; // 1 ETH
        uint256 collateralFactor = 0; // No collateral factor

        uint256 collateralValue = LiquidationLogic.calculateCollateralValue(
            address(eth),
            ethAmount,
            collateralFactor,
            priceOracle
        );

        assertEq(collateralValue, 0, "Zero collateral factor should result in zero value");
    }

    // ==================== Debt Value Calculation Tests ====================

    function testCalculateDebtValue_ETH() public {
        uint256 ethAmount = 1 * 1e18; // 1 ETH debt

        uint256 debtValue = LiquidationLogic.calculateDebtValue(
            address(eth),
            ethAmount,
            priceOracle
        );

        // Expected: 1 ETH * $2000 = $2000
        assertEq(debtValue, 2000 * 1e18, "ETH debt value should be $2000");
    }

    function testCalculateDebtValue_USDC() public {
        uint256 usdcAmount = 1500 * 1e6; // 1500 USDC (6 decimals)

        uint256 debtValue = LiquidationLogic.calculateDebtValue(
            address(usdc),
            usdcAmount,
            priceOracle
        );

        // Expected: 1500 USDC * $1 = $1500
        assertEq(debtValue, 1500 * 1e18, "USDC debt value should be $1500");
    }

    function testCalculateDebtValue_ZeroAmount() public {
        uint256 debtValue = LiquidationLogic.calculateDebtValue(
            address(eth),
            0, // Zero debt
            priceOracle
        );

        assertEq(debtValue, 0, "Zero debt should result in zero value");
    }

    // ==================== Liquidation Amount Calculation Tests ====================

    function testCalculateLiquidationAmount_StandardCase() public {
        uint256 debtToCover = 500 * 1e6;           // 500 USDC (6 decimals)
        uint256 debtPrice = USDC_PRICE;            // $1
        uint256 collateralPrice = ETH_PRICE;       // $2000
        uint256 liquidationBonus = 5e16;          // 5% bonus (0.05 in 1e18)
        address debtAsset = address(usdc);
        address collateralAsset = address(eth);

        uint256 liquidatedCollateral = LiquidationLogic.calculateLiquidationAmount(
            debtToCover,
            debtPrice,
            collateralPrice,
            liquidationBonus,
            debtAsset,
            collateralAsset
        );

        // Calculation:
        // Debt value = 500 USDC * $1 = $500
        // Collateral value with bonus = $500 * 1.05 = $525
        // Collateral amount = $525 / $2000 = 0.2625 ETH
        uint256 expectedCollateral = 2625e14; // 0.2625 ETH in 1e18
        assertEq(liquidatedCollateral, expectedCollateral, "Liquidated collateral should be 0.2625 ETH");
    }

    function testCalculateLiquidationAmount_SameAsset() public {
        // Test liquidation where debt and collateral are the same asset
        uint256 debtToCover = 1000 * 1e6;         // 1000 USDC
        uint256 debtPrice = USDC_PRICE;           // $1
        uint256 collateralPrice = USDC_PRICE;     // $1 (same asset)
        uint256 liquidationBonus = 8e16;         // 8% bonus (0.08 in 1e18)
        address debtAsset = address(usdc);
        address collateralAsset = address(usdc);

        uint256 liquidatedCollateral = LiquidationLogic.calculateLiquidationAmount(
            debtToCover,
            debtPrice,
            collateralPrice,
            liquidationBonus,
            debtAsset,
            collateralAsset
        );

        // Same asset liquidation: 1000 USDC * 1.08 = 1080 USDC
        uint256 expectedCollateral = 1080 * 1e6;
        assertEq(liquidatedCollateral, expectedCollateral, "Same asset liquidation should be 1080 USDC");
    }

    function testCalculateLiquidationAmount_ZeroDebt() public {
        uint256 liquidatedCollateral = LiquidationLogic.calculateLiquidationAmount(
            0, // Zero debt
            USDC_PRICE,
            ETH_PRICE,
            5e16,
            address(usdc),
            address(eth)
        );

        assertEq(liquidatedCollateral, 0, "Zero debt should result in zero collateral");
    }

    function testCalculateLiquidationAmount_ZeroBonus() public {
        uint256 debtToCover = 1000 * 1e18;        // 1000 ETH
        uint256 debtPrice = ETH_PRICE;            // $2000
        uint256 collateralPrice = ETH_PRICE;      // $2000
        uint256 liquidationBonus = 0;             // No bonus
        address debtAsset = address(eth);
        address collateralAsset = address(eth);

        uint256 liquidatedCollateral = LiquidationLogic.calculateLiquidationAmount(
            debtToCover,
            debtPrice,
            collateralPrice,
            liquidationBonus,
            debtAsset,
            collateralAsset
        );

        // No bonus: liquidated amount should equal debt amount
        assertEq(liquidatedCollateral, debtToCover, "No bonus should equal debt amount");
    }

    // ==================== Cross-Decimal Precision Tests ====================

    function testCalculateLiquidationAmount_CrossDecimalPrecision() public {
        // Test precision with assets having different decimals
        uint256 debtToCover = 1 * 1e8;            // 1 BTC (8 decimals)
        uint256 debtPrice = BTC_PRICE;            // $50000
        uint256 collateralPrice = USDC_PRICE;     // $1
        uint256 liquidationBonus = 5e16;         // 5% bonus (0.05 in 1e18)
        address debtAsset = address(btc);
        address collateralAsset = address(usdc);

        uint256 liquidatedCollateral = LiquidationLogic.calculateLiquidationAmount(
            debtToCover,
            debtPrice,
            collateralPrice,
            liquidationBonus,
            debtAsset,
            collateralAsset
        );

        // Calculation:
        // Debt value = 1 BTC * $50000 = $50000
        // Collateral value with bonus = $50000 * 1.05 = $52500
        // USDC amount = $52500 / $1 = 52500 USDC
        uint256 expectedCollateral = 52500 * 1e6; // USDC has 6 decimals
        assertEq(liquidatedCollateral, expectedCollateral, "Cross-decimal should be 52500 USDC");
    }

    // ==================== Integration Tests ====================

    function testIntegration_LiquidationScenario() public {
        // Complete liquidation scenario
        uint256 collateralValue = 3000 * 1e18;    // $3000 ETH collateral
        uint256 debtValue = 2600 * 1e18;          // $2600 USDC debt
        uint256 liquidationThreshold = 85e16;     // 0.85 in 1e18 precision

        // 1. Calculate health factor
        uint256 healthFactor = LiquidationLogic.calculateHealthFactor(
            collateralValue,
            debtValue,
            liquidationThreshold
        );

        // Health factor = ($3000 * 0.85) / $2600 = $2550 / $2600 = 0.9808
        assertApproxEqRel(healthFactor, 9808e14, 1e16, "Health factor should be ~0.9808");

        // 2. Check if liquidatable (health factor < 1.2)
        bool isLiquidatable = healthFactor < LIQUIDATION_THRESHOLD;
        assertTrue(isLiquidatable, "Position should be liquidatable");

        // 3. Calculate liquidation amount for partial liquidation (50% of debt)
        uint256 debtToCover = 1300 * 1e6; // 1300 USDC (50% of debt)
        uint256 liquidatedCollateral = LiquidationLogic.calculateLiquidationAmount(
            debtToCover,
            USDC_PRICE,
            ETH_PRICE,
            5e16, // 5% bonus
            address(usdc),
            address(eth)
        );

        // Expected: $1300 * 1.05 / $2000 = 0.6825 ETH
        uint256 expectedCollateral = 6825e14; // 0.6825 ETH in 1e18
        assertEq(liquidatedCollateral, expectedCollateral, "Liquidated collateral should be 0.6825 ETH");
    }

    function testIntegration_HealthFactorAfterLiquidation() public {
        // Test health factor improvement after liquidation
        uint256 initialCollateral = 4000 * 1e18;  // $4000
        uint256 initialDebt = 3200 * 1e18;        // $3200
        uint256 liquidationThreshold = 85e16;     // 0.85

        // Initial health factor
        uint256 initialHF = LiquidationLogic.calculateHealthFactor(
            initialCollateral,
            initialDebt,
            liquidationThreshold
        );
        assertTrue(initialHF < LIQUIDATION_THRESHOLD, "Initial position should be liquidatable");

        // After liquidating $1500 debt and $1575 collateral (with 5% bonus)
        // This removes a larger portion of debt relative to collateral
        uint256 debtAfterLiquidation = initialDebt - (1500 * 1e18);
        uint256 collateralAfterLiquidation = initialCollateral - (1575 * 1e18);

        uint256 finalHF = LiquidationLogic.calculateHealthFactor(
            collateralAfterLiquidation,
            debtAfterLiquidation,
            liquidationThreshold
        );

        // Initial HF = ($4000 * 0.85) / $3200 = $3400 / $3200 = 1.0625 (liquidatable)
        // Final HF = ($2425 * 0.85) / $1700 = $2061.25 / $1700 = 1.2125 (healthy)
        assertTrue(finalHF > initialHF, "Health factor should improve after liquidation");
        assertTrue(finalHF > LIQUIDATION_THRESHOLD, "Position should be healthy after liquidation");
    }
}