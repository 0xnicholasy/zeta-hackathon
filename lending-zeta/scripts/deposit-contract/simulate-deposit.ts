import { ethers } from "hardhat";
import { utils } from "ethers";
import {
  getNetwork,
  getContractAddress,
} from "../../utils/contracts";

async function main() {
  console.log("💰 Executing user deposit via DepositContract...");

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
  let lendingProtocolAddress: string;
  lendingProtocolAddress = await depositContract.lendingProtocolAddress();
  console.log("Lending protocol address:", lendingProtocolAddress);

  // Define deposit parameters
  const ethDepositAmount = ethers.utils.parseEther("0.001"); // 0.001 ETH
  const usdcDepositAmount = ethers.utils.parseUnits("0.1", 6); // 0.1 USDC (6 decimals)
  const onBehalfOf = deployer.address; // User will receive the collateral on ZetaChain

  console.log(`\n📋 Deposit Parameters:`);
  console.log(`ETH Amount: ${utils.formatEther(ethDepositAmount)} ETH`);
  console.log(`USDC Amount: ${utils.formatUnits(usdcDepositAmount, 6)} USDC`);
  console.log(`On behalf of: ${onBehalfOf}`);

  try {
    // Check if ETH is supported
    const ethAsset = ethers.constants.AddressZero; // ETH represented as address(0)
    const isEthSupported = await depositContract.isAssetSupported(ethAsset);
    console.log(`✅ ETH supported: ${isEthSupported}`);

    // Get USDC contract address from contracts.json
    let usdcAddress: string = "";
    let isUsdcSupported = false;
    let usdcAvailable = false;
    
    try {
      usdcAddress = getNetwork(chainId).tokens["USDC"].address;
      if (usdcAddress && usdcAddress !== "0x0000000000000000000000000000000000000000") {
        // Check if USDC is supported
        isUsdcSupported = await depositContract.isAssetSupported(usdcAddress);
        usdcAvailable = true;
        console.log(`✅ USDC supported: ${isUsdcSupported}`);
      } else {
        console.log("⚠️  USDC not configured for this network");
      }
    } catch (error) {
      console.log("⚠️  USDC not found in network configuration");
    }

    if (!isEthSupported && (!usdcAvailable || !isUsdcSupported)) {
      console.log("❌ No supported assets found on this DepositContract");
      return;
    }

    // Check contract configuration
    const gatewayAddress = await depositContract.gateway();
    const zetaChainId = await depositContract.zetaChainId();

    console.log(`\n🔧 Contract Configuration:`);
    console.log(`Gateway: ${gatewayAddress}`);
    console.log(`Lending Protocol: ${lendingProtocolAddress}`);
    console.log(`ZetaChain ID: ${zetaChainId}`);

    // Check individual token balances and availability
    let ethCanDeposit = false;
    let usdcCanDeposit = false;
    let usdcContract: any;
    let usdcBalance = ethers.BigNumber.from(0);

    // Check ETH availability
    if (isEthSupported) {
      if (userBalance.gte(ethDepositAmount)) {
        ethCanDeposit = true;
        console.log(`✅ ETH deposit possible: ${utils.formatEther(ethDepositAmount)} ETH`);
      } else {
        console.log(`⚠️  Insufficient ETH balance. Need: ${utils.formatEther(ethDepositAmount)}, Have: ${utils.formatEther(userBalance)}`);
      }
    }

    // Check USDC availability
    if (usdcAvailable && isUsdcSupported) {
      usdcContract = await ethers.getContractAt("IERC20", usdcAddress);
      usdcBalance = await usdcContract.balanceOf(deployer.address);
      console.log(`USDC Balance: ${utils.formatUnits(usdcBalance, 6)} USDC`);

      if (usdcBalance.gte(usdcDepositAmount)) {
        usdcCanDeposit = true;
        console.log(`✅ USDC deposit possible: ${utils.formatUnits(usdcDepositAmount, 6)} USDC`);
      } else {
        console.log(`⚠️  Insufficient USDC balance. Need: ${utils.formatUnits(usdcDepositAmount, 6)}, Have: ${utils.formatUnits(usdcBalance, 6)}`);
      }
    }

    if (!ethCanDeposit && !usdcCanDeposit) {
      console.log("❌ No deposits possible - insufficient balances or unsupported assets");
      return;
    }

    console.log(`\n📊 Deposits to execute:`);
    console.log(`ETH: ${ethCanDeposit ? '✅ Yes' : '❌ No'}`);
    console.log(`USDC: ${usdcCanDeposit ? '✅ Yes' : '❌ No'}`);

    // Gas estimation
    let ethGasEstimate = ethers.BigNumber.from(0);
    let usdcGasEstimate = ethers.BigNumber.from(0);
    let approvalGasEstimate = ethers.BigNumber.from(0);
    let currentAllowance = ethers.BigNumber.from(0);

    if (ethCanDeposit) {
      console.log(`\n⛽ Estimating gas for ETH deposit...`);
      ethGasEstimate = await depositContract.estimateGas.depositEth(onBehalfOf, {
        value: ethDepositAmount
      });
      console.log(`ETH Gas estimate: ${ethGasEstimate.toString()}`);
    }

    if (usdcCanDeposit) {
      console.log(`\n⛽ Estimating gas for USDC deposit...`);

      // Check current USDC allowance
      currentAllowance = await usdcContract.allowance(deployer.address, depositContractAddress);
      console.log(`Current USDC allowance: ${utils.formatUnits(currentAllowance, 6)}`);

      if (currentAllowance.lt(usdcDepositAmount)) {
        approvalGasEstimate = await usdcContract.estimateGas.approve(depositContractAddress, usdcDepositAmount);
        console.log(`USDC Approval gas estimate: ${approvalGasEstimate.toString()}`);
      }

      usdcGasEstimate = await depositContract.estimateGas.depositToken(usdcAddress, usdcDepositAmount, onBehalfOf);
      console.log(`USDC Deposit gas estimate: ${usdcGasEstimate.toString()}`);
    }

    try {
      // Calculate total gas cost
      const gasPrice = await ethers.provider.getGasPrice();
      const totalGasEstimate = ethGasEstimate.add(usdcGasEstimate).add(approvalGasEstimate);
      const totalGasCost = totalGasEstimate.mul(gasPrice);
      console.log(`Estimated total gas cost: ${utils.formatEther(totalGasCost)} ETH`);

      // Check if user has enough for gas + ETH deposit
      if (ethCanDeposit) {
        const totalEthRequired = ethDepositAmount.add(totalGasCost.mul(2)); // 2x gas for safety
        if (userBalance.lt(totalEthRequired)) {
          console.log(`⚠️  Warning: Low ETH balance for ETH deposit. Total needed: ${utils.formatEther(totalEthRequired)}`);
          ethCanDeposit = false; // Disable ETH deposit if insufficient balance for gas
        }
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

    // Execute the deposits
    console.log(`\n🚀 Executing available deposit transactions...`);

    const executedTxs: string[] = [];
    const txReceipts: any[] = [];

    // Execute ETH deposit if possible
    if (ethCanDeposit) {
      console.log("\n📈 Executing ETH deposit...");
      const ethTx = await depositContract.depositEth(onBehalfOf, {
        value: ethDepositAmount,
        gasLimit: ethGasEstimate.mul(120).div(100) // 20% buffer
      });

      console.log(`📄 ETH Transaction hash: ${ethTx.hash}`);
      console.log("⏳ Waiting for ETH confirmation...");

      const ethReceipt = await ethTx.wait();
      console.log(`✅ ETH Transaction confirmed in block: ${ethReceipt.blockNumber}`);
      console.log(`⛽ ETH Gas used: ${ethReceipt.gasUsed.toString()}`);
      
      executedTxs.push(`ETH: ${ethTx.hash}`);
      txReceipts.push({ type: 'ETH', receipt: ethReceipt });
    } else {
      console.log("\n❌ Skipping ETH deposit (not available)");
    }

    // Execute USDC deposit if possible
    if (usdcCanDeposit) {
      console.log("\n💰 Executing USDC deposit...");

      // Approve USDC if needed
      if (currentAllowance.lt(usdcDepositAmount)) {
        console.log("📝 Approving USDC...");
        const approvalTx = await usdcContract.approve(depositContractAddress, usdcDepositAmount, {
          gasLimit: approvalGasEstimate.mul(120).div(100)
        });
        await approvalTx.wait();
        console.log("✅ USDC approved");
      }

      const usdcTx = await depositContract.depositToken(usdcAddress, usdcDepositAmount, onBehalfOf, {
        gasLimit: usdcGasEstimate.mul(120).div(100) // 20% buffer
      });

      console.log(`📄 USDC Transaction hash: ${usdcTx.hash}`);
      console.log("⏳ Waiting for USDC confirmation...");

      const usdcReceipt = await usdcTx.wait();
      console.log(`✅ USDC Transaction confirmed in block: ${usdcReceipt.blockNumber}`);
      console.log(`⛽ USDC Gas used: ${usdcReceipt.gasUsed.toString()}`);
      
      executedTxs.push(`USDC: ${usdcTx.hash}`);
      txReceipts.push({ type: 'USDC', receipt: usdcReceipt });
    } else {
      console.log("\n❌ Skipping USDC deposit (not available)");
    }

    if (executedTxs.length === 0) {
      console.log("\n❌ No deposits were executed");
      return;
    }

    // Check for events in all transactions
    console.log("\n📋 Transaction Events:");
    for (const { type, receipt } of txReceipts) {
      if (receipt.events && receipt.events.length > 0) {
        console.log(`${type} Deposit Events:`);
        for (const event of receipt.events) {
          console.log(`- ${event.event}: ${JSON.stringify(event.args)}`);
        }
      }
    }

    console.log("\n🎯 Cross-chain transactions initiated!");
    console.log("Check ZetaChain explorer for the cross-chain transaction status:");
    console.log(`https://athens.explorer.zetachain.com/`);
    
    for (const tx of executedTxs) {
      const [type, hash] = tx.split(': ');
      console.log(`${type}: https://zetachain-athens.blockpi.network/lcd/v1/public/zeta-chain/crosschain/inboundHashToCctxData/${hash}`);
    }

  } catch (error: any) {
    console.error("❌ Deposit execution failed:", error.reason || error.message);

    if (error.code === "UNPREDICTABLE_GAS_LIMIT") {
      console.log("🚨 Transaction would fail. Common causes:");
      console.log("1. DepositContract not properly configured");
      console.log("2. Gateway address incorrect");
      console.log("3. Lending protocol not deployed on ZetaChain");
      console.log("4. Asset not supported");
    }
  }

  console.log("\n📊 Final Status Summary:");
  console.log(`Network: ${getNetwork(chainId).name}`);
  console.log(`DepositContract: ${depositContractAddress}`);
  console.log(`User: ${deployer.address}`);
  console.log(`ETH Balance: ${utils.formatEther(userBalance)}`);
  
  try {
    if (usdcAvailable && usdcContract) {
      const finalUsdcBalance = await usdcContract.balanceOf(deployer.address);
      console.log(`USDC Balance: ${utils.formatUnits(finalUsdcBalance, 6)}`);
    }
  } catch (error) {
    // Ignore balance check errors
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });