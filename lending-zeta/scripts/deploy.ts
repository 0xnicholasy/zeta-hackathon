import { parseEther, parseUnits } from "ethers/src.ts/utils";
import { ethers } from "hardhat";
import {
  updateContractAddress,
  updateTokenAddress,
  printDeploymentSummary,
  getNetwork
} from "../utils/contracts";

async function main() {
  console.log("Starting deployment...");

  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const chainId = network.chainId;

  console.log("Deploying with account:", deployer.address);
  console.log("Network:", getNetwork(chainId).name);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.utils.formatEther(balance));

  // Deploy Mock ZRC20 tokens for testing
  console.log("\n=== Deploying Mock ZRC20 Tokens ===");

  const MockZRC20 = await ethers.getContractFactory("MockZRC20");

  const ethArbi = await MockZRC20.deploy("Ethereum Arbitrum", "ETH.ARBI", 18, parseEther("1000000"));
  await ethArbi.deployed();
  console.log("ETH.ARBI deployed to:", ethArbi.address);
  updateTokenAddress(chainId, "ETH.ARBI", ethArbi.address as `0x${string}`);

  const usdcArbi = await MockZRC20.deploy("USD Coin Arbitrum", "USDC.ARBI", 6, parseUnits("1000000", 6));
  await usdcArbi.deployed();
  console.log("USDC.ARBI deployed to:", usdcArbi.address);
  updateTokenAddress(chainId, "USDC.ARBI", usdcArbi.address as `0x${string}`);

  const ethEth = await MockZRC20.deploy("Ethereum Ethereum", "ETH.ETH", 18, parseEther("1000000"));
  await ethEth.deployed();
  console.log("ETH.ETH deployed to:", ethEth.address);
  updateTokenAddress(chainId, "ETH.ETH", ethEth.address as `0x${string}`);

  const usdcEth = await MockZRC20.deploy("USD Coin Ethereum", "USDC.ETH", 6, parseUnits("1000000", 6));
  await usdcEth.deployed();
  console.log("USDC.ETH deployed to:", usdcEth.address);
  updateTokenAddress(chainId, "USDC.ETH", usdcEth.address as `0x${string}`);

  // Deploy Price Oracle
  console.log("\n=== Deploying Price Oracle ===");

  const PriceOracle = await ethers.getContractFactory("PriceOracle");
  const priceOracle = await PriceOracle.deploy(deployer.address);
  await priceOracle.deployed();
  console.log("PriceOracle deployed to:", priceOracle.address);
  updateContractAddress(chainId, "PriceOracle", priceOracle.address as `0x${string}`, deployer.address as `0x${string}`);

  // Deploy Mock Price Oracle for testing
  const MockPriceOracle = await ethers.getContractFactory("MockPriceOracle");
  const mockPriceOracle = await MockPriceOracle.deploy();
  await mockPriceOracle.deployed();
  console.log("MockPriceOracle deployed to:", mockPriceOracle.address);
  updateContractAddress(chainId, "MockPriceOracle", mockPriceOracle.address as `0x${string}`);

  // Deploy Simple Price Oracle for testing
  const SimplePriceOracle = await ethers.getContractFactory("SimplePriceOracle");
  const simplePriceOracle = await SimplePriceOracle.deploy(deployer.address);
  await simplePriceOracle.deployed();
  console.log("SimplePriceOracle deployed to:", simplePriceOracle.address);
  updateContractAddress(chainId, "SimplePriceOracle", simplePriceOracle.address as `0x${string}`);

  // Deploy Main Lending Protocol
  console.log("\n=== Deploying Main Lending Protocol ===");

  const LendingProtocol = await ethers.getContractFactory("LendingProtocol");
  const lendingProtocol = await LendingProtocol.deploy(
    priceOracle.address,
    deployer.address
  );
  await lendingProtocol.deployed();
  console.log("LendingProtocol deployed to:", lendingProtocol.address);
  updateContractAddress(chainId, "LendingProtocol", lendingProtocol.address as `0x${string}`);

  // Deploy Simple Lending Protocol for testing
  console.log("\n=== Deploying Simple Lending Protocol ===");

  const SimpleLendingProtocol = await ethers.getContractFactory("SimpleLendingProtocol");
  const simpleLendingProtocol = await SimpleLendingProtocol.deploy(deployer.address);
  await simpleLendingProtocol.deployed();
  console.log("SimpleLendingProtocol deployed to:", simpleLendingProtocol.address);
  updateContractAddress(chainId, "SimpleLendingProtocol", simpleLendingProtocol.address as `0x${string}`);

  // Deploy Universal contract (if needed)
  console.log("\n=== Deploying Universal Contract ===");

  try {
    const Universal = await ethers.getContractFactory("Universal");
    const universal = await Universal.deploy(deployer.address);
    await universal.deployed();
    console.log("Universal deployed to:", universal.address);
    updateContractAddress(chainId, "Universal", universal.address as `0x${string}`);
  } catch (error) {
    console.log("Universal contract deployment skipped (may require gateway address)");
  }

  // Print deployment summary using centralized function
  printDeploymentSummary(chainId);

  console.log("\n✅ Deployment completed successfully!");
  console.log("Run the initialization script next to set up the protocol.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });