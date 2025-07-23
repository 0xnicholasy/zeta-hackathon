import { ethers } from "hardhat";
import {
  getNetwork,
  getContractAddress,
} from "../../utils/contracts";

async function main() {
  console.log("🔍 Verifying DepositContract asset support...");

  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const chainId = network.chainId;

  console.log("Network:", getNetwork(chainId).name);
  console.log("Account:", deployer.address);

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

  // Get network config
  const networkConfig = getNetwork(chainId);
  const networkTokens = networkConfig.tokens;

  console.log("\n📋 Asset Support Status:");
  console.log("=".repeat(50));

  for (const [symbol, address] of Object.entries(networkTokens)) {
    // Skip ZRC-20 tokens (with dots in symbol)
    if (symbol.includes('.')) {
      continue;
    }

    try {
      const isSupported = await depositContract.isAssetSupported(address);
      const assetInfo = await depositContract.getAssetInfo(address);
      
      console.log(`${symbol} (${address}):`);
      console.log(`  Supported: ${isSupported ? "✅" : "❌"}`);
      if (isSupported) {
        console.log(`  Decimals: ${assetInfo.decimals}`);
        console.log(`  Native: ${assetInfo.isNative}`);
      }
      console.log("");
    } catch (error: any) {
      console.log(`${symbol} (${address}): ❌ Error - ${error.message}`);
    }
  }

  // Get all supported assets
  try {
    const supportedAssets = await depositContract.getSupportedAssets();
    console.log("📝 All supported assets:");
    for (const asset of supportedAssets) {
      const assetInfo = await depositContract.getAssetInfo(asset);
      console.log(`  ${asset} - Decimals: ${assetInfo.decimals}, Native: ${assetInfo.isNative}`);
    }
  } catch (error: any) {
    console.log("❌ Error getting supported assets:", error.message);
  }

  // Check contract configuration
  try {
    const gatewayAddress = await depositContract.gateway();
    const lendingProtocolAddress = await depositContract.lendingProtocolAddress();
    const zetaChainId = await depositContract.zetaChainId();

    console.log("\n🔧 Contract Configuration:");
    console.log(`Gateway: ${gatewayAddress}`);
    console.log(`Lending Protocol: ${lendingProtocolAddress}`);
    console.log(`ZetaChain ID: ${zetaChainId}`);
  } catch (error: any) {
    console.log("❌ Error getting contract config:", error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });