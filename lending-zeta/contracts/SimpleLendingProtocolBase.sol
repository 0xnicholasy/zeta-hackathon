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
import "./interfaces/IPriceOracle.sol";

/**
 * @title SimpleLendingProtocolBase
 * @dev Base implementation of the simple lending protocol with oracle-based pricing
 */
abstract contract SimpleLendingProtocolBase is
    UniversalContract,
    ISimpleLendingProtocol,
    ReentrancyGuard,
    Ownable
{
    using SafeERC20 for IERC20;

    IGatewayZEVM public immutable gateway;
    IPriceOracle public priceOracle;

    uint256 internal constant PRECISION = 1e18;
    uint256 internal constant MINIMUM_HEALTH_FACTOR = 1.5e18;
    uint256 internal constant LIQUIDATION_THRESHOLD = 1.1e18; // 110%
    uint256 private constant MIN_VALID_PRICE = 1e6; // Minimum valid price

    mapping(address => Asset) public assets;
    mapping(address => mapping(address => uint256)) public userSupplies;
    mapping(address => mapping(address => uint256)) public userBorrows;

    address[] public supportedAssets;
    mapping(address => bool) public isAssetAdded;

    modifier onlyGateway() {
        if (msg.sender != address(gateway)) revert Unauthorized();
        _;
    }

    constructor(
        address payable gatewayAddress,
        address _priceOracle,
        address owner
    ) Ownable(owner) {
        gateway = IGatewayZEVM(gatewayAddress);
        priceOracle = IPriceOracle(_priceOracle);
    }

    // Internal helper function for validated price retrieval
    function _getValidatedPrice(address asset) internal view returns (uint256) {
        uint256 price = priceOracle.getPrice(asset);

        // Basic validation checks
        require(price >= MIN_VALID_PRICE, "Invalid price: too low");

        return price;
    }

    /**
     * @dev Get the current validated price for an asset from the oracle
     * @param asset The asset address
     * @return price The current price in USD with 18 decimals
     */
    function getAssetPrice(
        address asset
    ) external view returns (uint256 price) {
        return _getValidatedPrice(asset);
    }

    // Virtual functions for extension
    function _supply(
        address asset,
        uint256 amount,
        address onBehalfOf
    ) internal virtual {
        if (!assets[asset].isSupported) revert AssetNotSupported(asset);
        if (amount == 0) revert InvalidAmount();

        if (msg.sender != address(gateway)) {
            IERC20(asset).safeTransferFrom(msg.sender, address(this), amount);
        }

        userSupplies[onBehalfOf][asset] += amount;
        emit Supply(onBehalfOf, asset, amount);
    }

    function _repay(
        address asset,
        uint256 amount,
        address onBehalfOf
    ) internal virtual {
        if (!assets[asset].isSupported) revert AssetNotSupported(asset);
        if (amount == 0) revert InvalidAmount();

        uint256 debt = userBorrows[onBehalfOf][asset];
        uint256 repayAmount = amount > debt ? debt : amount;

        if (msg.sender != address(gateway)) {
            IERC20(asset).safeTransferFrom(
                msg.sender,
                address(this),
                repayAmount
            );
        }

        userBorrows[onBehalfOf][asset] -= repayAmount;
        emit Repay(onBehalfOf, asset, repayAmount);
    }

    function _withdraw(
        address asset,
        uint256 amount,
        address user,
        address to,
        bytes memory
    ) internal virtual {
        if (!assets[asset].isSupported) revert AssetNotSupported(asset);
        if (amount == 0) revert InvalidAmount();
        if (userSupplies[user][asset] < amount) revert InsufficientBalance();
        if (!canWithdraw(user, asset, amount)) revert InsufficientCollateral();

        userSupplies[user][asset] -= amount;
        IERC20(asset).safeTransfer(to, amount);
        emit Withdraw(user, asset, amount);
    }

    // View functions implementation
    function getHealthFactor(
        address user
    ) public view virtual returns (uint256) {
        uint256 totalCollateralValue = getTotalCollateralValue(user);
        uint256 totalDebtValue = getTotalDebtValue(user);

        if (totalDebtValue == 0) {
            return type(uint256).max;
        }

        return (totalCollateralValue * PRECISION) / totalDebtValue;
    }

    function getTotalCollateralValue(
        address user
    ) public view virtual returns (uint256) {
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

    function getTotalDebtValue(
        address user
    ) public view virtual returns (uint256) {
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

    function getCollateralValue(
        address user,
        address asset
    ) public view virtual returns (uint256) {
        uint256 amount = userSupplies[user][asset];
        uint256 price = _getValidatedPrice(asset);
        return _calculateAssetValue(amount, asset, price);
    }

    function getDebtValue(
        address user,
        address asset
    ) public view virtual returns (uint256) {
        uint256 amount = userBorrows[user][asset];
        uint256 price = _getValidatedPrice(asset);
        return _calculateAssetValue(amount, asset, price);
    }

    function canBorrow(
        address user,
        address asset,
        uint256 amount
    ) public view virtual returns (bool) {
        // Check if contract has sufficient balance for the borrow
        if (IERC20(asset).balanceOf(address(this)) < amount) {
            return false;
        }

        uint256 totalCollateralValue = getTotalCollateralValue(user);
        uint256 additionalDebtValue = _calculateAssetValue(
            amount,
            asset,
            _getValidatedPrice(asset)
        );
        uint256 totalDebtValue = getTotalDebtValue(user) + additionalDebtValue;

        if (totalDebtValue == 0) return totalCollateralValue > 0;

        uint256 healthFactor = (totalCollateralValue * PRECISION) /
            totalDebtValue;
        return healthFactor >= MINIMUM_HEALTH_FACTOR;
    }

    function canWithdraw(
        address user,
        address asset,
        uint256 amount
    ) public view virtual returns (bool) {
        // Check if contract has sufficient balance for the withdrawal
        if (IERC20(asset).balanceOf(address(this)) < amount) {
            return false;
        }

        uint256 collateralToRemove = _calculateAssetValue(
            amount,
            asset,
            _getValidatedPrice(asset)
        );
        uint256 newCollateralValue = getTotalCollateralValue(user) -
            collateralToRemove;
        uint256 totalDebtValue = getTotalDebtValue(user);

        if (totalDebtValue == 0) return true;

        uint256 healthFactor = (newCollateralValue * PRECISION) /
            totalDebtValue;
        return healthFactor >= MINIMUM_HEALTH_FACTOR;
    }

    function isLiquidatable(address user) public view virtual returns (bool) {
        uint256 healthFactor = getHealthFactor(user);
        return
            healthFactor < LIQUIDATION_THRESHOLD &&
            healthFactor != type(uint256).max;
    }

    function getSupplyBalance(
        address user,
        address asset
    ) external view virtual returns (uint256) {
        return userSupplies[user][asset];
    }

    function getBorrowBalance(
        address user,
        address asset
    ) external view virtual returns (uint256) {
        return userBorrows[user][asset];
    }

    function getAssetConfig(
        address asset
    ) external view virtual override returns (Asset memory) {
        return assets[asset];
    }

    /**
     * @dev Calculate the maximum USD value a user can borrow while maintaining minimum health factor
     * @param user The user address
     * @return maxBorrowUsdValue The maximum USD value that can be borrowed (in 18 decimals)
     */
    function maxAvailableBorrowsInUsd(
        address user
    ) public view virtual returns (uint256 maxBorrowUsdValue) {
        uint256 totalCollateralValue = getTotalCollateralValue(user);
        uint256 totalDebtValue = getTotalDebtValue(user);

        if (totalCollateralValue == 0) return 0;

        // Calculate max total debt value while maintaining minimum health factor
        // healthFactor = totalCollateralValue / totalDebtValue >= MINIMUM_HEALTH_FACTOR
        // So: totalDebtValue <= totalCollateralValue / MINIMUM_HEALTH_FACTOR
        uint256 maxTotalDebtValue = (totalCollateralValue * PRECISION) /
            MINIMUM_HEALTH_FACTOR;

        // Calculate how much more we can borrow
        if (maxTotalDebtValue <= totalDebtValue) return 0;

        maxBorrowUsdValue = maxTotalDebtValue - totalDebtValue;
    }

    /**
     * @dev Calculate the maximum amount of a specific asset a user can borrow
     * @param user The user address
     * @param asset The asset address to borrow
     * @return maxBorrowAmount The maximum amount in asset decimals that can be borrowed
     */
    function maxAvailableBorrows(
        address user,
        address asset
    ) public view virtual returns (uint256 maxBorrowAmount) {
        if (!assets[asset].isSupported) return 0;

        uint256 totalCollateralValue = getTotalCollateralValue(user);
        uint256 totalDebtValue = getTotalDebtValue(user);

        if (totalCollateralValue == 0) return 0;

        // Calculate max total debt value while maintaining minimum health factor
        // healthFactor = totalCollateralValue / totalDebtValue >= MINIMUM_HEALTH_FACTOR
        // So: totalDebtValue <= totalCollateralValue / MINIMUM_HEALTH_FACTOR
        uint256 maxTotalDebtValue = (totalCollateralValue * PRECISION) /
            MINIMUM_HEALTH_FACTOR;

        // Calculate how much more we can borrow
        if (maxTotalDebtValue <= totalDebtValue) return 0;

        uint256 additionalBorrowValueUsd = maxTotalDebtValue - totalDebtValue;

        // Convert USD value to asset amount
        uint256 assetPrice = _getValidatedPrice(asset);
        if (assetPrice == 0) return 0;

        // Calculate asset amount and denormalize to asset decimals
        uint256 maxBorrowValueNormalized = (additionalBorrowValueUsd *
            PRECISION) / assetPrice;

        uint256 decimals = IERC20Metadata(asset).decimals();
        maxBorrowAmount = _denormalizeFromDecimals(
            maxBorrowValueNormalized,
            decimals
        );

        // Limit by contract's available balance
        uint256 contractBalance = IERC20(asset).balanceOf(address(this));
        if (maxBorrowAmount > contractBalance) {
            maxBorrowAmount = contractBalance;
        }
    }

    /**
     * @dev Get the maximum amount of an asset available in the contract
     * @param asset The asset address
     * @return amount The maximum available amount in asset decimals
     */
    function maxAvailableAmount(
        address asset
    ) public view virtual returns (uint256 amount) {
        if (!assets[asset].isSupported) return 0;
        return IERC20(asset).balanceOf(address(this));
    }

    function getSupportedAssetsCount() external view virtual returns (uint256) {
        return supportedAssets.length;
    }

    function getSupportedAsset(
        uint256 index
    ) external view virtual returns (address) {
        if (index >= supportedAssets.length) revert InvalidAmount();
        return supportedAssets[index];
    }

    function getWithdrawGasFee(
        address asset
    ) external view virtual returns (address gasToken, uint256 gasFee) {
        if (!assets[asset].isSupported) revert AssetNotSupported(asset);
        return IZRC20(asset).withdrawGasFee();
    }

    /**
     * @dev Normalize amount to 18 decimals for comparison purposes
     * @param amount The amount to normalize
     * @param decimals The current decimal places of the amount
     * @return normalizedAmount The amount normalized to 18 decimals
     */
    function _normalizeToDecimals(
        uint256 amount,
        uint256 decimals
    ) internal pure returns (uint256 normalizedAmount) {
        if (decimals < 18) {
            normalizedAmount = amount * (10 ** (18 - decimals));
        } else if (decimals > 18) {
            normalizedAmount = amount / (10 ** (decimals - 18));
        } else {
            normalizedAmount = amount;
        }
    }

    /**
     * @dev Denormalize amount from 18 decimals back to asset decimals
     * @param normalizedAmount The normalized amount (18 decimals)
     * @param decimals The target decimal places
     * @return amount The amount in target decimals
     */
    function _denormalizeFromDecimals(
        uint256 normalizedAmount,
        uint256 decimals
    ) internal pure returns (uint256 amount) {
        if (decimals < 18) {
            amount = normalizedAmount / (10 ** (18 - decimals));
        } else if (decimals > 18) {
            amount = normalizedAmount * (10 ** (decimals - 18));
        } else {
            amount = normalizedAmount;
        }
    }

    /**
     * @dev Calculate USD value of an asset amount using asset decimals and price
     * @param amount The amount in asset's native decimals
     * @param asset The asset address (to get decimals)
     * @param price The asset price (18 decimals)
     * @return value The USD value (18 decimals)
     */
    function _calculateAssetValue(
        uint256 amount,
        address asset,
        uint256 price
    ) internal view returns (uint256 value) {
        if (amount == 0 || price == 0) return 0;

        uint256 decimals = IERC20Metadata(asset).decimals();
        uint256 normalizedAmount = _normalizeToDecimals(amount, decimals);
        return (normalizedAmount * price) / PRECISION;
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
        uint256 normalizedGasFee = _normalizeToDecimals(
            gasFee,
            gasTokenDecimals
        );

        return normalizedAmount > normalizedGasFee;
    }

    /**
     * @dev Validate that withdrawal amount is greater than gas fee, reverts if not
     * @param asset The asset being withdrawn
     * @param amount The withdrawal amount in asset decimals
     */
    function _validateAmountVsGasFee(
        address asset,
        uint256 amount
    ) internal view {
        (address gasToken, uint256 gasFee) = IZRC20(asset).withdrawGasFee();

        if (!_isAmountSufficientForGas(asset, amount, gasToken, gasFee)) {
            revert InvalidAmount();
        }
    }

    // ============ Health Factor Preview Functions ============
    // Updated to use oracle-based pricing

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
    ) public view virtual returns (uint256 newHealthFactor) {
        if (!assets[asset].isSupported) return 0;

        uint256 currentDebtValue = getTotalDebtValue(user);
        uint256 additionalDebtValue = _calculateAssetValue(
            amount,
            asset,
            _getValidatedPrice(asset)
        );
        uint256 newTotalDebtValue = currentDebtValue + additionalDebtValue;

        if (newTotalDebtValue == 0) {
            return type(uint256).max;
        }

        uint256 totalCollateralValue = getTotalCollateralValue(user);
        return (totalCollateralValue * PRECISION) / newTotalDebtValue;
    }

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
    ) public view virtual returns (uint256 newHealthFactor) {
        if (!assets[asset].isSupported) return type(uint256).max;

        uint256 currentDebtValue = getTotalDebtValue(user);
        uint256 repayDebtValue = _calculateAssetValue(
            amount,
            asset,
            _getValidatedPrice(asset)
        );
        uint256 userAssetDebt = userBorrows[user][asset];
        uint256 userAssetDebtValue = _calculateAssetValue(
            userAssetDebt,
            asset,
            _getValidatedPrice(asset)
        );

        // Cap repay amount to actual debt
        uint256 actualRepayValue = repayDebtValue > userAssetDebtValue
            ? userAssetDebtValue
            : repayDebtValue;
        uint256 newTotalDebtValue = currentDebtValue > actualRepayValue
            ? currentDebtValue - actualRepayValue
            : 0;

        if (newTotalDebtValue == 0) {
            return type(uint256).max;
        }

        uint256 totalCollateralValue = getTotalCollateralValue(user);
        return (totalCollateralValue * PRECISION) / newTotalDebtValue;
    }

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
    ) public view virtual returns (uint256 newHealthFactor) {
        if (!assets[asset].isSupported) return 0;

        uint256 currentDebtValue = getTotalDebtValue(user);

        if (currentDebtValue == 0) {
            return type(uint256).max;
        }

        // Calculate new collateral value after withdrawal
        uint256 withdrawalValue = _calculateAssetValue(
            amount,
            asset,
            _getValidatedPrice(asset)
        );
        uint256 currentCollateralValue = getTotalCollateralValue(user);
        uint256 newCollateralValue = currentCollateralValue > withdrawalValue
            ? currentCollateralValue - withdrawalValue
            : 0;

        return (newCollateralValue * PRECISION) / currentDebtValue;
    }

    /**
     * @dev Get comprehensive user position data
     * @param user The user address
     * @return totalCollateralValue Total collateral value in USD
     * @return totalDebtValue Total debt value in USD
     * @return healthFactor Current health factor
     * @return maxBorrowUsdValue Maximum borrowable value in USD
     * @return liquidationThreshold Always returns LIQUIDATION_THRESHOLD (base implementation)
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
        public
        view
        virtual
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
        )
    {
        totalCollateralValue = getTotalCollateralValue(user);
        totalDebtValue = getTotalDebtValue(user);
        healthFactor = getHealthFactor(user);
        maxBorrowUsdValue = maxAvailableBorrowsInUsd(user);
        liquidationThreshold = LIQUIDATION_THRESHOLD; // Base implementation uses constant

        // Count assets
        uint256 suppliedCount = 0;
        uint256 borrowedCount = 0;

        for (uint256 i = 0; i < supportedAssets.length; i++) {
            address asset = supportedAssets[i];
            if (userSupplies[user][asset] > 0) suppliedCount++;
            if (userBorrows[user][asset] > 0) borrowedCount++;
        }

        // Initialize arrays
        suppliedAssets = new address[](suppliedCount);
        suppliedAmounts = new uint256[](suppliedCount);
        suppliedValues = new uint256[](suppliedCount);
        borrowedAssets = new address[](borrowedCount);
        borrowedAmounts = new uint256[](borrowedCount);
        borrowedValues = new uint256[](borrowedCount);

        // Fill supplied assets data
        uint256 suppliedIndex = 0;
        uint256 borrowedIndex = 0;

        for (uint256 i = 0; i < supportedAssets.length; i++) {
            address asset = supportedAssets[i];

            uint256 supplyBalance = userSupplies[user][asset];
            if (supplyBalance > 0) {
                suppliedAssets[suppliedIndex] = asset;
                suppliedAmounts[suppliedIndex] = supplyBalance;
                suppliedValues[suppliedIndex] = getCollateralValue(user, asset);
                suppliedIndex++;
            }

            uint256 borrowBalance = userBorrows[user][asset];
            if (borrowBalance > 0) {
                borrowedAssets[borrowedIndex] = asset;
                borrowedAmounts[borrowedIndex] = borrowBalance;
                borrowedValues[borrowedIndex] = getDebtValue(user, asset);
                borrowedIndex++;
            }
        }
    }

    // Standardized cross-chain gateway functions
    function onCall(
        MessageContext calldata context,
        address zrc20,
        uint256 amount,
        bytes calldata message
    ) external virtual onlyGateway {
        // Standard message handling - 128 bytes for basic operations
        if (message.length == 128) {
            (string memory action, address onBehalfOf) = abi.decode(
                message,
                (string, address)
            );
            if (
                keccak256(abi.encodePacked(action)) ==
                keccak256(abi.encodePacked("supply"))
            ) {
                _supply(zrc20, amount, onBehalfOf);
                return;
            } else if (
                keccak256(abi.encodePacked(action)) ==
                keccak256(abi.encodePacked("repay"))
            ) {
                _repay(zrc20, amount, onBehalfOf);
                return;
            }
        }
        // Extended message handling - 224 bytes for cross-chain operations
        else if (message.length == 224) {
            (
                string memory action,
                address user,
                uint256 operationAmount,
                uint256 destinationChain,
                address recipient
            ) = abi.decode(
                    message,
                    (string, address, uint256, uint256, address)
                );
            if (
                keccak256(abi.encodePacked(action)) ==
                keccak256(abi.encodePacked("borrowCrossChain"))
            ) {
                _borrowCrossChainFromCall(
                    zrc20,
                    operationAmount,
                    user,
                    destinationChain,
                    recipient
                );
                return;
            } else if (
                keccak256(abi.encodePacked(action)) ==
                keccak256(abi.encodePacked("withdrawCrossChain"))
            ) {
                _withdrawCrossChainFromCall(
                    zrc20,
                    operationAmount,
                    user,
                    destinationChain,
                    recipient
                );
                return;
            }
        }

        revert("Invalid operation or message format");
    }

    function onRevert(
        RevertContext calldata revertContext
    ) external virtual onlyGateway {
        // Standard revert handling for all implementations
        emit Withdraw(address(0), revertContext.asset, revertContext.amount);
    }

    // Virtual cross-chain functions to be implemented by child contracts if needed
    function _borrowCrossChainFromCall(
        address asset,
        uint256 amount,
        address user,
        uint256 destinationChain,
        address recipient
    ) internal virtual {
        if (!assets[asset].isSupported) revert AssetNotSupported(asset);
        if (amount == 0) revert InvalidAmount();
        if (IERC20(asset).balanceOf(address(this)) < amount)
            revert InsufficientBalance();
        if (!canBorrow(user, asset, amount)) revert InsufficientCollateral();

        _validateAmountVsGasFee(asset, amount);
        userBorrows[user][asset] += amount;

        (address gasZRC20, uint256 gasFee) = IZRC20(asset).withdrawGasFee();
        uint256 withdrawalAmount = amount;
        uint256 approvalAmount = amount;

        if (asset == gasZRC20) {
            withdrawalAmount = amount - gasFee;
            approvalAmount = amount;
            if (IERC20(asset).balanceOf(address(this)) < approvalAmount) {
                revert InsufficientBalance();
            }
            IERC20(asset).approve(address(gateway), approvalAmount);
        } else {
            // Different gas token - need to handle gas token from user's account
            if (IERC20(asset).balanceOf(address(this)) < amount) {
                revert InsufficientBalance();
            }
            IERC20(asset).approve(address(gateway), amount);

            // Check if user has sufficient gas tokens and transfer them
            uint256 userGasBalance = IERC20(gasZRC20).balanceOf(user);
            if (userGasBalance < gasFee) {
                revert InsufficientGasFee(gasZRC20, gasFee, userGasBalance);
            }

            // Transfer gas tokens from user to contract for gateway fee
            if (!IERC20(gasZRC20).transferFrom(user, address(this), gasFee)) {
                revert InsufficientGasFee(gasZRC20, gasFee, userGasBalance);
            }
            IERC20(gasZRC20).approve(address(gateway), gasFee);
        }

        gateway.withdraw(
            abi.encodePacked(recipient),
            withdrawalAmount,
            asset,
            RevertOptions({
                revertAddress: user,
                callOnRevert: true,
                abortAddress: user,
                revertMessage: abi.encode(destinationChain),
                onRevertGasLimit: 300000
            })
        );

        emit Borrow(user, asset, amount);
    }

    function _withdrawCrossChainFromCall(
        address asset,
        uint256 amount,
        address user,
        uint256 destinationChain,
        address recipient
    ) internal virtual {
        if (!assets[asset].isSupported) revert AssetNotSupported(asset);
        if (amount == 0) revert InvalidAmount();
        if (userSupplies[user][asset] < amount) revert InsufficientBalance();
        if (!canWithdraw(user, asset, amount)) revert InsufficientCollateral();

        _validateAmountVsGasFee(asset, amount);
        userSupplies[user][asset] -= amount;

        (address gasZRC20, uint256 gasFee) = IZRC20(asset).withdrawGasFee();
        uint256 withdrawalAmount = amount;
        uint256 approvalAmount = amount;

        if (asset == gasZRC20) {
            withdrawalAmount = amount - gasFee;
            approvalAmount = amount;
            if (IERC20(asset).balanceOf(address(this)) < approvalAmount) {
                revert InsufficientBalance();
            }
            IERC20(asset).approve(address(gateway), approvalAmount);
        } else {
            // Different gas token - need to handle gas token from user's account
            if (IERC20(asset).balanceOf(address(this)) < amount) {
                revert InsufficientBalance();
            }
            IERC20(asset).approve(address(gateway), amount);

            // Check if user has sufficient gas tokens and transfer them
            uint256 userGasBalance = IERC20(gasZRC20).balanceOf(user);
            if (userGasBalance < gasFee) {
                revert InsufficientGasFee(gasZRC20, gasFee, userGasBalance);
            }

            // Transfer gas tokens from user to contract for gateway fee
            if (!IERC20(gasZRC20).transferFrom(user, address(this), gasFee)) {
                revert InsufficientGasFee(gasZRC20, gasFee, userGasBalance);
            }
            IERC20(gasZRC20).approve(address(gateway), gasFee);
        }

        gateway.withdraw(
            abi.encodePacked(recipient),
            withdrawalAmount,
            asset,
            RevertOptions({
                revertAddress: user,
                callOnRevert: true,
                abortAddress: user,
                revertMessage: abi.encode(destinationChain),
                onRevertGasLimit: 300000
            })
        );

        emit Withdraw(user, asset, amount);
    }
}
