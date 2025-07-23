// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

interface ISimpleLendingProtocol {
    struct Asset {
        bool isSupported;
        uint256 price; // Price in USD with 18 decimals
    }

    error Unauthorized();
    error AssetNotSupported(address asset);
    error InvalidAmount();
    error InsufficientCollateral();
    error InsufficientLiquidity();
    error InsufficientBalance();
    error InsufficientGasFee(
        address gasTokenAddress,
        uint256 required,
        uint256 available
    );
    error HealthFactorTooLow();

    event Supply(address indexed user, address indexed asset, uint256 amount);
    event Borrow(address indexed user, address indexed asset, uint256 amount);
    event Repay(address indexed user, address indexed asset, uint256 amount);
    event Withdraw(address indexed user, address indexed asset, uint256 amount);
    event Liquidate(
        address indexed liquidator,
        address indexed user,
        address indexed collateralAsset,
        address debtAsset,
        uint256 repaidDebt,
        uint256 seizedCollateral
    );

    // Core lending functions
    function supply(address asset, uint256 amount, address onBehalfOf) external;

    function borrow(address asset, uint256 amount, address to) external;

    function borrowCrossChain(
        address asset,
        uint256 amount,
        uint256 destinationChain,
        address recipient
    ) external;

    function repay(address asset, uint256 amount, address onBehalfOf) external;

    function withdraw(address asset, uint256 amount, address to) external;

    function withdrawCrossChain(
        address asset,
        uint256 amount,
        uint256 destinationChain,
        address recipient
    ) external;

    function liquidate(
        address user,
        address collateralAsset,
        address debtAsset,
        uint256 repayAmount
    ) external;

    // Admin functions
    function addAsset(address asset, uint256 priceInUSD) external;

    function updatePrice(address asset, uint256 priceInUSD) external;

    // View functions
    function getHealthFactor(address user) external view returns (uint256);

    function getTotalCollateralValue(
        address user
    ) external view returns (uint256);

    function getTotalDebtValue(address user) external view returns (uint256);

    function getCollateralValue(
        address user,
        address asset
    ) external view returns (uint256);

    function getDebtValue(
        address user,
        address asset
    ) external view returns (uint256);

    function canBorrow(
        address user,
        address asset,
        uint256 amount
    ) external view returns (bool);

    function canWithdraw(
        address user,
        address asset,
        uint256 amount
    ) external view returns (bool);

    function isLiquidatable(address user) external view returns (bool);

    function getSupplyBalance(
        address user,
        address asset
    ) external view returns (uint256);

    function getBorrowBalance(
        address user,
        address asset
    ) external view returns (uint256);

    function getAssetConfig(address asset) external view returns (Asset memory);

    function getSupportedAssetsCount() external view returns (uint256);

    function getSupportedAsset(uint256 index) external view returns (address);

    function getWithdrawGasFee(
        address asset
    ) external view returns (address gasToken, uint256 gasFee);

    function maxAvailableBorrows(
        address user,
        address asset
    ) external view returns (uint256);

    function maxAvailableBorrowsInUsd(
        address user
    ) external view returns (uint256);

    function maxAvailableAmount(address asset) external view returns (uint256);
}
