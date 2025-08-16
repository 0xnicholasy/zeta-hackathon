import { Button } from '../../ui/button';

interface PhantomConnectButtonProps {
  isPhantomConnected: boolean;
  phantomPublicKey: string | null;
  onConnect: () => Promise<void>;
  onDisconnect?: (() => Promise<void>) | undefined;
}

export function PhantomConnectButton({ 
  isPhantomConnected, 
  phantomPublicKey, 
  onConnect,
  onDisconnect 
}: PhantomConnectButtonProps) {
  const formatAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  if (isPhantomConnected && phantomPublicKey) {
    return (
      <div className="flex items-center space-x-2">
        <div className="hidden sm:flex items-center space-x-2 px-3 py-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
          <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
            {formatAddress(phantomPublicKey)}
          </span>
        </div>
        <div className="sm:hidden flex items-center space-x-2 px-3 py-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
          <div className="w-6 h-6 bg-purple-600 rounded-full flex items-center justify-center">
            <span className="text-xs font-bold text-white">P</span>
          </div>
        </div>
        {onDisconnect && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onDisconnect}
            className="text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300"
          >
            Disconnect
          </Button>
        )}
      </div>
    );
  }

  return (
    <Button
      onClick={onConnect}
      className="bg-purple-600 hover:bg-purple-700 text-white border-0"
      size="sm"
    >
      <div className="flex items-center space-x-2">
        <span className="font-medium">Connect Phantom</span>
      </div>
    </Button>
  );
}