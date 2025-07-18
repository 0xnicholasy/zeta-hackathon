import { ethers } from "hardhat";
import { parseEther } from "ethers/src.ts/utils";
import * as fs from "fs";

async function main() {
  console.log("Starting protocol initialization...");

  const [deployer] = await ethers.getSigners();
  console.log("Initializing with account:", deployer.address);

  // Load deployment addresses
  const chainId = (await ethers.provider.getNetwork()).chainId;
  const deploymentFile = `deployments-${chainId}.json`;

  if (!fs.existsSync(deploymentFile)) {
    console.error(`Deployment file ${deploymentFile} not found. Please run deployment first.`);
    process.exit(1);
  }

  const deploymentInfo = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
  console.log("Loaded deployment info from:", deploymentFile);

  // Get contract instances
  const priceOracle = await ethers.getContractAt("PriceOracle", deploymentInfo.contracts.oracles.PriceOracle);
  const mockPriceOracle = await ethers.getContractAt("MockPriceOracle", deploymentInfo.contracts.oracles.MockPriceOracle);
  const simplePriceOracle = await ethers.getContractAt("SimplePriceOracle", deploymentInfo.contracts.oracles.SimplePriceOracle);
  const lendingProtocol = await ethers.getContractAt("LendingProtocol", deploymentInfo.contracts.lending.LendingProtocol);
  const simpleLendingProtocol = await ethers.getContractAt("SimpleLendingProtocol", deploymentInfo.contracts.lending.SimpleLendingProtocol);

  // Token addresses
  const ethArbiAddress = deploymentInfo.contracts.tokens["ETH.ARBI"];
  const usdcArbiAddress = deploymentInfo.contracts.tokens["USDC.ARBI"];
  const usdtBaseAddress = deploymentInfo.contracts.tokens["USDT.BASE"];

  console.log("\n=== Setting up Price Oracles ===");

  // Set prices in all oracles (example prices)
  const prices = {
    [ethArbiAddress]: 2000, // ETH = $2000
    [usdcArbiAddress]: 1,   // USDC = $1
    [usdtBaseAddress]: 1    // USDT = $1
  };

  // Set prices in PriceOracle
  console.log("Setting prices in PriceOracle...");
  for (const [asset, price] of Object.entries(prices)) {
    await priceOracle.setPriceInUSD(asset, price);
    console.log(`Set ${asset} price to $${price}`);
  }

  // Set prices in MockPriceOracle
  console.log("Setting prices in MockPriceOracle...");
  for (const [asset, price] of Object.entries(prices)) {
    await mockPriceOracle.setPriceInUSD(asset, price);
    console.log(`Set ${asset} price to $${price}`);
  }

  // Set prices in SimplePriceOracle
  console.log("Setting prices in SimplePriceOracle...");
  for (const [asset, price] of Object.entries(prices)) {
    await simplePriceOracle.setPrice(asset, price);
    console.log(`Set ${asset} price to $${price}`);
  }

  console.log("\n=== Setting up Main Lending Protocol ===");

  // Add assets to main lending protocol
  const assetConfigs = [
    {
      asset: ethArbiAddress,
      name: "ETH.ARBI",
      collateralFactor: parseEther("0.8"),    // 80%
      liquidationThreshold: parseEther("0.85"), // 85%
      liquidationBonus: parseEther("0.05")     // 5%
    },
    {
      asset: usdcArbiAddress,
      name: "USDC.ARBI",
      collateralFactor: parseEther("0.9"),    // 90%
      liquidationThreshold: parseEther("0.95"), // 95%
      liquidationBonus: parseEther("0.05")     // 5%
    },
    {
      asset: usdtBaseAddress,
      name: "USDT.BASE",
      collateralFactor: parseEther("0.9"),    // 90%
      liquidationThreshold: parseEther("0.95"), // 95%
      liquidationBonus: parseEther("0.05")     // 5%
    }
  ];

  for (const config of assetConfigs) {
    console.log(`Adding ${config.name} to lending protocol...`);
    await lendingProtocol.addAsset(
      config.asset,
      config.collateralFactor,
      config.liquidationThreshold,
      config.liquidationBonus
    );
    console.log(`${config.name} added successfully`);
  }

  console.log("\n=== Setting up Simple Lending Protocol ===");

  // Add assets to simple lending protocol
  for (const [asset, price] of Object.entries(prices)) {
    const assetName = Object.keys(deploymentInfo.contracts.tokens).find(
      key => deploymentInfo.contracts.tokens[key] === asset
    );
    console.log(`Adding ${assetName} to simple lending protocol...`);
    await simpleLendingProtocol.addAsset(asset, price);
    console.log(`${assetName} added successfully`);
  }

  console.log("\n=== Initialization Complete ===");
  console.log("Protocol is ready for use!");

  // Verify setup
  console.log("\n=== Verification ===");
  console.log("Main Lending Protocol supported assets:");
  const supportedAssets = await lendingProtocol.supportedAssets(0);
  console.log("First asset:", supportedAssets);

  console.log("Simple Lending Protocol supported assets count:");
  const simpleAssetsCount = await simpleLendingProtocol.getSupportedAssetsCount();
  console.log("Assets count:", simpleAssetsCount.toString());

  console.log("\nAll systems initialized successfully!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });