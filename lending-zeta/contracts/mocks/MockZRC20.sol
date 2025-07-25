// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "../interfaces/IZRC20.sol";

contract MockZRC20 is ERC20, IZRC20 {
    uint8 private _decimals;
    uint256 public constant PROTOCOL_FLAT_FEE = 0.00003 ether; // More realistic 0.00003 ETH gas fee
    address public gasToken;
    uint256 public gasFee;

    constructor(
        string memory name,
        string memory symbol,
        uint8 decimals_,
        uint256 initialSupply
    ) ERC20(name, symbol) {
        _decimals = decimals_;
        _mint(msg.sender, initialSupply);
        gasToken = address(this); // For testing, use self as gas token
        gasFee = PROTOCOL_FLAT_FEE; // Default gas fee
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }

    function deposit(
        address to,
        uint256 amount
    ) external override returns (bool) {
        _mint(to, amount);
        return true;
    }

    function withdraw(
        bytes memory to,
        uint256 amount
    ) external override returns (bool) {
        require(balanceOf(msg.sender) >= amount, "Insufficient balance");
        _burn(msg.sender, amount);
        return true;
    }

    function withdrawGasFee()
        external
        view
        override
        returns (address, uint256)
    {
        return (gasToken, gasFee);
    }
    
    function setGasToken(address _gasToken) external {
        gasToken = _gasToken;
    }
    
    function setGasFee(address _gasToken, uint256 _gasFee) external {
        gasToken = _gasToken;
        gasFee = _gasFee;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external {
        _burn(from, amount);
    }
    
    // Add missing function that gateway might expect
    function GAS_LIMIT() external pure returns (uint256) {
        return 250000; // Default gas limit
    }
}
