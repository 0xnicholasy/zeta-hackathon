hardhat run scripts/simple/deploy-and-init-simple.ts --network zeta-testnet
hardhat run scripts/deposit-contract/deploy-and-init-deposit-contract.ts --network ethereum-sepolia
hardhat run scripts/deposit-contract/simulate-deposit.ts --network ethereum-sepolia
hardhat run scripts/deposit-contract/deploy-and-init-deposit-contract.ts --network arbitrum-sepolia
hardhat run scripts/deposit-contract/simulate-deposit.ts --network arbitrum-sepolia
