# SimpleLendingProtocol Cross-Chain Withdrawal Bug Fix

## 🐛 Bug Description

**Error Code**: `0x10bad147`
**Affected Function**: `withdrawCrossChain` in `SimpleLendingProtocol.sol`
**Issue**: Cross-chain withdrawals failed when the withdrawal asset was different from the gas token

### Root Cause
In the `withdrawCrossChain` function, when the withdrawal asset is different from the gas token:
1. ✅ The contract correctly transfers gas tokens from user to itself
2. ✅ The contract approves gas tokens to the gateway 
3. ❌ **The contract NEVER approved the withdrawal asset to the gateway**
4. ❌ When gateway calls `transferFrom` on the withdrawal asset, it fails with `0x10bad147`

### Affected Scenarios
- ✅ **Working**: SOL.SOL withdrawal (same token for asset and gas)
- ❌ **Broken**: USDC.SOL withdrawal (different tokens - USDC asset, SOL gas)
- ❌ **Broken**: Any cross-chain withdrawal where asset != gas token

## 🔧 Fix Applied

### Code Change
**File**: `contracts/SimpleLendingProtocol.sol`
**Location**: Line 191 (after the `safeIncreaseAllowance` call)

```solidity
// OLD CODE (lines 179-191)
} else {
    if (IERC20(asset).balanceOf(address(this)) < amount)
        revert InsufficientLiquidity();
    uint256 userGasBalance = IERC20(gasZRC20).balanceOf(msg.sender);
    if (
        !IERC20(gasZRC20).transferFrom(
            msg.sender,
            address(this),
            gasFee
        )
    ) revert InsufficientGasFee(gasZRC20, gasFee, userGasBalance);
    IERC20(gasZRC20).safeIncreaseAllowance(address(gateway), gasFee);
}

// FIXED CODE (lines 179-192)  
} else {
    if (IERC20(asset).balanceOf(address(this)) < amount)
        revert InsufficientLiquidity();
    uint256 userGasBalance = IERC20(gasZRC20).balanceOf(msg.sender);
    if (
        !IERC20(gasZRC20).transferFrom(
            msg.sender,
            address(this),
            gasFee
        )
    ) revert InsufficientGasFee(gasZRC20, gasFee, userGasBalance);
    IERC20(gasZRC20).safeIncreaseAllowance(address(gateway), gasFee);
    IERC20(asset).approve(address(gateway), amount);  // ← FIX: Added this line
}
```

### Why This Fixes It
1. **Gas Token Approval**: Already worked - contract approves gas tokens to gateway
2. **Asset Approval**: **NEW** - contract now also approves withdrawal assets to gateway
3. **Gateway Transfer**: Now succeeds because gateway has approval for both gas and asset tokens

## 🧪 Testing & Verification

### Test Scripts Created/Updated

1. **`scripts/universal/verify-contract-fix.ts`**
   - Pre-deployment verification script
   - Checks current state and requirements
   - Explains what will work after fix

2. **`scripts/universal/test-fixed-withdrawals.ts`**
   - Comprehensive test of different withdrawal scenarios
   - Tests both same-token and different-token cases
   - Uses static calls to verify fix prevents `0x10bad147`

3. **`scripts/universal/withdraw-all-sol-crosschain.ts`** (UPDATED)
   - Fixed logic and error handling
   - Better transaction confirmation with RPC issues
   - Clearer messaging about gas requirements

4. **`scripts/universal/debug-usdc-withdrawal-revert.ts`**
   - Diagnostic script that helped identify the root cause
   - Can be used to verify fix is working

### Existing Tests
- `test/UniversalLendingProtocol.t.sol:testGasTokenValidationForCrossChainWithdraw()` should now pass
- All existing withdrawal tests should continue working

## 📋 Deployment Checklist

### Before Deployment
- [ ] Review the one-line code change
- [ ] Run `verify-contract-fix.ts` to check current state
- [ ] Ensure user has sufficient SOL tokens for gas fees
- [ ] Backup current supply balances

### Deployment Steps
1. **Deploy Fixed Contract**
   ```bash
   # Deploy the updated SimpleLendingProtocol
   npx hardhat run scripts/universal/deploy-universal-lending.ts --network zeta-testnet
   ```

2. **Update Configuration**
   ```bash
   # contracts.json will be automatically updated with new address
   ```

3. **Verify Fix**
   ```bash
   # Test that the fix works
   npx hardhat run scripts/universal/test-fixed-withdrawals.ts --network zeta-testnet
   ```

### After Deployment Testing
1. **Test USDC.SOL → Solana Withdrawal**
   ```bash
   npx hardhat run scripts/universal/withdraw-all-sol-crosschain.ts --network zeta-testnet
   ```

2. **Test Other Cross-Chain Withdrawals**
   - USDC.ARBI → Arbitrum Sepolia  
   - ETH.ETH → Ethereum Sepolia
   - Verify SOL.SOL → Solana still works

3. **Monitor Transaction Success**
   - Check ZetaChain explorer for successful transactions
   - Verify assets arrive on destination chains
   - Confirm no more `0x10bad147` errors

## ⚠️ Important Notes

### User Requirements
- **For different-token withdrawals** (e.g., USDC.SOL): User must have sufficient SOL tokens in wallet AND approve them to the contract
- **For same-token withdrawals** (e.g., SOL.SOL): Gas is deducted from withdrawal amount

### Contract Behavior After Fix
- ✅ **USDC.SOL → Solana**: Will work (was broken)
- ✅ **SOL.SOL → Solana**: Will work (was already working)  
- ✅ **Any asset → Any chain**: Should work with proper gas token setup

### Validation
The fix is minimal and surgical:
- Only adds one line of code
- Follows the same pattern used in `borrowCrossChain` (which works correctly)
- Maintains all existing security checks and validations

## 🔍 Error Code Reference

- **`0x10bad147`**: ZRC20 `transferFrom` failure due to insufficient allowance
  - **Before Fix**: Appears in USDC.SOL withdrawals  
  - **After Fix**: Should not appear in any withdrawals

## 📈 Expected Outcomes

### Success Metrics
1. **Zero `0x10bad147` errors** in withdrawal transactions
2. **Successful USDC.SOL → Solana** withdrawals
3. **All existing functionality** continues to work
4. **Improved user experience** for cross-chain operations

### Performance Impact
- **Gas Cost**: Minimal increase (one additional `approve` call)
- **Execution Time**: No meaningful change
- **Security**: Maintains all existing protections

---

**Summary**: This fix resolves a critical bug preventing cross-chain withdrawals when the withdrawal asset differs from the gas token. The one-line addition ensures the gateway has proper approval to transfer withdrawal assets, eliminating the `0x10bad147` error and enabling full cross-chain withdrawal functionality.