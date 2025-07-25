import { ethers } from "hardhat";
import {
  getNetwork,
  getTokenAddress,
  updateContractAddress,
  printDeploymentSummary,
  Address,
  updateLendingProtocolAddress
} from "../../utils/contracts";
import { DeploymentManager } from "../utils/deployment-utils";

async function main() {
  console.log("Starting UniversalLendingProtocol deployment...");

  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const chainId = network.chainId;

  // Initialize deployment manager
  const deploymentManager = new DeploymentManager(BigInt(chainId));

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

  console.log("Using gateway address:", gatewayAddress);

  // Deploy Price Oracle
  console.log("\n=== Deploying Price Oracle ===");

  const MockPriceOracle = await ethers.getContractFactory("MockPriceOracle");
  const priceOracle = await MockPriceOracle.deploy();
  await priceOracle.deployed();
  console.log("MockPriceOracle deployed to:", priceOracle.address);

  // Update centralized contract registry with oracle
  updateContractAddress(chainId, "MockPriceOracle", priceOracle.address as Address);

  // Set prices for supported assets in price oracle
  console.log("\n=== Setting Asset Prices in Oracle ===");

  const assets = [
    { symbol: "ETH.ARBI", chainId: 421614, price: 2000 }, // $2000
    { symbol: "USDC.ARBI", chainId: 421614, price: 1 },   // $1
    { symbol: "ETH.ETH", chainId: 11155111, price: 2000 }, // $2000
    { symbol: "USDC.ETH", chainId: 11155111, price: 1 }    // $1
  ];

  for (const asset of assets) {
    try {
      const tokenAddress = getTokenAddress(chainId, asset.symbol);

      console.log(`Setting price for ${asset.symbol} (${tokenAddress}): $${asset.price}`);

      // Convert price to 18 decimals for oracle (e.g., $2000 -> 2000 * 1e18)
      const priceInWei = ethers.utils.parseEther(asset.price.toString());
      await priceOracle.setPrice(tokenAddress, priceInWei);

      console.log(`✅ Set price for ${asset.symbol}`);
    } catch (error) {
      console.log(`⚠️  Warning: Could not set price for ${asset.symbol} - ${error}`);
    }
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

  // Add supported ZRC-20 assets from centralized configuration  
  console.log("\n=== Adding Supported Assets to Universal Protocol ===");

  // Set allowed source chains for cross-chain operations
  const allowedChains = [
    { chainId: 421614, name: "Arbitrum Sepolia" },
    { chainId: 11155111, name: "Ethereum Sepolia" }
  ];

  console.log("Setting allowed source chains...");
  for (const chain of allowedChains) {
    try {
      await universalLendingProtocol.setAllowedSourceChain(chain.chainId, true);
      console.log(`✅ Allowed cross-chain operations from ${chain.name} (${chain.chainId})`);
    } catch (error) {
      console.log(`⚠️  Warning: Could not set allowed chain ${chain.chainId}: ${error}`);
    }
  }

  for (const asset of assets) {
    try {
      // Get token address from centralized configuration
      const tokenAddress = getTokenAddress(chainId, asset.symbol);

      console.log(`Adding ${asset.symbol} (${tokenAddress})...`);

      // Add asset with proper parameters for UniversalLendingProtocol
      await universalLendingProtocol["addAsset(address,uint256,uint256,uint256)"](
        tokenAddress,
        ethers.utils.parseEther("0.8"), // 80% collateral factor
        ethers.utils.parseEther("0.85"), // 85% liquidation threshold  
        ethers.utils.parseEther("0.05")  // 5% liquidation bonus
      );

      // Map ZRC-20 asset to its source chain and symbol
      await universalLendingProtocol.mapZRC20Asset(
        tokenAddress,
        asset.chainId,
        asset.symbol
      );

      console.log(`✅ Added ${asset.symbol} as supported lending asset`);

    } catch (error) {
      console.log(`⚠️  Warning: Could not add ${asset.symbol} - ${error}`);
      console.log("Make sure ZRC-20 tokens are deployed and configured in contracts.json");
    }
  }

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
  console.log("1. Deploy DepositContracts on external chains using:");
  console.log("   npx hardhat run scripts/deposit-contract/deploy-deposit-contracts.ts universal --network arbitrum-sepolia");
  console.log("   npx hardhat run scripts/deposit-contract/deploy-deposit-contracts.ts universal --network ethereum-sepolia");
  console.log("2. Run cross-chain tests:");
  console.log("   npx hardhat run scripts/test-cross-chain-lending.ts --network zeta-testnet");
  console.log("3. Verify deployment:");
  console.log("   npx hardhat run scripts/deployment-utils.ts verify");
  console.log(`4. Lending protocol address for external configs: ${universalLendingProtocol.address}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });