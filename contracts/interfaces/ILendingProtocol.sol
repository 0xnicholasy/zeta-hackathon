// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface ILendingProtocol {
    struct UserPosition {
        mapping(address => uint256) supplies;
        mapping(address => uint256) borrows;
    }
    
    struct AssetConfig {
        bool isSupported;
        uint256 collateralFactor;
        uint256 liquidationThreshold;
        uint256 liquidationBonus;
        uint256 borrowRate;
        uint256 supplyRate;
        uint256 totalSupply;
        uint256 totalBorrow;
    }

    event Supply(address indexed user, address indexed asset, uint256 amount);
    event Borrow(address indexed user, address indexed asset, uint256 amount);
    event Repay(address indexed user, address indexed asset, uint256 amount);
    event Withdraw(address indexed user, address indexed asset, uint256 amount);
    event Liquidate(
        address indexed liquidator,
        address indexed user,
        address indexed collateralAsset,
        address debtAsset,
        uint256 debtToCover,
        uint256 liquidatedCollateral
    );

    function supply(address asset, uint256 amount, address onBehalfOf) external;
    function borrow(address asset, uint256 amount, address to) external;
    function repay(address asset, uint256 amount, address onBehalfOf) external;
    function withdraw(address asset, uint256 amount, address to) external;
    function liquidate(
        address collateralAsset,
        address debtAsset,
        address user,
        uint256 debtToCover
    ) external;

    function getHealthFactor(address user) external view returns (uint256);
    function getSupplyBalance(address user, address asset) external view returns (uint256);
    function getBorrowBalance(address user, address asset) external view returns (uint256);
    function getAssetConfig(address asset) external view returns (AssetConfig memory);
    function getUserAccountData(address user) external view returns (
        uint256 totalCollateralValue,
        uint256 totalDebtValue,
        uint256 availableBorrows,
        uint256 currentLiquidationThreshold,
        uint256 healthFactor
    );
}