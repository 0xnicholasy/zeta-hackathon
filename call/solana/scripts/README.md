# ZetaChain Solana Gateway Scripts

Cross-chain deposit scripts for ZetaChain gateway from Solana.

## Prerequisites

1. **Solana CLI Setup**: Ensure you have a default keypair configured
   ```bash
   solana-keygen new  # Create new keypair if needed
   solana config get  # Verify configuration
   ```

2. **Requirements**:
   - SOL balance: At least 0.05 SOL for transactions and fees
   - Node.js with TypeScript support

## Scripts

### ✅ `deposit-sol-gateway-final.ts` - **WORKING**

Deposits SOL from Solana to ZetaChain.

```bash
ts-node deposit-sol-gateway-final.ts
```

**Features**:
- Uses default Solana CLI keypair (`~/.config/solana/id.json`)
- Deposits 0.01 SOL + 0.002 SOL gateway fee
- Sends to ZetaChain address: `0xe1C5Bf97A7Ffb50988DeF972E1E242072298a59C`
- Provides transaction URL for verification

### ⚠️ `deposit-spl-gateway-final.ts` - **TOKEN NOT WHITELISTED**

Attempts to deposit SPL tokens (USDC) from Solana to ZetaChain.

```bash
ts-node deposit-spl-gateway-final.ts
```

**Current Status**: 
- Script is technically correct but USDC devnet token is not whitelisted
- Provides helpful error message and suggests using SOL deposit instead
- Will work once the token is whitelisted by gateway authority

## Configuration

Both scripts use the same destination address on ZetaChain:
```
0xe1C5Bf97A7Ffb50988DeF972E1E242072298a59C
```

To change the destination, edit the `DESTINATION_ADDRESS` constant in either script.

## Gateway Information

- **Program ID**: `ZETAjseVjuFsxdRxo6MmTCvqFwb3ZHUx56Co3vCmGis`
- **Network**: Solana Devnet
- **Gateway Fee**: 0.002 SOL per deposit
- **Documentation**: https://www.zetachain.com/docs/developers/chains/solana/

## Example Output

```
Wallet address: BpwoHauFe6mkFLdFc5hnxdx3aT1qS6CWxWz4gQGZWgHH
Wallet SOL balance: 5.15443376
Depositing 0.01 SOL + 0.002 SOL fee
Total amount: 0.012 SOL
Destination address: 0xe1C5Bf97A7Ffb50988DeF972E1E242072298a59C
Gateway PDA: 2f9SLuUNb7TNeM6gzBwT4ZyKzzHg1Ce9yiquEjj
Sending cross-chain deposit transaction...
✅ Transaction successful!
Transaction signature: 64yfw2CyCZp7G1gPNbAb3K3HXqzknBp5WHbBCirdeEitFYKvbYZFpkgT4FWJcoVTifqEuWmhjCSmJXhnSVJCH42N
Deposited 0.01 SOL to 0xe1C5Bf97A7Ffb50988DeF972E1E242072298a59C on ZetaChain
```