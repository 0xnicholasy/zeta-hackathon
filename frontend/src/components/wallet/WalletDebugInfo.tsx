import { useState } from "react";

export function WalletDebugInfo() {

  const getProvider = () => {
    if ('phantom' in window) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const provider = (window as any).phantom?.solana;

      if (provider?.isPhantom) {
        return provider;
      }
    }

    window.open('https://phantom.app/', '_blank');
  };
  const [provider] = useState(getProvider());
  const connected = Boolean(provider?.isConnected);
  const publicKey = provider?.publicKey?.toString?.() ?? null;

  return (
    <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg text-xs font-mono">
      <h3 className="font-bold mb-2">Wallet Debug Info:</h3>
      <div>Connected: {connected ? 'Yes' : 'No'}</div>
      <div>Public key: {publicKey ?? 'None'}</div>
      <div>Phantom available: {provider?.isPhantom ? 'Yes' : 'No'}</div>
      <button onClick={async () => {
        if (provider !== undefined) {
          const result = await provider.disconnect();
          console.log(result);
        }
      }}>Disconnect</button>
    </div>
  );
}

