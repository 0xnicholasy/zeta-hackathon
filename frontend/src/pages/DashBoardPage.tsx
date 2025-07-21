import { useAccount } from 'wagmi';
import { Header } from '../components/dashboard/Header';
import { NotConnectedState } from '../components/dashboard/NotConnectedState';
import { ConnectedState } from '../components/dashboard/ConnectedState';

function DashBoardPage() {
    const { isConnected } = useAccount();

    return (
        <div className="min-h-screen bg-gradient-to-br from-zeta-50 to-zeta-100 dark:from-background dark:to-secondary">
            <Header />
            <div className="container mx-auto px-4 py-8">
                {!isConnected ? (
                    <NotConnectedState />
                ) : (
                    <ConnectedState />
                )}
            </div>
        </div>
    );
}

export default DashBoardPage;