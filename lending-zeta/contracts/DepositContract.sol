// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@zetachain/protocol-contracts/contracts/evm/interfaces/IGatewayEVM.sol";
import "@zetachain/protocol-contracts/contracts/Revert.sol";

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
    
    uint256 private constant GAS_LIMIT = 1000000;

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

    constructor(
        address _gateway,
        address _lendingProtocolAddress,
        uint256 _zetaChainId,
        address _owner
    ) Ownable(_owner) {
        require(_gateway != address(0), "Invalid gateway address");
        require(_lendingProtocolAddress != address(0), "Invalid lending protocol address");
        require(_zetaChainId > 0, "Invalid chain ID");
        
        gateway = IGatewayEVM(_gateway);
        lendingProtocolAddress = _lendingProtocolAddress;
        zetaChainId = _zetaChainId;
    }

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

    function depositEth(address onBehalfOf) external payable nonReentrant {
        if (msg.value == 0) revert InvalidAmount();
        if (onBehalfOf == address(0)) revert InvalidAddress();
        
        address ethAsset = address(0); // ETH represented as address(0)
        if (!supportedAssets[ethAsset].isSupported) revert UnsupportedAsset(ethAsset);

        bytes memory message = abi.encodeWithSignature(
            "supply(address,uint256,address)",
            ethAsset,
            msg.value,
            onBehalfOf
        );

        try gateway.depositAndCall{value: msg.value}(
            lendingProtocolAddress,
            message,
            RevertOptions({
                revertAddress: msg.sender,
                callOnRevert: true,
                abortAddress: address(0),
                revertMessage: abi.encode("ETH deposit failed"),
                onRevertGasLimit: GAS_LIMIT
            })
        ) {
            emit DepositInitiated(msg.sender, ethAsset, msg.value, onBehalfOf);
        } catch {
            revert DepositFailed();
        }
    }

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

        bytes memory message = abi.encodeWithSignature(
            "supply(address,uint256,address)",
            asset,
            amount,
            onBehalfOf
        );

        try gateway.depositAndCall(
            lendingProtocolAddress,
            amount,
            asset,
            message,
            RevertOptions({
                revertAddress: msg.sender,
                callOnRevert: true,
                abortAddress: address(0),
                revertMessage: abi.encode("Token deposit failed"),
                onRevertGasLimit: GAS_LIMIT
            })
        ) {
            emit DepositInitiated(msg.sender, asset, amount, onBehalfOf);
        } catch {
            IERC20(asset).safeTransfer(msg.sender, amount);
            revert DepositFailed();
        }
    }

    function getSupportedAssets() external view returns (address[] memory) {
        return assetsList;
    }

    function isAssetSupported(address asset) external view returns (bool) {
        return supportedAssets[asset].isSupported;
    }

    function getAssetInfo(address asset) external view returns (SupportedAsset memory) {
        return supportedAssets[asset];
    }

    receive() external payable {
        revert("Use depositEth function");
    }

    fallback() external payable {
        revert("Function not found");
    }
}