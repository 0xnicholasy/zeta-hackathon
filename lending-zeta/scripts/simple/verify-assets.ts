import { ethers } from "hardhat";
import {
  getNetwork,
  getContractAddress,
  getTokenAddress,
} from "../../utils/contracts";

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

  // Get all expected token addresses from contracts.json
  const expectedTokens = [
    "ETH.ARBI", "USDC.ARBI", "ETH.ETH", "USDC.ETH", 
    "USDC.POL", "POL.POL", "USDC.BSC", "BNB.BSC", 
    "ETH.BASE", "USDC.BASE"
  ];

  const tokenAddresses: Record<string, string> = {};
  console.log("\n📋 Expected ZRC-20 addresses:");
  
  for (const symbol of expectedTokens) {
    try {
      tokenAddresses[symbol] = getTokenAddress(chainId, symbol);
      console.log(`${symbol}: ${tokenAddresses[symbol]}`);
    } catch (error) {
      console.log(`${symbol}: ⚠️ Not found in network configuration`);
    }
  }

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
    let matchFound = false;
    for (const [symbol, address] of Object.entries(tokenAddresses)) {
      if (asset.toLowerCase() === address.toLowerCase()) {
        console.log(`  ✅ This is ${symbol}`);
        matchFound = true;
        break;
      }
    }
    if (!matchFound) {
      console.log("  ⚠️  Unknown asset - might be wrong address");
    }
  }

  // Check a few key assets specifically
  const keyAssets = ["ETH.ARBI", "USDC.ARBI", "ETH.ETH", "USDC.ETH"];
  for (const symbol of keyAssets) {
    if (tokenAddresses[symbol]) {
      console.log(`\n🎯 Checking ${symbol} specifically:`);
      const assetInfo = await simpleLendingProtocol.assets(tokenAddresses[symbol]);
      console.log(`${symbol} address: ${tokenAddresses[symbol]}`);
      console.log(`Is supported: ${assetInfo.isSupported}`);
      console.log(`Price: ${ethers.utils.formatUnits(assetInfo.price, 18)}`);

      if (!assetInfo.isSupported) {
        console.log(`❌ ${symbol} is NOT supported - this could be a problem!`);
      } else {
        console.log(`✅ ${symbol} is supported`);
      }
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });