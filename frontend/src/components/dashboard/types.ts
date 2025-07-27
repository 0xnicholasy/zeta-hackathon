import { EVMAddress } from "@/types/address";

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
    externalChainId: number;
    decimals: number;
}

// Gas token info with proper typing
export interface GasTokenInfo {
    address: EVMAddress;
    amount: bigint;
    needsApproval: boolean;
}