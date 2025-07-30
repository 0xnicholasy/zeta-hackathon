import { ethers } from "hardhat";
import { getTokenAddress } from "../utils/contracts";
import hre from "hardhat";

// Define all supported tokens with their properties
const SUPPORTED_TOKENS = [
  { symbol: "ETH.ARBI", decimals: 18 },
  { symbol: "USDC.ARBI", decimals: 6 },
  { symbol: "ETH.ETH", decimals: 18 },
  { symbol: "USDC.POL", decimals: 6 },
  { symbol: "POL.POL", decimals: 18 },
  { symbol: "USDC.BSC", decimals: 6 },
  { symbol: "BNB.BSC", decimals: 18 },
  { symbol: "ETH.BASE", decimals: 18 },
  { symbol: "USDC.BASE", decimals: 6 }
];

// Get network configurations from hardhat config
function getNetworkConfigs() {
  const configs: Record<string, { name: string; rpc: string }> = {};
  
  // Map hardhat network names to chain IDs and extract RPC URLs
  const networkMappings = {
    "zeta-testnet": "7001",
    "arbitrum-sepolia": "421614", 
    "ethereum-sepolia": "11155111",
    "polygon-amoy": "80002",
    "base-sepolia": "84532",
    "bsc-testnet": "97"
  };
  
  // Fallback RPC URLs for common testnets
  const fallbackRpcs: Record<string, string> = {
    "97": "https://data-seed-prebsc-1-s1.binance.org:8545",
    "7001": "https://zetachain-athens-evm.blockpi.network/v1/rpc/public",
    "80002": "https://rpc-amoy.polygon.technology",
    "84532": "https://sepolia.base.org",
    "421614": "https://sepolia-rollup.arbitrum.io/rpc",
    "11155111": "https://ethereum-sepolia.blockpi.network/v1/rpc/public"
  };
  
  for (const [networkName, chainId] of Object.entries(networkMappings)) {
    const networkConfig = hre.config.networks[networkName];
    let rpcUrl = "";
    
    if (networkConfig && 'url' in networkConfig && networkConfig.url) {
      rpcUrl = networkConfig.url;
      
      // If URL contains undefined API key, use fallback
      if (rpcUrl.includes('undefined')) {
        console.log(`⚠️  ${networkName}: API key not set, using fallback RPC`);
        rpcUrl = fallbackRpcs[chainId] || rpcUrl;
      }
    }
    
    if (rpcUrl) {
      configs[chainId] = {
        name: networkName,
        rpc: rpcUrl
      };
    }
  }
  
  return configs;
}

async function main() {
  const [user] = await ethers.getSigners();

  console.log("=".repeat(80));
  console.log("MULTI-CHAIN LENDING PROTOCOL BALANCE CHECK");
  console.log("=".repeat(80));
  console.log("User Address:", user.address);
  console.log("Timestamp:", new Date().toISOString());

  // Load contracts configuration
  const contractsJson = require("../contracts.json");

  // Get network configurations from hardhat config
  const networkConfigs = getNetworkConfigs();

  // Check Universal Lending Protocol balances (only on ZetaChain)
  await checkUniversalLendingBalances(user.address, contractsJson, networkConfigs);

  // Check native token balances across all networks
  await checkAllNetworkBalances(user.address, contractsJson, networkConfigs);

  console.log("\n✅ Multi-chain balance check completed");
}

async function checkUniversalLendingBalances(userAddress: string, contractsJson: any, networkConfigs: Record<string, { name: string; rpc: string }>) {
  console.log("\n🌐 UNIVERSAL LENDING PROTOCOL BALANCES (ZetaChain)");
  console.log("=".repeat(70));

  try {
    // Connect to ZetaChain
    const zetaChainId = "7001";
    const zetaConfig = networkConfigs[zetaChainId];
    
    if (!zetaConfig) {
      console.log("❌ ZetaChain RPC configuration not found in hardhat config");
      return;
    }
    
    const zetaProvider = new ethers.providers.JsonRpcProvider({
      url: zetaConfig.rpc,
      timeout: 10000  // 10 second timeout
    });

    // Get Universal Lending Protocol address
    const zetaNetworkConfig = contractsJson.networks[zetaChainId];
    if (!zetaNetworkConfig) {
      console.log("❌ ZetaChain configuration not found in contracts.json");
      return;
    }

    const universalLendingAddress = zetaNetworkConfig.contracts?.UniversalLendingProtocol;
    if (!universalLendingAddress || universalLendingAddress === "0x0000000000000000000000000000000000000000") {
      console.log("❌ UniversalLendingProtocol not deployed on ZetaChain");
      return;
    }

    console.log("UniversalLendingProtocol:", universalLendingAddress);
    console.log("Network:", zetaConfig.name);

    // Connect to contract
    const UniversalLendingProtocol = await ethers.getContractFactory("UniversalLendingProtocol");
    const contract = UniversalLendingProtocol.attach(universalLendingAddress).connect(zetaProvider);

    let hasAnyBalance = false;

    // Check balances for all supported tokens
    for (const token of SUPPORTED_TOKENS) {
      try {
        const tokenAddress = getTokenAddress(parseInt(zetaChainId), token.symbol);

        // Check if this asset is supported by the contract
        const assetInfo = await contract.assets(tokenAddress);
        if (!assetInfo) {
          console.log(`❌ ${token.symbol} not found in Universal Lending Protocol`);
          continue; // Skip inactive assets
        }

        const supplyBalance = await contract.getSupplyBalance(userAddress, tokenAddress);
        const borrowBalance = await contract.getBorrowBalance(userAddress, tokenAddress);

        const formattedSupply = ethers.utils.formatUnits(supplyBalance, token.decimals);
        const formattedBorrow = ethers.utils.formatUnits(borrowBalance, token.decimals);

        if (supplyBalance.gt(0) || borrowBalance.gt(0)) {
          console.log(`\n${token.symbol}:`);
          console.log(`  Supply: ${formattedSupply}`);
          console.log(`  Borrow: ${formattedBorrow}`);
          hasAnyBalance = true;
        }

      } catch (error) {
        // Token might not be configured, skip silently
        continue;
      }
    }

    if (!hasAnyBalance) {
      console.log("\nNo balances found in Universal Lending Protocol");
    }

    // Check health factor if user has any positions
    try {
      const healthFactor = await contract.getHealthFactor(userAddress);
      if (healthFactor.gt(0)) {
        const formattedHealthFactor = ethers.utils.formatEther(healthFactor);
        console.log(`\n💊 Health Factor: ${formattedHealthFactor}`);

        if (healthFactor.lt(ethers.utils.parseEther("1.2"))) {
          console.log("⚠️  WARNING: Position at risk of liquidation!");
        } else if (healthFactor.lt(ethers.utils.parseEther("1.5"))) {
          console.log("⚡ CAUTION: Position close to liquidation threshold");
        } else {
          console.log("✅ Position is healthy");
        }
      }
    } catch (error) {
      // Health factor might not be available if no positions
    }

  } catch (error) {
    console.error("❌ Error checking Universal Lending Protocol balances:", error);
  }
}

async function checkAllNetworkBalances(userAddress: string, contractsJson: any, networkConfigs: Record<string, { name: string; rpc: string }>) {
  console.log("\n💳 NATIVE TOKEN BALANCES (All Networks)");
  console.log("=".repeat(70));

  // Check each network configured in contracts.json
  for (const [chainId, networkData] of Object.entries(contractsJson.networks)) {
    if (typeof networkData !== 'object' || !networkData) continue;

    const networkConfig = networkData as any;
    const rpcConfig = networkConfigs[chainId];

    if (!rpcConfig) {
      console.log(`\n❌ ${networkConfig.name} (${chainId}): RPC not configured`);
      continue;
    }

    try {
      console.log(`\n🔗 ${networkConfig.name.toUpperCase()} (Chain ID: ${chainId})`);
      console.log("-".repeat(50));

      // Connect to the network with timeout
      const provider = new ethers.providers.JsonRpcProvider({
        url: rpcConfig.rpc,
        timeout: 10000  // 10 second timeout
      });

      // Check native balance (ETH/BNB/POL/etc)
      try {
        const nativeBalance = await provider.getBalance(userAddress);
        const formattedNative = ethers.utils.formatEther(nativeBalance);
        console.log(`Native: ${formattedNative}`);
      } catch (error) {
        console.log(`Native: Error reading balance - ${(error as any).message || error}`);
      }

      // Check ERC-20/ZRC-20 token balances for this network
      if (networkConfig.tokens) {
        for (const [symbol, tokenConfig] of Object.entries(networkConfig.tokens)) {
          // For ZetaChain, include ZRC-20 tokens (with dots), for others skip them
          if (chainId === "7001") {
            // ZetaChain: show both native and ZRC-20 tokens
          } else {
            // Other chains: skip ZRC-20 tokens (they have dots in symbol)
            if (symbol.includes('.')) {
              continue;
            }
          }

          if (tokenConfig && typeof tokenConfig === 'object' && 'address' in tokenConfig && 'decimals' in tokenConfig) {
            const address = (tokenConfig as any).address as string;
            const decimals = (tokenConfig as any).decimals as number;

            if (address && address !== "0x0000000000000000000000000000000000000000") {
              try {
                // Create contract instance with proper provider
                const tokenContract = new ethers.Contract(
                  address,
                  ["function balanceOf(address) view returns (uint256)"],
                  provider
                );

                const balance = await tokenContract.balanceOf(userAddress);
                const formattedBalance = ethers.utils.formatUnits(balance, decimals);
                console.log(`${symbol}: ${formattedBalance}`);
              } catch (error) {
                // Token might not implement IERC20 or other error, skip
                continue;
              }
            }
          }
        }
      }

    } catch (error) {
      console.log(`❌ Error checking ${networkConfig.name}: ${error}`);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });