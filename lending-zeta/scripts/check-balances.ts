import { ethers } from "hardhat";
import { getTokenAddress } from "../utils/contracts";

async function main() {
  const [user] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const chainId = network.chainId;
  
  console.log("Checking user supply balances...");
  console.log("User:", user.address);
  console.log("Chain ID:", chainId);
  
  // Get contract addresses
  const contractsJson = require("../contracts.json");
  const simpleLendingAddress = contractsJson.networks[chainId.toString()].contracts.SimpleLendingProtocol;
  const ethArbiAddress = getTokenAddress(chainId, "ETH.ARBI");
  const usdcArbiAddress = getTokenAddress(chainId, "USDC.ARBI");
  
  console.log("SimpleLendingProtocol:", simpleLendingAddress);
  console.log("ETH.ARBI:", ethArbiAddress);
  console.log("USDC.ARBI:", usdcArbiAddress);
  
  // Connect to contract
  const SimpleLendingProtocol = await ethers.getContractFactory("SimpleLendingProtocol");
  const contract = SimpleLendingProtocol.attach(simpleLendingAddress);
  
  // Check supply balances
  const ethSupply = await contract.userSupplies(user.address, ethArbiAddress);
  const usdcSupply = await contract.userSupplies(user.address, usdcArbiAddress);
  
  console.log("\n=== User Supply Balances ===");
  console.log("ETH.ARBI supply:", ethers.utils.formatEther(ethSupply));
  console.log("USDC.ARBI supply:", ethers.utils.formatUnits(usdcSupply, 6));
  
  // Check borrow balances too
  const ethBorrow = await contract.userBorrows(user.address, ethArbiAddress);
  const usdcBorrow = await contract.userBorrows(user.address, usdcArbiAddress);
  
  console.log("\n=== User Borrow Balances ===");
  console.log("ETH.ARBI borrow:", ethers.utils.formatEther(ethBorrow));
  console.log("USDC.ARBI borrow:", ethers.utils.formatUnits(usdcBorrow, 6));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });