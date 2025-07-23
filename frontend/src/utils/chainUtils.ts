import { SupportedChain } from '../contracts/deployments';

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
        default:
            return sourceChain;
    }
};

// Helper function to get gas token symbol based on destination chain
export const getGasTokenSymbol = (sourceChain: string): string => {
    sourceChain = sourceChain.toLowerCase();
    if (sourceChain.includes('arb')) {
        return 'ETH.ARBI';
    } else if (sourceChain.includes('eth')) {
        return 'ETH.ETH';
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
            return 18; // ETH has 18 decimals
        case 'zetachain':
        case 'zeta testnet':
            return 18; // ZETA has 18 decimals
        default:
            return 18; // Default to 18 decimals
    }
};