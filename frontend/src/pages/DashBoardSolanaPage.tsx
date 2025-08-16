import { useState, useEffect, useCallback } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { SolanaWalletProvider } from '../components/wallet/SolanaWalletProvider';
import { SolanaWalletManager } from '../components/wallet/SolanaWalletManager';
import { WalletDebugInfo } from '../components/wallet/WalletDebugInfo';
import {
    createSOLSupplyTransaction,
    createUSDCSupplyTransaction,
    USDC_MINT_DEVNET
} from '../lib/solana-transactions';
import { SolanaHeader } from '../components/dashboard/solana/SolanaHeader';
import { SolanaNotConnectedState } from '../components/dashboard/solana/SolanaNotConnectedState';
import { SolanaConnectedState } from '../components/dashboard/solana/SolanaConnectedState';
import { type SolanaToken } from '../components/dashboard/solana/SolanaSupplyDialog';
import { fetchSolanaTokenBalances, isValidSolanaAddress } from '../lib/solana-utils';

function DashBoardSolanaPageContent() {
    const { connected, publicKey, sendTransaction } = useWallet();
    const { connection } = useConnection();

    // Solana tokens state
    const [solanaTokens, setSolanaTokens] = useState<SolanaToken[]>([]);
    const [isLoadingTokens, setIsLoadingTokens] = useState(false);

    const publicKeyString = publicKey?.toString() ?? null;

    // Fetch actual Solana token balances from devnet
    const fetchTokenBalances = useCallback(async () => {
        if (!publicKeyString || !isValidSolanaAddress(publicKeyString)) {
            return;
        }

        setIsLoadingTokens(true);
        try {
            const tokens = await fetchSolanaTokenBalances(publicKeyString);
            setSolanaTokens(tokens);
        } catch {
            // Failed to fetch Solana token balances
            setSolanaTokens([]);
        } finally {
            setIsLoadingTokens(false);
        }
    }, [publicKeyString]);

    // Fetch token balances when wallet is connected
    useEffect(() => {
        if (connected && publicKeyString) {
            fetchTokenBalances();
        }
    }, [connected, publicKeyString, fetchTokenBalances]);

    // Handle supply transaction
    const handleSupply = useCallback(async (token: SolanaToken, amount: number, evmAddress: string) => {
        if (!connected || !publicKey || !sendTransaction) {
            throw new Error('Wallet not connected');
        }

        try {
            let transaction;

            if (token.isNative) {
                // Create SOL supply transaction
                transaction = await createSOLSupplyTransaction({
                    connection,
                    userPublicKey: publicKey,
                    amount,
                    evmAddress
                });
            } else {
                // Create USDC supply transaction
                transaction = await createUSDCSupplyTransaction({
                    connection,
                    userPublicKey: publicKey,
                    amount,
                    evmAddress,
                    tokenMintAddress: USDC_MINT_DEVNET
                });
            }

            // This will trigger the wallet popup for user to sign the transaction
            const signature = await sendTransaction(transaction, connection);

            // Wait for transaction confirmation
            const latestBlockhash = await connection.getLatestBlockhash();
            await connection.confirmTransaction({
                signature,
                blockhash: latestBlockhash.blockhash,
                lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
            }, 'confirmed');

            // Refresh token balances after successful transaction
            await fetchTokenBalances();

            return signature;

        } catch (error) {
            throw new Error(error instanceof Error ? error.message : 'Transaction failed');
        }
    }, [connected, publicKey, sendTransaction, connection, fetchTokenBalances]);

    return (
        <div className="min-h-screen bg-gradient-to-br from-zeta-50 to-zeta-100 dark:from-background dark:to-secondary">
            <SolanaHeader />
            <div className="container mx-auto px-4 py-8">
                {/* Debug Info - Remove this in production */}
                <div className="mb-8">
                    <WalletDebugInfo />
                </div>

                {!connected ? (
                    <SolanaNotConnectedState />
                ) : (
                    <SolanaConnectedState
                        isPhantomConnected={connected}
                        phantomPublicKey={publicKeyString}
                        onConnectPhantom={() => Promise.resolve()}
                        onSupply={handleSupply}
                        solanaTokens={solanaTokens}
                        isLoadingTokens={isLoadingTokens}
                    />
                )}
            </div>
        </div>
    );
}

export default function DashBoardSolanaPage() {
    return (
        <SolanaWalletProvider>
            <SolanaWalletManager>
                <DashBoardSolanaPageContent />
            </SolanaWalletManager>
        </SolanaWalletProvider>
    );
}