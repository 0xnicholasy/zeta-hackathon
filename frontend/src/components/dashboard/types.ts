export interface UserAssetData {
    address: string;
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
    externalChainId?: number;
}