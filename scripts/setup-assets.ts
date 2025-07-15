import { ethers } from "hardhat";
import { parseEther } from "viem";

// Configuration for supported assets
const ASSET_CONFIGS = {
  "ETH.ARBI": {
    collateralFactor: parseEther("0.8"),  // 80%
    liquidationThreshold: parseEther("0.85"), // 85%
    liquidationBonus: parseEther("0.05"), // 5%
    price: 2000 // $2000
  },
  "USDC.ARBI": {
    collateralFactor: parseEther("0.9"),  // 90%
    liquidationThreshold: parseEther("0.9"), // 90%
    liquidationBonus: parseEther("0.05"), // 5%
    price: 1 // $1
  },
  "USDT.BASE": {
    collateralFactor: parseEther("0.9"),  // 90%
    liquidationThreshold: parseEther("0.9"), // 90%
    liquidationBonus: parseEther("0.05"), // 5%
    price: 1 // $1
  },
  "ZETA": {
    collateralFactor: parseEther("0.75"), // 75%
    liquidationThreshold: parseEther("0.8"), // 80%
    liquidationBonus: parseEther("0.1"), // 10%
    price: 0.5 // $0.5
  }
};

async function main() {
  const [deployer] = await ethers.getSigners();
  
  // Replace with your deployed contract addresses
  const LENDING_PROTOCOL_ADDRESS = "0x..."; // Replace with actual address
  const PRICE_ORACLE_ADDRESS = "0x...";     // Replace with actual address
  
  console.log("Setting up assets with account:", deployer.address);
  
  if (LENDING_PROTOCOL_ADDRESS === "0x..." || PRICE_ORACLE_ADDRESS === "0x...") {
    console.error("Please update contract addresses in the script");
    process.exit(1);
  }
  
  // Get contract instances
  const lendingProtocol = await ethers.getContractAt("LendingProtocol", LENDING_PROTOCOL_ADDRESS);
  const priceOracle = await ethers.getContractAt("MockPriceOracle", PRICE_ORACLE_ADDRESS);
  
  console.log("LendingProtocol address:", await lendingProtocol.getAddress());
  console.log("PriceOracle address:", await priceOracle.getAddress());
  
  // Asset addresses (replace with actual ZRC-20 addresses on ZetaChain)
  const assetAddresses = {
    "ETH.ARBI": "0x...", // Replace with actual ZRC-20 ETH.ARBI address
    "USDC.ARBI": "0x...", // Replace with actual ZRC-20 USDC.ARBI address
    "USDT.BASE": "0x...", // Replace with actual ZRC-20 USDT.BASE address
    "ZETA": "0x..." // Replace with actual ZETA token address
  };
  
  // Configure each asset
  for (const [symbol, address] of Object.entries(assetAddresses)) {
    if (address === "0x...") {
      console.log(`Skipping ${symbol} - address not provided`);
      continue;
    }
    
    const config = ASSET_CONFIGS[symbol as keyof typeof ASSET_CONFIGS];
    
    console.log(`\nConfiguring ${symbol}...`);
    
    try {
      // Check if asset is already supported
      const assetConfig = await lendingProtocol.getAssetConfig(address);
      
      if (assetConfig.isSupported) {
        console.log(`${symbol} is already supported`);
      } else {
        // Add asset to lending protocol
        const tx = await lendingProtocol.addAsset(
          address,
          config.collateralFactor,
          config.liquidationThreshold,
          config.liquidationBonus
        );
        await tx.wait();
        console.log(`${symbol} added to lending protocol`);
      }
      
      // Set price in oracle
      const priceTx = await priceOracle.setPriceInUSD(address, config.price);
      await priceTx.wait();
      console.log(`${symbol} price set to $${config.price}`);
      
    } catch (error) {
      console.error(`Failed to configure ${symbol}:`, error);
    }
  }
  
  console.log("\nAsset setup completed!");
  
  // Verify configuration
  console.log("\n=== VERIFICATION ===");
  for (const [symbol, address] of Object.entries(assetAddresses)) {
    if (address === "0x...") continue;
    
    try {
      const assetConfig = await lendingProtocol.getAssetConfig(address);
      const price = await priceOracle.getPrice(address);
      
      console.log(`${symbol}:`);
      console.log(`  Address: ${address}`);
      console.log(`  Supported: ${assetConfig.isSupported}`);
      console.log(`  Collateral Factor: ${ethers.formatEther(assetConfig.collateralFactor)}%`);
      console.log(`  Liquidation Threshold: ${ethers.formatEther(assetConfig.liquidationThreshold)}%`);
      console.log(`  Price: $${ethers.formatEther(price)}`);
      
    } catch (error) {
      console.error(`Failed to verify ${symbol}:`, error);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Setup failed:", error);
    process.exit(1);
  });