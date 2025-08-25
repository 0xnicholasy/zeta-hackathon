// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

interface IUniversalLendingProtocol {
    // Asset configuration struct - unified from previous Asset and AssetConfig
    struct Asset {
        bool isSupported;
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

    // Core errors
    error AssetNotSupported(address asset);
    error InvalidAmount();
    error InsufficientBalance();
    error InsufficientLiquidity();
    error InsufficientCollateral();
    error InsufficientGasFee(
        address gasToken,
        uint256 required,
        uint256 available
    );
    error HealthFactorTooLow();
    error Unauthorized();

    // Additional errors for Universal protocol
    error ChainNotAllowed(uint256 chainId);
    error WithdrawalFailed();

    // Core events
    event Supply(address indexed user, address indexed asset, uint256 amount);
    event Borrow(address indexed user, address indexed asset, uint256 amount);
    event Repay(address indexed user, address indexed asset, uint256 amount);
    event Withdraw(address indexed user, address indexed asset, uint256 amount);
    event Liquidate(
        address indexed liquidator,
        address indexed user,
        address indexed collateralAsset,
        address debtAsset,
        uint256 repayAmount,
        uint256 liquidatedCollateral
    );

    // Cross-chain specific events
    event CrossChainDeposit(
        address indexed user,
        address indexed zrc20,
        uint256 amount,
        uint256 indexed sourceChain,
        bytes32 txHash
    );

    event CrossChainWithdrawal(
        address indexed user,
        address indexed zrc20,
        uint256 amount,
        uint256 indexed destinationChain,
        address recipient
    );

    event CrossChainRepay(
        address indexed user,
        address indexed zrc20,
        uint256 amount,
        uint256 indexed sourceChain,
        bytes32 txHash
    );

    event AllowedChainUpdated(uint256 indexed chainId, bool allowed);

    event ZRC20AssetMapped(
        address indexed zrc20,
        uint256 indexed chainId,
        string symbol
    );

    // Core lending functions
    function supply(address asset, uint256 amount, address onBehalfOf) external;

    function borrow(address asset, uint256 amount, address to) external;

    function repay(address asset, uint256 amount, address onBehalfOf) external;

    function withdraw(address asset, uint256 amount, address to) external;

    function liquidate(
        address user,
        address collateralAsset,
        address debtAsset,
        uint256 repayAmount
    ) external;

    // Core view functions
    function getAssetConfig(
        address asset
    ) external view returns (AssetConfig memory);

    function getSupplyBalance(
        address user,
        address asset
    ) external view returns (uint256);

    function getBorrowBalance(
        address user,
        address asset
    ) external view returns (uint256);

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

    function maxAvailableBorrowsInUsd(
        address user
    ) external view returns (uint256);

    function maxAvailableBorrows(
        address user,
        address asset
    ) external view returns (uint256);

    function getHealthFactorAfterBorrow(
        address user,
        address asset,
        uint256 amount
    ) external view returns (uint256);

    function getHealthFactorAfterRepay(
        address user,
        address asset,
        uint256 amount
    ) external view returns (uint256);

    function getHealthFactorAfterWithdraw(
        address user,
        address asset,
        uint256 amount
    ) external view returns (uint256);

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

    // Enhanced admin functions for Universal protocol
    function setAllowedSourceChain(uint256 chainId, bool allowed) external;

    function mapZRC20Asset(
        address zrc20,
        uint256 chainId,
        string calldata symbol
    ) external;

    function addAsset(
        address asset,
        uint256 collateralFactor,
        uint256 liquidationThreshold,
        uint256 liquidationBonus
    ) external;

    function setPriceOracle(address _priceOracle) external;

    // Enhanced view functions for Universal protocol
    function isChainAllowed(uint256 chainId) external view returns (bool);

    function getZRC20ByChainAndSymbol(
        uint256 chainId,
        string calldata symbol
    ) external view returns (address);

    // Enhanced view functions for Universal protocol
    function getUserAccountData(
        address user
    )
        external
        view
        returns (
            uint256 totalCollateralValue,
            uint256 totalDebtValue,
            uint256 availableBorrows,
            uint256 currentLiquidationThreshold,
            uint256 healthFactor
        );

    /// @notice Calculates the maximum liquidation parameters for a user's position
    /// @dev This function helps determine liquidation feasibility and amounts before execution
    /// @param user The address of the user whose position is being evaluated for liquidation
    /// @param collateralAsset The address of the collateral asset to be liquidated
    /// @param debtAsset The address of the debt asset to be repaid
    /// @return maxRepayAmount The maximum amount of debt that can be repaid in the liquidation
    /// @return liquidatedCollateral The amount of collateral that would be seized
    /// @return canLiquidate Whether the position is eligible for liquidation (health factor < 1)
    // Liquidation helper function
    function getMaxLiquidation(
        address user,
        address collateralAsset,
        address debtAsset
    )
        external
        view
        returns (
            uint256 maxRepayAmount,
            uint256 liquidatedCollateral,
            bool canLiquidate
        );
}
