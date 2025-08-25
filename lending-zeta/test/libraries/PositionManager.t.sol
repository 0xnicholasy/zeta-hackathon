// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import "forge-std/Test.sol";
import "../../contracts/libraries/PositionManager.sol";
import "../../contracts/libraries/HealthFactorLogic.sol";
import "../../contracts/interfaces/IUniversalLendingProtocol.sol";
import "../../contracts/mocks/MockZRC20.sol";
import "../../contracts/mocks/MockPriceOracle.sol";

/**
 * @title PositionManagerTest
 * @notice Comprehensive test suite for PositionManager library
 * @dev Tests position data aggregation, borrowing capacity calculations, and user interfaces
 */
contract PositionManagerTest is Test {
    using PositionManager for *;

    MockZRC20 public usdc; // 6 decimals
    MockZRC20 public eth; // 18 decimals
    MockZRC20 public btc; // 8 decimals
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

    function setUp() public {
        // Deploy mock tokens
        usdc = new MockZRC20("USD Coin", "USDC", 6, 1000000 * 10 ** 6);
        eth = new MockZRC20("Ethereum", "ETH", 18, 1000000 * 10 ** 18);
        btc = new MockZRC20("Bitcoin", "BTC", 8, 1000000 * 10 ** 8);

        // Deploy mock price oracle
        priceOracle = new MockPriceOracle();

        // Set up supported assets
        supportedAssets.push(address(usdc));
        supportedAssets.push(address(eth));
        supportedAssets.push(address(btc));

        // Configure USDC
        enhancedAssets[address(usdc)] = IUniversalLendingProtocol.AssetConfig({
            isSupported: true,
            collateralFactor: 0.9e18, // 90% collateral factor
            liquidationThreshold: 0.95e18, // 95% liquidation threshold
            liquidationBonus: 0.05e18, // 5% liquidation bonus
            borrowRate: 0.05e18,
            supplyRate: 0.04e18,
            totalSupply: 0,
            totalBorrow: 0
        });

        // Configure ETH
        enhancedAssets[address(eth)] = IUniversalLendingProtocol.AssetConfig({
            isSupported: true,
            collateralFactor: 0.8e18, // 80% collateral factor
            liquidationThreshold: 0.85e18, // 85% liquidation threshold
            liquidationBonus: 0.1e18, // 10% liquidation bonus
            borrowRate: 0.06e18,
            supplyRate: 0.05e18,
            totalSupply: 0,
            totalBorrow: 0
        });

        // Configure BTC
        enhancedAssets[address(btc)] = IUniversalLendingProtocol.AssetConfig({
            isSupported: true,
            collateralFactor: 0.75e18, // 75% collateral factor
            liquidationThreshold: 0.8e18, // 80% liquidation threshold
            liquidationBonus: 0.15e18, // 15% liquidation bonus
            borrowRate: 0.07e18,
            supplyRate: 0.06e18,
            totalSupply: 0,
            totalBorrow: 0
        });

        // Set prices
        priceOracle.setPrice(address(usdc), 1e18); // $1.00
        priceOracle.setPrice(address(eth), 2000e18); // $2000.00
        priceOracle.setPrice(address(btc), 50000e18); // $50,000.00
    }

    // ==================== User Position Data Tests ====================

    function testGetUserPositionData_SingleAsset() public {
        // Set up simple position: supply 1000 USDC, borrow 500 USDC
        userSupplies[USER1][address(usdc)] = 1000e6;
        userBorrows[USER1][address(usdc)] = 500e6;

        PositionManager.UserPositionData memory positionData = PositionManager
            .getUserPositionData(
                USER1,
                supportedAssets,
                userSupplies,
                userBorrows,
                enhancedAssets,
                priceOracle
            );

        assertEq(
            positionData.totalCollateralValue,
            1000e18,
            "Should calculate total collateral value"
        );
        assertEq(
            positionData.totalDebtValue,
            500e18,
            "Should calculate total debt value"
        );
        assertEq(
            positionData.maxBorrowUsdValue,
            100e18,
            "Should calculate max additional borrow"
        );
        assertEq(
            positionData.healthFactor,
            1.9e18,
            "Should calculate health factor"
        );

        // Check arrays
        assertEq(
            positionData.suppliedAssets.length,
            1,
            "Should have one supplied asset"
        );
        assertEq(
            positionData.borrowedAssets.length,
            1,
            "Should have one borrowed asset"
        );
        assertEq(
            positionData.suppliedAssets[0],
            address(usdc),
            "Should identify supplied asset"
        );
        assertEq(
            positionData.borrowedAssets[0],
            address(usdc),
            "Should identify borrowed asset"
        );
        assertEq(
            positionData.suppliedAmounts[0],
            1000e6,
            "Should report supplied amount"
        );
        assertEq(
            positionData.borrowedAmounts[0],
            500e6,
            "Should report borrowed amount"
        );
    }

    function testGetUserPositionData_MultiAsset() public {
        // Set up multi-asset position
        userSupplies[USER1][address(usdc)] = 2000e6; // $2000 USDC
        userSupplies[USER1][address(eth)] = 1e18; // 1 ETH ($2000)
        userBorrows[USER1][address(usdc)] = 1000e6; // $1000 USDC debt
        userBorrows[USER1][address(btc)] = 0.02e8; // 0.02 BTC ($1000) debt

        PositionManager.UserPositionData memory positionData = PositionManager
            .getUserPositionData(
                USER1,
                supportedAssets,
                userSupplies,
                userBorrows,
                enhancedAssets,
                priceOracle
            );

        assertEq(
            positionData.totalCollateralValue,
            4000e18,
            "Should sum all collateral values"
        );
        assertEq(
            positionData.totalDebtValue,
            2000e18,
            "Should sum all debt values"
        );
        assertEq(
            positionData.suppliedAssets.length,
            2,
            "Should have two supplied assets"
        );
        assertEq(
            positionData.borrowedAssets.length,
            2,
            "Should have two borrowed assets"
        );

        // Check weighted liquidation threshold calculation
        // Expected: (2000*0.95 + 2000*0.85) / 4000 = (1900 + 1700) / 4000 = 0.9
        assertEq(
            positionData.liquidationThreshold,
            0.9e18,
            "Should calculate weighted liquidation threshold"
        );
    }

    function testGetUserPositionData_NoPositions() public view {
        PositionManager.UserPositionData memory positionData = PositionManager
            .getUserPositionData(
                USER1,
                supportedAssets,
                userSupplies,
                userBorrows,
                enhancedAssets,
                priceOracle
            );

        assertEq(
            positionData.totalCollateralValue,
            0,
            "Should be zero with no positions"
        );
        assertEq(positionData.totalDebtValue, 0, "Should be zero with no debt");
        assertEq(
            positionData.healthFactor,
            type(uint256).max,
            "Should have max health factor with no debt"
        );
        assertEq(
            positionData.suppliedAssets.length,
            0,
            "Should have no supplied assets"
        );
        assertEq(
            positionData.borrowedAssets.length,
            0,
            "Should have no borrowed assets"
        );
    }

    function testGetUserPositionData_SupplyOnly() public {
        // User only supplies, no borrowing
        userSupplies[USER1][address(eth)] = 2e18; // 2 ETH

        PositionManager.UserPositionData memory positionData = PositionManager
            .getUserPositionData(
                USER1,
                supportedAssets,
                userSupplies,
                userBorrows,
                enhancedAssets,
                priceOracle
            );

        assertEq(
            positionData.totalCollateralValue,
            4000e18,
            "Should calculate collateral value"
        );
        assertEq(positionData.totalDebtValue, 0, "Should have no debt");
        assertEq(
            positionData.healthFactor,
            type(uint256).max,
            "Should have max health factor"
        );
        assertEq(
            positionData.maxBorrowUsdValue,
            3200e18,
            "Should calculate max borrowable: 4000*0.8"
        );
        assertEq(
            positionData.suppliedAssets.length,
            1,
            "Should have one supplied asset"
        );
        assertEq(
            positionData.borrowedAssets.length,
            0,
            "Should have no borrowed assets"
        );
    }

    // ==================== Asset Position Tests ====================

    function testGetAssetPosition_WithBalance() public {
        // Set up position in USDC
        userSupplies[USER1][address(usdc)] = 1000e6;
        userBorrows[USER1][address(usdc)] = 300e6;

        uint256 contractBalance = 2000e6;

        PositionManager.AssetPosition memory position = PositionManager
            .getAssetPosition(
                USER1,
                address(usdc),
                userSupplies,
                userBorrows,
                enhancedAssets,
                priceOracle,
                contractBalance
            );

        assertEq(
            position.asset,
            address(usdc),
            "Should set correct asset address"
        );
        assertEq(
            position.suppliedAmount,
            1000e6,
            "Should report supplied amount"
        );
        assertEq(
            position.borrowedAmount,
            300e6,
            "Should report borrowed amount"
        );
        assertEq(
            position.suppliedValue,
            1000e18,
            "Should calculate supplied value"
        );
        assertEq(
            position.borrowedValue,
            300e18,
            "Should calculate borrowed value"
        );
        assertEq(
            position.collateralValue,
            900e18,
            "Should calculate effective collateral: 1000*0.9"
        );
    }

    function testGetAssetPosition_NoBalance() public view {
        uint256 contractBalance = 1000e6;

        PositionManager.AssetPosition memory position = PositionManager
            .getAssetPosition(
                USER1,
                address(usdc),
                userSupplies,
                userBorrows,
                enhancedAssets,
                priceOracle,
                contractBalance
            );

        assertEq(
            position.asset,
            address(usdc),
            "Should set correct asset address"
        );
        assertEq(
            position.suppliedAmount,
            0,
            "Should report zero supplied amount"
        );
        assertEq(
            position.borrowedAmount,
            0,
            "Should report zero borrowed amount"
        );
        assertEq(
            position.suppliedValue,
            0,
            "Should report zero supplied value"
        );
        assertEq(
            position.borrowedValue,
            0,
            "Should report zero borrowed value"
        );
        assertEq(
            position.collateralValue,
            0,
            "Should report zero collateral value"
        );
    }

    // ==================== User Account Data Tests ====================

    function testGetUserAccountData_HealthyPosition() public {
        // Set up healthy position
        userSupplies[USER1][address(usdc)] = 1500e6; // $1500 USDC
        userBorrows[USER1][address(usdc)] = 500e6; // $500 USDC debt

        (
            uint256 totalCollateralValue,
            uint256 totalDebtValue,
            uint256 availableBorrows,
            uint256 currentLiquidationThreshold,
            uint256 healthFactor
        ) = PositionManager.getUserAccountData(
                USER1,
                supportedAssets,
                userSupplies,
                userBorrows,
                enhancedAssets,
                priceOracle
            );

        // Borrowable collateral: 1500 * 0.9 = 1350
        assertEq(
            totalCollateralValue,
            1350e18,
            "Should return borrowable collateral value"
        );
        assertEq(totalDebtValue, 500e18, "Should return total debt value");

        // Available borrows: 1350 - (500 * 1.5) = 1350 - 750 = 600
        assertEq(
            availableBorrows,
            600e18,
            "Should calculate available borrows"
        );

        assertEq(
            currentLiquidationThreshold,
            0.95e18,
            "Should return liquidation threshold"
        );
        assertEq(
            healthFactor,
            2.85e18,
            "Should calculate health factor: (1500*0.95)/500"
        );
    }

    function testGetUserAccountData_MultiAsset() public {
        // Multi-asset position
        userSupplies[USER1][address(usdc)] = 1000e6; // $1000 USDC
        userSupplies[USER1][address(eth)] = 1e18; // 1 ETH ($2000)
        userBorrows[USER1][address(usdc)] = 800e6; // $800 USDC debt

        (
            uint256 totalCollateralValue,
            uint256 totalDebtValue,
            uint256 availableBorrows,
            uint256 currentLiquidationThreshold,

        ) = PositionManager.getUserAccountData(
                USER1,
                supportedAssets,
                userSupplies,
                userBorrows,
                enhancedAssets,
                priceOracle
            );

        // Borrowable collateral: (1000 * 0.9) + (2000 * 0.8) = 900 + 1600 = 2500
        assertEq(
            totalCollateralValue,
            2500e18,
            "Should calculate multi-asset borrowable collateral"
        );
        assertEq(totalDebtValue, 800e18, "Should return debt value");

        // Available: 2500 - (800 * 1.5) = 2500 - 1200 = 1300
        assertEq(
            availableBorrows,
            1300e18,
            "Should calculate available borrows"
        );

        // Weighted threshold: (1000*0.95 + 2000*0.85) / 3000 = (950 + 1700) / 3000 = 0.883...
        assertApproxEqAbs(
            currentLiquidationThreshold,
            0.883333333333333333e18,
            1e15,
            "Should calculate weighted threshold"
        );
    }

    function testGetUserAccountData_NoCollateral() public view {
        (
            uint256 totalCollateralValue,
            uint256 totalDebtValue,
            uint256 availableBorrows,
            uint256 currentLiquidationThreshold,
            uint256 healthFactor
        ) = PositionManager.getUserAccountData(
                USER1,
                supportedAssets,
                userSupplies,
                userBorrows,
                enhancedAssets,
                priceOracle
            );

        assertEq(totalCollateralValue, 0, "Should be zero with no collateral");
        assertEq(totalDebtValue, 0, "Should be zero with no debt");
        assertEq(availableBorrows, 0, "Should have no available borrows");
        assertEq(
            currentLiquidationThreshold,
            0,
            "Should have zero liquidation threshold"
        );
        assertEq(
            healthFactor,
            type(uint256).max,
            "Should have max health factor"
        );
    }

    // ==================== Max Borrow Capacity Tests ====================

    function testGetMaxBorrowCapacity_SufficientCollateral() public {
        // Set up collateral
        userSupplies[USER1][address(usdc)] = 2000e6; // $2000 USDC

        uint256 contractBalance = 1500e6;

        uint256 maxBorrow = PositionManager.getMaxBorrowCapacity(
            USER1,
            address(usdc),
            supportedAssets,
            userSupplies,
            userBorrows,
            enhancedAssets,
            priceOracle,
            contractBalance
        );

        // Max borrowable: (2000 * 0.9) / 1.5 = 1200 USD = 1200 USDC
        // Limited by contract balance: min(1200, 1500) = 1200
        assertEq(maxBorrow, 1200e6, "Should calculate max borrow capacity");
    }

    function testGetMaxBorrowCapacity_ContractBalanceLimit() public {
        // Large collateral but limited contract balance
        userSupplies[USER1][address(usdc)] = 10000e6; // $10,000 USDC

        uint256 contractBalance = 500e6; // Only $500 available

        uint256 maxBorrow = PositionManager.getMaxBorrowCapacity(
            USER1,
            address(usdc),
            supportedAssets,
            userSupplies,
            userBorrows,
            enhancedAssets,
            priceOracle,
            contractBalance
        );

        // Should be limited by contract balance
        assertEq(maxBorrow, 500e6, "Should be limited by contract balance");
    }

    function testGetMaxBorrowCapacity_ExistingDebt() public {
        // User with existing debt
        userSupplies[USER1][address(usdc)] = 2000e6; // $2000 USDC
        userBorrows[USER1][address(usdc)] = 600e6; // $600 existing debt

        uint256 contractBalance = 1000e6;

        uint256 maxBorrow = PositionManager.getMaxBorrowCapacity(
            USER1,
            address(usdc),
            supportedAssets,
            userSupplies,
            userBorrows,
            enhancedAssets,
            priceOracle,
            contractBalance
        );

        // Max total debt: (2000 * 0.9) / 1.5 = 1200
        // Available: 1200 - 600 = 600
        assertEq(maxBorrow, 600e6, "Should account for existing debt");
    }

    // ==================== Max Withdraw Capacity Tests ====================

    function testGetMaxWithdrawCapacity_NoDebt() public {
        // User with no debt should be able to withdraw everything
        userSupplies[USER1][address(usdc)] = 1000e6;

        uint256 contractBalance = 1000e6;

        uint256 maxWithdraw = PositionManager.getMaxWithdrawCapacity(
            USER1,
            address(usdc),
            supportedAssets,
            userSupplies,
            userBorrows,
            enhancedAssets,
            priceOracle,
            contractBalance
        );

        assertEq(
            maxWithdraw,
            1000e6,
            "Should allow full withdrawal with no debt"
        );
    }

    function testGetMaxWithdrawCapacity_WithDebt() public {
        // User with debt - limited by health factor
        userSupplies[USER1][address(usdc)] = 2000e6; // $2000 USDC
        userBorrows[USER1][address(usdc)] = 800e6; // $800 debt

        uint256 contractBalance = 2000e6;

        uint256 maxWithdraw = PositionManager.getMaxWithdrawCapacity(
            USER1,
            address(usdc),
            supportedAssets,
            userSupplies,
            userBorrows,
            enhancedAssets,
            priceOracle,
            contractBalance
        );

        // To maintain 1.5x health factor with $800 debt:
        // Need weighted collateral >= 800 * 1.5 = 1200
        // With 95% threshold: need raw collateral >= 1200 / 0.95 = 1263.16
        // Can withdraw: 2000 - 1264 = 736 (approximately)
        assertApproxEqAbs(
            maxWithdraw,
            736e6,
            2e6,
            "Should calculate max safe withdrawal"
        );
    }

    function testGetMaxWithdrawCapacity_ContractBalanceLimit() public {
        userSupplies[USER1][address(usdc)] = 2000e6;

        uint256 contractBalance = 500e6; // Limited contract balance

        uint256 maxWithdraw = PositionManager.getMaxWithdrawCapacity(
            USER1,
            address(usdc),
            supportedAssets,
            userSupplies,
            userBorrows,
            enhancedAssets,
            priceOracle,
            contractBalance
        );

        // Should be limited by contract balance
        assertEq(maxWithdraw, 500e6, "Should be limited by contract balance");
    }

    function testGetMaxWithdrawCapacity_NoSupply() public view {
        uint256 contractBalance = 1000e6;

        uint256 maxWithdraw = PositionManager.getMaxWithdrawCapacity(
            USER1,
            address(usdc),
            supportedAssets,
            userSupplies,
            userBorrows,
            enhancedAssets,
            priceOracle,
            contractBalance
        );

        assertEq(maxWithdraw, 0, "Should return zero with no supply");
    }

    // ==================== Position Health Metrics Tests ====================

    function testGetPositionHealthMetrics_HealthyPosition() public {
        // Healthy position
        userSupplies[USER1][address(usdc)] = 2000e6;
        userBorrows[USER1][address(usdc)] = 600e6;

        (
            uint256 healthFactor,
            uint8 healthStatus,
            uint256 liquidationPrice,
            uint256 improvementNeeded
        ) = PositionManager.getPositionHealthMetrics(
                USER1,
                supportedAssets,
                userSupplies,
                userBorrows,
                enhancedAssets,
                priceOracle
            );

        // expectedHealthFactor = (2000e18 * 95e16) / 600e18 = 3.166666... ≈ 3.167e18
        assertApproxEqAbs(
            healthFactor,
            3167e15,
            1e15,
            "Should calculate health factor"
        );
        assertEq(healthStatus, 0, "Should be healthy status");
        assertEq(improvementNeeded, 0, "Should need no improvement");

        // Liquidation price drop calculation
        uint256 expectedLiquidationPrice = PRECISION -
            (1.2e18 * PRECISION) /
            healthFactor;
        assertEq(
            liquidationPrice,
            expectedLiquidationPrice,
            "Should calculate liquidation price drop"
        );
    }

    function testGetPositionHealthMetrics_RiskyPosition() public {
        // Risky position (between 1.2 and 1.5)
        userSupplies[USER1][address(usdc)] = 1000e6;
        userBorrows[USER1][address(usdc)] = 700e6;

        (
            uint256 healthFactor,
            uint8 healthStatus,
            ,
            uint256 improvementNeeded
        ) = PositionManager.getPositionHealthMetrics(
                USER1,
                supportedAssets,
                userSupplies,
                userBorrows,
                enhancedAssets,
                priceOracle
            );

        assertTrue(
            healthFactor < 1.5e18 && healthFactor >= 1.2e18,
            "Should be risky health factor"
        );
        assertEq(healthStatus, 1, "Should be risky status");
        assertTrue(improvementNeeded > 0, "Should need improvement");
    }

    function testGetPositionHealthMetrics_LiquidatablePosition() public {
        // Liquidatable position
        userSupplies[USER1][address(usdc)] = 1000e6;
        userBorrows[USER1][address(usdc)] = 850e6;

        (
            uint256 healthFactor,
            uint8 healthStatus,
            ,
            uint256 improvementNeeded
        ) = PositionManager.getPositionHealthMetrics(
                USER1,
                supportedAssets,
                userSupplies,
                userBorrows,
                enhancedAssets,
                priceOracle
            );

        assertTrue(
            healthFactor < 1.2e18,
            "Should be below liquidation threshold"
        );
        assertEq(healthStatus, 2, "Should be liquidatable status");
        assertTrue(
            improvementNeeded > 0,
            "Should need significant improvement"
        );
    }

    function testGetPositionHealthMetrics_NoDebt() public {
        userSupplies[USER1][address(usdc)] = 1000e6;

        (
            uint256 healthFactor,
            uint8 healthStatus,
            uint256 liquidationPrice,
            uint256 improvementNeeded
        ) = PositionManager.getPositionHealthMetrics(
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
            "Should have max health factor"
        );
        assertEq(healthStatus, 3, "Should be no debt status");
        assertEq(liquidationPrice, 0, "Should have no liquidation price");
        assertEq(improvementNeeded, 0, "Should need no improvement");
    }

    // ==================== Active Assets Tests ====================

    function testGetActiveAssets_MultiplePositions() public {
        // Set up positions in multiple assets
        userSupplies[USER1][address(usdc)] = 1000e6;
        userSupplies[USER1][address(eth)] = 1e18;
        userBorrows[USER1][address(btc)] = 0.01e8;

        (
            address[] memory activeAssets,
            bool[] memory hasSupply,
            bool[] memory hasBorrow
        ) = PositionManager.getActiveAssets(
                USER1,
                supportedAssets,
                userSupplies,
                userBorrows
            );

        assertEq(activeAssets.length, 3, "Should have three active assets");

        // Check assets are included
        bool foundUsdc = false;
        bool foundEth = false;
        bool foundBtc = false;

        for (uint i = 0; i < activeAssets.length; i++) {
            if (activeAssets[i] == address(usdc)) {
                foundUsdc = true;
                assertTrue(hasSupply[i], "USDC should have supply");
                assertFalse(hasBorrow[i], "USDC should not have borrow");
            } else if (activeAssets[i] == address(eth)) {
                foundEth = true;
                assertTrue(hasSupply[i], "ETH should have supply");
                assertFalse(hasBorrow[i], "ETH should not have borrow");
            } else if (activeAssets[i] == address(btc)) {
                foundBtc = true;
                assertFalse(hasSupply[i], "BTC should not have supply");
                assertTrue(hasBorrow[i], "BTC should have borrow");
            }
        }

        assertTrue(
            foundUsdc && foundEth && foundBtc,
            "Should find all active assets"
        );
    }

    function testGetActiveAssets_NoPositions() public view {
        (
            address[] memory activeAssets,
            bool[] memory hasSupply,
            bool[] memory hasBorrow
        ) = PositionManager.getActiveAssets(
                USER1,
                supportedAssets,
                userSupplies,
                userBorrows
            );

        assertEq(activeAssets.length, 0, "Should have no active assets");
        assertEq(hasSupply.length, 0, "Should have no supply flags");
        assertEq(hasBorrow.length, 0, "Should have no borrow flags");
    }

    function testGetActiveAssets_BothSupplyAndBorrow() public {
        // Same asset with both supply and borrow
        userSupplies[USER1][address(usdc)] = 1000e6;
        userBorrows[USER1][address(usdc)] = 300e6;

        (
            address[] memory activeAssets,
            bool[] memory hasSupply,
            bool[] memory hasBorrow
        ) = PositionManager.getActiveAssets(
                USER1,
                supportedAssets,
                userSupplies,
                userBorrows
            );

        assertEq(activeAssets.length, 1, "Should have one active asset");
        assertEq(activeAssets[0], address(usdc), "Should be USDC");
        assertTrue(hasSupply[0], "Should have supply");
        assertTrue(hasBorrow[0], "Should have borrow");
    }

    // ==================== Integration Tests ====================

    function testIntegration_CompletePositionAnalysis() public {
        // Set up complex multi-asset position
        userSupplies[USER1][address(usdc)] = 5000e6; // $5000 USDC
        userSupplies[USER1][address(eth)] = 2e18; // 2 ETH ($4000)
        userSupplies[USER1][address(btc)] = 0.1e8; // 0.1 BTC ($5000)

        userBorrows[USER1][address(usdc)] = 3000e6; // $3000 USDC debt
        userBorrows[USER1][address(eth)] = 1e18; // 1 ETH ($2000) debt

        // Test comprehensive position data
        PositionManager.UserPositionData memory positionData = PositionManager
            .getUserPositionData(
                USER1,
                supportedAssets,
                userSupplies,
                userBorrows,
                enhancedAssets,
                priceOracle
            );

        // Verify totals
        assertEq(
            positionData.totalCollateralValue,
            14000e18,
            "Should sum all collateral: 5000+4000+5000"
        );
        assertEq(
            positionData.totalDebtValue,
            5000e18,
            "Should sum all debt: 3000+2000"
        );

        // Verify arrays
        assertEq(
            positionData.suppliedAssets.length,
            3,
            "Should have three supplied assets"
        );
        assertEq(
            positionData.borrowedAssets.length,
            2,
            "Should have two borrowed assets"
        );

        // Test account data consistency
        (, uint256 totalDebtValue, , , uint256 healthFactor) = PositionManager
            .getUserAccountData(
                USER1,
                supportedAssets,
                userSupplies,
                userBorrows,
                enhancedAssets,
                priceOracle
            );

        assertEq(
            totalDebtValue,
            positionData.totalDebtValue,
            "Debt values should match"
        );
        assertEq(
            healthFactor,
            positionData.healthFactor,
            "Health factors should match"
        );
    }

    // ==================== Edge Case Tests ====================

    function testEdgeCase_VerySmallAmounts() public {
        // Test with very small but reasonable amounts
        userSupplies[USER1][address(usdc)] = 1000; // 0.001 USDC
        userBorrows[USER1][address(usdc)] = 500; // 0.0005 USDC debt

        PositionManager.UserPositionData memory positionData = PositionManager
            .getUserPositionData(
                USER1,
                supportedAssets,
                userSupplies,
                userBorrows,
                enhancedAssets,
                priceOracle
            );

        assertTrue(
            positionData.totalCollateralValue > 0,
            "Should handle very small collateral"
        );
        assertTrue(
            positionData.totalDebtValue > 0,
            "Should handle very small debt"
        );
        assertTrue(
            positionData.healthFactor < type(uint256).max,
            "Should calculate finite health factor"
        );
    }

    function testEdgeCase_LargeAmounts() public {
        // Test with large amounts (but within practical limits)
        uint256 largeAmount = 1e15; // 1 billion USDC
        userSupplies[USER1][address(usdc)] = largeAmount;
        userBorrows[USER1][address(usdc)] = largeAmount / 3; // Conservative borrowing

        PositionManager.UserPositionData memory positionData = PositionManager
            .getUserPositionData(
                USER1,
                supportedAssets,
                userSupplies,
                userBorrows,
                enhancedAssets,
                priceOracle
            );

        assertTrue(
            positionData.totalCollateralValue > 0,
            "Should handle large collateral"
        );
        assertTrue(positionData.totalDebtValue > 0, "Should handle large debt");
        assertTrue(
            positionData.healthFactor > MINIMUM_HEALTH_FACTOR,
            "Should maintain healthy position"
        );
    }
}
