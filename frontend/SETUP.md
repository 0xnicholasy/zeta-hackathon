# Frontend Setup Guide

## Environment Configuration

1. **Copy the environment template:**
   ```bash
   cp .env.example .env
   ```

2. **Get a WalletConnect Project ID:**
   - Visit [WalletConnect Cloud](https://cloud.walletconnect.com)
   - Create a new project
   - Copy your Project ID
   - Replace `your_wallet_connect_project_id_here` in `.env` with your actual Project ID

3. **Configure environment variables:**
   ```bash
   # Required
   VITE_WALLET_CONNECT_PROJECT_ID=your_actual_project_id_here
   
   # Optional (already configured)
   VITE_APP_NAME=ZetaChain Cross-Chain Lending
   VITE_APP_DESCRIPTION=Supply collateral and borrow assets across EVM chains
   ```

## Development

1. **Install dependencies:**
   ```bash
   bun install
   ```

2. **Start development server:**
   ```bash
   bun run dev
   ```

3. **Build for production:**
   ```bash
   bun run build
   ```

## Supported Networks

- **ZetaChain Athens Testnet** (Chain ID: 7001)
- **ZetaChain Mainnet** (Chain ID: 7000)  
- **Arbitrum Sepolia** (Chain ID: 421614)
- **Ethereum Sepolia** (Chain ID: 11155111)
- **Arbitrum** (Chain ID: 42161)
- **Ethereum Mainnet** (Chain ID: 1)

## Features

- ✅ Dark/Light theme with system preference detection
- ✅ ZetaChain official color palette
- ✅ RainbowKit wallet connection
- ✅ Multi-chain support
- ✅ TypeScript integration with contract types
- ✅ Responsive design

## Contract Integration

The frontend is standalone and does not directly depend on the lending-zeta workspace. If you need to use contract types, manually copy the required TypeScript definitions from `../lending-zeta/typechain-types/` to your frontend `src/contracts/` directory.

Example workflow:
1. Generate contract types in lending-zeta: `cd ../lending-zeta && bun run compile`
2. Copy needed types: `cp ../lending-zeta/typechain-types/contracts/SimpleLendingProtocol.ts src/contracts/`
3. Use in your code: `import { SimpleLendingProtocol } from './contracts/SimpleLendingProtocol';`