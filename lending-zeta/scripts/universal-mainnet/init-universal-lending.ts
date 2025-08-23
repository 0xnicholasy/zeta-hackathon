import { ethers } from "hardhat";

// Mainnet ZRC-20 assets from ZetaChain API - Simplified to ETH, ARB, SOL mainnet only
const mainnetAssets = [
  // Ethereum Mainnet
  { symbol: "ETH.ETH", chainId: 1, address: "0xd97B1de3619ed2c6BEb3860147E30cA8A7dC9891", price: 4700 }, // $4700
  { symbol: "USDC.ETH", chainId: 1, address: "0x0cbe0dF132a6c6B4a2974Fa1b7Fb953CF0Cc798a", price: 1 }, // $1
  // Arbitrum One
  { symbol: "ETH.ARB", chainId: 42161, address: "0xA614Aebf7924A3Eb4D066aDCA5595E4980407f1d", price: 4700 }, // $4700
  { symbol: "USDC.ARB", chainId: 42161, address: "0x0327f0660525b15Cdb8f1f5FBF0dD7Cd5Ba182aD", price: 1 }, // $1
  { symbol: "USDT.ARB", chainId: 42161, address: "0x0ca762FA958194795320635c11fF0C45C6412958", price: 1 }, // $1
  // Solana Mainnet
  { symbol: "SOL.SOL", chainId: 900, address: "0x4bC32034caCcc9B7e02536945eDbC286bACbA073", price: 200 }, // $200
  { symbol: "USDC.SOL", chainId: 900, address: "0x8344d6f84d26f998fa070BbEA6D2E15E359e2641", price: 1 } // $1
];

async function main() {
  console.log("Starting UniversalLendingProtocol mainnet initialization...");

  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const chainId = Number(network.chainId);

  console.log("Initializing with account:", deployer.address);
  console.log("Chain ID:", chainId);

  // Ensure we're on ZetaChain mainnet only
  if (chainId !== 7000) {
    throw new Error("This script should only be run on ZetaChain mainnet (chain ID 7000)");
  }

  // Get deployed contracts from mainnet-contract-address.json
  const fs = require('fs');
  const path = require('path');
  
  const deploymentInfoPath = path.join(__dirname, 'mainnet-contract-address.json');
  
  if (!fs.existsSync(deploymentInfoPath)) {
    throw new Error("mainnet-contract-address.json not found. Please deploy contracts first using deploy-universal-lending.ts");
  }
  
  const deploymentInfo = JSON.parse(fs.readFileSync(deploymentInfoPath, 'utf8'));
  
  const priceOracle = await ethers.getContractAt("MockPriceOracle", deploymentInfo.contracts.MockPriceOracle);
  const universalLendingProtocol = await ethers.getContractAt("UniversalLendingProtocol", deploymentInfo.contracts.UniversalLendingProtocol);

  console.log("Found UniversalLendingProtocol at:", universalLendingProtocol.address);
  console.log("Found MockPriceOracle at:", priceOracle.address);

  // Set prices for supported mainnet assets in price oracle
  console.log("\n=== Setting Mainnet Asset Prices in Oracle ===");

  for (const asset of mainnetAssets) {
    try {
      console.log(`Setting price for ${asset.symbol} (${asset.address}): $${asset.price}`);

      // Convert price to 18 decimals for oracle (e.g., $3000 -> 3000 * 1e18)
      const priceInWei = ethers.utils.parseEther(asset.price.toString());
      await priceOracle.setPrice(asset.address, priceInWei);

      // Verify the price was set correctly
      const storedPrice = await priceOracle.getPrice(asset.address);
      const storedPriceFormatted = ethers.utils.formatEther(storedPrice);
      console.log(`✅ Set price for ${asset.symbol}: $${storedPriceFormatted}`);
    } catch (error) {
      console.log(`⚠️  Warning: Could not set price for ${asset.symbol} - ${error}`);
    }
  }

  // Add supported ZRC-20 assets from centralized configuration  
  console.log("\n=== Adding Supported Assets to Universal Protocol ===");

  // Set allowed source chains for cross-chain operations (simplified to ETH, ARB, SOL)
  const allowedChains = [
    { chainId: 1, name: "Ethereum Mainnet" },
    { chainId: 42161, name: "Arbitrum One" },
    { chainId: 900, name: "Solana Mainnet" }
  ];

  console.log("Setting allowed source chains...");
  for (const chain of allowedChains) {
    try {
      await universalLendingProtocol.setAllowedSourceChain(chain.chainId, true);
      console.log(`✅ Allowed cross-chain operations from ${chain.name} (${chain.chainId})`);
    } catch (error) {
      console.log(`⚠️  Warning: Could not set allowed chain ${chain.chainId}: ${error}`);
    }
  }

  for (const asset of mainnetAssets) {
    try {
      console.log(`Adding ${asset.symbol} (${asset.address})...`);

      // Add asset with proper parameters for UniversalLendingProtocol
      // Higher collateral factors for more stable assets
      let collateralFactor, liquidationThreshold;
      
      if (asset.symbol.includes("USDC") || asset.symbol.includes("USDT")) {
        // Stablecoins: higher collateral factor
        collateralFactor = ethers.utils.parseEther("0.9"); // 90%
        liquidationThreshold = ethers.utils.parseEther("0.92"); // 92%
      } else if (asset.symbol.includes("ETH") || asset.symbol.includes("BTC")) {
        // Major assets: medium collateral factor
        collateralFactor = ethers.utils.parseEther("0.8"); // 80%
        liquidationThreshold = ethers.utils.parseEther("0.85"); // 85%
      } else {
        // Other assets: lower collateral factor
        collateralFactor = ethers.utils.parseEther("0.7"); // 70%
        liquidationThreshold = ethers.utils.parseEther("0.75"); // 75%
      }

      await universalLendingProtocol["addAsset(address,uint256,uint256,uint256)"](
        asset.address,
        collateralFactor,
        liquidationThreshold,
        ethers.utils.parseEther("0.05")  // 5% liquidation bonus
      );

      // Map ZRC-20 asset to its source chain and symbol
      await universalLendingProtocol.mapZRC20Asset(
        asset.address,
        asset.chainId,
        asset.symbol
      );

      console.log(`✅ Added ${asset.symbol} as supported lending asset`);

    } catch (error) {
      console.log(`⚠️  Warning: Could not add ${asset.symbol} - ${error}`);
    }
  }

  console.log("\n=== Mainnet Initialization Configuration Summary ===");
  console.log("UniversalLendingProtocol:", universalLendingProtocol.address);
  console.log("MockPriceOracle:", priceOracle.address);
  console.log(`Configured ${mainnetAssets.length} mainnet assets and ${allowedChains.length} allowed chains`);
  console.log("Network: ZetaChain Mainnet (7000)");

  console.log("\n✅ UniversalLendingProtocol mainnet initialization completed successfully!");
  console.log("\nNext steps:");
  console.log("1. Deploy DepositContracts on external mainnet chains:");
  console.log("   npx hardhat run scripts/deposit-contract/deploy-deposit-contracts.ts universal --network ethereum");
  console.log("   npx hardhat run scripts/deposit-contract/deploy-deposit-contracts.ts universal --network arbitrum");
  console.log("   npx hardhat run scripts/deposit-contract/deploy-deposit-contracts.ts universal --network polygon");
  console.log("   npx hardhat run scripts/deposit-contract/deploy-deposit-contracts.ts universal --network bsc");
  console.log("   npx hardhat run scripts/deposit-contract/deploy-deposit-contracts.ts universal --network base");
  console.log(`2. Lending protocol address for external configs: ${universalLendingProtocol.address}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });