// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import "@zetachain/protocol-contracts/contracts/zevm/interfaces/IZRC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./SimpleLendingProtocolBase.sol";

/**
 * @title SimpleLendingProtocol
 * @dev A universal lending protocol for ZetaChain that enables cross-chain lending and borrowing
 */
contract SimpleLendingProtocol is SimpleLendingProtocolBase {
    using SafeERC20 for IERC20;
    constructor(address payable gatewayAddress, address owner) 
        SimpleLendingProtocolBase(gatewayAddress, owner) {}

    // Admin functions
    function addAsset(address asset, uint256 priceInUSD) external onlyOwner {
        assets[asset] = Asset({
            isSupported: true,
            price: priceInUSD * PRECISION
        });

        if (!isAssetAdded[asset]) {
            supportedAssets.push(asset);
            isAssetAdded[asset] = true;
        }
    }

    function updatePrice(address asset, uint256 priceInUSD) external onlyOwner {
        if (!assets[asset].isSupported) revert AssetNotSupported(asset);
        assets[asset].price = priceInUSD * PRECISION;
    }

    // Core lending functions
    function supply(address asset, uint256 amount, address onBehalfOf) external virtual nonReentrant {
        _supply(asset, amount, onBehalfOf);
    }

    function borrow(address asset, uint256 amount, address to) external virtual nonReentrant {
        if (!assets[asset].isSupported) revert AssetNotSupported(asset);
        if (amount == 0) revert InvalidAmount();
        if (IERC20(asset).balanceOf(address(this)) < amount) revert InsufficientLiquidity();
        if (!canBorrow(msg.sender, asset, amount)) revert InsufficientCollateral();

        userBorrows[msg.sender][asset] += amount;
        IERC20(asset).safeTransfer(to, amount);

        emit Borrow(msg.sender, asset, amount);
    }

    function borrowCrossChain(
        address asset,
        uint256 amount,
        uint256 destinationChain,
        address recipient
    ) external nonReentrant {
        if (!assets[asset].isSupported) revert AssetNotSupported(asset);
        if (amount == 0) revert InvalidAmount();
        if (IERC20(asset).balanceOf(address(this)) < amount) revert InsufficientLiquidity();
        if (!canBorrow(msg.sender, asset, amount)) revert InsufficientCollateral();

        (address gasZRC20, uint256 gasFee) = IZRC20(asset).withdrawGasFee();
        if (amount <= gasFee) revert InvalidAmount();

        userBorrows[msg.sender][asset] += amount;

        uint256 withdrawalAmount = amount;
        uint256 approvalAmount = amount;

        if (asset == gasZRC20) {
            withdrawalAmount = amount - gasFee;
            approvalAmount = amount;

            if (IERC20(asset).balanceOf(address(this)) < approvalAmount) revert InsufficientLiquidity();
            IERC20(asset).approve(address(gateway), approvalAmount);
        } else {
            if (IERC20(asset).balanceOf(address(this)) < amount) revert InsufficientLiquidity();
            IERC20(asset).approve(address(gateway), amount);

            uint256 userGasBalance = IERC20(gasZRC20).balanceOf(msg.sender);
            if (userGasBalance < gasFee) revert InsufficientGasFee(gasZRC20, gasFee, userGasBalance);
            if (!IERC20(gasZRC20).transferFrom(msg.sender, address(this), gasFee)) revert InsufficientGasFee(gasZRC20, gasFee, userGasBalance);
            IERC20(gasZRC20).approve(address(gateway), gasFee);
        }

        gateway.withdraw(
            abi.encodePacked(recipient),
            withdrawalAmount,
            asset,
            RevertOptions({
                revertAddress: address(this),
                callOnRevert: false,
                abortAddress: address(0),
                revertMessage: abi.encodePacked(""),
                onRevertGasLimit: 0
            })
        );

        emit Borrow(msg.sender, asset, amount);
    }

    function repay(address asset, uint256 amount, address onBehalfOf) external nonReentrant {
        _repay(asset, amount, onBehalfOf);
    }

    function withdraw(address asset, uint256 amount, address to) external nonReentrant {
        _withdraw(asset, amount, msg.sender, to, "");
    }

    function withdrawCrossChain(
        address asset,
        uint256 amount,
        uint256 destinationChain,
        address recipient
    ) external nonReentrant {
        if (!assets[asset].isSupported) revert AssetNotSupported(asset);
        if (amount == 0) revert InvalidAmount();
        if (userSupplies[msg.sender][asset] < amount) revert InsufficientBalance();
        if (!canWithdraw(msg.sender, asset, amount)) revert InsufficientCollateral();

        (address gasZRC20, uint256 gasFee) = IZRC20(asset).withdrawGasFee();
        if (amount <= gasFee) revert InvalidAmount();

        userSupplies[msg.sender][asset] -= amount;

        uint256 withdrawalAmount = amount;
        uint256 approvalAmount = amount;

        if (asset == gasZRC20) {
            withdrawalAmount = amount - gasFee;
            approvalAmount = amount;

            if (IERC20(asset).balanceOf(address(this)) < approvalAmount) revert InsufficientLiquidity();
            IERC20(asset).approve(address(gateway), approvalAmount);
        } else {
            if (IERC20(asset).balanceOf(address(this)) < amount) revert InsufficientLiquidity();
            IERC20(asset).approve(address(gateway), amount);

            if (!IERC20(gasZRC20).transferFrom(msg.sender, address(this), gasFee)) revert InsufficientCollateral();
            IERC20(gasZRC20).approve(address(gateway), gasFee);
        }

        gateway.withdraw(
            abi.encodePacked(recipient),
            withdrawalAmount,
            asset,
            RevertOptions({
                revertAddress: address(this),
                callOnRevert: false,
                abortAddress: address(0),
                revertMessage: abi.encodePacked(""),
                onRevertGasLimit: 0
            })
        );

        emit Withdraw(msg.sender, asset, amount);
    }

    function liquidate(
        address user,
        address collateralAsset,
        address debtAsset,
        uint256 repayAmount
    ) external virtual nonReentrant {
        if (!assets[collateralAsset].isSupported || !assets[debtAsset].isSupported) revert AssetNotSupported(collateralAsset);
        if (repayAmount == 0) revert InvalidAmount();
        if (userBorrows[user][debtAsset] < repayAmount) revert InvalidAmount();
        if (!isLiquidatable(user)) revert HealthFactorTooLow();

        uint256 collateralValue = (repayAmount * assets[debtAsset].price * 105) / (100 * assets[collateralAsset].price);
        if (userSupplies[user][collateralAsset] < collateralValue) revert InsufficientCollateral();

        IERC20(debtAsset).safeTransferFrom(msg.sender, address(this), repayAmount);

        userBorrows[user][debtAsset] -= repayAmount;
        userSupplies[user][collateralAsset] -= collateralValue;

        IERC20(collateralAsset).safeTransfer(msg.sender, collateralValue);

        emit Liquidate(msg.sender, user, collateralAsset, debtAsset, repayAmount, collateralValue);
    }

    // Gateway functions - Simple pattern matching
    function onCall(
        MessageContext calldata /* context */,
        address zrc20,
        uint256 amount,
        bytes calldata message
    ) external virtual override onlyGateway {
        if (message.length == 128) {
            (string memory action, address onBehalfOf) = abi.decode(message, (string, address));

            if (keccak256(abi.encodePacked(action)) == keccak256(abi.encodePacked("supply"))) {
                _supply(zrc20, amount, onBehalfOf);
                return;
            } else if (keccak256(abi.encodePacked(action)) == keccak256(abi.encodePacked("repay"))) {
                _repay(zrc20, amount, onBehalfOf);
                return;
            }
        } else if (message.length == 224) {
            (
                string memory action,
                address user,
                uint256 operationAmount,
                uint256 destinationChain,
                address recipient
            ) = abi.decode(message, (string, address, uint256, uint256, address));

            if (keccak256(abi.encodePacked(action)) == keccak256(abi.encodePacked("borrowCrossChain"))) {
                _borrowCrossChainFromCall(zrc20, operationAmount, user, destinationChain, recipient);
                return;
            } else if (keccak256(abi.encodePacked(action)) == keccak256(abi.encodePacked("withdrawCrossChain"))) {
                _withdrawCrossChainFromCall(zrc20, operationAmount, user, destinationChain, recipient);
                return;
            }
        }

        revert("Invalid action or message format");
    }

    function onRevert(RevertContext calldata revertContext) external virtual onlyGateway {
        emit Withdraw(address(0), address(0), 0);
    }

    // Internal cross-chain helpers
    function _borrowCrossChainFromCall(
        address asset,
        uint256 amount,
        address user,
        uint256 destinationChain,
        address recipient
    ) internal {
        if (!assets[asset].isSupported) revert AssetNotSupported(asset);
        if (amount == 0) revert InvalidAmount();
        if (IERC20(asset).balanceOf(address(this)) < amount) revert InsufficientLiquidity();
        if (!canBorrow(user, asset, amount)) revert InsufficientCollateral();

        (address gasZRC20, uint256 gasFee) = IZRC20(asset).withdrawGasFee();
        if (amount <= gasFee) revert InvalidAmount();

        userBorrows[user][asset] += amount;

        uint256 withdrawalAmount = amount;
        uint256 approvalAmount = amount;

        if (asset == gasZRC20) {
            withdrawalAmount = amount - gasFee;
            approvalAmount = amount;

            if (IERC20(asset).balanceOf(address(this)) < approvalAmount) revert InsufficientLiquidity();
            IERC20(asset).approve(address(gateway), approvalAmount);
        } else {
            if (IERC20(asset).balanceOf(address(this)) < amount) revert InsufficientLiquidity();
            IERC20(asset).approve(address(gateway), amount);

            uint256 userGasBalance = IERC20(gasZRC20).balanceOf(user);
            if (userGasBalance < gasFee) revert InsufficientGasFee(gasZRC20, gasFee, userGasBalance);
            if (!IERC20(gasZRC20).transferFrom(user, address(this), gasFee)) revert InsufficientGasFee(gasZRC20, gasFee, userGasBalance);
            IERC20(gasZRC20).approve(address(gateway), gasFee);
        }

        gateway.withdraw(
            abi.encodePacked(recipient),
            withdrawalAmount,
            asset,
            RevertOptions({
                revertAddress: address(this),
                callOnRevert: false,
                abortAddress: address(0),
                revertMessage: abi.encodePacked(""),
                onRevertGasLimit: 0
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
    ) internal {
        if (!assets[asset].isSupported) revert AssetNotSupported(asset);
        if (amount == 0) revert InvalidAmount();
        if (userSupplies[user][asset] < amount) revert InsufficientBalance();
        if (!canWithdraw(user, asset, amount)) revert InsufficientCollateral();

        (address gasZRC20, uint256 gasFee) = IZRC20(asset).withdrawGasFee();
        if (amount <= gasFee) revert InvalidAmount();

        userSupplies[user][asset] -= amount;

        uint256 withdrawalAmount = amount;
        uint256 approvalAmount = amount;

        if (asset == gasZRC20) {
            withdrawalAmount = amount - gasFee;
            approvalAmount = amount;

            if (IERC20(asset).balanceOf(address(this)) < approvalAmount) revert InsufficientLiquidity();
            IERC20(asset).approve(address(gateway), approvalAmount);
        } else {
            if (IERC20(asset).balanceOf(address(this)) < amount) revert InsufficientLiquidity();
            IERC20(asset).approve(address(gateway), amount);

            uint256 userGasBalance = IERC20(gasZRC20).balanceOf(user);
            if (userGasBalance < gasFee) revert InsufficientGasFee(gasZRC20, gasFee, userGasBalance);
            if (!IERC20(gasZRC20).transferFrom(user, address(this), gasFee)) revert InsufficientGasFee(gasZRC20, gasFee, userGasBalance);
            IERC20(gasZRC20).approve(address(gateway), gasFee);
        }

        gateway.withdraw(
            abi.encodePacked(recipient),
            withdrawalAmount,
            asset,
            RevertOptions({
                revertAddress: address(this),
                callOnRevert: false,
                abortAddress: address(0),
                revertMessage: abi.encodePacked(""),
                onRevertGasLimit: 0
            })
        );

        emit Withdraw(user, asset, amount);
    }
}