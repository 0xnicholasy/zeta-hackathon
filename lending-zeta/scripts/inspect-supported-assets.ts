import { ethers } from "hardhat";
import { utils } from "ethers";
import {
  getNetwork,
  getContractAddress,
  getTokenAddress,
} from "../utils/contracts";

async function main() {
  console.log("🔍 Inspecting supported assets in SimpleLendingProtocol...");

  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const chainId = network.chainId;

  console.log("Connected to:", getNetwork(chainId).name);
  console.log("Account:", deployer.address);

  // Get SimpleLendingProtocol address
  let simpleLendingProtocolAddress: string;
  try {
    simpleLendingProtocolAddress = getContractAddress(chainId, "SimpleLendingProtocol");
  } catch (error) {
    console.error("❌ SimpleLendingProtocol not found in config");
    console.log("Available contract addresses:");
    try {
      const networkConfig = getNetwork(chainId);
      console.log(JSON.stringify(networkConfig, null, 2));
    } catch (e) {
      console.log("No network config found");
    }
    return;
  }

  console.log("SimpleLendingProtocol address:", simpleLendingProtocolAddress);

  // Get contract instance
  const simpleLendingProtocol = await ethers.getContractAt(
    "SimpleLendingProtocol",
    simpleLendingProtocolAddress
  );

  try {
    // Get supported assets count
    const assetsCount = await simpleLendingProtocol.getSupportedAssetsCount();
    console.log(`\n📊 Total supported assets: ${assetsCount.toString()}`);

    if (assetsCount.toNumber() === 0) {
      console.log("❌ No assets are currently supported");
      return;
    }

    console.log("\n=== Supported Assets Details ===");
    console.log("Index | Asset Address | Symbol | Supported | Price (USD)");
    console.log("-".repeat(70));

    for (let i = 0; i < assetsCount.toNumber(); i++) {
      const assetAddress = await simpleLendingProtocol.getSupportedAsset(i);
      const assetInfo = await simpleLendingProtocol.assets(assetAddress);

      // Try to map address to symbol from config
      let assetSymbol = "Unknown";
      try {
        const networkConfig = getNetwork(chainId);
        if (networkConfig.tokens) {
          for (const [symbol, address] of Object.entries(networkConfig.tokens)) {
            if (address.toLowerCase() === assetAddress.toLowerCase()) {
              assetSymbol = symbol;
              break;
            }
          }
        }
      } catch (e) {
        // Ignore mapping errors
      }

      // Try to get token decimals and symbol from contract
      try {
        const tokenContract = await ethers.getContractAt("IERC20Metadata", assetAddress);
        const tokenSymbol = await tokenContract.symbol();
        const tokenDecimals = await tokenContract.decimals();
        if (tokenSymbol && tokenSymbol !== "") {
          assetSymbol = `${tokenSymbol} (${tokenDecimals} decimals)`;
        }
      } catch (e) {
        // Token might not implement metadata extension
      }

      const priceFormatted = utils.formatUnits(assetInfo.price, 18);
      console.log(
        `${i.toString().padEnd(5)} | ${assetAddress} | ${assetSymbol.padEnd(15)} | ${assetInfo.isSupported ? "✅" : "❌"} | $${priceFormatted}`
      );
    }

    // Check expected ZRC-20 addresses from config
    console.log("\n=== Expected ZRC-20 Addresses from Config ===");
    const expectedTokens = ["ETH.ARBI", "USDC.ARBI", "ETH.ETH", "USDC.ETH"];
    
    for (const tokenSymbol of expectedTokens) {
      try {
        const expectedAddress = getTokenAddress(chainId, tokenSymbol);
        console.log(`${tokenSymbol}: ${expectedAddress}`);
        
        // Check if this address is in supported assets
        const assetInfo = await simpleLendingProtocol.assets(expectedAddress);
        const status = assetInfo.isSupported ? "✅ Supported" : "❌ Not Supported";
        console.log(`  Status: ${status}`);
        if (assetInfo.isSupported) {
          console.log(`  Price: $${utils.formatUnits(assetInfo.price, 18)}`);
        }
        console.log("");
      } catch (error) {
        console.log(`${tokenSymbol}: ❌ Not configured`);
      }
    }

  } catch (error) {
    console.error("❌ Error inspecting contract:", error);
    
    // Try to check if contract exists
    try {
      const code = await ethers.provider.getCode(simpleLendingProtocolAddress);
      if (code === "0x") {
        console.log("❌ No contract deployed at this address");
      } else {
        console.log("✅ Contract exists but call failed");
      }
    } catch (e) {
      console.log("❌ Failed to check contract existence");
    }
  }

  console.log("\n🔧 Troubleshooting Tips:");
  console.log("1. Ensure SimpleLendingProtocol is deployed and address is correct");
  console.log("2. Check that ZRC-20 token addresses in config match actual ZetaChain addresses");
  console.log("3. Verify assets were properly added during initialization");
  console.log("4. For cross-chain deposits, use actual ZRC-20 addresses, not external chain addresses");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });