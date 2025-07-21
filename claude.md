# Claude Context: ZetaChain Cross-Chain Lending Protocol

## Project Overview
This is a **cross-chain lending protocol** built on ZetaChain that enables users to supply collateral and borrow assets across EVM chains including Arbitrum, Ethereum, and ZetaChain. The protocol uses ETH and USDC, following an Aave-inspired model where users must supply collateral before borrowing, with liquidation mechanisms for undercollateralized positions.

**Official Documentation**: https://www.zetachain.com/docs/

## Project Specifics

### Protocol Design
- **Single Contract Architecture**: All lending and borrowing logic resides in one smart contract on ZetaChain
- **Cross-Chain Flexibility**: Lenders can withdraw assets to any supported EVM chain, not limited to the deposit chain
- **ZRC-20 Integration**: Uses ZetaChain's ZRC-20 tokens for cross-chain asset representation
- **Aave-Inspired**: Overcollateralized lending with liquidation mechanisms

### Supported Chains and Assets

| **Chain** | **Chain ID** | **Assets** |
|-----------|--------------|------------|
| Arbitrum Sepolia | 421614 | ETH (ZRC-20 ETH.ARBI), USDC (ZRC-20 USDC.ARBI) |
| Ethereum Sepolia | 11155111 | ETH (ZRC-20 ETH.ETH), USDC (ZRC-20 USDC.ETH) |
| ZetaChain Athens | 7001 | Native ZETA |

### Key Protocol Features
1. **Supply Collateral**: Deposit assets from any supported chain via ZetaChain's EVM gateway
2. **Borrow Assets**: Borrow ZRC-20 tokens with proper collateralization ratios (1.5x minimum)
3. **Cross-Chain Withdrawals**: Withdraw to any supported EVM chain via gateway
4. **Liquidation**: Liquidate undercollateralized positions (below 1.2x ratio)
5. **Interest Distribution**: Variable interest rates distributed to suppliers

## Tech Stack

### Smart Contracts
- **Framework**: Hardhat
- **Language**: TypeScript
- **Chain**: ZetaChain Universal EVM
- **Package Manager**: Bun
- **Key Dependencies**: 
  - `@zetachain/protocol-contracts` for ZRC-20 and gateway interactions
  - `@openzeppelin/contracts` for security (ReentrancyGuard, SafeMath)
  - Oracle integration (Pyth Network recommended)

### Frontend
- **Framework**: React 18+
- **Styling**: TailwindCSS
- **Language**: TypeScript
- **Package Manager**: Bun
- **Key Features**: 
  - Multi-chain wallet connections (with rainbow kit)
  - Real-time collateralization ratio display
  - Cross-chain transaction tracking

### Development Environment
- **Node Package Manager**: Bun
- **Testing**: Hardhat + Jest/Vitest for frontend
- **Networks**: ZetaChain Athens testnet, Arbitrum Sepolia, Ethereum Sepolia
- **Linting**: ESLint + Prettier
- **Type Checking**: TypeScript strict mode

## Development Memories
- Everytime you redeployed the contract with @lending-zeta/scripts/simple/deploy-and-init-simple.ts, you should also run "hh run scripts/depositcontract/deploy-deposit-contracts.ts --network arbitrum-sepolia" to redeploy the DepositContract from external chain. Then run "hh run scripts/depositcontract/simulate-deposit.ts --network arbitrum-sepolia" to deposit tokens from external chains to zeta.

[... rest of the existing content remains unchanged ...]

## ZetaChain Lending Protocol Specifics

### Core Contract Functions
```solidity
// Supply collateral via gateway
function supply(address asset, uint256 amount, address onBehalfOf) external;

// Borrow assets with collateral check
function borrow(address asset, uint256 amount, address to) external;

// Repay borrowed assets with interest
function repay(address asset, uint256 amount, address onBehalfOf) external;

// Liquidate undercollateralized positions
function liquidate(address collateralAsset, address debtAsset, address user, uint256 debtToCover) external;

// Withdraw supplied assets
function withdraw(address asset, uint256 amount, address to) external;
```

### ZRC-20 Token Integration
```typescript
// ZRC-20 token interface for cross-chain assets
type ZRC20Asset = {
  address: string;
  symbol: string; // e.g., "ETH.ARBI", "USDC.ARBI", "ETH.ETH", "USDC.ETH"
  chainId: number;
  decimals: number;
  isSupported: boolean;
};

// Collateralization tracking
type UserPosition = {
  supplies: Record<string, bigint>; // asset address -> amount
  borrows: Record<string, bigint>;  // asset address -> amount
  healthFactor: number; // collateral value / borrowed value
};
```

### Cross-Chain Gateway Integration
```typescript
// Gateway deposit handler
const handleCrossChainDeposit = async (
  sourceChain: number,
  asset: string,
  amount: bigint,
  recipient: string
) => {
  // Called by gateway when user deposits from external chain
  await lendingContract.supply(asset, amount, recipient);
};

// Gateway withdrawal
const withdrawToChain = async (
  targetChain: number,
  asset: string,
  amount: bigint
) => {
  // Withdraw ZRC-20 to external chain via gateway
  await gatewayContract.withdraw(targetChain, asset, amount);
};
```

## Development Guidelines

### Smart Contract Security (Critical for Lending)

#### Lending-Specific Security
1. **Collateralization Checks**: Always verify health factor before borrowing
2. **Oracle Price Validation**: Implement circuit breakers for price feed anomalies
3. **Liquidation Protection**: Ensure liquidation incentives prevent bad debt
4. **Interest Rate Bounds**: Set maximum interest rates to prevent exploitation
5. **Asset Validation**: Whitelist supported ZRC-20 tokens only
6. **Cross-Chain Revert Handling**: Implement proper revert mechanisms for failed gateway calls

#### Security Implementation
```solidity
// Example collateralization check
modifier healthFactorCheck(address user) {
    _;
    require(calculateHealthFactor(user) >= MINIMUM_HEALTH_FACTOR, "Insufficient collateral");
}

// Oracle price validation
function getAssetPrice(address asset) internal view returns (uint256) {
    uint256 price = priceOracle.getPrice(asset);
    require(price > 0, "Invalid price");
    require(block.timestamp - priceOracle.getLastUpdate(asset) < MAX_PRICE_AGE, "Stale price");
    return price;
}
```

### Frontend Best Practices

#### Lending Protocol UI Patterns
```typescript
// Health factor monitoring
const useHealthFactor = (userAddress: string) => {
  const [healthFactor, setHealthFactor] = useState<number>(0);
  const [isAtRisk, setIsAtRisk] = useState(false);
  
  useEffect(() => {
    const updateHealthFactor = async () => {
      const factor = await lendingContract.getHealthFactor(userAddress);
      setHealthFactor(factor);
      setIsAtRisk(factor < 1.5); // Warning threshold
    };
    
    const interval = setInterval(updateHealthFactor, 10000); // Update every 10s
    return () => clearInterval(interval);
  }, [userAddress]);
  
  return { healthFactor, isAtRisk };
};

// Cross-chain transaction tracking
const useCrossChainTransaction = () => {
  const [txStatus, setTxStatus] = useState<'pending' | 'confirmed' | 'failed'>();
  
  const executeCrossChainTx = async (chainId: number, txData: any) => {
    try {
      setTxStatus('pending');
      const tx = await gatewayContract.depositAndCall(chainId, txData);
      await tx.wait();
      setTxStatus('confirmed');
    } catch (error) {
      setTxStatus('failed');
      throw error;
    }
  };
  
  return { txStatus, executeCrossChainTx };
};
```

### Git Commit Guidelines for Lending Protocol

#### Lending-Specific Commit Types
- `lending`: Core lending functionality changes
- `liquidation`: Liquidation mechanism updates
- `oracle`: Price oracle integration
- `gateway`: Cross-chain gateway interactions
- `zrc20`: ZRC-20 token handling

#### Examples
```
lending(contract): implement health factor calculation

Add health factor calculation for user positions including:
- Collateral value calculation using oracle prices
- Borrow value calculation with interest accrual
- Liquidation threshold checks

Implements requirements from README.md section 2.2

feat(gateway): add cross-chain withdrawal to Base

Enable users to withdraw USDC collateral to Base chain
via ZetaChain gateway integration.

- Add Base chain support (chain ID 8453)
- Implement USDT.BASE withdrawal flow
- Add proper error handling for failed withdrawals

Closes #45
```

### Testing Strategy for Lending Protocol

#### Smart Contract Testing Focus
```typescript
describe("CrossChainLendingProtocol", () => {
  describe("Supply and Borrow", () => {
    it("should allow supplying USDC.ARBI as collateral", async () => {
      const supplyAmount = ethers.parseUnits("1000", 6); // 1000 USDC
      await usdcArbiToken.approve(lendingContract.address, supplyAmount);
      await lendingContract.supply(usdcArbiToken.address, supplyAmount, user.address);
      
      const userSupply = await lendingContract.getSupplyBalance(user.address, usdcArbiToken.address);
      expect(userSupply).to.equal(supplyAmount);
    });
    
    it("should prevent borrowing with insufficient collateral", async () => {
      const borrowAmount = ethers.parseUnits("1", 18); // 1 ETH
      await expect(
        lendingContract.borrow(ethArbiToken.address, borrowAmount, user.address)
      ).to.be.revertedWith("Insufficient collateral");
    });
  });
  
  describe("Liquidation", () => {
    it("should liquidate undercollateralized position", async () => {
      // Setup: User with low health factor
      // Test: Liquidator can liquidate position
      // Verify: Liquidator receives collateral at discount
    });
  });
  
  describe("Cross-Chain Integration", () => {
    it("should handle gateway deposits correctly", async () => {
      // Mock gateway call
      // Verify supply balance updated
    });
  });
});
```

### Project Structure for Lending Protocol
```
/
├── lending-zeta/                   # ZetaChain contract development
│   ├── contracts/
│   │   ├── SimpleLendingProtocol.sol   # Simple lending contract
│   │   ├── UniversalLendingProtocol.sol # Universal lending contract  
│   │   ├── DepositContract.sol         # Cross-chain deposit contract
│   │   ├── interfaces/
│   │   │   ├── IPriceOracle.sol        # Oracle interface
│   │   │   └── IZRC20.sol              # ZRC-20 interface
│   │   └── mocks/
│   │       ├── MockPriceOracle.sol     # Price oracle mock
│   │       └── MockZRC20.sol           # ZRC-20 token mock
│   ├── scripts/
│   │   ├── depositcontract/            # Deposit contract scripts
│   │   │   ├── deploy-deposit-contracts.ts
│   │   │   └── simulate-deposit.ts
│   │   ├── simple/                     # Simple protocol scripts
│   │   │   ├── deploy-and-init-simple.ts
│   │   │   └── verify-assets.ts
│   │   ├── universal/                  # Universal protocol scripts
│   │   │   └── deploy-universal-lending.ts
│   │   └── utils/                      # Shared utilities
│   │       └── deployment-utils.ts
│   ├── test/
│   │   └── Universal.t.sol             # Foundry tests
│   ├── contracts.json                  # Deployment configuration
│   ├── hardhat.config.ts               # Hardhat configuration
│   └── package.json                    # Dependencies
├── frontend/ (future)                  # Frontend application
│   ├── components/
│   │   ├── SupplyModal.tsx         # Supply interface
│   │   ├── BorrowModal.tsx         # Borrow interface
│   │   ├── HealthFactorDisplay.tsx # Health monitoring
│   │   └── LiquidationInterface.tsx # Liquidation UI
│   ├── hooks/
│   │   ├── useLendingProtocol.ts   # Protocol interactions
│   │   ├── useHealthFactor.ts      # Health monitoring
│   │   └── useCrossChain.ts        # Gateway interactions
│   └── utils/
│       ├── calculations.ts         # Health factor calculations
│       ├── zrc20-utils.ts          # ZRC-20 helpers
│       └── gateway-utils.ts        # Gateway helpers
└── docs/
    ├── DEPLOYMENT-GUIDE.md         # Deployment guide
    ├── CROSS-CHAIN-LENDING.md      # Cross-chain protocol docs
    └── README-LENDING.md           # Simple protocol docs
```

### Deployment Checklist for Lending Protocol

1. **Pre-deployment**:
   - Test all collateralization scenarios
   - Verify oracle price feeds are working
   - Test liquidation mechanisms thoroughly
   - Validate cross-chain deposit/withdrawal flows
   - Security audit for lending-specific risks

2. **Deployment**:
   - Deploy to ZetaChain testnet first
   - Configure supported ZRC-20 assets (ETH.ARBI, USDC.ARBI, ETH.ETH, USDC.ETH)
   - Set collateralization ratios (1.5x minimum, 1.2x liquidation)
   - Initialize interest rate models
   - Test with Arbitrum Sepolia and Ethereum Sepolia testnet

3. **Post-deployment**:
   - **Update contracts.json**: Automatically updated with deployed contract addresses
   - Monitor health factors across all users
   - Track liquidation events and bad debt
   - Verify cross-chain transaction success rates
   - Update frontend with contract addresses from contracts.json

### Deployment Configuration Management

#### Deployment Configuration Management

The project now uses `contracts.json` which is automatically updated during deployment. The structure looks like this:

```json
// lending-zeta/contracts.json
{
  "networks": {
    "7001": {
      "name": "ZetaChain Athens Testnet",
      "chainId": 7001,
      "contracts": {
        "SimpleLendingProtocol": "0x1234...5678",
        "UniversalLendingProtocol": "0xabcd...ef00"
      },
      "tokens": {
        "ETH.ARBI": "0x9876...5432",
        "USDC.ARBI": "0x5678...9abc", 
        "ETH.ETH": "0xdef0...1234",
        "USDC.ETH": "0x3456...7890"
      }
    }
  }
}
```

#### Deployment Address Update Process

1. **Deploy contracts** using deployment scripts (automatically updates `contracts.json`)
2. **Verify deployment** using utility scripts:
   ```bash
   cd lending-zeta
   npx hardhat run scripts/utils/deployment-utils.ts verify --network zeta-testnet
   ```
3. **Check deployment summary**:
   ```bash
   npx hardhat run scripts/utils/deployment-utils.ts summary --network zeta-testnet
   ```
4. **Commit updated contracts.json** to version control
5. **Test frontend integration** with new addresses

#### ZRC-20 Token Addresses

For ZetaChain networks, obtain ZRC-20 token addresses from:
- **ZetaChain Documentation**: https://www.zetachain.com/docs/
- **ZetaChain Explorer**: Check deployed ZRC-20 contracts
- **ZetaChain Protocol Contracts**: Official token registry

#### Network-Specific Considerations

**ZetaChain Athens Testnet (7001)**:
- Use testnet ZRC-20 tokens for testing
- Monitor gas costs and transaction success
- Validate cross-chain deposit/withdrawal flows

**ZetaChain Mainnet (7000)**:
- Use production ZRC-20 token addresses
- Double-check all addresses before mainnet deployment
- Implement additional monitoring and alerting

#### Helper Functions Usage

```typescript
// Read contracts.json to get deployed addresses
import contractsConfig from './lending-zeta/contracts.json';

// Get network configuration
const zetaNetwork = contractsConfig.networks['7001'];

// Get contract addresses safely
const simpleLendingAddress = zetaNetwork.contracts.SimpleLendingProtocol;
const universalLendingAddress = zetaNetwork.contracts.UniversalLendingProtocol;

// Get token addresses
const ethArbiAddress = zetaNetwork.tokens['ETH.ARBI'];
const usdcArbiAddress = zetaNetwork.tokens['USDC.ARBI'];
```

**Remember**: The `contracts.json` file is the **single source of truth** for contract addresses across all networks. It's automatically updated during deployment.

### Key Protocol Constants
```typescript
// Lending protocol configuration
export const LENDING_CONFIG = {
  MINIMUM_HEALTH_FACTOR: 1.5,      // 150% collateralization
  LIQUIDATION_THRESHOLD: 1.2,      // 120% liquidation trigger
  LIQUIDATION_BONUS: 0.05,         // 5% liquidator bonus
  MAX_BORROW_RATE: 0.5,            // 50% max interest rate
  SUPPORTED_CHAINS: [421614, 11155111, 7001], // Arbitrum Sepolia, Ethereum Sepolia, ZetaChain Athens
} as const;

// ZRC-20 asset configuration
export const SUPPORTED_ASSETS = {
  "ETH.ARBI": {
    address: "0x...", // ZRC-20 ETH.ARBI address
    chainId: 421614,
    decimals: 18,
    collateralFactor: 0.8, // 80% collateral factor
  },
  "USDC.ARBI": {
    address: "0x...", // ZRC-20 USDC.ARBI address  
    chainId: 421614,
    decimals: 6,
    collateralFactor: 0.9, // 90% collateral factor
  },
  "ETH.ETH": {
    address: "0x...", // ZRC-20 ETH.ETH address
    chainId: 11155111,
    decimals: 18,
    collateralFactor: 0.8, // 80% collateral factor
  },
  "USDC.ETH": {
    address: "0x...", // ZRC-20 USDC.ETH address
    chainId: 11155111,
    decimals: 6,
    collateralFactor: 0.9, // 90% collateral factor
  },
} as const;
```

### Resources Specific to Lending Protocol
- [ZetaChain EVM Gateway Documentation](https://www.zetachain.com/docs/) - For cross-chain deposits
- [ZRC-20 Token Standard](https://www.zetachain.com/docs/) - Understanding ZRC-20 tokens
- [Pyth Network Oracle](https://www.zetachain.com/docs/about/services/pyth/) - Price feed integration
- [Aave Protocol Documentation](https://docs.aave.com/) - Reference for lending mechanics
- [ZetaChain Universal EVM](https://www.zetachain.com/docs/) - Universal blockchain capabilities

## Critical Implementation Notes

1. **Health Factor Calculation**: Core to the lending protocol - must be precise and gas-efficient
2. **Oracle Integration**: Essential for accurate collateral valuation and liquidation triggers  
3. **Cross-Chain State Management**: Handle pending transactions and failed gateway calls gracefully
4. **Liquidation Incentives**: Ensure liquidation is profitable to maintain protocol solvency
5. **Interest Rate Models**: Implement supply/demand based rates similar to Aave
6. **ZRC-20 Asset Management**: Each asset-chain combination is a separate market

Remember: This is a **lending protocol**, not a generic DApp. Every design decision should prioritize security, accurate collateralization, and seamless cross-chain lending experience. 