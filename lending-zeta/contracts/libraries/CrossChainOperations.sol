// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import "@zetachain/protocol-contracts/contracts/zevm/interfaces/IZRC20.sol";
import "@zetachain/protocol-contracts/contracts/zevm/interfaces/IGatewayZEVM.sol";
import "@zetachain/protocol-contracts/contracts/Revert.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "./CoreCalculations.sol";
import "./HealthFactorLogic.sol";
import "../interfaces/IUniversalLendingProtocol.sol";

/**
 * @title CrossChainOperations
 * @author ZetaChain Cross-Chain Lending Protocol
 * @notice Library for handling cross-chain lending operations via ZetaChain Gateway
 * @dev Consolidates cross-chain borrow and withdraw logic to eliminate code duplication
 *      Handles gas fee calculations, gateway interactions, and revert scenarios
 *      All operations validate health factors and maintain protocol safety
 */
library CrossChainOperations {
    using SafeERC20 for IERC20;
    using CoreCalculations for uint256;
    using HealthFactorLogic for *;

    /// @dev Precision constant for percentage calculations (1e18 = 100%)
    uint256 private constant PRECISION = 1e18;

    /// @dev Default gas limit for revert operations
    uint256 private constant DEFAULT_REVERT_GAS_LIMIT = 300000;

    /// @dev Minimum amount threshold to prevent dust transactions
    uint256 private constant MIN_CROSS_CHAIN_AMOUNT = 1e6; // $0.001 USD equivalent

    /**
     * @notice Cross-chain operation parameters
     * @dev Contains all necessary data for cross-chain operations
     * @param asset ZRC-20 asset address
     * @param amount Operation amount (in asset's native decimals)
     * @param user User performing the operation
     * @param destinationChain Target blockchain chain ID
     * @param recipient Recipient address on destination chain
     * @param gasZRC20 Gas token address for the operation
     * @param gasFee Gas fee amount (in gas token decimals)
     * @param withdrawalAmount Net amount after gas fees
     * @param approvalAmount Total amount to approve to gateway
     */
    struct CrossChainParams {
        address asset;
        uint256 amount;
        address user;
        uint256 destinationChain;
        bytes recipient;
        address gasZRC20;
        uint256 gasFee;
        uint256 withdrawalAmount;
        uint256 approvalAmount;
    }

    /**
     * @notice Handles cross-chain borrow operations called from gateway
     * @dev Validates borrowing capacity, handles gas fees, and executes gateway withdrawal
     *      This function is called when cross-chain borrow is initiated via gateway
     * @param asset ZRC-20 asset address to borrow
     * @param amount Amount to borrow (in asset's native decimals)
     * @param user User requesting the borrow
     * @param destinationChain Target chain for asset withdrawal
     * @param recipient Encoded recipient address on destination chain
     * @param gateway Gateway contract for cross-chain operations
     * @param supportedAssets Array of all supported asset addresses
     * @param userSupplies Mapping of user supplies from main contract
     * @param userBorrows Mapping of user borrows from main contract
     * @param enhancedAssets Mapping of asset configurations from main contract
     * @param priceOracle Price oracle contract for asset pricing
     */
    function handleCrossChainBorrow(
        address asset,
        uint256 amount,
        address user,
        uint256 destinationChain,
        bytes memory recipient,
        IGatewayZEVM gateway,
        address[] storage supportedAssets,
        mapping(address => mapping(address => uint256)) storage userSupplies,
        mapping(address => mapping(address => uint256)) storage userBorrows,
        mapping(address => IUniversalLendingProtocol.AssetConfig) storage enhancedAssets,
        IPriceOracle priceOracle
    ) internal {
        // Validate asset and amount
        require(enhancedAssets[asset].isSupported, "CrossChainOperations: asset not supported");
        require(amount > 0, "CrossChainOperations: invalid amount");
        
        // Check contract balance
        uint256 contractBalance = IERC20(asset).balanceOf(address(this));
        require(contractBalance >= amount, "CrossChainOperations: insufficient contract balance");

        // Validate borrowing capacity
        bool canBorrow = HealthFactorLogic.canBorrow(
            user,
            asset,
            amount,
            contractBalance,
            supportedAssets,
            userSupplies,
            userBorrows,
            enhancedAssets,
            priceOracle
        );
        require(canBorrow, "CrossChainOperations: insufficient collateral for borrow");

        // Validate amount vs gas fee
        validateAmountVsGasFee(asset, amount);

        // Update user borrow balance
        userBorrows[user][asset] += amount;

        // Prepare cross-chain parameters
        CrossChainParams memory params = _prepareCrossChainParams(
            asset,
            amount,
            user,
            destinationChain,
            recipient
        );

        // Execute cross-chain withdrawal
        _executeCrossChainWithdrawal(params, gateway, user, destinationChain);

        // Emit borrow event (assuming event is defined in main contract)
        // emit Borrow(user, asset, amount);
    }

    /**
     * @notice Handles cross-chain withdraw operations called from gateway
     * @dev Validates withdrawal capacity, handles gas fees, and executes gateway withdrawal
     *      This function is called when cross-chain withdraw is initiated via gateway
     * @param asset ZRC-20 asset address to withdraw
     * @param amount Amount to withdraw (in asset's native decimals)
     * @param user User requesting the withdrawal
     * @param destinationChain Target chain for asset withdrawal
     * @param recipient Encoded recipient address on destination chain
     * @param gateway Gateway contract for cross-chain operations
     * @param supportedAssets Array of all supported asset addresses
     * @param userSupplies Mapping of user supplies from main contract
     * @param userBorrows Mapping of user borrows from main contract
     * @param enhancedAssets Mapping of asset configurations from main contract
     * @param priceOracle Price oracle contract for asset pricing
     */
    function handleCrossChainWithdraw(
        address asset,
        uint256 amount,
        address user,
        uint256 destinationChain,
        bytes memory recipient,
        IGatewayZEVM gateway,
        address[] storage supportedAssets,
        mapping(address => mapping(address => uint256)) storage userSupplies,
        mapping(address => mapping(address => uint256)) storage userBorrows,
        mapping(address => IUniversalLendingProtocol.AssetConfig) storage enhancedAssets,
        IPriceOracle priceOracle
    ) internal {
        // Validate asset and amount
        require(enhancedAssets[asset].isSupported, "CrossChainOperations: asset not supported");
        require(amount > 0, "CrossChainOperations: invalid amount");
        require(userSupplies[user][asset] >= amount, "CrossChainOperations: insufficient user balance");

        // Check contract balance
        uint256 contractBalance = IERC20(asset).balanceOf(address(this));
        require(contractBalance >= amount, "CrossChainOperations: insufficient contract balance");

        // Validate withdrawal capacity
        bool canWithdraw = HealthFactorLogic.canWithdraw(
            user,
            asset,
            amount,
            contractBalance,
            supportedAssets,
            userSupplies,
            userBorrows,
            enhancedAssets,
            priceOracle
        );
        require(canWithdraw, "CrossChainOperations: insufficient collateral for withdraw");

        // Validate amount vs gas fee
        validateAmountVsGasFee(asset, amount);

        // Update user supply balance
        userSupplies[user][asset] -= amount;

        // Prepare cross-chain parameters
        CrossChainParams memory params = _prepareCrossChainParams(
            asset,
            amount,
            user,
            destinationChain,
            recipient
        );

        // Execute cross-chain withdrawal
        _executeCrossChainWithdrawal(params, gateway, user, destinationChain);

        // Emit withdraw event (assuming event is defined in main contract)
        // emit Withdraw(user, asset, amount);
    }

    /**
     * @notice Validates that withdrawal amount is greater than gas fee
     * @dev Prevents operations where gas fees exceed the operation amount
     *      Handles different decimal places between asset and gas token
     * @param asset The asset being withdrawn/borrowed
     * @param amount The operation amount (in asset's native decimals)
     */
    function validateAmountVsGasFee(
        address asset,
        uint256 amount
    ) internal view {
        (address gasZRC20, uint256 gasFee) = IZRC20(asset).withdrawGasFee();

        // If asset is the gas token, directly compare
        if (asset == gasZRC20) {
            require(amount > gasFee, "CrossChainOperations: amount must exceed gas fee");
            return;
        }

        // For different tokens, compare normalized values
        uint8 assetDecimals = CoreCalculations.getAssetDecimals(asset);
        uint8 gasDecimals = CoreCalculations.getAssetDecimals(gasZRC20);

        uint256 normalizedAmount = CoreCalculations.normalizeToDecimals(amount, assetDecimals);
        uint256 normalizedGasFee = CoreCalculations.normalizeToDecimals(gasFee, gasDecimals);

        require(normalizedAmount > normalizedGasFee, "CrossChainOperations: amount must exceed gas fee value");
    }

    /**
     * @notice Calculates gas fees and withdrawal amounts for cross-chain operations
     * @dev Handles both same-token and different-token gas fee scenarios
     * @param asset The asset being operated on
     * @param amount The operation amount
     * @return gasZRC20 The gas token address
     * @return gasFee The gas fee amount
     * @return withdrawalAmount The net withdrawal amount after fees
     * @return approvalAmount The total amount to approve to gateway
     */
    function calculateGasFees(
        address asset,
        uint256 amount
    ) internal view returns (
        address gasZRC20,
        uint256 gasFee,
        uint256 withdrawalAmount,
        uint256 approvalAmount
    ) {
        (gasZRC20, gasFee) = IZRC20(asset).withdrawGasFee();

        if (asset == gasZRC20) {
            // Same token for operation and gas
            withdrawalAmount = amount - gasFee;
            approvalAmount = amount;
        } else {
            // Different tokens - gas fee paid separately
            withdrawalAmount = amount;
            approvalAmount = amount;
        }
    }

    /**
     * @notice Handles gas token transfers for cross-chain operations
     * @dev Manages gas token transfers when operation asset differs from gas token
     *      SECURITY: Only transfers from msg.sender, never from arbitrary addresses
     * @param params Cross-chain operation parameters
     * @param gateway Gateway contract address
     */
    function handleGasTokenTransfer(
        CrossChainParams memory params,
        address gateway
    ) internal {
        if (params.asset == params.gasZRC20) {
            // Same token - no additional gas token handling needed
            IERC20(params.asset).safeIncreaseAllowance(gateway, params.approvalAmount);
        } else {
            // Different tokens - handle gas token separately
            IERC20(params.asset).safeIncreaseAllowance(gateway, params.amount);
            
            // SECURITY FIX: Only check and transfer from msg.sender, not arbitrary user
            // Check msg.sender's gas token balance
            uint256 userGasBalance = IERC20(params.gasZRC20).balanceOf(msg.sender);
            require(userGasBalance >= params.gasFee, "CrossChainOperations: insufficient gas token balance");

            // Transfer gas tokens from msg.sender to contract - SECURITY: removed arbitrary 'user' parameter
            IERC20(params.gasZRC20).safeTransferFrom(msg.sender, address(this), params.gasFee);

            // Approve gas tokens to gateway
            IERC20(params.gasZRC20).safeIncreaseAllowance(gateway, params.gasFee);
        }
    }

    /**
     * @notice Creates revert options for cross-chain operations
     * @dev Configures revert handling in case of cross-chain operation failures
     * @param user User performing the operation
     * @param destinationChain Target chain ID
     * @return revertOptions Configured revert options
     */
    function createRevertOptions(
        address user,
        uint256 destinationChain
    ) internal pure returns (RevertOptions memory revertOptions) {
        revertOptions = RevertOptions({
            revertAddress: user,
            callOnRevert: true,
            abortAddress: user,
            revertMessage: abi.encode(destinationChain),
            onRevertGasLimit: DEFAULT_REVERT_GAS_LIMIT
        });
    }

    /**
     * @notice Validates cross-chain operation parameters
     * @dev Performs comprehensive validation before executing cross-chain operations
     * @param asset Asset address
     * @param amount Operation amount
     * @param destinationChain Target chain ID
     * @param recipient Recipient address
     */
    function validateCrossChainParams(
        address asset,
        uint256 amount,
        uint256 destinationChain,
        bytes memory recipient
    ) internal pure {
        require(asset != address(0), "CrossChainOperations: invalid asset address");
        require(amount >= MIN_CROSS_CHAIN_AMOUNT, "CrossChainOperations: amount below minimum");
        require(destinationChain != 0, "CrossChainOperations: invalid destination chain");
        require(recipient.length > 0, "CrossChainOperations: empty recipient");
    }

    /**
     * @notice Gets cross-chain operation fee estimate
     * @dev Provides fee estimates for UI and operation planning
     * @param asset Asset to be withdrawn
     * @param amount Operation amount
     * @return gasToken Gas token address
     * @return totalGasFee Total gas fee required
     * @return netAmount Net amount after fees (if same token)
     */
    function getCrossChainFeeEstimate(
        address asset,
        uint256 amount
    ) internal view returns (
        address gasToken,
        uint256 totalGasFee,
        uint256 netAmount
    ) {
        (gasToken, totalGasFee) = IZRC20(asset).withdrawGasFee();
        
        if (asset == gasToken && amount > totalGasFee) {
            netAmount = amount - totalGasFee;
        } else {
            netAmount = amount;
        }
    }

    /**
     * @notice Checks if cross-chain operation is economically viable
     * @dev Validates that operation amount justifies gas costs
     * @param asset Asset to be withdrawn
     * @param amount Operation amount
     * @param minViableRatio Minimum viable ratio (e.g., 0.05e18 = 5%)
     * @return isViable True if operation is economically viable
     */
    function isOperationViable(
        address asset,
        uint256 amount,
        uint256 minViableRatio
    ) internal view returns (bool isViable) {
        (address gasToken, uint256 gasFee) = IZRC20(asset).withdrawGasFee();
        
        if (asset == gasToken) {
            // Direct comparison for same token
            uint256 minAmount = (gasFee * (PRECISION + minViableRatio)) / PRECISION;
            isViable = amount >= minAmount;
        } else {
            // For different tokens, assume operation is viable if above minimum threshold
            // More sophisticated implementation would compare USD values
            isViable = amount >= MIN_CROSS_CHAIN_AMOUNT;
        }
    }

    /**
     * @notice Internal function to prepare cross-chain operation parameters
     * @dev Consolidates parameter preparation logic
     * @param asset Asset address
     * @param amount Operation amount
     * @param user User address
     * @param destinationChain Target chain ID
     * @param recipient Recipient address
     * @return params Prepared cross-chain parameters
     */
    function _prepareCrossChainParams(
        address asset,
        uint256 amount,
        address user,
        uint256 destinationChain,
        bytes memory recipient
    ) private view returns (CrossChainParams memory params) {
        params.asset = asset;
        params.amount = amount;
        params.user = user;
        params.destinationChain = destinationChain;
        params.recipient = recipient;

        (params.gasZRC20, params.gasFee, params.withdrawalAmount, params.approvalAmount) = 
            calculateGasFees(asset, amount);

        // Validate parameters
        validateCrossChainParams(asset, amount, destinationChain, recipient);
    }

    /**
     * @notice Internal function to execute cross-chain withdrawal via gateway
     * @dev Handles the actual gateway interaction and token approvals
     * @param params Cross-chain operation parameters
     * @param gateway Gateway contract for cross-chain operations
     * @param user User performing the operation
     * @param destinationChain Target chain ID
     */
    function _executeCrossChainWithdrawal(
        CrossChainParams memory params,
        IGatewayZEVM gateway,
        address user,
        uint256 destinationChain
    ) private {
        // Handle gas token transfers and approvals
        handleGasTokenTransfer(params, address(gateway));

        // Create revert options
        RevertOptions memory revertOptions = createRevertOptions(user, destinationChain);

        // Execute gateway withdrawal
        gateway.withdraw(
            params.recipient,
            params.withdrawalAmount,
            params.asset,
            revertOptions
        );
    }
}