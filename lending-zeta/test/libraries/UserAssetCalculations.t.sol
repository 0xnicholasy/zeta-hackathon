// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test, console} from "forge-std/Test.sol";
import {UserAssetCalculations} from "../../contracts/libraries/UserAssetCalculations.sol";
import {IUniversalLendingProtocol} from "../../contracts/interfaces/IUniversalLendingProtocol.sol";
import {MockZRC20} from "../../contracts/mocks/MockZRC20.sol";
import {MockPriceOracle} from "../../contracts/mocks/MockPriceOracle.sol";

contract UserAssetCalculationsTest is Test {
    MockZRC20 public eth;
    MockZRC20 public usdc;
    MockZRC20 public btc;
    MockPriceOracle public priceOracle;

    // Test addresses
    address public constant USER1 = address(0x1);
    address public constant USER2 = address(0x2);

    // Test asset prices (in 1e18 precision)
    uint256 public constant ETH_PRICE = 2000 * 1e18; // $2000
    uint256 public constant USDC_PRICE = 1 * 1e18; // $1
    uint256 public constant BTC_PRICE = 50000 * 1e18; // $50000

    // Test balances
    uint256 public constant INITIAL_BALANCE = 1000000 * 1e18;

    // Asset configurations
    mapping(address => IUniversalLendingProtocol.AssetConfig)
        public assetConfigs;
    mapping(address => mapping(address => uint256)) public userSupplies;
    mapping(address => mapping(address => uint256)) public userBorrows;
    address[] public supportedAssets;

    function setUp() public {
        // Deploy mock tokens
        eth = new MockZRC20("Ethereum", "ETH", 18, INITIAL_BALANCE);
        usdc = new MockZRC20("USD Coin", "USDC", 6, INITIAL_BALANCE);
        btc = new MockZRC20("Bitcoin", "BTC", 8, INITIAL_BALANCE);

        // Deploy mock price oracle
        priceOracle = new MockPriceOracle();

        // Set prices
        priceOracle.setPrice(address(eth), ETH_PRICE);
        priceOracle.setPrice(address(usdc), USDC_PRICE);
        priceOracle.setPrice(address(btc), BTC_PRICE);

        // Configure assets
        supportedAssets.push(address(eth));
        supportedAssets.push(address(usdc));
        supportedAssets.push(address(btc));

        // ETH configuration (80% collateral factor, 85% liquidation threshold)
        assetConfigs[address(eth)] = IUniversalLendingProtocol.AssetConfig({
            isSupported: true,
            collateralFactor: (8 * 1e18) / 10,
            liquidationThreshold: (85 * 1e18) / 100,
            liquidationBonus: (5 * 1e18) / 100,
            borrowRate: (5 * 1e18) / 100,
            supplyRate: (4 * 1e18) / 100,
            totalSupply: 0,
            totalBorrow: 0
        });

        // USDC configuration (90% collateral factor, 95% liquidation threshold)
        assetConfigs[address(usdc)] = IUniversalLendingProtocol.AssetConfig({
            isSupported: true,
            collateralFactor: (9 * 1e18) / 10,
            liquidationThreshold: (95 * 1e18) / 100,
            liquidationBonus: (2 * 1e18) / 100,
            borrowRate: (3 * 1e18) / 100,
            supplyRate: (25 * 1e18) / 1000,
            totalSupply: 0,
            totalBorrow: 0
        });

        // BTC configuration (75% collateral factor, 80% liquidation threshold)
        assetConfigs[address(btc)] = IUniversalLendingProtocol.AssetConfig({
            isSupported: true,
            collateralFactor: (75 * 1e18) / 100,
            liquidationThreshold: (80 * 1e18) / 100,
            liquidationBonus: (8 * 1e18) / 100,
            borrowRate: (4 * 1e18) / 100,
            supplyRate: (35 * 1e18) / 1000,
            totalSupply: 0,
            totalBorrow: 0
        });
    }

    // ==================== Core Asset Value Tests ====================

    function testGetAssetValues_ETH() public {
        uint256 supplyAmount = 2 * 1e18; // 2 ETH
        uint256 borrowAmount = (5 * 1e18) / 10; // 0.5 ETH

        userSupplies[USER1][address(eth)] = supplyAmount;
        userBorrows[USER1][address(eth)] = borrowAmount;

        (
            uint256 collateralValue,
            uint256 debtValue,
            uint256 borrowableValue,
            uint256 weightedValue
        ) = UserAssetCalculations.getAssetValues(
                USER1,
                address(eth),
                0,
                0,
                false,
                userSupplies,
                userBorrows,
                assetConfigs[address(eth)],
                ETH_PRICE
            );

        // ETH price is $2000
        // Supply: 2 ETH = $4000
        assertEq(
            collateralValue,
            4000 * 1e18,
            "Collateral value should be $4000"
        );

        // Debt: 0.5 ETH = $1000
        assertEq(debtValue, 1000 * 1e18, "Debt value should be $1000");

        // Borrowable: $4000 * 0.8 = $3200
        assertEq(
            borrowableValue,
            3200 * 1e18,
            "Borrowable value should be $3200"
        );

        // Weighted: $4000 * 0.85 = $3400
        assertEq(weightedValue, 3400 * 1e18, "Weighted value should be $3400");
    }

    function testGetAssetValues_USDC() public {
        uint256 supplyAmount = 5000 * 1e6; // 5000 USDC (6 decimals)
        uint256 borrowAmount = 1000 * 1e6; // 1000 USDC

        userSupplies[USER1][address(usdc)] = supplyAmount;
        userBorrows[USER1][address(usdc)] = borrowAmount;

        (
            uint256 collateralValue,
            uint256 debtValue,
            uint256 borrowableValue,
            uint256 weightedValue
        ) = UserAssetCalculations.getAssetValues(
                USER1,
                address(usdc),
                0,
                0,
                false,
                userSupplies,
                userBorrows,
                assetConfigs[address(usdc)],
                USDC_PRICE
            );

        // USDC price is $1
        assertEq(
            collateralValue,
            5000 * 1e18,
            "Collateral value should be $5000"
        );
        assertEq(debtValue, 1000 * 1e18, "Debt value should be $1000");
        assertEq(
            borrowableValue,
            4500 * 1e18,
            "Borrowable value should be $4500 (5000 * 0.9)"
        );
        assertEq(
            weightedValue,
            4750 * 1e18,
            "Weighted value should be $4750 (5000 * 0.95)"
        );
    }

    function testGetAssetValues_CustomBalances() public {
        // Test with custom balances (for simulation purposes)
        uint256 customSupply = 3 * 1e18; // 3 ETH
        uint256 customBorrow = 1 * 1e18; // 1 ETH

        (
            uint256 collateralValue,
            uint256 debtValue,
            uint256 borrowableValue,
            uint256 weightedValue
        ) = UserAssetCalculations.getAssetValues(
                USER1,
                address(eth),
                customSupply,
                customBorrow,
                true, // Use custom balances
                userSupplies,
                userBorrows,
                assetConfigs[address(eth)],
                ETH_PRICE
            );

        assertEq(
            collateralValue,
            6000 * 1e18,
            "Custom collateral should be $6000"
        );
        assertEq(debtValue, 2000 * 1e18, "Custom debt should be $2000");
        assertEq(
            borrowableValue,
            4800 * 1e18,
            "Custom borrowable should be $4800"
        );
        assertEq(weightedValue, 5100 * 1e18, "Custom weighted should be $5100");
    }

    function testGetAssetValues_ZeroBalances() public {
        // Test with zero balances
        (
            uint256 collateralValue,
            uint256 debtValue,
            uint256 borrowableValue,
            uint256 weightedValue
        ) = UserAssetCalculations.getAssetValues(
                USER1,
                address(eth),
                0,
                0,
                false,
                userSupplies,
                userBorrows,
                assetConfigs[address(eth)],
                ETH_PRICE
            );

        assertEq(collateralValue, 0, "Zero collateral should be $0");
        assertEq(debtValue, 0, "Zero debt should be $0");
        assertEq(borrowableValue, 0, "Zero borrowable should be $0");
        assertEq(weightedValue, 0, "Zero weighted should be $0");
    }

    // ==================== User Asset Data Calculation Tests ====================

    function testCalculateUserAssetData_SingleAsset() public {
        // User has 2 ETH supplied, 0.5 ETH borrowed
        userSupplies[USER1][address(eth)] = 2 * 1e18;
        userBorrows[USER1][address(eth)] = (5 * 1e18) / 10;

        UserAssetCalculations.UserAssetData memory userData = UserAssetCalculations
            .calculateUserAssetData(
                USER1,
                address(0), // no modified asset
                0,
                0, // no custom balances
                false, // don't use modified
                supportedAssets,
                userSupplies,
                userBorrows,
                assetConfigs,
                priceOracle
            );

        assertEq(
            userData.totalCollateralValue,
            4000 * 1e18,
            "Total collateral should be $4000"
        );
        assertEq(
            userData.totalDebtValue,
            1000 * 1e18,
            "Total debt should be $1000"
        );
        assertEq(
            userData.totalBorrowableCollateral,
            3200 * 1e18,
            "Total borrowable should be $3200"
        );
        assertEq(
            userData.totalWeightedCollateral,
            3400 * 1e18,
            "Total weighted should be $3400"
        );
    }

    function testCalculateUserAssetData_MultipleAssets() public {
        // User has:
        // - 1 ETH supplied ($2000), 0.2 ETH borrowed ($400)
        // - 3000 USDC supplied ($3000), 500 USDC borrowed ($500)
        // - 0.1 BTC supplied ($5000), no BTC borrowed

        userSupplies[USER1][address(eth)] = 1 * 1e18;
        userBorrows[USER1][address(eth)] = (2 * 1e18) / 10;

        userSupplies[USER1][address(usdc)] = 3000 * 1e6;
        userBorrows[USER1][address(usdc)] = 500 * 1e6;

        userSupplies[USER1][address(btc)] = (1 * 1e8) / 10; // BTC has 8 decimals
        userBorrows[USER1][address(btc)] = 0;

        UserAssetCalculations.UserAssetData
            memory userData = UserAssetCalculations.calculateUserAssetData(
                USER1,
                address(0),
                0,
                0,
                false,
                supportedAssets,
                userSupplies,
                userBorrows,
                assetConfigs,
                priceOracle
            );

        // Total collateral: $2000 + $3000 + $5000 = $10000
        assertEq(
            userData.totalCollateralValue,
            10000 * 1e18,
            "Total collateral should be $10000"
        );

        // Total debt: $400 + $500 + $0 = $900
        assertEq(
            userData.totalDebtValue,
            900 * 1e18,
            "Total debt should be $900"
        );

        // Total borrowable: ($2000 * 0.8) + ($3000 * 0.9) + ($5000 * 0.75) = $1600 + $2700 + $3750 = $8050
        assertEq(
            userData.totalBorrowableCollateral,
            8050 * 1e18,
            "Total borrowable should be $8050"
        );

        // Total weighted: ($2000 * 0.85) + ($3000 * 0.95) + ($5000 * 0.80) = $1700 + $2850 + $4000 = $8550
        assertEq(
            userData.totalWeightedCollateral,
            8550 * 1e18,
            "Total weighted should be $8550"
        );
    }

    function testCalculateUserAssetData_NoPositions() public {
        // User has no positions
        UserAssetCalculations.UserAssetData
            memory userData = UserAssetCalculations.calculateUserAssetData(
                USER1,
                address(0),
                0,
                0,
                false,
                supportedAssets,
                userSupplies,
                userBorrows,
                assetConfigs,
                priceOracle
            );

        assertEq(userData.totalCollateralValue, 0, "No collateral");
        assertEq(userData.totalDebtValue, 0, "No debt");
        assertEq(userData.totalBorrowableCollateral, 0, "No borrowable");
        assertEq(userData.totalWeightedCollateral, 0, "No weighted");
        assertEq(
            userData.weightedLiquidationThreshold,
            0,
            "No weighted threshold"
        );
    }

    function testCalculateUserAssetData_OnlySupply() public {
        // User only supplies, no borrowing
        userSupplies[USER1][address(eth)] = 1 * 1e18;
        userSupplies[USER1][address(usdc)] = 1000 * 1e6;

        UserAssetCalculations.UserAssetData
            memory userData = UserAssetCalculations.calculateUserAssetData(
                USER1,
                address(0),
                0,
                0,
                false,
                supportedAssets,
                userSupplies,
                userBorrows,
                assetConfigs,
                priceOracle
            );

        assertEq(
            userData.totalCollateralValue,
            3000 * 1e18,
            "Total collateral: $2000 + $1000"
        );
        assertEq(userData.totalDebtValue, 0, "No debt");
        assertEq(
            userData.totalBorrowableCollateral,
            2500 * 1e18,
            "Borrowable: $1600 + $900"
        );
        assertEq(
            userData.totalWeightedCollateral,
            2650 * 1e18,
            "Weighted: $1700 + $950"
        );
    }

    function testCalculateUserAssetData_OnlyBorrow() public {
        // Edge case: User only borrows (should not happen in practice but test for robustness)
        userBorrows[USER1][address(eth)] = (5 * 1e18) / 10;
        userBorrows[USER1][address(usdc)] = 100 * 1e6;

        UserAssetCalculations.UserAssetData
            memory userData = UserAssetCalculations.calculateUserAssetData(
                USER1,
                address(0),
                0,
                0,
                false,
                supportedAssets,
                userSupplies,
                userBorrows,
                assetConfigs,
                priceOracle
            );

        assertEq(userData.totalCollateralValue, 0, "No collateral");
        assertEq(
            userData.totalDebtValue,
            1100 * 1e18,
            "Total debt: $1000 + $100"
        );
        assertEq(userData.totalBorrowableCollateral, 0, "No borrowable");
        assertEq(userData.totalWeightedCollateral, 0, "No weighted");
    }

    function testCalculateUserAssetData_WithModification() public {
        // Test simulation with modified asset
        userSupplies[USER1][address(eth)] = 1 * 1e18; // existing supply
        userBorrows[USER1][address(usdc)] = 500 * 1e6; // existing debt

        // Simulate borrowing more ETH - we need to pass the existing supply balance too
        uint256 existingEthSupply = 1 * 1e18; // existing ETH supply
        uint256 newEthDebt = (5 * 1e18) / 10; // 0.5 ETH debt

        UserAssetCalculations.UserAssetData memory userData = UserAssetCalculations
            .calculateUserAssetData(
                USER1,
                address(eth), // modified asset
                existingEthSupply, // keep existing supply balance
                newEthDebt, // new debt balance
                true, // use modified
                supportedAssets,
                userSupplies,
                userBorrows,
                assetConfigs,
                priceOracle
            );

        // ETH: 1 * $2000 = $2000 collateral, 0.5 * $2000 = $1000 debt
        // USDC: 500 * $1 = $500 debt
        // Total collateral = $2000, Total debt = $1500
        assertEq(
            userData.totalCollateralValue,
            2000 * 1e18,
            "Total collateral should be $2000"
        );
        assertEq(
            userData.totalDebtValue,
            1500 * 1e18,
            "Total debt should be $1500 with modification"
        );
    }

    // ==================== Weighted Liquidation Threshold Tests ====================

    function testWeightedLiquidationThreshold_SingleAsset() public {
        userSupplies[USER1][address(eth)] = 2 * 1e18; // $4000 collateral

        UserAssetCalculations.UserAssetData
            memory userData = UserAssetCalculations.calculateUserAssetData(
                USER1,
                address(0),
                0,
                0,
                false,
                supportedAssets,
                userSupplies,
                userBorrows,
                assetConfigs,
                priceOracle
            );

        // Calculate weighted liquidation threshold manually
        uint256 threshold = userData.totalCollateralValue > 0
            ? userData.weightedLiquidationThreshold /
                userData.totalCollateralValue
            : 0;

        // With single asset: threshold = liquidationThreshold = 0.85
        assertEq(
            threshold,
            (85 * 1e18) / 100,
            "Single asset threshold should be 0.85"
        );
    }

    function testWeightedLiquidationThreshold_MultipleAssets() public {
        // ETH: $2000 collateral, 0.85 threshold -> weighted = $1700
        // USDC: $3000 collateral, 0.95 threshold -> weighted = $2850
        // Total weighted = $4550, Total collateral = $5000
        // Weighted threshold = $4550 / $5000 = 0.91

        userSupplies[USER1][address(eth)] = 1 * 1e18; // $2000
        userSupplies[USER1][address(usdc)] = 3000 * 1e6; // $3000

        UserAssetCalculations.UserAssetData
            memory userData = UserAssetCalculations.calculateUserAssetData(
                USER1,
                address(0),
                0,
                0,
                false,
                supportedAssets,
                userSupplies,
                userBorrows,
                assetConfigs,
                priceOracle
            );

        // Calculate weighted liquidation threshold manually
        uint256 threshold = userData.totalCollateralValue > 0
            ? userData.weightedLiquidationThreshold /
                userData.totalCollateralValue
            : 0;

        // Expected: (1700 + 2850) / 5000 = 4550 / 5000 = 0.91
        assertEq(
            threshold,
            (91 * 1e18) / 100,
            "Weighted threshold should be 0.91"
        );
    }

    function testWeightedLiquidationThreshold_NoCollateral() public view {
        UserAssetCalculations.UserAssetData
            memory userData = UserAssetCalculations.calculateUserAssetData(
                USER1,
                address(0),
                0,
                0,
                false,
                supportedAssets,
                userSupplies,
                userBorrows,
                assetConfigs,
                priceOracle
            );

        // Calculate weighted liquidation threshold manually
        uint256 threshold = userData.totalCollateralValue > 0
            ? userData.weightedLiquidationThreshold /
                userData.totalCollateralValue
            : 0;

        // No collateral should return 0
        assertEq(threshold, 0, "No collateral should have 0 threshold");
    }

    // ==================== Edge Cases and Error Conditions ====================

    function testGetAssetValues_UnsupportedAsset() public {
        // Use a mock contract that implements decimals() instead of a random address
        address unsupportedAsset = address(
            new MockZRC20("Unsupported", "UNS", 18, 0)
        );

        // Should handle gracefully with zero config
        IUniversalLendingProtocol.AssetConfig memory emptyConfig;

        (
            uint256 collateralValue,
            uint256 debtValue,
            uint256 borrowableValue,
            uint256 weightedValue
        ) = UserAssetCalculations.getAssetValues(
                USER1,
                unsupportedAsset,
                1e18,
                (5 * 1e18) / 10,
                true,
                userSupplies,
                userBorrows,
                emptyConfig,
                1e18 // default price of $1
            );

        // With empty config (all factors are 0), values should be 0 except collateral
        assertEq(
            borrowableValue,
            0,
            "Unsupported asset should have 0 borrowable value"
        );
        assertEq(
            weightedValue,
            0,
            "Unsupported asset should have 0 weighted value"
        );
    }

    function testCalculateUserAssetData_LargeAmounts() public {
        // Test with very large amounts to check for overflow
        userSupplies[USER1][address(btc)] = 1000 * 1e8; // 1000 BTC = $50M

        UserAssetCalculations.UserAssetData
            memory userData = UserAssetCalculations.calculateUserAssetData(
                USER1,
                address(0),
                0,
                0,
                false,
                supportedAssets,
                userSupplies,
                userBorrows,
                assetConfigs,
                priceOracle
            );

        assertEq(
            userData.totalCollateralValue,
            50000000 * 1e18,
            "Large amount should be calculated correctly"
        );
        assertEq(
            userData.totalBorrowableCollateral,
            37500000 * 1e18,
            "Large borrowable: $50M * 0.75"
        );
    }

    function testCalculateUserAssetData_PrecisionEdgeCases() public {
        // Test with very small amounts to check precision
        userSupplies[USER1][address(usdc)] = 1; // 1 microUSDC (0.000001 USDC)

        UserAssetCalculations.UserAssetData
            memory userData = UserAssetCalculations.calculateUserAssetData(
                USER1,
                address(0),
                0,
                0,
                false,
                supportedAssets,
                userSupplies,
                userBorrows,
                assetConfigs,
                priceOracle
            );

        // Should handle small amounts without underflow
        assertTrue(
            userData.totalCollateralValue > 0,
            "Should handle very small amounts"
        );
    }

    // ==================== Integration Tests ====================

    function testIntegration_HealthFactorCalculation() public {
        // Setup realistic position
        userSupplies[USER1][address(eth)] = 2 * 1e18; // $4000 collateral
        userSupplies[USER1][address(usdc)] = 1000 * 1e6; // $1000 collateral
        userBorrows[USER1][address(usdc)] = 2000 * 1e6; // $2000 debt

        UserAssetCalculations.UserAssetData
            memory userData = UserAssetCalculations.calculateUserAssetData(
                USER1,
                address(0),
                0,
                0,
                false,
                supportedAssets,
                userSupplies,
                userBorrows,
                assetConfigs,
                priceOracle
            );

        // Calculate health factor manually
        // Weighted collateral: ($4000 * 0.85) + ($1000 * 0.95) = $3400 + $950 = $4350
        // Health factor = $4350 / $2000 = 2.175
        uint256 expectedHealthFactor = (userData.totalWeightedCollateral *
            1e18) / userData.totalDebtValue;

        assertEq(
            expectedHealthFactor,
            (2175 * 1e18) / 1000,
            "Health factor should be 2.175"
        );
        assertTrue(
            expectedHealthFactor > (12 * 1e18) / 10,
            "Position should be healthy"
        );
    }

    function testIntegration_BorrowCapacityCalculation() public {
        // Setup position with available borrow capacity
        userSupplies[USER1][address(eth)] = 3 * 1e18; // $6000 collateral
        userBorrows[USER1][address(usdc)] = 1000 * 1e6; // $1000 existing debt

        UserAssetCalculations.UserAssetData
            memory userData = UserAssetCalculations.calculateUserAssetData(
                USER1,
                address(0),
                0,
                0,
                false,
                supportedAssets,
                userSupplies,
                userBorrows,
                assetConfigs,
                priceOracle
            );

        // Available borrow capacity = borrowable collateral - existing debt
        // Borrowable: $6000 * 0.8 = $4800
        // Available: $4800 - $1000 = $3800
        uint256 availableBorrowCapacity = userData.totalBorrowableCollateral -
            userData.totalDebtValue;

        assertEq(
            availableBorrowCapacity,
            3800 * 1e18,
            "Available borrow capacity should be $3800"
        );
    }

    function testIntegration_LiquidationThresholdCalculation() public {
        // Test weighted average liquidation threshold with mixed assets
        userSupplies[USER1][address(eth)] = 1 * 1e18; // $2000, 0.85 threshold
        userSupplies[USER1][address(usdc)] = 2000 * 1e6; // $2000, 0.95 threshold
        userSupplies[USER1][address(btc)] = (8 * 1e8) / 100; // $4000, 0.80 threshold

        UserAssetCalculations.UserAssetData
            memory userData = UserAssetCalculations.calculateUserAssetData(
                USER1,
                address(0),
                0,
                0,
                false,
                supportedAssets,
                userSupplies,
                userBorrows,
                assetConfigs,
                priceOracle
            );

        uint256 weightedThreshold = userData.totalCollateralValue > 0
            ? userData.weightedLiquidationThreshold /
                userData.totalCollateralValue
            : 0;

        // Expected weighted threshold:
        // ($2000 * 0.85 + $2000 * 0.95 + $4000 * 0.80) / $8000
        // = ($1700 + $1900 + $3200) / $8000 = $6800 / $8000 = 0.85
        assertEq(
            weightedThreshold,
            (85 * 1e18) / 100,
            "Weighted threshold should be 0.85"
        );
    }
}
