// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import "./ISimpleLendingProtocol.sol";

interface IUniversalLendingProtocol is ISimpleLendingProtocol {
    struct AssetConfig {
        bool isSupported;
        uint256 collateralFactor;
        uint256 liquidationThreshold;
        uint256 liquidationBonus;
        uint256 borrowRate;
        uint256 supplyRate;
        uint256 totalSupply;
        uint256 totalBorrow;
    }

    // Additional errors for Universal protocol
    error ChainNotAllowed(uint256 chainId);
    error WithdrawalFailed();

    // Cross-chain specific events
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

    // Enhanced admin functions for Universal protocol
    function setAllowedSourceChain(uint256 chainId, bool allowed) external;
    
    function mapZRC20Asset(
        address zrc20,
        uint256 chainId,
        string calldata symbol
    ) external;
    
    function addAsset(
        address asset,
        uint256 collateralFactor,
        uint256 liquidationThreshold,
        uint256 liquidationBonus
    ) external;
    
    function setPriceOracle(address _priceOracle) external;

    // Enhanced view functions for Universal protocol
    function isChainAllowed(uint256 chainId) external view returns (bool);
    
    function getZRC20ByChainAndSymbol(
        uint256 chainId,
        string calldata symbol
    ) external view returns (address);
    
    // getAssetConfig is inherited from ISimpleLendingProtocol
    // UniversalLendingProtocol will have its own enhanced version
}