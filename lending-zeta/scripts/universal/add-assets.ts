import { ethers } from "hardhat";
import { DeploymentManager } from "../utils/deployment-utils";

// Solana asset configurations
const solanaAssets = [
  { 
    symbol: "SOL.SOL", 
    chainId: 0, // Solana chain ID - update based on requirements
    price: 150, // $150 SOL price
    collateralFactor: "0.75", // 75% collateral factor
    liquidationThreshold: "0.80", // 80% liquidation threshold  
    liquidationBonus: "0.05" // 5% liquidation bonus
  },
  { 
    symbol: "USDC.SOL", 
    chainId: 0, // Solana chain ID - update based on requirements
    price: 1, // $1 USDC price
    collateralFactor: "0.90", // 90% collateral factor
    liquidationThreshold: "0.95", // 95% liquidation threshold
    liquidationBonus: "0.03" // 3% liquidation bonus
  }
];

async function main() {
  console.log("Adding Solana assets to UniversalLendingProtocol...");

  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const chainId = network.chainId;

  console.log("Adding assets with account:", deployer.address);
  console.log("Network:", chainId);

  // Ensure we're on ZetaChain
  if (chainId !== 7001 && chainId !== 7000) {
    throw new Error("This script should only be run on ZetaChain networks (7001 for testnet, 7000 for mainnet)");
  }

  // Initialize deployment manager
  const deploymentManager = new DeploymentManager(BigInt(chainId));

  // Get UniversalLendingProtocol contract
  let universalLendingProtocol;
  try {
    universalLendingProtocol = await deploymentManager.getContractInstance("UniversalLendingProtocol");
    console.log("Using UniversalLendingProtocol at:", universalLendingProtocol.address);
  } catch (error) {
    throw new Error(`UniversalLendingProtocol not found. Please deploy it first: ${error}`);
  }

  // Get or deploy price oracle
  let priceOracle;
  try {
    priceOracle = await deploymentManager.getContractInstance("MockPriceOracle");
    console.log("Using MockPriceOracle at:", priceOracle.address);
  } catch (error) {
    throw new Error(`MockPriceOracle not found. Please deploy it first: ${error}`);
  }

  console.log("\n=== Setting Solana Asset Prices in Oracle ===");

  // Set prices for Solana assets in price oracle
  for (const asset of solanaAssets) {
    try {
      const tokenAddress = await deploymentManager.getTokenAddress(asset.symbol);
      console.log(`Setting price for ${asset.symbol} (${tokenAddress}): $${asset.price}`);

      // Convert price to 18 decimals for oracle
      const priceInWei = ethers.utils.parseEther(asset.price.toString());
      await priceOracle.setPrice(tokenAddress, priceInWei);

      console.log(`✅ Set price for ${asset.symbol}: $${asset.price}`);
    } catch (error) {
      console.log(`⚠️  Warning: Could not set price for ${asset.symbol} - ${error}`);
    }
  }

  console.log("\n=== Adding Solana Assets to Universal Protocol ===");

  // Add Solana assets to the lending protocol
  for (const asset of solanaAssets) {
    try {
      const tokenAddress = await deploymentManager.getTokenAddress(asset.symbol);
      console.log(`Adding ${asset.symbol} (${tokenAddress})...`);

      // Check if asset is already supported
      const assetConfig = await universalLendingProtocol.getEnhancedAssetConfig(tokenAddress);
      if (assetConfig.isSupported) {
        console.log(`⚠️ ${asset.symbol} is already supported. Skipping...`);
        continue;
      }

      // Add asset with proper parameters for UniversalLendingProtocol
      const tx = await universalLendingProtocol["addAsset(address,uint256,uint256,uint256)"](
        tokenAddress,
        ethers.utils.parseEther(asset.collateralFactor), // collateral factor
        ethers.utils.parseEther(asset.liquidationThreshold), // liquidation threshold  
        ethers.utils.parseEther(asset.liquidationBonus) // liquidation bonus
      );
      await tx.wait();

      // Map ZRC-20 asset to its source chain and symbol for Solana
      const mapTx = await universalLendingProtocol.mapZRC20Asset(
        tokenAddress,
        asset.chainId,
        asset.symbol
      );
      await mapTx.wait();

      console.log(`✅ Added ${asset.symbol} as supported lending asset`);
      console.log(`   - Collateral Factor: ${asset.collateralFactor}`);
      console.log(`   - Liquidation Threshold: ${asset.liquidationThreshold}`);
      console.log(`   - Liquidation Bonus: ${asset.liquidationBonus}`);

      // Verify asset was added correctly
      const updatedAssetConfig = await universalLendingProtocol.getEnhancedAssetConfig(tokenAddress);
      console.log(`   - Verification: isSupported = ${updatedAssetConfig.isSupported}`);

    } catch (error) {
      console.log(`⚠️  Error adding ${asset.symbol}: ${error}`);
      console.log("Make sure the token addresses are correct in contracts.json");
    }
  }

  console.log("\n=== Solana Asset Addition Summary ===");
  
  // Print summary of all supported assets
  try {
    // Get supported assets by checking our configured tokens
    const deployment = await deploymentManager.loadDeployment();
    if (!deployment || !deployment.contracts.tokens) {
      throw new Error("No token configuration found");
    }
    
    console.log("Supported assets check:");
    
    for (const [tokenSymbol, assetAddress] of Object.entries(deployment.contracts.tokens)) {
      if (typeof assetAddress !== 'string' || assetAddress === "0x0000000000000000000000000000000000000000") continue;
      
      try {
        const assetConfig = await universalLendingProtocol.getEnhancedAssetConfig(assetAddress);
        
        if (assetConfig.isSupported) {
          console.log(`  ✅ ${tokenSymbol} (${assetAddress}): SUPPORTED`);
          console.log(`    Collateral Factor: ${ethers.utils.formatEther(assetConfig.collateralFactor)}`);
          console.log(`    Liquidation Threshold: ${ethers.utils.formatEther(assetConfig.liquidationThreshold)}`);
          console.log(`    Liquidation Bonus: ${ethers.utils.formatEther(assetConfig.liquidationBonus)}`);
          
          // Try to get price
          try {
            const price = await priceOracle.getPrice(assetAddress);
            const priceFormatted = ethers.utils.formatEther(price);
            console.log(`    Price: $${priceFormatted}`);
          } catch (priceError) {
            console.log(`    Price: Not set in oracle`);
          }
        } else {
          console.log(`  ❌ ${tokenSymbol} (${assetAddress}): NOT SUPPORTED`);
        }
      } catch (error) {
        console.log(`  ⚠️  ${tokenSymbol} (${assetAddress}): Error reading config - ${error}`);
      }
    }
  } catch (error) {
    console.log(`⚠️  Error reading supported assets: ${error}`);
  }

  console.log("\n✅ Solana asset addition completed!");
  console.log("\nNext steps:");
  console.log("1. Verify that the assets are properly configured");
  console.log("2. Test supply and borrow operations with Solana assets");
  console.log("3. Monitor asset utilization and adjust interest rates if needed");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });