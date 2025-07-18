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
├── contracts/
│   ├── LendingProtocol.sol         # Main lending contract
│   ├── interfaces/
│   │   ├── ILendingProtocol.sol    # Lending interface
│   │   ├── IPriceOracle.sol        # Oracle interface
│   │   └── IZRC20.sol              # ZRC-20 interface
│   ├── libraries/
│   │   ├── InterestRateModel.sol   # Interest calculation
│   │   └── LiquidationLogic.sol    # Liquidation logic
│   └── mocks/
│       ├── MockPriceOracle.sol     # Price oracle mock
│       └── MockZRC20.sol           # ZRC-20 token mock
├── scripts/
│   ├── deploy.ts                   # Deployment script
│   └── setup-assets.ts             # Asset configuration
├── test/
│   ├── LendingProtocol.test.ts     # Core tests
│   ├── Liquidation.test.ts         # Liquidation tests
│   └── CrossChain.test.ts          # Gateway integration tests
├── frontend/
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
    ├── protocol-overview.md        # Protocol documentation
    ├── liquidation-guide.md        # Liquidation guide
    └── cross-chain-guide.md        # Cross-chain usage
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
   - **Update DEPLOYMENTS config**: Update contract addresses in `deployments.ts` for the deployed network
   - Monitor health factors across all users
   - Track liquidation events and bad debt
   - Verify cross-chain transaction success rates
   - Update frontend with contract addresses

### Deployment Configuration Management

#### CRITICAL: Update deployments.ts After Each Deployment

After deploying to any network other than `localnet`, you **MUST** update the `deployments.ts` file with the actual deployed contract addresses:

```typescript
// Example: After deploying to ZetaChain Athens testnet
"zeta-testnet": {
  chainId: 7001,
  name: "ZetaChain Athens Testnet",
  // ... other config
  contracts: {
    LendingProtocol: "0x1234...5678", // ← Update with actual deployed address
    PriceOracle: "0xabcd...ef00",     // ← Update with actual deployed address
  },
  tokens: {
    "ETH.ARBI": "0x9876...5432",      // ← Update with actual ZRC-20 address
    "USDC.ARBI": "0x5678...9abc",     // ← Update with actual ZRC-20 address
    "ETH.ETH": "0xdef0...1234",       // ← Update with actual ZRC-20 address
    "USDC.ETH": "0x3456...7890",      // ← Update with actual ZRC-20 address
    "ZETA": "0xabcd...ef00",          // ← Update with actual ZETA address
  }
}
```

#### Deployment Address Update Process

1. **Deploy contracts** to target network (testnet/mainnet)
2. **Copy deployed addresses** from deployment logs/explorer
3. **Update deployments.ts** with actual addresses (replace `0x0000...0000`)
4. **Validate deployment** using helper functions:
   ```typescript
   import { validateDeployment } from './deployments';
   
   const validation = validateDeployment('zeta-testnet');
   if (!validation.isValid) {
     console.error('Missing contracts:', validation.missingContracts);
     console.error('Missing tokens:', validation.missingTokens);
   }
   ```
5. **Commit updated deployments.ts** to version control
6. **Test frontend integration** with new addresses

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
// Get contract address safely
try {
  const lendingAddress = getContractAddress('zeta-testnet', 'LendingProtocol');
  console.log('Lending Protocol deployed at:', lendingAddress);
} catch (error) {
  console.error('Contract not deployed:', error.message);
}

// Validate all addresses before frontend deployment
const network = 'zeta-testnet';
const validation = validateDeployment(network);

if (validation.isValid) {
  console.log('✅ All contracts and tokens configured');
} else {
  console.error('❌ Missing deployments:', validation);
  // Do not proceed with frontend deployment
}
```

**Remember**: The `deployments.ts` file is the **single source of truth** for contract addresses across all networks. Keep it updated and validated after every deployment.

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