# ZetaChain Lending Protocol Frontend - Development Reference

## Project Overview
**React 19 + TypeScript + Vite** application for ZetaChain Cross-Chain Lending Protocol. Supports supply/borrow/repay/withdraw/liquidation across Arbitrum, Ethereum, Polygon, Base, BSC, and Solana.

**This is the single source of truth for frontend development** - quick reference for architecture and patterns.

## Current Project Structure

```
frontend/
├── src/                    # Source files
│   ├── assets/            # Static assets (zetalend-logo.png)
│   ├── components/        # Reusable UI components
│   │   ├── ui/           # Basic UI components (shadcn/ui-based)
│   │   │   ├── base-transaction-dialog.tsx    # Reusable transaction dialog base
│   │   │   ├── transaction-error-boundary.tsx # Error boundary for transactions
│   │   │   ├── transaction-simulation-display.tsx # Transaction simulation UI
│   │   │   ├── transaction-status.tsx         # Transaction status displays
│   │   │   ├── token-network-icon.tsx        # Multi-chain token icons
│   │   │   ├── categorized-error-display.tsx # User-friendly error messages
│   │   │   └── [other shadcn/ui components] # button, dialog, form, etc.
│   │   ├── dashboard/    # Dashboard-specific components
│   │   │   ├── ConnectedState.tsx           # Main dashboard for connected users
│   │   │   ├── AccountHealth.tsx            # Health factor display
│   │   │   ├── SupplyCard.tsx / BorrowCard.tsx # Asset cards
│   │   │   ├── *Dialog.tsx                  # Transaction dialogs
│   │   │   ├── borrow/                      # Borrow-specific components
│   │   │   ├── solana/                      # Solana-specific components
│   │   │   └── types.ts                     # Dashboard type definitions
│   │   ├── admin/        # Admin panel components
│   │   ├── landing/      # Landing page components
│   │   ├── liquidation/  # Liquidation interface
│   │   └── wallet/       # Wallet connection components
│   ├── config/           # Configuration files
│   │   ├── contracts-data.ts               # Contract deployment data
│   │   ├── wagmi.ts                        # Wagmi/RainbowKit configuration
│   │   └── routes.ts                       # Application routes
│   ├── contexts/         # React context providers
│   │   └── ThemeContext.tsx               # Dark/light theme context
│   ├── contracts/        # Contract definitions and utilities
│   │   ├── deployments.ts                 # Contract address management
│   │   └── typechain-types/               # Generated contract types
│   ├── hooks/           # Custom React hooks
│   │   ├── useContracts.ts               # Contract address hook
│   │   ├── useDashboardData.ts           # Dashboard data fetching
│   │   ├── useMultiChainBalances.ts      # Cross-chain balance fetching
│   │   ├── useTransactionFlow.ts         # Transaction state management
│   │   ├── useAutoSimulation.ts          # Automatic transaction simulation
│   │   └── [validation hooks]            # Input validation hooks
│   ├── lib/             # Utility functions
│   │   ├── utils.ts                      # General utilities (cn function)
│   │   ├── solana-utils.ts               # Solana-specific utilities
│   │   └── solana-transactions.ts        # Solana transaction helpers
│   ├── pages/           # Page components (all end with 'Page')
│   │   ├── DashBoardPage.tsx            # Main lending dashboard
│   │   ├── DashBoardSolanaPage.tsx      # Solana-specific dashboard
│   │   ├── AdminPage.tsx                # Admin interface
│   │   ├── LiquidationPage.tsx          # Liquidation interface
│   │   └── LandingPage.tsx              # Landing page
│   ├── providers/       # Web3 and other providers
│   │   └── Web3Providers.tsx           # Wagmi + RainbowKit setup
│   ├── types/           # TypeScript type definitions
│   │   ├── address.ts                   # Branded address types (EVMAddress)
│   │   ├── transactions.ts              # Transaction type definitions
│   │   └── routes.ts                    # Route type definitions
│   └── utils/           # Utility functions
│       ├── chainUtils.ts                # Chain mapping and utilities
│       ├── healthFactorUtils.ts         # Health factor calculations
│       ├── transactionSimulation.ts     # Transaction simulation
│       ├── errorCategorization.ts       # Error message categorization
│       ├── viemHelpers.ts               # Viem utility functions
│       └── directContractCalls.ts       # Direct contract interactions
├── package.json         # Dependencies and scripts
├── tailwind.config.js   # TailwindCSS configuration
├── vite.config.ts       # Vite build configuration
└── components.json      # shadcn/ui components configuration
```

## Architecture Patterns

### Type System - `/types/address.ts`
- **Branded Types**: `EVMAddress`, `EVMTransactionHash`, `SolanaTransactionHash`
- **Validation Functions**: `isEVMAddress()`, `validateEVMAddress()`, `safeEVMAddress()`
- **Usage**: Always use validation functions, never type assertions

### Contract Integration - `useContracts` Hook
- **File**: `/hooks/useContracts.ts`
- **Purpose**: Centralized contract address management
- **Returns**: Contract addresses, tokens, validation functions
- **Usage**: `const contracts = useContracts(chainId)`

### Multi-Chain Token System - `/utils/chainUtils.ts` 
- **Functions**: `getZetaTokenAddress()`, `getTokenInfo()`, `getChainDisplayName()`
- **Config**: `CHAIN_TOKEN_MAPPINGS` for cross-chain token resolution
- **Purpose**: Map tokens across different chains

### Transaction Dialog Pattern - `BaseTransactionDialog`
- **File**: `/components/ui/base-transaction-dialog.tsx`
- **Usage**: Foundation for ALL transaction dialogs
- **Props**: isOpen, title, tokenSymbol, currentStep, onSubmit
- **Pattern**: Use with `useStandardizedTransactionDialog` hook

### Transaction State Management - `useTransactionFlow`
- **File**: `/hooks/useTransactionFlow.ts`
- **Purpose**: Standardized approval → execution → success flow
- **Types**: Type-safe steps for each transaction type
- **Integration**: Use with `BaseTransactionDialog`

### Error Handling - `categorizeError`
- **File**: `/utils/errorCategorization.ts`
- **Purpose**: Convert technical errors to user-friendly messages
- **Components**: `CategorizedErrorDisplay`, `ErrorSummary`, `ErrorToast`
- **Usage**: Always wrap errors with categorization

### Health Factor Utilities - `/utils/healthFactorUtils.ts`
- **Functions**: `compareHealthFactors()`, `isLiquidatable()`, `formatHealthFactorFromString()`
- **Purpose**: Precision-safe string-based calculations
- **Usage**: Always use string format for health factors

## Development Guidelines

### Do's
**Component Organization**:
- Use existing `BaseTransactionDialog` for ALL transaction dialogs
- Place shared components in `/components/ui` (shadcn/ui structure)
- Use feature directories: `/dashboard`, `/admin`, `/wallet`, `/liquidation`
- Check existing components before creating new ones
- Always use `TokenNetworkIcon` for token/chain display

**Type Safety**:
- Use branded types: `EVMAddress`, `EVMTransactionHash` (never type assertions)
- Use validation functions: `isEVMAddress()`, `safeEVMAddress()`
- Use generated typechain types from `/contracts/typechain-types/`
- Import types from `/components/dashboard/types.ts`, `/types/transactions.ts`

**State Management**:
- Use `useDashboardData` for user lending data
- Use `useMultiChainBalances` for cross-chain balances
- Use `useTransactionFlow` for transaction states
- Use `useContracts` for contract addresses
- Keep state close to usage

**Web3 Integration**:
- Always use `useContracts` hook for addresses
- Wrap transactions with `TransactionErrorBoundary`
- Use wagmi hooks: `useReadContracts`, `useWriteContract`
- Follow multi-chain mapping in `/utils/chainUtils.ts`

**Performance**:
- Use `useCallback`, `useMemo` to prevent re-renders
- Leverage wagmi caching for contract reads
- Use `React.memo` for expensive components

### Don'ts
**Anti-patterns**:
- Don't duplicate code - reuse existing components
- Don't put business logic in components - use hooks
- Don't hardcode addresses - use `useContracts` hook
- Don't use `any` type - use `unknown` for external APIs only
- Don't bypass branded types - use validation functions
- Don't create dialogs from scratch - extend `BaseTransactionDialog`

**Component Guidelines**:
- Don't create oversized components (400 line limit for pages)
- Don't mix presentational/container patterns
- Don't use inline styles - use Tailwind classes
- Don't hardcode Tailwind values like `w-[10px]` - use `w-10`

**Performance**:
- Don't cause unnecessary re-renders
- Don't ignore React hooks dependencies
- Don't create objects/functions in render

**UI Guidelines**:
- Don't display emoji in UI - use `react-icons` or `web3-icons`
- Don't skip loading and error states
   

## Component Reference

### Core Components

#### Transaction Components
- `BaseTransactionDialog` - `/components/ui/base-transaction-dialog.tsx` - Foundation for ALL transaction dialogs
  - **Props**: isOpen, title, tokenSymbol, currentStep, onSubmit, children
  - **Usage**: Use with `useStandardizedTransactionDialog` hook
- `TokenNetworkIcon` - `/components/ui/token-network-icon.tsx` - Token + network display
  - **Props**: tokenSymbol, sourceChain, size, showNativeIndicator
- `TransactionErrorBoundary` - `/components/ui/transaction-error-boundary.tsx` - Error boundary wrapper
- `TransactionStatus` - `/components/ui/transaction-status.tsx` - Transaction progress display
- `TransactionSimulationDisplay` - `/components/ui/transaction-simulation-display.tsx` - Pre-transaction simulation
- `TransactionSummary` - `/components/ui/transaction-summary.tsx` - Post-transaction summary

#### Error Components
- `CategorizedErrorDisplay` - `/components/ui/categorized-error-display.tsx` - Main error display
  - **Props**: error, onRetry, onDismiss, showTechnicalDetails
- `ErrorSummary` - Compact inline error display
- `ErrorToast` - Toast-style error notifications

## Hook Reference

### Core Data Hooks
- `useDashboardData` - `/hooks/useDashboardData.ts` - Primary lending protocol data hook
  - **Returns**: userAssets, totalSupplied, totalBorrowed, healthFactor, refetchUserData
  - **Purpose**: All user lending data (supplies, borrows, balances, health factor)
  - **Usage**: Main dashboard data source

- `useMultiChainBalances` - `/hooks/useMultiChainBalances.ts` - Cross-chain balance fetching
  - **Returns**: balances, isLoading, getBalance, getTotalUSDValue
  - **Purpose**: Wallet balances across all supported chains with price data
  - **Helpers**: getBalance(), getTotalBalance(), getTokenTotalUSDValue()

### Transaction Hooks
- `useTransactionFlow` - `/hooks/useTransactionFlow.ts` - Core transaction state management
  - **Returns**: state (currentStep, isSubmitting), actions (setCurrentStep, writeContract), contractState
  - **Types**: useSupplyTransactionFlow, useBorrowTransactionFlow, useWithdrawTransactionFlow, useRepayTransactionFlow
  - **Purpose**: Manages approval → execution → success flow with type safety

- `useStandardizedTransactionDialog` - `/hooks/useStandardizedTransactionDialog.ts` - Standard dialog pattern
  - **Returns**: state (amount, validation, simulation), actions (setAmount, openDialog), transactionFlow, computed
  - **Options**: transactionType, enableSimulation, resetOnClose
  - **Purpose**: THE standard pattern for ALL transaction dialogs with validation and simulation
  - **Alternative**: `useSimpleTransactionDialog` for dialogs without recipient address

### Validation & Contract Hooks
- `useBorrowValidation` - `/hooks/useBorrowValidation.ts` - Comprehensive borrow validation
  - **Params**: selectedAsset, amountToBorrow, userAddress
  - **Returns**: isValid, error, maxBorrowAmount, estimatedHealthFactor
  - **Purpose**: Validates borrow amounts with health factor checks

- `useContracts` - `/hooks/useContracts.ts` - Centralized contract address management
  - **Returns**: Contract addresses, tokens, helper functions, deployment checks
  - **Helpers**: getContract(), getToken(), isDeployed(), isAvailable()
  - **Addresses**: universalLendingProtocol, ethArbi, usdcArbi, priceOracle
  - **Usage**: Primary hook for ALL contract address resolution

## Utility Reference

### Core Utilities
- **Address Type System** - `/types/address.ts` - Branded address types
  - **Types**: `EVMAddress`, `EVMTransactionHash`, `SolanaTransactionHash`
  - **Guards**: `isEVMAddress()`, `isEVMTransactionHash()`
  - **Safe Conversion**: `safeEVMAddress()`, `validateEVMAddress()`
  - **Helpers**: `addressesEqual()`, `isZeroAddress()`
  - **Rule**: ALWAYS use validation functions, never type assertions

- **Input Validation** - `/utils/inputValidation.ts` - Comprehensive form validation
  - **Main**: `validateAmountInput()` - Amount validation with decimals, limits
  - **Specialized**: `validateHealthFactorRequirement()`, `validateAddressInput()`, `validateGasRequirements()`
  - **Returns**: `ValidationResult` (isValid, error, warnings, normalizedValue)
  - **Usage**: Use with `useValidationEffect()` hook for debounced validation

- **Health Factor Utilities** - `/utils/healthFactorUtils.ts` - Precision-safe calculations
  - **Core Functions**: `compareHealthFactors()`, `isLiquidatable()`, `isBelowRecommended()`
  - **Display**: `getHealthFactorColorClassFromString()`, `formatHealthFactorFromString()`
  - **Important**: All functions use string format for precision safety

- **Chain Utilities** - `/utils/chainUtils.ts` - Multi-chain mapping and resolution
  - **Config**: `CHAIN_TOKEN_MAPPINGS` - Chain-to-token mapping configuration
  - **Chain Functions**: `getChainDisplayName()`, `getChainIdFromSourceChain()`, `getGasTokenSymbol()`
  - **Token Functions**: `getZetaTokenAddress()`, `getTokenInfo()`, `isTokenSupportedOnChain()`
  - **Purpose**: Maps tokens and chains for cross-chain operations

- **Error Categorization** - `/utils/errorCategorization.ts` - Comprehensive error handling
  - **Main Function**: `categorizeError()` - Converts technical errors to user-friendly messages
  - **Categories**: USER_REJECTION, INSUFFICIENT_FUNDS, CONTRACT_REVERT, HEALTH_FACTOR_TOO_LOW, etc.
  - **UI Helpers**: `getSeverityClasses()`, `getSeverityIcon()` - Styling based on error severity
  - **Returns**: `CategorizedError` (category, title, message, userAction, severity, canRetry)

- **Transaction Simulation** - `/utils/transactionSimulation.ts` - Pre-transaction validation
  - **Functions**: `simulateSupply()`, `simulateBorrow()`, `simulateWithdraw()`, `simulateRepay()`
  - **Main Dispatcher**: `simulateTransaction()` - Handles all transaction types
  - **Returns**: `SimulationResult` (success, gasEstimate, healthFactorAfter, warnings)
  - **Usage**: Integrated with `useStandardizedTransactionDialog` for automatic simulation

- **Direct Contract Calls** - `/utils/directContractCalls.ts` - Direct blockchain data fetching
  - **Asset Functions**: `getAssetConfig()`, `getAssetPrice()`, `getTokenBalance()`
  - **Protocol Functions**: `getAllSupportedAssets()`, `getProtocolAssetData()`, `calculateTVL()`
  - **Purpose**: Direct contract reads without wagmi hooks (for utilities)

## Quick Reference Patterns

### New Transaction Dialog Pattern
**File**: Create new dialog component
1. Import: `useStandardizedTransactionDialog`, `BaseTransactionDialog`, `validateAmountInput`
2. Setup hook: `useStandardizedTransactionDialog({ transactionType, enableSimulation })`
3. Add validation: `useValidationEffect()` for amount validation
4. Auto-simulation: React effect for `runSimulation()` when amount changes
5. Submit handler: Call `transactionFlow.actions.writeContract()` with contract ABI
6. Render: `BaseTransactionDialog` with form inputs, simulation display, asset info

### New Page Component Pattern
**File**: Create new page component (ending with 'Page')
1. Import: `useDashboardData`, `useMultiChainBalances`, `useContracts`, `TransactionErrorBoundary`
2. Data hooks: Get user data, balances, contracts with deployment checks
3. Loading states: Handle loading and error states with spinners
4. Error boundary: Wrap page content with `TransactionErrorBoundary`
5. Structure: Header, summary cards, asset lists with `TokenNetworkIcon`
6. Refresh: Include refresh button calling `refetchUserData()`

### New Utility Function Pattern
**File**: Create in appropriate `/utils/` directory
1. Import: Use branded types (`EVMAddress`), import `formatUnits/parseUnits` from viem
2. Structure: Input validation → address validation (if applicable) → main logic → error handling
3. Return type: `{ success: boolean; result?: T; error?: string }`
4. JSDoc: Include parameter descriptions and return value documentation
5. Testing: Create `.test.ts` file with unit tests
6. Export: Add to utility index if creating shared utilities

## Quick Decision Reference

### Hook Selection Guide
**Data Fetching**:
- `useDashboardData` - User lending data (supplies, borrows, health factor)
- `useMultiChainBalances` - Wallet balances across chains
- `useContracts` - Contract addresses and deployment status
- `useBorrowValidation` - Borrow amount validation with health factor checks

**Transaction Management**:
- `useTransactionFlow` - Basic transaction state (approval → execution → success)
- `useStandardizedTransactionDialog` - Complete dialog with validation + simulation
- `useSimpleTransactionDialog` - Dialog without recipient address

**Validation**:
- `validateAmountInput` - All numeric amount inputs
- `validateAddressInput` - Address field validation
- `validateHealthFactorRequirement` - Operations affecting health factor

### Component Selection Guide
**Transaction Dialogs**: `BaseTransactionDialog` + `useStandardizedTransactionDialog` + `TransactionErrorBoundary` + `CategorizedErrorDisplay` + `TransactionSimulationDisplay`

**Error Handling**: `CategorizedErrorDisplay` (detailed), `ErrorSummary` (inline), `ErrorToast` (notifications), `TransactionErrorBoundary` (boundaries)

**Asset Display**: Always use `TokenNetworkIcon` + health factor utilities for color coding

### Feature Addition Checklists
**New Transaction Type**: Add to `types/transactions.ts` → Create dialog with `BaseTransactionDialog` → Add simulation support → Update error patterns → Test scenarios

**New Chain Support**: Add to `SupportedChain` enum → Update `CHAIN_TOKEN_MAPPINGS` → Add network icon → Test transactions

**New Token Support**: Add to `TOKEN_SYMBOLS` → Update token mapping → Add icon support → Test price fetching → Test all transaction types

## Development Tools & Commands

### Build Commands
- **Development**: `bun dev` (start dev server)
- **Production build**: `bun build` 
- **Linting**: `bun lint` (REQUIRED before commits)
- **Type checking**: `bun type-check`
- **Preview build**: `bun preview`

### Key Dependencies
- **React 19**: Latest React with concurrent features
- **TypeScript**: Strict mode with comprehensive type system
- **Vite**: Fast build tool and dev server
- **TailwindCSS**: Utility-first CSS with custom Zeta theme
- **Wagmi v2**: Ethereum interactions with React hooks
- **RainbowKit**: Wallet connection UI
- **Viem**: TypeScript Ethereum library
- **Radix UI**: Accessible component primitives (shadcn/ui)
- **@web3icons/react**: Web3 icons for tokens and networks
- **Solana Wallet Adapter**: Solana wallet integration

### Development Workflow
**Daily Process**:
1. Start: `bun dev`
2. Check existing components before creating new ones
3. Use standardized patterns from this guide
4. Follow branded type system (no type assertions)
5. Wrap transactions with error boundaries
6. Test on multiple networks and scenarios
7. Run: `bun lint` before commits
8. Type check: `bun type-check`
9. Update documentation if adding new patterns

---

## Final Notes

**This documentation prevents code recreation**. Before building:
1. Search this guide for existing patterns
2. Check component/hook reference for reusable pieces  
3. Use decision trees to choose the right approach
4. Follow integration patterns for consistency
5. Reference existing codebase using provided file paths

**Goal**: Zero code recreation, maximum pattern reuse.

**Key Files for Reference**:
- Components: `/components/ui/base-transaction-dialog.tsx`, `/components/ui/token-network-icon.tsx`
- Hooks: `/hooks/useStandardizedTransactionDialog.ts`, `/hooks/useDashboardData.ts`
- Utils: `/utils/inputValidation.ts`, `/utils/healthFactorUtils.ts`, `/utils/chainUtils.ts`
- Types: `/types/address.ts`, `/types/transactions.ts`

*Always refer to this document before starting new features.*