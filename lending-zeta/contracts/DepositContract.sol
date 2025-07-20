// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@zetachain/protocol-contracts/contracts/evm/interfaces/IGatewayEVM.sol";
import "@zetachain/protocol-contracts/contracts/Revert.sol";

/**
 * @title DepositContract
 * @dev Cross-chain deposit contract for ZetaChain lending protocol
 * @notice This contract enables users on external EVM chains (Arbitrum, Ethereum) to deposit
 *         assets that will be forwarded to the lending protocol on ZetaChain via the Gateway
 */
contract DepositContract is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    struct SupportedAsset {
        bool isSupported;
        uint8 decimals;
        bool isNative; // true for ETH, false for ERC20
    }

    IGatewayEVM public immutable gateway;
    address public immutable lendingProtocolAddress;
    uint256 public immutable zetaChainId;

    mapping(address => SupportedAsset) public supportedAssets;
    address[] public assetsList;

    uint256 private constant GAS_LIMIT = 2000000;

    event AssetAdded(address indexed asset, uint8 decimals, bool isNative);
    event AssetRemoved(address indexed asset);
    event DepositInitiated(
        address indexed user,
        address indexed asset,
        uint256 amount,
        address indexed onBehalfOf
    );

    error UnsupportedAsset(address asset);
    error InvalidAmount();
    error InvalidAddress();
    error DepositFailed();

    /**
     * @dev Initializes the deposit contract with gateway and lending protocol addresses
     * @param _gateway The address of the ZetaChain EVM Gateway on this chain
     * @param _lendingProtocolAddress The address of the lending protocol contract on ZetaChain
     * @param _zetaChainId The chain ID of ZetaChain network (7000 for mainnet, 7001 for testnet)
     * @param _owner The address that will own this contract and have admin privileges
     */
    constructor(
        address _gateway,
        address _lendingProtocolAddress,
        uint256 _zetaChainId,
        address _owner
    ) Ownable(_owner) {
        require(_gateway != address(0), "Invalid gateway address");
        require(
            _lendingProtocolAddress != address(0),
            "Invalid lending protocol address"
        );
        require(_zetaChainId > 0, "Invalid chain ID");

        gateway = IGatewayEVM(_gateway);
        lendingProtocolAddress = _lendingProtocolAddress;
        zetaChainId = _zetaChainId;
    }

    /**
     * @notice Add a new asset that can be deposited through this contract
     * @dev Only owner can add supported assets. Each asset needs to be configured with its properties
     * @param asset The address of the asset token (use address(0) for native ETH)
     * @param decimals The number of decimals the token uses (18 for ETH, 6 for USDC, etc.)
     * @param isNative True if this is the native chain token (ETH), false for ERC20 tokens
     */
    function addSupportedAsset(
        address asset,
        uint8 decimals,
        bool isNative
    ) external onlyOwner {
        require(!supportedAssets[asset].isSupported, "Asset already supported");

        supportedAssets[asset] = SupportedAsset({
            isSupported: true,
            decimals: decimals,
            isNative: isNative
        });

        assetsList.push(asset);

        emit AssetAdded(asset, decimals, isNative);
    }

    /**
     * @notice Remove an asset from the supported assets list
     * @dev Only owner can remove assets. This prevents new deposits but doesn't affect existing ones
     * @param asset The address of the asset token to remove from supported list
     */
    function removeSupportedAsset(address asset) external onlyOwner {
        require(supportedAssets[asset].isSupported, "Asset not supported");

        supportedAssets[asset].isSupported = false;

        for (uint256 i = 0; i < assetsList.length; i++) {
            if (assetsList[i] == asset) {
                assetsList[i] = assetsList[assetsList.length - 1];
                assetsList.pop();
                break;
            }
        }

        emit AssetRemoved(asset);
    }

    /**
     * @notice Deposit native ETH to the lending protocol on ZetaChain
     * @dev ETH is sent via Gateway to ZetaChain where it becomes ZRC-20 ETH collateral
     * @param onBehalfOf The address on ZetaChain that will receive the deposited ETH as collateral
     */
    function depositEth(address onBehalfOf) external payable nonReentrant {
        if (msg.value == 0) revert InvalidAmount();
        if (onBehalfOf == address(0)) revert InvalidAddress();

        address ethAsset = address(0); // ETH represented as address(0)
        if (!supportedAssets[ethAsset].isSupported)
            revert UnsupportedAsset(ethAsset);

        // Encode message for SimpleLendingProtocol.onCall()
        // Format: (string action, address onBehalfOf) where action = "supply"
        bytes memory message = abi.encode("supply", onBehalfOf);

        try
            gateway.depositAndCall{value: msg.value}(
                lendingProtocolAddress,
                message,
                RevertOptions({
                    revertAddress: msg.sender,
                    callOnRevert: true,
                    abortAddress: msg.sender,
                    revertMessage: abi.encode("ETH deposit failed"),
                    onRevertGasLimit: GAS_LIMIT
                })
            )
        {
            emit DepositInitiated(msg.sender, ethAsset, msg.value, onBehalfOf);
        } catch {
            revert DepositFailed();
        }
    }

    /**
     * @notice Deposit ERC20 tokens to the lending protocol on ZetaChain
     * @dev Tokens are transferred from sender, approved to gateway, then sent to ZetaChain
     * @param asset The address of the ERC20 token to deposit (e.g., USDC address)
     * @param amount The amount of tokens to deposit (in token's native decimals)
     * @param onBehalfOf The address on ZetaChain that will receive the deposited tokens as collateral
     */
    function depositToken(
        address asset,
        uint256 amount,
        address onBehalfOf
    ) external nonReentrant {
        if (amount == 0) revert InvalidAmount();
        if (onBehalfOf == address(0)) revert InvalidAddress();
        if (asset == address(0)) revert InvalidAddress();

        SupportedAsset memory assetInfo = supportedAssets[asset];
        if (!assetInfo.isSupported) revert UnsupportedAsset(asset);
        if (assetInfo.isNative) revert UnsupportedAsset(asset); // Use depositEth for native ETH

        IERC20(asset).safeTransferFrom(msg.sender, address(this), amount);
        IERC20(asset).forceApprove(address(gateway), amount);

        // Encode message for SimpleLendingProtocol.onCall()
        // Format: (string action, address onBehalfOf) where action = "supply"
        bytes memory message = abi.encode("supply", onBehalfOf);

        try
            gateway.depositAndCall(
                lendingProtocolAddress,
                amount,
                asset,
                message,
                RevertOptions({
                    revertAddress: msg.sender,
                    callOnRevert: true,
                    abortAddress: msg.sender,
                    revertMessage: abi.encode("Token deposit failed"),
                    onRevertGasLimit: GAS_LIMIT
                })
            )
        {
            emit DepositInitiated(msg.sender, asset, amount, onBehalfOf);
        } catch {
            IERC20(asset).safeTransfer(msg.sender, amount);
            revert DepositFailed();
        }
    }

    /**
     * @notice Repay borrowed ERC20 tokens from external chain to ZetaChain lending protocol
     * @dev Tokens are transferred from sender and sent to ZetaChain to reduce debt
     * @param asset The address of the ERC20 token to repay (e.g., USDC address)
     * @param amount The amount of tokens to repay (in token's native decimals)
     * @param onBehalfOf The address on ZetaChain whose debt will be reduced by this repayment
     */
    function repayToken(
        address asset,
        uint256 amount,
        address onBehalfOf
    ) external nonReentrant {
        if (amount == 0) revert InvalidAmount();
        if (onBehalfOf == address(0)) revert InvalidAddress();
        if (asset == address(0)) revert InvalidAddress();

        SupportedAsset memory assetInfo = supportedAssets[asset];
        if (!assetInfo.isSupported) revert UnsupportedAsset(asset);
        if (assetInfo.isNative) revert UnsupportedAsset(asset); // Use repayEth for native ETH

        IERC20(asset).safeTransferFrom(msg.sender, address(this), amount);
        IERC20(asset).forceApprove(address(gateway), amount);

        // Encode message for SimpleLendingProtocol.onCall()
        // Format: (string action, address onBehalfOf) where action = "repay"
        bytes memory message = abi.encode("repay", onBehalfOf);

        try
            gateway.depositAndCall(
                lendingProtocolAddress,
                amount,
                asset,
                message,
                RevertOptions({
                    revertAddress: msg.sender,
                    callOnRevert: true,
                    abortAddress: msg.sender,
                    revertMessage: abi.encode("Token repay failed"),
                    onRevertGasLimit: GAS_LIMIT
                })
            )
        {
            emit DepositInitiated(msg.sender, asset, amount, onBehalfOf);
        } catch {
            IERC20(asset).safeTransfer(msg.sender, amount);
            revert DepositFailed();
        }
    }

    /**
     * @notice Repay borrowed ETH from external chain to ZetaChain lending protocol
     * @dev ETH is sent via Gateway to ZetaChain to reduce the user's ETH debt
     * @param onBehalfOf The address on ZetaChain whose ETH debt will be reduced by this repayment
     */
    function repayEth(address onBehalfOf) external payable nonReentrant {
        if (msg.value == 0) revert InvalidAmount();
        if (onBehalfOf == address(0)) revert InvalidAddress();

        address ethAsset = address(0); // ETH represented as address(0)
        if (!supportedAssets[ethAsset].isSupported)
            revert UnsupportedAsset(ethAsset);

        // Encode message for SimpleLendingProtocol.onCall()
        // Format: (string action, address onBehalfOf) where action = "repay"
        bytes memory message = abi.encode("repay", onBehalfOf);

        try
            gateway.depositAndCall{value: msg.value}(
                lendingProtocolAddress,
                message,
                RevertOptions({
                    revertAddress: msg.sender,
                    callOnRevert: true,
                    abortAddress: msg.sender,
                    revertMessage: abi.encode("ETH repay failed"),
                    onRevertGasLimit: GAS_LIMIT
                })
            )
        {
            emit DepositInitiated(msg.sender, ethAsset, msg.value, onBehalfOf);
        } catch {
            revert DepositFailed();
        }
    }

    /**
     * @notice Get the list of all supported asset addresses
     * @return Array of supported asset addresses (address(0) represents ETH)
     */
    function getSupportedAssets() external view returns (address[] memory) {
        return assetsList;
    }

    /**
     * @notice Check if a specific asset is supported for deposits
     * @param asset The address of the asset to check (use address(0) for ETH)
     * @return True if the asset is supported, false otherwise
     */
    function isAssetSupported(address asset) external view returns (bool) {
        return supportedAssets[asset].isSupported;
    }

    /**
     * @notice Get detailed information about a supported asset
     * @param asset The address of the asset to query (use address(0) for ETH)
     * @return SupportedAsset struct containing isSupported, decimals, and isNative flags
     */
    function getAssetInfo(
        address asset
    ) external view returns (SupportedAsset memory) {
        return supportedAssets[asset];
    }

    /**
     * @notice Reject direct ETH transfers to prevent accidental loss
     * @dev Users must use depositEth() function to properly deposit ETH
     */
    receive() external payable {
        revert("Use depositEth function");
    }

    /**
     * @notice Reject calls to non-existent functions
     * @dev Prevents accidental calls to undefined functions
     */
    fallback() external payable {
        revert("Function not found");
    }
}
