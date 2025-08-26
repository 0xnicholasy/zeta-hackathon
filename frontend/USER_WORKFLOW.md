# ZetaChain Cross-Chain Lending Protocol - User Workflow Documentation

This document provides comprehensive workflow documentation for all user-facing dialog components in the ZetaChain cross-chain lending protocol frontend application.

## Overview

The protocol supports two types of operations:
- **Cross-Chain Operations**: Transaction initiated on one chain (e.g., Arbitrum, Ethereum) and settled on ZetaChain
- **Local ZetaChain Operations**: Direct transactions on ZetaChain using ZRC-20 tokens

---

## Cross-Chain Dialog Workflows

### 1. BorrowDialog (Cross-Chain Borrow)

**Purpose**: Borrow assets from ZetaChain protocol and receive them on an external chain (Arbitrum, Ethereum, or Solana).

#### Complete User Workflow:

1. **Dialog Opening**
   - User selects an asset and clicks "Borrow"
   - Dialog opens showing asset details and current health factor

2. **Input Phase**
   - User enters amount to borrow
   - App validates against maximum borrowable amount based on collateral
   - User enters recipient address (EVM or Solana format depending on destination)
   - App validates recipient address format in real-time

3. **Network Check**
   - App checks if user is on ZetaChain
   - If not on ZetaChain: Shows network switch warning and changes button text to "Switch to ZetaChain"

4. **Transaction Execution**
   - **Step A: Network Switch** (if needed)
     - User clicks submit -> switches to ZetaChain
     - App auto-proceeds after successful switch
   
   - **Step B: Gas Token Approval** (if needed)
     - App checks if gas token approval needed for withdrawal fees
     - User sees "Approve & Borrow" button
     - User approves gas token spending
     - Progress indicator shows "Waiting for approval confirmation..."
   
   - **Step C: Borrow Transaction**
     - User signs borrow transaction via `borrowCrossChain` function
     - Progress indicator shows "Waiting for borrow confirmation..."

5. **Cross-Chain Processing**
   - Transaction confirmed on ZetaChain
   - App starts tracking cross-chain status
   - Status shows "Processing cross-chain borrow..."

6. **Completion States**
   - **Success**: "Cross-chain borrow completed!" - tokens received on destination chain
   - **Failed**: Error message with retry option

#### Key Validations:
- Health factor must remain above 1.50 after borrow
- Sufficient collateral for requested borrow amount
- Valid recipient address format
- Sufficient gas token balance for withdrawal fees

---

### 2. RepayDialog (Cross-Chain Repay)

**Purpose**: Repay debt by sending tokens from external chains to ZetaChain protocol.

#### Complete User Workflow:

1. **Dialog Opening**
   - User selects a debt asset and clicks "Repay"
   - Dialog shows current debt amount and available balance on external chain

2. **Network Check & Switch**
   - App determines required network based on asset's external chain
   - If user not on correct network: Shows switch warning and "Switch to [Network]" button
   - User switches to correct network (e.g., Arbitrum Sepolia, Ethereum Sepolia)

3. **Input Phase**
   - User enters repayment amount
   - App validates against current debt and available balance
   - Shows debt information, available balance, and health factor improvement

4. **Transaction Execution**
   - **Step A: Network Switch** (if needed)
     - App automatically switches to target network
     - Auto-proceeds with transaction after switch
   
   - **Step B: Token Approval** (for ERC20 tokens)
     - User approves spending of repayment token
     - Progress shows "Waiting for approval confirmation..."
   
   - **Step C: Repay Transaction**
     - For native ETH: Calls `repayEth` with ETH value
     - For ERC20: Calls `repayToken` with token address and amount
     - Progress shows "Waiting for repay confirmation..."

5. **Cross-Chain Processing**
   - Transaction confirmed on external chain
   - App tracks cross-chain status
   - Status shows "Processing cross-chain repayment..."

6. **Completion States**
   - **Success**: "Cross-chain repayment completed!" with health factor update
   - **Failed**: Error message with option to retry

#### Key Features:
- Full repayment detection with special notice
- Health factor improvement calculation
- Different handling for native ETH vs ERC20 tokens
- Unsupported chain error handling

---

### 3. SupplyDialog (Cross-Chain Supply)

**Purpose**: Supply collateral from external chains to ZetaChain protocol.

#### Complete User Workflow:

1. **Dialog Opening**
   - User selects a token from external chain and clicks "Supply"
   - Dialog shows token balance and network information

2. **Input Phase**
   - User enters supply amount
   - App validates against available token balance
   - Shows network and asset information

3. **Transaction Execution**
   - **Step A: Token Approval** (for ERC20 tokens)
     - User approves deposit contract to spend tokens
     - Progress shows "Waiting for approval confirmation..."
   
   - **Step B: Deposit Transaction**
     - For native ETH: Calls `depositEth` with ETH value
     - For ERC20: Calls `depositToken` after approval
     - Progress shows "Waiting for deposit confirmation..."

4. **Cross-Chain Processing**
   - Transaction confirmed on external chain
   - App tracks cross-chain bridging to ZetaChain
   - Status shows "Processing cross-chain deposit..."

5. **Completion States**
   - **Success**: "Cross-chain deposit completed!" - collateral available on ZetaChain
   - **Failed**: Error message displayed

#### Key Features:
- Automatic handling of native ETH vs ERC20 tokens
- Real-time balance validation
- Cross-chain tracking with status updates

---

### 4. WithdrawDialog (Cross-Chain Withdraw)

**Purpose**: Withdraw supplied assets from ZetaChain protocol to external chains.

#### Complete User Workflow:

1. **Dialog Opening**
   - User selects a supplied asset and clicks "Withdraw"
   - Dialog shows supplied balance and destination chain information

2. **Input Phase**
   - User enters withdrawal amount (validated against supplied balance)
   - User enters recipient address (EVM or Solana format)
   - App validates recipient address format in real-time

3. **Gas Fee Calculation**
   - App calculates required gas fees for cross-chain withdrawal
   - **For Gas Token Assets** (e.g., ETH.ARBI): Gas fee deducted from withdrawal amount
   - **For Non-Gas Token Assets**: Separate gas token approval required

4. **Transaction Execution**
   - **Step A: Gas Token Approval** (if needed for non-gas tokens)
     - User approves gas token spending for withdrawal fees
     - Progress shows "Waiting for token approval..."
   
   - **Step B: Withdrawal Transaction**
     - User signs `withdrawCrossChain` transaction
     - Progress shows "Waiting for withdrawal confirmation..."

5. **Cross-Chain Processing**
   - Transaction confirmed on ZetaChain
   - App tracks cross-chain status
   - Status shows "Processing cross-chain withdrawal..."

6. **Completion States**
   - **Success**: "Cross-chain withdrawal completed!" - tokens received on destination chain
   - **Failed**: Error message with retry option

#### Key Features:
- Gas fee calculation and display
- Different handling for gas tokens vs regular tokens
- Recipient address validation for multiple chain types
- Real-time "You'll Receive" amount calculation

---

## Local ZetaChain Dialog Workflows

### 5. ZetaBorrowDialog (Local ZetaChain Borrow)

**Purpose**: Borrow ZRC-20 tokens directly on ZetaChain without cross-chain operations.

#### Complete User Workflow:

1. **Dialog Opening**
   - User selects ZRC-20 asset and clicks "Borrow Locally"
   - Dialog shows borrowing capacity and health factor

2. **Input Phase**
   - User enters borrow amount
   - App validates against maximum borrowable amount
   - Shows current and estimated health factor after borrow

3. **Transaction Execution**
   - **Single Step**: Borrow Transaction
     - User signs `borrow` function call directly
     - Progress shows "Waiting for borrow confirmation..."
     - No approval needed (direct ZRC-20 operation)

4. **Completion**
   - **Success**: "Local borrow transaction confirmed!" with immediate balance update
   - **Failed**: Error message with retry option
   - User data automatically refreshed

#### Key Features:
- Simplified single-step process (no cross-chain complexity)
- Real-time health factor calculation
- Immediate balance updates after success

---

### 6. ZetaRepayDialog (Local ZetaChain Repay)

**Purpose**: Repay debt using ZRC-20 tokens directly on ZetaChain.

#### Complete User Workflow:

1. **Dialog Opening**
   - User selects a debt asset and clicks "Repay Locally"
   - Dialog shows current debt and available ZRC-20 balance

2. **Input Phase**
   - User enters repayment amount
   - App validates against debt amount and available balance
   - Shows health factor improvement and full repayment detection

3. **Transaction Execution**
   - **Step A: Token Approval**
     - User approves ZRC-20 token spending
     - Progress shows "Waiting for approval confirmation..."
   
   - **Step B: Repay Transaction**
     - User signs `repay` function call
     - Progress shows "Waiting for repay confirmation..."

4. **Completion**
   - **Success**: "Local repay transaction confirmed!" with health factor update
   - **Failed**: Error message displayed
   - User data automatically refreshed

#### Key Features:
- Two-step process (approve � repay)
- Health factor improvement calculation
- Full repayment special notice

---

### 7. ZetaSupplyDialog (Local ZetaChain Supply)

**Purpose**: Supply ZRC-20 tokens as collateral directly on ZetaChain.

#### Complete User Workflow:

1. **Dialog Opening**
   - User selects ZRC-20 token and clicks "Supply Locally"
   - Dialog shows available ZRC-20 balance

2. **Input Phase**
   - User enters supply amount
   - App validates against available ZRC-20 balance
   - Shows network and asset information

3. **Transaction Execution**
   - **Step A: Token Approval**
     - User approves ZRC-20 token spending
     - Progress shows "Waiting for approval confirmation..."
   
   - **Step B: Supply Transaction**
     - User signs `supply` function call
     - Progress shows "Waiting for supply confirmation..."

4. **Completion**
   - **Success**: "Local supply transaction confirmed!" with balance update
   - **Failed**: Error message displayed
   - User data automatically refreshed

#### Key Features:
- Two-step approval process for ZRC-20 tokens
- Immediate balance updates
- Simple local transaction flow

---

### 8. ZetaWithdrawDialog (Local ZetaChain Withdraw)

**Purpose**: Withdraw supplied ZRC-20 tokens directly on ZetaChain.

#### Complete User Workflow:

1. **Dialog Opening**
   - User selects supplied ZRC-20 asset and clicks "Withdraw Locally"
   - Dialog shows supplied balance

2. **Input Phase**
   - User enters withdrawal amount
   - App validates against supplied balance
   - Shows recipient (user's address) and network information

3. **Transaction Execution**
   - **Single Step**: Withdraw Transaction
     - User signs `withdraw` function call directly
     - Progress shows "Waiting for withdrawal confirmation..."
     - No approval needed (withdrawing own supplied assets)

4. **Completion**
   - **Success**: "Local withdrawal transaction confirmed!" with immediate balance update
   - **Failed**: Error message displayed

#### Key Features:
- Simplified single-step process
- No approval required for withdrawals
- Immediate local transaction settlement

---

## Common Features Across All Dialogs

### Error Handling
- **Validation Errors**: Real-time validation with specific error messages
- **Transaction Errors**: Detailed error messages with technical details
- **Network Errors**: Automatic network switching with user guidance
- **Contract Errors**: User-friendly error messages with retry options

### Transaction Status Tracking
- **Progress Indicators**: Step-by-step progress visualization
- **Transaction Hashes**: Clickable links to blockchain explorers
- **Cross-Chain Tracking**: Real-time status updates for cross-chain operations
- **Status Messages**: Clear communication of current transaction state

### User Experience Features
- **MAX Button**: Quick selection of maximum available amounts
- **Real-time Validation**: Immediate feedback on user inputs
- **Health Factor Display**: Always visible collateralization status
- **Gas Fee Information**: Transparent cost breakdown
- **Address Validation**: Format checking for different chain types
- **Clipboard Integration**: Easy address pasting functionality

### Security Features
- **Amount Validation**: Prevents over-spending or invalid amounts
- **Address Validation**: Ensures correct recipient addresses
- **Health Factor Checks**: Prevents undercollateralized positions
- **Network Verification**: Ensures transactions on correct chains
- **Approval Management**: Precise token approval amounts

This documentation provides complete coverage of all user workflows within the ZetaChain cross-chain lending protocol frontend application.