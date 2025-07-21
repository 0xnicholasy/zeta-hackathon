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

/**
 * @title SimpleLendingProtocol
 * @dev A universal lending protocol for ZetaChain that enables cross-chain lending and borrowing
 * @notice This contract allows users to supply collateral, borrow assets, and perform liquidations
 *         with cross-chain functionality via ZetaChain's gateway
 */
contract SimpleLendingProtocol is UniversalContract, ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    IGatewayZEVM public immutable gateway;

    uint256 private constant PRECISION = 1e18;
    uint256 private constant MINIMUM_HEALTH_FACTOR = 1.5e18;
    uint256 private constant LIQUIDATION_THRESHOLD = 1.2e18;

    struct Asset {
        bool isSupported;
        uint256 price; // Price in USD with 18 decimals
    }

    mapping(address => Asset) public assets;
    mapping(address => mapping(address => uint256)) public userSupplies; // user -> asset -> amount
    mapping(address => mapping(address => uint256)) public userBorrows; // user -> asset -> amount

    // Keep track of supported assets for iteration
    address[] public supportedAssets;
    mapping(address => bool) public isAssetAdded;

    error Unauthorized();

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

    modifier onlyGateway() {
        if (msg.sender != address(gateway)) revert Unauthorized();
        _;
    }

    /**
     * @dev Initializes the lending protocol with gateway and owner
     * @param gatewayAddress The address of the ZetaChain Gateway contract for cross-chain operations
     * @param owner The address that will own this contract and have admin privileges
     */
    constructor(address payable gatewayAddress, address owner) Ownable(owner) {
        gateway = IGatewayZEVM(gatewayAddress);
    }

    /**
     * @notice Adds a new asset to the lending protocol with its USD price
     * @dev Only owner can add new assets. Price is converted to 18 decimals internally
     * @param asset The address of the asset token to add
     * @param priceInUSD The price of the asset in USD (without decimals, e.g., 2000 for $2000)
     */
    function addAsset(address asset, uint256 priceInUSD) external onlyOwner {
        assets[asset] = Asset({
            isSupported: true,
            price: priceInUSD * PRECISION // Convert to 18 decimals
        });

        if (!isAssetAdded[asset]) {
            supportedAssets.push(asset);
            isAssetAdded[asset] = true;
        }
    }

    /**
     * @notice Updates the USD price of an existing asset
     * @dev Only owner can update prices. Asset must already be supported
     * @param asset The address of the asset token to update
     * @param priceInUSD The new price of the asset in USD (without decimals)
     */
    function updatePrice(address asset, uint256 priceInUSD) external onlyOwner {
        require(assets[asset].isSupported, "Asset not supported");
        assets[asset].price = priceInUSD * PRECISION;
    }

    /**
     * @notice Universal contract function called by ZetaChain Gateway for cross-chain operations
     * @dev Handles cross-chain supply and repay operations. Only callable by the gateway
     * @param zrc20 The ZRC-20 token address being transferred
     * @param amount The amount of tokens being transferred
     * @param message Encoded message containing action ("supply" or "repay") and beneficiary address
     */
    function onCall(
        MessageContext calldata /* context */,
        address zrc20,
        uint256 amount,
        bytes calldata message
    ) external override onlyGateway {
        (string memory action, address onBehalfOf) = abi.decode(
            message,
            (string, address)
        );

        if (
            keccak256(abi.encodePacked(action)) ==
            keccak256(abi.encodePacked("supply"))
        ) {
            _supply(zrc20, amount, onBehalfOf);
        } else if (
            keccak256(abi.encodePacked(action)) ==
            keccak256(abi.encodePacked("repay"))
        ) {
            _repay(zrc20, amount, onBehalfOf);
        } else {
            revert("Invalid action");
        }
    }

    /**
     * @notice Supply tokens as collateral to the lending protocol
     * @dev Tokens are transferred from caller and credited to the specified account
     * @param asset The address of the asset token to supply
     * @param amount The amount of tokens to supply (in token's native decimals)
     * @param onBehalfOf The address to credit the supply to
     */
    function supply(
        address asset,
        uint256 amount,
        address onBehalfOf
    ) external nonReentrant {
        _supply(asset, amount, onBehalfOf);
    }

    function _supply(
        address asset,
        uint256 amount,
        address onBehalfOf
    ) internal {
        require(assets[asset].isSupported, "Asset not supported");
        require(amount > 0, "Amount must be greater than 0");

        // For gateway calls, tokens are already transferred to this contract
        if (msg.sender != address(gateway)) {
            IERC20(asset).safeTransferFrom(msg.sender, address(this), amount);
        }

        userSupplies[onBehalfOf][asset] += amount;

        emit Supply(onBehalfOf, asset, amount);
    }

    /**
     * @notice Borrow tokens against supplied collateral
     * @dev Requires sufficient collateral ratio (150% minimum). Tokens are transferred to specified address
     * @param asset The address of the asset token to borrow
     * @param amount The amount of tokens to borrow (in token's native decimals)
     * @param to The address to receive the borrowed tokens
     */
    function borrow(
        address asset,
        uint256 amount,
        address to
    ) external nonReentrant {
        require(assets[asset].isSupported, "Asset not supported");
        require(amount > 0, "Amount must be greater than 0");
        require(
            IERC20(asset).balanceOf(address(this)) >= amount,
            "Insufficient liquidity"
        );

        // Check if user has enough collateral
        require(
            canBorrow(msg.sender, asset, amount),
            "Insufficient collateral"
        );

        userBorrows[msg.sender][asset] += amount;
        IERC20(asset).safeTransfer(to, amount);

        emit Borrow(msg.sender, asset, amount);
    }

    /**
     * @notice Repay borrowed tokens to reduce debt
     * @dev Tokens are transferred from caller to reduce the specified user's debt balance
     * @param asset The address of the asset token to repay
     * @param amount The amount of tokens to repay (in token's native decimals)
     * @param onBehalfOf The address whose debt will be reduced
     */
    function repay(
        address asset,
        uint256 amount,
        address onBehalfOf
    ) external nonReentrant {
        _repay(asset, amount, onBehalfOf);
    }

    function _repay(
        address asset,
        uint256 amount,
        address onBehalfOf
    ) internal {
        require(assets[asset].isSupported, "Asset not supported");
        require(amount > 0, "Amount must be greater than 0");

        uint256 debt = userBorrows[onBehalfOf][asset];
        uint256 repayAmount = amount > debt ? debt : amount;

        // For gateway calls, tokens are already transferred to this contract
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

    /**
     * @notice Withdraw supplied collateral tokens locally
     * @dev Requires maintaining minimum collateral ratio if user has debt
     * @param asset The address of the asset token to withdraw
     * @param amount The amount of tokens to withdraw (in token's native decimals)
     * @param to The address to receive the withdrawn tokens
     */
    function withdraw(
        address asset,
        uint256 amount,
        address to
    ) external nonReentrant {
        _withdraw(asset, amount, msg.sender, to, "");
    }

    /**
     * @notice Withdraw supplied collateral tokens to an external chain
     * @dev Uses ZRC-20 withdraw function for cross-chain transfer
     * @param asset The address of the ZRC-20 asset token to withdraw
     * @param amount The amount of tokens to withdraw (in token's native decimals)
     * @param destinationChain The chain ID to withdraw to
     * @param recipient The address on the destination chain to receive tokens
     */
    function withdrawCrossChain(
        address asset,
        uint256 amount,
        uint256 destinationChain,
        address recipient
    ) external nonReentrant {
        _withdrawCrossChain(
            asset,
            amount,
            msg.sender,
            destinationChain,
            recipient
        );
    }

    function _withdraw(
        address asset,
        uint256 amount,
        address user,
        address to,
        bytes memory /* recipientData */
    ) internal {
        require(assets[asset].isSupported, "Asset not supported");
        require(amount > 0, "Amount must be greater than 0");
        require(userSupplies[user][asset] >= amount, "Insufficient balance");

        // Check if withdrawal would break collateral ratio
        require(
            canWithdraw(user, asset, amount),
            "Would break collateral ratio"
        );

        userSupplies[user][asset] -= amount;

        // Local withdrawal
        IERC20(asset).safeTransfer(to, amount);

        emit Withdraw(user, asset, amount);
    }

    function _withdrawCrossChain(
        address asset,
        uint256 amount,
        address user,
        uint256 /* destinationChain */,
        address recipient
    ) internal {
        require(assets[asset].isSupported, "Asset not supported");
        require(amount > 0, "Amount must be greater than 0");
        require(userSupplies[user][asset] >= amount, "Insufficient balance");

        require(
            canWithdraw(user, asset, amount),
            "Would break collateral ratio"
        );

        // Get gas fee information for cross-chain withdrawal
        (address gasZRC20, uint256 gasFee) = IZRC20(asset).withdrawGasFee();
        require(amount > gasFee, "Amount must be greater than gas fee");

        // Update user balance before performing withdrawal
        userSupplies[user][asset] -= amount;

        // Adjust withdrawal logic based on whether asset == gasZRC20
        uint256 withdrawalAmount = amount;
        uint256 approvalAmount = amount;

        if (asset == gasZRC20) {
            // Asset and gas token are the same (e.g., ETH.ARBI withdrawal paying gas in ETH.ARBI)
            // The actual withdrawal amount should be reduced by gas fee
            // because the gateway will use part of the tokens for gas
            withdrawalAmount = amount - gasFee;
            approvalAmount = amount; // Full amount including gas fee

            require(
                IERC20(asset).balanceOf(address(this)) >= approvalAmount,
                "Insufficient contract balance for withdrawal + gas"
            );

            IERC20(asset).approve(address(gateway), approvalAmount);
        } else {
            // Asset and gas token are different (e.g., USDC.ARBI withdrawal paying gas in ETH.ARBI)
            // User must provide gas tokens
            require(
                IERC20(asset).balanceOf(address(this)) >= amount,
                "Insufficient contract balance for withdrawal"
            );
            IERC20(asset).approve(address(gateway), amount);

            // Transfer gas fee from user to this contract
            require(
                IERC20(gasZRC20).transferFrom(user, address(this), gasFee),
                "Failed to transfer gas fee from user"
            );

            // Approve gas fee for the gateway
            IERC20(gasZRC20).approve(address(gateway), gasFee);
        }

        // Use gateway.withdraw() for cross-chain withdrawal
        gateway.withdraw(
            abi.encodePacked(recipient),
            withdrawalAmount,
            asset,
            RevertOptions({
                revertAddress: address(this),
                callOnRevert: false, // Simplified - don't handle reverts for now
                abortAddress: address(0),
                revertMessage: abi.encodePacked(""),
                onRevertGasLimit: 0
            })
        );

        emit Withdraw(user, asset, amount);
    }

    /**
     * @notice Get gas fee information for cross-chain withdrawal
     * @param asset The asset to withdraw
     * @return gasToken The address of the gas token
     * @return gasFee The amount of gas fee required
     */
    function getWithdrawGasFee(
        address asset
    ) external view returns (address gasToken, uint256 gasFee) {
        require(assets[asset].isSupported, "Asset not supported");
        return IZRC20(asset).withdrawGasFee();
    }

    /**
     * @notice Handle revert from cross-chain operations
     * @dev Called by gateway when cross-chain transaction reverts
     */
    function onRevert(
        RevertContext calldata revertContext
    ) external onlyGateway {
        // Handle withdrawal revert - restore user balance
        // Note: This is a simplified implementation
        // In production, you'd want to properly decode the revert data
        // and restore the exact user state
        emit Withdraw(address(0), address(0), 0); // Placeholder event
    }

    /**
     * @notice Liquidate an undercollateralized position
     * @dev Caller repays user's debt and receives collateral with 5% bonus
     * @param user The address of the user to liquidate
     * @param collateralAsset The address of the collateral asset to seize
     * @param debtAsset The address of the debt asset to repay
     * @param repayAmount The amount of debt to repay (in token's native decimals)
     */
    function liquidate(
        address user,
        address collateralAsset,
        address debtAsset,
        uint256 repayAmount
    ) external nonReentrant {
        require(
            assets[collateralAsset].isSupported &&
                assets[debtAsset].isSupported,
            "Asset not supported"
        );
        require(repayAmount > 0, "Amount must be greater than 0");
        require(
            userBorrows[user][debtAsset] >= repayAmount,
            "Repay amount exceeds debt"
        );
        require(isLiquidatable(user), "User is not liquidatable");

        // Calculate collateral to seize (with 5% bonus)
        uint256 collateralValue = (repayAmount *
            assets[debtAsset].price *
            105) / (100 * assets[collateralAsset].price);
        require(
            userSupplies[user][collateralAsset] >= collateralValue,
            "Insufficient collateral"
        );

        // Transfer repay amount from liquidator
        IERC20(debtAsset).safeTransferFrom(
            msg.sender,
            address(this),
            repayAmount
        );

        // Update balances
        userBorrows[user][debtAsset] -= repayAmount;
        userSupplies[user][collateralAsset] -= collateralValue;

        // Transfer collateral to liquidator
        IERC20(collateralAsset).safeTransfer(msg.sender, collateralValue);

        emit Liquidate(
            msg.sender,
            user,
            collateralAsset,
            debtAsset,
            repayAmount,
            collateralValue
        );
    }

    /**
     * @notice Calculate the health factor for a user's position
     * @dev Health factor = (collateral value * PRECISION) / debt value. Values below 1.2e18 can be liquidated
     * @param user The address of the user to check
     * @return The health factor with 18 decimals (e.g., 1.5e18 = 150%)
     */
    function getHealthFactor(address user) public view returns (uint256) {
        uint256 totalCollateralValue = getTotalCollateralValue(user);
        uint256 totalDebtValue = getTotalDebtValue(user);

        if (totalDebtValue == 0) {
            return type(uint256).max;
        }

        return (totalCollateralValue * PRECISION) / totalDebtValue;
    }

    /**
     * @notice Get the total USD value of a user's collateral
     * @dev Sums the value of all supplied assets for the user
     * @param user The address of the user to check
     * @return The total collateral value in USD (18 decimals)
     */
    function getTotalCollateralValue(
        address user
    ) public view returns (uint256) {
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

    /**
     * @notice Get the total USD value of a user's debt
     * @dev Sums the value of all borrowed assets for the user
     * @param user The address of the user to check
     * @return The total debt value in USD (18 decimals)
     */
    function getTotalDebtValue(address user) public view returns (uint256) {
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

    /**
     * @notice Get the USD value of a user's collateral for a specific asset
     * @dev Normalizes token decimals and multiplies by asset price
     * @param user The address of the user to check
     * @param asset The address of the asset to check
     * @return The collateral value in USD (18 decimals)
     */
    function getCollateralValue(
        address user,
        address asset
    ) public view returns (uint256) {
        uint256 amount = userSupplies[user][asset];
        uint256 price = assets[asset].price;

        // Get token decimals to normalize
        uint256 decimals = IERC20Metadata(asset).decimals();
        uint256 normalizedAmount = amount;

        // Normalize to 18 decimals if needed
        if (decimals < 18) {
            normalizedAmount = amount * (10 ** (18 - decimals));
        } else if (decimals > 18) {
            normalizedAmount = amount / (10 ** (decimals - 18));
        }

        return (normalizedAmount * price) / PRECISION;
    }

    /**
     * @notice Get the USD value of a user's debt for a specific asset
     * @dev Normalizes token decimals and multiplies by asset price
     * @param user The address of the user to check
     * @param asset The address of the asset to check
     * @return The debt value in USD (18 decimals)
     */
    function getDebtValue(
        address user,
        address asset
    ) public view returns (uint256) {
        uint256 amount = userBorrows[user][asset];
        uint256 price = assets[asset].price;

        // Get token decimals to normalize
        uint256 decimals = IERC20Metadata(asset).decimals();
        uint256 normalizedAmount = amount;

        // Normalize to 18 decimals if needed
        if (decimals < 18) {
            normalizedAmount = amount * (10 ** (18 - decimals));
        } else if (decimals > 18) {
            normalizedAmount = amount / (10 ** (decimals - 18));
        }

        return (normalizedAmount * price) / PRECISION;
    }

    /**
     * @notice Check if a user can borrow a specific amount of an asset
     * @dev Validates that the resulting health factor would be >= 1.5e18 (150%)
     * @param user The address of the user attempting to borrow
     * @param asset The address of the asset to borrow
     * @param amount The amount to borrow (in token's native decimals)
     * @return True if the borrow is allowed, false otherwise
     */
    function canBorrow(
        address user,
        address asset,
        uint256 amount
    ) public view returns (bool) {
        uint256 totalCollateralValue = getTotalCollateralValue(user);

        // Calculate normalized debt value for the new borrow
        uint256 decimals = IERC20Metadata(asset).decimals();
        uint256 normalizedAmount = amount;
        if (decimals < 18) {
            normalizedAmount = amount * (10 ** (18 - decimals));
        } else if (decimals > 18) {
            normalizedAmount = amount / (10 ** (decimals - 18));
        }

        uint256 additionalDebtValue = (normalizedAmount * assets[asset].price) /
            PRECISION;
        uint256 totalDebtValue = getTotalDebtValue(user) + additionalDebtValue;

        if (totalDebtValue == 0) return totalCollateralValue > 0;

        uint256 healthFactor = (totalCollateralValue * PRECISION) /
            totalDebtValue;
        return healthFactor >= MINIMUM_HEALTH_FACTOR;
    }

    /**
     * @notice Check if a user can withdraw a specific amount of collateral
     * @dev Validates that the resulting health factor would be >= 1.5e18 (150%)
     * @param user The address of the user attempting to withdraw
     * @param asset The address of the asset to withdraw
     * @param amount The amount to withdraw (in token's native decimals)
     * @return True if the withdrawal is allowed, false otherwise
     */
    function canWithdraw(
        address user,
        address asset,
        uint256 amount
    ) public view returns (bool) {
        // Calculate normalized collateral value for the withdrawal
        uint256 decimals = IERC20Metadata(asset).decimals();
        uint256 normalizedAmount = amount;
        if (decimals < 18) {
            normalizedAmount = amount * (10 ** (18 - decimals));
        } else if (decimals > 18) {
            normalizedAmount = amount / (10 ** (decimals - 18));
        }

        uint256 collateralToRemove = (normalizedAmount * assets[asset].price) /
            PRECISION;
        uint256 newCollateralValue = getTotalCollateralValue(user) -
            collateralToRemove;
        uint256 totalDebtValue = getTotalDebtValue(user);

        if (totalDebtValue == 0) return true;

        uint256 healthFactor = (newCollateralValue * PRECISION) /
            totalDebtValue;
        return healthFactor >= MINIMUM_HEALTH_FACTOR;
    }

    /**
     * @notice Check if a user's position can be liquidated
     * @dev Position is liquidatable if health factor < 1.2e18 (120%) and user has debt
     * @param user The address of the user to check
     * @return True if the position can be liquidated, false otherwise
     */
    function isLiquidatable(address user) public view returns (bool) {
        uint256 healthFactor = getHealthFactor(user);
        return
            healthFactor < LIQUIDATION_THRESHOLD &&
            healthFactor != type(uint256).max;
    }

    /**
     * @notice Get the total number of supported assets
     * @return The count of supported assets
     */
    function getSupportedAssetsCount() external view returns (uint256) {
        return supportedAssets.length;
    }

    /**
     * @notice Get the address of a supported asset by index
     * @param index The index of the asset in the supported assets array
     * @return The address of the asset at the given index
     */
    function getSupportedAsset(uint256 index) external view returns (address) {
        require(index < supportedAssets.length, "Index out of bounds");
        return supportedAssets[index];
    }

    function getSupplyBalance(
        address user,
        address asset
    ) external view returns (uint256) {
        return userSupplies[user][asset];
    }

    function getBorrowBalance(
        address user,
        address asset
    ) external view returns (uint256) {
        return userBorrows[user][asset];
    }

    function getAssetConfig(
        address asset
    ) external view returns (Asset memory) {
        return assets[asset];
    }

    function getUserAccountData(
        address user
    )
        public
        view
        returns (
            uint256 totalCollateralValue,
            uint256 totalDebtValue,
            uint256 availableBorrows,
            uint256 currentLiquidationThreshold,
            uint256 healthFactor
        )
    {
        totalCollateralValue = getTotalCollateralValue(user);
        totalDebtValue = getTotalDebtValue(user);
        healthFactor = getHealthFactor(user);
        currentLiquidationThreshold = LIQUIDATION_THRESHOLD;

        if (totalCollateralValue > 0) {
            uint256 requiredCollateral = (totalDebtValue *
                MINIMUM_HEALTH_FACTOR) / PRECISION;
            if (totalCollateralValue > requiredCollateral) {
                availableBorrows = totalCollateralValue - requiredCollateral;
            } else {
                availableBorrows = 0;
            }
        } else {
            availableBorrows = 0;
        }
    }
}
