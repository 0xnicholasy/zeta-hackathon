// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import "../interfaces/IPriceOracle.sol";

contract MockPriceOracle is IPriceOracle {
    mapping(address => uint256) private prices;
    mapping(address => uint256) private lastUpdates;

    uint256 private constant PRICE_PRECISION = 1e18;
    uint256 private constant MAX_PRICE_AGE = 3600; // 1 hour

    function setPrice(address asset, uint256 price) external override {
        prices[asset] = price;
        lastUpdates[asset] = block.timestamp;
        emit PriceUpdated(asset, price, block.timestamp);
    }

    function isValidPrice(address asset) public view override returns (bool) {
        return
            prices[asset] > 0 &&
            block.timestamp - lastUpdates[asset] <= MAX_PRICE_AGE;
    }

    function getPrice(address asset) external view override returns (uint256) {
        require(prices[asset] > 0, "Price not set");
        require(isValidPrice(asset), "Price too stale");
        return prices[asset];
    }

    function getLastUpdate(
        address asset
    ) external view override returns (uint256) {
        return lastUpdates[asset];
    }

    function setPriceInUSD(address asset, uint256 priceInUSD) external {
        prices[asset] = priceInUSD * PRICE_PRECISION;
        lastUpdates[asset] = block.timestamp;
        emit PriceUpdated(asset, prices[asset], block.timestamp);
    }
}
