import { viem } from "hardhat";
import { parseEther, parseUnits, formatEther } from "viem";
import { writeFileSync, readFileSync } from "fs";
import { join } from "path";
import { 
  getDeployment,
  type Address,
  type CoreContracts,
  type TokenAddresses,
  ASSET_CONFIGS
} from "../deployments";

async function main() {
  const publicClient = await viem.getPublicClient();
  const [deployer] = await viem.getWalletClients();
  
  // Get network name from environment or default to localnet
  const networkName = process.env.NETWORK || "localnet";
  console.log(`🚀 Deploying to network: ${networkName}`);
  console.log("📍 Deployer account:", deployer.account.address);
  console.log("💰 Account balance:", formatEther(await publicClient.getBalance({ address: deployer.account.address })));
  
  try {
    const deployment = getDeployment(networkName);
    console.log("🌐 Network info:", {
      name: deployment.name,
      chainId: deployment.chainId,
      isTestnet: deployment.isTestnet,
      explorer: deployment.explorer
    });

    // Deploy contracts
    console.log("\n📦 Deploying contracts...");
    
    // Deploy PriceOracle
    console.log("🔮 Deploying PriceOracle...");
    const priceOracle = await viem.deployContract("PriceOracle", [deployer.account.address]);
    console.log("✅ PriceOracle deployed to:", priceOracle.address);

    // Deploy LendingProtocol
    console.log("🏦 Deploying LendingProtocol...");
    const lendingProtocol = await viem.deployContract("LendingProtocol", [
      priceOracle.address,
      deployer.account.address
    ]);
    console.log("✅ LendingProtocol deployed to:", lendingProtocol.address);

    // For testnet/mainnet, we don't deploy mock tokens
    // For localnet, deploy mock tokens for testing
    let tokenAddresses: TokenAddresses;
    
    if (networkName === "localnet") {
      console.log("\n🪙 Deploying mock tokens for local testing...");
      
      // Deploy ETH token
      const ethToken = await viem.deployContract("MockZRC20", [
        "Ethereum Arbitrum",
        "ETH.ARBI",
        18,
        parseEther("1000000") // 1M supply
      ]);
      console.log("✅ ETH.ARBI token deployed to:", ethToken.address);

      // Deploy USDC token
      const usdcToken = await viem.deployContract("MockZRC20", [
        "USD Coin Arbitrum",
        "USDC.ARBI",
        6,
        parseUnits("1000000", 6) // 1M supply
      ]);
      console.log("✅ USDC.ARBI token deployed to:", usdcToken.address);

      // Deploy USDT token
      const usdtToken = await viem.deployContract("MockZRC20", [
        "Tether Base",
        "USDT.BASE",
        6,
        parseUnits("1000000", 6) // 1M supply
      ]);
      console.log("✅ USDT.BASE token deployed to:", usdtToken.address);

      // Deploy ZETA token
      const zetaToken = await viem.deployContract("MockZRC20", [
        "Zeta",
        "ZETA",
        18,
        parseEther("1000000") // 1M supply
      ]);
      console.log("✅ ZETA token deployed to:", zetaToken.address);

      tokenAddresses = {
        "ETH.ARBI": ethToken.address,
        "USDC.ARBI": usdcToken.address,
        "USDT.BASE": usdtToken.address,
        "ZETA": zetaToken.address
      };

      // Provide initial liquidity for borrowing (for localnet only)
      console.log("\n💧 Providing initial liquidity...");
      await usdcToken.write.transfer([lendingProtocol.address, parseUnits("500000", 6)]); // 500k USDC
      await ethToken.write.transfer([lendingProtocol.address, parseEther("100")]); // 100 ETH
      console.log("✅ Initial liquidity provided");

    } else {
      // For testnet/mainnet, use existing token addresses or prompt to update
      console.log("\n🔗 Using existing ZRC-20 token addresses from deployment config");
      tokenAddresses = deployment.tokens;
    }

    // Configure assets in lending protocol
    console.log("\n⚙️  Configuring assets...");
    
    for (const [symbol, address] of Object.entries(tokenAddresses) as [keyof TokenAddresses, Address][]) {
      if (networkName !== "localnet" && address === "0x0000000000000000000000000000000000000000") {
        console.log(`⚠️  Skipping ${symbol} - address not configured for ${networkName}`);
        continue;
      }
      
      const config = ASSET_CONFIGS[symbol];
      
      console.log(`📝 Adding ${symbol} to lending protocol...`);
      await lendingProtocol.write.addAsset([
        address,
        parseEther(config.collateralFactor.toString()),
        parseEther(config.liquidationThreshold.toString()),
        parseEther(config.liquidationBonus.toString())
      ], { account: deployer.account });
      console.log(`✅ ${symbol} configured`);
    }

    // Set initial prices
    console.log("\n💰 Setting initial prices...");
    for (const [symbol, address] of Object.entries(tokenAddresses) as [keyof TokenAddresses, Address][]) {
      if (networkName !== "localnet" && address === "0x0000000000000000000000000000000000000000") {
        continue;
      }
      
      const config = ASSET_CONFIGS[symbol];
      
      // For prices less than $1, use setPrice with 18 decimal precision instead of setPriceInUSD
      if (config.priceInUSD < 1) {
        const priceWith18Decimals = parseEther(config.priceInUSD.toString());
        await priceOracle.write.setPrice([address, priceWith18Decimals], { account: deployer.account });
      } else {
        // For prices >= $1, use setPriceInUSD which expects integer USD values
        await priceOracle.write.setPriceInUSD([address, BigInt(config.priceInUSD)], { account: deployer.account });
      }
      console.log(`✅ ${symbol} price set to $${config.priceInUSD}`);
    }

    // Update deployment configuration
    console.log("\n📝 Updating deployment configuration...");
    
    const newContracts: CoreContracts = {
      LendingProtocol: lendingProtocol.address,
      PriceOracle: priceOracle.address
    };

    // Update deployments.ts file
    await updateDeploymentsFile(networkName, newContracts, networkName === "localnet" ? tokenAddresses : undefined);

    // Deployment summary
    console.log("\n" + "=".repeat(60));
    console.log("🎉 DEPLOYMENT COMPLETED SUCCESSFULLY!");
    console.log("=".repeat(60));
    
    const deploymentInfo = {
      network: deployment.name,
      chainId: deployment.chainId,
      deployer: deployer.account.address,
      isTestnet: deployment.isTestnet,
      explorer: deployment.explorer,
      contracts: newContracts,
      tokens: tokenAddresses,
      timestamp: new Date().toISOString()
    };

    console.log("📊 Deployment Summary:");
    console.log("🌐 Network:", deployment.name);
    console.log("🆔 Chain ID:", deployment.chainId);
    console.log("👤 Deployer:", deployer.account.address);
    console.log("🔍 Explorer:", deployment.explorer);
    console.log("\n📋 Contract Addresses:");
    Object.entries(newContracts).forEach(([name, address]) => {
      console.log(`  ${name}: ${address}`);
    });
    
    console.log("\n🪙 Token Addresses:");
    Object.entries(tokenAddresses).forEach(([symbol, address]) => {
      if (address !== "0x0000000000000000000000000000000000000000") {
        console.log(`  ${symbol}: ${address}`);
      }
    });

    console.log("\n💾 Save this for frontend integration:");
    console.log(JSON.stringify(deploymentInfo, null, 2));

    // Basic functionality test
    console.log("\n🧪 Testing basic functionality...");
    
    for (const [symbol, address] of Object.entries(tokenAddresses) as [keyof TokenAddresses, Address][]) {
      if (address === "0x0000000000000000000000000000000000000000") continue;
      
      try {
        const assetConfig = await lendingProtocol.read.getAssetConfig([address]);
        const price = await priceOracle.read.getPrice([address]);
        
        console.log(`✅ ${symbol}:`);
        console.log(`  Supported: ${assetConfig.isSupported}`);
        console.log(`  Collateral Factor: ${formatEther(assetConfig.collateralFactor)}`);
        console.log(`  Price: $${formatEther(price)}`);
      } catch (error) {
        console.error(`❌ Failed to verify ${symbol}:`, error);
      }
    }

    console.log("\n🎯 Next steps:");
    console.log("1. ✅ Contracts deployed and configured");
    console.log("2. ✅ Deployment addresses updated in deployments.ts");
    if (networkName !== "localnet") {
      console.log("3. ⚠️  Update ZRC-20 token addresses in deployments.ts for your network");
      console.log("4. 🔧 Run setup-assets script: NETWORK=" + networkName + " bun hardhat run scripts/setup-assets.ts");
    } else {
      console.log("3. ✅ Ready for local development and testing!");
    }
    console.log("5. 🚀 Start building your frontend!");

  } catch (error) {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  }
}

async function updateDeploymentsFile(
  networkName: string, 
  contracts: CoreContracts, 
  tokens?: TokenAddresses
) {
  try {
    const deploymentsPath = join(process.cwd(), "deployments.ts");
    let content = readFileSync(deploymentsPath, "utf8");
    
    // Update contract addresses
    const contractsRegex = new RegExp(
      `(${networkName}:[\\s\\S]*?contracts:\\s*{[\\s\\S]*?)LendingProtocol:\\s*"[^"]*"([\\s\\S]*?)PriceOracle:\\s*"[^"]*"`
    );
    
    content = content.replace(contractsRegex, 
      `$1LendingProtocol: "${contracts.LendingProtocol}"$2PriceOracle: "${contracts.PriceOracle}"`
    );
    
    // Update token addresses if provided (for localnet)
    if (tokens) {
      for (const [symbol, address] of Object.entries(tokens)) {
        const tokenRegex = new RegExp(
          `(${networkName}:[\\s\\S]*?tokens:\\s*{[\\s\\S]*?)"${symbol}":\\s*"[^"]*"`
        );
        content = content.replace(tokenRegex, `$1"${symbol}": "${address}"`);
      }
    }
    
    writeFileSync(deploymentsPath, content);
    console.log("✅ deployments.ts updated successfully");
    
  } catch (error) {
    console.error("⚠️  Failed to update deployments.ts:", error);
    console.log("📝 Please manually update the following addresses in deployments.ts:");
    console.log(`Network: ${networkName}`);
    Object.entries(contracts).forEach(([name, address]) => {
      console.log(`  ${name}: "${address}"`);
    });
    if (tokens) {
      Object.entries(tokens).forEach(([symbol, address]) => {
        console.log(`  "${symbol}": "${address}"`);
      });
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });