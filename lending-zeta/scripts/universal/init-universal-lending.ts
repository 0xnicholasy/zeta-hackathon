import { ethers } from "hardhat";
import {
  getNetwork,
  getTokenAddress,
  printDeploymentSummary,
  Address
} from "../../utils/contracts";
import { DeploymentManager } from "../utils/deployment-utils";

const assets = [
  { symbol: "ETH.ARBI", chainId: 421614, price: 3000 }, // $3000
  { symbol: "USDC.ARBI", chainId: 421614, price: 1 },   // $1
  { symbol: "ETH.ETH", chainId: 11155111, price: 3000 }, // $3000
  { symbol: "USDC.POL", chainId: 80002, price: 1 },      // $1
  { symbol: "POL.POL", chainId: 80002, price: 0.5 },     // $0.5
  { symbol: "USDC.BSC", chainId: 97, price: 1 },        // $1
  { symbol: "BNB.BSC", chainId: 97, price: 600 },       // $600
  { symbol: "ETH.BASE", chainId: 84532, price: 3000 },  // $3000
  { symbol: "USDC.BASE", chainId: 84532, price: 1 }     // $1
];

async function main() {
  console.log("Starting UniversalLendingProtocol initialization...");

  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const chainId = network.chainId;

  // Initialize deployment manager
  const deploymentManager = new DeploymentManager(BigInt(chainId));

  console.log("Initializing with account:", deployer.address);
  console.log("Network:", getNetwork(chainId).name);

  // Ensure we're on ZetaChain
  if (chainId !== 7001 && chainId !== 7000) {
    throw new Error("UniversalLendingProtocol initialization should only be run on ZetaChain networks (7001 for testnet, 7000 for mainnet)");
  }

  // Get deployed contracts
  const priceOracle = await deploymentManager.getContractInstance("MockPriceOracle");
  const universalLendingProtocol = await deploymentManager.getContractInstance("UniversalLendingProtocol");

  console.log("Found UniversalLendingProtocol at:", universalLendingProtocol.address);
  console.log("Found MockPriceOracle at:", priceOracle.address);

  // Set prices for supported assets in price oracle
  console.log("\n=== Setting Asset Prices in Oracle ===");

  for (const asset of assets) {
    try {
      const tokenAddress = getTokenAddress(chainId, asset.symbol);

      console.log(`Setting price for ${asset.symbol} (${tokenAddress}): $${asset.price}`);

      // Convert price to 18 decimals for oracle (e.g., $3000 -> 3000 * 1e18)
      const priceInWei = ethers.utils.parseEther(asset.price.toString());
      await priceOracle.setPrice(tokenAddress, priceInWei);

      // Verify the price was set correctly
      const storedPrice = await priceOracle.getPrice(tokenAddress);
      const storedPriceFormatted = ethers.utils.formatEther(storedPrice);
      console.log(`✅ Set price for ${asset.symbol}: $${storedPriceFormatted}`);
    } catch (error) {
      console.log(`⚠️  Warning: Could not set price for ${asset.symbol} - ${error}`);
    }
  }

  // Add supported ZRC-20 assets from centralized configuration  
  console.log("\n=== Adding Supported Assets to Universal Protocol ===");

  // Set allowed source chains for cross-chain operations
  const allowedChains = [
    { chainId: 421614, name: "Arbitrum Sepolia" },
    { chainId: 11155111, name: "Ethereum Sepolia" },
    { chainId: 80002, name: "Polygon Amoy" },
    { chainId: 97, name: "BSC Testnet" },
    { chainId: 84532, name: "Base Sepolia" }
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

  console.log("\n=== Initialization Configuration Summary ===");
  console.log("UniversalLendingProtocol:", universalLendingProtocol.address);
  console.log("MockPriceOracle:", priceOracle.address);
  console.log(`Configured ${assets.length} assets and ${allowedChains.length} allowed chains`);

  console.log("\n=== Deployment Summary ===");
  printDeploymentSummary(chainId);

  console.log("\n✅ UniversalLendingProtocol initialization completed successfully!");
  console.log("\nNext steps:");
  console.log("1. Deploy DepositContracts on external chains using:");
  console.log("   npx hardhat run scripts/deposit-contract/deploy-deposit-contracts.ts universal --network arbitrum-sepolia");
  console.log("   npx hardhat run scripts/deposit-contract/deploy-deposit-contracts.ts universal --network ethereum-sepolia");
  console.log("   npx hardhat run scripts/deposit-contract/deploy-deposit-contracts.ts universal --network polygon-amoy");
  console.log("   npx hardhat run scripts/deposit-contract/deploy-deposit-contracts.ts universal --network bsc-testnet");
  console.log("   npx hardhat run scripts/deposit-contract/deploy-deposit-contracts.ts universal --network base-sepolia");
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