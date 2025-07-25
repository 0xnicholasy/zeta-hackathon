# DepositContract Scripts

This directory contains scripts for managing DepositContract deployments and updates for the ZetaChain lending protocol.

## Scripts Overview

### 1. `deploy-deposit-contracts.ts`
Deploys a new DepositContract on external chains (Arbitrum Sepolia, Ethereum Sepolia) that connects to either the simple or universal lending protocol on ZetaChain.

### 2. `update-lending-protocol-address.ts` ⭐ **NEW**
Updates an existing DepositContract to point to a different lending protocol address on ZetaChain. This is useful when you redeploy the lending protocol and want to update existing DepositContracts without redeploying them.

### 3. `script-helpers.ts` ⭐ **NEW**
Common utility functions used by the deposit contract scripts for argument parsing, logging, and error handling.

## Usage

### Deploy New DepositContract

```bash
# Deploy for simple lending protocol (default)
npx hardhat run scripts/deposit-contract/deploy-deposit-contracts.ts --network arbitrum-sepolia

# Deploy for universal lending protocol
npx hardhat run scripts/deposit-contract/deploy-deposit-contracts.ts universal --network arbitrum-sepolia
```

### Update Existing DepositContract

```bash
# Update to use simple lending protocol
npx hardhat run scripts/deposit-contract/update-lending-protocol-address.ts --network arbitrum-sepolia

# Update to use universal lending protocol  
npx hardhat run scripts/deposit-contract/update-lending-protocol-address.ts universal --network arbitrum-sepolia
```

## Protocol Types

- **`simple`** - Uses `SimpleLendingProtocol` on ZetaChain
- **`universal`** - Uses `UniversalLendingProtocol` on ZetaChain

## Safety Features

### Chain ID Validation
The update script includes chain ID validation to prevent accidental updates:
- You must provide the expected ZetaChain ID when updating
- The script validates against the stored chain ID in the contract
- Prevents updating contracts configured for different ZetaChain networks

### Ownership Protection
- Only the contract owner can update the lending protocol address
- Clear error messages for unauthorized access attempts

### Address Validation
- Validates that addresses are not zero addresses
- Verifies the update was successful before completing

## Script Output

Both scripts provide structured output with:
- 📋 Protocol type and configuration
- 📡 Network information
- 📋 Contract addresses
- ⏳ Transaction status
- ✅ Success confirmation
- 📊 Operation summary

## Error Handling

The scripts handle common errors gracefully:
- **Chain ID mismatch**: Clear validation error messages
- **Access denied**: Owner-only function protection
- **Insufficient funds**: Gas fee validation
- **Contract not found**: Missing contract addresses in contracts.json

## Example Workflow

1. **Deploy lending protocol on ZetaChain**
   ```bash
   npx hardhat run scripts/universal/deploy-universal-lending.ts --network zeta-testnet
   ```

2. **Deploy DepositContract on external chain**
   ```bash
   npx hardhat run scripts/deposit-contract/deploy-deposit-contracts.ts universal --network arbitrum-sepolia
   ```

3. **Later, redeploy lending protocol with changes**
   ```bash
   npx hardhat run scripts/universal/deploy-universal-lending.ts --network zeta-testnet
   ```

4. **Update DepositContract to use new protocol address**
   ```bash
   npx hardhat run scripts/deposit-contract/update-lending-protocol-address.ts universal --network arbitrum-sepolia
   ```

## Files Structure

```
scripts/deposit-contract/
├── deploy-deposit-contracts.ts     # Deploy new DepositContract
├── update-lending-protocol-address.ts  # Update existing DepositContract  
├── script-helpers.ts               # Common utilities
├── README.md                       # This documentation
├── add-assets.ts                   # Add supported assets
├── simulate-deposit.ts             # Test deposits
└── verify-assets.ts                # Verify asset configuration
```