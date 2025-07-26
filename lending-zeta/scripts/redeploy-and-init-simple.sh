#!/usr/bin/env bash
# Abort on error, unset vars, or failed pipes
set -euo pipefail

hh run scripts/simple/withdraw-all-fixed.ts --network zeta-testnet

hh run scripts/simple/deploy-and-init-simple.ts --network zeta-testnet

PROTOCOL_TYPE=simple hh run scripts/deposit-contract/deploy-deposit-contracts.ts --network arbitrum-sepolia      
hh run scripts/deposit-contract/simulate-deposit.ts --network arbitrum-sepolia

PROTOCOL_TYPE=simple hh run scripts/deposit-contract/deploy-deposit-contracts.ts --network ethereum-sepolia
hh run scripts/deposit-contract/simulate-deposit.ts --network ethereum-sepolia

cd ..
python3 sync-contracts.py
cd lending-zeta