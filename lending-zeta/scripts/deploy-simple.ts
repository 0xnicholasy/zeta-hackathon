import { ethers } from "hardhat";

async function main() {
  console.log("Starting simple deployment for testing...");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.utils.formatEther(balance));

  // Deploy Simple Price Oracle
  console.log("\n=== Deploying Simple Price Oracle ===");

  const SimplePriceOracle = await ethers.getContractFactory("SimplePriceOracle");
  const simplePriceOracle = await SimplePriceOracle.deploy(deployer.address);
  await simplePriceOracle.deployed();
  console.log("SimplePriceOracle deployed to:", simplePriceOracle.address);

  // Deploy Simple Lending Protocol
  console.log("\n=== Deploying Simple Lending Protocol ===");

  const SimpleLendingProtocol = await ethers.getContractFactory("SimpleLendingProtocol");
  const simpleLendingProtocol = await SimpleLendingProtocol.deploy(deployer.address);
  await simpleLendingProtocol.deployed();
  console.log("SimpleLendingProtocol deployed to:", simpleLendingProtocol.address);

  // Deploy Mock ZRC20 tokens for testing
  console.log("\n=== Deploying Mock ZRC20 Tokens ===");

  const MockZRC20 = await ethers.getContractFactory("MockZRC20");

  const ethArbi = await MockZRC20.deploy("Ethereum Arbitrum", "ETH.ARBI", 18, ethers.utils.parseEther("1000000"));
  await ethArbi.deployed();
  console.log("ETH.ARBI deployed to:", ethArbi.address);

  const usdcArbi = await MockZRC20.deploy("USD Coin Arbitrum", "USDC.ARBI", 6, ethers.utils.parseUnits("1000000", 6));
  await usdcArbi.deployed();
  console.log("USDC.ARBI deployed to:", usdcArbi.address);

  console.log("\n=== Simple Deployment Summary ===");
  console.log(`SimplePriceOracle: ${simplePriceOracle.address}`);
  console.log(`SimpleLendingProtocol: ${simpleLendingProtocol.address}`);
  console.log(`ETH.ARBI: ${ethArbi.address}`);
  console.log(`USDC.ARBI: ${usdcArbi.address}`);

  // Save deployment addresses
  const deploymentInfo = {
    deployer: deployer.address,
    network: await ethers.provider.getNetwork(),
    timestamp: new Date().toISOString(),
    contracts: {
      SimpleLendingProtocol: simpleLendingProtocol.address,
      SimplePriceOracle: simplePriceOracle.address,
      tokens: {
        "ETH.ARBI": ethArbi.address,
        "USDC.ARBI": usdcArbi.address,
      }
    }
  };

  const fs = require('fs');
  fs.writeFileSync(
    `simple-deployments-${(await ethers.provider.getNetwork()).chainId}.json`,
    JSON.stringify(deploymentInfo, null, 2)
  );

  console.log("\nSimple deployment completed successfully!");
  console.log("Run the simple initialization script next.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });