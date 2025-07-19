import { ethers } from "hardhat";
import {
  getNetwork,
  getContractAddress,
  updateContractAddress,
  Address
} from "../utils/contracts";

const ZETA_CHAIN_IDS = {
  testnet: 7001,
  mainnet: 7000,
};

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const chainId = network.chainId;

  console.log("Deploying DepositContract on:", getNetwork(chainId).name);
  console.log("Deploying with account:", deployer.address);
  console.log("Account balance:", ethers.utils.formatEther(await deployer.getBalance()));

  // Get gateway address from centralized config
  let gatewayAddress: string;
  try {
    gatewayAddress = getContractAddress(chainId, "Gateway");
  } catch (error) {
    throw new Error(`Gateway address not configured for chain ${chainId}. Update contracts.json first.`);
  }

  // Get lending protocol address from current network config
  const networkConfig = getNetwork(chainId);
  let lendingProtocolAddress: string;

  if (networkConfig.lendingProtocolAddress && networkConfig.lendingProtocolAddress !== "0x0000000000000000000000000000000000000000") {
    lendingProtocolAddress = networkConfig.lendingProtocolAddress;
  } else {
    throw new Error(`Lending protocol address not configured for ${networkConfig.name}. Deploy to ZetaChain first and update contracts.json.`);
  }

  // Use testnet by default, change to mainnet for production
  const zetaChainId = ZETA_CHAIN_IDS.testnet;

  console.log("Gateway address:", gatewayAddress);
  console.log("Lending protocol address:", lendingProtocolAddress);
  console.log("ZetaChain ID:", zetaChainId);

  // Deploy DepositContract
  const DepositContract = await ethers.getContractFactory("DepositContract");
  const depositContract = await DepositContract.deploy(
    gatewayAddress,
    lendingProtocolAddress,
    zetaChainId,
    deployer.address
  );

  await depositContract.deployed();

  console.log("DepositContract deployed to:", depositContract.address);

  // Update centralized contract registry
  updateContractAddress(chainId, "DepositContract", depositContract.address as Address);

  // Add supported assets for this network from centralized config
  const networkTokens = networkConfig.tokens;
  if (networkTokens && Object.keys(networkTokens).length > 0) {
    console.log("Adding supported assets...");

    for (const [symbol, address] of Object.entries(networkTokens)) {
      // Skip ZRC-20 tokens (with dots in symbol) - only add native tokens
      if (symbol.includes('.')) {
        continue;
      }

      const isNative = symbol === "ETH";
      const decimals = symbol === "USDC" ? 6 : 18;

      console.log(`Adding ${symbol} (${address}) with ${decimals} decimals, native: ${isNative}`);

      const tx = await depositContract.addSupportedAsset(
        address,
        decimals,
        isNative
      );
      await tx.wait();

      console.log(`✅ Added ${symbol} as supported asset`);
    }
  } else {
    console.log("⚠️  No assets configured for this network");
  }

  // Verify deployment
  console.log("\n📋 Verifying Asset Support:");
  for (const [symbol, address] of Object.entries(networkTokens)) {
    // Skip ZRC-20 tokens (with dots in symbol)
    if (symbol.includes('.')) {
      continue;
    }

    const isSupported = await depositContract.isAssetSupported(address);
    console.log(`  ${symbol} (${address}): ${isSupported ? "✅" : "❌"}`);
  }

  console.log("\n📊 Deployment Summary:");
  console.log("=".repeat(50));
  console.log(`Network: ${networkConfig.name} (${chainId})`);
  console.log(`DepositContract: ${depositContract.address}`);
  console.log(`Gateway: ${gatewayAddress}`);
  console.log(`Lending Protocol: ${lendingProtocolAddress}`);
  console.log(`ZetaChain ID: ${zetaChainId}`);
  console.log(`Deployer: ${deployer.address}`);

  console.log("\n✅ Deposit contract deployment completed successfully!");
  console.log("You can now deposit assets from this chain to the ZetaChain lending protocol.");
  console.log("Run the following command to verify contract on etherscan:");
  console.log(`npx hardhat verify --network ${networkConfig.name} ${depositContract.address} ${gatewayAddress} ${lendingProtocolAddress} ${zetaChainId} ${deployer.address}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

// Export for potential use in other scripts
export { ZETA_CHAIN_IDS };