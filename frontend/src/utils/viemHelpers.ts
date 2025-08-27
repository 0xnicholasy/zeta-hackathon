/**
 * Utility functions to replace ethers.js utils with viem equivalents
 * This ensures type safety and consistency with viem library usage
 */
import { Address, getAddress, Hex, isAddress, stringToHex, toHex } from 'viem';
import { base58 } from '@scure/base';

/**
 * Convert a UTF-8 string to hex bytes (replacement for ethers.utils.hexlify(utils.toUtf8Bytes()))
 */
export function stringToHexBytes(str: string): `0x${string}` {
    return stringToHex(str);
}

/**
 * Convert any value to hex (replacement for ethers.utils.hexlify())
 */
export function valueToHex(value: string | number | bigint | Uint8Array): `0x${string}` {
    return toHex(value);
}

/**
 * Specifically for converting addresses to hex bytes for cross-chain operations
 */
export function addressToHexBytes(address: string): Address {
    if (!isAddress(address)) {
        throw new Error('Invalid EVM address');
    }
    // Normalize to EIP-55 checksum casing for consistency.
    return getAddress(address);
}

/**
 * Convert Solana address (base58 string) to hex bytes for contract calls
 */

export function solanaAddressToHexBytes(address: string): Hex {
    try {
        const bytes = base58.decode(address);
        if (bytes.length !== 32) {
            throw new Error('Invalid Solana address: must decode to 32 bytes');
        }
        return toHex(bytes);
    } catch {
        throw new Error('Invalid Solana Base58 address');
    }
}