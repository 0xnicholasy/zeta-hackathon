import { ethers } from "hardhat";
import {
  getNetwork,
  getTokenAddress,
} from "../../utils/contracts";
import { DeploymentManager } from "../utils/deployment-utils";

async function main() {
  console.log("Checking MockPriceOracle asset prices...");

  const [_deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const chainId = network.chainId;

  // Initialize deployment manager
  const deploymentManager = new DeploymentManager(BigInt(chainId));

  console.log("Network:", getNetwork(chainId).name);
  console.log("Chain ID:", chainId);

  // Ensure we're on ZetaChain
  if (chainId !== 7001 && chainId !== 7000) {
    throw new Error("This script should only be run on ZetaChain networks (7001 for testnet, 7000 for mainnet)");
  }

  // Get existing price oracle from deployment
  let priceOracle;
  
  try {
    priceOracle = await deploymentManager.getContractInstance("MockPriceOracle");
    console.log("Found MockPriceOracle at:", priceOracle.address);
  } catch (error) {
    console.error("❌ MockPriceOracle not found in deployment. Run deployment script first.")
    console.error("Error:", error);
    process.exit(1);
  }

  // Define supported assets
  const assets = [
    { symbol: "ETH.ARBI", chainId: 421614 },
    { symbol: "USDC.ARBI", chainId: 421614 },
    { symbol: "ETH.ETH", chainId: 11155111 },
    { symbol: "USDC.ETH", chainId: 11155111 }
  ];

  console.log("\n=== Current Asset Prices in Oracle ===");
  console.log("Oracle Address:", priceOracle.address);
  console.log("");

  for (const asset of assets) {
    try {
      const tokenAddress = getTokenAddress(chainId, asset.symbol);

      console.log(`${asset.symbol}:`);
      console.log(`  Token Address: ${tokenAddress}`);
      
      // Get price from oracle
      const price = await priceOracle.getPrice(tokenAddress);
      const priceFormatted = ethers.utils.formatEther(price);
      
      console.log(`  Current Price: $${priceFormatted}`);
      console.log("");

    } catch (error) {
      console.log(`❌ Error checking price for ${asset.symbol}:`);
      console.log(`   ${error}`);
      console.log("");
    }
  }

  console.log("✅ Price check completed");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });