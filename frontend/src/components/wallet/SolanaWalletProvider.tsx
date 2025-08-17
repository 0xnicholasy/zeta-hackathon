import React from 'react';

interface SolanaWalletProviderProps {
  children: React.ReactNode;
}

// No-op provider now that we've removed wallet-adapter. Keeps tree stable.
export function SolanaWalletProvider({ children }: SolanaWalletProviderProps) {
  return <>{children}</>;
}