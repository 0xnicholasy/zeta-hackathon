import { SupportedChain, TOKEN_SYMBOLS, getTokenAddress } from '../contracts/deployments';
import type { EVMAddress } from '@/types/address';

// Helper function to get chain ID from source chain name
export const getChainIdFromSourceChain = (sourceChain: string): number => {
    switch (sourceChain.toLowerCase()) {
        case 'arbitrum':
        case 'arbitrum sepolia':
            return SupportedChain.ARBITRUM_SEPOLIA;
        case 'ethereum':
        case 'ethereum sepolia':
            return SupportedChain.ETHEREUM_SEPOLIA;
        case 'zetachain':
        case 'zeta testnet':
            return SupportedChain.ZETA_TESTNET;
        case 'polygon':
        case 'polygon amoy':
            return SupportedChain.POLYGON_AMOY;
        case 'base':
        case 'base sepolia':
            return SupportedChain.BASE_SEPOLIA;
        case 'bsc':
        case 'bsc testnet':
            return SupportedChain.BSC_TESTNET;
        default:
            return SupportedChain.ARBITRUM_SEPOLIA; // Default fallback
    }
};

// Helper function to get chain display name
export const getChainDisplayName = (sourceChain: string): string => {
    switch (sourceChain.toLowerCase()) {
        case 'arbitrum':
        case 'arbitrum sepolia':
            return 'Arbitrum Sepolia';
        case 'ethereum':
        case 'ethereum sepolia':
            return 'Ethereum Sepolia';
        case 'zetachain':
        case 'zeta testnet':
            return 'ZetaChain Testnet';
        case 'polygon':
        case 'polygon amoy':
            return 'Polygon Amoy';
        case 'base':
        case 'base sepolia':
            return 'Base Sepolia';
        case 'bsc':
        case 'bsc testnet':
            return 'BSC Testnet';
        default:
            return sourceChain;
    }
};

// Helper function to get chain display name from chain ID
export const getChainDisplayNameFromId = (chainId: number): string => {
        switch (chainId) {
            case SupportedChain.ARBITRUM_SEPOLIA:
                return 'Arbitrum Sepolia';
            case SupportedChain.ETHEREUM_SEPOLIA:
                return 'Ethereum Sepolia';
            case SupportedChain.ZETA_TESTNET:
                return 'ZetaChain Testnet';
            case SupportedChain.POLYGON_AMOY:
                return 'Polygon Amoy';
            case SupportedChain.BASE_SEPOLIA:
                return 'Base Sepolia';
            case SupportedChain.BSC_TESTNET:
                return 'BSC Testnet';
            case SupportedChain.SOLANA_DEVNET:
                return 'Solana Devnet';
            default:
                return 'Unknown Chain';
        }
};

// Helper function to get gas token symbol based on destination chain
export const getGasTokenSymbol = (sourceChain: string): string => {
    sourceChain = sourceChain.toLowerCase();
    if (sourceChain.includes('arb')) {
        return 'ETH.ARBI';
    } else if (sourceChain.includes('eth')) {
        return 'ETH.ETH';
    } else if (sourceChain.includes('pol') || sourceChain.includes('polygon')) {
        return 'POL.POL';
    } else if (sourceChain.includes('base')) {
        return 'ETH.BASE';
    } else if (sourceChain.includes('bsc')) {
        return 'BNB.BSC';
    } else if (sourceChain.includes('zeta')) {
        return 'ZETA';
    } else {
        return 'Unsupported Network';
    }
};

// Helper function to get gas token decimals based on source chain
export const getGasTokenDecimals = (sourceChain: string): number => {
    switch (sourceChain.toLowerCase()) {
        case 'arbitrum':
        case 'arbitrum sepolia':
        case 'ethereum':
        case 'ethereum sepolia':
        case 'base':
        case 'base sepolia':
            return 18; // ETH has 18 decimals
        case 'polygon':
        case 'polygon amoy':
            return 18; // POL has 18 decimals
        case 'bsc':
        case 'bsc testnet':
            return 18; // BNB has 18 decimals
        case 'zetachain':
        case 'zeta testnet':
            return 18; // ZETA has 18 decimals
        case 'solana':
        case 'solana devnet':
            return 9; // SOL has 9 decimals
        default:
            return 18; // Default to 18 decimals
    }
};

// Token mapping configuration for cross-chain tokens
export interface TokenMapping {
    chainId: number;
    nativeToken: string;
    zetaTokenSymbol: string;
    usdcTokenSymbol: string;
}

// Define token mappings for all supported chains
export const CHAIN_TOKEN_MAPPINGS: TokenMapping[] = [
    {
        chainId: SupportedChain.ARBITRUM_SEPOLIA,
        nativeToken: 'ETH',
        zetaTokenSymbol: TOKEN_SYMBOLS.ETH_ARBI,
        usdcTokenSymbol: TOKEN_SYMBOLS.USDC_ARBI,
    },
    {
        chainId: SupportedChain.ETHEREUM_SEPOLIA,
        nativeToken: 'ETH',
        zetaTokenSymbol: TOKEN_SYMBOLS.ETH_ETH,
        usdcTokenSymbol: TOKEN_SYMBOLS.USDC_ETH,
    },
    {
        chainId: SupportedChain.POLYGON_AMOY,
        nativeToken: 'POL',
        zetaTokenSymbol: TOKEN_SYMBOLS.POL_POL,
        usdcTokenSymbol: TOKEN_SYMBOLS.USDC_POL,
    },
    {
        chainId: SupportedChain.BASE_SEPOLIA,
        nativeToken: 'ETH',
        zetaTokenSymbol: TOKEN_SYMBOLS.ETH_BASE,
        usdcTokenSymbol: TOKEN_SYMBOLS.USDC_BASE,
    },
    {
        chainId: SupportedChain.BSC_TESTNET,
        nativeToken: 'BNB',
        zetaTokenSymbol: TOKEN_SYMBOLS.BNB_BSC,
        usdcTokenSymbol: TOKEN_SYMBOLS.USDC_BSC,
    },
    {
        chainId: SupportedChain.SOLANA_DEVNET,
        nativeToken: 'SOL',
        zetaTokenSymbol: TOKEN_SYMBOLS.SOL_SOL,
        usdcTokenSymbol: TOKEN_SYMBOLS.USDC_SOL,
    }
];

/**
 * Get ZRC-20 token symbol for a given external chain token
 */
export const getZetaTokenSymbol = (tokenSymbol: string, chainId: number): string => {
    // For ZetaChain, use the token symbol directly
    if (chainId === SupportedChain.ZETA_TESTNET) {
        return tokenSymbol;
    }

    // Find the chain mapping
    const chainMapping = CHAIN_TOKEN_MAPPINGS.find(mapping => mapping.chainId === chainId);
    if (!chainMapping) {
        return '';
    }

    // Map the token symbol to its ZRC-20 equivalent
    if (tokenSymbol === chainMapping.nativeToken) {
        return chainMapping.zetaTokenSymbol;
    }
    if (tokenSymbol === 'USDC') {
        return chainMapping.usdcTokenSymbol;
    }

    return '';
};

/**
 * Get ZRC-20 token address for a given external chain token
 */
export const getZetaTokenAddress = (tokenSymbol: string, chainId: number): EVMAddress | null => {
    const zetaTokenSymbol = getZetaTokenSymbol(tokenSymbol, chainId);
    if (!zetaTokenSymbol) {
        return null;
    }

    return getTokenAddress(zetaTokenSymbol, SupportedChain.ZETA_TESTNET);
};

/**
 * Get token information for a specific chain and token symbol
 */
export interface TokenInfo {
    symbol: string;
    zetaSymbol: string;
    address: EVMAddress | null;
    decimals: number;
    isNative: boolean;
}

export const getTokenInfo = (tokenSymbol: string, chainId: number): TokenInfo | null => {
    const zetaTokenSymbol = getZetaTokenSymbol(tokenSymbol, chainId);
    if (!zetaTokenSymbol) {
        return null;
    }

    const chainMapping = CHAIN_TOKEN_MAPPINGS.find(mapping => mapping.chainId === chainId);
    const isNative = chainMapping ? tokenSymbol === chainMapping.nativeToken : false;

    // Get decimals based on token type
    let decimals = 18; // Default for most tokens
    if (chainId === SupportedChain.SOLANA_DEVNET) {
        decimals = 9; // SOL has 9 decimals
    }
    if (tokenSymbol === 'USDC') {
        decimals = 6;
    }

    return {
        symbol: tokenSymbol,
        zetaSymbol: zetaTokenSymbol,
        address: getTokenAddress(zetaTokenSymbol, SupportedChain.ZETA_TESTNET),
        decimals,
        isNative,
    };
};

/**
 * Get all supported token symbols for a specific chain
 */
export const getSupportedTokensForChain = (chainId: number): string[] => {
    if (chainId === SupportedChain.ZETA_TESTNET) {
        // Return all ZRC-20 token symbols for ZetaChain
        return Object.values(TOKEN_SYMBOLS);
    }

    const chainMapping = CHAIN_TOKEN_MAPPINGS.find(mapping => mapping.chainId === chainId);
    if (!chainMapping) {
        return [];
    }

    return [chainMapping.nativeToken, 'USDC'];
};

/**
 * Check if a token is supported on a specific chain
 */
export const isTokenSupportedOnChain = (tokenSymbol: string, chainId: number): boolean => {
    const supportedTokens = getSupportedTokensForChain(chainId);
    return supportedTokens.includes(tokenSymbol);
};