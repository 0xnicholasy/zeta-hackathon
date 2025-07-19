import { ethers } from "hardhat";
import {
  getNetwork,
  getContractAddress,
  getTokenAddress,
} from "../utils/contracts";

async function main() {
  console.log("🔍 Verifying SimpleLendingProtocol assets...");

  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const chainId = network.chainId;

  console.log("Network:", getNetwork(chainId).name);
  console.log("Account:", deployer.address);

  // Get contract
  const simpleLendingProtocolAddress = getContractAddress(chainId, "SimpleLendingProtocol");
  const simpleLendingProtocol = await ethers.getContractAt(
    "SimpleLendingProtocol",
    simpleLendingProtocolAddress
  );

  console.log("SimpleLendingProtocol:", simpleLendingProtocolAddress);

  // Get expected token addresses
  const ethArbiAddress = getTokenAddress(chainId, "ETH.ARBI");
  const usdcArbiAddress = getTokenAddress(chainId, "USDC.ARBI");
  const ethEthAddress = getTokenAddress(chainId, "ETH.ETH");
  const usdcEthAddress = getTokenAddress(chainId, "USDC.ETH");

  console.log("\n📋 Expected ZRC-20 addresses:");
  console.log("ETH.ARBI:", ethArbiAddress);
  console.log("USDC.ARBI:", usdcArbiAddress);
  console.log("ETH.ETH:", ethEthAddress);
  console.log("USDC.ETH:", usdcEthAddress);

  // Check current assets
  console.log("\n🔍 Current assets in SimpleLendingProtocol:");
  const assetsCount = await simpleLendingProtocol.getSupportedAssetsCount();
  console.log("Assets count:", assetsCount.toString());

  if (Number(assetsCount) === 0) {
    console.log("❌ No assets found! Need to run initialization.");
    return;
  }

  for (let i = 0; i < Number(assetsCount); i++) {
    const asset = await simpleLendingProtocol.getSupportedAsset(i);
    const assetInfo = await simpleLendingProtocol.assets(asset);
    
    console.log(`\nAsset ${i}: ${asset}`);
    console.log(`  Supported: ${assetInfo.isSupported}`);
    console.log(`  Price: $${ethers.utils.formatUnits(assetInfo.price, 18)}`);
    
    // Check if it matches expected addresses
    if (asset.toLowerCase() === ethArbiAddress.toLowerCase()) {
      console.log("  ✅ This is ETH.ARBI");
    } else if (asset.toLowerCase() === usdcArbiAddress.toLowerCase()) {
      console.log("  ✅ This is USDC.ARBI");
    } else if (asset.toLowerCase() === ethEthAddress.toLowerCase()) {
      console.log("  ✅ This is ETH.ETH");
    } else if (asset.toLowerCase() === usdcEthAddress.toLowerCase()) {
      console.log("  ✅ This is USDC.ETH");
    } else {
      console.log("  ⚠️  Unknown asset - might be wrong address");
    }
  }

  // Specifically check ETH.ARBI (the one failing)
  console.log("\n🎯 Checking ETH.ARBI specifically:");
  const ethArbiInfo = await simpleLendingProtocol.assets(ethArbiAddress);
  console.log("ETH.ARBI address:", ethArbiAddress);
  console.log("Is supported:", ethArbiInfo.isSupported);
  console.log("Price:", ethers.utils.formatUnits(ethArbiInfo.price, 18));

  if (!ethArbiInfo.isSupported) {
    console.log("❌ ETH.ARBI is NOT supported - this is the problem!");
    console.log("🔧 Run: npx hardhat run scripts/initialize-simple.ts --network zeta_testnet");
  } else {
    console.log("✅ ETH.ARBI is supported - something else is wrong");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });