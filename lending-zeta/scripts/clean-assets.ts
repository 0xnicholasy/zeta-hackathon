import { ethers } from "hardhat";
import {
  getNetwork,
  getContractAddress,
  getTokenAddress,
} from "../utils/contracts";

async function main() {
  console.log("🧹 Cleaning up wrong assets...");

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

  // Get correct addresses
  const ethArbiAddress = getTokenAddress(chainId, "ETH.ARBI");
  const usdcArbiAddress = getTokenAddress(chainId, "USDC.ARBI");
  const ethEthAddress = getTokenAddress(chainId, "ETH.ETH");
  const usdcEthAddress = getTokenAddress(chainId, "USDC.ETH");

  const correctAddresses = [
    ethArbiAddress.toLowerCase(),
    usdcArbiAddress.toLowerCase(),
    ethEthAddress.toLowerCase(),
    usdcEthAddress.toLowerCase()
  ];

  console.log("Correct addresses:", correctAddresses);

  // Check current assets
  const assetsCount = await simpleLendingProtocol.getSupportedAssetsCount();
  console.log("Current assets count:", assetsCount.toString());

  const wrongAssets = [];
  for (let i = 0; i < Number(assetsCount); i++) {
    const asset = await simpleLendingProtocol.getSupportedAsset(i);
    if (!correctAddresses.includes(asset.toLowerCase())) {
      wrongAssets.push(asset);
      console.log(`❌ Wrong asset found: ${asset}`);
    } else {
      console.log(`✅ Correct asset: ${asset}`);
    }
  }

  if (wrongAssets.length === 0) {
    console.log("🎉 No wrong assets found!");
    return;
  }

  // Note: SimpleLendingProtocol doesn't have a removeAsset function
  // We would need to add one or redeploy the contract
  console.log("\n⚠️  Found wrong assets but SimpleLendingProtocol doesn't have removeAsset function");
  console.log("Options:");
  console.log("1. Add a removeAsset function to the contract");
  console.log("2. Deploy a new SimpleLendingProtocol");
  console.log("3. Try to work around it (assets are checked by iteration)");

  // For now, let's just verify the correct assets are there
  console.log("\n🔍 Verifying correct assets are supported:");
  for (const addr of [ethArbiAddress, usdcArbiAddress, ethEthAddress, usdcEthAddress]) {
    const info = await simpleLendingProtocol.assets(addr);
    console.log(`${addr}: supported=${info.isSupported}, price=$${ethers.utils.formatUnits(info.price, 18)}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });