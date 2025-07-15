import { viem } from "hardhat";
import { parseEther, formatEther } from "viem";
import { 
  getDeployment, 
  getContractAddress, 
  getAllTokenAddresses,
  validateDeployment,
  ASSET_CONFIGS,
  type Address,
  type TokenAddresses
} from "../deployments";

async function main() {
  const [deployer] = await viem.getWalletClients();
  
  // Get network name from environment or default to localnet
  const networkName = process.env.NETWORK || "localnet";
  console.log(`Setting up assets for network: ${networkName}`);
  console.log("Deployer account:", deployer.account.address);
  
  try {
    // Get deployment configuration
    const deployment = getDeployment(networkName);
    console.log("Network info:", {
      name: deployment.name,
      chainId: deployment.chainId,
      isTestnet: deployment.isTestnet
    });
    
    // Validate deployment has all required addresses
    const validation = validateDeployment(networkName);
    if (!validation.isValid) {
      console.error("❌ Deployment validation failed:");
      if (validation.missingContracts.length > 0) {
        console.error("Missing contracts:", validation.missingContracts);
      }
      if (validation.missingTokens.length > 0) {
        console.error("Missing tokens:", validation.missingTokens);
      }
      console.error("\n💡 Please deploy contracts first or update addresses in deployments.ts");
      process.exit(1);
    }
    
    console.log("✅ Deployment validation passed");
    
    // Get contract instances
    const lendingProtocolAddress = getContractAddress(networkName, "LendingProtocol");
    const priceOracleAddress = getContractAddress(networkName, "PriceOracle");
    
    console.log("Contract addresses:");
    console.log("  LendingProtocol:", lendingProtocolAddress);
    console.log("  PriceOracle:", priceOracleAddress);
    
    const lendingProtocol = await viem.getContractAt("LendingProtocol", lendingProtocolAddress);
    const priceOracle = await viem.getContractAt("PriceOracle", priceOracleAddress);
    
    // Get all token addresses for this network
    const tokenAddresses = getAllTokenAddresses(networkName);
    
    console.log("\n🔧 Configuring assets...");
    
    // Configure each asset
    for (const [symbol, address] of Object.entries(tokenAddresses) as [keyof TokenAddresses, Address][]) {
      const config = ASSET_CONFIGS[symbol];
      
      console.log(`\n📝 Configuring ${symbol}...`);
      console.log(`  Address: ${address}`);
      console.log(`  Collateral Factor: ${(config.collateralFactor * 100).toFixed(1)}%`);
      console.log(`  Liquidation Threshold: ${(config.liquidationThreshold * 100).toFixed(1)}%`);
      console.log(`  Price: $${config.priceInUSD}`);
      
      try {
        // Check if asset is already supported
        const assetConfig = await lendingProtocol.read.getAssetConfig([address]);
        
        if (assetConfig.isSupported) {
          console.log(`  ✅ ${symbol} is already supported in lending protocol`);
        } else {
          // Add asset to lending protocol
          console.log(`  ➕ Adding ${symbol} to lending protocol...`);
          await lendingProtocol.write.addAsset([
            address,
            parseEther(config.collateralFactor.toString()),
            parseEther(config.liquidationThreshold.toString()),
            parseEther(config.liquidationBonus.toString())
          ], { account: deployer.account });
          console.log(`  ✅ ${symbol} added to lending protocol`);
        }
        
        // Set price in oracle
        console.log(`  💰 Setting ${symbol} price to $${config.priceInUSD}...`);
        await priceOracle.write.setPriceInUSD([address, BigInt(config.priceInUSD)], { account: deployer.account });
        console.log(`  ✅ ${symbol} price updated`);
        
      } catch (error) {
        console.error(`  ❌ Failed to configure ${symbol}:`, error);
      }
    }
    
    console.log("\n🎉 Asset setup completed!");
    
    // Verification
    console.log("\n🔍 Verification Report:");
    console.log("=" .repeat(50));
    
    for (const [symbol, address] of Object.entries(tokenAddresses) as [keyof TokenAddresses, Address][]) {
      try {
        const assetConfig = await lendingProtocol.read.getAssetConfig([address]);
        const price = await priceOracle.read.getPrice([address]);
        
        console.log(`\n${symbol}:`);
        console.log(`  📍 Address: ${address}`);
        console.log(`  ✅ Supported: ${assetConfig.isSupported}`);
        console.log(`  🏦 Collateral Factor: ${formatEther(assetConfig.collateralFactor)}`);
        console.log(`  ⚠️  Liquidation Threshold: ${formatEther(assetConfig.liquidationThreshold)}`);
        console.log(`  🎁 Liquidation Bonus: ${formatEther(assetConfig.liquidationBonus)}`);
        console.log(`  💵 Price: $${formatEther(price)}`);
        
      } catch (error) {
        console.error(`  ❌ Failed to verify ${symbol}:`, error);
      }
    }
    
    console.log("\n" + "=".repeat(50));
    console.log("✅ Setup verification completed!");
    console.log(`🌐 Network: ${deployment.name}`);
    console.log(`🔗 Explorer: ${deployment.explorer}`);
    
  } catch (error) {
    console.error("❌ Setup failed:", error);
    process.exit(1);
  }
}

// Helper function to deploy and update addresses
export async function updateDeploymentAddresses(
  networkName: string, 
  contracts: { [K in keyof import("../deployments").CoreContracts]: Address },
  tokens?: { [K in keyof TokenAddresses]: Address }
) {
  console.log(`📝 Updating deployment addresses for ${networkName}...`);
  
  // This would update the deployments.ts file
  // For now, just log the addresses that should be updated
  console.log("Contract addresses to update in deployments.ts:");
  Object.entries(contracts).forEach(([name, address]) => {
    console.log(`  ${name}: "${address}",`);
  });
  
  if (tokens) {
    console.log("Token addresses to update in deployments.ts:");
    Object.entries(tokens).forEach(([symbol, address]) => {
      console.log(`  "${symbol}": "${address}",`);
    });
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Setup failed:", error);
    process.exit(1);
  });