// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import "forge-std/Test.sol";
import "../../contracts/libraries/HealthFactorLogic.sol";
import "../../contracts/libraries/UserAssetCalculations.sol";
import "../../contracts/interfaces/IUniversalLendingProtocol.sol";
import "../../contracts/mocks/MockZRC20.sol";
import "../../contracts/mocks/MockPriceOracle.sol";

/**
 * @title HealthFactorLogicTest
 * @notice Comprehensive test suite for HealthFactorLogic library
 * @dev Tests health factor calculations, borrowing/withdrawal validation, and edge cases
 */
contract HealthFactorLogicTest is Test {
    using HealthFactorLogic for *;

    MockZRC20 public usdc; // 6 decimals
    MockZRC20 public eth; // 18 decimals
    MockPriceOracle public priceOracle;

    // Test storage variables (simulating main contract storage)
    address[] public supportedAssets;
    mapping(address => mapping(address => uint256)) public userSupplies;
    mapping(address => mapping(address => uint256)) public userBorrows;
    mapping(address => IUniversalLendingProtocol.AssetConfig)
        public enhancedAssets;

    address public constant USER1 = address(0x1);
    address public constant USER2 = address(0x2);

    uint256 constant PRECISION = 1e18;
    uint256 constant MINIMUM_HEALTH_FACTOR = 1.5e18;
    uint256 constant LIQUIDATION_THRESHOLD = 1.2e18;

    function setUp() public {
        // Deploy mock tokens
        usdc = new MockZRC20("USD Coin", "USDC", 6, 1000000 * 10 ** 6);
        eth = new MockZRC20("Ethereum", "ETH", 18, 1000000 * 10 ** 18);

        // Deploy mock price oracle
        priceOracle = new MockPriceOracle();

        // Set up supported assets
        supportedAssets.push(address(usdc));
        supportedAssets.push(address(eth));

        // Configure asset parameters
        enhancedAssets[address(usdc)] = IUniversalLendingProtocol.AssetConfig({
            isSupported: true,
            collateralFactor: 0.9e18, // 90% collateral factor
            liquidationThreshold: 0.95e18, // 95% liquidation threshold
            liquidationBonus: 0.05e18, // 5% liquidation bonus
            borrowRate: 0.05e18, // 5% borrow rate
            supplyRate: 0.04e18, // 4% supply rate
            totalSupply: 0,
            totalBorrow: 0
        });

        enhancedAssets[address(eth)] = IUniversalLendingProtocol.AssetConfig({
            isSupported: true,
            collateralFactor: 0.8e18, // 80% collateral factor
            liquidationThreshold: 0.85e18, // 85% liquidation threshold
            liquidationBonus: 0.1e18, // 10% liquidation bonus
            borrowRate: 0.06e18, // 6% borrow rate
            supplyRate: 0.05e18, // 5% supply rate
            totalSupply: 0,
            totalBorrow: 0
        });

        // Set initial prices
        priceOracle.setPrice(address(usdc), 1e18); // $1.00
        priceOracle.setPrice(address(eth), 2000e18); // $2000.00
    }

    // ==================== Health Factor Calculation Tests ====================

    function testCalculateHealthFactor_NoDebt() public {
        // User has collateral but no debt - should return max health factor
        userSupplies[USER1][address(usdc)] = 1000e6; // $1000 USDC

        uint256 healthFactor = HealthFactorLogic.calculateHealthFactor(
            USER1,
            supportedAssets,
            userSupplies,
            userBorrows,
            enhancedAssets,
            priceOracle
        );

        assertEq(
            healthFactor,
            type(uint256).max,
            "Should return max health factor with no debt"
        );
    }

    function testCalculateHealthFactor_HealthyPosition() public {
        // Set up a healthy position: $1000 USDC collateral, $500 USDC debt
        userSupplies[USER1][address(usdc)] = 1000e6; // $1000 USDC
        userBorrows[USER1][address(usdc)] = 500e6; // $500 USDC debt

        uint256 healthFactor = HealthFactorLogic.calculateHealthFactor(
            USER1,
            supportedAssets,
            userSupplies,
            userBorrows,
            enhancedAssets,
            priceOracle
        );

        // Expected: (1000 * 0.95) / 500 = 1.9
        assertEq(
            healthFactor,
            1.9e18,
            "Should calculate correct health factor for healthy position"
        );
    }

    function testCalculateHealthFactor_MultiAsset() public {
        // Set up multi-asset position
        userSupplies[USER1][address(usdc)] = 1000e6; // $1000 USDC
        userSupplies[USER1][address(eth)] = 1e18; // 1 ETH ($2000)
        userBorrows[USER1][address(usdc)] = 1000e6; // $1000 USDC debt

        uint256 healthFactor = HealthFactorLogic.calculateHealthFactor(
            USER1,
            supportedAssets,
            userSupplies,
            userBorrows,
            enhancedAssets,
            priceOracle
        );

        // Expected weighted collateral: (1000 * 0.95) + (2000 * 0.85) = 950 + 1700 = 2650
        // Health factor: 2650 / 1000 = 2.65
        assertEq(
            healthFactor,
            2.65e18,
            "Should calculate correct health factor for multi-asset position"
        );
    }

    function testCalculateHealthFactorWithModification_BorrowSimulation()
        public
    {
        // Set up existing position
        userSupplies[USER1][address(usdc)] = 1000e6; // $1000 USDC
        userBorrows[USER1][address(usdc)] = 300e6; // $300 USDC debt

        // Simulate borrowing additional $200 USDC
        uint256 newHealthFactor = HealthFactorLogic
            .calculateHealthFactorWithModification(
                USER1,
                address(usdc),
                userSupplies[USER1][address(usdc)], // Supply unchanged
                userBorrows[USER1][address(usdc)] + 200e6, // New debt = 500
                supportedAssets,
                userSupplies,
                userBorrows,
                enhancedAssets,
                priceOracle
            );

        // Expected: (1000 * 0.95) / 500 = 1.9
        assertEq(
            newHealthFactor,
            1.9e18,
            "Should simulate health factor after borrow"
        );
    }

    function testCalculateHealthFactorWithModification_WithdrawSimulation()
        public
    {
        // Set up existing position
        userSupplies[USER1][address(usdc)] = 1000e6; // $1000 USDC
        userBorrows[USER1][address(usdc)] = 400e6; // $400 USDC debt

        // Simulate withdrawing $200 USDC
        uint256 newHealthFactor = HealthFactorLogic
            .calculateHealthFactorWithModification(
                USER1,
                address(usdc),
                userSupplies[USER1][address(usdc)] - 200e6, // New supply = 800
                userBorrows[USER1][address(usdc)], // Debt unchanged
                supportedAssets,
                userSupplies,
                userBorrows,
                enhancedAssets,
                priceOracle
            );

        // Expected: (800 * 0.95) / 400 = 1.9
        assertEq(
            newHealthFactor,
            1.9e18,
            "Should simulate health factor after withdraw"
        );
    }

    // ==================== Borrowing Validation Tests ====================

    function testCanBorrow_HealthyPosition() public {
        // Set up healthy position with sufficient collateral
        userSupplies[USER1][address(usdc)] = 1500e6; // $1500 USDC
        userBorrows[USER1][address(usdc)] = 500e6; // $500 USDC debt

        // Mock contract balance
        uint256 contractBalance = 1000e6;

        bool canBorrow = HealthFactorLogic.canBorrow(
            USER1,
            address(usdc),
            300e6, // Try to borrow $300 more
            contractBalance,
            supportedAssets,
            userSupplies,
            userBorrows,
            enhancedAssets,
            priceOracle
        );

        assertTrue(
            canBorrow,
            "Should allow borrowing with sufficient collateral"
        );
    }

    function testCanBorrow_InsufficientCollateral() public {
        // Set up position at the edge
        userSupplies[USER1][address(usdc)] = 1000e6; // $1000 USDC
        userBorrows[USER1][address(usdc)] = 600e6; // $600 USDC debt

        uint256 contractBalance = 1000e6;

        bool canBorrow = HealthFactorLogic.canBorrow(
            USER1,
            address(usdc),
            100e6, // Try to borrow $100 more (would make health factor < 1.5)
            contractBalance,
            supportedAssets,
            userSupplies,
            userBorrows,
            enhancedAssets,
            priceOracle
        );

        assertFalse(
            canBorrow,
            "Should reject borrowing with insufficient collateral"
        );
    }

    function testCanBorrow_UnsupportedAsset() public {
        MockZRC20 unsupportedToken = new MockZRC20(
            "Unsupported",
            "UNS",
            18,
            1000000 * 10 ** 18
        );
        uint256 contractBalance = 1000e18;

        bool canBorrow = HealthFactorLogic.canBorrow(
            USER1,
            address(unsupportedToken),
            100e18,
            contractBalance,
            supportedAssets,
            userSupplies,
            userBorrows,
            enhancedAssets,
            priceOracle
        );

        assertFalse(canBorrow, "Should reject borrowing unsupported asset");
    }

    function testCanBorrow_InsufficientContractBalance() public {
        // Set up healthy position
        userSupplies[USER1][address(usdc)] = 2000e6;

        // Contract doesn't have enough balance
        uint256 contractBalance = 50e6;

        bool canBorrow = HealthFactorLogic.canBorrow(
            USER1,
            address(usdc),
            100e6, // More than contract balance
            contractBalance,
            supportedAssets,
            userSupplies,
            userBorrows,
            enhancedAssets,
            priceOracle
        );

        assertFalse(
            canBorrow,
            "Should reject borrowing when contract has insufficient balance"
        );
    }

    // ==================== Withdrawal Validation Tests ====================

    function testCanWithdraw_HealthyPosition() public {
        // Set up position with excess collateral
        userSupplies[USER1][address(usdc)] = 2000e6; // $2000 USDC
        userBorrows[USER1][address(usdc)] = 500e6; // $500 USDC debt

        uint256 contractBalance = 2000e6;

        bool canWithdraw = HealthFactorLogic.canWithdraw(
            USER1,
            address(usdc),
            500e6, // Withdraw $500
            contractBalance,
            supportedAssets,
            userSupplies,
            userBorrows,
            enhancedAssets,
            priceOracle
        );

        assertTrue(
            canWithdraw,
            "Should allow withdrawal with sufficient remaining collateral"
        );
    }

    function testCanWithdraw_NoDebt() public {
        // User has no debt - should be able to withdraw everything
        userSupplies[USER1][address(usdc)] = 1000e6;

        uint256 contractBalance = 1000e6;

        bool canWithdraw = HealthFactorLogic.canWithdraw(
            USER1,
            address(usdc),
            1000e6, // Withdraw everything
            contractBalance,
            supportedAssets,
            userSupplies,
            userBorrows,
            enhancedAssets,
            priceOracle
        );

        assertTrue(canWithdraw, "Should allow full withdrawal with no debt");
    }

    function testCanWithdraw_InsufficientBalance() public {
        // User tries to withdraw more than they have
        userSupplies[USER1][address(usdc)] = 500e6;

        uint256 contractBalance = 1000e6;

        bool canWithdraw = HealthFactorLogic.canWithdraw(
            USER1,
            address(usdc),
            600e6, // More than user balance
            contractBalance,
            supportedAssets,
            userSupplies,
            userBorrows,
            enhancedAssets,
            priceOracle
        );

        assertFalse(
            canWithdraw,
            "Should reject withdrawal exceeding user balance"
        );
    }

    function testCanWithdraw_WouldViolateHealthFactor() public {
        // Set up position where withdrawal would violate health factor
        userSupplies[USER1][address(usdc)] = 1000e6; // $1000 USDC
        userBorrows[USER1][address(usdc)] = 600e6; // $600 USDC debt

        uint256 contractBalance = 1000e6;

        bool canWithdraw = HealthFactorLogic.canWithdraw(
            USER1,
            address(usdc),
            200e6, // Would leave only $800, health factor = (800*0.95)/600 = 1.27 < 1.5
            contractBalance,
            supportedAssets,
            userSupplies,
            userBorrows,
            enhancedAssets,
            priceOracle
        );

        assertFalse(
            canWithdraw,
            "Should reject withdrawal that would violate health factor"
        );
    }

    // ==================== Liquidation Tests ====================

    function testIsLiquidatable_HealthyPosition() public {
        // Set up healthy position
        userSupplies[USER1][address(usdc)] = 1000e6;
        userBorrows[USER1][address(usdc)] = 400e6;

        bool liquidatable = HealthFactorLogic.isLiquidatable(
            USER1,
            supportedAssets,
            userSupplies,
            userBorrows,
            enhancedAssets,
            priceOracle
        );

        assertFalse(
            liquidatable,
            "Healthy position should not be liquidatable"
        );
    }

    function testIsLiquidatable_UnderLiquidationThreshold() public {
        // Set up position below liquidation threshold
        userSupplies[USER1][address(usdc)] = 1000e6; // $1000 USDC
        userBorrows[USER1][address(usdc)] = 850e6; // $850 USDC debt

        bool liquidatable = HealthFactorLogic.isLiquidatable(
            USER1,
            supportedAssets,
            userSupplies,
            userBorrows,
            enhancedAssets,
            priceOracle
        );

        // Health factor: (1000 * 0.95) / 850 = 1.176... < 1.2
        assertTrue(
            liquidatable,
            "Position below liquidation threshold should be liquidatable"
        );
    }

    function testIsLiquidatable_NoDebt() public {
        // User with no debt should not be liquidatable
        userSupplies[USER1][address(usdc)] = 1000e6;

        bool liquidatable = HealthFactorLogic.isLiquidatable(
            USER1,
            supportedAssets,
            userSupplies,
            userBorrows,
            enhancedAssets,
            priceOracle
        );

        assertFalse(
            liquidatable,
            "Position with no debt should not be liquidatable"
        );
    }

    // ==================== Maximum Borrow Capacity Tests ====================

    function testGetMaxBorrowableUsd_HealthyPosition() public {
        // Set up position with collateral
        userSupplies[USER1][address(usdc)] = 1500e6; // $1500 USDC
        userBorrows[USER1][address(usdc)] = 300e6; // $300 USDC debt

        uint256 maxBorrowUsd = HealthFactorLogic.getMaxBorrowableUsd(
            USER1,
            supportedAssets,
            userSupplies,
            userBorrows,
            enhancedAssets,
            priceOracle
        );

        // Borrowable collateral: 1500 * 0.9 = 1350
        // Max total debt: 1350 / 1.5 = 900
        // Available to borrow: 900 - 300 = 600
        assertEq(
            maxBorrowUsd,
            600e18,
            "Should calculate correct max borrowable USD"
        );
    }

    function testGetMaxBorrowableUsd_NoCollateral() public view {
        uint256 maxBorrowUsd = HealthFactorLogic.getMaxBorrowableUsd(
            USER1,
            supportedAssets,
            userSupplies,
            userBorrows,
            enhancedAssets,
            priceOracle
        );

        assertEq(maxBorrowUsd, 0, "Should return zero with no collateral");
    }

    function testGetMaxBorrowableUsd_OverBorrowed() public {
        // Position that is already over-borrowed (shouldn't happen in practice)
        userSupplies[USER1][address(usdc)] = 1000e6; // $1000 USDC
        userBorrows[USER1][address(usdc)] = 700e6; // $700 USDC debt (exceeds safe limit)

        uint256 maxBorrowUsd = HealthFactorLogic.getMaxBorrowableUsd(
            USER1,
            supportedAssets,
            userSupplies,
            userBorrows,
            enhancedAssets,
            priceOracle
        );

        assertEq(
            maxBorrowUsd,
            0,
            "Should return zero when already over-borrowed"
        );
    }

    function testGetMaxBorrowableAmount_USDC() public {
        // Set up collateral
        userSupplies[USER1][address(usdc)] = 1500e6; // $1500 USDC

        uint256 contractBalance = 1000e6;

        uint256 maxBorrowAmount = HealthFactorLogic.getMaxBorrowableAmount(
            USER1,
            address(usdc),
            contractBalance,
            supportedAssets,
            userSupplies,
            userBorrows,
            enhancedAssets,
            priceOracle
        );

        // Max borrowable USD: (1500 * 0.9) / 1.5 = 900
        // At $1 per USDC = 900 USDC
        // Limited by contract balance = 1000 USDC
        // So max = 900 USDC
        assertEq(
            maxBorrowAmount,
            900e6,
            "Should calculate correct max borrowable USDC amount"
        );
    }

    function testGetMaxBorrowableAmount_ContractBalanceLimit() public {
        // Set up large collateral but limited contract balance
        userSupplies[USER1][address(usdc)] = 10000e6; // $10,000 USDC

        uint256 contractBalance = 500e6; // Only $500 available

        uint256 maxBorrowAmount = HealthFactorLogic.getMaxBorrowableAmount(
            USER1,
            address(usdc),
            contractBalance,
            supportedAssets,
            userSupplies,
            userBorrows,
            enhancedAssets,
            priceOracle
        );

        // Should be limited by contract balance
        assertEq(
            maxBorrowAmount,
            500e6,
            "Should be limited by contract balance"
        );
    }

    // ==================== Health Factor Status Tests ====================

    function testGetHealthFactorStatus_Healthy() public pure {
        uint256 healthyHF = 2e18; // 200%
        uint8 status = HealthFactorLogic.getHealthFactorStatus(healthyHF);
        assertEq(status, 0, "Should return healthy status");
    }

    function testGetHealthFactorStatus_Risky() public pure {
        uint256 riskyHF = 1.3e18; // 130% - between liquidation threshold and minimum
        uint8 status = HealthFactorLogic.getHealthFactorStatus(riskyHF);
        assertEq(status, 1, "Should return risky status");
    }

    function testGetHealthFactorStatus_Liquidatable() public pure {
        uint256 liquidatableHF = 1.1e18; // 110% - below liquidation threshold
        uint8 status = HealthFactorLogic.getHealthFactorStatus(liquidatableHF);
        assertEq(status, 2, "Should return liquidatable status");
    }

    function testGetHealthFactorStatus_NoDebt() public pure {
        uint256 noDebtHF = type(uint256).max;
        uint8 status = HealthFactorLogic.getHealthFactorStatus(noDebtHF);
        assertEq(status, 3, "Should return no debt status");
    }

    // ==================== Health Factor Improvement Tests ====================

    function testGetHealthFactorImprovementNeeded_Healthy() public pure {
        uint256 healthyHF = 2e18;
        uint256 totalDebt = 1000e18;

        uint256 improvement = HealthFactorLogic
            .getHealthFactorImprovementNeeded(healthyHF, totalDebt);
        assertEq(improvement, 0, "Healthy position should need no improvement");
    }

    function testGetHealthFactorImprovementNeeded_NeedsImprovement()
        public
        pure
    {
        uint256 lowHF = 1.3e18; // 130%
        uint256 totalDebt = 1000e18;

        uint256 improvement = HealthFactorLogic
            .getHealthFactorImprovementNeeded(lowHF, totalDebt);

        // Current weighted collateral: 1.3 * 1000 = 1300
        // Needed weighted collateral: 1.5 * 1000 = 1500
        // Improvement needed: 1500 - 1300 = 200
        assertEq(
            improvement,
            200e18,
            "Should calculate correct improvement needed"
        );
    }

    function testGetHealthFactorImprovementNeeded_NoDebt() public pure {
        uint256 improvement = HealthFactorLogic
            .getHealthFactorImprovementNeeded(1e18, 0);
        assertEq(
            improvement,
            0,
            "Should return zero improvement needed with no debt"
        );
    }

    // ==================== Health Factor Improvement Validation Tests ====================

    function testValidateHealthFactorImprovement_ValidImprovement()
        public
        pure
    {
        uint256 oldHF = 1.1e18; // Below threshold
        uint256 newHF = 1.6e18; // Above minimum

        bool isValid = HealthFactorLogic.validateHealthFactorImprovement(
            oldHF,
            newHF
        );
        assertTrue(
            isValid,
            "Should validate sufficient health factor improvement"
        );
    }

    function testValidateHealthFactorImprovement_InsufficientImprovement()
        public
        pure
    {
        uint256 oldHF = 1.1e18; // Below threshold
        uint256 newHF = 1.4e18; // Still below minimum

        bool isValid = HealthFactorLogic.validateHealthFactorImprovement(
            oldHF,
            newHF
        );
        assertFalse(
            isValid,
            "Should reject insufficient health factor improvement"
        );
    }

    function testValidateHealthFactorImprovement_NoImprovement() public pure {
        uint256 oldHF = 1.1e18;
        uint256 newHF = 1.1e18; // Same as before

        bool isValid = HealthFactorLogic.validateHealthFactorImprovement(
            oldHF,
            newHF
        );
        assertFalse(
            isValid,
            "Should reject when health factor doesn't improve"
        );
    }

    // ==================== Edge Case Tests ====================

    function testHealthFactor_VerySmallDebt() public {
        userSupplies[USER1][address(usdc)] = 1000e6;
        userBorrows[USER1][address(usdc)] = 1; // 1 micro-cent

        uint256 healthFactor = HealthFactorLogic.calculateHealthFactor(
            USER1,
            supportedAssets,
            userSupplies,
            userBorrows,
            enhancedAssets,
            priceOracle
        );

        assertTrue(
            healthFactor > 1000e18,
            "Should handle very small debt correctly"
        );
    }

    function testHealthFactor_VeryLargeAmounts() public {
        // Test with large amounts (but within practical limits)
        uint256 largeAmount = 1e12 * 1e6; // 1 trillion USDC
        userSupplies[USER1][address(usdc)] = largeAmount;
        userBorrows[USER1][address(usdc)] = largeAmount / 2;

        uint256 healthFactor = HealthFactorLogic.calculateHealthFactor(
            USER1,
            supportedAssets,
            userSupplies,
            userBorrows,
            enhancedAssets,
            priceOracle
        );

        // Expected: (1T * 0.95) / (0.5T) = 1.9
        assertEq(healthFactor, 1.9e18, "Should handle large amounts correctly");
    }

    function testCanBorrow_PrecisionEdgeCase() public {
        // Set up position where precision matters
        userSupplies[USER1][address(usdc)] = 1000000; // $1.00 USDC (6 decimals)

        uint256 contractBalance = 1000000;

        // Try to borrow amount that would put health factor exactly at minimum
        uint256 maxSafeBorrow = (1000000 * 9) / 15; // Should be exactly at 1.5x health factor

        bool canBorrow = HealthFactorLogic.canBorrow(
            USER1,
            address(usdc),
            maxSafeBorrow,
            contractBalance,
            supportedAssets,
            userSupplies,
            userBorrows,
            enhancedAssets,
            priceOracle
        );

        assertTrue(canBorrow, "Should handle precision edge cases correctly");
    }
}
