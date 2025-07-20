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
// Supply collateral via gateway or directly
function supply(address asset, uint256 amount) external;

// Borrow assets with collateral check
function borrow(address asset, uint256 amount) external;

// Repay borrowed assets
function repay(address asset, uint256 amount) external;

// Liquidate undercollateralized positions
function liquidate(address user, address collateralAsset, address debtAsset, uint256 repayAmount) external;

// Withdraw supplied assets locally
function withdraw(address asset, uint256 amount) external;

// Withdraw supplied assets to external chain
function withdrawToChain(address asset, uint256 amount, address recipient, bytes calldata recipientData) external;

// Universal contract function for cross-chain deposits/repayments
function onCall(MessageContext calldata context, address zrc20, uint256 amount, bytes calldata message) external;
```

### ZRC-20 Token Integration
```typescript
// ZRC-20 token interface for cross-chain assets
type ZRC20Asset = {
  address: string;
  symbol: string; // e.g., "ETH.ARBI", "USDC.ARBI", "USDT.BASE"
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

The protocol uses **deposit contracts** on external chains (Arbitrum, Ethereum) to enable cross-chain deposits via ZetaChain's EVM Gateway. Users interact with these deposit contracts to supply collateral that gets forwarded to the lending protocol on ZetaChain.

#### Deposit Contract Architecture
```solidity
// DepositContract.sol - Deployed on external chains (Arbitrum, Ethereum)
contract DepositContract {
    IGatewayEVM public immutable gateway;
    address public immutable lendingProtocolAddress; // Address on ZetaChain
    
    // Deposit ETH from Arbitrum
    function depositEth(address onBehalfOf) external payable {
        bytes memory message = abi.encodeWithSignature(
            "supply(address,uint256,address)",
            address(0), // ETH represented as address(0)
            msg.value,
            onBehalfOf
        );
        
        gateway.depositAndCall{value: msg.value}(
            lendingProtocolAddress,
            message,
            RevertOptions({...})
        );
    }
    
    // Deposit ERC20 tokens (USDC on Arbitrum/Ethereum)
    function depositToken(address asset, uint256 amount, address onBehalfOf) external {
        IERC20(asset).safeTransferFrom(msg.sender, address(this), amount);
        IERC20(asset).forceApprove(address(gateway), amount);
        
        bytes memory message = abi.encodeWithSignature(
            "supply(address,uint256,address)",
            asset,
            amount,
            onBehalfOf
        );
        
        gateway.depositAndCall(
            lendingProtocolAddress,
            amount,
            asset,
            message,
            RevertOptions({...})
        );
    }
}
```

#### Gateway Integration Flow
```typescript
// 1. User deposits on external chain
const depositFlow = async (chain: 'arbitrum' | 'ethereum', asset: string, amount: bigint) => {
  // Get deposit contract for the chain
  const depositContract = getDepositContract(chain);
  
  if (asset === 'ETH') {
    // Deposit ETH on Arbitrum
    await depositContract.depositEth(userAddress, { value: amount });
  } else {
    // Deposit ERC20 (USDC on Arbitrum/Ethereum)
    await erc20Contract.approve(depositContract.address, amount);
    await depositContract.depositToken(asset, amount, userAddress);
  }
};

// 2. Gateway forwards to ZetaChain LendingProtocol
// This happens automatically via ZetaChain's infrastructure

// 3. Cross-chain withdrawal (from ZetaChain to external chain)
const withdrawToChain = async (
  targetChain: number,
  asset: string,
  amount: bigint
) => {
  // Call withdraw on ZetaChain LendingProtocol
  // This will use ZRC-20 gateway to send to external chain
  await lendingContract.withdraw(asset, amount, targetChainAddress);
};
```

#### Supported Assets per Chain
```typescript
// Asset validation in deposit contracts
const SUPPORTED_ASSETS = {
  arbitrum: {
    ETH: { address: "0x0000000000000000000000000000000000000000", decimals: 18, isNative: true },
    USDC: { address: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d", decimals: 6, isNative: false },
  },
  ethereum: {
    ETH: { address: "0x0000000000000000000000000000000000000000", decimals: 18, isNative: true },
    USDC: { address: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", decimals: 6, isNative: false },
  },
};

// Only whitelisted assets can be deposited
function addSupportedAsset(address asset, uint8 decimals, bool isNative) external onlyOwner;
function removeSupportedAsset(address asset) external onlyOwner;
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
│   │   ├── SimpleLendingProtocol.sol   # Universal lending contract (main)
│   │   ├── DepositContract.sol         # Cross-chain deposit contract
│   │   ├── PriceOracle.sol            # Price oracle implementation
│   │   ├── Universal.sol              # Universal contract template
│   │   ├── interfaces/
│   │   │   ├── IPriceOracle.sol        # Oracle interface
│   │   │   └── IZRC20.sol              # ZRC-20 interface
│   │   └── mocks/
│   │       ├── MockPriceOracle.sol     # Price oracle mock
│   │       └── MockZRC20.sol           # ZRC-20 token mock
│   ├── scripts/
│   │   ├── deploy-deposit-contracts.ts # Deploy deposit contracts to external chains
│   │   └── localnet.sh                # Local network setup
│   ├── tasks/
│   │   └── deploy.ts                  # Deployment tasks
│   ├── test/
│   │   └── Universal.t.sol            # Foundry tests
│   ├── hardhat.config.ts              # Hardhat configuration
│   ├── foundry.toml                   # Foundry configuration
│   └── package.json                   # Dependencies
├── deployments.ts                 # ZetaChain deployment configuration (root level)
├── deposit-deployments.ts         # External chain deposit contract deployments  
├── package.json                   # Root package.json
├── frontend/                      # Frontend application (future)
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

#### 1. Pre-deployment
- Test all collateralization scenarios
- Verify oracle price feeds are working
- Test liquidation mechanisms thoroughly
- Validate cross-chain deposit/withdrawal flows
- Security audit for lending-specific risks

#### 2. ZetaChain Deployment (First)
- Deploy SimpleLendingProtocol to ZetaChain testnet first
- Configure supported ZRC-20 assets with prices (ETH.ARBI, USDC.ARBI, ETH.ETH, USDC.ETH)
- Set collateralization ratios (150% minimum, 120% liquidation)
- Test universal contract functionality

#### 3. External Chain Deployments (Second)
- **Deploy DepositContract to Arbitrum Sepolia**: Handle ETH and USDC deposits
- **Deploy DepositContract to Ethereum Sepolia**: Handle ETH and USDC deposits
- Configure gateway addresses for each network
- Add supported assets for each chain
- Test cross-chain deposits from each network

#### 4. Cross-Chain Integration Testing
- Test ETH deposits from Arbitrum → ZetaChain
- Test USDC deposits from Arbitrum → ZetaChain  
- Test ETH deposits from Ethereum → ZetaChain
- Test USDC deposits from Ethereum → ZetaChain
- Verify proper ZRC-20 minting on ZetaChain
- Test cross-chain withdrawals from ZetaChain → external chains

#### 5. Post-deployment
- **Update DEPLOYMENTS config**: Update contract addresses in `deployments.ts` and `deposit-deployments.ts`
- Monitor health factors across all users
- Track liquidation events and bad debt
- Verify cross-chain transaction success rates
- Update frontend with all contract addresses

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
    "USDT.BASE": "0xdef0...1234",     // ← Update with actual ZRC-20 address
    "ZETA": "0x3456...7890",          // ← Update with actual ZETA address
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
  SUPPORTED_CHAINS: [421614, 11155111, 7001], // Arbitrum Sepolia, Ethereum Sepolia, ZetaChain
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