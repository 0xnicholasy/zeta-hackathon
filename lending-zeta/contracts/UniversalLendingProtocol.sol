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
import "./interfaces/IUniversalLendingProtocol.sol";
import "./interfaces/IPriceOracle.sol";
import "./libraries/CoreCalculations.sol";
import "./libraries/HealthFactorLogic.sol";
import "./libraries/PositionManager.sol";
import "./libraries/CrossChainOperations.sol";
import "./libraries/InterestRateModel.sol";
import "./libraries/LiquidationLogic.sol";
import "./libraries/UserAssetCalculations.sol";

/**
 * @title UniversalLendingProtocol
 * @author ZetaChain Cross-Chain Lending Protocol
 * @notice Universal cross-chain lending protocol with modular library architecture
 * @dev Refactored to eliminate SimpleLending inheritance and delegate to specialized libraries
 *      Provides overcollateralized lending with cross-chain capabilities via ZetaChain Gateway
 *      Target: ~400 lines (60% reduction from 1050 lines)
 */
contract UniversalLendingProtocol is
    UniversalContract,
    IUniversalLendingProtocol,
    ReentrancyGuard,
    Ownable
{
    using SafeERC20 for IERC20;
    using CoreCalculations for uint256;
    using HealthFactorLogic for *;
    using PositionManager for *;
    using CrossChainOperations for *;
    using InterestRateModel for *;
    using LiquidationLogic for *;
    using UserAssetCalculations for *;

    // ============ Constants ============
    uint256 private constant PRECISION = 1e18;
    uint256 private constant RESERVE_FACTOR = 0.1e18; // 10%
    uint256 private constant MIN_VALID_PRICE = 1e6;

    // ============ Additional Events ============
    event CrossChainOperationReverted(
        address indexed user,
        address indexed asset,
        uint256 amount,
        uint256 chainId
    );

    // ============ Core Protocol State ============
    IGatewayZEVM public immutable gateway;
    IPriceOracle public priceOracle;

    // Unified asset configuration (eliminates Asset vs AssetConfig confusion)
    mapping(address => AssetConfig) public assets;
    mapping(address => mapping(address => uint256)) public userSupplies;
    mapping(address => mapping(address => uint256)) public userBorrows;
    mapping(address => mapping(address => uint256)) public lastInterestUpdate;
    mapping(address => uint256) public totalReserves;
    mapping(address => uint256) public lastGlobalInterestUpdate;

    // Asset tracking
    address[] public supportedAssets;
    mapping(address => bool) public isAssetAdded;

    // Cross-chain configuration
    mapping(uint256 => bool) public allowedSourceChains;
    mapping(address => uint256) public zrc20ToChainId;
    mapping(uint256 => mapping(string => address)) public chainAssets;

    // ============ Modifiers ============
    modifier onlyGateway() {
        if (msg.sender != address(gateway)) revert Unauthorized();
        _;
    }

    // ============ Constructor ============
    constructor(
        address payable _gateway,
        address _priceOracle,
        address _owner
    ) Ownable(_owner) {
        require(_gateway != address(0), "Invalid gateway address");
        require(_priceOracle != address(0), "Invalid oracle address");

        gateway = IGatewayZEVM(_gateway);
        priceOracle = IPriceOracle(_priceOracle);
    }

    // ============ Admin Functions ============
    function setAllowedSourceChain(
        uint256 chainId,
        bool allowed
    ) external onlyOwner {
        allowedSourceChains[chainId] = allowed;
        emit AllowedChainUpdated(chainId, allowed);
    }

    function mapZRC20Asset(
        address zrc20,
        uint256 chainId,
        string calldata symbol
    ) external onlyOwner {
        zrc20ToChainId[zrc20] = chainId;
        chainAssets[chainId][symbol] = zrc20;
        emit ZRC20AssetMapped(zrc20, chainId, symbol);
    }

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
        require(liquidationBonus <= PRECISION, "Invalid liquidation bonus");

        if (!isAssetAdded[asset]) {
            supportedAssets.push(asset);
            isAssetAdded[asset] = true;
        }

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
    }

    function setPriceOracle(address _priceOracle) external onlyOwner {
        require(_priceOracle != address(0), "Invalid oracle address");
        priceOracle = IPriceOracle(_priceOracle);
    }

    // ============ View Functions ============
    function isChainAllowed(uint256 chainId) external view returns (bool) {
        return allowedSourceChains[chainId];
    }

    function getZRC20ByChainAndSymbol(
        uint256 chainId,
        string calldata symbol
    ) external view returns (address) {
        return chainAssets[chainId][symbol];
    }

    function getAssetConfig(
        address asset
    ) external view returns (AssetConfig memory) {
        return assets[asset];
    }

    function getEnhancedAssetConfig(
        address asset
    ) external view returns (AssetConfig memory) {
        return assets[asset];
    }

    function _getValidatedPrice(address asset) internal view returns (uint256) {
        uint256 price = priceOracle.getPrice(asset);
        require(price >= MIN_VALID_PRICE, "Invalid price: too low");
        return price;
    }

    // ============ Gateway Functions ============
    function onCall(
        MessageContext calldata context,
        address zrc20,
        uint256 amount,
        bytes calldata message
    ) external override onlyGateway {
        require(allowedSourceChains[context.chainID], "Chain not allowed");

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
        } else if (message.length == 224) {
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
                CrossChainOperations.handleCrossChainBorrow(
                    zrc20,
                    operationAmount,
                    user,
                    destinationChain,
                    abi.encodePacked(recipient),
                    gateway,
                    supportedAssets,
                    userSupplies,
                    userBorrows,
                    assets,
                    priceOracle
                );
                return;
            } else if (
                keccak256(abi.encodePacked(action)) ==
                keccak256(abi.encodePacked("withdrawCrossChain"))
            ) {
                CrossChainOperations.handleCrossChainWithdraw(
                    zrc20,
                    operationAmount,
                    user,
                    destinationChain,
                    abi.encodePacked(recipient),
                    gateway,
                    supportedAssets,
                    userSupplies,
                    userBorrows,
                    assets,
                    priceOracle
                );
                return;
            }
        }

        revert("Invalid operation or message format");
    }

    function onRevert(
        RevertContext calldata context,
        address zrc20,
        uint256 amount,
        bytes calldata
    ) external onlyGateway {
        IERC20(zrc20).safeTransfer(context.sender, amount);
        emit Withdraw(address(0), zrc20, amount);
        emit CrossChainOperationReverted(context.sender, zrc20, amount, 0);
    }

    // ============ Internal Helper Functions ============
    function _supply(
        address asset,
        uint256 amount,
        address onBehalfOf
    ) internal {
        if (!assets[asset].isSupported) revert AssetNotSupported(asset);
        if (amount == 0) revert InvalidAmount();

        _updateInterest(asset);
        userSupplies[onBehalfOf][asset] += amount;
        assets[asset].totalSupply += amount;
        lastInterestUpdate[onBehalfOf][asset] = block.timestamp;
        _updateInterestRates(asset);
        emit Supply(onBehalfOf, asset, amount);
    }

    function _repay(
        address asset,
        uint256 amount,
        address onBehalfOf
    ) internal {
        if (!assets[asset].isSupported) revert AssetNotSupported(asset);
        if (amount == 0) revert InvalidAmount();

        _updateInterest(asset);
        uint256 userDebt = userBorrows[onBehalfOf][asset];
        uint256 amountToRepay = amount > userDebt ? userDebt : amount;

        userBorrows[onBehalfOf][asset] -= amountToRepay;
        assets[asset].totalBorrow -= amountToRepay;

        if (amount > userDebt) {
            uint256 excess = amount - userDebt;
            userSupplies[onBehalfOf][asset] += excess;
            assets[asset].totalSupply += excess;
            emit Supply(onBehalfOf, asset, excess);
        }

        _updateInterestRates(asset);
        emit Repay(onBehalfOf, asset, amountToRepay);
    }

    // ============ Core Lending Functions ============
    function supply(
        address asset,
        uint256 amount,
        address onBehalfOf
    ) external nonReentrant {
        if (!assets[asset].isSupported) revert AssetNotSupported(asset);
        if (amount == 0) revert InvalidAmount();

        IERC20(asset).safeTransferFrom(msg.sender, address(this), amount);
        _supply(asset, amount, onBehalfOf);
    }

    function borrow(
        address asset,
        uint256 amount,
        address to
    ) external nonReentrant {
        if (!assets[asset].isSupported) revert AssetNotSupported(asset);
        if (amount == 0) revert InvalidAmount();

        uint256 contractBalance = IERC20(asset).balanceOf(address(this));
        bool canBorrowAmount = HealthFactorLogic.canBorrow(
            msg.sender,
            asset,
            amount,
            contractBalance,
            supportedAssets,
            userSupplies,
            userBorrows,
            assets,
            priceOracle
        );
        if (!canBorrowAmount) revert InsufficientCollateral();

        _updateInterest(asset);
        userBorrows[msg.sender][asset] += amount;
        assets[asset].totalBorrow += amount;
        lastInterestUpdate[msg.sender][asset] = block.timestamp;

        IERC20(asset).safeTransfer(to, amount);
        _updateInterestRates(asset);

        emit Borrow(msg.sender, asset, amount);
    }

    function repay(
        address asset,
        uint256 amount,
        address onBehalfOf
    ) external nonReentrant {
        if (!assets[asset].isSupported) revert AssetNotSupported(asset);
        if (amount == 0) revert InvalidAmount();

        IERC20(asset).safeTransferFrom(msg.sender, address(this), amount);
        _repay(asset, amount, onBehalfOf);
    }

    function withdraw(
        address asset,
        uint256 amount,
        address to
    ) external nonReentrant {
        if (!assets[asset].isSupported) revert AssetNotSupported(asset);
        if (amount == 0) revert InvalidAmount();
        if (userSupplies[msg.sender][asset] < amount)
            revert InsufficientBalance();

        uint256 contractBalance = IERC20(asset).balanceOf(address(this));
        bool canWithdrawAmount = HealthFactorLogic.canWithdraw(
            msg.sender,
            asset,
            amount,
            contractBalance,
            supportedAssets,
            userSupplies,
            userBorrows,
            assets,
            priceOracle
        );
        if (!canWithdrawAmount) revert InsufficientCollateral();

        _updateInterest(asset);
        userSupplies[msg.sender][asset] -= amount;
        assets[asset].totalSupply -= amount;

        IERC20(asset).safeTransfer(to, amount);
        _updateInterestRates(asset);

        emit Withdraw(msg.sender, asset, amount);
    }

    function liquidate(
        address user,
        address collateralAsset,
        address debtAsset,
        uint256 repayAmount
    ) external nonReentrant {
        if (!assets[collateralAsset].isSupported)
            revert AssetNotSupported(collateralAsset);
        if (!assets[debtAsset].isSupported) revert AssetNotSupported(debtAsset);

        bool canLiquidate = HealthFactorLogic.isLiquidatable(
            user,
            supportedAssets,
            userSupplies,
            userBorrows,
            assets,
            priceOracle
        );
        if (!canLiquidate) revert HealthFactorTooLow();

        uint256 userDebt = userBorrows[user][debtAsset];
        if (repayAmount > userDebt) revert InvalidAmount();

        _updateInterest(collateralAsset);
        _updateInterest(debtAsset);

        uint256 liquidatedCollateral = LiquidationLogic
            .calculateLiquidationAmount(
                repayAmount,
                _getValidatedPrice(debtAsset),
                _getValidatedPrice(collateralAsset),
                assets[collateralAsset].liquidationBonus,
                debtAsset,
                collateralAsset
            );

        if (userSupplies[user][collateralAsset] < liquidatedCollateral)
            revert InsufficientBalance();

        IERC20(debtAsset).safeTransferFrom(
            msg.sender,
            address(this),
            repayAmount
        );

        userBorrows[user][debtAsset] -= repayAmount;
        userSupplies[user][collateralAsset] -= liquidatedCollateral;
        assets[debtAsset].totalBorrow -= repayAmount;
        assets[collateralAsset].totalSupply -= liquidatedCollateral;

        IERC20(collateralAsset).safeTransfer(msg.sender, liquidatedCollateral);

        emit Liquidate(
            msg.sender,
            user,
            collateralAsset,
            debtAsset,
            repayAmount,
            liquidatedCollateral
        );
    }

    // ============ Health Factor and Position Functions ============
    function getHealthFactor(address user) public view returns (uint256) {
        return
            HealthFactorLogic.calculateHealthFactor(
                user,
                supportedAssets,
                userSupplies,
                userBorrows,
                assets,
                priceOracle
            );
    }

    function getDebtValue(
        address user,
        address asset
    ) public view returns (uint256) {
        uint256 amount = userBorrows[user][asset];
        uint256 price = _getValidatedPrice(asset);
        return CoreCalculations.calculateAssetValue(amount, asset, price);
    }

    function getCollateralValue(
        address user,
        address asset
    ) public view returns (uint256) {
        uint256 amount = userSupplies[user][asset];
        uint256 price = _getValidatedPrice(asset);
        uint256 assetValue = CoreCalculations.calculateAssetValue(
            amount,
            asset,
            price
        );
        return (assetValue * assets[asset].collateralFactor) / PRECISION;
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
        return
            PositionManager.getUserAccountData(
                user,
                supportedAssets,
                userSupplies,
                userBorrows,
                assets,
                priceOracle
            );
    }

    function maxAvailableBorrowsInUsd(
        address user
    ) public view returns (uint256) {
        return
            HealthFactorLogic.getMaxBorrowableUsd(
                user,
                supportedAssets,
                userSupplies,
                userBorrows,
                assets,
                priceOracle
            );
    }

    function maxAvailableBorrows(
        address user,
        address asset
    ) public view returns (uint256) {
        uint256 contractBalance = IERC20(asset).balanceOf(address(this));
        return
            HealthFactorLogic.getMaxBorrowableAmount(
                user,
                asset,
                contractBalance,
                supportedAssets,
                userSupplies,
                userBorrows,
                assets,
                priceOracle
            );
    }

    // ============ Interest Rate Management ============
    function _updateInterest(address asset) internal {
        AssetConfig storage assetConfig = assets[asset];
        uint256 lastUpdate = lastGlobalInterestUpdate[asset];

        if (lastUpdate == 0) {
            lastGlobalInterestUpdate[asset] = block.timestamp;
            return;
        }

        uint256 timeElapsed = block.timestamp - lastUpdate;
        if (timeElapsed == 0) return;

        if (assetConfig.totalBorrow > 0 && assetConfig.borrowRate > 0) {
            // PRECISION FIX: Multiply before divide to minimize precision loss
            // Calculate interest accrued with higher precision
            uint256 interestAccrued = (assetConfig.totalBorrow *
                assetConfig.borrowRate *
                timeElapsed) / (365 days * PRECISION);
            assetConfig.totalBorrow += interestAccrued;
            // PRECISION FIX: Calculate reserve amount with proper precision
            uint256 reserveAmount = (interestAccrued * RESERVE_FACTOR) /
                PRECISION;
            totalReserves[asset] += reserveAmount;
        }

        (uint256 borrowRate, uint256 supplyRate) = _calculateInterestRates(
            assetConfig
        );
        assetConfig.borrowRate = borrowRate;
        assetConfig.supplyRate = supplyRate;
        lastGlobalInterestUpdate[asset] = block.timestamp;
    }

    function _updateInterestRates(address asset) internal {
        AssetConfig storage assetConfig = assets[asset];
        (uint256 borrowRate, uint256 supplyRate) = _calculateInterestRates(
            assetConfig
        );
        assetConfig.borrowRate = borrowRate;
        assetConfig.supplyRate = supplyRate;
    }

    function _calculateInterestRates(
        AssetConfig storage assetConfig
    ) internal view returns (uint256 borrowRate, uint256 supplyRate) {
        InterestRateModel.RateParams memory params = InterestRateModel
            .RateParams({
                baseRate: 0.02e18,
                slope1: 0.04e18,
                slope2: 0.75e18,
                optimalUtilization: 0.8e18
            });

        borrowRate = InterestRateModel.calculateBorrowRate(
            assetConfig.totalSupply,
            assetConfig.totalBorrow,
            params
        );
        supplyRate = InterestRateModel.calculateSupplyRate(
            borrowRate,
            assetConfig.totalSupply,
            assetConfig.totalBorrow,
            RESERVE_FACTOR
        );
    }

    // ============ Validation Functions ============
    function canBorrow(
        address user,
        address asset,
        uint256 amount
    ) public view returns (bool) {
        uint256 contractBalance = IERC20(asset).balanceOf(address(this));
        return
            HealthFactorLogic.canBorrow(
                user,
                asset,
                amount,
                contractBalance,
                supportedAssets,
                userSupplies,
                userBorrows,
                assets,
                priceOracle
            );
    }

    function canWithdraw(
        address user,
        address asset,
        uint256 amount
    ) public view returns (bool) {
        uint256 contractBalance = IERC20(asset).balanceOf(address(this));
        return
            HealthFactorLogic.canWithdraw(
                user,
                asset,
                amount,
                contractBalance,
                supportedAssets,
                userSupplies,
                userBorrows,
                assets,
                priceOracle
            );
    }

    // ============ Liquidation Functions ============
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
        )
    {
        if (
            !assets[collateralAsset].isSupported ||
            !assets[debtAsset].isSupported
        ) return (0, 0, false);

        canLiquidate = HealthFactorLogic.isLiquidatable(
            user,
            supportedAssets,
            userSupplies,
            userBorrows,
            assets,
            priceOracle
        );
        if (!canLiquidate) return (0, 0, false);

        uint256 userDebt = userBorrows[user][debtAsset];
        uint256 userCollateral = userSupplies[user][collateralAsset];
        if (userDebt == 0 || userCollateral == 0) return (0, 0, false);

        maxRepayAmount = userDebt;
        liquidatedCollateral = LiquidationLogic.calculateLiquidationAmount(
            maxRepayAmount,
            _getValidatedPrice(debtAsset),
            _getValidatedPrice(collateralAsset),
            assets[collateralAsset].liquidationBonus,
            debtAsset,
            collateralAsset
        );

        if (liquidatedCollateral > userCollateral) {
            liquidatedCollateral = userCollateral;
            maxRepayAmount =
                (CoreCalculations.calculateAssetValue(
                    liquidatedCollateral,
                    collateralAsset,
                    _getValidatedPrice(collateralAsset)
                ) * PRECISION) /
                (CoreCalculations.calculateAssetValue(
                    1,
                    debtAsset,
                    _getValidatedPrice(debtAsset)
                ) * (PRECISION + assets[collateralAsset].liquidationBonus));
            if (maxRepayAmount > userDebt) maxRepayAmount = userDebt;
        }
    }

    function getUserPositionData(
        address user
    )
        public
        view
        override
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
        PositionManager.UserPositionData memory positionData = PositionManager
            .getUserPositionData(
                user,
                supportedAssets,
                userSupplies,
                userBorrows,
                assets,
                priceOracle
            );

        return (
            positionData.totalCollateralValue,
            positionData.totalDebtValue,
            positionData.healthFactor,
            positionData.maxBorrowUsdValue,
            positionData.liquidationThreshold,
            positionData.suppliedAssets,
            positionData.suppliedAmounts,
            positionData.suppliedValues,
            positionData.borrowedAssets,
            positionData.borrowedAmounts,
            positionData.borrowedValues
        );
    }

    // ============ Additional Interface Functions ============
    function addAsset(address asset) external onlyOwner {
        _addAssetWithDefaults(asset);
    }

    function _addAssetWithDefaults(address asset) internal {
        if (!assets[asset].isSupported) {
            if (!isAssetAdded[asset]) {
                supportedAssets.push(asset);
                isAssetAdded[asset] = true;
            }
            assets[asset] = AssetConfig({
                isSupported: true,
                collateralFactor: 0.8e18,
                liquidationThreshold: 0.85e18,
                liquidationBonus: 0.1e18,
                borrowRate: 0,
                supplyRate: 0,
                totalSupply: 0,
                totalBorrow: 0
            });
        }
    }

    function borrowCrossChain(
        address asset,
        uint256 amount,
        uint256 destinationChain,
        bytes memory recipient
    ) external nonReentrant {
        CrossChainOperations.handleCrossChainBorrow(
            asset,
            amount,
            msg.sender,
            destinationChain,
            recipient,
            gateway,
            supportedAssets,
            userSupplies,
            userBorrows,
            assets,
            priceOracle
        );
    }

    function withdrawCrossChain(
        address asset,
        uint256 amount,
        uint256 destinationChain,
        bytes memory recipient
    ) external nonReentrant {
        CrossChainOperations.handleCrossChainWithdraw(
            asset,
            amount,
            msg.sender,
            destinationChain,
            recipient,
            gateway,
            supportedAssets,
            userSupplies,
            userBorrows,
            assets,
            priceOracle
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

    function getSupportedAssetsCount() external view returns (uint256) {
        return supportedAssets.length;
    }

    function getSupportedAsset(uint256 index) external view returns (address) {
        require(index < supportedAssets.length, "Invalid index");
        return supportedAssets[index];
    }

    function getSupportedAssets() external view returns (address[] memory) {
        return supportedAssets;
    }

    function getAssetPrice(address asset) external view returns (uint256) {
        return _getValidatedPrice(asset);
    }

    function getTotalCollateralValue(
        address user
    ) external view returns (uint256) {
        uint256 totalCollateral = 0;
        // GAS OPTIMIZATION: Cache array length to save gas
        uint256 length = supportedAssets.length;
        for (uint256 i = 0; i < length; i++) {
            totalCollateral += getCollateralValue(user, supportedAssets[i]);
        }
        return totalCollateral;
    }

    function getTotalDebtValue(address user) external view returns (uint256) {
        uint256 totalDebt = 0;
        // GAS OPTIMIZATION: Cache array length to save gas
        uint256 length = supportedAssets.length;
        for (uint256 i = 0; i < length; i++) {
            totalDebt += getDebtValue(user, supportedAssets[i]);
        }
        return totalDebt;
    }

    function isLiquidatable(address user) external view returns (bool) {
        return
            HealthFactorLogic.isLiquidatable(
                user,
                supportedAssets,
                userSupplies,
                userBorrows,
                assets,
                priceOracle
            );
    }

    function getWithdrawGasFee(
        address asset
    ) external view returns (address gasToken, uint256 gasFee) {
        (gasToken, gasFee, ) = CrossChainOperations.getCrossChainFeeEstimate(
            asset,
            0
        );
    }

    function maxAvailableAmount(address asset) external view returns (uint256) {
        return IERC20(asset).balanceOf(address(this));
    }

    function getAssetsAndPrices()
        external
        view
        returns (
            address[] memory assetAddresses,
            uint256[] memory prices,
            uint256[] memory borrowableAmounts
        )
    {
        uint256 assetsCount = supportedAssets.length;
        assetAddresses = new address[](assetsCount);
        prices = new uint256[](assetsCount);
        borrowableAmounts = new uint256[](assetsCount);

        // GAS OPTIMIZATION: Array length already cached as assetsCount
        for (uint256 i = 0; i < assetsCount; i++) {
            address asset = supportedAssets[i];
            assetAddresses[i] = asset;
            prices[i] = _getValidatedPrice(asset);
            borrowableAmounts[i] = IERC20(asset).balanceOf(address(this));
        }
    }

    function getHealthFactorAfterBorrow(
        address user,
        address asset,
        uint256 amount
    ) public view returns (uint256) {
        return
            HealthFactorLogic.calculateHealthFactorWithModification(
                user,
                asset,
                userSupplies[user][asset],
                userBorrows[user][asset] + amount,
                supportedAssets,
                userSupplies,
                userBorrows,
                assets,
                priceOracle
            );
    }

    function getHealthFactorAfterRepay(
        address user,
        address asset,
        uint256 amount
    ) public view returns (uint256) {
        uint256 currentDebt = userBorrows[user][asset];
        uint256 newDebt = currentDebt > amount ? currentDebt - amount : 0;
        return
            HealthFactorLogic.calculateHealthFactorWithModification(
                user,
                asset,
                userSupplies[user][asset],
                newDebt,
                supportedAssets,
                userSupplies,
                userBorrows,
                assets,
                priceOracle
            );
    }

    function getHealthFactorAfterWithdraw(
        address user,
        address asset,
        uint256 amount
    ) public view returns (uint256) {
        uint256 currentSupply = userSupplies[user][asset];
        uint256 newSupply = currentSupply > amount ? currentSupply - amount : 0;
        return
            HealthFactorLogic.calculateHealthFactorWithModification(
                user,
                asset,
                newSupply,
                userBorrows[user][asset],
                supportedAssets,
                userSupplies,
                userBorrows,
                assets,
                priceOracle
            );
    }
}
