# ZetaLend - Cross-Chain Lending Protocol Frontend

A comprehensive React frontend for the ZetaChain Cross-Chain Lending Protocol, enabling users to supply collateral and borrow assets across multiple blockchain networks including EVM chains and Solana.

## 🏗️ Tech Stack

- **Framework**: React 19.1.0 with TypeScript
- **Build Tool**: Vite 7.0.4 with optimized configuration for large codebases
- **Styling**: TailwindCSS with custom Zeta theme and design system
- **Package Manager**: Bun (for optimized dependency management)
- **Web3 Integration**: 
  - Wagmi v2.16.0 + RainbowKit v2.2.8 (EVM chains)
  - Solana Web3.js v1.98.4 + Phantom wallet (Solana)
- **State Management**: TanStack React Query v5.83.0 + custom hooks
- **Form Handling**: React Hook Form v7.61.1 with Zod v4.0.8 validation
- **UI Components**: Radix UI primitives with custom Zeta theming

## 📱 Application Pages

### 1. **Landing Page** (`/`)
**Purpose**: Marketing and introduction to ZetaLend protocol

**Features**:
- Hero section with protocol overview and value proposition
- Feature cards highlighting supply, borrow, and cross-chain capabilities
- Protocol statistics display (TVL, total borrowed, active users)
- "Launch App" call-to-action button
- Responsive design with Zeta branding

**Components**: `Stats`, `Header`, feature cards with animated elements

### 2. **EVM Dashboard** (`/dashboard`)
**Purpose**: Main lending interface for EVM-compatible chains

**Features**:
- **Wallet Connection Management**: Multi-wallet support via RainbowKit
- **Multi-Chain Balance Display**: Real-time balances across all supported networks
- **Supply Interface**: Deposit collateral (ETH, USDC) from any supported chain
- **Borrow Interface**: Borrow ZRC-20 tokens with collateralization checks
- **Health Factor Monitoring**: Real-time liquidation risk assessment
- **Quick Actions Panel**: Fast access to common operations (supply, borrow, repay)
- **Transaction History**: Recent protocol interactions
- **Portfolio Overview**: Total supplied, borrowed, and available credit

**Supported Networks**:
- ZetaChain Athens Testnet (7001)
- Arbitrum Sepolia (421614)
- Ethereum Sepolia (11155111)
- Polygon Amoy (80002)
- Base Sepolia (84532)
- BSC Testnet (97)

**Components**:
- `ConnectedState` / `NotConnectedState` for wallet states
- `SupplyCard` / `BorrowCard` for asset management
- `AccountHealth` with visual health factor indicators
- Modal dialogs for supply, borrow, withdraw, repay operations

### 3. **Solana Dashboard** (`/dashboard-solana`)
**Purpose**: Dedicated interface for Solana ecosystem integration

**Features**:
- **Phantom Wallet Integration**: Native Solana wallet connection
- **SOL Supply Functionality**: Deposit SOL as collateral via cross-chain gateway
- **USDC Supply**: Support for Solana devnet USDC deposits
- **Token Balance Fetching**: Real-time SOL and SPL token balances
- **Cross-Chain Deposits**: Bridge Solana assets to ZetaChain lending protocol
- **Transaction Status Tracking**: Monitor Solana transaction confirmations
- **Devnet Support**: Full integration with Solana devnet for testing

**Components**:
- `SolanaWalletProvider` for wallet context management
- `PhantomConnectButton` for wallet connection
- `SolanaSupplyCard` for asset supply interface
- `SolanaTransactionStatus` for transaction monitoring

### 4. **Liquidation Dashboard** (`/liquidation`)
**Purpose**: Monitor and execute liquidations of undercollateralized positions

**Features**:
- **Multi-Address Monitoring**: Track up to 10 addresses simultaneously
- **Real-Time Health Factor Updates**: 10-second refresh intervals
- **Liquidation Opportunity Detection**: Automated identification of liquidatable positions
- **Liquidation Execution Interface**: One-click liquidation with profit calculations
- **Position Details**: Detailed view of collateral and debt positions
- **Liquidation History**: Track successful liquidations and profits
- **Risk Assessment**: Visual indicators for liquidation urgency

**Components**:
- Address input and tracking interface
- Health factor displays with color-coded risk levels
- Liquidation execution dialogs with profit projections

### 5. **Admin Dashboard** (`/admin`)
**Purpose**: Contract administration and protocol management interface

**Features**:
- **Network-Specific Management**: Switch between different blockchain networks
- **DepositContract Administration**:
  - Add/remove supported assets on external chains
  - Configure deposit limits and fees
  - Manage gateway permissions
- **UniversalLendingProtocol Management**:
  - Asset management (add/remove lending markets)
  - Interest rate model configuration
  - Collateral factor adjustments
  - Price oracle updates and validation
- **Chain Permission Management**: Enable/disable cross-chain functionality
- **Emergency Controls**: Pause/unpause protocol functions
- **Price Oracle Configuration**: Update price feeds and validation parameters

**Security Note**: This interface should be access-controlled in production environments.

**Components**:
- `NetworkSelector` for chain switching
- `DepositContractForms` for external chain management
- `UniversalLendingProtocolForms` for protocol configuration
- `NotificationDialog` for transaction status feedback

### 6. **Debugging Page** (`/debugging`)
**Purpose**: Development tools and component testing interface

**Features**:
- **Component Showcase**: Visual testing of UI components
- **Spinner Gallery**: Different loading state components
- **Deployment Debugging**: Contract deployment status verification
- **Network Testing**: Cross-chain functionality testing tools

## 🧩 Core Components Architecture

### **Layout & Navigation**
- **Header**: Logo, wallet connection, theme toggle, navigation
- **ResponsiveNavigation**: Mobile-friendly navigation menu
- **ThemeProvider**: Dark/light theme management with system preference detection

### **Dashboard Components**
- **AccountHealth**: Health factor visualization with liquidation risk indicators
- **SupplyCard / BorrowCard**: Asset-specific supply and borrow interfaces
- **QuickActions**: Fast access panel for common protocol operations
- **TransactionStatus**: Real-time EVM transaction monitoring
- **TokenNetworkIcon**: Multi-chain token representation with network badges

### **Dialog Components**
- **SupplyDialog**: Modal for depositing collateral with validation
- **BorrowDialog**: Modal for borrowing assets with health factor checks
- **WithdrawDialog**: Modal for withdrawing supplied assets
- **RepayDialog**: Modal for repaying borrowed assets with interest calculations

### **Solana Components**
- **SolanaWalletProvider**: Solana wallet context and state management
- **PhantomConnectButton**: Phantom wallet connection interface
- **SolanaSupplyCard**: Solana-specific asset supply interface
- **SolanaTransactionStatus**: Solana transaction confirmation tracking

### **UI Design System**
- **Base Components**: Button, Card, Dialog, Input, Label, Select (Radix UI based)
- **Custom Variants**: Zeta-themed button styles (`zeta`, `zeta-outline`, `destructive`)
- **Loading Components**: `HourglassLoader`, `Spinner` with Zeta branding
- **ChainIcon**: Network-specific iconography

## 🔧 Custom Hooks

### **Data Management**
- **`useDashboardData`**: Comprehensive user lending data aggregation across all chains
- **`useMultiChainBalances`**: Cross-chain balance fetching with automatic refresh
- **`useAdminData`**: Admin interface data management with contract state
- **`useContracts`**: Contract address resolution and validation

### **Transaction Management**
- **`useTransactionFlow`**: State management for multi-step transactions
- **`useCrossChainTracking`**: Monitor cross-chain transaction status
- **`useBorrowValidation`**: Pre-transaction validation for borrow operations
- **`useRepayValidation`**: Validation hooks for repay operations
- **`useWithdrawValidation`**: Withdrawal validation with balance checks

### **Solana Integration**
- **`usePhantomWallet`**: Phantom wallet integration and state management
- **`useGasTokenApproval`**: Gas token approval workflow management

## 🛠️ Utility Functions

### **Chain Utilities**
- **`chainUtils.ts`**: Chain mapping, token configuration, and network switching
- **`healthFactorUtils.ts`**: Health factor calculations and risk assessment
- **`formatHexString.ts`**: EVM address formatting and validation utilities

### **Solana Utilities**
- **`solana-utils.ts`**: Solana connection management and balance fetching
- **`solana-transactions.ts`**: Solana transaction creation and signing

### **Contract Utilities**
- **`directContractCalls.ts`**: Direct smart contract interaction utilities
- **`deployments.ts`**: Contract address resolution and deployment management

## ⚙️ Configuration Management

### **Contract Configuration**
- **`contracts-data.ts`**: Centralized deployment addresses across all networks
- **`deployments.ts`**: Contract address validation and resolution
- **Dynamic Configuration**: Automatic detection of contract addresses per network

### **Supported Networks**
- **ZetaChain Athens** (7001): Universal lending protocol deployment
- **Arbitrum Sepolia** (421614): ETH, USDC support
- **Ethereum Sepolia** (11155111): ETH, USDC support
- **Polygon Amoy** (80002): MATIC, USDC support
- **Base Sepolia** (84532): ETH, USDC support
- **BSC Testnet** (97): BNB, USDC support
- **Solana Devnet** (901): SOL, USDC support

### **Routing Configuration**
- **`routes.ts`**: Type-safe route definitions with lazy loading
- **Code Splitting**: Optimized bundle loading with React Suspense
- **Navigation Hooks**: Custom hooks for programmatic navigation

## 🌐 Cross-Chain Integration

### **ZetaChain Universal EVM**
- **ZRC-20 Token Support**: ETH.ARBI, USDC.ARBI, ETH.ETH, USDC.ETH, and more
- **Gateway Integration**: Seamless cross-chain deposits and withdrawals
- **Universal Contract**: Single lending contract on ZetaChain handling all chains

### **Multi-Chain Asset Flow**
1. **Deposit**: Assets from any supported chain → ZetaChain via gateway
2. **Supply**: ZRC-20 tokens supplied as collateral on ZetaChain
3. **Borrow**: ZRC-20 tokens borrowed against collateral
4. **Withdraw**: Assets withdrawn to any supported destination chain

### **Solana Bridge Integration**
- **SOL/USDC Deposits**: Bridge Solana assets to ZetaChain
- **Cross-Chain Tracking**: Monitor bridge transaction status
- **Unified Interface**: Consistent UX across EVM and Solana ecosystems

## 🎨 Theme and Design System

### **Zeta Brand Identity**
- **Primary Color**: Zeta Green (`#008462`)
- **Design Language**: Modern, clean interface with cross-chain focus
- **Responsive Design**: Mobile-first approach with desktop optimization

### **Component Variants**
- **Button Styles**: `zeta`, `zeta-outline`, `destructive` with hover states
- **Token Icons**: Web3Icons integration with custom network badges
- **Status Indicators**: Color-coded health factors and transaction states

### **Dark/Light Themes**
- **System Preference**: Automatic theme detection
- **Manual Toggle**: User preference persistence
- **Consistent Styling**: Theme-aware component variants

## 🚀 Performance Optimizations

### **Build Optimizations**
- **Vite Configuration**: Memory-optimized build for large codebase
- **Code Splitting**: Route-based lazy loading
- **Bundle Analysis**: Optimized dependency bundling

### **Runtime Performance**
- **Efficient Polling**: Balanced refresh intervals (10-15 seconds)
- **Memoization**: React.memo and useMemo for expensive calculations
- **Query Optimization**: TanStack Query for efficient data fetching

## 🔐 Security Features

### **Address Validation**
- **Type Safety**: Custom EVM address types and validation
- **Contract Verification**: Address validation before interactions
- **Input Sanitization**: Form validation with Zod schemas

### **Transaction Security**
- **Pre-execution Validation**: Client-side checks before transactions
- **Health Factor Monitoring**: Prevent dangerous borrow operations
- **Error Handling**: Comprehensive error states and user feedback

## 📊 Data Flow Architecture

### **User Data Pipeline**
1. **Multi-Chain Balance Fetching**: External chain balances via Wagmi
2. **Protocol Data Aggregation**: ZetaChain lending positions
3. **Real-Time Updates**: Continuous refresh with optimized intervals
4. **Health Factor Monitoring**: Continuous liquidation risk assessment

### **State Management Pattern**
- **React Query**: Server state management with caching
- **Custom Hooks**: Business logic encapsulation
- **Context Providers**: Wallet and theme state management
- **Form State**: React Hook Form for complex form interactions

## 🔧 Development Scripts

```bash
# Install dependencies
bun install

# Start development server
bun run dev

# Build for production
bun run build

# Preview production build
bun run preview

# Type checking
bun run type-check

# Linting
bun run lint
```

## 📁 Project Structure

```
frontend/
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── ui/             # Base design system components
│   │   ├── dashboard/      # Dashboard-specific components
│   │   ├── solana/         # Solana integration components
│   │   └── admin/          # Admin interface components
│   ├── pages/              # Application pages/routes
│   ├── hooks/              # Custom React hooks
│   ├── utils/              # Utility functions and helpers
│   ├── config/             # Configuration files
│   ├── contracts/          # Contract ABIs and type definitions
│   └── styles/             # Global styles and themes
├── public/                 # Static assets
└── docs/                   # Documentation
```

This frontend provides a comprehensive, user-friendly interface for the ZetaChain Cross-Chain Lending Protocol, supporting both EVM and Solana ecosystems with a focus on security, performance, and seamless cross-chain functionality.
