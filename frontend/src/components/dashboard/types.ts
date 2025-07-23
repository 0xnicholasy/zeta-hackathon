// Branded types for better type safety
export type EVMAddress = `0x${string}` & { readonly __brand: 'EVMAddress' };
export type EVMTransactionHash = `0x${string}` & { readonly __brand: 'EVMTransactionHash' };
export const ZERO_ADDRESS: EVMAddress = '0x0000000000000000000000000000000000000000' as EVMAddress;
export const ZERO_TRANSACTION_HASH: EVMTransactionHash = '0x0000000000000000000000000000000000000000000000000000000000000000' as EVMTransactionHash;

// Type guard functions
export function isValidHexString(value: string): boolean {
    return /^0x[a-fA-F0-9]*$/.test(value);
}

export function isEVMAddress(value: string): value is EVMAddress {
    // EVM addresses are 42 characters: 0x + 40 hex characters
    if (!value || typeof value !== 'string' || value.length !== 42) {
        return false;
    }

    return isValidHexString(value);
}

export function isEVMTransactionHash(value: string): value is EVMTransactionHash {
    // Transaction hashes are 66 characters: 0x + 64 hex characters
    if (!value || typeof value !== 'string' || value.length !== 66) {
        return false;
    }

    return isValidHexString(value);
}

// Validation and conversion utilities
export function validateEVMAddress(value: string): EVMAddress {
    if (!isEVMAddress(value)) {
        throw new Error(`Invalid EVM address: ${value}. Expected format: 0x followed by 40 hex characters.`);
    }
    return value;
}

export function validateEVMTransactionHash(value: string): EVMTransactionHash {
    if (!isEVMTransactionHash(value)) {
        throw new Error(`Invalid EVM transaction hash: ${value}. Expected format: 0x followed by 64 hex characters.`);
    }
    return value;
}

// Safe conversion functions that return null instead of throwing
export function safeEVMAddress<T>(value: string | null | undefined, fallback?: T): EVMAddress | T {
    if (!value || !isEVMAddress(value)) {
        if (fallback) {
            return fallback;
        }
        throw new Error(`Invalid EVM address: ${value}. Expected format: 0x followed by 40 hex characters.`);
    }
    return value;
}

export function safeEVMTransactionHash<T>(value: string | null | undefined, fallback?: T): EVMTransactionHash | T {
    if (!value || !isEVMTransactionHash(value)) {
        if (fallback) {
            return fallback;
        }
        throw new Error(`Invalid EVM transaction hash: ${value}. Expected format: 0x followed by 64 hex characters.`);
    }
    return value;
}

export function safeEVMAddressOrZeroAddress(value: string | null | undefined): EVMAddress {
    return safeEVMAddress(value, ZERO_ADDRESS);
}

export function safeEVMTransactionHashOrZeroTransactionHash(value: string | null | undefined): EVMTransactionHash {
    return safeEVMTransactionHash(value, ZERO_TRANSACTION_HASH);
}

// Utility function to check if two addresses are equal (case-insensitive)
export function addressesEqual(a: EVMAddress | string, b: EVMAddress | string): boolean {
    return a.toLowerCase() === b.toLowerCase();
}

export function isZeroAddress(address: EVMAddress | string): boolean {
    return addressesEqual(address, '0x0000000000000000000000000000000000000000');
}

// Type assertion helpers for use with external data
export function assertEVMAddress(value: unknown, context?: string): EVMAddress {
    if (typeof value !== 'string') {
        throw new Error(`Expected string for EVM address${context ? ` in ${context}` : ''}, got ${typeof value}`);
    }
    return validateEVMAddress(value);
}

export function assertEVMTransactionHash(value: unknown, context?: string): EVMTransactionHash {
    if (typeof value !== 'string') {
        throw new Error(`Expected string for EVM transaction hash${context ? ` in ${context}` : ''}, got ${typeof value}`);
    }
    return validateEVMTransactionHash(value);
}

export interface UserAssetData {
    address: EVMAddress;
    symbol: string;
    unit: string;
    sourceChain: string;
    suppliedBalance: string;
    borrowedBalance: string;
    formattedSuppliedBalance: string;
    formattedBorrowedBalance: string;
    suppliedUsdValue: string;
    borrowedUsdValue: string;
    price: string;
    isSupported: boolean;
    externalBalance?: string;
    formattedExternalBalance?: string;
    externalChainId?: number | undefined;
    decimals: number;
}

// Gas token info with proper typing
export interface GasTokenInfo {
    address: EVMAddress;
    amount: bigint;
    needsApproval: boolean;
}