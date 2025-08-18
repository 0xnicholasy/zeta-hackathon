import { ethers } from "hardhat";
import {
  getNetwork,
  updateContractAddress,
  printDeploymentSummary,
  Address
} from "../../utils/contracts";
import { DeploymentManager } from "../utils/deployment-utils";

async function main() {
  console.log("Starting UniversalLendingProtocol deployment...");

  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const chainId = network.chainId;

  // Initialize deployment manager
  const deploymentManager = new DeploymentManager(BigInt(chainId));

  console.log("RPC URL:", ethers.provider.connection.url);
  console.log("Deploying with account:", deployer.address);
  console.log("Network:", getNetwork(chainId).name);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.utils.formatEther(balance));

  // Ensure we're deploying on ZetaChain
  if (chainId !== 7001 && chainId !== 7000) {
    throw new Error("UniversalLendingProtocol should only be deployed on ZetaChain networks (7001 for testnet, 7000 for mainnet)");
  }

  // Get gateway address from ZetaChain network configuration
  let gatewayAddress: string;

  if (chainId === 7001) {
    console.log("Using ZetaChain Athens testnet gateway address: 0x6c533f7fe93fae114d0954697069df33c9b74fd7");
    gatewayAddress = "0x6c533f7fe93fae114d0954697069df33c9b74fd7";
  } else if (chainId === 7000) {
    console.log("Using ZetaChain mainnet gateway address: 0xfEDD7A6e3Ef1cC470fbfbF955a22D793dDC0F44E");
    gatewayAddress = "0xfEDD7A6e3Ef1cC470fbfbF955a22D793dDC0F44E";
  } else {
    throw new Error(`Gateway address not configured for chain ${chainId}`);
  }

  // Deploy or get existing Price Oracle
  console.log("\n=== Deploying Price Oracle ===");

  let priceOracle;

  try {
    // Try to get existing price oracle from deployment
    priceOracle = await deploymentManager.getContractInstance("MockPriceOracle");
    console.log("Using existing MockPriceOracle at:", priceOracle.address);
  } catch (error) {
    // Deploy new price oracle if not found
    console.log("MockPriceOracle not found, deploying new one...");
    const MockPriceOracle = await ethers.getContractFactory("MockPriceOracle");
    priceOracle = await MockPriceOracle.deploy();
    await priceOracle.deployed();
    console.log("MockPriceOracle deployed to:", priceOracle.address);

    // Update centralized contract registry with oracle
    updateContractAddress(chainId, "MockPriceOracle", priceOracle.address as Address);

    // Update contracts.json with new oracle address
    await deploymentManager.updateContractsJson(
      "MockPriceOracle",
      priceOracle.address,
      deployer.address
    );
  }

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

  // Update centralized contract registry
  updateContractAddress(chainId, "UniversalLendingProtocol", universalLendingProtocol.address as Address);

  // Update contracts.json with new UniversalLendingProtocol address using DeploymentManager
  await deploymentManager.updateContractsJson(
    "UniversalLendingProtocol",
    universalLendingProtocol.address,
    deployer.address
  );

  console.log("\n=== Deployment Configuration Summary ===");
  console.log("UniversalLendingProtocol:", universalLendingProtocol.address);
  console.log("MockPriceOracle:", priceOracle.address);
  console.log("Gateway:", gatewayAddress);

  console.log("\n=== Deployment Summary ===");
  printDeploymentSummary(chainId);

  console.log("\n✅ UniversalLendingProtocol deployment completed successfully!");
  console.log("\nRun the following commands to verify contracts on explorer:");
  console.log(`npx hardhat verify --network ${getNetwork(chainId).name} ${priceOracle.address}`);
  console.log(`npx hardhat verify --network ${getNetwork(chainId).name} ${universalLendingProtocol.address} ${gatewayAddress} ${priceOracle.address} ${deployer.address}`);
  console.log("\nNext steps:");
  console.log("1. Initialize the protocol:");
  console.log("   npx hardhat run scripts/universal/init-universal-lending.ts --network zeta-testnet");
  console.log("2. Deploy DepositContracts on external chains using:");
  console.log("   npx hardhat run scripts/deposit-contract/deploy-deposit-contracts.ts universal --network arbitrum-sepolia");
  console.log("   npx hardhat run scripts/deposit-contract/deploy-deposit-contracts.ts universal --network ethereum-sepolia");
  console.log("   npx hardhat run scripts/deposit-contract/deploy-deposit-contracts.ts universal --network polygon-amoy");
  console.log("   npx hardhat run scripts/deposit-contract/deploy-deposit-contracts.ts universal --network bsc-testnet");
  console.log("   npx hardhat run scripts/deposit-contract/deploy-deposit-contracts.ts universal --network base-sepolia");
  console.log("3. Run cross-chain tests:");
  console.log("   npx hardhat run scripts/test-cross-chain-lending.ts --network zeta-testnet");
  console.log("4. Verify deployment:");
  console.log("   npx hardhat run scripts/deployment-utils.ts verify");
  console.log(`5. Lending protocol address for external configs: ${universalLendingProtocol.address}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });