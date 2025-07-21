import { ethers } from "hardhat";
import { utils } from "ethers";
import {
  getNetwork,
  getTokenAddress
} from "../../utils/contracts";

async function main() {
  console.log("Checking balances on ZetaChain...");

  const [user] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const chainId = network.chainId;

  const contractsJson = require("../../contracts.json");
  const simpleLendingAddress = contractsJson.networks[chainId.toString()].contracts.SimpleLendingProtocol;
  const ethArbiAddress = getTokenAddress(chainId, "ETH.ARBI");
  const usdcArbiAddress = getTokenAddress(chainId, "USDC.ARBI");

  console.log("User:", user.address);
  console.log("SimpleLendingProtocol:", simpleLendingAddress);
  console.log("ETH.ARBI:", ethArbiAddress);
  console.log("USDC.ARBI:", usdcArbiAddress);

  // Connect to contracts
  const SimpleLendingProtocol = await ethers.getContractFactory("SimpleLendingProtocol");
  const simpleLendingProtocol = SimpleLendingProtocol.attach(simpleLendingAddress);

  const IERC20_ABI = ["function balanceOf(address account) external view returns (uint256)"];
  
  // Check user supply balances in the lending protocol
  console.log("\n=== User Supply Balances in Lending Protocol ===");
  const ethSupplyBalance = await simpleLendingProtocol.getSupplyBalance(user.address, ethArbiAddress);
  const usdcSupplyBalance = await simpleLendingProtocol.getSupplyBalance(user.address, usdcArbiAddress);
  
  console.log("ETH.ARBI supply balance:", utils.formatEther(ethSupplyBalance));
  console.log("USDC.ARBI supply balance:", utils.formatUnits(usdcSupplyBalance, 6));

  // Check contract token balances
  console.log("\n=== Contract Token Balances ===");
  const ethToken = new ethers.Contract(ethArbiAddress, IERC20_ABI, user);
  const usdcToken = new ethers.Contract(usdcArbiAddress, IERC20_ABI, user);
  
  const contractETHBalance = await ethToken.balanceOf(simpleLendingAddress);
  const contractUSDCBalance = await usdcToken.balanceOf(simpleLendingAddress);
  
  console.log("Contract ETH.ARBI balance:", utils.formatEther(contractETHBalance));
  console.log("Contract USDC.ARBI balance:", utils.formatUnits(contractUSDCBalance, 6));

  // Check user's direct ZRC-20 balances (should be 0 since all should be supplied)
  console.log("\n=== User Direct ZRC-20 Balances ===");
  const userETHBalance = await ethToken.balanceOf(user.address);
  const userUSDCBalance = await usdcToken.balanceOf(user.address);
  
  console.log("User ETH.ARBI balance:", utils.formatEther(userETHBalance));
  console.log("User USDC.ARBI balance:", utils.formatUnits(userUSDCBalance, 6));

  // Get account data
  console.log("\n=== User Account Data ===");
  try {
    const accountData = await simpleLendingProtocol.getUserAccountData(user.address);
    console.log("Total Collateral Value:", utils.formatEther(accountData.totalCollateralValue), "USD");
    console.log("Total Debt Value:", utils.formatEther(accountData.totalDebtValue), "USD");
    console.log("Health Factor:", accountData.healthFactor.eq(ethers.constants.MaxUint256) ? "∞" : utils.formatEther(accountData.healthFactor));
  } catch (error: any) {
    console.error("Error getting account data:", error.message);
  }

  console.log("\n=== Balance Check Complete ===");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });