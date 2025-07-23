# Debt Data & Repay Architecture

## Overview

This document explains how the debt data fetching and repay functionality work in the ZetaChain cross-chain lending protocol.

## Architecture Summary

### ✅ Debt Data Fetching (From ZetaChain)

**Location**: ZetaChain (where the lending protocol state is maintained)

**Implementation**:
- `useDashboardData.ts` fetches user debt data from `SimpleLendingProtocol` on ZetaChain
- Uses `getBorrowBalance` function to get user's borrowed amounts for each asset
- Data is fetched from ZetaChain because that's where the lending protocol state is stored

**Code Flow**:
```typescript
// In useDashboardData.ts
const { data: userBorrows } = useReadContracts({
    contracts: assetAddresses.map(asset => ({
        address: simpleLendingProtocol, // ZetaChain contract
        abi: SimpleLendingProtocol__factory.abi,
        functionName: 'getBorrowBalance',
        args: [address, asset],
    })),
});
```

### ✅ Repay Functionality (From Foreign Chain)

**Location**: Foreign chains (Arbitrum, Ethereum) where users have tokens

**Implementation**:
- `RepayDialog.tsx` calls `repayToken`/`repayEth` on the `DepositContract` on the foreign chain
- The `DepositContract` forwards the repayment to ZetaChain via Gateway
- Users repay using tokens from their wallet on the foreign chain

**Code Flow**:
```typescript
// In RepayDialog.tsx
txActions.writeContract({
    address: depositContract, // Foreign chain contract
    abi: depositContractAbi,
    functionName: 'repayToken', // or 'repayEth'
    args: [selectedAsset.address, amountBigInt, address],
});
```

**Cross-Chain Message**:
```solidity
// In DepositContract.sol
bytes memory message = abi.encode("repay", onBehalfOf);
gateway.depositAndCall(lendingProtocolAddress, amount, asset, message, ...);
```

## Key Improvements Made

### 1. Fixed Repay Validation Balance Check

**Problem**: The `useRepayValidation` hook was checking user's token balance on ZetaChain, but users need tokens on the foreign chain to repay.

**Solution**: Updated the hook to check user's balance on the correct foreign chain:

```typescript
// Before: Checked balance on ZetaChain
const { data: tokenBalance } = useBalance({
    address: userAddress,
    token: selectedAsset?.address, // ZRC-20 address
});

// After: Check balance on foreign chain
const { data: tokenBalance } = useBalance({
    address: address, // User's wallet address
    token: isNativeToken ? undefined : foreignTokenAddress, // Foreign chain token
    chainId: selectedAsset?.externalChainId, // Foreign chain ID
});
```

### 2. Added Health Factor Display to Repay Dialog

**Enhancement**: Added health factor visualization similar to `BorrowDialog` to show users how their health factor will improve after repaying debt.

**Features**:
- Shows current health factor
- Shows projected health factor after repayment
- Color-coded indicators (red < 1.2, yellow < 1.5, green ≥ 1.5)
- Shows improvement amount when health factor increases

```typescript
{/* Health Factor Display */}
{validation.currentHealthFactor > 0 && (
    <div className="p-3 bg-muted rounded-lg text-sm">
        <div className="flex justify-between">
            <span>Current:</span>
            <span className={getHealthFactorColor(validation.currentHealthFactor)}>
                {formatHealthFactor(validation.currentHealthFactor)}
            </span>
        </div>
        {amount && (
            <div className="flex justify-between">
                <span>After repay:</span>
                <span className={getHealthFactorColor(validation.newHealthFactor)}>
                    {formatHealthFactor(validation.newHealthFactor)}
                </span>
            </div>
        )}
    </div>
)}
```

### 3. Enhanced Validation Logic

**Improvements**:
- Proper foreign chain token address mapping
- Correct balance checking on the appropriate chain
- Better health factor calculations
- Support for both native ETH and ERC20 tokens

## Contract Flow

### Repay Transaction Flow

1. **User initiates repay** on foreign chain (Arbitrum/Ethereum)
2. **DepositContract** receives tokens and forwards to ZetaChain
3. **Gateway** processes cross-chain message
4. **SimpleLendingProtocol** on ZetaChain receives repayment
5. **User's debt is reduced** in the lending protocol state

### Message Format

```solidity
// Repay message sent to ZetaChain
bytes memory message = abi.encode("repay", onBehalfOf);
```

The lending protocol's `onCall` function handles this message:

```solidity
function onCall(MessageContext calldata context, address zrc20, uint256 amount, bytes calldata message) {
    if (keccak256(abi.encodePacked(action)) == keccak256(abi.encodePacked("repay"))) {
        _handleCrossChainRepay(onBehalfOf, zrc20, amount, context);
    }
}
```

## Supported Assets

### ZetaChain (Debt Storage)
- `ETH.ARBI` - Arbitrum ETH as ZRC-20
- `USDC.ARBI` - Arbitrum USDC as ZRC-20  
- `ETH.ETH` - Ethereum ETH as ZRC-20
- `USDC.ETH` - Ethereum USDC as ZRC-20

### Foreign Chains (Repayment Source)
- **Arbitrum Sepolia**: Native ETH, USDC token
- **Ethereum Sepolia**: Native ETH, USDC token

## Security Considerations

1. **Cross-chain validation**: Debt amounts are validated on ZetaChain
2. **Balance verification**: Token balances are checked on the correct foreign chain
3. **Gateway security**: All cross-chain messages go through ZetaChain Gateway
4. **Revert handling**: Failed transactions can be reverted with proper error handling

## Future Enhancements

1. **Multi-chain repayment**: Allow repaying debt from any supported chain
2. **Partial liquidation protection**: Warn users if repayment might trigger liquidation
3. **Gas optimization**: Batch multiple repayments in a single transaction
4. **Advanced health factor**: More sophisticated health factor calculations with multiple collateral types