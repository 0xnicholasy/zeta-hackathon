import { ethers } from "hardhat";
import { parseEther, parseUnits } from "viem";

async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)));

  // Deploy MockPriceOracle (for testnet)
  console.log("\nDeploying MockPriceOracle...");
  const MockPriceOracle = await ethers.getContractFactory("MockPriceOracle");
  const priceOracle = await MockPriceOracle.deploy();
  await priceOracle.waitForDeployment();
  console.log("MockPriceOracle deployed to:", await priceOracle.getAddress());

  // Deploy LendingProtocol
  console.log("\nDeploying LendingProtocol...");
  const LendingProtocol = await ethers.getContractFactory("LendingProtocol");
  const lendingProtocol = await LendingProtocol.deploy(
    await priceOracle.getAddress(),
    deployer.address
  );
  await lendingProtocol.waitForDeployment();
  console.log("LendingProtocol deployed to:", await lendingProtocol.getAddress());

  // Deploy Mock ZRC20 tokens for testing
  console.log("\nDeploying Mock ZRC20 tokens...");
  const MockZRC20 = await ethers.getContractFactory("MockZRC20");
  
  // Deploy ETH.ARBI token
  const ethToken = await MockZRC20.deploy(
    "Ethereum Arbitrum",
    "ETH.ARBI",
    18,
    parseEther("1000000") // 1M supply
  );
  await ethToken.waitForDeployment();
  console.log("ETH.ARBI token deployed to:", await ethToken.getAddress());

  // Deploy USDC.ARBI token
  const usdcToken = await MockZRC20.deploy(
    "USD Coin Arbitrum",
    "USDC.ARBI",
    6,
    parseUnits("1000000", 6) // 1M supply
  );
  await usdcToken.waitForDeployment();
  console.log("USDC.ARBI token deployed to:", await usdcToken.getAddress());

  // Deploy USDT.BASE token
  const usdtToken = await MockZRC20.deploy(
    "Tether Base",
    "USDT.BASE",
    6,
    parseUnits("1000000", 6) // 1M supply
  );
  await usdtToken.waitForDeployment();
  console.log("USDT.BASE token deployed to:", await usdtToken.getAddress());

  // Configure assets in lending protocol
  console.log("\nConfiguring assets...");
  
  // Add ETH.ARBI
  await lendingProtocol.addAsset(
    await ethToken.getAddress(),
    parseEther("0.8"), // 80% collateral factor
    parseEther("0.85"), // 85% liquidation threshold
    parseEther("0.05")  // 5% liquidation bonus
  );
  console.log("ETH.ARBI asset configured");

  // Add USDC.ARBI
  await lendingProtocol.addAsset(
    await usdcToken.getAddress(),
    parseEther("0.9"), // 90% collateral factor
    parseEther("0.9"),  // 90% liquidation threshold
    parseEther("0.05")  // 5% liquidation bonus
  );
  console.log("USDC.ARBI asset configured");

  // Add USDT.BASE
  await lendingProtocol.addAsset(
    await usdtToken.getAddress(),
    parseEther("0.9"), // 90% collateral factor
    parseEther("0.9"),  // 90% liquidation threshold
    parseEther("0.05")  // 5% liquidation bonus
  );
  console.log("USDT.BASE asset configured");

  // Set initial prices
  console.log("\nSetting initial prices...");
  await priceOracle.setPriceInUSD(await ethToken.getAddress(), 2000); // $2000 per ETH
  await priceOracle.setPriceInUSD(await usdcToken.getAddress(), 1);    // $1 per USDC
  await priceOracle.setPriceInUSD(await usdtToken.getAddress(), 1);    // $1 per USDT
  console.log("Initial prices set");

  // Log deployment summary
  console.log("\n=== DEPLOYMENT SUMMARY ===");
  console.log("Network:", (await ethers.provider.getNetwork()).name);
  console.log("Deployer:", deployer.address);
  console.log("LendingProtocol:", await lendingProtocol.getAddress());
  console.log("MockPriceOracle:", await priceOracle.getAddress());
  console.log("ETH.ARBI:", await ethToken.getAddress());
  console.log("USDC.ARBI:", await usdcToken.getAddress());
  console.log("USDT.BASE:", await usdtToken.getAddress());
  
  // Save deployment addresses
  const deploymentInfo = {
    network: (await ethers.provider.getNetwork()).name,
    chainId: (await ethers.provider.getNetwork()).chainId,
    deployer: deployer.address,
    contracts: {
      LendingProtocol: await lendingProtocol.getAddress(),
      MockPriceOracle: await priceOracle.getAddress(),
      "ETH.ARBI": await ethToken.getAddress(),
      "USDC.ARBI": await usdcToken.getAddress(),
      "USDT.BASE": await usdtToken.getAddress()
    },
    timestamp: new Date().toISOString()
  };

  console.log("\nDeployment completed successfully!");
  console.log("Save this information for frontend integration:");
  console.log(JSON.stringify(deploymentInfo, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });