#!/usr/bin/env rust-script

//! # Solana DepositContract Test Suite
//! 
//! Comprehensive test cases for the ZetaChain DepositContract on Solana
//! 
//! Run with: `cargo test --bin test_deposit_contract`

use std::collections::HashMap;

// Mock types matching the actual contract
#[derive(Debug, Clone, Copy, PartialEq)]
struct Pubkey([u8; 32]);

impl Pubkey {
    fn new_unique() -> Self {
        use std::sync::atomic::{AtomicU64, Ordering};
        static COUNTER: AtomicU64 = AtomicU64::new(1);
        let mut key = [0u8; 32];
        let counter = COUNTER.fetch_add(1, Ordering::Relaxed);
        key[24..32].copy_from_slice(&counter.to_le_bytes());
        Pubkey(key)
    }

    fn to_bytes(&self) -> [u8; 32] {
        self.0
    }
}

#[derive(Clone, Debug)]
struct ContractState {
    authority: Pubkey,
    lending_protocol_address: [u8; 20],
    zeta_chain_id: u64,
    is_paused: bool,
    bump: u8,
}

#[derive(Clone, Debug)]
struct AssetConfig {
    mint: Pubkey,
    decimals: u8,
    is_native: bool,
    is_supported: bool,
    bump: u8,
}

#[derive(Debug)]
enum DepositContractError {
    Unauthorized,
    InvalidAmount,
    UnsupportedAsset,
    InvalidChainId,
    DepositFailed,
    ContractPaused,
    UseDepositSol,
    UseRepaySol,
    InsufficientDepositFee,
}

// Constants from the contract
const GAS_LIMIT: u64 = 5_000_000;
const DEPOSIT_FEE: u64 = 2_000_000; // 0.002 SOL in lamports

// Mock contract operations
struct MockDepositContract {
    contract_state: Option<ContractState>,
    asset_configs: HashMap<Pubkey, AssetConfig>,
}

impl MockDepositContract {
    fn new() -> Self {
        Self {
            contract_state: None,
            asset_configs: HashMap::new(),
        }
    }

    fn initialize(&mut self, authority: Pubkey, lending_protocol_address: [u8; 20], zeta_chain_id: u64) -> Result<(), DepositContractError> {
        if self.contract_state.is_some() {
            return Err(DepositContractError::Unauthorized);
        }

        // Validate zeta_chain_id is a known ZetaChain network
        match zeta_chain_id {
            7000 | 7001 => {}, // Mainnet and testnet
            _ => return Err(DepositContractError::InvalidChainId),
        }

        self.contract_state = Some(ContractState {
            authority,
            lending_protocol_address,
            zeta_chain_id,
            is_paused: false,
            bump: 0,
        });

        Ok(())
    }

    fn add_supported_asset(&mut self, authority: Pubkey, mint: Pubkey, decimals: u8, is_native: bool) -> Result<(), DepositContractError> {
        let state = self.contract_state.as_ref().ok_or(DepositContractError::Unauthorized)?;
        
        if state.authority.0 != authority.0 {
            return Err(DepositContractError::Unauthorized);
        }

        if state.is_paused {
            return Err(DepositContractError::ContractPaused);
        }

        if self.asset_configs.contains_key(&mint) {
            return Err(DepositContractError::UnsupportedAsset);
        }

        self.asset_configs.insert(mint, AssetConfig {
            mint,
            decimals,
            is_native,
            is_supported: true,
            bump: 0,
        });

        Ok(())
    }

    fn deposit_sol(&self, user: Pubkey, amount: u64, on_behalf_of: [u8; 20]) -> Result<Vec<u8>, DepositContractError> {
        let state = self.contract_state.as_ref().ok_or(DepositContractError::Unauthorized)?;
        
        if state.is_paused {
            return Err(DepositContractError::ContractPaused);
        }

        if amount == 0 {
            return Err(DepositContractError::InvalidAmount);
        }

        if amount < DEPOSIT_FEE {
            return Err(DepositContractError::InsufficientDepositFee);
        }

        // Validate on_behalf_of is 20 bytes (ZetaChain address format)
        if on_behalf_of.len() != 20 {
            return Err(DepositContractError::InvalidAmount);
        }

        // Create supply message
        Self::create_supply_message(on_behalf_of)
    }

    fn deposit_spl_token(&self, user: Pubkey, mint: Pubkey, amount: u64, on_behalf_of: [u8; 20]) -> Result<Vec<u8>, DepositContractError> {
        let state = self.contract_state.as_ref().ok_or(DepositContractError::Unauthorized)?;
        
        if state.is_paused {
            return Err(DepositContractError::ContractPaused);
        }

        let asset_config = self.asset_configs.get(&mint).ok_or(DepositContractError::UnsupportedAsset)?;
        
        if !asset_config.is_supported {
            return Err(DepositContractError::UnsupportedAsset);
        }

        if asset_config.is_native {
            return Err(DepositContractError::UseDepositSol);
        }

        if amount == 0 {
            return Err(DepositContractError::InvalidAmount);
        }

        Self::create_supply_message(on_behalf_of)
    }

    fn borrow_cross_chain(&self, user: Pubkey, asset: [u8; 20], amount: u64, destination_chain: u64, recipient: [u8; 20]) -> Result<Vec<u8>, DepositContractError> {
        let state = self.contract_state.as_ref().ok_or(DepositContractError::Unauthorized)?;
        
        if state.is_paused {
            return Err(DepositContractError::ContractPaused);
        }

        if amount == 0 {
            return Err(DepositContractError::InvalidAmount);
        }

        // Validate destination_chain is supported (Arbitrum Sepolia, Ethereum Sepolia)
        match destination_chain {
            421614 | 11155111 => {},
            _ => return Err(DepositContractError::InvalidChainId),
        }

        Self::create_borrow_cross_chain_message(user.to_bytes(), amount, destination_chain, recipient)
    }

    fn set_pause_state(&mut self, authority: Pubkey, is_paused: bool) -> Result<(), DepositContractError> {
        let state = self.contract_state.as_mut().ok_or(DepositContractError::Unauthorized)?;
        
        if state.authority.0 != authority.0 {
            return Err(DepositContractError::Unauthorized);
        }

        state.is_paused = is_paused;
        Ok(())
    }

    // Message creation functions matching the contract
    fn create_supply_message(on_behalf_of: [u8; 20]) -> Result<Vec<u8>, DepositContractError> {
        // Convert 20-byte address to 32-byte address (EVM format)
        let mut evm_address = [0u8; 32];
        evm_address[12..32].copy_from_slice(&on_behalf_of);
        
        // Manually create ABI-encoded message: abi.encode("supply", address)
        let mut message = Vec::with_capacity(128);
        
        // Offset for string "supply" (32 bytes)
        message.extend_from_slice(&[0u8; 28]); // Padding
        message.extend_from_slice(&64u32.to_be_bytes()); // Offset to string data
        
        // Address (32 bytes)
        message.extend_from_slice(&evm_address);
        
        // String length (32 bytes) - "supply" is 6 bytes
        message.extend_from_slice(&[0u8; 28]); // Padding
        message.extend_from_slice(&6u32.to_be_bytes()); // String length
        
        // String data "supply" (padded to 32 bytes)
        message.extend_from_slice(b"supply");
        message.extend_from_slice(&[0u8; 26]); // Padding to 32 bytes
        
        // Pad entire message to exactly 128 bytes
        message.resize(128, 0);
        
        Ok(message)
    }

    fn create_borrow_cross_chain_message(
        user: [u8; 32],
        amount: u64,
        destination_chain: u64,
        recipient: [u8; 20],
    ) -> Result<Vec<u8>, DepositContractError> {
        // Simple format for testing - in real implementation would be proper ABI encoding
        let message = format!(
            "borrowCrossChain:{}:{}:{}:{}",
            hex::encode(user),
            amount,
            destination_chain,
            hex::encode(recipient)
        );
        Ok(message.into_bytes())
    }
}

// Test implementations
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_contract_initialization() {
        let mut contract = MockDepositContract::new();
        let authority = Pubkey::new_unique();
        let lending_protocol_address = [1u8; 20];
        let zeta_chain_id = 7001; // ZetaChain testnet
        
        let result = contract.initialize(authority, lending_protocol_address, zeta_chain_id);
        assert!(result.is_ok());
        
        let state = contract.contract_state.unwrap();
        assert_eq!(state.authority.0, authority.0);
        assert_eq!(state.lending_protocol_address, lending_protocol_address);
        assert_eq!(state.zeta_chain_id, zeta_chain_id);
        assert!(!state.is_paused);
    }

    #[test]
    fn test_invalid_chain_id_initialization() {
        let mut contract = MockDepositContract::new();
        let authority = Pubkey::new_unique();
        let lending_protocol_address = [1u8; 20];
        let invalid_chain_id = 1; // Invalid chain ID
        
        let result = contract.initialize(authority, lending_protocol_address, invalid_chain_id);
        assert!(matches!(result, Err(DepositContractError::InvalidChainId)));
    }

    #[test]
    fn test_add_supported_asset() {
        let mut contract = MockDepositContract::new();
        let authority = Pubkey::new_unique();
        let lending_protocol_address = [1u8; 20];
        let zeta_chain_id = 7001;
        
        contract.initialize(authority, lending_protocol_address, zeta_chain_id).unwrap();
        
        let mint = Pubkey::new_unique();
        let result = contract.add_supported_asset(authority, mint, 6, false);
        assert!(result.is_ok());
        
        let asset_config = contract.asset_configs.get(&mint).unwrap();
        assert_eq!(asset_config.decimals, 6);
        assert!(!asset_config.is_native);
        assert!(asset_config.is_supported);
    }

    #[test]
    fn test_unauthorized_add_asset() {
        let mut contract = MockDepositContract::new();
        let authority = Pubkey::new_unique();
        let wrong_authority = Pubkey::new_unique();
        let lending_protocol_address = [1u8; 20];
        let zeta_chain_id = 7001;
        
        contract.initialize(authority, lending_protocol_address, zeta_chain_id).unwrap();
        
        let mint = Pubkey::new_unique();
        let result = contract.add_supported_asset(wrong_authority, mint, 6, false);
        assert!(matches!(result, Err(DepositContractError::Unauthorized)));
    }

    #[test]
    fn test_deposit_sol_success() {
        let mut contract = MockDepositContract::new();
        let authority = Pubkey::new_unique();
        let lending_protocol_address = [1u8; 20];
        let zeta_chain_id = 7001;
        
        contract.initialize(authority, lending_protocol_address, zeta_chain_id).unwrap();
        
        let user = Pubkey::new_unique();
        let amount = 10_000_000; // 0.01 SOL
        let on_behalf_of = [2u8; 20]; // ZetaChain address
        
        let result = contract.deposit_sol(user, amount, on_behalf_of);
        assert!(result.is_ok());
        
        let message = result.unwrap();
        assert_eq!(message.len(), 128); // Expected ABI encoded message length
    }

    #[test]
    fn test_deposit_sol_insufficient_fee() {
        let mut contract = MockDepositContract::new();
        let authority = Pubkey::new_unique();
        let lending_protocol_address = [1u8; 20];
        let zeta_chain_id = 7001;
        
        contract.initialize(authority, lending_protocol_address, zeta_chain_id).unwrap();
        
        let user = Pubkey::new_unique();
        let amount = 1_000_000; // 0.001 SOL - less than minimum fee
        let on_behalf_of = [2u8; 20];
        
        let result = contract.deposit_sol(user, amount, on_behalf_of);
        assert!(matches!(result, Err(DepositContractError::InsufficientDepositFee)));
    }

    #[test]
    fn test_deposit_spl_token_success() {
        let mut contract = MockDepositContract::new();
        let authority = Pubkey::new_unique();
        let lending_protocol_address = [1u8; 20];
        let zeta_chain_id = 7001;
        
        contract.initialize(authority, lending_protocol_address, zeta_chain_id).unwrap();
        
        let mint = Pubkey::new_unique();
        contract.add_supported_asset(authority, mint, 6, false).unwrap();
        
        let user = Pubkey::new_unique();
        let amount = 1_000_000; // 1 USDC (6 decimals)
        let on_behalf_of = [2u8; 20];
        
        let result = contract.deposit_spl_token(user, mint, amount, on_behalf_of);
        assert!(result.is_ok());
        
        let message = result.unwrap();
        assert_eq!(message.len(), 128);
    }

    #[test]
    fn test_deposit_unsupported_asset() {
        let mut contract = MockDepositContract::new();
        let authority = Pubkey::new_unique();
        let lending_protocol_address = [1u8; 20];
        let zeta_chain_id = 7001;
        
        contract.initialize(authority, lending_protocol_address, zeta_chain_id).unwrap();
        
        let mint = Pubkey::new_unique(); // Not added as supported asset
        let user = Pubkey::new_unique();
        let amount = 1_000_000;
        let on_behalf_of = [2u8; 20];
        
        let result = contract.deposit_spl_token(user, mint, amount, on_behalf_of);
        assert!(matches!(result, Err(DepositContractError::UnsupportedAsset)));
    }

    #[test]
    fn test_deposit_native_asset_with_spl_function() {
        let mut contract = MockDepositContract::new();
        let authority = Pubkey::new_unique();
        let lending_protocol_address = [1u8; 20];
        let zeta_chain_id = 7001;
        
        contract.initialize(authority, lending_protocol_address, zeta_chain_id).unwrap();
        
        let mint = Pubkey::new_unique();
        contract.add_supported_asset(authority, mint, 9, true).unwrap(); // Native asset
        
        let user = Pubkey::new_unique();
        let amount = 1_000_000;
        let on_behalf_of = [2u8; 20];
        
        let result = contract.deposit_spl_token(user, mint, amount, on_behalf_of);
        assert!(matches!(result, Err(DepositContractError::UseDepositSol)));
    }

    #[test]
    fn test_borrow_cross_chain_success() {
        let mut contract = MockDepositContract::new();
        let authority = Pubkey::new_unique();
        let lending_protocol_address = [1u8; 20];
        let zeta_chain_id = 7001;
        
        contract.initialize(authority, lending_protocol_address, zeta_chain_id).unwrap();
        
        let user = Pubkey::new_unique();
        let asset = [3u8; 20]; // ZRC-20 token address
        let amount = 1_000_000;
        let destination_chain = 421614; // Arbitrum Sepolia
        let recipient = [4u8; 20]; // Arbitrum address
        
        let result = contract.borrow_cross_chain(user, asset, amount, destination_chain, recipient);
        assert!(result.is_ok());
        
        let message = result.unwrap();
        assert!(!message.is_empty());
        
        // Verify message contains expected data
        let message_str = String::from_utf8(message).unwrap();
        assert!(message_str.contains("borrowCrossChain"));
        assert!(message_str.contains(&amount.to_string()));
        assert!(message_str.contains(&destination_chain.to_string()));
    }

    #[test]
    fn test_borrow_cross_chain_invalid_destination() {
        let mut contract = MockDepositContract::new();
        let authority = Pubkey::new_unique();
        let lending_protocol_address = [1u8; 20];
        let zeta_chain_id = 7001;
        
        contract.initialize(authority, lending_protocol_address, zeta_chain_id).unwrap();
        
        let user = Pubkey::new_unique();
        let asset = [3u8; 20];
        let amount = 1_000_000;
        let invalid_destination_chain = 1; // Invalid chain
        let recipient = [4u8; 20];
        
        let result = contract.borrow_cross_chain(user, asset, amount, invalid_destination_chain, recipient);
        assert!(matches!(result, Err(DepositContractError::InvalidChainId)));
    }

    #[test]
    fn test_pause_functionality() {
        let mut contract = MockDepositContract::new();
        let authority = Pubkey::new_unique();
        let lending_protocol_address = [1u8; 20];
        let zeta_chain_id = 7001;
        
        contract.initialize(authority, lending_protocol_address, zeta_chain_id).unwrap();
        
        // Pause the contract
        let result = contract.set_pause_state(authority, true);
        assert!(result.is_ok());
        
        // Try to deposit while paused
        let user = Pubkey::new_unique();
        let amount = 10_000_000;
        let on_behalf_of = [2u8; 20];
        
        let result = contract.deposit_sol(user, amount, on_behalf_of);
        assert!(matches!(result, Err(DepositContractError::ContractPaused)));
        
        // Unpause and try again
        contract.set_pause_state(authority, false).unwrap();
        let result = contract.deposit_sol(user, amount, on_behalf_of);
        assert!(result.is_ok());
    }

    #[test]
    fn test_supply_message_encoding() {
        let on_behalf_of = [5u8; 20];
        let message = MockDepositContract::create_supply_message(on_behalf_of).unwrap();
        
        // Verify message structure
        assert_eq!(message.len(), 128);
        
        // Check that the address was properly converted to EVM format (32 bytes with padding)
        let evm_address_start = 32; // After offset
        let evm_address = &message[evm_address_start..evm_address_start + 32];
        
        // First 12 bytes should be zero padding
        for i in 0..12 {
            assert_eq!(evm_address[i], 0);
        }
        
        // Last 20 bytes should match our address
        for i in 12..32 {
            assert_eq!(evm_address[i], 5u8);
        }
    }

    #[test]
    fn test_message_format_compatibility() {
        // Test that our message format matches expected EVM ABI encoding
        let on_behalf_of = [0x12, 0x34, 0x56, 0x78, 0x9A, 0xBC, 0xDE, 0xF0, 0x11, 0x22,
                            0x33, 0x44, 0x55, 0x66, 0x77, 0x88, 0x99, 0xAA, 0xBB, 0xCC];
        
        let message = MockDepositContract::create_supply_message(on_behalf_of).unwrap();
        
        // Basic structure verification
        assert_eq!(message.len(), 128);
        
        // Check offset to string data (should be 64 = 0x40)
        assert_eq!(message[28], 0);
        assert_eq!(message[29], 0);
        assert_eq!(message[30], 0);
        assert_eq!(message[31], 64);
        
        // Check string length (should be 6 for "supply")
        assert_eq!(message[92], 0);
        assert_eq!(message[93], 0);
        assert_eq!(message[94], 0);
        assert_eq!(message[95], 6);
        
        // Check string content
        assert_eq!(&message[96..102], b"supply");
    }

    #[test]
    fn test_supported_chain_ids() {
        let supported_zeta_chains = vec![7000, 7001]; // Mainnet, Testnet
        let supported_destination_chains = vec![421614, 11155111]; // Arbitrum Sepolia, Ethereum Sepolia
        
        for &chain_id in &supported_zeta_chains {
            let mut contract = MockDepositContract::new();
            let authority = Pubkey::new_unique();
            let lending_protocol_address = [1u8; 20];
            
            let result = contract.initialize(authority, lending_protocol_address, chain_id);
            assert!(result.is_ok(), "Chain ID {} should be supported for initialization", chain_id);
        }
        
        // Test cross-chain operations with supported destination chains
        let mut contract = MockDepositContract::new();
        let authority = Pubkey::new_unique();
        let lending_protocol_address = [1u8; 20];
        contract.initialize(authority, lending_protocol_address, 7001).unwrap();
        
        for &dest_chain in &supported_destination_chains {
            let user = Pubkey::new_unique();
            let asset = [1u8; 20];
            let amount = 1_000_000;
            let recipient = [2u8; 20];
            
            let result = contract.borrow_cross_chain(user, asset, amount, dest_chain, recipient);
            assert!(result.is_ok(), "Destination chain {} should be supported", dest_chain);
        }
    }

    #[test]
    fn test_constants_validation() {
        assert_eq!(GAS_LIMIT, 5_000_000);
        assert_eq!(DEPOSIT_FEE, 2_000_000); // 0.002 SOL
        
        // Test that deposit fee is reasonable (between 0.001 and 0.01 SOL)
        assert!(DEPOSIT_FEE >= 1_000_000); // At least 0.001 SOL
        assert!(DEPOSIT_FEE <= 10_000_000); // At most 0.01 SOL
    }

    #[test]
    fn test_zeta_chain_address_format() {
        // ZetaChain addresses should be 20 bytes (Ethereum-compatible)
        let valid_address = [1u8; 20];
        let message = MockDepositContract::create_supply_message(valid_address);
        assert!(message.is_ok());
        
        // Test with various address patterns
        let zero_address = [0u8; 20];
        let message = MockDepositContract::create_supply_message(zero_address);
        assert!(message.is_ok());
        
        let max_address = [0xFFu8; 20];
        let message = MockDepositContract::create_supply_message(max_address);
        assert!(message.is_ok());
    }

    #[test]
    fn test_edge_cases() {
        let mut contract = MockDepositContract::new();
        let authority = Pubkey::new_unique();
        let lending_protocol_address = [1u8; 20];
        let zeta_chain_id = 7001;
        
        contract.initialize(authority, lending_protocol_address, zeta_chain_id).unwrap();
        
        // Test with zero amount
        let user = Pubkey::new_unique();
        let on_behalf_of = [1u8; 20];
        let result = contract.deposit_sol(user, 0, on_behalf_of);
        assert!(matches!(result, Err(DepositContractError::InvalidAmount)));
        
        // Test with maximum amount
        let max_amount = u64::MAX;
        let result = contract.deposit_sol(user, max_amount, on_behalf_of);
        assert!(result.is_ok()); // Should not fail due to amount size
        
        // Test cross-chain with zero amount
        let asset = [1u8; 20];
        let destination_chain = 421614;
        let recipient = [2u8; 20];
        let result = contract.borrow_cross_chain(user, asset, 0, destination_chain, recipient);
        assert!(matches!(result, Err(DepositContractError::InvalidAmount)));
    }
}

fn main() {
    println!("🧪 Running Solana DepositContract Test Suite...");
    println!("✅ All tests should pass!");
    println!("Run with: cargo test --bin test_deposit_contract");
}

// Add hex dependency for encoding
mod hex {
    pub fn encode(bytes: &[u8]) -> String {
        bytes.iter().map(|b| format!("{:02x}", b)).collect()
    }
}