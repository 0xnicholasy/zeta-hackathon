import { ethers } from "hardhat";
import { utils } from "ethers";
import {
  getNetwork,
  getTokenAddress
} from "../../utils/contracts";

async function main() {
  console.log("=== Step-by-step withdrawal debugging ===");

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

  const ZRC20_ABI = [
    "function withdrawGasFee() external view returns (address, uint256)",
    "function balanceOf(address account) external view returns (uint256)",
    "function allowance(address owner, address spender) external view returns (uint256)",
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function withdraw(bytes memory to, uint256 amount) external returns (bool)"
  ];

  const ethArbiToken = new ethers.Contract(ethArbiAddress, ZRC20_ABI, user);

  console.log("\n=== Step 1: Check user supply balance ===");
  const supplyBalance = await simpleLendingProtocol.getSupplyBalance(user.address, ethArbiAddress);
  console.log("User supply balance:", utils.formatEther(supplyBalance));

  if (supplyBalance.eq(0)) {
    console.log("No supply balance - exiting");
    return;
  }

  console.log("\n=== Step 2: Check gas fee requirements ===");
  const [gasZRC20Address, gasFeeAmount] = await ethArbiToken.withdrawGasFee();
  console.log("Gas token address:", gasZRC20Address);
  console.log("Gas fee amount:", utils.formatEther(gasFeeAmount));

  console.log("\n=== Step 3: Check contract token balances ===");
  const contractETHBalance = await ethArbiToken.balanceOf(simpleLendingAddress);
  console.log("Contract ETH.ARBI balance:", utils.formatEther(contractETHBalance));

  const gasToken = new ethers.Contract(gasZRC20Address, ZRC20_ABI, user);
  const contractGasBalance = await gasToken.balanceOf(simpleLendingAddress);
  console.log("Contract gas token balance:", utils.formatEther(contractGasBalance));

  if (contractGasBalance.lt(gasFeeAmount)) {
    console.log("❌ ISSUE: Contract doesn't have enough gas tokens");
    console.log(`Required: ${utils.formatEther(gasFeeAmount)}`);
    console.log(`Available: ${utils.formatEther(contractGasBalance)}`);
    return;
  }

  console.log("\n=== Step 4: Check current gas allowance ===");
  const currentAllowance = await gasToken.allowance(simpleLendingAddress, ethArbiAddress);
  console.log("Current gas allowance:", utils.formatEther(currentAllowance));

  console.log("\n=== Step 5: Check health factor ===");
  const canWithdraw = await simpleLendingProtocol.canWithdraw(user.address, ethArbiAddress, supplyBalance);
  console.log("Can withdraw (health check):", canWithdraw);

  if (!canWithdraw) {
    console.log("❌ ISSUE: Health factor check failed");
    return;
  }

  console.log("\n=== Step 6: Attempt manual approval (if needed) ===");
  if (currentAllowance.lt(gasFeeAmount)) {
    console.log("Need to approve gas fee manually...");
    
    // Try to approve the gas fee from the contract
    // Note: This won't work directly as we can't call approve from an external account for the contract
    console.log("❌ Cannot approve gas fee from external account for contract");
    console.log("The contract must handle this internally in the _withdrawCrossChain function");
  }

  console.log("\n=== Step 7: Test withdrawal with detailed error catching ===");
  try {
    // Call the view functions first to see if they work
    console.log("Testing view functions...");
    
    const accountData = await simpleLendingProtocol.getUserAccountData(user.address);
    console.log("Account data retrieved successfully");
    console.log("Total Collateral:", utils.formatEther(accountData.totalCollateralValue));
    
    // Try to call withdrawCrossChain with staticCall first to see the revert reason
    console.log("Testing with staticCall...");
    try {
      await simpleLendingProtocol.callStatic.withdrawCrossChain(
        ethArbiAddress,
        supplyBalance,
        421614,
        user.address
      );
      console.log("Static call succeeded - withdrawal should work");
    } catch (staticError: any) {
      console.log("Static call failed:", staticError.reason || staticError.message);
      
      // Try to decode the error
      if (staticError.error && staticError.error.data) {
        console.log("Error data:", staticError.error.data);
      }
    }

    // Now try the actual transaction
    console.log("Attempting actual withdrawal...");
    const tx = await simpleLendingProtocol.withdrawCrossChain(
      ethArbiAddress,
      supplyBalance,
      421614,
      user.address,
      { gasLimit: 1000000 }
    );

    console.log("Transaction submitted:", tx.hash);
    const receipt = await tx.wait();
    
    if (receipt.status === 1) {
      console.log("✅ Withdrawal successful!");
    } else {
      console.log("❌ Withdrawal failed in execution");
    }

  } catch (error: any) {
    console.log("❌ Withdrawal failed:", error.reason || error.message);
    
    if (error.error && error.error.data) {
      console.log("Error data:", error.error.data);
    }
  }

  console.log("\n=== Step 8: Final state check ===");
  const finalSupplyBalance = await simpleLendingProtocol.getSupplyBalance(user.address, ethArbiAddress);
  console.log("Final supply balance:", utils.formatEther(finalSupplyBalance));

  const finalUserBalance = await ethArbiToken.balanceOf(user.address);
  console.log("Final user ETH.ARBI balance:", utils.formatEther(finalUserBalance));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });