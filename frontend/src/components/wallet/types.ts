import type { PublicKey, Transaction } from "@solana/web3.js";

export interface PhantomConnectResponse {
  publicKey: PublicKey;
}

export type PhantomEvent = 'connect' | 'disconnect' | 'accountChanged';
export type PhantomEventHandler = ((publicKey?: PublicKey) => void) | (() => void);

export interface PhantomProvider {
  isPhantom?: boolean;
  isConnected?: boolean;
  publicKey?: PublicKey;
  connect: (options?: { onlyIfTrusted?: boolean }) => Promise<PhantomConnectResponse>;
  disconnect: () => Promise<void>;
  signAndSendTransaction?: (tx: Transaction, opts?: unknown) => Promise<{ signature: string }>;
  request?: (args: { method: string; params?: unknown }) => Promise<unknown>;
  on?: (event: PhantomEvent, handler: PhantomEventHandler) => void;
  removeListener?: (event: PhantomEvent, handler: PhantomEventHandler) => void;
}
