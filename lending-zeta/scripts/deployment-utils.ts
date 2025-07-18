import { ethers } from "hardhat";
import * as fs from "fs";

export interface DeploymentInfo {
  network: any;
  deployer: string;
  timestamp: string;
  contracts: {
    tokens?: {
      [key: string]: string;
    };
    oracles?: {
      [key: string]: string;
    };
    lending?: {
      [key: string]: string;
    };
    [key: string]: any;
  };
}

export class DeploymentManager {
  private chainId: bigint;
  private deploymentFile: string;
  private simpleDeploymentFile: string;

  constructor(chainId: bigint) {
    this.chainId = chainId;
    this.deploymentFile = `deployments-${chainId}.json`;
    this.simpleDeploymentFile = `simple-deployments-${chainId}.json`;
  }

  async loadDeployment(simple: boolean = false): Promise<DeploymentInfo | null> {
    const file = simple ? this.simpleDeploymentFile : this.deploymentFile;

    if (!fs.existsSync(file)) {
      console.log(`Deployment file ${file} not found`);
      return null;
    }

    try {
      const data = fs.readFileSync(file, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error(`Error reading deployment file ${file}:`, error);
      return null;
    }
  }

  async saveDeployment(info: DeploymentInfo, simple: boolean = false): Promise<void> {
    const file = simple ? this.simpleDeploymentFile : this.deploymentFile;

    try {
      fs.writeFileSync(file, JSON.stringify(info, null, 2));
      console.log(`Deployment info saved to ${file}`);
    } catch (error) {
      console.error(`Error saving deployment file ${file}:`, error);
    }
  }

  async verifyDeployment(simple: boolean = false): Promise<boolean> {
    const deployment = await this.loadDeployment(simple);

    if (!deployment) {
      console.error("No deployment found");
      return false;
    }

    console.log("Verifying deployment...");

    try {
      // Check if contracts exist and are deployed
      const requiredContracts = simple
        ? ["SimpleLendingProtocol", "SimplePriceOracle"]
        : ["LendingProtocol", "PriceOracle"];

      for (const contractName of requiredContracts) {
        let address: string;

        if (simple) {
          address = deployment.contracts[contractName];
        } else {
          const category = contractName.includes("Oracle") ? "oracles" : "lending";
          address = deployment.contracts[category]?.[contractName] || "";
        }

        if (!address) {
          console.error(`Contract ${contractName} address not found`);
          return false;
        }

        const code = await ethers.provider.getCode(address);
        if (code === "0x") {
          console.error(`Contract ${contractName} at ${address} has no code`);
          return false;
        }

        console.log(`✓ ${contractName} verified at ${address}`);
      }

      // Check tokens
      if (deployment.contracts.tokens) {
        for (const [tokenName, address] of Object.entries(deployment.contracts.tokens)) {
          const code = await ethers.provider.getCode(address);
          if (code === "0x") {
            console.error(`Token ${tokenName} at ${address} has no code`);
            return false;
          }
          console.log(`✓ Token ${tokenName} verified at ${address}`);
        }
      }

      console.log("✅ All contracts verified successfully");
      return true;

    } catch (error) {
      console.error("Verification failed:", error);
      return false;
    }
  }

  async getContractInstance(contractName: string, simple: boolean = false) {
    const deployment = await this.loadDeployment(simple);

    if (!deployment) {
      throw new Error("No deployment found");
    }

    let address: string;

    if (simple) {
      address = deployment.contracts[contractName];
    } else {
      // Determine category
      let category: string;
      if (contractName.includes("Oracle")) {
        category = "oracles";
      } else if (contractName.includes("Lending")) {
        category = "lending";
      } else {
        category = "tokens";
      }

      address = deployment.contracts[category]?.[contractName];
    }

    if (!address) {
      throw new Error(`Contract ${contractName} not found in deployment`);
    }

    return await ethers.getContractAt(contractName, address);
  }

  async printDeploymentSummary(simple: boolean = false): Promise<void> {
    const deployment = await this.loadDeployment(simple);

    if (!deployment) {
      console.log("No deployment found");
      return;
    }

    console.log("\n=== Deployment Summary ===");
    console.log(`Network: ${deployment.network.name} (${deployment.network.chainId})`);
    console.log(`Deployer: ${deployment.deployer}`);
    console.log(`Timestamp: ${deployment.timestamp}`);
    console.log("\nContracts:");

    if (simple) {
      for (const [name, address] of Object.entries(deployment.contracts)) {
        if (typeof address === 'string') {
          console.log(`  ${name}: ${address}`);
        }
      }
    } else {
      for (const [category, contracts] of Object.entries(deployment.contracts)) {
        console.log(`  ${category}:`);
        if (typeof contracts === 'object' && contracts !== null) {
          for (const [name, address] of Object.entries(contracts)) {
            console.log(`    ${name}: ${address}`);
          }
        }
      }
    }
  }

  async estimateGasCosts(): Promise<void> {
    console.log("\n=== Gas Cost Estimation ===");

    // Get gas price
    const gasPrice = await ethers.provider.getGasPrice();
    console.log(`Current gas price: ${ethers.utils.formatUnits(gasPrice, "gwei")} gwei`);

    // Estimate deployment costs
    const estimatedCosts = {
      "MockZRC20": 800000,
      "SimplePriceOracle": 400000,
      "PriceOracle": 600000,
      "SimpleLendingProtocol": 2500000,
      "LendingProtocol": 3500000,
    };

    console.log("\nEstimated deployment costs:");
    let totalGas = 0;

    for (const [contract, gas] of Object.entries(estimatedCosts)) {
      const cost = gasPrice.mul(BigInt(gas));
      console.log(`  ${contract}: ${gas.toLocaleString()} gas (${ethers.utils.formatEther(cost)} ETH)`);
      totalGas += gas;
    }

    const totalCost = gasPrice.mul(BigInt(totalGas));
    console.log(`\nTotal estimated cost: ${totalGas.toLocaleString()} gas (${ethers.utils.formatEther(totalCost)} ETH)`);
  }

  async checkBalances(): Promise<void> {
    const [deployer] = await ethers.getSigners();
    const balance = await ethers.provider.getBalance(deployer.address);

    console.log("\n=== Account Balances ===");
    console.log(`Deployer (${deployer.address}): ${ethers.utils.formatEther(balance)} ETH`);

    const deployment = await this.loadDeployment();
    if (deployment && deployment.contracts.tokens) {
      console.log("\nToken balances:");
      for (const [tokenName, address] of Object.entries(deployment.contracts.tokens)) {
        try {
          const token = await ethers.getContractAt("MockZRC20", address);
          const balance = await token.balanceOf(deployer.address);
          const decimals = await token.decimals();
          console.log(`  ${tokenName}: ${ethers.utils.formatUnits(balance, decimals)}`);
        } catch (error) {
          console.log(`  ${tokenName}: Error reading balance`);
        }
      }
    }
  }
}

// CLI utility functions
export async function main() {
  const [deployer] = await ethers.getSigners();
  const chainId = BigInt((await ethers.provider.getNetwork()).chainId);
  const manager = new DeploymentManager(chainId);

  const command = process.argv[2];

  switch (command) {
    case "verify":
      const simple = process.argv[3] === "simple";
      await manager.verifyDeployment(simple);
      break;

    case "summary":
      const summarySimple = process.argv[3] === "simple";
      await manager.printDeploymentSummary(summarySimple);
      break;

    case "gas":
      await manager.estimateGasCosts();
      break;

    case "balances":
      await manager.checkBalances();
      break;

    default:
      console.log("Usage: npx hardhat run scripts/deployment-utils.ts [verify|summary|gas|balances] [simple]");
      console.log("Commands:");
      console.log("  verify [simple]  - Verify all deployed contracts");
      console.log("  summary [simple] - Show deployment summary");
      console.log("  gas             - Show gas cost estimates");
      console.log("  balances        - Show account and token balances");
      break;
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}