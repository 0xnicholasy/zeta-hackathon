// Deposit Contract Deployments Configuration
// This file tracks deployed deposit contracts on external chains

export interface DepositContractDeployment {
  chainId: number;
  name: string;
  contracts: {
    DepositContract: string;
    Gateway: string;
  };
  assets: {
    [symbol: string]: {
      address: string;
      decimals: number;
      isNative: boolean;
    };
  };
  lendingProtocolAddress: string; // Address on ZetaChain
  zetaChainId: number;
}

export const DEPOSIT_DEPLOYMENTS: Record<string, DepositContractDeployment> = {
  // Arbitrum Sepolia (Testnet)
  "arbitrum-sepolia": {
    chainId: 421614,
    name: "Arbitrum Sepolia",
    contracts: {
      DepositContract: "0x0000000000000000000000000000000000000000", // UPDATE AFTER DEPLOYMENT
      Gateway: "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0", // UPDATE WITH ACTUAL GATEWAY
    },
    assets: {
      ETH: {
        address: "0x1de70f3e971B62A0707dA18100392af14f7fB677",
        decimals: 18,
        isNative: true,
      },
      USDC: {
        address: "0x4bC32034caCcc9B7e02536945eDbC286bACbA073", // Arbitrum Sepolia USDC
        decimals: 6,
        isNative: false,
      },
    },
    lendingProtocolAddress: "0x0000000000000000000000000000000000000000", // UPDATE WITH ZETA DEPLOYMENT
    zetaChainId: 7001, // ZetaChain Athens Testnet
  },

  // Ethereum Sepolia (Testnet)
  "ethereum-sepolia": {
    chainId: 11155111,
    name: "Ethereum Sepolia",
    contracts: {
      DepositContract: "0x0000000000000000000000000000000000000000", // UPDATE AFTER DEPLOYMENT
      Gateway: "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0", // UPDATE WITH ACTUAL GATEWAY
    },
    assets: {
      ETH: {
        address: "0x05BA149A7bd6dC1F937fA9046A9e05C05f3b18b0",
        decimals: 18,
        isNative: true,
      },
      USDC: {
        address: "0xcC683A782f4B30c138787CB5576a86AF66fdc31d", // Ethereum Sepolia USDC
        decimals: 6,
        isNative: false,
      },
    },
    lendingProtocolAddress: "0x0000000000000000000000000000000000000000", // UPDATE WITH ZETA DEPLOYMENT
    zetaChainId: 7001, // ZetaChain Athens Testnet
  },
};

// Helper functions
export function getDepositContractAddress(network: string): string {
  const deployment = DEPOSIT_DEPLOYMENTS[network];
  if (!deployment) {
    throw new Error(`Deployment not found for network: ${network}`);
  }
  
  const address = deployment.contracts.DepositContract;
  if (address === "0x0000000000000000000000000000000000000000") {
    throw new Error(`DepositContract not deployed on network: ${network}`);
  }
  
  return address;
}

export function getGatewayAddress(network: string): string {
  const deployment = DEPOSIT_DEPLOYMENTS[network];
  if (!deployment) {
    throw new Error(`Deployment not found for network: ${network}`);
  }
  
  return deployment.contracts.Gateway;
}

export function getSupportedAssets(network: string): Record<string, { address: string; decimals: number; isNative: boolean }> {
  const deployment = DEPOSIT_DEPLOYMENTS[network];
  if (!deployment) {
    throw new Error(`Deployment not found for network: ${network}`);
  }
  
  return deployment.assets;
}

export function validateDepositDeployment(network: string): { isValid: boolean; missingContracts: string[]; missingAssets: string[] } {
  const deployment = DEPOSIT_DEPLOYMENTS[network];
  if (!deployment) {
    return { isValid: false, missingContracts: ["deployment"], missingAssets: [] };
  }

  const missingContracts: string[] = [];
  const missingAssets: string[] = [];

  // Check contracts
  if (deployment.contracts.DepositContract === "0x0000000000000000000000000000000000000000") {
    missingContracts.push("DepositContract");
  }
  if (deployment.contracts.Gateway === "0x0000000000000000000000000000000000000000") {
    missingContracts.push("Gateway");
  }
  if (deployment.lendingProtocolAddress === "0x0000000000000000000000000000000000000000") {
    missingContracts.push("LendingProtocol");
  }

  // Check assets
  for (const [symbol, asset] of Object.entries(deployment.assets)) {
    if (asset.address === "0x0000000000000000000000000000000000000000" && !asset.isNative) {
      missingAssets.push(symbol);
    }
  }

  return {
    isValid: missingContracts.length === 0 && missingAssets.length === 0,
    missingContracts,
    missingAssets,
  };
}

export function getDeploymentByChainId(chainId: number): DepositContractDeployment | undefined {
  return Object.values(DEPOSIT_DEPLOYMENTS).find(deployment => deployment.chainId === chainId);
}

export function getAllNetworks(): string[] {
  return Object.keys(DEPOSIT_DEPLOYMENTS);
}

export function getTestnetNetworks(): string[] {
  return Object.keys(DEPOSIT_DEPLOYMENTS).filter(network => 
    DEPOSIT_DEPLOYMENTS[network].zetaChainId === 7001
  );
}

export function getMainnetNetworks(): string[] {
  return Object.keys(DEPOSIT_DEPLOYMENTS).filter(network => 
    DEPOSIT_DEPLOYMENTS[network].zetaChainId === 7000
  );
}