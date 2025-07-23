import { ethers } from "hardhat";
import {
  getNetwork,
  getContractAddress,
} from "../../utils/contracts";

async function main() {
  console.log("➕ Adding supported assets to DepositContract...");

  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const chainId = network.chainId;

  console.log("Network:", getNetwork(chainId).name);
  console.log("Account:", deployer.address);
  console.log("Account balance:", ethers.utils.formatEther(await deployer.getBalance()));

  // Get DepositContract address
  let depositContractAddress: string;
  try {
    depositContractAddress = getContractAddress(chainId, "DepositContract");
  } catch (error) {
    console.error("❌ DepositContract not found for this network");
    return;
  }

  console.log("DepositContract address:", depositContractAddress);

  // Get contract instance
  const depositContract = await ethers.getContractAt(
    "DepositContract",
    depositContractAddress
  );

  // Verify we're the owner
  const owner = await depositContract.owner();
  if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
    console.error(`❌ Not the owner. Owner: ${owner}, Deployer: ${deployer.address}`);
    return;
  }

  console.log("✅ Confirmed as contract owner");

  // Get network config
  const networkConfig = getNetwork(chainId);
  const networkTokens = networkConfig.tokens;

  console.log("\n➕ Adding supported assets...");

  for (const [symbol, address] of Object.entries(networkTokens)) {
    // Skip ZRC-20 tokens (with dots in symbol)
    if (symbol.includes('.')) {
      console.log(`⏭️  Skipping ZRC-20 token: ${symbol}`);
      continue;
    }

    // Check if already supported
    const isAlreadySupported = await depositContract.isAssetSupported(address);
    if (isAlreadySupported) {
      console.log(`✅ ${symbol} already supported`);
      continue;
    }

    const isNative = symbol === "ETH";
    const decimals = symbol === "USDC" ? 6 : 18;

    console.log(`\n📝 Adding ${symbol} (${address}):`);
    console.log(`  Decimals: ${decimals}`);
    console.log(`  Native: ${isNative}`);

    try {
      // Estimate gas first
      const gasEstimate = await depositContract.estimateGas.addSupportedAsset(
        address,
        decimals,
        isNative
      );
      console.log(`  Gas estimate: ${gasEstimate.toString()}`);

      // Execute transaction with gas buffer
      const tx = await depositContract.addSupportedAsset(
        address,
        decimals,
        isNative,
        {
          gasLimit: gasEstimate.mul(120).div(100) // 20% buffer
        }
      );

      console.log(`  Transaction hash: ${tx.hash}`);
      console.log(`  ⏳ Waiting for confirmation...`);

      const receipt = await tx.wait();
      console.log(`  ✅ Confirmed in block: ${receipt.blockNumber}`);
      console.log(`  ⛽ Gas used: ${receipt.gasUsed.toString()}`);

      // Verify the asset was added
      const isSupported = await depositContract.isAssetSupported(address);
      if (isSupported) {
        console.log(`  ✅ ${symbol} successfully added as supported asset`);
      } else {
        console.log(`  ❌ ${symbol} was not added properly`);
      }

    } catch (error: any) {
      console.log(`  ❌ Failed to add ${symbol}: ${error.reason || error.message}`);
      
      // Check if it's already supported error
      if (error.reason?.includes("Asset already supported")) {
        console.log(`  ℹ️  ${symbol} was already supported`);
      }
    }
  }

  console.log("\n🔍 Final verification...");
  
  // Verify all assets
  for (const [symbol, address] of Object.entries(networkTokens)) {
    if (symbol.includes('.')) continue;
    
    const isSupported = await depositContract.isAssetSupported(address);
    const status = isSupported ? "✅" : "❌";
    console.log(`${status} ${symbol} (${address}): ${isSupported}`);
  }

  // Get all supported assets
  const supportedAssets = await depositContract.getSupportedAssets();
  console.log(`\n📊 Total supported assets: ${supportedAssets.length}`);
  
  if (supportedAssets.length > 0) {
    console.log("📝 Supported asset details:");
    for (const asset of supportedAssets) {
      const assetInfo = await depositContract.getAssetInfo(asset);
      const symbol = asset === ethers.constants.AddressZero ? "ETH" : "USDC";
      console.log(`  ${symbol} (${asset}): ${assetInfo.decimals} decimals, native: ${assetInfo.isNative}`);
    }
  }

  console.log("\n✅ Asset addition process completed!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });