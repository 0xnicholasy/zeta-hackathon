import { useEffect, useState, useMemo, useCallback } from 'react';
import { useAccount, useReadContracts } from 'wagmi';
import { formatUnits } from 'viem';
import type { EVMAddress } from '../components/dashboard/types';
import { isZeroAddress, safeEVMAddress, ZERO_ADDRESS } from '../components/dashboard/types';
import { createPublicClient, http, type PublicClient, type Chain } from 'viem';
import { arbitrumSepolia, sepolia } from 'viem/chains';
import {
  SupportedChain,
  TOKEN_SYMBOLS,
  getTokenAddress,
  getSupportedChainIds,
  getNetworkConfig
} from '../contracts/deployments';

export interface TokenBalance {
  chainId: number;
  chainName: string;
  tokenSymbol: string;
  tokenAddress: EVMAddress;
  balance: string;
  formattedBalance: string;
  decimals: number;
  isNative: boolean;
}

export interface MultiChainBalances {
  [chainId: number]: {
    [tokenSymbol: string]: TokenBalance;
  };
}

export interface ChainTokenBalance {
  [tokenSymbol: string]: TokenBalance;
}

// ERC20 ABI for balance and decimals
const erc20Abi = [
  {
    name: 'balanceOf',
    type: 'function' as const,
    stateMutability: 'view' as const,
    inputs: [{ name: 'account', type: 'address' as const }],
    outputs: [{ name: '', type: 'uint256' as const }],
  },
  {
    name: 'decimals',
    type: 'function' as const,
    stateMutability: 'view' as const,
    inputs: [],
    outputs: [{ name: '', type: 'uint8' as const }],
  },
] as const;

/**
 * Hook to fetch user token balances across all supported chains
 */
export function useMultiChainBalances() {
  const { address, isConnected } = useAccount();
  const [balances, setBalances] = useState<MultiChainBalances>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Define supported chains and their configurations
  const supportedChains = useMemo(() => {
    return getSupportedChainIds().map(chainId => ({
      chainId,
      config: getNetworkConfig(chainId),
    })).filter(chain => chain.config !== null);
  }, []);

  // Create public clients for each supported chain
  const publicClients = useMemo(() => {
    const clients: Record<number, PublicClient> = {};

    supportedChains.forEach(({ chainId, config }) => {
      if (!config) return;

      let viemChain: Chain | undefined;
      let rpcUrl = config.rpc;

      switch (chainId) {
        case SupportedChain.ARBITRUM_SEPOLIA:
          viemChain = arbitrumSepolia;
          rpcUrl = rpcUrl || arbitrumSepolia.rpcUrls.default.http[0];
          break;
        case SupportedChain.ETHEREUM_SEPOLIA:
          viemChain = sepolia;
          rpcUrl = rpcUrl || sepolia.rpcUrls.default.http[0];
          break;
        case SupportedChain.ZETA_TESTNET:
          // For ZetaChain, we'll use wagmi's default handling
          return;
        default:
          return;
      }

      if (viemChain && rpcUrl) {
        clients[chainId] = createPublicClient({
          chain: viemChain,
          transport: http(rpcUrl),
        });
      }
    });

    return clients;
  }, [supportedChains]);

  // Fetch balances for external chains (Arbitrum, Ethereum)
  const fetchExternalChainBalances = useCallback(async (): Promise<MultiChainBalances> => {
    if (!address || !isConnected) return {};

    const newBalances: MultiChainBalances = {};

    for (const { chainId, config } of supportedChains) {
      if (!config || chainId === SupportedChain.ZETA_TESTNET) continue;

      const client = publicClients[chainId];
      if (!client) continue;

      newBalances[chainId] = {};

      // Get token addresses for this chain
      const tokens = config.tokens;

      for (const [tokenSymbol, tokenAddressString] of Object.entries(tokens)) {
        const tokenAddress = safeEVMAddress(tokenAddressString);
        if (!tokenAddress) continue;

        // Handle native ETH (zero address) and ERC20 tokens
        const isNativeETH = isZeroAddress(tokenAddress) || tokenSymbol === 'ETH';

        try {
          let balance = '0';
          let decimals = 18;

          if (isNativeETH) {
            // Native ETH balance
            const nativeBalance = await client.getBalance({ address });
            balance = nativeBalance.toString();
            decimals = 18;
            // console.log(`Fetched native ETH balance for ${tokenSymbol} on ${config.name}: ${formatUnits(nativeBalance, 18)} ETH`);
          } else {
            // ERC20 token balance
            const [tokenBalance, tokenDecimals] = await Promise.all([
              client.readContract({
                address: safeEVMAddress(tokenAddress) || '' as EVMAddress,
                abi: erc20Abi,
                functionName: 'balanceOf',
                args: [address],
              }),
              client.readContract({
                address: safeEVMAddress(tokenAddress) || '' as EVMAddress,
                abi: erc20Abi,
                functionName: 'decimals',
              }),
            ]);

            balance = tokenBalance.toString();
            decimals = tokenDecimals;
          }

          newBalances[chainId][tokenSymbol] = {
            chainId,
            chainName: config.name,
            tokenSymbol,
            tokenAddress,
            balance,
            formattedBalance: formatUnits(BigInt(balance), decimals),
            decimals,
            isNative: isNativeETH,
          };
        } catch (err) {
          console.warn(`Failed to fetch ${tokenSymbol} balance on ${config.name}:`, err);
          // Set zero balance on error
          newBalances[chainId][tokenSymbol] = {
            chainId,
            chainName: config.name,
            tokenSymbol,
            tokenAddress,
            balance: '0',
            formattedBalance: '0',
            decimals: 18,
            isNative: isNativeETH,
          };
        }
      }
    }

    return newBalances;
  }, [address, isConnected, publicClients, supportedChains]);

  // Fetch balances periodically
  useEffect(() => {
    if (!address || !isConnected) {
      setBalances({});
      return;
    }

    const fetchBalances = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const externalBalances = await fetchExternalChainBalances();
        setBalances(externalBalances);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch balances');
        console.error('Error fetching multi-chain balances:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchBalances();

    // Refresh balances every 30 seconds
    const interval = setInterval(fetchBalances, 30000);

    return () => clearInterval(interval);
  }, [address, isConnected, fetchExternalChainBalances]);

  // Helper function to get balance for a specific token on a specific chain
  const getBalance = (chainId: number, tokenSymbol: string): TokenBalance | null => {
    return balances[chainId]?.[tokenSymbol] || null;
  };

  // Helper function to get all balances for a specific chain
  const getChainBalances = (chainId: number): ChainTokenBalance => {
    return balances[chainId] || {};
  };

  // Helper function to get total balance across all chains for a token
  const getTotalBalance = (tokenSymbol: string): string => {
    let total = BigInt(0);
    let decimals = 18;

    Object.values(balances).forEach(chainBalances => {
      const tokenBalance = chainBalances[tokenSymbol];
      if (tokenBalance) {
        total += BigInt(tokenBalance.balance);
        decimals = tokenBalance.decimals;
      }
    });

    return formatUnits(total, decimals);
  };

  return {
    balances,
    isLoading,
    error,
    getBalance,
    getChainBalances,
    getTotalBalance,
    supportedChains: supportedChains.map(chain => ({
      chainId: chain.chainId,
      name: chain.config?.name || '',
    })),
  };
}

/**
 * Hook specifically for ZetaChain balances using wagmi
 * This is used for ZRC-20 tokens that represent cross-chain assets
 */
export function useZetaChainBalances() {
  const { address, isConnected } = useAccount();

  // Define ZRC-20 tokens available on ZetaChain
  const zetaTokens = useMemo(() => {
    const tokens = [
      { symbol: TOKEN_SYMBOLS.ETH_ARBI, unit: 'ETH', sourceChain: 'ARBI' },
      { symbol: TOKEN_SYMBOLS.USDC_ARBI, unit: 'USDC', sourceChain: 'ARBI' },
      { symbol: TOKEN_SYMBOLS.ETH_ETH, unit: 'ETH', sourceChain: 'ETH' },
      { symbol: TOKEN_SYMBOLS.USDC_ETH, unit: 'USDC', sourceChain: 'ETH' },
    ];

    return tokens.map(token => ({
      ...token,
      address: getTokenAddress(token.symbol, SupportedChain.ZETA_TESTNET),
    })).filter(token => token.address);
  }, []);

  // Get ZRC-20 token balances
  const { data: zetaBalances } = useReadContracts({
    contracts: zetaTokens.map(token => ({
      address: safeEVMAddress(token.address) || undefined,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [address || ZERO_ADDRESS],
    })),
    query: {
      enabled: zetaTokens.length > 0 && !!address && isConnected,
    },
  });

  // Get ZRC-20 token decimals
  const { data: zetaDecimals } = useReadContracts({
    contracts: zetaTokens.map(token => ({
      address: safeEVMAddress(token.address) || undefined,
      abi: erc20Abi,
      functionName: 'decimals',
    })),
    query: {
      enabled: zetaTokens.length > 0 && !!address && isConnected,
    },
  });

  // Process ZetaChain balances
  const processedZetaBalances = useMemo((): ChainTokenBalance => {
    if (!zetaBalances || !zetaDecimals) return {};

    const balances: ChainTokenBalance = {};

    zetaTokens.forEach((token, index) => {
      const balanceResult = zetaBalances[index];
      const decimalsResult = zetaDecimals[index];

      let balance = '0';
      let decimals = 18;

      if (balanceResult?.result && balanceResult.status === 'success') {
        balance = (balanceResult.result).toString();
      }
      if (decimalsResult?.result && decimalsResult.status === 'success') {
        decimals = decimalsResult.result as number;
      }

      balances[token.symbol] = {
        chainId: SupportedChain.ZETA_TESTNET,
        chainName: 'zeta-testnet',
        tokenSymbol: token.symbol,
        tokenAddress: token.address,
        balance,
        formattedBalance: formatUnits(BigInt(balance), decimals),
        decimals,
        isNative: false,
      };
    });

    return balances;
  }, [zetaBalances, zetaDecimals, zetaTokens]);

  return {
    zetaBalances: processedZetaBalances,
    zetaTokens,
    isLoading: !zetaBalances || !zetaDecimals,
  };
}