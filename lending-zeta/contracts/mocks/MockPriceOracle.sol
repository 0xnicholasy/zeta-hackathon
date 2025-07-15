// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import "../interfaces/IPriceOracle.sol";

contract MockPriceOracle is IPriceOracle {
    mapping(address => uint256) private prices;
    mapping(address => uint256) private lastUpdates;

    uint256 private constant PRICE_PRECISION = 1e18;

    function setPrice(address asset, uint256 price) external override {
        prices[asset] = price;
        lastUpdates[asset] = block.timestamp;
        emit PriceUpdated(asset, price, block.timestamp);
    }

    function getPrice(address asset) external view override returns (uint256) {
        require(prices[asset] > 0, "Price not set");
        return prices[asset];
    }

    function getLastUpdate(
        address asset
    ) external view override returns (uint256) {
        return lastUpdates[asset];
    }

    function isValidPrice(address asset) external view override returns (bool) {
        return prices[asset] > 0;
    }

    function setPriceInUSD(address asset, uint256 priceInUSD) external {
        prices[asset] = priceInUSD * PRICE_PRECISION;
        lastUpdates[asset] = block.timestamp;
        emit PriceUpdated(asset, prices[asset], block.timestamp);
    }
}
