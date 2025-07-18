#!/bin/bash

# Run All Tests Script for Lending Protocol
echo "=== ZetaChain Lending Protocol - Full Test Suite ==="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to run command with error handling
run_command() {
    local cmd="$1"
    local description="$2"
    
    print_status "Running: $description"
    echo "Command: $cmd"
    
    if eval "$cmd"; then
        print_status "✅ $description completed successfully"
        return 0
    else
        print_error "❌ $description failed"
        return 1
    fi
}

# Check if we're in the right directory
if [ ! -f "hardhat.config.ts" ]; then
    print_error "Please run this script from the lending-zeta directory"
    exit 1
fi

echo ""
print_status "Starting comprehensive test suite..."

# 1. Clean and compile contracts
echo ""
echo "=== Step 1: Clean and Compile ==="
run_command "npx hardhat clean" "Clean previous builds"
run_command "npx hardhat compile" "Compile contracts"

# 2. Run Foundry tests
echo ""
echo "=== Step 2: Run Foundry Tests ==="
run_command "forge test -vvv" "Run Foundry tests"

# 3. Start local network in background
echo ""
echo "=== Step 3: Start Local Network ==="
print_status "Starting local Hardhat network..."
npx hardhat node &
HARDHAT_PID=$!
sleep 5

# Function to cleanup background processes
cleanup() {
    print_status "Cleaning up background processes..."
    kill $HARDHAT_PID 2>/dev/null || true
    sleep 2
}

# Set trap to cleanup on exit
trap cleanup EXIT

# 4. Deploy and test simple protocol
echo ""
echo "=== Step 4: Simple Protocol Tests ==="
run_command "npx hardhat run scripts/deploy-simple.ts --network localhost" "Deploy simple protocol"

if [ $? -eq 0 ]; then
    run_command "npx hardhat run scripts/initialize-simple.ts --network localhost" "Initialize simple protocol"
    
    if [ $? -eq 0 ]; then
        run_command "npx hardhat run scripts/test-simple.ts --network localhost" "Test simple protocol"
    else
        print_error "Simple protocol initialization failed, skipping tests"
    fi
else
    print_error "Simple protocol deployment failed, skipping tests"
fi

# 5. Deploy and test main protocol
echo ""
echo "=== Step 5: Main Protocol Tests ==="
run_command "npx hardhat run scripts/deploy.ts --network localhost" "Deploy main protocol"

if [ $? -eq 0 ]; then
    run_command "npx hardhat run scripts/initialize.ts --network localhost" "Initialize main protocol"
    
    if [ $? -eq 0 ]; then
        run_command "npx hardhat run scripts/test-lending.ts --network localhost" "Test main protocol"
    else
        print_error "Main protocol initialization failed, skipping tests"
    fi
else
    print_error "Main protocol deployment failed, skipping tests"
fi

# 6. Run additional hardhat tests if they exist
echo ""
echo "=== Step 6: Additional Hardhat Tests ==="
if [ -d "test" ] && [ "$(ls -A test/*.ts 2>/dev/null)" ]; then
    run_command "npx hardhat test --network localhost" "Run additional Hardhat tests"
else
    print_warning "No additional Hardhat tests found"
fi

# 7. Generate coverage report if solidity-coverage is installed
echo ""
echo "=== Step 7: Coverage Report ==="
if npm list --depth=0 solidity-coverage >/dev/null 2>&1; then
    run_command "npx hardhat coverage" "Generate coverage report"
else
    print_warning "solidity-coverage not installed, skipping coverage report"
fi

# 8. Run gas usage analysis
echo ""
echo "=== Step 8: Gas Usage Analysis ==="
if npm list --depth=0 hardhat-gas-reporter >/dev/null 2>&1; then
    run_command "REPORT_GAS=true npx hardhat test --network localhost" "Generate gas report"
else
    print_warning "hardhat-gas-reporter not installed, skipping gas analysis"
fi

# Final summary
echo ""
echo "=== Test Suite Summary ==="
print_status "All tests completed!"
print_status "Check the output above for any failed tests"
print_status "Deployment files have been created in the current directory"

# Show deployment files
echo ""
print_status "Generated deployment files:"
ls -la *deployments*.json 2>/dev/null || print_warning "No deployment files found"

echo ""
print_status "Test suite execution completed!"