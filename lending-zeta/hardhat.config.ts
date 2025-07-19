import "@nomicfoundation/hardhat-toolbox";
import "./tasks/deploy";
import "@zetachain/localnet/tasks";
import "@zetachain/toolkit/tasks";

import * as dotenv from "dotenv";
import { HardhatUserConfig } from "hardhat/config";

dotenv.config();

const config: HardhatUserConfig = {
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      chainId: 1337
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 1337,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : []
    },
    zeta_testnet: {
      url: "https://zetachain-athens-evm.blockpi.network/v1/rpc/public",
      chainId: 7001,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : []
    },
    zeta_mainnet: {
      url: "https://zetachain-evm.blockpi.network/v1/rpc/public",
      chainId: 7000,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : []
    },
    // External chain networks (for deposit contracts)
    "arbitrum-sepolia": {
      url: process.env.ARBITRUM_SEPOLIA_RPC_URL || `https://arb-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
      chainId: 421614,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
    "ethereum-sepolia": {
      url: process.env.ETHEREUM_SEPOLIA_RPC_URL || `https://eth-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
      chainId: 11155111,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : []
    }
  },
  solidity: {
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true,
    },
    version: "0.8.26",
  },
  etherscan: {
    apiKey: {
      "arbitrum-sepolia": process.env.ETHERSCAN_API_KEY || "",
      // add other networks if needed
    },
    customChains: [
      {
        network: "arbitrum-sepolia",
        chainId: 421614,
        urls: {
          apiURL: "https://api.etherscan.io/v2/api?chainid=421614",
          browserURL: "https://sepolia.arbiscan.io",
        }
      }
    ]
  }
};

export default config;
