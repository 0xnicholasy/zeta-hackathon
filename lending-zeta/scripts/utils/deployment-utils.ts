import { ethers } from "hardhat";
import * as fs from "fs";
import { Contract } from "ethers";

export interface DeploymentInfo {
  network: {
    name: string;
    chainId: number;
  };
  deployer: string;
  timestamp: string;
  contracts: {
    [contractName: string]: string;
  } & {
    tokens: {
      [tokenSymbol: string]: string;
    };
  };
}

export class DeploymentManager {
  private chainId: bigint;
  private contractsJsonFile: string;

  constructor(chainId: bigint) {
    this.chainId = chainId;
    this.contractsJsonFile = `contracts.json`;
  }

  async loadDeployment(): Promise<DeploymentInfo | null> {
    if (!fs.existsSync(this.contractsJsonFile)) {
      console.log(`Contracts file ${this.contractsJsonFile} not found`);
      return null;
    }

    try {
      const data = fs.readFileSync(this.contractsJsonFile, 'utf8');
      const contractsData = JSON.parse(data);
      const chainIdString = this.chainId.toString();

      if (!contractsData.networks || !contractsData.networks[chainIdString]) {
        console.log(`Network ${chainIdString} not found in contracts.json`);
        return null;
      }

      const networkData = contractsData.networks[chainIdString];

      // Convert contracts.json format to DeploymentInfo format
      return {
        network: {
          name: networkData.name,
          chainId: networkData.chainId
        },
        deployer: contractsData.deployments?.deployer || "unknown",
        timestamp: contractsData.deployments?.lastUpdated || new Date().toISOString(),
        contracts: {
          ...networkData.contracts,
          tokens: networkData.tokens
        }
      };
    } catch (error) {
      console.error(`Error reading contracts file ${this.contractsJsonFile}:`, error);
      return null;
    }
  }

  async saveDeployment(_info: DeploymentInfo): Promise<void> {
    // This method is deprecated - use updateContractsJson instead
    console.warn("saveDeployment is deprecated. Use updateContractsJson instead.");
  }

  async verifyDeployment(): Promise<boolean> {
    const deployment = await this.loadDeployment();

    if (!deployment) {
      console.error("No deployment found");
      return false;
    }

    console.log("Verifying deployment...");

    try {
      // Check all contracts in the deployment
      for (const [contractName, address] of Object.entries(deployment.contracts)) {
        if (contractName === "tokens") {
          // Handle tokens separately
          if (typeof address === 'object' && address !== null) {
            for (const [tokenName, tokenAddress] of Object.entries(address)) {
              if (typeof tokenAddress === 'string' && tokenAddress !== "0x0000000000000000000000000000000000000000") {
                const code = await ethers.provider.getCode(tokenAddress);
                if (code === "0x") {
                  console.error(`Token ${tokenName} at ${tokenAddress} has no code`);
                  return false;
                }
                console.log(`✓ Token ${tokenName} verified at ${tokenAddress}`);
              }
            }
          }
        } else if (typeof address === 'string' && address !== "0x0000000000000000000000000000000000000000") {
          const code = await ethers.provider.getCode(address);
          if (code === "0x") {
            console.error(`Contract ${contractName} at ${address} has no code`);
            return false;
          }
          console.log(`✓ ${contractName} verified at ${address}`);
        }
      }

      console.log("✅ All contracts verified successfully");
      return true;

    } catch (error) {
      console.error("Verification failed:", error);
      return false;
    }
  }

  async getContractInstance(contractName: string): Promise<Contract> {
    const deployment = await this.loadDeployment();

    if (!deployment) {
      throw new Error("No deployment found");
    }

    let address: string;

    // Check if it's a token
    if (deployment.contracts.tokens && deployment.contracts.tokens[contractName]) {
      address = deployment.contracts.tokens[contractName];
    } else {
      // Check if it's a regular contract
      address = deployment.contracts[contractName];
    }

    if (!address || address === "0x0000000000000000000000000000000000000000") {
      throw new Error(`Contract ${contractName} not found in deployment`);
    }

    return await ethers.getContractAt(contractName, address);
  }

  async printDeploymentSummary(): Promise<void> {
    const deployment = await this.loadDeployment();

    if (!deployment) {
      console.log("No deployment found");
      return;
    }

    console.log("\n=== Deployment Summary ===");
    console.log(`Network: ${deployment.network.name} (${deployment.network.chainId})`);
    console.log(`Deployer: ${deployment.deployer}`);
    console.log(`Timestamp: ${deployment.timestamp}`);
    console.log("\nContracts:");

    for (const [name, address] of Object.entries(deployment.contracts)) {
      if (name === "tokens") {
        console.log(`  ${name}:`);
        if (typeof address === 'object' && address !== null) {
          for (const [tokenName, tokenAddress] of Object.entries(address)) {
            console.log(`    ${tokenName}: ${tokenAddress}`);
          }
        }
      } else if (typeof address === 'string') {
        console.log(`  ${name}: ${address}`);
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
      "SimpleLendingProtocol": 2500000,
      "LendingProtocol": 3500000,
      "PriceOracle": 600000,
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
        if (typeof address === 'string' && address !== "0x0000000000000000000000000000000000000000") {
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

  async updateContractsJson(contractName: string, contractAddress: string, deployerAddress: string): Promise<void> {
    console.log("\n=== Updating contracts.json ===");

    let contractsData: any;

    try {
      if (fs.existsSync(this.contractsJsonFile)) {
        contractsData = JSON.parse(fs.readFileSync(this.contractsJsonFile, 'utf8'));
      } else {
        console.warn(`${this.contractsJsonFile} not found, skipping update`);
        return;
      }
    } catch (error) {
      console.error(`Failed to read ${this.contractsJsonFile}:`, error);
      return;
    }

    // Update the contract address for the current network
    const chainIdString = this.chainId.toString();
    if (contractsData.networks && contractsData.networks[chainIdString]) {
      if (!contractsData.networks[chainIdString].contracts) {
        contractsData.networks[chainIdString].contracts = {};
      }

      contractsData.networks[chainIdString].contracts[contractName] = contractAddress;

      // Update deployment metadata
      if (!contractsData.deployments) {
        contractsData.deployments = {};
      }
      contractsData.deployments.lastUpdated = new Date().toISOString();
      contractsData.deployments.deployer = deployerAddress;

      try {
        fs.writeFileSync(this.contractsJsonFile, JSON.stringify(contractsData, null, 2));
        console.log(`✅ Updated ${contractName} address in ${this.contractsJsonFile}: ${contractAddress}`);
      } catch (error) {
        console.error(`Failed to write ${this.contractsJsonFile}:`, error);
      }
    } else {
      console.warn(`⚠️  Network ${chainIdString} not found in ${this.contractsJsonFile}`);
    }
  }
}

// CLI utility functions
export async function main() {
  const [_deployer] = await ethers.getSigners();
  const chainId = BigInt((await ethers.provider.getNetwork()).chainId);
  const manager = new DeploymentManager(chainId);

  const command = process.argv[2];

  switch (command) {
    case "verify":
      await manager.verifyDeployment();
      break;

    case "summary":
      await manager.printDeploymentSummary();
      break;

    case "gas":
      await manager.estimateGasCosts();
      break;

    case "balances":
      await manager.checkBalances();
      break;

    default:
      console.log("Usage: npx hardhat run scripts/deployment-utils.ts [verify|summary|gas|balances]");
      console.log("Commands:");
      console.log("  verify   - Verify all deployed contracts");
      console.log("  summary  - Show deployment summary");
      console.log("  gas      - Show gas cost estimates");
      console.log("  balances - Show account and token balances");
      break;
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}