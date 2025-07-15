// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IPriceOracle.sol";

contract PriceOracle is IPriceOracle, Ownable {
    uint256 private constant PRICE_PRECISION = 1e18;
    uint256 private constant MAX_PRICE_AGE = 3600; // 1 hour
    
    mapping(address => uint256) public fallbackPrices;
    mapping(address => uint256) public lastPriceUpdate;
    
    event FallbackPriceSet(address indexed asset, uint256 price);

    constructor(address owner) Ownable(owner) {}

    function setFallbackPrice(address asset, uint256 price) external onlyOwner {
        require(price > 0, "Invalid price");
        fallbackPrices[asset] = price;
        lastPriceUpdate[asset] = block.timestamp;
        emit FallbackPriceSet(asset, price);
        emit PriceUpdated(asset, price, block.timestamp);
    }

    function getPrice(address asset) external view override returns (uint256) {
        require(fallbackPrices[asset] > 0, "No price available");
        require(isValidPrice(asset), "Price too stale");
        
        return fallbackPrices[asset];
    }

    function getLastUpdate(address asset) external view override returns (uint256) {
        return lastPriceUpdate[asset];
    }

    function setPrice(address asset, uint256 price) external override onlyOwner {
        require(price > 0, "Invalid price");
        fallbackPrices[asset] = price;
        lastPriceUpdate[asset] = block.timestamp;
        emit FallbackPriceSet(asset, price);
        emit PriceUpdated(asset, price, block.timestamp);
    }

    function isValidPrice(address asset) public view override returns (bool) {
        return fallbackPrices[asset] > 0 && 
               block.timestamp - lastPriceUpdate[asset] <= MAX_PRICE_AGE;
    }

    function setPriceInUSD(address asset, uint256 priceInUSD) external onlyOwner {
        require(priceInUSD > 0, "Invalid price");
        fallbackPrices[asset] = priceInUSD * PRICE_PRECISION;
        lastPriceUpdate[asset] = block.timestamp;
        emit FallbackPriceSet(asset, fallbackPrices[asset]);
        emit PriceUpdated(asset, fallbackPrices[asset], block.timestamp);
    }

    function withdrawFees() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No fees to withdraw");
        payable(owner()).transfer(balance);
    }

    receive() external payable {}
}