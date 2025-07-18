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
import "./interfaces/ILendingProtocol.sol";
import "./interfaces/IPriceOracle.sol";
import "./libraries/InterestRateModel.sol";
import "./libraries/LiquidationLogic.sol";

/**
 * @title UniversalLendingProtocol
 * @dev Cross-chain lending protocol deployed on ZetaChain that handles:
 * - Cross-chain deposits from allowed external chains via gateway
 * - Cross-chain withdrawals to any supported destination chain
 * - Standard lending operations (supply, borrow, repay, liquidate)
 */
contract UniversalLendingProtocol is
    UniversalContract,
    ILendingProtocol,
    ReentrancyGuard,
    Ownable
{
    using SafeERC20 for IERC20;
    using InterestRateModel for *;
    using LiquidationLogic for *;

    uint256 private constant PRECISION = 1e18;
    uint256 private constant MINIMUM_HEALTH_FACTOR = 1.5e18;
    uint256 private constant LIQUIDATION_THRESHOLD = 1.2e18;
    uint256 private constant RESERVE_FACTOR = 0.1e18; // 10%

    IGatewayZEVM public immutable gateway;
    IPriceOracle public priceOracle;

    // Core lending state
    mapping(address => AssetConfig) public assets;
    mapping(address => mapping(address => uint256)) public userSupplies;
    mapping(address => mapping(address => uint256)) public userBorrows;
    mapping(address => mapping(address => uint256)) public lastInterestUpdate;
    mapping(address => uint256) public totalReserves;

    // Cross-chain configuration
    mapping(uint256 => bool) public allowedSourceChains; // chainId => allowed
    mapping(address => uint256) public zrc20ToChainId; // ZRC20 token => origin chain
    mapping(uint256 => mapping(string => address)) public chainAssets; // chainId => symbol => ZRC20

    address[] public supportedAssets;

    // Cross-chain events
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

    event AllowedChainUpdated(uint256 indexed chainId, bool allowed);
    event ZRC20AssetMapped(
        address indexed zrc20,
        uint256 indexed chainId,
        string symbol
    );

    error Unauthorized();
    error ChainNotAllowed(uint256 chainId);
    error InvalidAmount();
    error AssetNotSupported(address asset);
    error InsufficientCollateral();
    error HealthFactorTooLow();
    error WithdrawalFailed();

    modifier onlyGateway() {
        if (msg.sender != address(gateway)) revert Unauthorized();
        _;
    }

    modifier onlySupportedAsset(address asset) {
        if (!assets[asset].isSupported) revert AssetNotSupported(asset);
        _;
    }

    modifier healthFactorCheck(address user) {
        _;
        if (getHealthFactor(user) < MINIMUM_HEALTH_FACTOR)
            revert HealthFactorTooLow();
    }

    constructor(
        address payable _gateway,
        address _priceOracle,
        address _owner
    ) Ownable(_owner) {
        gateway = IGatewayZEVM(_gateway);
        priceOracle = IPriceOracle(_priceOracle);
    }

    /**
     * @dev Handles cross-chain deposits from allowed external chains
     * Called by the gateway when tokens are deposited from external chains
     */
    function onCall(
        MessageContext calldata context,
        address zrc20,
        uint256 amount,
        bytes calldata message
    ) external override onlyGateway {
        // Validate source chain is allowed
        if (!allowedSourceChains[context.chainID]) {
            revert ChainNotAllowed(context.chainID);
        }

        if (amount == 0) revert InvalidAmount();
        if (!assets[zrc20].isSupported) revert AssetNotSupported(zrc20);

        // Decode message to get user address and operation type
        (address user, uint8 operation) = abi.decode(message, (address, uint8));

        // Operation types: 0 = supply, 1 = repay
        if (operation == 0) {
            _handleCrossChainSupply(user, zrc20, amount, context);
        } else if (operation == 1) {
            _handleCrossChainRepay(user, zrc20, amount, context);
        } else {
            revert("Invalid operation");
        }
    }

    /**
     * @dev Handle failed cross-chain transactions
     */
    function onRevert(
        RevertContext calldata revertContext
    ) external onlyGateway {
        // Log the revert for debugging
        // In a production system, you might want to restore user state or provide compensation
        // For now, we'll just emit an event to track failed transactions

        // Decode chain ID from revert message if available
        uint256 destinationChain = 0;
        if (revertContext.revertMessage.length >= 32) {
            // Try to decode as uint256, if it fails, destinationChain remains 0
            (destinationChain) = abi.decode(
                revertContext.revertMessage,
                (uint256)
            );
        }

        emit CrossChainWithdrawal(
            address(0), // Unknown user on revert
            revertContext.asset,
            revertContext.amount,
            destinationChain,
            address(0)
        );
    }

    /**
     * @dev Cross-chain supply from external chain
     */
    function _handleCrossChainSupply(
        address user,
        address zrc20,
        uint256 amount,
        MessageContext calldata context
    ) internal {
        _updateInterest(zrc20);

        userSupplies[user][zrc20] += amount;
        assets[zrc20].totalSupply += amount;
        lastInterestUpdate[user][zrc20] = block.timestamp;

        emit Supply(user, zrc20, amount);
        emit CrossChainDeposit(
            user,
            zrc20,
            amount,
            context.chainID,
            keccak256(context.sender)
        );
    }

    /**
     * @dev Cross-chain repayment from external chain
     */
    function _handleCrossChainRepay(
        address user,
        address zrc20,
        uint256 amount,
        MessageContext calldata context
    ) internal {
        _updateInterest(zrc20);

        uint256 userDebt = userBorrows[user][zrc20];
        uint256 amountToRepay = amount > userDebt ? userDebt : amount;

        userBorrows[user][zrc20] -= amountToRepay;
        assets[zrc20].totalBorrow -= amountToRepay;

        // If overpaid, convert excess to supply
        if (amount > userDebt) {
            uint256 excess = amount - userDebt;
            userSupplies[user][zrc20] += excess;
            assets[zrc20].totalSupply += excess;
        }

        emit Repay(user, zrc20, amountToRepay);
        emit CrossChainDeposit(
            user,
            zrc20,
            amount,
            context.chainID,
            keccak256(context.sender)
        );
    }

    /**
     * @dev Standard supply function for on-chain operations
     */
    function supply(
        address asset,
        uint256 amount,
        address onBehalfOf
    ) external nonReentrant onlySupportedAsset(asset) {
        if (amount == 0) revert InvalidAmount();

        _updateInterest(asset);

        IERC20(asset).safeTransferFrom(msg.sender, address(this), amount);

        userSupplies[onBehalfOf][asset] += amount;
        assets[asset].totalSupply += amount;
        lastInterestUpdate[onBehalfOf][asset] = block.timestamp;

        emit Supply(onBehalfOf, asset, amount);
    }

    /**
     * @dev Borrow assets
     */
    function borrow(
        address asset,
        uint256 amount,
        address to
    )
        external
        nonReentrant
        onlySupportedAsset(asset)
        healthFactorCheck(msg.sender)
    {
        if (amount == 0) revert InvalidAmount();
        if (amount > _getAvailableBorrow(msg.sender, asset))
            revert InsufficientCollateral();

        _updateInterest(asset);

        userBorrows[msg.sender][asset] += amount;
        assets[asset].totalBorrow += amount;
        lastInterestUpdate[msg.sender][asset] = block.timestamp;

        IERC20(asset).safeTransfer(to, amount);

        emit Borrow(msg.sender, asset, amount);
    }

    /**
     * @dev Standard repay function for on-chain operations
     */
    function repay(
        address asset,
        uint256 amount,
        address onBehalfOf
    ) external nonReentrant onlySupportedAsset(asset) {
        if (amount == 0) revert InvalidAmount();

        _updateInterest(asset);

        uint256 userDebt = userBorrows[onBehalfOf][asset];
        uint256 amountToRepay = amount > userDebt ? userDebt : amount;

        IERC20(asset).safeTransferFrom(
            msg.sender,
            address(this),
            amountToRepay
        );

        userBorrows[onBehalfOf][asset] -= amountToRepay;
        assets[asset].totalBorrow -= amountToRepay;

        emit Repay(onBehalfOf, asset, amountToRepay);
    }

    /**
     * @dev Standard withdraw function - transfers to same chain
     */
    function withdraw(
        address asset,
        uint256 amount,
        address to
    )
        external
        nonReentrant
        onlySupportedAsset(asset)
        healthFactorCheck(msg.sender)
    {
        if (amount == 0) revert InvalidAmount();
        if (userSupplies[msg.sender][asset] < amount)
            revert InsufficientCollateral();

        _updateInterest(asset);

        userSupplies[msg.sender][asset] -= amount;
        assets[asset].totalSupply -= amount;

        IERC20(asset).safeTransfer(to, amount);

        emit Withdraw(msg.sender, asset, amount);
    }

    /**
     * @dev Cross-chain withdraw - transfers to external chain
     * @param zrc20 The ZRC-20 token to withdraw
     * @param amount Amount to withdraw
     * @param destinationChain Target chain ID for withdrawal
     * @param recipient Recipient address on destination chain
     */
    function withdrawCrossChain(
        address zrc20,
        uint256 amount,
        uint256 destinationChain,
        address recipient
    )
        external
        nonReentrant
        onlySupportedAsset(zrc20)
        healthFactorCheck(msg.sender)
    {
        if (amount == 0) revert InvalidAmount();
        if (userSupplies[msg.sender][zrc20] < amount)
            revert InsufficientCollateral();

        _updateInterest(zrc20);

        userSupplies[msg.sender][zrc20] -= amount;
        assets[zrc20].totalSupply -= amount;

        // Calculate gas fee for cross-chain withdrawal
        (address gasFeeAddress, uint256 gasFee) = IZRC20(zrc20)
            .withdrawGasFee();
        if (gasFeeAddress != address(0)) {
            revert("Gas fee address is not zero");
        }
        if (amount <= gasFee) revert InvalidAmount();

        uint256 withdrawAmount = amount - gasFee;

        // Approve gateway to spend the ZRC-20 tokens
        IERC20(zrc20).approve(address(gateway), amount);

        // Execute cross-chain withdrawal via gateway
        try
            gateway.withdraw(
                abi.encodePacked(recipient),
                withdrawAmount,
                zrc20,
                RevertOptions({
                    revertAddress: address(this),
                    callOnRevert: true,
                    abortAddress: address(0),
                    revertMessage: abi.encode(destinationChain),
                    onRevertGasLimit: 100000
                })
            )
        {
            emit Withdraw(msg.sender, zrc20, amount);
            emit CrossChainWithdrawal(
                msg.sender,
                zrc20,
                withdrawAmount,
                destinationChain,
                recipient
            );
        } catch {
            // Revert the state changes if withdrawal fails
            userSupplies[msg.sender][zrc20] += amount;
            assets[zrc20].totalSupply += amount;
            revert WithdrawalFailed();
        }
    }

    /**
     * @dev Liquidation function
     */
    function liquidate(
        address collateralAsset,
        address debtAsset,
        address user,
        uint256 debtToCover
    )
        external
        nonReentrant
        onlySupportedAsset(collateralAsset)
        onlySupportedAsset(debtAsset)
    {
        uint256 healthFactor = getHealthFactor(user);
        require(
            healthFactor < LIQUIDATION_THRESHOLD,
            "Health factor above liquidation threshold"
        );

        uint256 userDebt = userBorrows[user][debtAsset];
        require(
            debtToCover <= userDebt,
            "Cannot cover more debt than user has"
        );

        _updateInterest(collateralAsset);
        _updateInterest(debtAsset);

        uint256 debtPrice = priceOracle.getPrice(debtAsset);
        uint256 collateralPrice = priceOracle.getPrice(collateralAsset);

        uint256 liquidatedCollateral = LiquidationLogic
            .calculateLiquidationAmount(
                debtToCover,
                debtPrice,
                collateralPrice,
                assets[collateralAsset].liquidationBonus
            );

        require(
            userSupplies[user][collateralAsset] >= liquidatedCollateral,
            "Insufficient collateral"
        );

        IERC20(debtAsset).safeTransferFrom(
            msg.sender,
            address(this),
            debtToCover
        );

        userBorrows[user][debtAsset] -= debtToCover;
        userSupplies[user][collateralAsset] -= liquidatedCollateral;
        assets[debtAsset].totalBorrow -= debtToCover;

        IERC20(collateralAsset).safeTransfer(msg.sender, liquidatedCollateral);

        emit Liquidate(
            msg.sender,
            user,
            collateralAsset,
            debtAsset,
            debtToCover,
            liquidatedCollateral
        );
    }

    // === ADMIN FUNCTIONS ===

    /**
     * @dev Add or remove allowed source chains for deposits
     */
    function setAllowedSourceChain(
        uint256 chainId,
        bool allowed
    ) external onlyOwner {
        allowedSourceChains[chainId] = allowed;
        emit AllowedChainUpdated(chainId, allowed);
    }

    /**
     * @dev Map ZRC-20 token to its origin chain and symbol
     */
    function mapZRC20Asset(
        address zrc20,
        uint256 chainId,
        string calldata symbol
    ) external onlyOwner {
        zrc20ToChainId[zrc20] = chainId;
        chainAssets[chainId][symbol] = zrc20;
        emit ZRC20AssetMapped(zrc20, chainId, symbol);
    }

    /**
     * @dev Add supported asset for lending
     */
    function addAsset(
        address asset,
        uint256 collateralFactor,
        uint256 liquidationThreshold,
        uint256 liquidationBonus
    ) external onlyOwner {
        require(!assets[asset].isSupported, "Asset already supported");
        require(collateralFactor <= PRECISION, "Invalid collateral factor");
        require(
            liquidationThreshold <= PRECISION,
            "Invalid liquidation threshold"
        );

        assets[asset] = AssetConfig({
            isSupported: true,
            collateralFactor: collateralFactor,
            liquidationThreshold: liquidationThreshold,
            liquidationBonus: liquidationBonus,
            borrowRate: 0,
            supplyRate: 0,
            totalSupply: 0,
            totalBorrow: 0
        });

        supportedAssets.push(asset);
    }

    // === VIEW FUNCTIONS ===

    function getHealthFactor(address user) public view returns (uint256) {
        (
            uint256 totalCollateralValue,
            uint256 totalDebtValue,
            ,
            uint256 currentLiquidationThreshold,

        ) = getUserAccountData(user);

        return
            LiquidationLogic.calculateHealthFactor(
                totalCollateralValue,
                totalDebtValue,
                currentLiquidationThreshold
            );
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
    ) external view returns (AssetConfig memory) {
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
        uint256 totalCollateral;
        uint256 totalDebt;
        uint256 weightedLiquidationThreshold;

        for (uint256 i = 0; i < supportedAssets.length; i++) {
            address asset = supportedAssets[i];
            uint256 supplyBalance = userSupplies[user][asset];
            uint256 borrowBalance = userBorrows[user][asset];

            if (supplyBalance > 0 || borrowBalance > 0) {
                uint256 price = priceOracle.getPrice(asset);

                if (supplyBalance > 0) {
                    uint256 collateralValue = LiquidationLogic
                        .calculateCollateralValue(
                            asset,
                            supplyBalance,
                            assets[asset].collateralFactor,
                            priceOracle
                        );
                    totalCollateral += collateralValue;
                    weightedLiquidationThreshold +=
                        collateralValue *
                        assets[asset].liquidationThreshold;
                }

                if (borrowBalance > 0) {
                    totalDebt += LiquidationLogic.calculateDebtValue(
                        asset,
                        borrowBalance,
                        priceOracle
                    );
                }
            }
        }

        totalCollateralValue = totalCollateral;
        totalDebtValue = totalDebt;

        if (totalCollateral > 0) {
            currentLiquidationThreshold =
                weightedLiquidationThreshold /
                totalCollateral;
            availableBorrows =
                (totalCollateral * PRECISION) /
                MINIMUM_HEALTH_FACTOR -
                totalDebt;
            healthFactor = LiquidationLogic.calculateHealthFactor(
                totalCollateral,
                totalDebt,
                currentLiquidationThreshold
            );
        } else {
            currentLiquidationThreshold = 0;
            availableBorrows = 0;
            healthFactor = type(uint256).max;
        }
    }

    function isChainAllowed(uint256 chainId) external view returns (bool) {
        return allowedSourceChains[chainId];
    }

    function getZRC20ByChainAndSymbol(
        uint256 chainId,
        string calldata symbol
    ) external view returns (address) {
        return chainAssets[chainId][symbol];
    }

    // === INTERNAL FUNCTIONS ===

    function _updateInterest(address asset) internal {
        AssetConfig storage assetConfig = assets[asset];

        InterestRateModel.RateParams memory params = InterestRateModel
            .RateParams({
                baseRate: 0.02e18, // 2%
                slope1: 0.04e18, // 4%
                slope2: 0.75e18, // 75%
                optimalUtilization: 0.8e18 // 80%
            });

        uint256 borrowRate = InterestRateModel.calculateBorrowRate(
            assetConfig.totalSupply,
            assetConfig.totalBorrow,
            params
        );

        uint256 supplyRate = InterestRateModel.calculateSupplyRate(
            borrowRate,
            assetConfig.totalSupply,
            assetConfig.totalBorrow,
            RESERVE_FACTOR
        );

        assetConfig.borrowRate = borrowRate;
        assetConfig.supplyRate = supplyRate;
    }

    function _getAvailableBorrow(
        address user,
        address asset
    ) internal view returns (uint256) {
        (, , uint256 availableBorrows, , ) = getUserAccountData(user);
        uint256 assetPrice = priceOracle.getPrice(asset);
        return (availableBorrows * PRECISION) / assetPrice;
    }

    function setPriceOracle(address _priceOracle) external onlyOwner {
        priceOracle = IPriceOracle(_priceOracle);
    }
}
