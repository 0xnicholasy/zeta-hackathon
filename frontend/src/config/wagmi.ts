import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import {
  arbitrumSepolia,
  sepolia,
  mainnet,
  arbitrum,
  polygonAmoy,
  baseSepolia,
  bscTestnet,
  polygon,
  base,
  bsc,
} from 'wagmi/chains';

// ZetaChain testnet configuration
const zetaChainTestnet = {
  id: 7001,
  name: 'ZetaChain Athens Testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'ZETA',
    symbol: 'ZETA',
  },
  rpcUrls: {
    default: { http: ['https://zetachain-athens-evm.blockpi.network/v1/rpc/public'] },
    public: { http: ['https://zetachain-athens-evm.blockpi.network/v1/rpc/public'] },
  },
  blockExplorers: {
    default: { name: 'ZetaScan', url: 'https://athens.explorer.zetachain.com/' },
  },
  testnet: true,
} as const;

// ZetaChain mainnet configuration
const zetaChainMainnet = {
  id: 7000,
  name: 'ZetaChain',
  nativeCurrency: {
    decimals: 18,
    name: 'ZETA',
    symbol: 'ZETA',
  },
  rpcUrls: {
    default: { http: ['https://zetachain-evm.blockpi.network/v1/rpc/public'] },
    public: { http: ['https://zetachain-evm.blockpi.network/v1/rpc/public'] },
  },
  blockExplorers: {
    default: { name: 'ZetaScan', url: 'https://explorer.zetachain.com/' },
  },
  testnet: false,
} as const;

// Determine if we should use testnets or mainnets
const useTestnets = import.meta.env.VITE_ENABLE_TESTNETS === 'true' || 
                   import.meta.env.DEV || 
                   import.meta.env.MODE === 'development';

export const config = getDefaultConfig({
  appName: import.meta.env.VITE_APP_NAME || 'ZetaChain Cross-Chain Lending',
  projectId: import.meta.env.VITE_WALLET_CONNECT_PROJECT_ID || '', // Get this from https://cloud.walletconnect.com
  chains: useTestnets 
    ? [
        // Test networks for development
        zetaChainTestnet,
        arbitrumSepolia,
        sepolia,
        polygonAmoy,
        baseSepolia,
        bscTestnet,
      ]
    : [
        // Production networks
        zetaChainMainnet,
        arbitrum,
        mainnet,
        polygon,
        base,
        bsc,
      ],
  ssr: false, // If your dApp uses server side rendering (SSR)
});

// Export chain configurations for use in components
export { zetaChainTestnet, zetaChainMainnet };

// Export additional chain configurations from wagmi/chains
export { 
  polygonAmoy, 
  baseSepolia, 
  bscTestnet,
  polygon,
  base,
  bsc 
};

// Export current environment info
export const isTestnetMode = useTestnets;
export const activeChains = useTestnets 
  ? [zetaChainTestnet, arbitrumSepolia, sepolia, polygonAmoy, baseSepolia, bscTestnet]
  : [zetaChainMainnet, arbitrum, mainnet, polygon, base, bsc];