# Approval Transaction Fixes

## Issues Identified and Fixed

### 1. Incorrect Transaction Step Sequence
**Issue**: Setting step to 'approving' instead of 'approve'
**Problem**: The transaction flow hook expects 'approve' first, then automatically transitions to 'approving' when hash is received
**Fix**: 
```typescript
// Before
txActions.setCurrentStep('approving');

// After  
txActions.setCurrentStep('approve');
```

### 2. Wrong Token Address for Approval
**Issue**: Using ZRC-20 address instead of foreign chain ERC-20 address
**Problem**: Approval was being done on the wrong token contract
**Fix**: Added helper function to get correct foreign chain token address
```typescript
const getForeignChainTokenAddress = useCallback(() => {
    if (!selectedAsset) return null;
    
    if (selectedAsset.sourceChain === 'ARBI') {
        if (selectedAsset.unit === 'USDC') {
            return getTokenAddress('USDC', SupportedChain.ARBITRUM_SEPOLIA);
        }
    } else if (selectedAsset.sourceChain === 'ETH') {
        if (selectedAsset.unit === 'USDC') {
            return getTokenAddress('USDC', SupportedChain.ETHEREUM_SEPOLIA);
        }
    }
    return selectedAsset.address; // Fallback
}, [selectedAsset]);
```

### 3. Inconsistent Native Token Detection
**Issue**: Using `isZeroAddress(selectedAsset.address)` instead of checking token unit
**Problem**: ZRC-20 addresses are not zero addresses, so ETH detection failed
**Fix**: Changed to check token unit directly
```typescript
// Before
const isNativeToken = isZeroAddress(selectedAsset.address);

// After
const isNativeToken = selectedAsset.unit === 'ETH';
```

### 4. Missing Token Address Validation
**Issue**: No validation if token address is found
**Problem**: Could proceed with null/undefined addresses
**Fix**: Added validation and error handling
```typescript
const tokenAddress = getForeignChainTokenAddress();
if (!tokenAddress) {
    throw new Error('Unable to determine token address for repayment');
}
```

## Transaction Flow Now Works As Expected

### Approval Flow:
1. User clicks "Repay" for ERC-20 token
2. Network switches to foreign chain if needed
3. Sets step to 'approve'
4. Calls `writeContract` with correct foreign chain token address
5. Transaction flow hook receives hash and sets step to 'approving'
6. Transaction hash is displayed in UI
7. When approval succeeds, proceeds to repay step

### Native ETH Flow:
1. User clicks "Repay" for ETH
2. Network switches to foreign chain if needed
3. Directly calls `repayEth` (no approval needed)
4. Transaction proceeds immediately

## Key Improvements

1. **Correct Token Addresses**: Now uses actual ERC-20 addresses on foreign chains
2. **Proper Step Management**: Follows expected transaction flow sequence
3. **Better Error Handling**: Validates addresses before proceeding
4. **Consistent Logic**: Same native token detection throughout
5. **Code Reuse**: Helper function eliminates duplication

## Testing Scenarios

### USDC Repayment on Arbitrum:
- Token address: Uses Arbitrum Sepolia USDC contract
- Approval: Done on Arbitrum USDC contract
- Repay: Calls DepositContract.repayToken with Arbitrum USDC address

### USDC Repayment on Ethereum:
- Token address: Uses Ethereum Sepolia USDC contract  
- Approval: Done on Ethereum USDC contract
- Repay: Calls DepositContract.repayToken with Ethereum USDC address

### ETH Repayment:
- No approval needed
- Direct call to DepositContract.repayEth
- Uses msg.value for amount

The approval transaction should now properly show the transaction hash and proceed through the complete flow.