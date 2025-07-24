import { Card, CardContent } from '../ui/card';

interface AccountHealthProps {
    healthFactor: string;
    totalSupplied: string;
    totalBorrowed: string;
}

export function AccountHealth({ healthFactor, totalSupplied, totalBorrowed }: AccountHealthProps) {
    const getHealthFactorColor = (hf: string) => {
        if (hf === '∞' || Number(hf) > 1.5) return 'text-green-500';
        if (Number(hf) > 1.2) return 'text-yellow-500';
        return 'text-red-500';
    };

    const getHealthFactorStatus = (hf: string) => {
        if (hf === '∞' || Number(hf) > 1.5) return 'Safe (>1.5)';
        if (Number(hf) > 1.2) return 'At Risk (<1.5)';
        return 'Liquidation Risk (<1.2)';
    };

    const getHealthFactorBadgeColor = (hf: string) => {
        if (hf === '∞' || Number(hf) > 1.5) return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
        if (Number(hf) > 1.2) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
    };

    return (
        <div className="mb-8">
            <div className="mb-4">
                <h2 className="text-xl font-bold">Account Health</h2>
                <p className="text-muted-foreground text-sm">Your borrowing capacity and liquidation risk</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Health Factor Card */}
                <Card>
                    <CardContent className="p-6 text-center">
                        <div className={`text-3xl font-bold mb-2 ${getHealthFactorColor(healthFactor)}`}>
                            {healthFactor}
                        </div>
                        <div className="text-sm font-medium text-muted-foreground mb-1">
                            Health Factor
                        </div>
                        <div className={`text-xs px-2 py-1 rounded-full inline-block ${getHealthFactorBadgeColor(healthFactor)}`}>
                            {getHealthFactorStatus(healthFactor)}
                        </div>
                    </CardContent>
                </Card>

                {/* Total Supplied Card */}
                <Card>
                    <CardContent className="p-6 text-center">
                        <div className="text-3xl font-bold text-zeta-500 dark:text-zeta-400 mb-2">
                            {totalSupplied}
                        </div>
                        <div className="text-sm font-medium text-muted-foreground mb-1">
                            Total Supplied
                        </div>
                        <div className="text-xs text-muted-foreground bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded-full inline-block">
                            Earning interest
                        </div>
                    </CardContent>
                </Card>

                {/* Total Borrowed Card */}
                <Card>
                    <CardContent className="p-6 text-center">
                        <div className="text-3xl font-bold text-red-500 mb-2">
                            {totalBorrowed}
                        </div>
                        <div className="text-sm font-medium text-muted-foreground mb-1">
                            Total Borrowed
                        </div>
                        <div className="text-xs text-muted-foreground bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded-full inline-block">
                            Accruing interest
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}