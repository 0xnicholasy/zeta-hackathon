import { utils } from "ethers";
import * as fs from "fs";
import { ethers } from "hardhat";

async function main() {
  console.log("Starting simple protocol initialization...");

  const [deployer] = await ethers.getSigners();
  console.log("Initializing with account:", deployer.address);

  // Load deployment addresses
  const chainId = (await ethers.provider.getNetwork()).chainId;
  const deploymentFile = `simple-deployments-${chainId}.json`;

  if (!fs.existsSync(deploymentFile)) {
    console.error(
      `Deployment file ${deploymentFile} not found. Please run simple deployment first.`
    );
    process.exit(1);
  }

  const deploymentInfo = JSON.parse(fs.readFileSync(deploymentFile, "utf8"));
  console.log("Loaded deployment info from:", deploymentFile);

  // Get contract instances
  const simplePriceOracle = await ethers.getContractAt(
    "SimplePriceOracle",
    deploymentInfo.contracts.SimplePriceOracle
  );
  const simpleLendingProtocol = await ethers.getContractAt(
    "SimpleLendingProtocol",
    deploymentInfo.contracts.SimpleLendingProtocol
  );

  // Token addresses
  const ethArbiAddress = deploymentInfo.contracts.tokens["ETH.ARBI"];
  const usdcArbiAddress = deploymentInfo.contracts.tokens["USDC.ARBI"];

  console.log("\n=== Setting up Simple Price Oracle ===");

  // Set prices (example prices in USD)
  const prices = {
    [ethArbiAddress]: 2000, // ETH = $2000
    [usdcArbiAddress]: 1, // USDC = $1
  };

  // Set prices in SimplePriceOracle
  console.log("Setting prices in SimplePriceOracle...");
  for (const [asset, price] of Object.entries(prices)) {
    await simplePriceOracle.setPrice(asset, price);
    console.log(`Set ${asset} price to $${price}`);
  }

  console.log("\n=== Setting up Simple Lending Protocol ===");

  // Add assets to simple lending protocol
  for (const [asset, price] of Object.entries(prices)) {
    const assetName = Object.keys(deploymentInfo.contracts.tokens).find(
      (key) => deploymentInfo.contracts.tokens[key] === asset
    );
    console.log(`Adding ${assetName} to simple lending protocol...`);
    await simpleLendingProtocol.addAsset(asset, price);
    console.log(`${assetName} added successfully`);
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
    console.log(
      `Asset ${i}: ${asset} - Supported: ${assetInfo.isSupported
      }, Price: $${utils.formatUnits(assetInfo.price, 18)}`
    );
  }

  console.log("\nSimple protocol initialized successfully!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
