import { useCallback, useMemo } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import type { Transaction } from '@solana/web3.js';

export function usePhantomWallet() {
  const { 
    connected, 
    connecting, 
    disconnecting, 
    publicKey, 
    wallet, 
    connect, 
    disconnect, 
    sendTransaction 
  } = useWallet();
  const { connection } = useConnection();

  const isAvailable = useMemo(() => {
    return wallet?.adapter?.name === 'Phantom' || Boolean(wallet);
  }, [wallet]);

  const isConnected = connected;
  const walletPublicKey = publicKey;
  const isBusy = connecting || disconnecting;

  const connectWallet = useCallback(async (): Promise<string> => {
    if (!wallet) throw new Error('Phantom wallet not found');
    try {
      await connect();
      if (!publicKey) throw new Error('Failed to get public key');
      return publicKey.toString();
    } catch (error) {
      throw new Error(`Failed to connect: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [connect, publicKey, wallet]);

  const disconnectWallet = useCallback(async (): Promise<void> => {
    try {
      await disconnect();
    } catch (error) {
      throw new Error(`Failed to disconnect: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [disconnect]);

  const signAndSendTransaction = useCallback(async (tx: Transaction): Promise<string> => {
    if (!publicKey || !wallet) throw new Error('Wallet not connected');
    try {
      const signature = await sendTransaction(tx, connection);
      return signature;
    } catch (error) {
      throw new Error(`Failed to send transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [publicKey, wallet, sendTransaction, connection]);

  return useMemo(() => ({
    provider: wallet?.adapter,
    isAvailable,
    isConnected,
    publicKey: publicKey?.toString() ?? null,
    walletPublicKey,
    isBusy,
    connect: connectWallet,
    disconnect: disconnectWallet,
    signAndSendTransaction,
  }), [
    wallet?.adapter, 
    isAvailable, 
    isConnected, 
    publicKey, 
    walletPublicKey, 
    isBusy, 
    connectWallet, 
    disconnectWallet, 
    signAndSendTransaction
  ]);
}

export type UsePhantomWallet = ReturnType<typeof usePhantomWallet>;


