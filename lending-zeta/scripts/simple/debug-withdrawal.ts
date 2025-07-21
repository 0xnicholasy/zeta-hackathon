import { ethers } from "hardhat";
import { utils } from "ethers";
import {
  getNetwork,
  getTokenAddress
} from "../../utils/contracts";

async function main() {
  console.log("Debugging withdrawal issue...");

  const [user] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const chainId = network.chainId;
  const networkString = getNetwork(chainId).name;

  console.log("User:", user.address);
  console.log("Network:", networkString);

  // Get contract addresses
  const contractsJson = require("../../contracts.json");
  const simpleLendingAddress = contractsJson.networks[chainId.toString()].contracts.SimpleLendingProtocol;
  const ethArbiAddress = getTokenAddress(chainId, "ETH.ARBI");

  console.log("SimpleLendingProtocol:", simpleLendingAddress);
  console.log("ETH.ARBI:", ethArbiAddress);

  // Connect to contracts
  const SimpleLendingProtocol = await ethers.getContractFactory("SimpleLendingProtocol");
  const simpleLendingProtocol = SimpleLendingProtocol.attach(simpleLendingAddress);

  // Get ZRC-20 contract
  const ZRC20_ABI = [
    "function withdrawGasFee() external view returns (address, uint256)",
    "function balanceOf(address account) external view returns (uint256)",
    "function decimals() external view returns (uint8)"
  ];
  const ethArbiToken = new ethers.Contract(ethArbiAddress, ZRC20_ABI, user);

  console.log("\n=== Debugging ZRC-20 Token ===");
  
  try {
    // Check token balance in the lending protocol
    const protocolBalance = await ethArbiToken.balanceOf(simpleLendingAddress);
    console.log("Protocol ETH.ARBI balance:", utils.formatEther(protocolBalance));

    // Check user supply balance
    const userSupply = await simpleLendingProtocol.getSupplyBalance(user.address, ethArbiAddress);
    console.log("User supply balance:", utils.formatEther(userSupply));

    // Check withdrawal gas fee
    const [gasAddress, gasFee] = await ethArbiToken.withdrawGasFee();
    console.log("Gas fee address:", gasAddress);
    console.log("Gas fee amount:", utils.formatEther(gasFee), "ETH");
    
    // Check if withdrawal amount is greater than gas fee
    const withdrawAmount = userSupply;
    console.log("Withdrawal amount:", utils.formatEther(withdrawAmount));
    console.log("Amount > Gas Fee:", withdrawAmount.gt(gasFee));
    
    if (!withdrawAmount.gt(gasFee)) {
      console.log("❌ ISSUE: Withdrawal amount is not greater than gas fee!");
      console.log("Required minimum:", utils.formatEther(gasFee.add(1)));
      return;
    }

    // Check if user can withdraw (health factor)
    const canWithdraw = await simpleLendingProtocol.canWithdraw(user.address, ethArbiAddress, withdrawAmount);
    console.log("Can withdraw (health check):", canWithdraw);

    if (!canWithdraw) {
      console.log("❌ ISSUE: Health factor check failed!");
      
      // Get health factor details
      const accountData = await simpleLendingProtocol.getUserAccountData(user.address);
      console.log("Total Collateral:", utils.formatEther(accountData.totalCollateralValue));
      console.log("Total Debt:", utils.formatEther(accountData.totalDebtValue));
      console.log("Health Factor:", accountData.healthFactor.eq(ethers.constants.MaxUint256) ? "∞" : utils.formatEther(accountData.healthFactor));
      return;
    }

    // Check if asset is supported
    const assetConfig = await simpleLendingProtocol.getAssetConfig(ethArbiAddress);
    console.log("Asset supported:", assetConfig.isSupported);
    console.log("Asset price:", utils.formatEther(assetConfig.price));

    console.log("\n=== All checks passed, trying withdrawal with manual gas limit ===");
    
    // Try with manual gas limit
    const tx = await simpleLendingProtocol.withdrawCrossChain(
      ethArbiAddress,
      withdrawAmount,
      421614,
      user.address,
      { gasLimit: 500000 }
    );
    
    console.log("Transaction hash:", tx.hash);
    const receipt = await tx.wait();
    console.log("✅ Withdrawal successful! Block:", receipt.blockNumber);

  } catch (error: any) {
    console.error("Error during debugging:", error.message);
    
    // Check if it's a specific revert reason
    if (error.message.includes("0x10bad147")) {
      console.log("❌ This appears to be a ZRC-20 specific error");
      console.log("Possible causes:");
      console.log("1. Insufficient gas fee in the contract");
      console.log("2. ZRC-20 withdraw function failed");
      console.log("3. Invalid destination chain");
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });