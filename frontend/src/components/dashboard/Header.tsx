import { ConnectButton } from '@rainbow-me/rainbowkit';
import ThemeToggle from '../ThemeToggle';
import { useNavigateTo } from '@/types/routes';
import { ROUTES } from '@/config/routes';

export function Header() {
    const navigate = useNavigateTo();

    const handleLogoClick = () => {
        navigate(ROUTES.HOME);
    };

    return (
        <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="container mx-auto px-4 py-4 flex justify-between items-center">
                <div className="flex items-center space-x-2 cursor-pointer" onClick={handleLogoClick}>
                    <div className="w-8 h-8 bg-zeta-500 rounded-lg flex items-center justify-center">
                        <span className="text-white font-bold text-lg">Z</span>
                    </div>
                    <span className="text-xl font-bold text-foreground">
                        ZetaLend
                    </span>
                </div>
                <div className="flex items-center space-x-4">
                    <ThemeToggle />
                    <ConnectButton />
                </div>
            </div>
        </header>
    );
}