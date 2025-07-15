import { viem } from "hardhat";
import { parseEther, parseUnits, formatEther } from "viem";

async function main() {
  const publicClient = await viem.getPublicClient();
  const [deployer] = await viem.getWalletClients();
  
  console.log("Deploying contracts with account:", deployer.account.address);
  console.log("Account balance:", formatEther(await publicClient.getBalance({ address: deployer.account.address })));

  // Deploy PriceOracle (simplified version)
  console.log("\nDeploying PriceOracle...");
  const priceOracle = await viem.deployContract("PriceOracle", [deployer.account.address]);
  console.log("PriceOracle deployed to:", priceOracle.address);

  // Deploy LendingProtocol
  console.log("\nDeploying LendingProtocol...");
  const lendingProtocol = await viem.deployContract("LendingProtocol", [
    priceOracle.address,
    deployer.account.address
  ]);
  console.log("LendingProtocol deployed to:", lendingProtocol.address);

  // Deploy Mock ZRC20 tokens for testing
  console.log("\nDeploying Mock ZRC20 tokens...");
  
  // Deploy ETH.ARBI token
  const ethToken = await viem.deployContract("MockZRC20", [
    "Ethereum Arbitrum",
    "ETH.ARBI",
    18,
    parseEther("1000000") // 1M supply
  ]);
  console.log("ETH.ARBI token deployed to:", ethToken.address);

  // Deploy USDC.ARBI token
  const usdcToken = await viem.deployContract("MockZRC20", [
    "USD Coin Arbitrum",
    "USDC.ARBI",
    6,
    parseUnits("1000000", 6) // 1M supply
  ]);
  console.log("USDC.ARBI token deployed to:", usdcToken.address);

  // Deploy USDT.BASE token
  const usdtToken = await viem.deployContract("MockZRC20", [
    "Tether Base",
    "USDT.BASE",
    6,
    parseUnits("1000000", 6) // 1M supply
  ]);
  console.log("USDT.BASE token deployed to:", usdtToken.address);

  // Configure assets in lending protocol
  console.log("\nConfiguring assets...");
  
  // Add ETH.ARBI
  await lendingProtocol.write.addAsset([
    ethToken.address,
    parseEther("0.8"), // 80% collateral factor
    parseEther("0.85"), // 85% liquidation threshold
    parseEther("0.05")  // 5% liquidation bonus
  ], { account: deployer.account });
  console.log("ETH.ARBI asset configured");

  // Add USDC.ARBI
  await lendingProtocol.write.addAsset([
    usdcToken.address,
    parseEther("0.9"), // 90% collateral factor
    parseEther("0.9"),  // 90% liquidation threshold
    parseEther("0.05")  // 5% liquidation bonus
  ], { account: deployer.account });
  console.log("USDC.ARBI asset configured");

  // Add USDT.BASE
  await lendingProtocol.write.addAsset([
    usdtToken.address,
    parseEther("0.9"), // 90% collateral factor
    parseEther("0.9"),  // 90% liquidation threshold
    parseEther("0.05")  // 5% liquidation bonus
  ], { account: deployer.account });
  console.log("USDT.BASE asset configured");

  // Set initial prices
  console.log("\nSetting initial prices...");
  await priceOracle.write.setPriceInUSD([ethToken.address, 2000n], { account: deployer.account }); // $2000 per ETH
  await priceOracle.write.setPriceInUSD([usdcToken.address, 1n], { account: deployer.account });    // $1 per USDC
  await priceOracle.write.setPriceInUSD([usdtToken.address, 1n], { account: deployer.account });    // $1 per USDT
  console.log("Initial prices set");

  // Log deployment summary
  console.log("\n=== DEPLOYMENT SUMMARY ===");
  console.log("Network:", await publicClient.getChainId());
  console.log("Deployer:", deployer.account.address);
  console.log("LendingProtocol:", lendingProtocol.address);
  console.log("PriceOracle:", priceOracle.address);
  console.log("ETH.ARBI:", ethToken.address);
  console.log("USDC.ARBI:", usdcToken.address);
  console.log("USDT.BASE:", usdtToken.address);
  
  // Save deployment addresses
  const deploymentInfo = {
    network: "testnet",
    chainId: await publicClient.getChainId(),
    deployer: deployer.account.address,
    contracts: {
      LendingProtocol: lendingProtocol.address,
      PriceOracle: priceOracle.address,
      "ETH.ARBI": ethToken.address,
      "USDC.ARBI": usdcToken.address,
      "USDT.BASE": usdtToken.address
    },
    timestamp: new Date().toISOString()
  };

  console.log("\nDeployment completed successfully!");
  console.log("Save this information for frontend integration:");
  console.log(JSON.stringify(deploymentInfo, null, 2));
  
  // Test basic functionality
  console.log("\n=== TESTING BASIC FUNCTIONALITY ===");
  
  // Check asset configuration
  const ethAsset = await lendingProtocol.read.getAssetConfig([ethToken.address]);
  console.log("ETH asset supported:", ethAsset.isSupported);
  console.log("ETH collateral factor:", formatEther(ethAsset.collateralFactor));
  
  const usdcAsset = await lendingProtocol.read.getAssetConfig([usdcToken.address]);
  console.log("USDC asset supported:", usdcAsset.isSupported);
  console.log("USDC collateral factor:", formatEther(usdcAsset.collateralFactor));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });