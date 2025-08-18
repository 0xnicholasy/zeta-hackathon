import { useCallback } from 'react';
import { usePhantomWallet } from '@/hooks/usePhantomWallet';

export function SolanaWalletButton() {
  const { isAvailable, isBusy, connect, isConnected, publicKey } = usePhantomWallet();

  const handleConnect = useCallback(async () => {
    if (!isAvailable) {
      window.open('https://phantom.app/', '_blank');
      return;
    }
    await connect();
  }, [isAvailable, connect]);

  return (
    <button
      onClick={handleConnect}
      disabled={!isAvailable || isBusy}
      className="bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white border-0 font-medium px-4 py-2 rounded-lg text-sm"
    >
      {isConnected ? `${publicKey?.slice(0, 4)}...${publicKey?.slice(-4)}` : isAvailable ? (isBusy ? 'Opening Phantom…' : 'Connect Phantom') : 'Install Phantom'}
    </button>
  );
}