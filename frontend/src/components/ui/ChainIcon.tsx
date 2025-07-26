import { NetworkIcon } from '@web3icons/react';

interface ChainIconProps {
    chain: string;
    className?: string;
    fallbackClassName?: string;
}

// Chain identifier to network icon name mapping
const CHAIN_ICON_MAP: Record<string, string> = {
    'ARB': 'arbitrum-one',
    'ARBITRUM': 'arbitrum-one',
    'ETH': 'ethereum',
    'ETHEREUM': 'ethereum',
    'BASE': 'base',
    'ZETA': 'zetachain',
    'ZETACHAIN': 'zetachain',
} as const;

export function ChainIcon({ chain, className = 'size-4 text-zeta-700', fallbackClassName }: ChainIconProps) {
    if (!chain) return null;

    // Normalize chain identifier for lookup
    const normalizedChain = chain.slice(0, 3).toUpperCase();
    const iconName = CHAIN_ICON_MAP[normalizedChain] || CHAIN_ICON_MAP[chain.toUpperCase()];

    if (iconName) {
        return <NetworkIcon name={iconName} className={className} />;
    }

    // Fallback to styled div with first character
    const fallbackSize = fallbackClassName || className.includes('size-5') || className.includes('w-5') || className.includes('h-5')
        ? 'w-4 h-4'
        : 'w-3 h-3';

    const textSize = fallbackSize === 'w-4 h-4' ? 'text-xs' : 'text-sm';

    return (
        <div className={`${fallbackSize} bg-gradient-to-br from-zeta-400 to-zeta-600 rounded-full flex items-center justify-center ${fallbackClassName || ''}`}>
            <span className={`text-white font-bold ${textSize}`}>
                {chain.charAt(0).toUpperCase()}
            </span>
        </div>
    );
} 