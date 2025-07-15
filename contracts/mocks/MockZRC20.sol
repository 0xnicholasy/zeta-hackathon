// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "../interfaces/IZRC20.sol";

contract MockZRC20 is ERC20, IZRC20 {
    uint8 private _decimals;
    uint256 public constant PROTOCOL_FLAT_FEE = 0.001 ether;
    address public constant GAS_COIN = address(0);
    
    constructor(
        string memory name,
        string memory symbol,
        uint8 decimals_,
        uint256 initialSupply
    ) ERC20(name, symbol) {
        _decimals = decimals_;
        _mint(msg.sender, initialSupply);
    }
    
    function decimals() public view override returns (uint8) {
        return _decimals;
    }
    
    function deposit(address to, uint256 amount) external override returns (bool) {
        _mint(to, amount);
        return true;
    }
    
    function withdraw(bytes memory to, uint256 amount) external override returns (bool) {
        require(balanceOf(msg.sender) >= amount, "Insufficient balance");
        _burn(msg.sender, amount);
        return true;
    }
    
    function withdrawGasFee() external pure override returns (address, uint256) {
        return (GAS_COIN, PROTOCOL_FLAT_FEE);
    }
    
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
    
    function burn(address from, uint256 amount) external {
        _burn(from, amount);
    }
}