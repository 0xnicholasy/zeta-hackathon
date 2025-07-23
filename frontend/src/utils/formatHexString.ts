import { EVMAddress, EVMTransactionHash } from "@/components/dashboard/types";

export function formatHexString(hexString: `0x${string}` | EVMAddress | EVMTransactionHash): string {
    return `${hexString.slice(0, 6)}...${hexString.slice(-4)}`;
}