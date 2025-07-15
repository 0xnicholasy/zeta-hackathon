// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";

contract SimplePriceOracle is Ownable {
    mapping(address => uint256) public prices; // Price in USD with 18 decimals
    
    event PriceUpdated(address indexed asset, uint256 price);
    
    constructor(address owner) Ownable(owner) {}
    
    function setPrice(address asset, uint256 priceInUSD) external onlyOwner {
        prices[asset] = priceInUSD * 1e18; // Convert to 18 decimals
        emit PriceUpdated(asset, prices[asset]);
    }
    
    function getPrice(address asset) external view returns (uint256) {
        require(prices[asset] > 0, "Price not set");
        return prices[asset];
    }
    
    function setPriceWithDecimals(address asset, uint256 price) external onlyOwner {
        prices[asset] = price; // Already in 18 decimals
        emit PriceUpdated(asset, price);
    }
}