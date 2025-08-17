import { useState, useEffect, useCallback } from 'react';
import { SolanaWalletProvider } from '../components/wallet/SolanaWalletProvider';
import { SolanaWalletManager } from '../components/wallet/SolanaWalletManager';
import {
    createSOLSupplyTransaction,
    createUSDCSupplyTransaction,
    USDC_MINT_DEVNET
} from '../lib/solana-transactions';
import { SolanaHeader } from '../components/dashboard/solana/SolanaHeader';
import { SolanaNotConnectedState } from '../components/dashboard/solana/SolanaNotConnectedState';
import { SolanaConnectedState } from '../components/dashboard/solana/SolanaConnectedState';
import { type SolanaToken } from '../components/dashboard/solana/SolanaSupplyDialog';
import { fetchSolanaTokenBalances, isValidSolanaAddress, createSolanaConnection } from '../lib/solana-utils';
import type { PublicKey } from '@solana/web3.js';
import { usePhantomWallet } from '@/hooks/usePhantomWallet';

function DashBoardSolanaPageContent() {
    const { provider, isConnected, publicKey: publicKeyStringFromHook, connect, signAndSendTransaction } = usePhantomWallet();
    const [publicKey, setPublicKey] = useState<PublicKey | null>(null);
    const connection = createSolanaConnection();

    useEffect(() => {
        if (!provider?.on) return;
        const handleConnect = (pk?: PublicKey) => {
            setPublicKey(pk ?? provider.publicKey ?? null);
        };
        const handleDisconnect = () => {
            setPublicKey(null);
        };
        provider.on('connect', handleConnect);
        provider.on('disconnect', handleDisconnect);
        return () => {
            provider.removeListener?.('connect', handleConnect);
            provider.removeListener?.('disconnect', handleDisconnect);
        };
    }, [provider]);

    // Solana tokens state
    const [solanaTokens, setSolanaTokens] = useState<SolanaToken[]>([]);
    const [isLoadingTokens, setIsLoadingTokens] = useState(false);

    const publicKeyString = publicKey?.toString() ?? publicKeyStringFromHook ?? null;

    const ensureConnected = useCallback(async () => {
        if (!provider) throw new Error('Phantom wallet not found');
        if (!isConnected) {
            await connect(true);
        }
        if (!provider.publicKey) throw new Error('Wallet not connected');
        return provider.publicKey;
    }, [provider, isConnected, connect]);

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
        if (isConnected && publicKeyString) {
            fetchTokenBalances();
        }
    }, [isConnected, publicKeyString, fetchTokenBalances]);

    // Handle supply transaction
    const handleSupply = useCallback(async (token: SolanaToken, amount: number, evmAddress: string) => {
        const pk = await ensureConnected();
        if (!pk) throw new Error('Wallet not connected');

        try {
            let transaction;

            if (token.isNative) {
                // Create SOL supply transaction
                transaction = await createSOLSupplyTransaction({
                    connection,
                    userPublicKey: pk,
                    amount,
                    evmAddress
                });
            } else {
                // Create USDC supply transaction
                transaction = await createUSDCSupplyTransaction({
                    connection,
                    userPublicKey: pk,
                    amount,
                    evmAddress,
                    tokenMintAddress: USDC_MINT_DEVNET
                });
            }

            // Sign and send via Phantom directly
            if (!signAndSendTransaction) throw new Error('signAndSendTransaction not available');
            const signature = await signAndSendTransaction(transaction);

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
    }, [connection, fetchTokenBalances, ensureConnected, signAndSendTransaction]);

    return (
        <div className="min-h-screen bg-gradient-to-br from-zeta-50 to-zeta-100 dark:from-background dark:to-secondary">
            <SolanaHeader />
            <div className="container mx-auto px-4 py-8">
                {!isConnected ? (
                    <SolanaNotConnectedState />
                ) : (
                    <SolanaConnectedState
                        isPhantomConnected={isConnected}
                        phantomPublicKey={publicKeyString}
                        onConnectPhantom={async () => { await ensureConnected(); }}
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