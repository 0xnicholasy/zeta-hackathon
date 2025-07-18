# Cross-Chain Lending Protocol Design for ZetaChain Hackathon

## Key Points

- **Purpose**: A lending protocol on ZetaChain enabling users to supply collateral and borrow assets across EVM chains like Arbitrum, Ethereum, and ZetaChain, using ETH and USDC.
- **Aave-Inspired**: Users must supply collateral before borrowing, with liquidation possible if the collateral-to-borrow ratio falls below a threshold.
- **Cross-Chain Flexibility**: Lenders can withdraw assets to any supported EVM chain, not limited to the deposit chain.
- **Single Contract**: All lending and borrowing logic resides in one smart contract on ZetaChain, with cross-chain deposits handled via ZetaChain’s gateway contracts.
- **Simplification for Hackathon**: The design prioritizes simplicity while showcasing ZetaChain’s cross-chain capabilities, with potential for future enhancements like additional assets or advanced features.

## Overview

This protocol leverages ZetaChain's Universal EVM and Omnichain Smart Contracts to create a seamless lending experience across multiple EVM-compatible chains. It allows users to deposit collateral (e.g., USDC from Arbitrum) and borrow assets (e.g., ETH from Ethereum) without bridges or wrapped tokens. The design mimics Aave's model, requiring collateral for borrowing and enabling liquidation for undercollateralized positions. Lenders can withdraw their supplied assets to any supported chain, enhancing flexibility.

## How It Works

- **Supplying Assets**: Users deposit assets from Arbitrum, Ethereum, or ZetaChain using ZetaChain's EVM gateway, which converts them to ZRC-20 tokens on ZetaChain. These are recorded as collateral in the lending contract.
- **Borrowing Assets**: Users borrow ZRC-20 tokens (e.g., ETH) from the contract, provided their collateral meets the required ratio.
- **Repaying and Liquidating**: Borrowers repay with interest, and if their collateral value drops too low, others can liquidate their position to recover funds.
- **Withdrawing Assets**: Lenders can withdraw their supplied assets to any supported EVM chain via the gateway, offering flexibility in asset management.

## Why ZetaChain?

ZetaChain’s ability to handle native assets across chains without wrapping simplifies the protocol, ensuring secure and efficient cross-chain transactions. This makes it ideal for a hackathon project aiming to demonstrate innovative DeFi solutions.

---

# Detailed Design for Cross-Chain Lending Protocol

## Overview

This document outlines a comprehensive design for a cross-chain lending protocol built on ZetaChain for the ZetaChain hackathon. The protocol enables users to supply collateral and borrow assets across EVM-compatible chains, specifically Arbitrum, Ethereum, and ZetaChain, using ETH and USDC. Inspired by Aave, the protocol requires users to supply collateral before borrowing, with a liquidation mechanism for undercollateralized positions. Lenders can withdraw their supplied assets to any supported EVM chain, not just the chain they deposited from. All lending and borrowing logic is implemented in a single smart contract deployed on ZetaChain, with cross-chain deposits facilitated through ZetaChain's EVM gateway contracts.

The design leverages ZetaChain’s Universal EVM and Omnichain Smart Contracts to ensure seamless interoperability, unified liquidity, and trust-minimized operations. It is tailored for hackathon constraints, focusing on simplicity while demonstrating ZetaChain’s cross-chain capabilities, with extensibility for future enhancements.

## Supported Chains and Assets

The protocol limits support to EVM-compatible chains to streamline development and ensure compatibility with ZetaChain’s infrastructure.

| **Chain** | **Chain ID** | **Description** |
| --- | --- | --- |
| Arbitrum Sepolia (ARBI) | 421614 | Arbitrum testnet for development |
| Ethereum Sepolia (ETH) | 11155111 | Ethereum testnet for development |
| ZetaChain Athens (ZETA) | 7001 | ZetaChain testnet for cross-chain interoperability |

**Supported Assets**: The protocol supports a curated list of ZRC-20 tokens, which are ZetaChain’s representation of assets from connected chains. ZRC-20 tokens function like ERC-20 tokens, enabling standard interactions within the smart contract.

| **Asset** | **Source Chain** | **ZRC-20 Token** | **Description** |
| --- | --- | --- | --- |
| ETH | Arbitrum Sepolia | ZRC-20 ETH.ARBI | Native gas token from Arbitrum |
| USDC | Arbitrum Sepolia | ZRC-20 USDC.ARBI | Stablecoin from Arbitrum |
| ETH | Ethereum Sepolia | ZRC-20 ETH.ETH | Native gas token from Ethereum |
| USDC | Ethereum Sepolia | ZRC-20 USDC.ETH | Stablecoin from Ethereum |

**Note**: The protocol focuses on ETH and USDC across both supported chains to demonstrate cross-chain functionality while maintaining simplicity for the hackathon.

## Protocol Architecture

The protocol is designed around a single smart contract deployed on ZetaChain, leveraging ZetaChain’s Universal EVM for all lending and borrowing operations. Cross-chain interactions are facilitated through ZetaChain’s EVM gateway for deposits and withdrawals.

### 1. Single Contract Deployment

- **Contract Location**: Deployed on ZetaChain’s Universal EVM.
- **Functionality**:
  - Manage user collateral and borrow balances.
  - Handle lending, borrowing, repayment, and liquidation.
  - Track interest rates and collateralization ratios.
  - Facilitate cross-chain withdrawals via the gateway.
- **Rationale**: A single contract simplifies development and ensures all logic is centralized, leveraging ZetaChain’s ability to interact with multiple chains.

### 2. User Interactions

The protocol supports the following user interactions, all managed through the ZetaChain contract unless specified otherwise.

#### Supplying Collateral

- **Process**:
  - Users deposit assets (e.g., USDC from Arbitrum) using the EVM gateway’s `depositAndCall` function (ZetaChain EVM Gateway Documentation).
  - The gateway mints corresponding ZRC-20 tokens (e.g., ZRC-20 USDC.ARBI) on ZetaChain and calls the lending contract’s `supply` function.
  - The contract records the user’s supply balance for the specific ZRC-20 token.
- **Example**: A user deposits 100 USDC from Arbitrum, which becomes 100 ZRC-20 USDC.ARBI on ZetaChain, credited as collateral.

#### Borrowing Assets

- **Process**:
  - Users call the `borrow` function on the lending contract, specifying the desired ZRC-20 asset (e.g., ZRC-20 ETH.ARBI) and amount.
  - The contract checks the user’s collateralization ratio (collateral value / borrowed value) against a minimum threshold (e.g., 1.5x).
  - If eligible, the contract transfers the borrowed ZRC-20 tokens to the user’s ZetaChain address.
- **Collateralization Ratio**: Calculated using real-time asset prices from an oracle (e.g., Chainlink).
- **Example**: A user with 150 USDC.ARBI collateral (valued at $150) can borrow up to 100 ETH.ARBI (valued at $100, assuming ETH price is $1 for simplicity).

#### Repaying Borrows

- **Process**:
  - Users call the `repay` function, transferring the borrowed ZRC-20 tokens plus interest back to the contract.
  - The contract updates the user’s borrow balance and redistributes interest to suppliers.
- **Example**: A user repays 100 ZRC-20 ETH.ARBI plus 5% interest (5 ETH.ARBI).

#### Liquidating Positions

- **Process**:
  - If a user’s collateralization ratio falls below the liquidation threshold (e.g., 1.2x), another user can call the `liquidate` function.
  - The liquidator provides collateral assets (e.g., ZRC-20 USDC.ARBI) to receive the borrower’s assets (e.g., ZRC-20 ETH.ARBI) at a discount.
  - The contract updates balances and marks the borrower’s debt as resolved.
- **Example**: If a borrower’s collateral drops to $120 against a $100 ETH borrow, a liquidator can repay the ETH and receive the USDC collateral at a discount.

#### Withdrawing Supplied Assets

- **Process**:
  - Users call the `withdraw` function to retrieve their supplied ZRC-20 tokens (e.g., ZRC-20 USDC.ARBI).
  - The contract checks that the withdrawal doesn’t violate borrowing constraints (e.g., maintaining collateralization ratio).
  - Users then use the gateway's withdrawal function to send ZRC-20 tokens to any supported EVM chain (e.g., Ethereum as native USDC) (ZetaChain Gateway Documentation).
- **Example**: A user withdraws 100 ZRC-20 USDC.ARBI and sends it to Ethereum, receiving 100 native USDC.

### 3. Cross-Chain Functionality

- **Deposits**:
  - Handled via the EVM gateway’s `depositAndCall` function, which mints ZRC-20 tokens on ZetaChain and triggers the lending contract’s `supply` function.
  - Example: Depositing USDC from Ethereum results in ZRC-20 USDC.ETH on ZetaChain.
- **Withdrawals**:
  - Users withdraw ZRC-20 tokens from the lending contract to their ZetaChain address.
  - The gateway's withdrawal function converts ZRC-20 tokens back to native assets on the user's chosen EVM chain (e.g., ZRC-20 USDC.ARBI to USDC on Ethereum).
  - Supports flexible withdrawals to any supported chain, not limited to the deposit chain.

### 4. Security and Risk Management

- **Collateral Requirements**: Users must maintain a collateralization ratio above 1.5x to borrow, ensuring overcollateralization.
- **Liquidation Thresholds**: Positions below a 1.2x ratio are subject to liquidation, protecting lenders.
- **Interest Rate Models**: Variable interest rates based on supply and demand, similar to Aave, with interest distributed to suppliers.
- **Security Measures**:
  - Use OpenZeppelin’s `ReentrancyGuard` to prevent reentrancy attacks.
  - Use `SafeMath` for safe arithmetic operations.
  - Integrate oracles for accurate price feeds to calculate collateralization ratios.
- **Revert Handling**: Leverage ZetaChain’s gateway revert mechanisms for failed cross-chain transactions (ZetaChain Gateway Documentation).

### 5. Extensibility

- **Adding Assets**: The contract can include an admin function to add new ZRC-20 tokens to support additional assets or chains.
- **Governance**: Future iterations can incorporate governance mechanisms for community-driven updates.
- **Advanced Features**: Potential additions include flash loans, fixed interest rates, or integration with other DeFi protocols.

## Workflow Example

1. **Supplying Collateral**:

   - A user on Arbitrum deposits 100 USDC using the EVM gateway’s `depositAndCall`.
   - The gateway mints 100 ZRC-20 USDC.ARBI and calls the lending contract’s `supply` function.
   - The contract records 100 USDC.ARBI as the user’s collateral.

2. **Borrowing Assets**:

   - The user calls `borrow` to borrow 0.05 ZRC-20 ETH.ARBI (valued at $100, assuming ETH price is $2000).
   - The contract verifies the collateralization ratio ($100 USDC / $100 ETH = 1.5x) and transfers the ETH.

3. **Repaying Borrow**:

   - The user calls `repay`, transferring 0.0525 ZRC-20 ETH.ARBI (0.05 principal + 5% interest).
   - The contract updates the borrow balance and distributes interest to suppliers.

4. **Withdrawing Supply**:

   - The user calls `withdraw` to retrieve 100 ZRC-20 USDC.ARBI plus interest.
   - The user uses the gateway to withdraw to Ethereum, receiving 100 native USDC.

5. **Liquidation**:

   - If the user’s collateral value drops to $110 (e.g., due to price changes), the collateralization ratio falls to 1.1x, below the 1.2x threshold.
   - A liquidator calls `liquidate`, providing 0.05 ZRC-20 ETH.ARBI to receive the user’s 100 ZRC-20 USDC.ARBI at a discount.

## Key Considerations

- **ZRC-20 Tokens**: The protocol interacts with ZRC-20 tokens, which are distinct for each asset and chain (e.g., ZRC-20 USDC.ARBI vs. ZRC-20 USDC.ETH). For simplicity, the initial design treats each as a separate market, but future versions could integrate cross-chain swaps for unified liquidity (ZRC-20 Token Standard).
- **Oracle Integration**: Use a reliable oracle (https://www.zetachain.com/docs/about/services/pyth/#pyth-entropy) to fetch real-time prices for collateral and borrowed assets to ensure accurate collateralization ratios.
- **Gas Efficiency**: Optimize contract functions to minimize gas costs, especially for cross-chain operations.
- **Hackathon Constraints**: The design prioritizes simplicity to fit hackathon timelines, focusing on core lending and cross-chain features. Advanced features like flash loans or multi-asset withdrawals can be added later.
- **Testing**: Deploy and test on ZetaChain's testnet (Athens) with connected chains like Arbitrum Sepolia and Ethereum Sepolia testnet.

## References

- ZetaChain EVM Gateway Documentation: Details on interacting with EVM chains via the gateway.
- ZetaChain Gateway Documentation: Information on withdrawing assets to connected chains.
- ZRC-20 Token Standard: Explanation of ZRC-20 tokens and their relation to ERC-20.
- Aave Protocol Documentation: Reference for lending protocol mechanics, including collateralization and liquidation.

## Additional Notes

- **Scalability**: The protocol can scale to support additional EVM chains (e.g., Ethereum, Polygon) by updating the supported chain list and ZRC-20 tokens.
- **Future Enhancements**: Consider integrating with ZetaChain’s cross-chain swap functionality to unify liquidity across different ZRC-20 versions of the same asset.
- **Security Audits**: For production, conduct thorough audits to ensure robustness against vulnerabilities.
- **User Experience**: Provide clear documentation and a user-friendly interface for interacting with the protocol, especially for cross-chain operations.

This design provides a robust foundation for a cross-chain lending protocol on ZetaChain, showcasing its interoperability while delivering a functional DeFi solution for the hackathon. You can edit this markdown in Notion to refine or expand the design as needed.