#!/usr/bin/env bash
# Abort on error, unset vars, or failed pipes
set -euo pipefail

hh run scripts/universal/withdraw-all-local.ts --network zeta-testnet

hh run scripts/universal/deploy-universal-lending.ts --network zeta-testnet

# PROTOCOL_TYPE=universal hh run scripts/deposit-contract/deploy-deposit-contracts.ts --network arbitrum-sepolia
PROTOCOL_TYPE=universal hh run scripts/deposit-contract/update-lending-protocol-address.ts --network arbitrum-sepolia
hh run scripts/deposit-contract/simulate-deposit.ts --network arbitrum-sepolia

# PROTOCOL_TYPE=universal hh run scripts/deposit-contract/deploy-deposit-contracts.ts --network ethereum-sepolia
PROTOCOL_TYPE=universal hh run scripts/deposit-contract/update-lending-protocol-address.ts --network ethereum-sepolia
hh run scripts/deposit-contract/simulate-deposit.ts --network ethereum-sepolia

cd ..
python3 sync-contracts.py
cd lending-zeta