import type { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox-viem";
import { DEPLOYMENTS } from "./deployments";

// Get private key from environment
const PRIVATE_KEY = process.env.PRIVATE_KEY || "0x0000000000000000000000000000000000000000000000000000000000000000";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true,
    },
  },
  networks: {
    // Local development
    hardhat: {
      chainId: 1337,
    },
    localnet: {
      url: "http://127.0.0.1:8545",
      chainId: 1337,
      accounts: PRIVATE_KEY !== "0x0000000000000000000000000000000000000000000000000000000000000000" ? [PRIVATE_KEY] : [],
    },
    
    // ZetaChain networks
    "zeta-testnet": {
      url: DEPLOYMENTS["zeta-testnet"].rpcUrl,
      chainId: DEPLOYMENTS["zeta-testnet"].chainId,
      accounts: PRIVATE_KEY !== "0x0000000000000000000000000000000000000000000000000000000000000000" ? [PRIVATE_KEY] : [],
      gasPrice: "auto",
    },
    "zeta-mainnet": {
      url: DEPLOYMENTS["zeta-mainnet"].rpcUrl,
      chainId: DEPLOYMENTS["zeta-mainnet"].chainId,
      accounts: PRIVATE_KEY !== "0x0000000000000000000000000000000000000000000000000000000000000000" ? [PRIVATE_KEY] : [],
      gasPrice: "auto",
    },
  },
  etherscan: {
    apiKey: {
      "zeta-testnet": "dummy", // ZetaChain doesn't require API key
      "zeta-mainnet": "dummy",
    },
    customChains: [
      {
        network: "zeta-testnet",
        chainId: DEPLOYMENTS["zeta-testnet"].chainId,
        urls: {
          apiURL: "https://athens.explorer.zetachain.com/api",
          browserURL: DEPLOYMENTS["zeta-testnet"].explorer,
        },
      },
      {
        network: "zeta-mainnet", 
        chainId: DEPLOYMENTS["zeta-mainnet"].chainId,
        urls: {
          apiURL: "https://explorer.zetachain.com/api",
          browserURL: DEPLOYMENTS["zeta-mainnet"].explorer,
        },
      },
    ],
  },
};

export default config;
