import React, { useMemo, useCallback } from 'react';
import {
  ConnectionProvider,
  WalletProvider,
} from '@solana/wallet-adapter-react';
import {
  WalletModalProvider,
} from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom';
import { BraveWalletAdapter } from '@solana/wallet-adapter-brave';
import { SolflareWalletAdapter } from '@solana/wallet-adapter-solflare';
import { TorusWalletAdapter } from '@solana/wallet-adapter-torus';
import { clusterApiUrl } from '@solana/web3.js';

import '@solana/wallet-adapter-react-ui/styles.css';

interface SolanaWalletProviderProps {
  children: React.ReactNode;
}

export function SolanaWalletProvider({ children }: SolanaWalletProviderProps) {
  const endpoint = useMemo(() => {
    // Try to use a more reliable RPC endpoint
    return clusterApiUrl('devnet');
  }, []);

  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new BraveWalletAdapter(),
      new SolflareWalletAdapter(),
      new TorusWalletAdapter(),
    ],
    []
  );

  // Custom error handler to prevent auto-reconnection
  const onError = useCallback((error: Error) => {
    // Wallet connection error - prevent auto-reconnection
    void error;
  }, []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider
        wallets={wallets}
        autoConnect={false}
        onError={onError}
      >
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}