// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract SimpleLendingProtocol is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    uint256 private constant PRECISION = 1e18;
    uint256 private constant COLLATERAL_RATIO = 150; // 150% = 1.5x
    uint256 private constant LIQUIDATION_THRESHOLD = 120; // 120% = 1.2x
    
    struct Asset {
        bool isSupported;
        uint256 price; // Price in USD with 18 decimals
    }
    
    mapping(address => Asset) public assets;
    mapping(address => mapping(address => uint256)) public userSupplies; // user -> asset -> amount
    mapping(address => mapping(address => uint256)) public userBorrows;  // user -> asset -> amount
    
    // Keep track of supported assets for iteration
    address[] public supportedAssets;
    mapping(address => bool) public isAssetAdded;
    
    event Supply(address indexed user, address indexed asset, uint256 amount);
    event Borrow(address indexed user, address indexed asset, uint256 amount);
    event Repay(address indexed user, address indexed asset, uint256 amount);
    event Withdraw(address indexed user, address indexed asset, uint256 amount);
    event Liquidate(address indexed liquidator, address indexed user, uint256 repaidDebt, uint256 seizedCollateral);

    constructor(address owner) Ownable(owner) {}

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

    function updatePrice(address asset, uint256 priceInUSD) external onlyOwner {
        require(assets[asset].isSupported, "Asset not supported");
        assets[asset].price = priceInUSD * PRECISION;
    }

    function supply(address asset, uint256 amount) external nonReentrant {
        require(assets[asset].isSupported, "Asset not supported");
        require(amount > 0, "Amount must be greater than 0");
        
        IERC20(asset).safeTransferFrom(msg.sender, address(this), amount);
        userSupplies[msg.sender][asset] += amount;
        
        emit Supply(msg.sender, asset, amount);
    }

    function borrow(address asset, uint256 amount) external nonReentrant {
        require(assets[asset].isSupported, "Asset not supported");
        require(amount > 0, "Amount must be greater than 0");
        require(IERC20(asset).balanceOf(address(this)) >= amount, "Insufficient liquidity");
        
        // Check if user has enough collateral
        require(canBorrow(msg.sender, asset, amount), "Insufficient collateral");
        
        userBorrows[msg.sender][asset] += amount;
        IERC20(asset).safeTransfer(msg.sender, amount);
        
        emit Borrow(msg.sender, asset, amount);
    }

    function repay(address asset, uint256 amount) external nonReentrant {
        require(assets[asset].isSupported, "Asset not supported");
        require(amount > 0, "Amount must be greater than 0");
        
        uint256 debt = userBorrows[msg.sender][asset];
        uint256 repayAmount = amount > debt ? debt : amount;
        
        IERC20(asset).safeTransferFrom(msg.sender, address(this), repayAmount);
        userBorrows[msg.sender][asset] -= repayAmount;
        
        emit Repay(msg.sender, asset, repayAmount);
    }

    function withdraw(address asset, uint256 amount) external nonReentrant {
        require(assets[asset].isSupported, "Asset not supported");
        require(amount > 0, "Amount must be greater than 0");
        require(userSupplies[msg.sender][asset] >= amount, "Insufficient balance");
        
        // Check if withdrawal would break collateral ratio
        require(canWithdraw(msg.sender, asset, amount), "Would break collateral ratio");
        
        userSupplies[msg.sender][asset] -= amount;
        IERC20(asset).safeTransfer(msg.sender, amount);
        
        emit Withdraw(msg.sender, asset, amount);
    }

    function liquidate(
        address user,
        address collateralAsset,
        address debtAsset,
        uint256 repayAmount
    ) external nonReentrant {
        require(assets[collateralAsset].isSupported && assets[debtAsset].isSupported, "Asset not supported");
        require(repayAmount > 0, "Amount must be greater than 0");
        require(userBorrows[user][debtAsset] >= repayAmount, "Repay amount exceeds debt");
        require(isLiquidatable(user), "User is not liquidatable");
        
        // Calculate collateral to seize (with 5% bonus)
        uint256 collateralValue = (repayAmount * assets[debtAsset].price * 105) / (100 * assets[collateralAsset].price);
        require(userSupplies[user][collateralAsset] >= collateralValue, "Insufficient collateral");
        
        // Transfer repay amount from liquidator
        IERC20(debtAsset).safeTransferFrom(msg.sender, address(this), repayAmount);
        
        // Update balances
        userBorrows[user][debtAsset] -= repayAmount;
        userSupplies[user][collateralAsset] -= collateralValue;
        
        // Transfer collateral to liquidator
        IERC20(collateralAsset).safeTransfer(msg.sender, collateralValue);
        
        emit Liquidate(msg.sender, user, repayAmount, collateralValue);
    }

    function getHealthFactor(address user) public view returns (uint256) {
        uint256 totalCollateralValue = getTotalCollateralValue(user);
        uint256 totalDebtValue = getTotalDebtValue(user);
        
        if (totalDebtValue == 0) {
            return type(uint256).max;
        }
        
        return (totalCollateralValue * 100) / totalDebtValue;
    }

    function getTotalCollateralValue(address user) public view returns (uint256) {
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

    function getCollateralValue(address user, address asset) public view returns (uint256) {
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

    function getDebtValue(address user, address asset) public view returns (uint256) {
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

    function canBorrow(address user, address asset, uint256 amount) public view returns (bool) {
        uint256 totalCollateralValue = getTotalCollateralValue(user);
        
        // Calculate normalized debt value for the new borrow
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
        
        uint256 healthFactor = (totalCollateralValue * 100) / totalDebtValue;
        return healthFactor >= COLLATERAL_RATIO;
    }

    function canWithdraw(address user, address asset, uint256 amount) public view returns (bool) {
        // Calculate normalized collateral value for the withdrawal
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
        
        uint256 healthFactor = (newCollateralValue * 100) / totalDebtValue;
        return healthFactor >= COLLATERAL_RATIO;
    }

    function isLiquidatable(address user) public view returns (bool) {
        uint256 healthFactor = getHealthFactor(user);
        return healthFactor < LIQUIDATION_THRESHOLD && healthFactor != type(uint256).max;
    }

    function getSupportedAssetsCount() external view returns (uint256) {
        return supportedAssets.length;
    }

    function getSupportedAsset(uint256 index) external view returns (address) {
        require(index < supportedAssets.length, "Index out of bounds");
        return supportedAssets[index];
    }
}