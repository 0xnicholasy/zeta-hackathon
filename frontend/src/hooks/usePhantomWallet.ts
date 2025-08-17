import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PublicKey, Transaction } from '@solana/web3.js';
import type { PhantomProvider } from '@/components/wallet/types';

function detectProvider(): PhantomProvider | undefined {
  const w = window as unknown as {
    solana?: PhantomProvider;
    phantom?: { solana?: PhantomProvider };
  };
  return w?.solana ?? w?.phantom?.solana;
}

export function usePhantomWallet() {
  const [provider, setProvider] = useState<PhantomProvider | undefined>(undefined);
  const [isAvailable, setIsAvailable] = useState<boolean>(false);
  const [isConnected, setConnected] = useState<boolean>(false);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [walletPublicKey, setWalletPublicKey] = useState<PublicKey | null>(null);
  const [isBusy, setIsBusy] = useState<boolean>(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    const p = detectProvider();
    setProvider(p);
    setIsAvailable(Boolean(p?.isPhantom));
    if (p?.isConnected && p.publicKey) {
      setConnected(true);
      setWalletPublicKey(p.publicKey);
      setPublicKey(p.publicKey.toString());
    }

    // Eager connect if trusted per Phantom docs
    // https://docs.phantom.com/solana/establishing-a-connection
    p?.connect?.({ onlyIfTrusted: true })
      .then((resp: { publicKey: { toString(): string } }) => {
        if (!isMountedRef.current || !p) return;
        if (resp && p.publicKey) {
          setConnected(true);
          setWalletPublicKey(p.publicKey);
          setPublicKey(p.publicKey.toString());
        }
      })
      .catch(() => undefined);
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Subscribe to wallet events
  useEffect(() => {
    if (!provider || typeof provider.on !== 'function') return;
    const onConnect = (pk?: PublicKey) => {
      setConnected(true);
    //   console.log("🚀 ~ onConnect ~ onConnect:", pk)

      // Prefer event param; fallback to provider.publicKey
      if (pk) {
        setWalletPublicKey(pk);
        setPublicKey(pk.toString());
      } else if (provider.publicKey) {
        setWalletPublicKey(provider.publicKey);
        setPublicKey(provider.publicKey.toString());
      }
    };
    const onDisconnect = () => {
    //   console.log("🚀 ~ onDisconnect ~ onDisconnect:")
      setConnected(false);
      setWalletPublicKey(null);
      setPublicKey(null);
    };
    const onAccountChanged = (pk?: PublicKey) => {
    //   console.log("🚀 ~ onAccountChanged ~ onAccountChanged:", pk)
      if (pk) {
        setWalletPublicKey(pk);
        setPublicKey(pk.toString());
      } else {
        // Attempt to reconnect if no pk provided
        void connect(false).catch(() => undefined);
      }
    };
    provider.on('connect', onConnect);
    provider.on('disconnect', onDisconnect);
    provider.on?.('accountChanged', onAccountChanged);
    return () => {
      try {
        provider.removeListener?.('connect', onConnect);
        provider.removeListener?.('disconnect', onDisconnect);
        provider.removeListener?.('accountChanged', onAccountChanged);
      } catch {
        // ignore
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider]);

  const connect = useCallback(async (forcePrompt = true): Promise<string> => {
    if (!provider) throw new Error('Phantom provider not found');
    try {
      setIsBusy(true);
      if (forcePrompt && provider.isConnected && provider.disconnect) {
        try { await provider.disconnect(); } catch { /* ignore */ }
      }
      // https://docs.phantom.com/solana/establishing-a-connection
      const resp = await provider.connect(forcePrompt ? {} : { onlyIfTrusted: true });
    //   console.log("🚀 ~ usePhantomWallet ~ resp:", resp)
      const pk = resp?.publicKey ?? provider.publicKey;
      if (!pk) throw new Error('Failed to get public key');
      setConnected(true);
      setWalletPublicKey(pk);
      setPublicKey(pk.toString());
      return pk.toString();
    } finally {
      setIsBusy(false);
    }
  }, [provider]);

  const disconnect = useCallback(async (): Promise<void> => {
    if (!provider?.disconnect) return;
    try {
      setIsBusy(true);
      await provider.disconnect();
    //   console.log("🚀 ~ usePhantomWallet ~ disconnecting")
      setConnected(false);
      setWalletPublicKey(null);
      setPublicKey(null);
    } finally {
      setIsBusy(false);
    }
  }, [provider]);

  const signAndSendTransaction = useCallback(async (tx: Transaction): Promise<string> => {
    if (!provider?.signAndSendTransaction) throw new Error('signAndSendTransaction not supported');
    // https://docs.phantom.com/solana/sending-a-transaction
    const { signature } = await provider.signAndSendTransaction(tx);
    return signature;
  }, [provider]);

  return useMemo(() => ({
    provider,
    isAvailable,
    isConnected,
    publicKey,
    walletPublicKey,
    isBusy,
    connect,
    disconnect,
    signAndSendTransaction,
  }), [provider, isAvailable, isConnected, publicKey, walletPublicKey, isBusy, connect, disconnect, signAndSendTransaction]);
}

export type UsePhantomWallet = ReturnType<typeof usePhantomWallet>;


