/**
 * Utility functions to replace ethers.js utils with viem equivalents
 * This ensures type safety and consistency with viem library usage
 */
import { stringToHex, toHex } from 'viem';

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
export function addressToHexBytes(address: string): `0x${string}` {
    // Ensure the address is properly formatted as hex
    if (!address.startsWith('0x')) {
        throw new Error('EVM address must start with 0x');
    }
    return address as `0x${string}`;
}

/**
 * Convert Solana address (base58 string) to hex bytes for contract calls
 */
export function solanaAddressToHexBytes(address: string): `0x${string}` {
    // For Solana addresses, we convert the string to UTF-8 bytes
    return stringToHexBytes(address);
}