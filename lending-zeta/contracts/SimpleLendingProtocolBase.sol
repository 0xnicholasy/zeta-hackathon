// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import "@zetachain/protocol-contracts/contracts/zevm/interfaces/UniversalContract.sol";
import "@zetachain/protocol-contracts/contracts/zevm/interfaces/IGatewayZEVM.sol";
import "@zetachain/protocol-contracts/contracts/Revert.sol";
import "@zetachain/protocol-contracts/contracts/zevm/interfaces/IZRC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "./interfaces/ISimpleLendingProtocol.sol";

/**
 * @title SimpleLendingProtocolBase
 * @dev Base implementation of the simple lending protocol
 */
abstract contract SimpleLendingProtocolBase is UniversalContract, ISimpleLendingProtocol, ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    IGatewayZEVM public immutable gateway;

    uint256 internal constant PRECISION = 1e18;
    uint256 internal constant MINIMUM_HEALTH_FACTOR = 1.5e18;
    uint256 internal constant LIQUIDATION_THRESHOLD = 1.2e18;

    mapping(address => Asset) public assets;
    mapping(address => mapping(address => uint256)) public userSupplies;
    mapping(address => mapping(address => uint256)) public userBorrows;

    address[] public supportedAssets;
    mapping(address => bool) public isAssetAdded;

    modifier onlyGateway() {
        if (msg.sender != address(gateway)) revert Unauthorized();
        _;
    }

    constructor(address payable gatewayAddress, address owner) Ownable(owner) {
        gateway = IGatewayZEVM(gatewayAddress);
    }

    // Virtual functions for extension
    function _supply(address asset, uint256 amount, address onBehalfOf) internal virtual {
        if (!assets[asset].isSupported) revert AssetNotSupported(asset);
        if (amount == 0) revert InvalidAmount();

        if (msg.sender != address(gateway)) {
            IERC20(asset).safeTransferFrom(msg.sender, address(this), amount);
        }

        userSupplies[onBehalfOf][asset] += amount;
        emit Supply(onBehalfOf, asset, amount);
    }

    function _repay(address asset, uint256 amount, address onBehalfOf) internal virtual {
        if (!assets[asset].isSupported) revert AssetNotSupported(asset);
        if (amount == 0) revert InvalidAmount();

        uint256 debt = userBorrows[onBehalfOf][asset];
        uint256 repayAmount = amount > debt ? debt : amount;

        if (msg.sender != address(gateway)) {
            IERC20(asset).safeTransferFrom(msg.sender, address(this), repayAmount);
        }

        userBorrows[onBehalfOf][asset] -= repayAmount;
        emit Repay(onBehalfOf, asset, repayAmount);
    }

    function _withdraw(address asset, uint256 amount, address user, address to, bytes memory) internal virtual {
        if (!assets[asset].isSupported) revert AssetNotSupported(asset);
        if (amount == 0) revert InvalidAmount();
        if (userSupplies[user][asset] < amount) revert InsufficientBalance();
        if (!canWithdraw(user, asset, amount)) revert InsufficientCollateral();

        userSupplies[user][asset] -= amount;
        IERC20(asset).safeTransfer(to, amount);
        emit Withdraw(user, asset, amount);
    }

    // View functions implementation
    function getHealthFactor(address user) public view virtual returns (uint256) {
        uint256 totalCollateralValue = getTotalCollateralValue(user);
        uint256 totalDebtValue = getTotalDebtValue(user);

        if (totalDebtValue == 0) {
            return type(uint256).max;
        }

        return (totalCollateralValue * PRECISION) / totalDebtValue;
    }

    function getTotalCollateralValue(address user) public view virtual returns (uint256) {
        uint256 totalValue = 0;

        for (uint256 i = 0; i < supportedAssets.length; i++) {
            address asset = supportedAssets[i];
            uint256 userSupply = userSupplies[user][asset];
            if (userSupply > 0) {
                totalValue += getCollateralValue(user, asset);
            }
        }

        return totalValue;
    }

    function getTotalDebtValue(address user) public view virtual returns (uint256) {
        uint256 totalValue = 0;

        for (uint256 i = 0; i < supportedAssets.length; i++) {
            address asset = supportedAssets[i];
            uint256 debt = userBorrows[user][asset];
            if (debt > 0) {
                totalValue += getDebtValue(user, asset);
            }
        }

        return totalValue;
    }

    function getCollateralValue(address user, address asset) public view virtual returns (uint256) {
        uint256 amount = userSupplies[user][asset];
        uint256 price = assets[asset].price;

        uint256 decimals = IERC20Metadata(asset).decimals();
        uint256 normalizedAmount = amount;

        if (decimals < 18) {
            normalizedAmount = amount * (10 ** (18 - decimals));
        } else if (decimals > 18) {
            normalizedAmount = amount / (10 ** (decimals - 18));
        }

        return (normalizedAmount * price) / PRECISION;
    }

    function getDebtValue(address user, address asset) public view virtual returns (uint256) {
        uint256 amount = userBorrows[user][asset];
        uint256 price = assets[asset].price;

        uint256 decimals = IERC20Metadata(asset).decimals();
        uint256 normalizedAmount = amount;

        if (decimals < 18) {
            normalizedAmount = amount * (10 ** (18 - decimals));
        } else if (decimals > 18) {
            normalizedAmount = amount / (10 ** (decimals - 18));
        }

        return (normalizedAmount * price) / PRECISION;
    }

    function canBorrow(address user, address asset, uint256 amount) public view virtual returns (bool) {
        uint256 totalCollateralValue = getTotalCollateralValue(user);

        uint256 decimals = IERC20Metadata(asset).decimals();
        uint256 normalizedAmount = amount;
        if (decimals < 18) {
            normalizedAmount = amount * (10 ** (18 - decimals));
        } else if (decimals > 18) {
            normalizedAmount = amount / (10 ** (decimals - 18));
        }

        uint256 additionalDebtValue = (normalizedAmount * assets[asset].price) / PRECISION;
        uint256 totalDebtValue = getTotalDebtValue(user) + additionalDebtValue;

        if (totalDebtValue == 0) return totalCollateralValue > 0;

        uint256 healthFactor = (totalCollateralValue * PRECISION) / totalDebtValue;
        return healthFactor >= MINIMUM_HEALTH_FACTOR;
    }

    function canWithdraw(address user, address asset, uint256 amount) public view virtual returns (bool) {
        uint256 decimals = IERC20Metadata(asset).decimals();
        uint256 normalizedAmount = amount;
        if (decimals < 18) {
            normalizedAmount = amount * (10 ** (18 - decimals));
        } else if (decimals > 18) {
            normalizedAmount = amount / (10 ** (decimals - 18));
        }

        uint256 collateralToRemove = (normalizedAmount * assets[asset].price) / PRECISION;
        uint256 newCollateralValue = getTotalCollateralValue(user) - collateralToRemove;
        uint256 totalDebtValue = getTotalDebtValue(user);

        if (totalDebtValue == 0) return true;

        uint256 healthFactor = (newCollateralValue * PRECISION) / totalDebtValue;
        return healthFactor >= MINIMUM_HEALTH_FACTOR;
    }

    function isLiquidatable(address user) public view virtual returns (bool) {
        uint256 healthFactor = getHealthFactor(user);
        return healthFactor < LIQUIDATION_THRESHOLD && healthFactor != type(uint256).max;
    }

    function getSupplyBalance(address user, address asset) external view virtual returns (uint256) {
        return userSupplies[user][asset];
    }

    function getBorrowBalance(address user, address asset) external view virtual returns (uint256) {
        return userBorrows[user][asset];
    }

    function getAssetConfig(address asset) external view virtual override returns (Asset memory) {
        return assets[asset];
    }

    function getUserAccountData(address user) public view virtual returns (
        uint256 totalCollateralValue,
        uint256 totalDebtValue,
        uint256 availableBorrows,
        uint256 currentLiquidationThreshold,
        uint256 healthFactor
    ) {
        totalCollateralValue = getTotalCollateralValue(user);
        totalDebtValue = getTotalDebtValue(user);
        healthFactor = getHealthFactor(user);
        currentLiquidationThreshold = LIQUIDATION_THRESHOLD;

        if (totalCollateralValue > 0) {
            uint256 requiredCollateral = (totalDebtValue * MINIMUM_HEALTH_FACTOR) / PRECISION;
            if (totalCollateralValue > requiredCollateral) {
                availableBorrows = totalCollateralValue - requiredCollateral;
            } else {
                availableBorrows = 0;
            }
        } else {
            availableBorrows = 0;
        }
    }

    function getSupportedAssetsCount() external view virtual returns (uint256) {
        return supportedAssets.length;
    }

    function getSupportedAsset(uint256 index) external view virtual returns (address) {
        if (index >= supportedAssets.length) revert InvalidAmount();
        return supportedAssets[index];
    }

    function getWithdrawGasFee(address asset) external view virtual returns (address gasToken, uint256 gasFee) {
        if (!assets[asset].isSupported) revert AssetNotSupported(asset);
        return IZRC20(asset).withdrawGasFee();
    }

    /**
     * @dev Normalize amount to 18 decimals for comparison purposes
     * @param amount The amount to normalize
     * @param decimals The current decimal places of the amount
     * @return normalizedAmount The amount normalized to 18 decimals
     */
    function _normalizeToDecimals(uint256 amount, uint256 decimals) internal pure returns (uint256 normalizedAmount) {
        if (decimals < 18) {
            normalizedAmount = amount * (10 ** (18 - decimals));
        } else if (decimals > 18) {
            normalizedAmount = amount / (10 ** (decimals - 18));
        } else {
            normalizedAmount = amount;
        }
    }

    /**
     * @dev Check if withdrawal amount is sufficient to cover gas fees with proper decimal normalization
     * @param asset The asset being withdrawn
     * @param amount The withdrawal amount in asset decimals
     * @param gasToken The gas token address
     * @param gasFee The gas fee amount in gas token decimals
     * @return true if amount > gas fee after normalization
     */
    function _isAmountSufficientForGas(
        address asset,
        uint256 amount,
        address gasToken,
        uint256 gasFee
    ) internal view returns (bool) {
        // Get decimals for both tokens
        uint256 assetDecimals = IERC20Metadata(asset).decimals();
        uint256 gasTokenDecimals = IERC20Metadata(gasToken).decimals();
        
        // Normalize both amounts to 18 decimals for comparison
        uint256 normalizedAmount = _normalizeToDecimals(amount, assetDecimals);
        uint256 normalizedGasFee = _normalizeToDecimals(gasFee, gasTokenDecimals);
        
        return normalizedAmount > normalizedGasFee;
    }

    /**
     * @dev Validate that withdrawal amount is greater than gas fee, reverts if not
     * @param asset The asset being withdrawn
     * @param amount The withdrawal amount in asset decimals
     */
    function _validateAmountVsGasFee(address asset, uint256 amount) internal view {
        (address gasToken, uint256 gasFee) = IZRC20(asset).withdrawGasFee();
        
        if (!_isAmountSufficientForGas(asset, amount, gasToken, gasFee)) {
            revert InvalidAmount();
        }
    }
}