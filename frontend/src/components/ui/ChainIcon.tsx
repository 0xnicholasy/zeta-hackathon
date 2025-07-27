import { NetworkIcon } from '@web3icons/react';

interface ChainIconProps {
    chain: string;
    className?: string;
    fallbackClassName?: string;
    size?: 'sm' | 'md' | 'lg';
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

// Size configurations for fallback icons
const SIZE_CONFIG = {
    sm: { container: 'w-3 h-3', text: 'text-xs' },
    md: { container: 'w-4 h-4', text: 'text-sm' },
    lg: { container: 'w-5 h-5', text: 'text-base' },
} as const;

function detectSizeFromClassName(className: string): 'sm' | 'md' | 'lg' {
    // Check for explicit size classes in order of specificity
    if (className.includes('size-5') || className.includes('w-5') || className.includes('h-5')) {
        return 'lg';
    }
    if (className.includes('size-4') || className.includes('w-4') || className.includes('h-4')) {
        return 'md';
    }
    if (className.includes('size-3') || className.includes('w-3') || className.includes('h-3')) {
        return 'sm';
    }

    // Default to medium if no size detected
    return 'md';
}

export function ChainIcon({
    chain,
    className = 'size-4 text-zeta-700',
    fallbackClassName,
    size
}: ChainIconProps) {
    if (!chain) return null;

    // Normalize chain identifier for lookup
    const normalizedChain = chain.slice(0, 3).toUpperCase();
    const iconName = CHAIN_ICON_MAP[normalizedChain] ?? CHAIN_ICON_MAP[chain.toUpperCase()];

    if (iconName) {
        return <NetworkIcon name={iconName} className={className} />;
    }

    // Determine size: explicit prop takes precedence, then detect from className
    const resolvedSize = size || detectSizeFromClassName(className);
    const sizeConfig = SIZE_CONFIG[resolvedSize];

    return (
        <div className={`${sizeConfig.container} bg-gradient-to-br from-zeta-400 to-zeta-600 rounded-full flex items-center justify-center ${fallbackClassName || ''}`}>
            <span className={`text-white font-bold ${sizeConfig.text}`}>
                {chain.charAt(0).toUpperCase()}
            </span>
        </div>
    );
} 