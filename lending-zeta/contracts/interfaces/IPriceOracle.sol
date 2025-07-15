// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

interface IPriceOracle {
    event PriceUpdated(address indexed asset, uint256 price, uint256 timestamp);

    function getPrice(address asset) external view returns (uint256);

    function getLastUpdate(address asset) external view returns (uint256);

    function setPrice(address asset, uint256 price) external;

    function isValidPrice(address asset) external view returns (bool);
}
