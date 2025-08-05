import { ethers } from "hardhat";
import { utils } from "ethers";
import {
  getNetwork,
  getTokenAddress,
  printDeploymentSummary
} from "../../utils/contracts";
import { DeploymentManager } from "../utils/deployment-utils";

async function main() {
  console.log("Starting simple deployment and initialization...");

  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const chainId = network.chainId;
  const networkString = getNetwork(chainId).name;

  console.log("Deploying with account:", deployer.address);
  console.log("Network:", networkString);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.utils.formatEther(balance));

  // Initialize deployment manager
  const deploymentManager = new DeploymentManager(BigInt(chainId));

  // Deploy Simple Lending Protocol
  console.log("\n=== Deploying Simple Lending Protocol ===");
  const zetaTestnetGatewayAddress = "0x6c533f7fe93fae114d0954697069df33c9b74fd7";

  const SimpleLendingProtocol = await ethers.getContractFactory("SimpleLendingProtocol");
  const simpleLendingProtocol = await SimpleLendingProtocol.deploy(zetaTestnetGatewayAddress, deployer.address);
  await simpleLendingProtocol.deployed();
  console.log("SimpleLendingProtocol deployed to:", simpleLendingProtocol.address);

  console.log("\n=== Simple Deployment Summary ===");
  console.log(`SimpleLendingProtocol: ${simpleLendingProtocol.address}`);

  // Note: saveDeployment is deprecated, only using updateContractsJson now

  // Update contracts.json with new SimpleLendingProtocol address using DeploymentManager
  await deploymentManager.updateContractsJson(
    "SimpleLendingProtocol",
    simpleLendingProtocol.address,
    deployer.address
  );

  console.log("\n=== Starting Protocol Initialization ===");

  console.log("\n=== Setting up Simple Lending Protocol ===");

  // Get all ZRC-20 token addresses from centralized config and build assets array
  const assets = [
    { symbol: "ETH.ARBI", price: 3000 },
    { symbol: "USDC.ARBI", price: 1 },
    { symbol: "ETH.ETH", price: 3000 },
    { symbol: "USDC.ETH", price: 1 },
    { symbol: "USDC.POL", price: 1 },
    { symbol: "POL.POL", price: 0.5 },
    { symbol: "USDC.BSC", price: 1 },
    { symbol: "BNB.BSC", price: 600 },
    { symbol: "ETH.BASE", price: 3000 },
    { symbol: "USDC.BASE", price: 1 }
  ];

  // Get token addresses and log them
  const tokenAddresses: Record<string, string> = {};
  for (const asset of assets) {
    try {
      tokenAddresses[asset.symbol] = getTokenAddress(chainId, asset.symbol);
      console.log(`${asset.symbol} address:`, tokenAddresses[asset.symbol]);
    } catch (error) {
      console.log(`⚠️  ${asset.symbol} not found in network configuration, skipping...`);
    }
  }

  // Filter assets to only include those with valid addresses
  const validAssets = assets.filter(asset => tokenAddresses[asset.symbol]);
  console.log(`\nFound ${validAssets.length} valid assets out of ${assets.length} total`);

  for (const asset of validAssets) {
    console.log(`Adding ${asset.symbol} to simple lending protocol...`);
    await simpleLendingProtocol.addAsset(tokenAddresses[asset.symbol], asset.price);
    console.log(`${asset.symbol} added successfully`);
  }

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
    for (const [symbol, address] of Object.entries(tokenAddresses)) {
      if (asset.toLowerCase() === address.toLowerCase()) {
        assetSymbol = symbol;
        break;
      }
    }

    console.log(
      `Asset ${i}: ${asset} (${assetSymbol}) - Supported: ${assetInfo.isSupported}, Price: $${utils.formatUnits(assetInfo.price, 18)}`
    );
  }

  // Print centralized deployment summary
  console.log("\n=== Deployment Summary ===");
  printDeploymentSummary(chainId);

  console.log("\nRun the following commands to verify contracts on explorer:");
  console.log(`npx hardhat verify --network ${networkString} "${simpleLendingProtocol.address}" "${zetaTestnetGatewayAddress}" "${deployer.address}"`);

  console.log("\n✅ Simple protocol deployed and initialized successfully!");
  console.log("🎯 Cross-chain deposits are now supported from:");
  console.log("   • Arbitrum Sepolia → ETH.ARBI & USDC.ARBI");
  console.log("   • Ethereum Sepolia → ETH.ETH & USDC.ETH");
  console.log("   • Polygon Amoy → USDC.POL & POL.POL");
  console.log("   • BSC Testnet → USDC.BSC & BNB.BSC");
  console.log("   • Base Sepolia → ETH.BASE & USDC.BASE");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });