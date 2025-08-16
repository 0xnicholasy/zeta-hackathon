import { ethers } from "hardhat";
import {
  getNetwork,
  updateContractAddress,
  printDeploymentSummary,
  Address
} from "../../utils/contracts";
import { DeploymentManager } from "../utils/deployment-utils";

async function main() {
  console.log("Adding Solana chain support to UniversalLendingProtocol...");

  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const chainId = network.chainId;

  // Initialize deployment manager
  const deploymentManager = new DeploymentManager(BigInt(chainId));

  console.log("Using account:", deployer.address);
  console.log("Network:", getNetwork(chainId).name);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.utils.formatEther(balance));

  // Ensure we're on ZetaChain
  if (chainId !== 7001 && chainId !== 7000) {
    throw new Error("This script should only be run on ZetaChain networks (7001 for testnet, 7000 for mainnet)");
  }

  // Get existing UniversalLendingProtocol contract
  let universalLendingProtocol;
  
  try {
    universalLendingProtocol = await deploymentManager.getContractInstance("UniversalLendingProtocol");
    console.log("Found UniversalLendingProtocol at:", universalLendingProtocol.address);
  } catch (error) {
    throw new Error("UniversalLendingProtocol not found. Please deploy it first using deploy-universal-lending.ts");
  }

  // Solana chains to add
  const solanaChains = [
    { chainId: 901, name: "Solana Devnet" },
    { chainId: 900, name: "Solana Mainnet" }
  ];

  console.log("\n=== Adding Solana Chain Support ===");

  for (const chain of solanaChains) {
    try {
      console.log(`Checking if chain ${chain.chainId} (${chain.name}) is already allowed...`);
      
      // Check if chain is already allowed
      const isAllowed = await universalLendingProtocol.isChainAllowed(chain.chainId);
      
      if (isAllowed) {
        console.log(`✅ Chain ${chain.chainId} (${chain.name}) is already allowed`);
      } else {
        console.log(`Adding chain ${chain.chainId} (${chain.name}) as allowed source chain...`);
        
        // Add the chain as allowed
        const tx = await universalLendingProtocol.setAllowedSourceChain(chain.chainId, true);
        await tx.wait();
        
        console.log(`✅ Successfully allowed cross-chain operations from ${chain.name} (${chain.chainId})`);
        console.log(`   Transaction hash: ${tx.hash}`);
      }
    } catch (error) {
      console.error(`❌ Error adding chain ${chain.chainId}: ${error}`);
    }
  }

  console.log("\n=== Verification ===");
  
  // Verify all Solana chains are now allowed
  for (const chain of solanaChains) {
    try {
      const isAllowed = await universalLendingProtocol.isChainAllowed(chain.chainId);
      console.log(`Chain ${chain.chainId} (${chain.name}): ${isAllowed ? '✅ Allowed' : '❌ Not Allowed'}`);
    } catch (error) {
      console.error(`Error checking chain ${chain.chainId}: ${error}`);
    }
  }

  console.log("\n✅ Solana chain support configuration completed!");
  console.log("\nSolana chains now supported:");
  console.log("• Chain ID 900: Solana Mainnet");
  console.log("• Chain ID 901: Solana Devnet");
  
  console.log("\nYou can now test cross-chain deposits from Solana using:");
  console.log("cd call/solana && bun run scripts/deposit-sol-gateway-final.ts");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });