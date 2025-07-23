// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test, console} from "forge-std/Test.sol";
import {DepositContract} from "../contracts/DepositContract.sol";
import {MockZRC20} from "../contracts/mocks/MockZRC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IGatewayEVM, RevertOptions} from "@zetachain/protocol-contracts/contracts/evm/interfaces/IGatewayEVM.sol";

contract MockGatewayEVM {
    event DepositAndCallCalled(
        address destination,
        uint256 amount,
        address asset,
        bytes message
    );
    
    event CallCalled(
        address destination,
        bytes message
    );
    
    function depositAndCall(
        address destination,
        uint256 amount,
        address asset,
        bytes calldata message,
        RevertOptions calldata /*revertOptions*/
    ) external {
        emit DepositAndCallCalled(destination, amount, asset, message);
    }
    
    function depositAndCall(
        address destination,
        bytes calldata message,
        RevertOptions calldata /*revertOptions*/
    ) external payable {
        emit DepositAndCallCalled(destination, msg.value, address(0), message);
    }
    
    function call(
        address destination,
        bytes calldata message,
        RevertOptions calldata /*revertOptions*/
    ) external {
        emit CallCalled(destination, message);
    }
}

contract DepositContractTest is Test {
    DepositContract public depositContract;
    MockGatewayEVM public mockGateway;
    MockZRC20 public ethToken;
    MockZRC20 public usdcToken;
    
    address public owner = address(0x1);
    address public user1 = address(0x2);
    address public user2 = address(0x3);
    address public lendingProtocol = address(0x4);
    
    uint256 public constant ZETA_CHAIN_ID = 7001;
    uint256 public constant INITIAL_BALANCE = 1000000 * 10 ** 18;
    
    event AssetAdded(address indexed asset, uint8 decimals, bool isNative);
    event AssetRemoved(address indexed asset);
    event DepositInitiated(
        address indexed user,
        address indexed asset,
        uint256 amount,
        address indexed onBehalfOf
    );
    event BorrowCrossChainInitiated(
        address indexed user,
        address indexed asset,
        uint256 amount,
        uint256 indexed destinationChain,
        address recipient
    );
    event WithdrawCrossChainInitiated(
        address indexed user,
        address indexed asset,
        uint256 amount,
        uint256 indexed destinationChain,
        address recipient
    );
    
    error UnsupportedAsset(address asset);
    error InvalidAmount();
    error InvalidAddress();
    error DepositFailed();
    
    function setUp() public {
        vm.startPrank(owner);
        
        // Deploy mock gateway
        mockGateway = new MockGatewayEVM();
        
        // Deploy deposit contract
        depositContract = new DepositContract(
            address(mockGateway),
            lendingProtocol,
            ZETA_CHAIN_ID,
            owner
        );
        
        // Deploy mock tokens
        ethToken = new MockZRC20("Ethereum", "ETH", 18, INITIAL_BALANCE);
        usdcToken = new MockZRC20("USD Coin", "USDC", 6, INITIAL_BALANCE);
        
        // Add assets to deposit contract
        depositContract.addSupportedAsset(address(0), 18, true); // ETH
        depositContract.addSupportedAsset(address(ethToken), 18, false); // ERC20 ETH
        depositContract.addSupportedAsset(address(usdcToken), 6, false); // USDC
        
        vm.stopPrank();
        
        // Setup user balances
        _setupUserBalances();
    }
    
    function _setupUserBalances() internal {
        vm.startPrank(owner);
        
        // Give users some tokens
        ethToken.transfer(user1, 10 * 10 ** 18); // 10 ETH
        ethToken.transfer(user2, 5 * 10 ** 18); // 5 ETH
        
        usdcToken.transfer(user1, 50000 * 10 ** 6); // 50,000 USDC
        usdcToken.transfer(user2, 10000 * 10 ** 6); // 10,000 USDC
        
        // Give users some ETH
        vm.deal(user1, 10 * 10 ** 18);
        vm.deal(user2, 5 * 10 ** 18);
        
        vm.stopPrank();
    }
    
    // ============ Deployment and Initialization Tests ============
    
    function testDeployment() public view {
        assertEq(address(depositContract.gateway()), address(mockGateway));
        assertEq(depositContract.lendingProtocolAddress(), lendingProtocol);
        assertEq(depositContract.zetaChainId(), ZETA_CHAIN_ID);
        assertEq(depositContract.owner(), owner);
    }
    
    // ============ Asset Management Tests ============
    
    function testAddSupportedAsset() public {
        address newAsset = address(0x999);
        
        vm.prank(owner);
        vm.expectEmit(true, false, false, true);
        emit AssetAdded(newAsset, 18, false);
        
        depositContract.addSupportedAsset(newAsset, 18, false);
        
        assertTrue(depositContract.isAssetSupported(newAsset));
        
        DepositContract.SupportedAsset memory assetInfo = depositContract.getAssetInfo(newAsset);
        assertTrue(assetInfo.isSupported);
        assertEq(assetInfo.decimals, 18);
        assertFalse(assetInfo.isNative);
    }
    
    function testRemoveSupportedAsset() public {
        vm.prank(owner);
        vm.expectEmit(true, false, false, true);
        emit AssetRemoved(address(usdcToken));
        
        depositContract.removeSupportedAsset(address(usdcToken));
        
        assertFalse(depositContract.isAssetSupported(address(usdcToken)));
    }
    
    function testOnlyOwnerCanAddAsset() public {
        vm.prank(user1);
        vm.expectRevert();
        depositContract.addSupportedAsset(address(0x999), 18, false);
    }
    
    function testOnlyOwnerCanRemoveAsset() public {
        vm.prank(user1);
        vm.expectRevert();
        depositContract.removeSupportedAsset(address(usdcToken));
    }
    
    function testCannotAddDuplicateAsset() public {
        vm.prank(owner);
        vm.expectRevert("Asset already supported");
        depositContract.addSupportedAsset(address(0), 18, true);
    }
    
    function testGetSupportedAssets() public view {
        address[] memory assets = depositContract.getSupportedAssets();
        assertEq(assets.length, 3);
        assertEq(assets[0], address(0));
        assertEq(assets[1], address(ethToken));
        assertEq(assets[2], address(usdcToken));
    }
    
    // ============ ETH Deposit Tests ============
    
    function testDepositEth() public {
        uint256 depositAmount = 1 * 10 ** 18; // 1 ETH
        address onBehalfOf = address(0x123);
        
        vm.prank(user1);
        vm.expectEmit(true, true, true, true);
        emit DepositInitiated(user1, address(0), depositAmount, onBehalfOf);
        
        depositContract.depositEth{value: depositAmount}(onBehalfOf);
    }
    
    function testDepositEthZeroAmount() public {
        vm.prank(user1);
        vm.expectRevert(InvalidAmount.selector);
        depositContract.depositEth{value: 0}(user2);
    }
    
    function testDepositEthInvalidRecipient() public {
        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSelector(InvalidAddress.selector));
        depositContract.depositEth{value: 1 * 10 ** 18}(address(0));
    }
    
    function testDepositEthUnsupportedAsset() public {
        // Remove ETH support
        vm.prank(owner);
        depositContract.removeSupportedAsset(address(0));
        
        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSelector(UnsupportedAsset.selector, address(0)));
        depositContract.depositEth{value: 1 * 10 ** 18}(user2);
    }
    
    // ============ Token Deposit Tests ============
    
    function testDepositToken() public {
        uint256 depositAmount = 1000 * 10 ** 6; // 1000 USDC
        address onBehalfOf = address(0x123);
        
        vm.startPrank(user1);
        usdcToken.approve(address(depositContract), depositAmount);
        
        vm.expectEmit(true, true, true, true);
        emit DepositInitiated(user1, address(usdcToken), depositAmount, onBehalfOf);
        
        depositContract.depositToken(address(usdcToken), depositAmount, onBehalfOf);
        vm.stopPrank();
    }
    
    function testDepositTokenZeroAmount() public {
        vm.prank(user1);
        vm.expectRevert(InvalidAmount.selector);
        depositContract.depositToken(address(usdcToken), 0, user2);
    }
    
    function testDepositTokenInvalidRecipient() public {
        vm.prank(user1);
        vm.expectRevert(InvalidAddress.selector);
        depositContract.depositToken(address(usdcToken), 1000, address(0));
    }
    
    function testDepositTokenInvalidAsset() public {
        vm.prank(user1);
        vm.expectRevert(InvalidAddress.selector);
        depositContract.depositToken(address(0), 1000, user2);
    }
    
    function testDepositTokenUnsupportedAsset() public {
        address unsupportedAsset = address(0x999);
        
        vm.startPrank(user1);
        vm.expectRevert(abi.encodeWithSelector(UnsupportedAsset.selector, unsupportedAsset));
        depositContract.depositToken(unsupportedAsset, 1000, user2);
        vm.stopPrank();
    }
    
    function testDepositTokenNativeAsset() public {
        vm.startPrank(user1);
        vm.expectRevert(abi.encodeWithSelector(InvalidAddress.selector));
        depositContract.depositToken(address(0), 1000, user2);
        vm.stopPrank();
    }
    
    // ============ Repay Tests ============
    
    function testRepayToken() public {
        uint256 repayAmount = 1000 * 10 ** 6; // 1000 USDC
        address onBehalfOf = address(0x123);
        
        vm.startPrank(user1);
        usdcToken.approve(address(depositContract), repayAmount);
        
        vm.expectEmit(true, true, true, true);
        emit DepositInitiated(user1, address(usdcToken), repayAmount, onBehalfOf);
        
        depositContract.repayToken(address(usdcToken), repayAmount, onBehalfOf);
        vm.stopPrank();
    }
    
    function testRepayEth() public {
        uint256 repayAmount = 1 * 10 ** 18; // 1 ETH
        address onBehalfOf = address(0x123);
        
        vm.prank(user1);
        vm.expectEmit(true, true, true, true);
        emit DepositInitiated(user1, address(0), repayAmount, onBehalfOf);
        
        depositContract.repayEth{value: repayAmount}(onBehalfOf);
    }
    
    // ============ Cross-Chain Tests ============
    
    function testBorrowCrossChain() public {
        uint256 borrowAmount = 1000 * 10 ** 6; // 1000 USDC
        uint256 destinationChain = 42161; // Arbitrum
        address recipient = address(0x123);
        
        vm.prank(user1);
        vm.expectEmit(true, true, true, true);
        emit BorrowCrossChainInitiated(user1, address(usdcToken), borrowAmount, destinationChain, recipient);
        
        depositContract.borrowCrossChain{value: 0}(address(usdcToken), borrowAmount, destinationChain, recipient);
    }
    
    function testWithdrawCrossChain() public {
        uint256 withdrawAmount = 1 * 10 ** 18; // 1 ETH
        uint256 destinationChain = 1; // Ethereum
        address recipient = address(0x123);
        
        vm.prank(user1);
        vm.expectEmit(true, true, true, true);
        emit WithdrawCrossChainInitiated(user1, address(ethToken), withdrawAmount, destinationChain, recipient);
        
        depositContract.withdrawCrossChain{value: 0}(address(ethToken), withdrawAmount, destinationChain, recipient);
    }
    
    // ============ Fallback Tests ============
    
    function testFallbackFunctionReverts() public {
        vm.prank(user1);
        (bool success, bytes memory data) = address(depositContract).call(abi.encodeWithSignature("nonExistentFunction()"));
        
        // Check that the call was unsuccessful (reverted)
        assertFalse(success);
        
        // Check that we got the expected revert message
        // "Function not found" in bytes
        bytes memory expected = abi.encodeWithSignature("Error(string)", "Function not found");
        assertEq(data, expected);
    }
    
    function testReceiveFunctionReverts() public {
        vm.prank(user1);
        (bool success, bytes memory data) = address(depositContract).call{value: 1 ether}("");
        
        // Check that the call was unsuccessful (reverted)
        assertFalse(success);
        
        // Check that we got the expected revert message
        // "Use depositEth function" in bytes
        bytes memory expected = abi.encodeWithSignature("Error(string)", "Use depositEth function");
        assertEq(data, expected);
    }
}