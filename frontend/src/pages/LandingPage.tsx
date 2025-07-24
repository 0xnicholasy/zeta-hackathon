import Stats from '../components/landing/Stats';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Header } from '@/components/dashboard/Header';
import { ROUTES } from '@/config/routes';
import { useNavigateTo } from '@/types/routes';

function LandingPage() {
    const navigate = useNavigateTo();

    const handleLaunchApp = () => {
        navigate(ROUTES.DASHBOARD);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-zeta-50 to-zeta-100 dark:from-background dark:to-secondary">
            {/* Header */}
            <Header useWalletConnector={false} />

            {/* Main Content */}
            <div className="container mx-auto px-4 py-16">
                <div className="text-center">
                    <h1 className="text-5xl font-bold text-foreground mb-6">
                        ZetaChain Cross-Chain Lending
                    </h1>
                    <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
                        Supply collateral and borrow assets across EVM chains including Arbitrum,
                        Ethereum, and ZetaChain with seamless cross-chain functionality.
                    </p>
                    <div className="space-x-4">
                        <Button variant="zeta" size="lg" onClick={handleLaunchApp}>
                            Launch App
                        </Button>
                        <Button variant="zeta-outline" size="lg">
                            Learn More
                        </Button>
                    </div>
                </div>

                <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
                    <Card className="border-border/50 bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/50">
                        <CardHeader>
                            <CardTitle className="text-xl text-card-foreground">
                                Supply Collateral
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <CardDescription>
                                Deposit ETH and USDC from Arbitrum, Ethereum, or ZetaChain to earn interest.
                            </CardDescription>
                        </CardContent>
                    </Card>

                    <Card className="border-border/50 bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/50">
                        <CardHeader>
                            <CardTitle className="text-xl text-card-foreground">
                                Borrow Assets
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <CardDescription>
                                Borrow against your collateral with competitive rates and flexible terms.
                            </CardDescription>
                        </CardContent>
                    </Card>

                    <Card className="border-border/50 bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/50">
                        <CardHeader>
                            <CardTitle className="text-xl text-card-foreground">
                                Cross-Chain
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <CardDescription>
                                Withdraw to any supported chain, not limited to your deposit chain.
                            </CardDescription>
                        </CardContent>
                    </Card>
                </div>

                {/* Stats Section */}
                <Stats />
            </div>
        </div>
    );
}

export default LandingPage; 