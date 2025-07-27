import { EVMAddress, EVMTransactionHash } from "@/types/address";

export function formatHexString(hexString: `0x${string}` | EVMAddress | EVMTransactionHash): string {
    return `${hexString.slice(0, 6)}...${hexString.slice(-4)}`;
}