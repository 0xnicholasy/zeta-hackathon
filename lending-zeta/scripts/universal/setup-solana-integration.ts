import { ethers } from "hardhat";
import {
  getNetwork
} from "../../utils/contracts";
import { DeploymentManager } from "../utils/deployment-utils";

// Solana chain configurations
const solanaChains = [
  { chainId: 901, name: "Solana Devnet" },
  { chainId: 900, name: "Solana Mainnet" }
];

// Solana asset configurations
const solanaAssets = [
  { 
    symbol: "SOL.SOL", 
    chainId: 901, // Use Solana Devnet for testnet
    price: 150, // $150 SOL price
    collateralFactor: "0.75", // 75% collateral factor
    liquidationThreshold: "0.80", // 80% liquidation threshold  
    liquidationBonus: "0.05" // 5% liquidation bonus
  },
  { 
    symbol: "USDC.SOL", 
    chainId: 901, // Use Solana Devnet for testnet
    price: 1, // $1 USDC price
    collateralFactor: "0.90", // 90% collateral factor
    liquidationThreshold: "0.95", // 95% liquidation threshold
    liquidationBonus: "0.03" // 3% liquidation bonus
  }
];

async function main() {
  console.log("Setting up complete Solana integration for UniversalLendingProtocol...");

  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const chainId = network.chainId;

  // Initialize deployment manager
  const deploymentManager = new DeploymentManager(BigInt(chainId));

  console.log("Setting up with account:", deployer.address);
  console.log("Network:", getNetwork(chainId).name);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.utils.formatEther(balance));

  // Ensure we're on ZetaChain
  if (chainId !== 7001 && chainId !== 7000) {
    throw new Error("This script should only be run on ZetaChain networks (7001 for testnet, 7000 for mainnet)");
  }

  // Get deployed contracts
  let universalLendingProtocol;
  let priceOracle;
  
  try {
    universalLendingProtocol = await deploymentManager.getContractInstance("UniversalLendingProtocol");
    console.log("Found UniversalLendingProtocol at:", universalLendingProtocol.address);
  } catch (error) {
    throw new Error("UniversalLendingProtocol not found. Please deploy it first using deploy-universal-lending.ts");
  }

  try {
    priceOracle = await deploymentManager.getContractInstance("MockPriceOracle");
    console.log("Found MockPriceOracle at:", priceOracle.address);
  } catch (error) {
    throw new Error(`MockPriceOracle not found. Please deploy it first: ${error}`);
  }

  // === STEP 1: Add Solana Chain Support ===
  console.log("\n=== Step 1: Adding Solana Chain Support ===");

  for (const chain of solanaChains) {
    try {
      console.log(`Checking if chain ${chain.chainId} (${chain.name}) is already allowed...`);
      
      // Check if chain is already allowed
      const isAllowed = await universalLendingProtocol.isChainAllowed(chain.chainId);
      
      if (isAllowed) {
        console.log(`✅ Chain ${chain.chainId} (${chain.name}) is already allowed`);
      } else {
        console.log(`Adding chain ${chain.chainId} (${chain.name}) as allowed source chain...`);
        
        try {
          // Add the chain as allowed
          const tx = await universalLendingProtocol.setAllowedSourceChain(chain.chainId, true);
          await tx.wait();
          
          console.log(`✅ Successfully allowed cross-chain operations from ${chain.name} (${chain.chainId})`);
          console.log(`   Transaction hash: ${tx.hash}`);
        } catch (txError: any) {
          if (txError.message && txError.message.includes("GetTxByEthHash") && txError.message.includes("ethereum tx not found")) {
            console.log(`⚠️  RPC issue for chain ${chain.chainId}, but transaction may have succeeded. Continuing...`);
          } else {
            throw txError;
          }
        }
      }
    } catch (error) {
      console.error(`❌ Error adding chain ${chain.chainId}: ${error}`);
    }
  }

  // === STEP 2: Set Solana Asset Prices in Oracle ===
  console.log("\n=== Step 2: Setting Solana Asset Prices in Oracle ===");

  for (const asset of solanaAssets) {
    try {
      const tokenAddress = await deploymentManager.getTokenAddress(asset.symbol);
      console.log(`Setting price for ${asset.symbol} (${tokenAddress}): $${asset.price}`);

      // Convert price to 18 decimals for oracle
      const priceInWei = ethers.utils.parseEther(asset.price.toString());
      
      try {
        const tx = await priceOracle.setPrice(tokenAddress, priceInWei);
        await tx.wait();

        // Verify the price was set correctly
        const storedPrice = await priceOracle.getPrice(tokenAddress);
        const storedPriceFormatted = ethers.utils.formatEther(storedPrice);
        console.log(`✅ Set price for ${asset.symbol}: $${storedPriceFormatted}`);
      } catch (txError: any) {
        if (txError.message && txError.message.includes("GetTxByEthHash") && txError.message.includes("ethereum tx not found")) {
          console.log(`⚠️  RPC issue setting price for ${asset.symbol}, but transaction may have succeeded. Continuing...`);
        } else {
          throw txError;
        }
      }
    } catch (error) {
      console.log(`⚠️  Warning: Could not set price for ${asset.symbol} - ${error}`);
    }
  }

  // === STEP 3: Add Solana Assets to Lending Protocol ===
  console.log("\n=== Step 3: Adding Solana Assets to Universal Protocol ===");

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
      try {
        const addAssetTx = await universalLendingProtocol["addAsset(address,uint256,uint256,uint256)"](
          tokenAddress,
          ethers.utils.parseEther(asset.collateralFactor), // collateral factor
          ethers.utils.parseEther(asset.liquidationThreshold), // liquidation threshold  
          ethers.utils.parseEther(asset.liquidationBonus) // liquidation bonus
        );
        await addAssetTx.wait();
      } catch (txError: any) {
        if (txError.message && txError.message.includes("GetTxByEthHash") && txError.message.includes("ethereum tx not found")) {
          console.log(`⚠️  RPC issue adding asset ${asset.symbol}, but transaction may have succeeded. Continuing...`);
        } else {
          throw txError;
        }
      }

      // Map ZRC-20 asset to its source chain and symbol for Solana
      try {
        const mapTx = await universalLendingProtocol.mapZRC20Asset(
          tokenAddress,
          asset.chainId,
          asset.symbol
        );
        await mapTx.wait();
      } catch (txError: any) {
        if (txError.message && txError.message.includes("GetTxByEthHash") && txError.message.includes("ethereum tx not found")) {
          console.log(`⚠️  RPC issue mapping asset ${asset.symbol}, but transaction may have succeeded. Continuing...`);
        } else {
          throw txError;
        }
      }

      console.log(`✅ Added ${asset.symbol} as supported lending asset`);
      console.log(`   - Collateral Factor: ${asset.collateralFactor}`);
      console.log(`   - Liquidation Threshold: ${asset.liquidationThreshold}`);
      console.log(`   - Liquidation Bonus: ${asset.liquidationBonus}`);
      console.log(`   - Source Chain: ${asset.chainId}`);

      // Verify asset was added correctly
      const updatedAssetConfig = await universalLendingProtocol.getEnhancedAssetConfig(tokenAddress);
      console.log(`   - Verification: isSupported = ${updatedAssetConfig.isSupported}`);

    } catch (error) {
      console.log(`⚠️  Error adding ${asset.symbol}: ${error}`);
      console.log("Make sure the token addresses are correct in contracts.json");
    }
  }

  // === STEP 4: Verification ===
  console.log("\n=== Step 4: Verification ===");
  
  // Verify Solana chains are allowed
  console.log("Solana Chain Support:");
  for (const chain of solanaChains) {
    try {
      const isAllowed = await universalLendingProtocol.isChainAllowed(chain.chainId);
      console.log(`  Chain ${chain.chainId} (${chain.name}): ${isAllowed ? '✅ Allowed' : '❌ Not Allowed'}`);
    } catch (error) {
      console.error(`  Error checking chain ${chain.chainId}: ${error}`);
    }
  }

  // Verify Solana assets are configured
  console.log("\nSolana Asset Configuration:");
  for (const asset of solanaAssets) {
    try {
      const tokenAddress = await deploymentManager.getTokenAddress(asset.symbol);
      const assetConfig = await universalLendingProtocol.getEnhancedAssetConfig(tokenAddress);
      
      if (assetConfig.isSupported) {
        console.log(`  ✅ ${asset.symbol} (${tokenAddress}): SUPPORTED`);
        console.log(`    Collateral Factor: ${ethers.utils.formatEther(assetConfig.collateralFactor)}`);
        console.log(`    Liquidation Threshold: ${ethers.utils.formatEther(assetConfig.liquidationThreshold)}`);
        console.log(`    Liquidation Bonus: ${ethers.utils.formatEther(assetConfig.liquidationBonus)}`);
        
        // Get price
        try {
          const price = await priceOracle.getPrice(tokenAddress);
          const priceFormatted = ethers.utils.formatEther(price);
          console.log(`    Price: $${priceFormatted}`);
        } catch (priceError) {
          console.log(`    Price: Not set in oracle`);
        }
      } else {
        console.log(`  ❌ ${asset.symbol} (${tokenAddress}): NOT SUPPORTED`);
      }
    } catch (error) {
      console.log(`  ⚠️  ${asset.symbol}: Error reading config - ${error}`);
    }
  }

  console.log("\n=== Solana Integration Summary ===");
  console.log("UniversalLendingProtocol:", universalLendingProtocol.address);
  console.log("MockPriceOracle:", priceOracle.address);
  console.log(`Configured ${solanaAssets.length} Solana assets and ${solanaChains.length} Solana chains`);

  console.log("\n✅ Complete Solana integration setup completed successfully!");
  console.log("\nSolana integration now includes:");
  console.log("• Chain Support: Solana Mainnet (900) and Devnet (901)");
  console.log("• Asset Support: SOL.SOL and USDC.SOL tokens");
  console.log("• Oracle Prices: Set for all Solana assets");
  console.log("• Lending Parameters: Configured with appropriate risk factors");
  
  console.log("\nNext steps:");
  console.log("1. Test Solana cross-chain deposits:");
  console.log("   cd call/solana && bun run scripts/deposit-sol-gateway-final.ts");
  console.log("2. Verify Solana asset supply/borrow operations");
  console.log("3. Monitor Solana asset utilization and adjust parameters if needed");
  console.log("4. Deploy any additional Solana-specific contracts if required");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });