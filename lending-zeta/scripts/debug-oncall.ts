import { ethers } from "hardhat";
import {
  getNetwork,
  getContractAddress,
  getTokenAddress,
} from "../utils/contracts";

async function main() {
  console.log("🐛 Debugging onCall function...");

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

  // Get ETH.ARBI address
  const ethArbiAddress = getTokenAddress(chainId, "ETH.ARBI");
  console.log("ETH.ARBI address:", ethArbiAddress);

  // Test the internal _supply function through direct supply call
  console.log("\n🧪 Testing direct supply call...");
  
  try {
    // First, get some ETH.ARBI tokens (this will fail but shows us the error)
    console.log("Attempting to call supply directly...");
    
    // Create the message that gateway would send
    const message = ethers.utils.defaultAbiCoder.encode(
      ["string", "address"],
      ["supply", deployer.address]
    );
    
    console.log("Message encoded:", message);
    console.log("Message decoded:", ethers.utils.defaultAbiCoder.decode(["string", "address"], message));
    
    // Test if we can call supply directly (this should work if we have tokens)
    // This will likely fail due to no tokens, but we can see if asset is supported
    
    const tx = await simpleLendingProtocol.supply(ethArbiAddress, 1);
    console.log("✅ Direct supply worked (unexpected!)");
    
  } catch (error: any) {
    console.log("❌ Direct supply failed:", error.message);
    
    if (error.message.includes("Asset not supported")) {
      console.log("🚨 The asset check is failing in _supply function!");
    } else if (error.message.includes("transfer")) {
      console.log("✅ Asset is supported, just no tokens to transfer (expected)");
    } else {
      console.log("🤔 Unexpected error:", error.message);
    }
  }

  // Check the asset again to make sure it's really supported
  console.log("\n🔍 Double-checking asset support...");
  const assetInfo = await simpleLendingProtocol.assets(ethArbiAddress);
  console.log("Asset supported:", assetInfo.isSupported);
  console.log("Asset price:", ethers.utils.formatUnits(assetInfo.price, 18));

  // Check if there are multiple assets with the same address (shouldn't happen)
  const assetsCount = await simpleLendingProtocol.getSupportedAssetsCount();
  console.log("\n📊 All supported assets:");
  for (let i = 0; i < Number(assetsCount); i++) {
    const asset = await simpleLendingProtocol.getSupportedAsset(i);
    console.log(`  ${i}: ${asset} ${asset.toLowerCase() === ethArbiAddress.toLowerCase() ? "← ETH.ARBI" : ""}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });