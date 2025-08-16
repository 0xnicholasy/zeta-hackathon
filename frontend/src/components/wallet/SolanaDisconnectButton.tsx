/* eslint-disable @typescript-eslint/no-explicit-any */
import { useWallet } from '@solana/wallet-adapter-react';

export function SolanaDisconnectButton() {
  const { disconnect, connected } = useWallet();

  const handleDisconnect = async () => {
    try {
      // Clear all cached permissions and storage
      localStorage.removeItem('solana-wallet-adapter');
      localStorage.removeItem('walletName');
      sessionStorage.removeItem('solana-wallet-adapter');

      // Force disconnect from wallet adapter
      await disconnect();

      // Also try to disconnect from Phantom directly if available
      if (typeof window !== 'undefined' && (window as any).phantom?.solana) {
        try {
          await (window as any).phantom.solana.disconnect();
        } catch {
          // Ignore errors
        }
      }

      // Force page refresh to ensure clean state
      window.location.reload();
    } catch (error) {
      // If disconnect fails, still clear storage and refresh
      console.error('Failed to disconnect:', error);
      localStorage.clear();
      sessionStorage.clear();
      window.location.reload();
    }
  };

  if (!connected) {
    return null;
  }

  return (
    <button
      onClick={handleDisconnect}
      className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
    >
      Force Disconnect
    </button>
  );
}

