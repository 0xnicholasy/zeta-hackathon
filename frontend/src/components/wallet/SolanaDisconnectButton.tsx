import { useState } from 'react';
import { usePhantomWallet } from '@/hooks/usePhantomWallet';

export function SolanaDisconnectButton() {
  const { disconnect } = usePhantomWallet();
  const [isBusy, setIsBusy] = useState<boolean>(false);

  const handleDisconnect = async () => {
    try {
      setIsBusy(true);
      await disconnect();
    } catch (error) {
      console.error(error);
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <button
      onClick={handleDisconnect}
      disabled={isBusy}
      className="bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
    >
      {isBusy ? 'Disconnecting…' : 'Disconnect'}
    </button>
  );
}

