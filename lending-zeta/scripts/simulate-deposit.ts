import { ethers } from "hardhat";
import { utils } from "ethers";
import {
  getNetwork,
  getContractAddress,
} from "../utils/contracts";

async function main() {
  console.log("💰 Simulating user deposit via DepositContract...");

  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const chainId = network.chainId;

  console.log("Connected to:", getNetwork(chainId).name);
  console.log("User account:", deployer.address);

  // Check user's ETH balance
  const userBalance = await ethers.provider.getBalance(deployer.address);
  console.log("User ETH balance:", utils.formatEther(userBalance));

  // Get DepositContract address
  let depositContractAddress: string;
  try {
    depositContractAddress = getContractAddress(chainId, "DepositContract");
  } catch (error) {
    console.error("❌ DepositContract not found for this network");
    console.log("Available networks with DepositContract:");
    console.log("- Arbitrum Sepolia (421614)");
    console.log("- Ethereum Sepolia (11155111)");
    console.log("Current network:", chainId);
    return;
  }

  console.log("DepositContract address:", depositContractAddress);

  // Get contract instance
  const depositContract = await ethers.getContractAt(
    "DepositContract",
    depositContractAddress
  );

  // Define deposit parameters
  const depositAmount = ethers.utils.parseEther("0.001"); // 0.001 ETH
  const onBehalfOf = deployer.address; // User will receive the collateral on ZetaChain

  console.log(`\n📋 Deposit Parameters:`);
  console.log(`Amount: ${utils.formatEther(depositAmount)} ETH`);
  console.log(`On behalf of: ${onBehalfOf}`);

  try {
    // Check if ETH is supported
    const ethAsset = ethers.constants.AddressZero; // ETH represented as address(0)
    const isEthSupported = await depositContract.isAssetSupported(ethAsset);
    console.log(`✅ ETH supported: ${isEthSupported}`);

    if (!isEthSupported) {
      console.log("❌ ETH is not supported on this DepositContract");
      return;
    }

    // Check contract configuration
    const gatewayAddress = await depositContract.gateway();
    const lendingProtocolAddress = await depositContract.lendingProtocolAddress();
    const zetaChainId = await depositContract.zetaChainId();

    console.log(`\n🔧 Contract Configuration:`);
    console.log(`Gateway: ${gatewayAddress}`);
    console.log(`Lending Protocol: ${lendingProtocolAddress}`);
    console.log(`ZetaChain ID: ${zetaChainId}`);

    // Check if user has enough ETH
    if (userBalance.lt(depositAmount)) {
      console.log(`❌ Insufficient ETH balance. Need: ${utils.formatEther(depositAmount)}, Have: ${utils.formatEther(userBalance)}`);
      return;
    }

    // Estimate gas for the deposit
    console.log(`\n⛽ Estimating gas for deposit...`);
    const gasEstimate = await depositContract.estimateGas.depositEth(onBehalfOf, {
      value: depositAmount
    });
    console.log(`Gas estimate: ${gasEstimate.toString()}`); try {
      // Calculate gas cost
      const gasPrice = await ethers.provider.getGasPrice();
      const gasCost = gasEstimate.mul(gasPrice);
      console.log(`Estimated gas cost: ${utils.formatEther(gasCost)} ETH`);

      // Check if user has enough for gas + deposit
      const totalRequired = depositAmount.add(gasCost.mul(2)); // 2x gas for safety
      if (userBalance.lt(totalRequired)) {
        console.log(`⚠️  Warning: Low balance. Total needed: ${utils.formatEther(totalRequired)}`);
      }

    } catch (gasError: any) {
      console.log(`❌ Gas estimation failed: ${gasError.reason || gasError.message}`);

      // Try to understand why gas estimation failed
      if (gasError.reason?.includes("revert")) {
        console.log("🚨 Transaction would revert. Possible issues:");
        console.log("1. ETH not supported in DepositContract");
        console.log("2. Gateway configuration incorrect");
        console.log("3. Lending protocol address wrong");
        console.log("4. ZetaChain connectivity issues");
      }
      return;
    }

    // Simulate the deposit (dry run)
    console.log(`\n🧪 Simulating deposit transaction...`);
    console.log("Note: This is a simulation. Set DRY_RUN=false to execute real transaction.");

    const DRY_RUN = process.env.DRY_RUN !== "false";

    if (DRY_RUN) {
      console.log("🔍 DRY RUN MODE - No actual transaction sent");
      console.log("The transaction would:");
      console.log(`1. Send ${utils.formatEther(depositAmount)} ETH to DepositContract`);
      console.log(`2. DepositContract calls ZetaChain Gateway`);
      console.log(`3. Gateway converts ETH to ZRC-20 ETH on ZetaChain`);
      console.log(`4. ZRC-20 ETH gets supplied as collateral to SimpleLendingProtocol`);
      console.log(`5. User gets ${utils.formatEther(depositAmount)} ZRC-20 ETH collateral balance`);

      console.log("\n🚀 To execute real transaction, run:");
      console.log(`DRY_RUN=false hh run scripts/simulate-deposit.ts --network ${getNetwork(chainId).name}`);
    } else {
      console.log("🚀 Executing real deposit transaction...");

      const tx = await depositContract.depositEth(onBehalfOf, {
        value: depositAmount,
        gasLimit: gasEstimate.mul(120).div(100) // 20% buffer
      });

      console.log(`📄 Transaction hash: ${tx.hash}`);
      console.log("⏳ Waiting for confirmation...");

      const receipt = await tx.wait();
      console.log(`✅ Transaction confirmed in block: ${receipt.blockNumber}`);
      console.log(`⛽ Gas used: ${receipt.gasUsed.toString()}`);

      // Check for events
      if (receipt.events && receipt.events.length > 0) {
        console.log("\n📋 Transaction Events:");
        for (const event of receipt.events) {
          console.log(`- ${event.event}: ${JSON.stringify(event.args)}`);
        }
      }

      console.log("\n🎯 Cross-chain transaction initiated!");
      console.log("Check ZetaChain explorer for the cross-chain transaction status:");
      console.log(`https://athens.explorer.zetachain.com/`);
    }

  } catch (error: any) {
    console.error("❌ Deposit simulation failed:", error.reason || error.message);

    if (error.code === "UNPREDICTABLE_GAS_LIMIT") {
      console.log("🚨 Transaction would fail. Common causes:");
      console.log("1. DepositContract not properly configured");
      console.log("2. Gateway address incorrect");
      console.log("3. Lending protocol not deployed on ZetaChain");
      console.log("4. Asset not supported");
    }
  }

  console.log("\n📊 Current Status Summary:");
  console.log(`Network: ${getNetwork(chainId).name}`);
  console.log(`DepositContract: ${depositContractAddress}`);
  console.log(`User: ${deployer.address}`);
  console.log(`ETH Balance: ${utils.formatEther(userBalance)}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });