import { EVMAddress, EVMTransactionHash } from "@/components/dashboard/types";

export function formatHexString(hexString: string | `0x${string}` | EVMAddress | EVMTransactionHash): string {
    return `0x${hexString.slice(0, 6)}...${hexString.slice(-4)}`;
}