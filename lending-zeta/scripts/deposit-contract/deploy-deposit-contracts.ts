import { ethers } from "hardhat";
import {
  getNetwork,
  getContractAddress,
  updateContractAddress,
  Address
} from "../../utils/contracts";
import {
  ZETA_CHAIN_IDS,
  parseProtocolArgs,
  displayScriptHeader,
  displayNetworkInfo,
  getLendingProtocolAddress,
  displaySummary,
  displaySuccess
} from "./script-helpers";

async function main() {
  // Parse protocol type from command line arguments
  const protocolConfig = parseProtocolArgs();
  
  // Display script header
  displayScriptHeader("Deploy DepositContract", protocolConfig);

  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const chainId = network.chainId;
  const balance = await ethers.provider.getBalance(deployer.address);

  // Display network information
  await displayNetworkInfo(chainId, deployer.address, balance);

  // Get gateway address from centralized config
  let gatewayAddress: string;
  try {
    gatewayAddress = getContractAddress(chainId, "Gateway");
  } catch (error) {
    throw new Error(`Gateway address not configured for chain ${chainId}. Update contracts.json first.`);
  }

  // Get network config for the current chain (for gateway and tokens)
  const networkConfig = getNetwork(chainId);

  // Get lending protocol address from ZetaChain network config (where the protocol is deployed)
  // Use testnet by default, change to mainnet for production
  const zetaChainId = ZETA_CHAIN_IDS.testnet;
  const lendingProtocolAddress = getLendingProtocolAddress(
    protocolConfig.protocolContractName,
    zetaChainId
  );

  console.log("\n📋 Contract Configuration:");
  console.log("-".repeat(30));
  console.log(`Gateway address: ${gatewayAddress}`);
  console.log(`${protocolConfig.protocolContractName} address: ${lendingProtocolAddress}`);
  console.log(`ZetaChain ID: ${zetaChainId}`);

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

    for (const [symbol, tokenConfig] of Object.entries(networkTokens)) {
      // Skip ZRC-20 tokens (with dots in symbol) - only add native tokens
      if (symbol.includes('.')) {
        continue;
      }

      const tokenAddress = (tokenConfig as any).address;
      const tokenDecimals = (tokenConfig as any).decimals;
      const isNative = symbol === "ETH" || symbol === "BNB" || symbol === "POL";

      console.log(`Adding ${symbol} (${tokenAddress}) with ${tokenDecimals} decimals, native: ${isNative}`);

      const tx = await depositContract.addSupportedAsset(
        tokenAddress,
        tokenDecimals,
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
  for (const [symbol, tokenConfig] of Object.entries(networkTokens)) {
    // Skip ZRC-20 tokens (with dots in symbol)
    if (symbol.includes('.')) {
      continue;
    }

    const tokenAddress = (tokenConfig as any).address;
    const isSupported = await depositContract.isAssetSupported(tokenAddress);
    console.log(`  ${symbol} (${tokenAddress}): ${isSupported ? "✅" : "❌"}`);
  }

  console.log("\n📊 Deployment Summary:");
  console.log("=".repeat(50));
  console.log(`Network: ${networkConfig.name} (${chainId})`);
  console.log(`DepositContract: ${depositContract.address}`);
  console.log(`Gateway: ${gatewayAddress}`);
  console.log(`Lending Protocol: ${lendingProtocolAddress}`);
  console.log(`ZetaChain ID: ${zetaChainId}`);
  console.log(`Deployer: ${deployer.address}`);

  displaySuccess("DepositContract deployment", protocolConfig.protocolType);
  console.log(`You can now deposit assets from this chain to the ZetaChain ${protocolConfig.protocolType} lending protocol.`);
  console.log("\n📋 Verification Command:");
  console.log("-".repeat(30));
  console.log(`npx hardhat verify --network ${networkConfig.name} ${depositContract.address} ${gatewayAddress} ${lendingProtocolAddress} ${zetaChainId} ${deployer.address}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });