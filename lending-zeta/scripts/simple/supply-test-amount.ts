import { ethers } from "hardhat";
import { utils } from "ethers";
import {
  getNetwork,
  getTokenAddress
} from "../../utils/contracts";

async function main() {
  console.log("Supplying test amount to new contract...");

  const [user] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const chainId = network.chainId;

  // Get contract addresses
  const contractsJson = require("../../contracts.json");
  const simpleLendingAddress = contractsJson.networks[chainId.toString()].contracts.SimpleLendingProtocol;
  const ethArbiAddress = getTokenAddress(chainId, "ETH.ARBI");

  console.log("User:", user.address);
  console.log("SimpleLendingProtocol:", simpleLendingAddress);
  console.log("ETH.ARBI:", ethArbiAddress);

  // Connect to contracts
  const SimpleLendingProtocol = await ethers.getContractFactory("SimpleLendingProtocol");
  const simpleLendingProtocol = SimpleLendingProtocol.attach(simpleLendingAddress);

  const IERC20_ABI = [
    "function balanceOf(address account) external view returns (uint256)",
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function transfer(address to, uint256 amount) external returns (bool)"
  ];

  const ethArbiToken = new ethers.Contract(ethArbiAddress, IERC20_ABI, user);

  // Check user's current balance
  const userBalance = await ethArbiToken.balanceOf(user.address);
  console.log("User ETH.ARBI balance:", utils.formatEther(userBalance));

  if (userBalance.eq(0)) {
    console.log("User has no ETH.ARBI tokens. Cannot supply.");
    return;
  }

  const supplyAmount = ethers.utils.parseEther("0.001"); // Supply 0.001 ETH.ARBI

  if (userBalance.lt(supplyAmount)) {
    console.log("User has insufficient ETH.ARBI tokens.");
    return;
  }

  // Approve the supply
  console.log("Approving supply...");
  const approveTx = await ethArbiToken.approve(simpleLendingAddress, supplyAmount);
  await approveTx.wait();
  console.log("Approval confirmed");

  // Supply the tokens
  console.log("Supplying tokens...");
  const supplyTx = await simpleLendingProtocol.supply(ethArbiAddress, supplyAmount, user.address);
  await supplyTx.wait();
  console.log("Supply confirmed");

  // Check new balance
  const newSupplyBalance = await simpleLendingProtocol.getSupplyBalance(user.address, ethArbiAddress);
  console.log("New supply balance:", utils.formatEther(newSupplyBalance));

  console.log("✅ Test supply completed successfully!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });