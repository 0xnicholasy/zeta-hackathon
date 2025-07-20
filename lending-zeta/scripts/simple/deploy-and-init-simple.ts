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

  // Get all ZRC-20 token addresses from centralized config
  const ethArbiAddress = getTokenAddress(chainId, "ETH.ARBI");
  const usdcArbiAddress = getTokenAddress(chainId, "USDC.ARBI");
  const ethEthAddress = getTokenAddress(chainId, "ETH.ETH");
  const usdcEthAddress = getTokenAddress(chainId, "USDC.ETH");

  console.log("ETH.ARBI address:", ethArbiAddress);
  console.log("USDC.ARBI address:", usdcArbiAddress);
  console.log("ETH.ETH address:", ethEthAddress);
  console.log("USDC.ETH address:", usdcEthAddress);

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

  console.log("\nRun the following commands to verify contracts on explorer:");
  console.log(`npx hardhat verify --network ${networkString} "${simpleLendingProtocol.address}" "${deployer.address}" "${deployer.address}"`);

  console.log("\n✅ Simple protocol deployed and initialized successfully!");
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