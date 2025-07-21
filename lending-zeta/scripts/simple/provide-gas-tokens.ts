import { ethers } from "hardhat";
import { utils } from "ethers";
import {
  getNetwork,
  getTokenAddress
} from "../../utils/contracts";

async function main() {
  console.log("Providing gas tokens to user for testing...");

  const [user] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const chainId = network.chainId;

  const contractsJson = require("../../contracts.json");
  const simpleLendingAddress = contractsJson.networks[chainId.toString()].contracts.SimpleLendingProtocol;
  const ethArbiAddress = getTokenAddress(chainId, "ETH.ARBI");

  console.log("User:", user.address);
  console.log("SimpleLendingProtocol:", simpleLendingAddress);
  console.log("ETH.ARBI:", ethArbiAddress);

  // Connect to contracts
  const SimpleLendingProtocol = await ethers.getContractFactory("SimpleLendingProtocol");
  const simpleLendingProtocol = SimpleLendingProtocol.attach(simpleLendingAddress);

  // Get some ETH.ARBI from the contract by doing a local withdrawal of a small amount
  // This will give the user some gas tokens to use for USDC withdrawals
  try {
    const userSupply = await simpleLendingProtocol.getSupplyBalance(user.address, ethArbiAddress);
    console.log("User ETH.ARBI supply:", utils.formatEther(userSupply));

    if (userSupply.gt(0)) {
      // Withdraw a small amount locally to get gas tokens
      const smallAmount = ethers.utils.parseEther("0.0005"); // 0.0005 ETH
      
      if (userSupply.gte(smallAmount)) {
        console.log("Withdrawing small amount locally to get gas tokens...");
        const withdrawTx = await simpleLendingProtocol.withdraw(ethArbiAddress, smallAmount, user.address);
        await withdrawTx.wait();
        console.log("✅ Local withdrawal completed");

        // Check user's new ETH.ARBI balance
        const IERC20_ABI = ["function balanceOf(address account) external view returns (uint256)"];
        const ethArbiToken = new ethers.Contract(ethArbiAddress, IERC20_ABI, user);
        const userBalance = await ethArbiToken.balanceOf(user.address);
        
        console.log("User's new ETH.ARBI balance:", utils.formatEther(userBalance));
        console.log("This can be used as gas tokens for USDC.ARBI withdrawals");
      } else {
        console.log("❌ Not enough supply balance to withdraw gas tokens");
      }
    } else {
      console.log("❌ No ETH.ARBI supply to withdraw from");
    }
  } catch (error: any) {
    console.error("Error:", error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });