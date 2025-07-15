import { viem } from "hardhat";
import { parseEther, parseUnits, formatEther } from "viem";

async function main() {
  const publicClient = await viem.getPublicClient();
  const [deployer] = await viem.getWalletClients();
  
  console.log("Deploying Simple Lending Protocol with account:", deployer.account.address);
  console.log("Account balance:", formatEther(await publicClient.getBalance({ address: deployer.account.address })));

  // Deploy SimplePriceOracle
  console.log("\nDeploying SimplePriceOracle...");
  const priceOracle = await viem.deployContract("SimplePriceOracle", [deployer.account.address]);
  console.log("SimplePriceOracle deployed to:", priceOracle.address);

  // Deploy SimpleLendingProtocol
  console.log("\nDeploying SimpleLendingProtocol...");
  const lendingProtocol = await viem.deployContract("SimpleLendingProtocol", [deployer.account.address]);
  console.log("SimpleLendingProtocol deployed to:", lendingProtocol.address);

  // Deploy Mock ZRC20 tokens for testing
  console.log("\nDeploying Mock ZRC20 tokens...");
  
  // Deploy ETH token
  const ethToken = await viem.deployContract("MockZRC20", [
    "Ethereum",
    "ETH",
    18,
    parseEther("1000000") // 1M supply
  ]);
  console.log("ETH token deployed to:", ethToken.address);

  // Deploy USDC token
  const usdcToken = await viem.deployContract("MockZRC20", [
    "USD Coin",
    "USDC",
    6,
    parseUnits("1000000", 6) // 1M supply
  ]);
  console.log("USDC token deployed to:", usdcToken.address);

  // Deploy USDT token
  const usdtToken = await viem.deployContract("MockZRC20", [
    "Tether",
    "USDT",
    6,
    parseUnits("1000000", 6) // 1M supply
  ]);
  console.log("USDT token deployed to:", usdtToken.address);

  // Configure assets in lending protocol
  console.log("\nConfiguring assets...");
  
  // Add ETH
  await lendingProtocol.write.addAsset([ethToken.address, 2000n], { account: deployer.account });
  console.log("ETH asset configured");

  // Add USDC
  await lendingProtocol.write.addAsset([usdcToken.address, 1n], { account: deployer.account });
  console.log("USDC asset configured");

  // Add USDT
  await lendingProtocol.write.addAsset([usdtToken.address, 1n], { account: deployer.account });
  console.log("USDT asset configured");

  // Set initial prices in oracle
  console.log("\nSetting initial prices...");
  await priceOracle.write.setPrice([ethToken.address, 2000n], { account: deployer.account });
  await priceOracle.write.setPrice([usdcToken.address, 1n], { account: deployer.account });
  await priceOracle.write.setPrice([usdtToken.address, 1n], { account: deployer.account });
  console.log("Initial prices set");

  // Log deployment summary
  console.log("\n=== DEPLOYMENT SUMMARY ===");
  console.log("Network:", await publicClient.getChainId());
  console.log("Deployer:", deployer.account.address);
  console.log("SimpleLendingProtocol:", lendingProtocol.address);
  console.log("SimplePriceOracle:", priceOracle.address);
  console.log("ETH Token:", ethToken.address);
  console.log("USDC Token:", usdcToken.address);
  console.log("USDT Token:", usdtToken.address);
  
  // Save deployment addresses for frontend
  const deploymentInfo = {
    network: "local",
    chainId: await publicClient.getChainId(),
    deployer: deployer.account.address,
    contracts: {
      SimpleLendingProtocol: lendingProtocol.address,
      SimplePriceOracle: priceOracle.address,
      ETH: ethToken.address,
      USDC: usdcToken.address,
      USDT: usdtToken.address
    },
    timestamp: new Date().toISOString()
  };

  console.log("\nDeployment completed successfully!");
  console.log("Copy this for frontend integration:");
  console.log(JSON.stringify(deploymentInfo, null, 2));

  // Test basic functionality
  console.log("\n=== TESTING BASIC FUNCTIONALITY ===");
  
  // Check asset configuration
  const ethAsset = await lendingProtocol.read.assets([ethToken.address]);
  console.log("ETH asset supported:", ethAsset[0]);
  console.log("ETH price:", formatEther(ethAsset[1]));
  
  const usdcAsset = await lendingProtocol.read.assets([usdcToken.address]);
  console.log("USDC asset supported:", usdcAsset[0]);
  console.log("USDC price:", formatEther(usdcAsset[1]));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });