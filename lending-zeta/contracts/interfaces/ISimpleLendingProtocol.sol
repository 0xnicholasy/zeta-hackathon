// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

interface ISimpleLendingProtocol {
    struct Asset {
        bool isSupported;
        // Removed deprecated price field - use oracle for pricing
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
        bytes memory recipient
    ) external;

    function repay(address asset, uint256 amount, address onBehalfOf) external;

    function withdraw(address asset, uint256 amount, address to) external;

    function withdrawCrossChain(
        address asset,
        uint256 amount,
        uint256 destinationChain,
        bytes memory recipient
    ) external;

    function liquidate(
        address user,
        address collateralAsset,
        address debtAsset,
        uint256 repayAmount
    ) external;

    // Admin functions - updated to use oracle
    function addAsset(address asset) external;

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

    // Add oracle functions to interface
    function getAssetPrice(address asset) external view returns (uint256);

    // High level function for getting all assets and their prices, borrowable amount
    function getAssetsAndPrices()
        external
        view
        returns (
            address[] memory assetAddresses,
            uint256[] memory prices,
            uint256[] memory borrowableAmounts
        );

    // ============ Health Factor Preview Functions ============

    /**
     * @dev Calculate health factor after a potential borrow
     * @param user The user address
     * @param asset The asset to borrow
     * @param amount The amount to borrow
     * @return newHealthFactor The health factor after the borrow
     */
    function getHealthFactorAfterBorrow(
        address user,
        address asset,
        uint256 amount
    ) external view returns (uint256 newHealthFactor);

    /**
     * @dev Calculate health factor after a potential repay
     * @param user The user address
     * @param asset The asset to repay
     * @param amount The amount to repay
     * @return newHealthFactor The health factor after the repay
     */
    function getHealthFactorAfterRepay(
        address user,
        address asset,
        uint256 amount
    ) external view returns (uint256 newHealthFactor);

    /**
     * @dev Calculate health factor after a potential withdrawal
     * @param user The user address
     * @param asset The asset to withdraw
     * @param amount The amount to withdraw
     * @return newHealthFactor The health factor after the withdrawal
     */
    function getHealthFactorAfterWithdraw(
        address user,
        address asset,
        uint256 amount
    ) external view returns (uint256 newHealthFactor);

    /**
     * @dev Get comprehensive user position data
     * @param user The user address
     * @return totalCollateralValue Total collateral value in USD
     * @return totalDebtValue Total debt value in USD
     * @return healthFactor Current health factor
     * @return maxBorrowUsdValue Maximum borrowable value in USD
     * @return liquidationThreshold Weighted liquidation threshold
     * @return suppliedAssets Array of supplied asset addresses
     * @return suppliedAmounts Array of supplied amounts
     * @return suppliedValues Array of supplied values in USD
     * @return borrowedAssets Array of borrowed asset addresses
     * @return borrowedAmounts Array of borrowed amounts
     * @return borrowedValues Array of borrowed values in USD
     */
    function getUserPositionData(
        address user
    )
        external
        view
        returns (
            uint256 totalCollateralValue,
            uint256 totalDebtValue,
            uint256 healthFactor,
            uint256 maxBorrowUsdValue,
            uint256 liquidationThreshold,
            address[] memory suppliedAssets,
            uint256[] memory suppliedAmounts,
            uint256[] memory suppliedValues,
            address[] memory borrowedAssets,
            uint256[] memory borrowedAmounts,
            uint256[] memory borrowedValues
        );
}
