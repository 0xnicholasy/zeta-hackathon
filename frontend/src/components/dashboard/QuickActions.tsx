import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { FaPlus, FaArrowDown, FaExchangeAlt, FaBolt } from 'react-icons/fa';

export function QuickActions() {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <div className="w-8 h-8 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center">
                            <FaPlus className="text-green-600 dark:text-green-400 text-sm" />
                        </div>
                        Supply
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <CardDescription>
                        Deposit assets to earn interest and use as collateral.
                    </CardDescription>
                </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
                            <FaArrowDown className="text-blue-600 dark:text-blue-400 text-sm" />
                        </div>
                        Borrow
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <CardDescription>
                        Borrow assets against your supplied collateral.
                    </CardDescription>
                </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center">
                            <FaExchangeAlt className="text-purple-600 dark:text-purple-400 text-sm" />
                        </div>
                        Bridge
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <CardDescription>
                        Transfer assets between supported chains.
                    </CardDescription>
                </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <div className="w-8 h-8 bg-orange-100 dark:bg-orange-900 rounded-lg flex items-center justify-center">
                            <FaBolt className="text-orange-600 dark:text-orange-400 text-sm" />
                        </div>
                        Liquidate
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <CardDescription>
                        Liquidate undercollateralized positions for profit.
                    </CardDescription>
                </CardContent>
            </Card>
        </div>
    );
}