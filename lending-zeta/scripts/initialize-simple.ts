import { utils } from "ethers";
import { ethers } from "hardhat";
import {
  getNetwork,
  getContractAddress,
  getTokenAddress,
  printDeploymentSummary
} from "../utils/contracts";

async function main() {
  console.log("Starting simple protocol initialization...");

  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const chainId = network.chainId;

  console.log("Initializing with account:", deployer.address);
  console.log("Network:", getNetwork(chainId).name);

  // Get contract addresses from centralized config
  const simplePriceOracleAddress = getContractAddress(chainId, "SimplePriceOracle");
  const simpleLendingProtocolAddress = getContractAddress(chainId, "SimpleLendingProtocol");

  console.log("SimplePriceOracle:", simplePriceOracleAddress);
  console.log("SimpleLendingProtocol:", simpleLendingProtocolAddress);

  // Get contract instances
  const simplePriceOracle = await ethers.getContractAt(
    "SimplePriceOracle",
    simplePriceOracleAddress
  );
  const simpleLendingProtocol = await ethers.getContractAt(
    "SimpleLendingProtocol",
    simpleLendingProtocolAddress
  );

  // Get all ZRC-20 token addresses from centralized config
  const ethArbiAddress = getTokenAddress(chainId, "ETH.ARBI");
  const usdcArbiAddress = getTokenAddress(chainId, "USDC.ARBI");
  const ethEthAddress = getTokenAddress(chainId, "ETH.ETH");
  const usdcEthAddress = getTokenAddress(chainId, "USDC.ETH");

  console.log("ETH.ARBI address:", ethArbiAddress);
  console.log("USDC.ARBI address:", usdcArbiAddress);
  console.log("ETH.ETH address:", ethEthAddress);
  console.log("USDC.ETH address:", usdcEthAddress);

  console.log("\n=== Setting up Simple Price Oracle ===");

  // Set prices (example prices in USD)
  const prices = {
    [ethArbiAddress]: 2000, // ETH.ARBI = $2000
    [usdcArbiAddress]: 1,   // USDC.ARBI = $1
    [ethEthAddress]: 2000,  // ETH.ETH = $2000
    [usdcEthAddress]: 1,    // USDC.ETH = $1
  };

  // Set prices in SimplePriceOracle
  console.log("Setting prices in SimplePriceOracle...");
  for (const [asset, price] of Object.entries(prices)) {
    await simplePriceOracle.setPrice(asset, price);
    console.log(`Set ${asset} price to $${price}`);
  }

  console.log("\n=== Setting up Simple Lending Protocol ===");

  // Add all supported assets to simple lending protocol
  const assets = [
    { symbol: "ETH.ARBI", address: ethArbiAddress, price: 2000 },
    { symbol: "USDC.ARBI", address: usdcArbiAddress, price: 1 },
    { symbol: "ETH.ETH", address: ethEthAddress, price: 2000 },
    { symbol: "USDC.ETH", address: usdcEthAddress, price: 1 }
  ];

  for (const asset of assets) {
    console.log(`Adding ${asset.symbol} to simple lending protocol...`);
    await simpleLendingProtocol.addAsset(asset.address, asset.price);
    console.log(`${asset.symbol} added successfully`);
  }

  console.log("\n=== Simple Initialization Complete ===");
  console.log("Simple protocol is ready for use!");

  // Verify setup
  console.log("\n=== Verification ===");
  console.log("Simple Lending Protocol supported assets count:");
  const simpleAssetsCount =
    await simpleLendingProtocol.getSupportedAssetsCount();
  console.log("Assets count:", simpleAssetsCount.toString());

  for (let i = 0; i < Number(simpleAssetsCount); i++) {
    const asset = await simpleLendingProtocol.getSupportedAsset(i);
    const assetInfo = await simpleLendingProtocol.assets(asset);
    
    // Map address to symbol
    let assetSymbol = "Unknown";
    if (asset === ethArbiAddress) assetSymbol = "ETH.ARBI";
    else if (asset === usdcArbiAddress) assetSymbol = "USDC.ARBI";
    else if (asset === ethEthAddress) assetSymbol = "ETH.ETH";
    else if (asset === usdcEthAddress) assetSymbol = "USDC.ETH";
    
    console.log(
      `Asset ${i}: ${asset} (${assetSymbol}) - Supported: ${assetInfo.isSupported}, Price: $${utils.formatUnits(assetInfo.price, 18)}`
    );
  }

  // Print centralized deployment summary
  console.log("\n=== Deployment Summary ===");
  printDeploymentSummary(chainId);

  console.log("\n✅ Simple protocol initialized successfully!");
  console.log("🎯 Cross-chain deposits are now supported from:");
  console.log("   • Arbitrum Sepolia → ETH.ARBI & USDC.ARBI");
  console.log("   • Ethereum Sepolia → ETH.ETH & USDC.ETH");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
