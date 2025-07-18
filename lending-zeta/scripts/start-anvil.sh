#!/bin/bash

# Simple script to start anvil directly
echo "Starting anvil on port 8545..."

# Kill any existing process on port 8545
lsof -ti:8545 | xargs kill -9 2>/dev/null || true

# Start anvil with commonly used settings
anvil \
  --port 8545 \
  --accounts 10 \
  --balance 10000 \
  --gas-limit 30000000 \
  --gas-price 1000000000 \
  --silent \
  --auto-impersonate &

ANVIL_PID=$!
echo "Anvil started with PID: $ANVIL_PID"
echo "Default account: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
echo "Default private key: 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"

# Wait for anvil to be ready
echo "Waiting for anvil to be ready..."
sleep 3

# Test connection
curl -X POST -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
  http://localhost:8545 2>/dev/null | grep -q result

if [ $? -eq 0 ]; then
  echo "✅ Anvil is ready and accepting connections"
else
  echo "❌ Anvil may not be ready"
fi

echo "Press Ctrl+C to stop anvil"

# Wait for user to stop
wait $ANVIL_PID