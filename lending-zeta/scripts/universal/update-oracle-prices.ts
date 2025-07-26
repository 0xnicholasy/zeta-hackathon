import { ethers } from "hardhat";
import {
  getNetwork,
  getTokenAddress,
} from "../../utils/contracts";
import { DeploymentManager } from "../utils/deployment-utils";

async function main() {
  console.log("Updating MockPriceOracle asset prices...");

  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const chainId = network.chainId;

  // Initialize deployment manager
  const deploymentManager = new DeploymentManager(BigInt(chainId));

  console.log("Network:", getNetwork(chainId).name);
  console.log("Chain ID:", chainId);
  console.log("Deployer:", deployer.address);

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

  // Define asset prices to set
  const assets = [
    { symbol: "ETH.ARBI", chainId: 421614, price: 3000 }, // $3000
    { symbol: "USDC.ARBI", chainId: 421614, price: 1 },   // $1
    { symbol: "ETH.ETH", chainId: 11155111, price: 3000 }, // $3000
    { symbol: "USDC.ETH", chainId: 11155111, price: 1 }    // $1
  ];

  console.log("\n=== Updating Asset Prices in Oracle ===");
  console.log("Oracle Address:", priceOracle.address);
  console.log("");

  for (const asset of assets) {
    try {
      const tokenAddress = getTokenAddress(chainId, asset.symbol);

      console.log(`Updating ${asset.symbol}:`);
      console.log(`  Token Address: ${tokenAddress}`);
      console.log(`  New Price: $${asset.price}`);

      // Get current price first
      try {
        const currentPrice = await priceOracle.getPrice(tokenAddress);
        const currentPriceFormatted = ethers.utils.formatEther(currentPrice);
        console.log(`  Current Price: $${currentPriceFormatted}`);
      } catch (error) {
        console.log(`  Current Price: Not set or error reading`);
      }

      // Convert price to 18 decimals for oracle (e.g., $3000 -> 3000 * 1e18)
      const priceInWei = ethers.utils.parseEther(asset.price.toString());
      
      // Set the new price
      const tx = await priceOracle.setPrice(tokenAddress, priceInWei);
      await tx.wait();

      // Verify the price was set correctly
      const storedPrice = await priceOracle.getPrice(tokenAddress);
      const storedPriceFormatted = ethers.utils.formatEther(storedPrice);
      
      if (storedPriceFormatted === asset.price.toString()) {
        console.log(`  ✅ Successfully updated to $${storedPriceFormatted}`);
      } else {
        console.log(`  ⚠️  Warning: Expected $${asset.price}, but got $${storedPriceFormatted}`);
      }
      
      console.log(`  Transaction: ${tx.hash}`);
      console.log("");

    } catch (error) {
      console.log(`❌ Error updating price for ${asset.symbol}:`);
      console.log(`   ${error}`);
      console.log("");
    }
  }

  console.log("✅ Price update completed");
  console.log("\nRun the following command to verify updated prices:");
  console.log("npx hardhat run scripts/universal/check-oracle-prices.ts --network zeta-testnet");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });