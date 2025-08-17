import ThemeToggle from '../../ThemeToggle';
import { useNavigateTo } from '@/types/routes';
import { ROUTES } from '@/config/routes';
import zetaLendLogo from '@/assets/zetalend-logo.png';
import { SolanaWalletButton } from '../../wallet/SolanaWalletButton';
import { SolanaDisconnectButton } from '../../wallet/SolanaDisconnectButton';
import { usePhantomWallet } from '@/hooks/usePhantomWallet';

export function SolanaHeader() {
  const navigate = useNavigateTo();
  const { isConnected } = usePhantomWallet();

  const handleLogoClick = () => {
    navigate(ROUTES.HOME);
  };

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 py-4 flex flex-wrap justify-between items-center gap-4 md:flex-nowrap md:gap-0">
        <div className="flex items-center space-x-4 cursor-pointer" onClick={handleLogoClick}>
          <img
            src={zetaLendLogo}
            alt="ZetaLend Logo"
            className="size-8 rounded-lg"
          />
          <span className="text-xl font-bold text-foreground">
            ZetaLend
          </span>
        </div>
        {/* Desktop: Theme toggle + Phantom Connect button together */}
        <div className="flex items-center space-x-4">
          <div className='hidden md:block'>
            <ThemeToggle />
          </div>
          <SolanaWalletButton />
          {isConnected && <SolanaDisconnectButton />}
        </div>
      </div>
    </header>
  );
}