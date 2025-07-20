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

  // Deploy UniversalLendingProtocol
  console.log("\n=== Deploying UniversalLendingProtocol ===");

  const UniversalLendingProtocol = await ethers.getContractFactory("UniversalLendingProtocol");
  const universalLendingProtocol = await UniversalLendingProtocol.deploy(
    gatewayAddress,
    "0x0000000000000000000000000000000000000000", // TODO: Replace with actual price oracle address
    deployer.address
  );

  await universalLendingProtocol.deployed();
  console.log("UniversalLendingProtocol deployed to:", universalLendingProtocol.address);

  // Update centralized contract registry
  updateContractAddress(chainId, "UniversalLendingProtocol", universalLendingProtocol.address as Address);

  // Add supported ZRC-20 assets from centralized configuration
  console.log("\n=== Adding Supported Assets ===");

  const assets = [
    { symbol: "ETH.ARBI", chainId: 421614, price: 2000 }, // $2000
    { symbol: "USDC.ARBI", chainId: 421614, price: 1 },   // $1
    { symbol: "ETH.ETH", chainId: 11155111, price: 2000 }, // $2000
    { symbol: "USDC.ETH", chainId: 11155111, price: 1 }    // $1
  ];

  for (const asset of assets) {
    try {
      // Get token address from centralized configuration
      const tokenAddress = getTokenAddress(chainId, asset.symbol);

      console.log(`Adding ${asset.symbol} (${tokenAddress}) with price $${asset.price}...`);

      // Add asset with proper parameters for UniversalLendingProtocol
      await universalLendingProtocol.addAsset(
        tokenAddress,
        "800000000000000000", // 80% collateral factor (0.8 * 1e18)
        "850000000000000000", // 85% liquidation threshold (0.85 * 1e18)
        "50000000000000000"   // 5% liquidation bonus (0.05 * 1e18)
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
  console.log("Gateway:", gatewayAddress);

  // Update external chains with the lending protocol address in centralized config
  console.log("\n=== Updating External Chain Configurations ===");

  const allowedChains = [
    { chainId: 421614, name: "Arbitrum Sepolia" },
    { chainId: 11155111, name: "Ethereum Sepolia" }
  ];

  try {
    // Update external chain configs with the lending protocol address
    // This allows external DepositContracts to know where to send deposits

    for (const chain of allowedChains) {
      try {
        const networkConfig = getNetwork(chain.chainId);
        console.log(`Updating ${networkConfig.name} lending protocol address...`);

        updateLendingProtocolAddress(chain.chainId, universalLendingProtocol.address as Address);
        console.log(`✅ Updated ${networkConfig.name} config with lending protocol address`);

      } catch (error) {
        console.log(`⚠️  Warning: Could not update config for chain ${chain.chainId}: ${error}`);
      }
    }
  } catch (error) {
    console.log("⚠️  Warning: Could not update external chain configs:", error);
  }

  console.log("\n=== Deployment Summary ===");
  printDeploymentSummary(chainId);

  console.log("\n✅ UniversalLendingProtocol deployment completed successfully!");
  console.log("\nRun the following command to verify contract on explorer:");
  console.log(`npx hardhat verify --network ${getNetwork(chainId).name} ${universalLendingProtocol.address} ${gatewayAddress} "0x0000000000000000000000000000000000000000" ${deployer.address}`);
  console.log("\nNext steps:");
  console.log("1. Deploy DepositContracts on external chains using:");
  console.log("   npx hardhat run scripts/deploy-deposit-contracts.ts --network arbitrum-sepolia");
  console.log("   npx hardhat run scripts/deploy-deposit-contracts.ts --network ethereum-sepolia");
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