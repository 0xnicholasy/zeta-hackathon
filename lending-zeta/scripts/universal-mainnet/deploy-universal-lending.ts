import { ethers } from "hardhat";

async function main() {
  console.log("Starting UniversalLendingProtocol mainnet deployment...");

  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const chainId = Number(network.chainId);

  console.log("Deploying with account:", deployer.address);
  console.log("Chain ID:", chainId);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.utils.formatEther(balance));

  // Ensure we're deploying on ZetaChain mainnet only
  if (chainId !== 7000) {
    throw new Error("This script should only be deployed on ZetaChain mainnet (chain ID 7000)");
  }

  // Get gateway address for ZetaChain mainnet
  const gatewayAddress = "0xfEDD7A6e3Ef1cC470fbfbF955a22D793dDC0F44E";
  console.log("Using ZetaChain mainnet gateway address:", gatewayAddress);

  // Deploy or get existing Price Oracle
  console.log("\n=== Deploying Price Oracle ===");

  // Deploy Price Oracle
  console.log("Deploying MockPriceOracle...");
  const MockPriceOracle = await ethers.getContractFactory("MockPriceOracle");
  const priceOracle = await MockPriceOracle.deploy();
  await priceOracle.deployed();
  console.log("MockPriceOracle deployed to:", priceOracle.address);

  // Deploy UniversalLendingProtocol
  console.log("\n=== Deploying UniversalLendingProtocol ===");

  const UniversalLendingProtocol = await ethers.getContractFactory("UniversalLendingProtocol");
  const universalLendingProtocol = await UniversalLendingProtocol.deploy(
    gatewayAddress,
    priceOracle.address, // Use deployed price oracle
    deployer.address
  );

  await universalLendingProtocol.deployed();
  console.log("UniversalLendingProtocol deployed to:", universalLendingProtocol.address);

  // Save complete deployment info to mainnet-contract-address.json
  const fs = require('fs');
  const path = require('path');
  
  const deploymentInfo = {
    chainId: chainId,
    network: "zeta-mainnet",
    contracts: {
      MockPriceOracle: priceOracle.address,
      UniversalLendingProtocol: universalLendingProtocol.address,
      Gateway: gatewayAddress
    },
    deployedAt: new Date().toISOString(),
    deployer: deployer.address
  };

  const outputPath = path.join(__dirname, 'mainnet-contract-address.json');
  fs.writeFileSync(outputPath, JSON.stringify(deploymentInfo, null, 2));
  console.log("Deployment info saved to:", outputPath);

  console.log("\n=== Deployment Configuration Summary ===");
  console.log("UniversalLendingProtocol:", universalLendingProtocol.address);
  console.log("MockPriceOracle:", priceOracle.address);
  console.log("Gateway:", gatewayAddress);
  console.log("Network: ZetaChain Mainnet (7000)");

  console.log("\n✅ UniversalLendingProtocol mainnet deployment completed successfully!");
  console.log("\nRun the following commands to verify contracts on explorer:");
  console.log(`npx hardhat verify --network zeta-mainnet ${priceOracle.address}`);
  console.log(`npx hardhat verify --network zeta-mainnet ${universalLendingProtocol.address} ${gatewayAddress} ${priceOracle.address} ${deployer.address}`);
  console.log("\nNext steps:");
  console.log("1. Initialize the protocol:");
  console.log("   npx hardhat run scripts/universal-mainnet/init-universal-lending.ts --network zeta-mainnet");
  console.log(`2. Lending protocol address for external configs: ${universalLendingProtocol.address}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });