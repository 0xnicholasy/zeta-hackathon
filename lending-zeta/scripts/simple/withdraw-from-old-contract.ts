import { ethers } from "hardhat";
import { utils } from "ethers";
import {
  getNetwork,
  getTokenAddress
} from "../../utils/contracts";

async function main() {
  console.log("Withdrawing from old contract...");

  const [user] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const chainId = network.chainId;

  // Old contract address (the one before the current one)
  const oldContractAddress = "0xF3F670abba63959358d05251CC6970f58C693ceF";
  const ethArbiAddress = getTokenAddress(chainId, "ETH.ARBI");

  console.log("User:", user.address);
  console.log("Old SimpleLendingProtocol:", oldContractAddress);
  console.log("ETH.ARBI:", ethArbiAddress);

  // Connect to old contract
  const SimpleLendingProtocol = await ethers.getContractFactory("SimpleLendingProtocol");
  const oldContract = SimpleLendingProtocol.attach(oldContractAddress);

  // Check user's supply balance in old contract
  const supplyBalance = await oldContract.getSupplyBalance(user.address, ethArbiAddress);
  console.log("Supply balance in old contract:", utils.formatEther(supplyBalance));

  if (supplyBalance.eq(0)) {
    console.log("No balance to withdraw from old contract");
    return;
  }

  // Try local withdrawal (not cross-chain)
  console.log("Attempting local withdrawal...");
  try {
    const withdrawTx = await oldContract.withdraw(ethArbiAddress, supplyBalance, user.address);
    await withdrawTx.wait();
    console.log("✅ Local withdrawal successful");

    // Check new balance
    const IERC20_ABI = ["function balanceOf(address account) external view returns (uint256)"];
    const ethArbiToken = new ethers.Contract(ethArbiAddress, IERC20_ABI, user);
    const userBalance = await ethArbiToken.balanceOf(user.address);
    console.log("User's new ETH.ARBI balance:", utils.formatEther(userBalance));

  } catch (error: any) {
    console.error("Local withdrawal failed:", error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });