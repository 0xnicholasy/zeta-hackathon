import { ConnectButton } from '@rainbow-me/rainbowkit';
import ThemeToggle from '../ThemeToggle';
import { useNavigateTo } from '@/types/routes';
import { ROUTES } from '@/config/routes';
import zetaLendLogo from '@/assets/zetalend-logo.png';

export function Header() {
    const navigate = useNavigateTo();

    const handleLogoClick = () => {
        navigate(ROUTES.HOME);
    };

    return (
        <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="container mx-auto px-4 py-4 flex flex-wrap justify-between items-center gap-4 md:flex-nowrap md:gap-0">
                <div className="flex items-center space-x-2 cursor-pointer" onClick={handleLogoClick}>
                    <img
                        src={zetaLendLogo}
                        alt="ZetaLend Logo"
                        className="size-10 rounded-lg"
                    />
                    <span className="text-xl font-bold text-foreground">
                        ZetaLend
                    </span>
                </div>

                {/* Theme toggle - stays on first row */}
                <div className="md:hidden">
                    <ThemeToggle />
                </div>

                {/* Desktop: Theme toggle + Connect button together */}
                <div className="hidden md:flex items-center space-x-4">
                    <ThemeToggle />
                    <ConnectButton />
                </div>

                {/* Mobile: Connect button on new row, full width and centered */}
                <div className="w-full flex justify-end md:hidden">
                    <ConnectButton />
                </div>
            </div>
        </header>
    );
}