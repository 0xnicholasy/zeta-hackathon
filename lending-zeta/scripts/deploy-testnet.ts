import { ethers } from "hardhat";
import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs";

const execAsync = promisify(exec);

async function main() {
  console.log("Starting testnet deployment...");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  const network = await ethers.provider.getNetwork();
  console.log("Network:", network.name, "Chain ID:", network.chainId);

  // Deploy SimpleLendingProtocol to testnet
  console.log("\n=== Deploying SimpleLendingProtocol to testnet ===");
  
  try {
    const deployCommand = "npx hardhat deploy --name SimpleLendingProtocol --network zeta_testnet --gateway 0x6c533f7fe93fae114d0954697069df33c9b74fd7 --json";
    
    console.log("Running deployment command:", deployCommand);
    const { stdout, stderr } = await execAsync(deployCommand);
    
    if (stderr) {
      console.error("Deployment stderr:", stderr);
    }
    
    // Parse the JSON output from the deployment
    const deploymentResult = JSON.parse(stdout.trim());
    console.log("Deployment result:", deploymentResult);
    
    // Create the deployment info in the expected format
    const deploymentInfo = {
      deployer: deploymentResult.deployer,
      network: {
        chainId: parseInt(deploymentResult.network === "zeta_testnet" ? "7001" : network.chainId.toString()),
        name: deploymentResult.network
      },
      timestamp: new Date().toISOString(),
      contracts: {
        SimpleLendingProtocol: deploymentResult.contractAddress,
        // Note: SimplePriceOracle and tokens would need separate deployments
        // This script focuses on the main lending contract
      }
    };

    // Save to simple-deployments-<chainid>.json
    const chainId = deploymentInfo.network.chainId;
    const filename = `simple-deployments-${chainId}.json`;
    
    fs.writeFileSync(filename, JSON.stringify(deploymentInfo, null, 2));
    
    console.log(`\n✅ Deployment completed successfully!`);
    console.log(`📜 Contract address: ${deploymentResult.contractAddress}`);
    console.log(`💾 Deployment info saved to: ${filename}`);
    console.log(`🔗 Transaction hash: ${deploymentResult.transactionHash}`);
    console.log("\nRun the following command to verify contract on explorer:");
    console.log(`npx hardhat verify --network ${deploymentResult.network} ${deploymentResult.contractAddress} "0x6c533f7fe93fae114d0954697069df33c9b74fd7" ${deploymentResult.deployer}`);
    
  } catch (error) {
    console.error("Deployment failed:", error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });