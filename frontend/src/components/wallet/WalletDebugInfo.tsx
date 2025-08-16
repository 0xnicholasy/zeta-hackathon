import { useWallet } from '@solana/wallet-adapter-react';

export function WalletDebugInfo() {
  const { wallets, wallet, connected, connecting, publicKey } = useWallet();

  return (
    <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg text-xs font-mono">
      <h3 className="font-bold mb-2">Wallet Debug Info:</h3>
      <div>Available wallets: {wallets.length}</div>
      <div>Wallet names: {wallets.map(w => w.adapter.name).join(', ')}</div>
      <div>Current wallet: {wallet?.adapter.name ?? 'None'}</div>
      <div>Connected: {connected ? 'Yes' : 'No'}</div>
      <div>Connecting: {connecting ? 'Yes' : 'No'}</div>
      <div>Public key: {publicKey?.toString() ?? 'None'}</div>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <div>Phantom available: {typeof window !== 'undefined' && (window as any).phantom ? 'Yes' : 'No'}</div>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <div>Brave wallet: {typeof window !== 'undefined' && (window as any).braveSolana ? 'Yes' : 'No'}</div>
    </div>
  );
}

