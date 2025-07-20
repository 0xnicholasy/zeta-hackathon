# ZetaChain Cross-Chain Lending Protocol Scripts

This directory contains deployment scripts for the ZetaChain cross-chain lending protocol, organized by component type for cross-chain testing focus.

## Directory Structure

```
scripts/
├── depositcontract/          # Deposit contract deployment and testing
│   ├── deploy-deposit-contracts.ts
│   └── simulate-deposit.ts
├── simple/                   # Simple lending protocol deployment
│   ├── deploy-and-init-simple.ts
│   └── verify-assets.ts
├── universal/                # Universal lending protocol deployment
│   └── deploy-universal-lending.ts
├── utils/                   # Shared utilities
│   └── deployment-utils.ts
└── package-scripts.json     # NPM script shortcuts
```

## Usage Examples

### Deploy Simple Lending Protocol (ZetaChain)
```bash
npm run deploy:simple --network zeta-testnet
# or
npx hardhat run scripts/simple/deploy-and-init-simple.ts --network zeta-testnet
```

### Deploy Universal Lending Protocol (ZetaChain) 
```bash
npm run deploy:universal --network zeta-testnet
# or
npx hardhat run scripts/universal/deploy-universal-lending.ts --network zeta-testnet
```

### Deploy Deposit Contracts (External Chains)
```bash
npm run deploy:deposits --network arbitrum-sepolia
npm run deploy:deposits --network ethereum-sepolia
# or
npx hardhat run scripts/depositcontract/deploy-deposit-contracts.ts --network arbitrum-sepolia
```

### Test Cross-Chain Deposits
```bash
npm run simulate:deposit --network arbitrum-sepolia
# or  
npx hardhat run scripts/depositcontract/simulate-deposit.ts --network arbitrum-sepolia
```

### Verify Assets
```bash
npm run verify:assets --network zeta-testnet
# or
npx hardhat run scripts/simple/verify-assets.ts --network zeta-testnet
```

## Available NPM Scripts

See `package-scripts.json` for all available shortcuts:
- `npm run deploy:simple` - Deploy SimpleLendingProtocol
- `npm run deploy:universal` - Deploy UniversalLendingProtocol  
- `npm run deploy:deposits` - Deploy DepositContracts
- `npm run simulate:deposit` - Simulate cross-chain deposit
- `npm run verify:assets` - Verify supported assets
- `npm run utils:*` - Various utility commands

## Deployment Order

1. **Deploy SimpleLendingProtocol on ZetaChain** first
2. **Deploy DepositContracts on external chains** (Arbitrum, Ethereum)
3. **Test cross-chain deposits** using simulation scripts

## Important Notes

- All contracts must be deployed in the correct order
- **contracts.json is automatically updated** with deployed addresses after each deployment
- **No local development scripts** - focused on cross-chain testnet/mainnet deployment only
- Test on testnets before mainnet deployment
- Cross-chain features require proper gateway configuration
- **Deployment files consolidated**: Only `contracts.json` is used for deployment tracking

## Cross-Chain Testing Focus

This script organization prioritizes cross-chain functionality testing:
- DepositContract deployment on external chains (Arbitrum, Ethereum)
- Cross-chain deposit simulation and testing  
- ZetaChain lending protocol deployment and verification
- Integration testing across multiple networks

## Script Details

### DepositContract Scripts
- **deploy-deposit-contracts.ts**: Deploys DepositContract on external chains with gateway integration
- **simulate-deposit.ts**: Simulates cross-chain ETH/USDC deposits from external chains to ZetaChain

### Simple Lending Protocol Scripts  
- **deploy-and-init-simple.ts**: Deploys and initializes SimpleLendingProtocol with ZRC-20 asset support
- **verify-assets.ts**: Verifies supported assets configuration in SimpleLendingProtocol

### Universal Lending Protocol Scripts
- **deploy-universal-lending.ts**: Deploys UniversalLendingProtocol with advanced lending features

### Utility Scripts
- **deployment-utils.ts**: Shared deployment utilities for contract management and verification

## Network Support

**ZetaChain Networks (Lending Protocol)**:
- ZetaChain Athens Testnet (7001)
- ZetaChain Mainnet (7000)

**External Networks (Deposit Contracts)**:
- Arbitrum Sepolia (421614)
- Ethereum Sepolia (11155111)

## Cross-Chain Asset Flow

1. **User deposits** ETH/USDC on Arbitrum/Ethereum via DepositContract
2. **DepositContract** calls ZetaChain Gateway with deposit data  
3. **Gateway** converts assets to ZRC-20 tokens on ZetaChain
4. **ZRC-20 tokens** supplied as collateral to SimpleLendingProtocol
5. **User** can borrow against collateral and withdraw to any supported chain