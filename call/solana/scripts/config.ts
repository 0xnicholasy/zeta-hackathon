import { PublicKey } from "@solana/web3.js";
import fs from "fs";
import path from "path";

export type Network = "devnet" | "mainnet";

export interface SolanaConfig {
  rpcUrl: string;
  commitment: string;
}

export interface ZetaChainConfig {
  chainId: number;
  blockpiUrl: string;
  explorerUrl: string;
}

export interface GatewayConfig {
  programId: string;
  pdaSeeds: string[];
}

export interface ZetaChainContractConfig {
  universalLendingProtocol: string;
}

export interface TokenConfig {
  mint?: string;
  decimals: number;
  symbol: string;
}

export interface TransactionConfig {
  minBalance: number;
  solDepositAmount: number;
  solFeeAmount: number;
  usdcDepositAmount: number;
}

export interface ExplorerConfig {
  solana: string;
}

export interface NetworkConfig {
  solana: SolanaConfig;
  zetachain: ZetaChainConfig;
}

export interface ContractConfig {
  gateway: GatewayConfig;
  zetachain: ZetaChainContractConfig;
}

export interface Config {
  networks: Record<Network, NetworkConfig>;
  contracts: Record<Network, ContractConfig>;
  tokens: Record<Network, Record<string, TokenConfig>>;
  transaction: Record<Network, TransactionConfig>;
  explorer: Record<Network, ExplorerConfig>;
}

class ConfigManager {
  private config: Config;
  private network: Network;

  constructor(network: Network = "devnet") {
    this.network = network;
    this.config = this.loadConfig();
  }

  private loadConfig(): Config {
    const configPath = path.join(__dirname, "config.json");
    
    if (!fs.existsSync(configPath)) {
      throw new Error(`Configuration file not found at ${configPath}`);
    }

    try {
      const configData = fs.readFileSync(configPath, "utf8");
      const config = JSON.parse(configData) as Config;
      
      // Validate required fields
      this.validateConfig(config);
      
      return config;
    } catch (error) {
      throw new Error(`Failed to load configuration: ${error}`);
    }
  }

  private validateConfig(config: Config): void {
    if (!config.networks?.[this.network]) {
      throw new Error(`Network configuration not found for ${this.network}`);
    }
    
    if (!config.contracts?.[this.network]) {
      throw new Error(`Contract configuration not found for ${this.network}`);
    }
    
    if (!config.tokens?.[this.network]) {
      throw new Error(`Token configuration not found for ${this.network}`);
    }
  }

  // Network configurations
  getSolanaConfig(): SolanaConfig {
    return this.config.networks[this.network].solana;
  }

  getZetaChainConfig(): ZetaChainConfig {
    return this.config.networks[this.network].zetachain;
  }

  // Contract configurations
  getGatewayConfig(): GatewayConfig {
    return this.config.contracts[this.network].gateway;
  }

  getGatewayProgramId(): PublicKey {
    const config = this.getGatewayConfig();
    return new PublicKey(config.programId);
  }

  getGatewayPDA(): PublicKey {
    const config = this.getGatewayConfig();
    const gatewayProgramId = this.getGatewayProgramId();
    
    const seeds = config.pdaSeeds.map(seed => Buffer.from(seed, "utf8"));
    const [pda] = PublicKey.findProgramAddressSync(seeds, gatewayProgramId);
    
    return pda;
  }

  getZetaChainContractConfig(): ZetaChainContractConfig {
    return this.config.contracts[this.network].zetachain;
  }

  getUniversalLendingProtocolAddress(): string {
    return this.getZetaChainContractConfig().universalLendingProtocol;
  }

  // Token configurations
  getTokenConfig(tokenSymbol: string): TokenConfig {
    const tokens = this.config.tokens[this.network];
    const tokenConfig = tokens[tokenSymbol.toLowerCase()];
    
    if (!tokenConfig) {
      throw new Error(`Token configuration not found for ${tokenSymbol} on ${this.network}`);
    }
    
    return tokenConfig;
  }

  getTokenMint(tokenSymbol: string): PublicKey | null {
    const tokenConfig = this.getTokenConfig(tokenSymbol);
    return tokenConfig.mint ? new PublicKey(tokenConfig.mint) : null;
  }

  getUSDCConfig(): TokenConfig {
    return this.getTokenConfig("usdc");
  }

  getSOLConfig(): TokenConfig {
    return this.getTokenConfig("sol");
  }

  // Transaction configurations
  getTransactionConfig(): TransactionConfig {
    return this.config.transaction[this.network];
  }

  getMinBalance(): number {
    return this.getTransactionConfig().minBalance;
  }

  getSOLDepositAmount(): number {
    return this.getTransactionConfig().solDepositAmount;
  }

  getSOLFeeAmount(): number {
    return this.getTransactionConfig().solFeeAmount;
  }

  getUSDCDepositAmount(): number {
    return this.getTransactionConfig().usdcDepositAmount;
  }

  // Explorer configurations
  getSolanaExplorerUrl(signature: string): string {
    const template = this.config.explorer[this.network].solana;
    return template.replace("{signature}", signature);
  }

  getZetaChainCCTXUrl(signature: string): string {
    const zetaConfig = this.getZetaChainConfig();
    return `${zetaConfig.blockpiUrl}/${signature}`;
  }

  // Utility methods
  getNetwork(): Network {
    return this.network;
  }

  setNetwork(network: Network): void {
    this.network = network;
    // Reload config to validate new network
    this.config = this.loadConfig();
  }

  // Get all configuration for debugging
  getFullConfig(): Config {
    return this.config;
  }
}

// Export singleton instance
export const config = new ConfigManager();

// Export factory function for custom network
export function createConfig(network: Network): ConfigManager {
  return new ConfigManager(network);
}