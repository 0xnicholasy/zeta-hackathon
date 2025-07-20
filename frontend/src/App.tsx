import { ConnectButton } from '@rainbow-me/rainbowkit';
import ThemeToggle from './components/ThemeToggle';
import Stats from './components/Stats';

function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-zeta-50 to-zeta-100 dark:from-background-dark dark:to-surface-dark transition-colors">
      {/* Header */}
      <header className="border-b border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-zeta-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">Z</span>
            </div>
            <span className="text-xl font-bold text-text-primary-light dark:text-text-primary-dark">
              ZetaLend
            </span>
          </div>
          <div className="flex items-center space-x-4">
            <ThemeToggle />
            <ConnectButton />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-16">
        <div className="text-center">
          <h1 className="text-5xl font-bold text-text-primary-light dark:text-text-primary-dark mb-6">
            ZetaChain Cross-Chain Lending
          </h1>
          <p className="text-xl text-text-secondary-light dark:text-text-secondary-dark mb-8 max-w-2xl mx-auto">
            Supply collateral and borrow assets across EVM chains including Arbitrum,
            Ethereum, and ZetaChain with seamless cross-chain functionality.
          </p>
          <div className="space-x-4">
            <button className="bg-zeta-500 hover:bg-zeta-600 text-white font-semibold py-3 px-6 rounded-lg transition duration-200 shadow-lg">
              Launch App
            </button>
            <button className="bg-transparent hover:bg-zeta-50 dark:hover:bg-zeta-900 text-zeta-500 dark:text-zeta-400 font-semibold py-3 px-6 rounded-lg border border-zeta-500 dark:border-zeta-400 transition duration-200">
              Learn More
            </button>
          </div>
        </div>

        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-surface-light dark:bg-surface-dark p-6 rounded-xl shadow-lg border border-border-light dark:border-border-dark">
            <h3 className="text-xl font-semibold text-text-primary-light dark:text-text-primary-dark mb-3">
              Supply Collateral
            </h3>
            <p className="text-text-secondary-light dark:text-text-secondary-dark">
              Deposit ETH and USDC from Arbitrum, Ethereum, or ZetaChain to earn interest.
            </p>
          </div>
          <div className="bg-surface-light dark:bg-surface-dark p-6 rounded-xl shadow-lg border border-border-light dark:border-border-dark">
            <h3 className="text-xl font-semibold text-text-primary-light dark:text-text-primary-dark mb-3">
              Borrow Assets
            </h3>
            <p className="text-text-secondary-light dark:text-text-secondary-dark">
              Borrow against your collateral with competitive rates and flexible terms.
            </p>
          </div>
          <div className="bg-surface-light dark:bg-surface-dark p-6 rounded-xl shadow-lg border border-border-light dark:border-border-dark">
            <h3 className="text-xl font-semibold text-text-primary-light dark:text-text-primary-dark mb-3">
              Cross-Chain
            </h3>
            <p className="text-text-secondary-light dark:text-text-secondary-dark">
              Withdraw to any supported chain, not limited to your deposit chain.
            </p>
          </div>
        </div>

        {/* Stats Section */}
        <Stats />
      </div>
    </div>
  )
}

export default App
