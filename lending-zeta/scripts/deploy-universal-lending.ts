import { ethers } from "hardhat";
import {
  getNetwork,
  getContractAddress,
  getTokenAddress,
  updateContractAddress,
  printDeploymentSummary,
  Address
} from "../utils/contracts";
import { DeploymentManager } from "./deployment-utils";

async function main() {
  console.log("Starting UniversalLendingProtocol deployment...");

  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const chainId = network.chainId;

  // Initialize deployment manager
  const deploymentManager = new DeploymentManager(chainId);

  console.log("Deploying with account:", deployer.address);
  console.log("Network:", getNetwork(chainId).name);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.utils.formatEther(balance));

  // Ensure we're deploying on ZetaChain
  if (chainId !== 7001 && chainId !== 7000 && chainId !== 1337) {
    throw new Error("UniversalLendingProtocol should only be deployed on ZetaChain networks");
  }

  // Try to load existing deployment first to get oracle address
  const existingDeployment = await deploymentManager.loadDeployment();
  let priceOracleAddress: string;

  if (existingDeployment?.contracts.oracles?.SimplePriceOracle) {
    priceOracleAddress = existingDeployment.contracts.oracles.SimplePriceOracle;
    console.log("Using existing SimplePriceOracle from deployment:", priceOracleAddress);
  } else {
    // Try centralized config
    try {
      priceOracleAddress = getContractAddress(chainId, "SimplePriceOracle");
      console.log("Using existing SimplePriceOracle from centralized config:", priceOracleAddress);
    } catch {
      // Deploy a new oracle if not found
      console.log("Deploying new SimplePriceOracle...");
      const SimplePriceOracle = await ethers.getContractFactory("SimplePriceOracle");
      const simplePriceOracle = await SimplePriceOracle.deploy(deployer.address);
      await simplePriceOracle.deployed();
      
      priceOracleAddress = simplePriceOracle.address;
      updateContractAddress(chainId, "SimplePriceOracle", priceOracleAddress as Address);
      console.log("SimplePriceOracle deployed to:", priceOracleAddress);
    }
  }

  // Get gateway address from ZetaChain network configuration
  let gatewayAddress: string;
  
  if (chainId === 1337) {
    // For local development, use placeholder
    console.log("⚠️  Local network detected. Make sure ZetaChain gateway is properly configured.");
    gatewayAddress = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0"; // Placeholder for local
  } else if (chainId === 7001) {
    // ZetaChain Athens Testnet - Update with real gateway address from ZetaChain docs
    console.log("⚠️  Using placeholder gateway address for Athens testnet");
    console.log("TODO: Update with real ZetaChain Athens testnet gateway address");
    gatewayAddress = "0x6c8a96a6e7b5b4a8f9b7b4a8f9b7b4a8f9b7b4a8"; // UPDATE with real address
  } else if (chainId === 7000) {
    // ZetaChain Mainnet - Update with real gateway address from ZetaChain docs
    console.log("⚠️  Using placeholder gateway address for mainnet");
    console.log("TODO: Update with real ZetaChain mainnet gateway address");
    gatewayAddress = "0x6c8a96a6e7b5b4a8f9b7b4a8f9b7b4a8f9b7b4a8"; // UPDATE with real address
  } else {
    throw new Error(`Gateway address not configured for chain ${chainId}`);
  }

  console.log("Using gateway address:", gatewayAddress);
  if (chainId !== 1337) {
    console.log("⚠️  Make sure to update gateway address with real ZetaChain gateway before mainnet deployment");
  }

  // Deploy UniversalLendingProtocol
  console.log("\n=== Deploying UniversalLendingProtocol ===");
  
  const UniversalLendingProtocol = await ethers.getContractFactory("UniversalLendingProtocol");
  const universalLendingProtocol = await UniversalLendingProtocol.deploy(
    gatewayAddress,
    priceOracleAddress,
    deployer.address
  );

  await universalLendingProtocol.deployed();
  console.log("UniversalLendingProtocol deployed to:", universalLendingProtocol.address);

  // Update centralized contract registry
  updateContractAddress(chainId, "UniversalLendingProtocol", universalLendingProtocol.address as Address);

  // Configure allowed source chains (Arbitrum Sepolia and Ethereum Sepolia)
  console.log("\n=== Configuring Cross-Chain Settings ===");
  
  const allowedChains = [
    { chainId: 421614, name: "Arbitrum Sepolia" },
    { chainId: 11155111, name: "Ethereum Sepolia" }
  ];

  for (const chain of allowedChains) {
    console.log(`Setting chain ${chain.name} (${chain.chainId}) as allowed...`);
    await universalLendingProtocol.setAllowedSourceChain(chain.chainId, true);
  }

  // Add supported ZRC-20 assets from centralized configuration
  console.log("\n=== Adding Supported Assets ===");
  
  const assets = [
    {
      symbol: "ETH.ARBI",
      chainId: 421614,
      collateralFactor: ethers.utils.parseEther("0.8"), // 80%
      liquidationThreshold: ethers.utils.parseEther("0.85"), // 85%
      liquidationBonus: ethers.utils.parseEther("0.05") // 5%
    },
    {
      symbol: "USDC.ARBI", 
      chainId: 421614,
      collateralFactor: ethers.utils.parseEther("0.9"), // 90%
      liquidationThreshold: ethers.utils.parseEther("0.92"), // 92%
      liquidationBonus: ethers.utils.parseEther("0.03") // 3%
    },
    {
      symbol: "ETH.ETH",
      chainId: 11155111,
      collateralFactor: ethers.utils.parseEther("0.8"), // 80%
      liquidationThreshold: ethers.utils.parseEther("0.85"), // 85%
      liquidationBonus: ethers.utils.parseEther("0.05") // 5%
    },
    {
      symbol: "USDC.ETH",
      chainId: 11155111,
      collateralFactor: ethers.utils.parseEther("0.9"), // 90%
      liquidationThreshold: ethers.utils.parseEther("0.92"), // 92%
      liquidationBonus: ethers.utils.parseEther("0.03") // 3%
    }
  ];

  for (const asset of assets) {
    try {
      // Get token address from centralized configuration
      const tokenAddress = getTokenAddress(chainId, asset.symbol);
      
      console.log(`Adding ${asset.symbol} (${tokenAddress})...`);
      
      // Map ZRC-20 to its origin chain
      await universalLendingProtocol.mapZRC20Asset(
        tokenAddress,
        asset.chainId,
        asset.symbol
      );
      
      // Add as lending asset
      await universalLendingProtocol.addAsset(
        tokenAddress,
        asset.collateralFactor,
        asset.liquidationThreshold,
        asset.liquidationBonus
      );
      
      console.log(`✅ Added ${asset.symbol} as supported lending asset`);
      
    } catch (error) {
      console.log(`⚠️  Warning: Could not add ${asset.symbol} - ${error}`);
      console.log("Make sure ZRC-20 tokens are deployed and configured in contracts.json");
    }
  }

  // Set initial prices in oracle
  console.log("\n=== Setting Initial Asset Prices ===");
  
  try {
    const simplePriceOracle = await ethers.getContractAt("SimplePriceOracle", priceOracleAddress);
    
    const priceUpdates = [
      { symbol: "ETH.ARBI", price: 2000 }, // $2000
      { symbol: "USDC.ARBI", price: 1 },   // $1
      { symbol: "ETH.ETH", price: 2000 },  // $2000
      { symbol: "USDC.ETH", price: 1 }     // $1
    ];

    for (const update of priceUpdates) {
      try {
        const tokenAddress = getTokenAddress(chainId, update.symbol);
        await simplePriceOracle.setPrice(tokenAddress, update.price);
        console.log(`Set ${update.symbol} price to $${update.price}`);
      } catch (error) {
        console.log(`Warning: Could not set price for ${update.symbol}`);
      }
    }
  } catch (error) {
    console.log("Warning: Could not update asset prices");
  }

  // Save deployment info using DeploymentManager
  const deploymentInfo = {
    network: {
      name: getNetwork(chainId).name,
      chainId: chainId
    },
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      oracles: {
        SimplePriceOracle: priceOracleAddress
      },
      lending: {
        UniversalLendingProtocol: universalLendingProtocol.address
      },
      gateway: {
        GatewayZEVM: gatewayAddress
      }
    }
  };

  await deploymentManager.saveDeployment(deploymentInfo);

  console.log("\n=== Deployment Configuration Summary ===");
  console.log("UniversalLendingProtocol:", universalLendingProtocol.address);
  console.log("Gateway:", gatewayAddress);
  console.log("Price Oracle:", priceOracleAddress);
  console.log("Allowed Source Chains:", allowedChains.map(c => `${c.name} (${c.chainId})`).join(", "));

  // Update external chains with the lending protocol address in centralized config
  console.log("\n=== Updating External Chain Configurations ===");
  
  try {
    // Update external chain configs with the lending protocol address
    // This allows external DepositContracts to know where to send deposits
    const { updateLendingProtocolAddress } = await import("../utils/contracts");
    
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

  // Print deployment summary using both systems
  console.log("\n=== Deployment Summary (DeploymentManager) ===");
  await deploymentManager.printDeploymentSummary();
  
  console.log("\n=== Deployment Summary (Centralized Config) ===");
  printDeploymentSummary(chainId);

  console.log("\n✅ UniversalLendingProtocol deployment completed successfully!");
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