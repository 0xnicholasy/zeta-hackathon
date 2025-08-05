use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use anchor_spl::associated_token::AssociatedToken;
use anchor_lang::solana_program::{
    instruction::{AccountMeta, Instruction},
    program::invoke,
};

declare_id!("GcMxmSpPFZqWnFxv1HamYwiq5JAuDmuA2akFiAwu5S2d");

// Gateway program ID from .env.example
pub const GATEWAY_PROGRAM_ID: &str = "ZETAjseVjuFsxdRxo6MmTCvqFwb3ZHUx56Co3vCmGis";
// USDC SPL token from .env.example
pub const USDC_SPL_MINT: &str = "Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr";

// Gas limit equivalent for cross-chain operations
pub const GAS_LIMIT: u64 = 5_000_000;
// Minimum deposit fee (0.002 SOL in lamports)
pub const DEPOSIT_FEE: u64 = 2_000_000;

// RevertOptions struct to match Gateway interface
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct RevertOptions {
    pub revert_address: [u8; 20],    // Ethereum address for revert destination
    pub call_on_revert: bool,        // Whether to call contract on revert
    pub abort_address: [u8; 20],     // Address to abort transaction to
    pub revert_message: Vec<u8>,     // Message for revert
    pub on_revert_gas_limit: u64,    // Gas limit for revert operation
}

#[program]
pub mod deposit_contract {
    use super::*;

    /// Initialize the deposit contract with gateway and lending protocol settings
    pub fn initialize(
        ctx: Context<Initialize>,
        lending_protocol_address: [u8; 20], // ZetaChain address (20 bytes)
        zeta_chain_id: u64,
    ) -> Result<()> {
        let contract_state = &mut ctx.accounts.contract_state;
        contract_state.authority = ctx.accounts.authority.key();
        contract_state.lending_protocol_address = lending_protocol_address;
        contract_state.zeta_chain_id = zeta_chain_id;
        contract_state.is_paused = false;
        contract_state.bump = ctx.bumps.contract_state;

        // TODO: Validate lending_protocol_address is a valid ZetaChain address
        // TODO: Validate zeta_chain_id matches expected ZetaChain network (7000 mainnet, 7001 testnet)
        // TODO: Consider adding Gateway program validation

        emit!(ContractInitialized {
            authority: ctx.accounts.authority.key(),
            lending_protocol_address,
            zeta_chain_id,
        });

        Ok(())
    }

    /// Add a supported SPL token asset
    pub fn add_supported_asset(
        ctx: Context<AddSupportedAsset>,
        mint: Pubkey,
        decimals: u8,
        is_native: bool,
    ) -> Result<()> {
        let asset_config = &mut ctx.accounts.asset_config;
        asset_config.mint = mint;
        asset_config.decimals = decimals;
        asset_config.is_native = is_native;
        asset_config.is_supported = true;
        asset_config.bump = ctx.bumps.asset_config;

        // TODO: Validate mint is a valid SPL token mint address
        // TODO: Verify decimals matches the actual token mint decimals
        // TODO: Consider adding whitelist validation for supported tokens
        // TODO: Add maximum number of supported assets limit

        emit!(AssetAdded {
            mint,
            decimals,
            is_native,
        });

        Ok(())
    }

    /// Remove a supported asset
    pub fn remove_supported_asset(ctx: Context<RemoveSupportedAsset>) -> Result<()> {
        let asset_config = &mut ctx.accounts.asset_config;
        asset_config.is_supported = false;

        emit!(AssetRemoved {
            mint: asset_config.mint,
        });

        Ok(())
    }

    /// Update lending protocol address on ZetaChain
    pub fn update_lending_protocol_address(
        ctx: Context<UpdateLendingProtocolAddress>,
        new_lending_protocol_address: [u8; 20],
        expected_zeta_chain_id: u64,
    ) -> Result<()> {
        let contract_state = &mut ctx.accounts.contract_state;
        
        require_eq!(
            expected_zeta_chain_id,
            contract_state.zeta_chain_id,
            DepositContractError::InvalidChainId
        );

        let old_address = contract_state.lending_protocol_address;
        contract_state.lending_protocol_address = new_lending_protocol_address;

        emit!(LendingProtocolAddressUpdated {
            old_address,
            new_address: new_lending_protocol_address,
            chain_id: contract_state.zeta_chain_id,
        });

        Ok(())
    }

    /// Deposit SOL to the lending protocol on ZetaChain
    pub fn deposit_sol(
        ctx: Context<DepositSol>,
        amount: u64,
        on_behalf_of: [u8; 20], // ZetaChain address
    ) -> Result<()> {
        require!(!ctx.accounts.contract_state.is_paused, DepositContractError::ContractPaused);
        require!(amount > 0, DepositContractError::InvalidAmount);
        require!(amount >= DEPOSIT_FEE, DepositContractError::InsufficientDepositFee);

        // TODO: Add minimum deposit amount validation beyond just deposit fee
        // TODO: Validate on_behalf_of is a valid ZetaChain address format  
        // TODO: Check user has sufficient SOL balance for the deposit + transaction fees

        // Create message for SimpleLendingProtocol.onCall()
        let message = create_supply_message(on_behalf_of)?;

        // Invoke gateway deposit_and_call
        invoke_gateway_deposit_and_call(
            &ctx.accounts.gateway_program.to_account_info(),
            &ctx.accounts.user.to_account_info(),
            &ctx.accounts.contract_state.to_account_info(),
            amount,
            ctx.accounts.contract_state.lending_protocol_address,
            message,
        )?;

        emit!(DepositInitiated {
            user: ctx.accounts.user.key(),
            asset: system_program::ID, // SOL represented as System Program ID
            amount,
            on_behalf_of,
        });

        Ok(())
    }

    /// Deposit SPL tokens to the lending protocol on ZetaChain
    pub fn deposit_spl_token(
        ctx: Context<DepositSplToken>,
        amount: u64,
        on_behalf_of: [u8; 20],
    ) -> Result<()> {
        require!(!ctx.accounts.contract_state.is_paused, DepositContractError::ContractPaused);
        require!(amount > 0, DepositContractError::InvalidAmount);
        require!(ctx.accounts.asset_config.is_supported, DepositContractError::UnsupportedAsset);
        require!(!ctx.accounts.asset_config.is_native, DepositContractError::UseDepositSol);

        // TODO: Add minimum deposit amount validation
        // TODO: Validate on_behalf_of is a valid ZetaChain address format
        // TODO: Check user has sufficient token balance before transfer

        // Transfer tokens from user to contract
        // TODO: Add slippage protection for token transfers
        // TODO: Validate transfer amount against user's token balance
        // TODO: Consider adding transfer fee handling for tokens with transfer fees
        let transfer_instruction = Transfer {
            from: ctx.accounts.user_token_account.to_account_info(),
            to: ctx.accounts.contract_token_account.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        };
        
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                transfer_instruction,
            ),
            amount,
        )?;

        // Create message for SimpleLendingProtocol.onCall()
        let message = create_supply_message(on_behalf_of)?;

        // Invoke gateway deposit_spl_token_and_call
        invoke_gateway_deposit_spl_token_and_call(
            &ctx.accounts.gateway_program.to_account_info(),
            &ctx.accounts.contract_token_account.to_account_info(),
            &ctx.accounts.mint.to_account_info(),
            amount,
            ctx.accounts.contract_state.lending_protocol_address,
            message,
        )?;

        emit!(DepositInitiated {
            user: ctx.accounts.user.key(),
            asset: ctx.accounts.mint.key(),
            amount,
            on_behalf_of,
        });

        Ok(())
    }

    /// Repay borrowed SOL to ZetaChain lending protocol
    pub fn repay_sol(
        ctx: Context<RepaySol>,
        amount: u64,
        on_behalf_of: [u8; 20],
    ) -> Result<()> {
        require!(!ctx.accounts.contract_state.is_paused, DepositContractError::ContractPaused);
        require!(amount > 0, DepositContractError::InvalidAmount);
        require!(amount >= DEPOSIT_FEE, DepositContractError::InsufficientDepositFee);

        // Create message for SimpleLendingProtocol.onCall()
        let message = create_repay_message(on_behalf_of)?;

        // Invoke gateway deposit_and_call with repay message
        invoke_gateway_deposit_and_call(
            &ctx.accounts.gateway_program.to_account_info(),
            &ctx.accounts.user.to_account_info(),
            &ctx.accounts.contract_state.to_account_info(),
            amount,
            ctx.accounts.contract_state.lending_protocol_address,
            message,
        )?;

        emit!(RepayInitiated {
            user: ctx.accounts.user.key(),
            asset: system_program::ID,
            amount,
            on_behalf_of,
        });

        Ok(())
    }

    /// Repay borrowed SPL tokens to ZetaChain lending protocol
    pub fn repay_spl_token(
        ctx: Context<RepaySplToken>,
        amount: u64,
        on_behalf_of: [u8; 20],
    ) -> Result<()> {
        require!(!ctx.accounts.contract_state.is_paused, DepositContractError::ContractPaused);
        require!(amount > 0, DepositContractError::InvalidAmount);
        require!(ctx.accounts.asset_config.is_supported, DepositContractError::UnsupportedAsset);
        require!(!ctx.accounts.asset_config.is_native, DepositContractError::UseRepaySol);

        // Transfer tokens from user to contract
        let transfer_instruction = Transfer {
            from: ctx.accounts.user_token_account.to_account_info(),
            to: ctx.accounts.contract_token_account.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        };
        
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                transfer_instruction,
            ),
            amount,
        )?;

        // Create message for SimpleLendingProtocol.onCall()
        let message = create_repay_message(on_behalf_of)?;

        // Invoke gateway deposit_spl_token_and_call
        invoke_gateway_deposit_spl_token_and_call(
            &ctx.accounts.gateway_program.to_account_info(),
            &ctx.accounts.contract_token_account.to_account_info(),
            &ctx.accounts.mint.to_account_info(),
            amount,
            ctx.accounts.contract_state.lending_protocol_address,
            message,
        )?;

        emit!(RepayInitiated {
            user: ctx.accounts.user.key(),
            asset: ctx.accounts.mint.key(),
            amount,
            on_behalf_of,
        });

        Ok(())
    }

    /// Trigger cross-chain borrow and withdrawal to external chain
    pub fn borrow_cross_chain(
        ctx: Context<BorrowCrossChain>,
        asset: [u8; 20], // ZRC-20 token address on ZetaChain
        amount: u64,
        destination_chain: u64,
        recipient: [u8; 20], // Address on destination chain
    ) -> Result<()> {
        require!(!ctx.accounts.contract_state.is_paused, DepositContractError::ContractPaused);
        require!(amount > 0, DepositContractError::InvalidAmount);

        // TODO: Validate asset is a supported ZRC-20 token address
        // TODO: Validate destination_chain is a supported chain ID
        // TODO: Validate recipient address format for destination chain
        // TODO: Add collateral checks - ensure user has sufficient collateral for borrow
        // TODO: Implement health factor validation before allowing borrow

        // Create message for SimpleLendingProtocol.onCall()
        let message = create_borrow_cross_chain_message(
            ctx.accounts.user.key().to_bytes(),
            amount,
            destination_chain,
            recipient,
        )?;

        // Invoke gateway call (no asset transfer, just message)
        invoke_gateway_call(
            &ctx.accounts.gateway_program.to_account_info(),
            &ctx.accounts.user.to_account_info(),
            ctx.accounts.contract_state.lending_protocol_address,
            message,
        )?;

        emit!(BorrowCrossChainInitiated {
            user: ctx.accounts.user.key(),
            asset,
            amount,
            destination_chain,
            recipient,
        });

        Ok(())
    }

    /// Trigger cross-chain withdrawal from ZetaChain to external chain
    pub fn withdraw_cross_chain(
        ctx: Context<WithdrawCrossChain>,
        asset: [u8; 20], // ZRC-20 token address on ZetaChain
        amount: u64,
        destination_chain: u64,
        recipient: [u8; 20],
    ) -> Result<()> {
        require!(!ctx.accounts.contract_state.is_paused, DepositContractError::ContractPaused);
        require!(amount > 0, DepositContractError::InvalidAmount);

        // Create message for SimpleLendingProtocol.onCall()
        let message = create_withdraw_cross_chain_message(
            ctx.accounts.user.key().to_bytes(),
            amount,
            destination_chain,
            recipient,
        )?;

        // Invoke gateway call
        invoke_gateway_call(
            &ctx.accounts.gateway_program.to_account_info(),
            &ctx.accounts.user.to_account_info(),
            ctx.accounts.contract_state.lending_protocol_address,
            message,
        )?;

        emit!(WithdrawCrossChainInitiated {
            user: ctx.accounts.user.key(),
            asset,
            amount,
            destination_chain,
            recipient,
        });

        Ok(())
    }

    /// Emergency pause functionality
    pub fn set_pause_state(ctx: Context<SetPauseState>, is_paused: bool) -> Result<()> {
        ctx.accounts.contract_state.is_paused = is_paused;

        emit!(PauseStateChanged { is_paused });

        Ok(())
    }
}

// Account Structures

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + ContractState::INIT_SPACE,
        seeds = [b"contract_state"],
        bump
    )]
    pub contract_state: Account<'info, ContractState>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(mint: Pubkey)]
pub struct AddSupportedAsset<'info> {
    #[account(
        has_one = authority @ DepositContractError::Unauthorized
    )]
    pub contract_state: Account<'info, ContractState>,
    
    #[account(
        init,
        payer = authority,
        space = 8 + AssetConfig::INIT_SPACE,
        seeds = [b"asset_config", mint.as_ref()],
        bump
    )]
    pub asset_config: Account<'info, AssetConfig>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RemoveSupportedAsset<'info> {
    #[account(
        has_one = authority @ DepositContractError::Unauthorized
    )]
    pub contract_state: Account<'info, ContractState>,
    
    #[account(
        mut,
        seeds = [b"asset_config", asset_config.mint.as_ref()],
        bump = asset_config.bump
    )]
    pub asset_config: Account<'info, AssetConfig>,
    
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct UpdateLendingProtocolAddress<'info> {
    #[account(
        mut,
        has_one = authority @ DepositContractError::Unauthorized
    )]
    pub contract_state: Account<'info, ContractState>,
    
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct DepositSol<'info> {
    #[account(
        seeds = [b"contract_state"],
        bump = contract_state.bump
    )]
    pub contract_state: Account<'info, ContractState>,
    
    #[account(mut)]
    pub user: Signer<'info>,
    
    /// CHECK: Gateway program account
    pub gateway_program: AccountInfo<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct DepositSplToken<'info> {
    #[account(
        seeds = [b"contract_state"],
        bump = contract_state.bump
    )]
    pub contract_state: Account<'info, ContractState>,
    
    #[account(
        seeds = [b"asset_config", mint.key().as_ref()],
        bump = asset_config.bump
    )]
    pub asset_config: Account<'info, AssetConfig>,
    
    #[account(mut)]
    pub user: Signer<'info>,
    
    pub mint: Account<'info, token::Mint>,
    
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = user
    )]
    pub user_token_account: Account<'info, TokenAccount>,
    
    #[account(
        init,
        payer = user,
        associated_token::mint = mint,
        associated_token::authority = contract_state
    )]
    pub contract_token_account: Account<'info, TokenAccount>,
    
    /// CHECK: Gateway program account
    pub gateway_program: AccountInfo<'info>,
    
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RepaySol<'info> {
    #[account(
        seeds = [b"contract_state"],
        bump = contract_state.bump
    )]
    pub contract_state: Account<'info, ContractState>,
    
    #[account(mut)]
    pub user: Signer<'info>,
    
    /// CHECK: Gateway program account
    pub gateway_program: AccountInfo<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RepaySplToken<'info> {
    #[account(
        seeds = [b"contract_state"],
        bump = contract_state.bump
    )]
    pub contract_state: Account<'info, ContractState>,
    
    #[account(
        seeds = [b"asset_config", mint.key().as_ref()],
        bump = asset_config.bump
    )]
    pub asset_config: Account<'info, AssetConfig>,
    
    #[account(mut)]
    pub user: Signer<'info>,
    
    pub mint: Account<'info, token::Mint>,
    
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = user
    )]
    pub user_token_account: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = contract_state
    )]
    pub contract_token_account: Account<'info, TokenAccount>,
    
    /// CHECK: Gateway program account
    pub gateway_program: AccountInfo<'info>,
    
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct BorrowCrossChain<'info> {
    #[account(
        seeds = [b"contract_state"],
        bump = contract_state.bump
    )]
    pub contract_state: Account<'info, ContractState>,
    
    #[account(mut)]
    pub user: Signer<'info>,
    
    /// CHECK: Gateway program account
    pub gateway_program: AccountInfo<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct WithdrawCrossChain<'info> {
    #[account(
        seeds = [b"contract_state"],
        bump = contract_state.bump
    )]
    pub contract_state: Account<'info, ContractState>,
    
    #[account(mut)]
    pub user: Signer<'info>,
    
    /// CHECK: Gateway program account
    pub gateway_program: AccountInfo<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetPauseState<'info> {
    #[account(
        mut,
        has_one = authority @ DepositContractError::Unauthorized
    )]
    pub contract_state: Account<'info, ContractState>,
    
    pub authority: Signer<'info>,
}

// State Accounts

#[account]
#[derive(InitSpace)]
pub struct ContractState {
    pub authority: Pubkey,
    pub lending_protocol_address: [u8; 20], // ZetaChain address
    pub zeta_chain_id: u64,
    pub is_paused: bool,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct AssetConfig {
    pub mint: Pubkey,
    pub decimals: u8,
    pub is_native: bool,
    pub is_supported: bool,
    pub bump: u8,
}

// Helper Functions

fn create_supply_message(on_behalf_of: [u8; 20]) -> Result<Vec<u8>> {
    // Create message compatible with SimpleLendingProtocol.onCall()
    // Must match EVM encoding: abi.encode("supply", onBehalfOf) padded to 128 bytes
    // This creates the exact same encoding as the EVM DepositContract
    
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

fn create_repay_message(on_behalf_of: [u8; 20]) -> Result<Vec<u8>> {
    // Create message compatible with SimpleLendingProtocol.onCall()
    // Must match EVM encoding: abi.encode("repay", onBehalfOf) padded to 128 bytes
    
    // Convert 20-byte address to 32-byte address (EVM format)
    let mut evm_address = [0u8; 32];
    evm_address[12..32].copy_from_slice(&on_behalf_of);
    
    // Manually create ABI-encoded message: abi.encode("repay", address)
    let mut message = Vec::with_capacity(128);
    
    // Offset for string "repay" (32 bytes)
    message.extend_from_slice(&[0u8; 28]); // Padding
    message.extend_from_slice(&64u32.to_be_bytes()); // Offset to string data
    
    // Address (32 bytes)
    message.extend_from_slice(&evm_address);
    
    // String length (32 bytes) - "repay" is 5 bytes
    message.extend_from_slice(&[0u8; 28]); // Padding
    message.extend_from_slice(&5u32.to_be_bytes()); // String length
    
    // String data "repay" (padded to 32 bytes)
    message.extend_from_slice(b"repay");
    message.extend_from_slice(&[0u8; 27]); // Padding to 32 bytes
    
    // Pad entire message to exactly 128 bytes
    message.resize(128, 0);
    
    Ok(message)
}

fn create_borrow_cross_chain_message(
    user: [u8; 32], // Solana pubkey is 32 bytes
    amount: u64,
    destination_chain: u64,
    recipient: [u8; 20],
) -> Result<Vec<u8>> {
    // Create message compatible with SimpleLendingProtocol.onCall()
    // Must match EVM encoding for dynamic message format used in cross-chain operations
    // Format: abi.encode("borrowCrossChain", user, amount, destinationChain, recipient)
    
    // TODO: Implement proper ABI encoding for cross-chain borrow messages
    // This needs to match the exact format expected by UniversalLendingProtocol.onCall()
    // Currently using simplified format - needs to be updated to match EVM ABI encoding
    let message = format!(
        "borrowCrossChain:{}:{}:{}:{}",
        hex::encode(user),
        amount,
        destination_chain,
        hex::encode(recipient)
    );
    Ok(message.into_bytes())
}

fn create_withdraw_cross_chain_message(
    user: [u8; 32],
    amount: u64,
    destination_chain: u64,
    recipient: [u8; 20],
) -> Result<Vec<u8>> {
    // Create message compatible with SimpleLendingProtocol.onCall()
    // Must match EVM encoding for dynamic message format used in cross-chain operations
    // Format: abi.encode("withdrawCrossChain", user, amount, destinationChain, recipient)
    
    // TODO: Implement proper ABI encoding for cross-chain withdraw messages
    // This needs to match the exact format expected by UniversalLendingProtocol.onCall()
    // Currently using simplified format - needs to be updated to match EVM ABI encoding
    let message = format!(
        "withdrawCrossChain:{}:{}:{}:{}",
        hex::encode(user),
        amount,
        destination_chain,
        hex::encode(recipient)
    );
    Ok(message.into_bytes())
}

// Gateway invocation functions - Proper CPI calls to ZetaChain Gateway
fn invoke_gateway_deposit_and_call(
    gateway_program: &AccountInfo,
    user: &AccountInfo,
    _contract_state: &AccountInfo,
    amount: u64,
    receiver: [u8; 20],
    message: Vec<u8>,
) -> Result<()> {
    // TODO: Implement proper CPI call to Gateway's deposit_and_call function
    // This needs to:
    // 1. Create RevertOptions with proper error handling
    // 2. Build instruction with correct accounts (gateway PDA, user, system program, etc.)
    // 3. Invoke the Gateway program with proper account metas
    // 4. Handle revert scenarios and error cases
    
    // Create revert options for cross-chain transaction safety
    let revert_options = Some(RevertOptions {
        revert_address: [0u8; 20], // TODO: Convert Solana address to EVM format
        call_on_revert: true,
        abort_address: [0u8; 20], // TODO: Set proper abort address
        revert_message: b"SOL deposit failed".to_vec(),
        on_revert_gas_limit: GAS_LIMIT,
    });
    
    // Placeholder implementation - replace with actual Gateway CPI
    msg!("Gateway deposit_and_call invoked: amount={}, receiver={:?}", amount, receiver);
    msg!("Message length: {}, revert_options configured", message.len());
    
    // TODO: Replace with actual CPI call:
    // let instruction = create_gateway_deposit_and_call_instruction(
    //     gateway_program.key(),
    //     user.key(),
    //     amount,
    //     receiver,
    //     message,
    //     revert_options,
    // )?;
    // invoke(&instruction, &[gateway_program, user, system_program])?;
    
    Ok(())
}

fn invoke_gateway_deposit_spl_token_and_call(
    gateway_program: &AccountInfo,
    token_account: &AccountInfo,
    mint: &AccountInfo,
    amount: u64,
    receiver: [u8; 20],
    message: Vec<u8>,
) -> Result<()> {
    // TODO: Implement proper CPI call to Gateway's deposit_spl_token_and_call function
    // This needs to:
    // 1. Create RevertOptions with proper error handling
    // 2. Build instruction with correct accounts (gateway PDA, user, token accounts, mint, etc.)
    // 3. Invoke the Gateway program with proper account metas for SPL token operations
    // 4. Handle token approval and transfer mechanics
    // 5. Handle revert scenarios and error cases
    
    // Create revert options for cross-chain transaction safety
    let revert_options = Some(RevertOptions {
        revert_address: [0u8; 20], // TODO: Convert Solana address to EVM format
        call_on_revert: true,
        abort_address: [0u8; 20], // TODO: Set proper abort address
        revert_message: b"SPL token deposit failed".to_vec(),
        on_revert_gas_limit: GAS_LIMIT,
    });
    
    // Placeholder implementation - replace with actual Gateway CPI
    msg!("Gateway deposit_spl_token_and_call invoked: amount={}, receiver={:?}", amount, receiver);
    msg!("Token account: {}, mint: {}", token_account.key(), mint.key());
    msg!("Message length: {}, revert_options configured", message.len());
    
    // TODO: Replace with actual CPI call:
    // let instruction = create_gateway_deposit_spl_token_and_call_instruction(
    //     gateway_program.key(),
    //     token_account.key(),
    //     mint.key(),
    //     amount,
    //     receiver,
    //     message,
    //     revert_options,
    // )?;
    // invoke(&instruction, &[gateway_program, token_account, mint, ...])?;
    
    Ok(())
}

fn invoke_gateway_call(
    gateway_program: &AccountInfo,
    user: &AccountInfo,
    receiver: [u8; 20],
    message: Vec<u8>,
) -> Result<()> {
    // TODO: Implement proper CPI call to Gateway's call function
    // This needs to:
    // 1. Create RevertOptions with proper error handling
    // 2. Build instruction with correct accounts (gateway PDA, user, system program, etc.)
    // 3. Invoke the Gateway program for message-only calls (no asset transfer)
    // 4. Handle revert scenarios and error cases
    
    // Create revert options for cross-chain transaction safety
    let revert_options = Some(RevertOptions {
        revert_address: [0u8; 20], // TODO: Convert Solana address to EVM format
        call_on_revert: true,
        abort_address: [0u8; 20], // TODO: Set proper abort address
        revert_message: b"Cross-chain call failed".to_vec(),
        on_revert_gas_limit: GAS_LIMIT,
    });
    
    // Placeholder implementation - replace with actual Gateway CPI
    msg!("Gateway call invoked: receiver={:?}", receiver);
    msg!("User: {}, message length: {}", user.key(), message.len());
    msg!("Revert options configured for cross-chain safety");
    
    // TODO: Replace with actual CPI call:
    // let instruction = create_gateway_call_instruction(
    //     gateway_program.key(),
    //     user.key(),
    //     receiver,
    //     message,
    //     revert_options,
    // )?;
    // invoke(&instruction, &[gateway_program, user, system_program])?;
    
    Ok(())
}

// Events

#[event]
pub struct ContractInitialized {
    pub authority: Pubkey,
    pub lending_protocol_address: [u8; 20],
    pub zeta_chain_id: u64,
}

#[event]
pub struct AssetAdded {
    pub mint: Pubkey,
    pub decimals: u8,
    pub is_native: bool,
}

#[event]
pub struct AssetRemoved {
    pub mint: Pubkey,
}

#[event]
pub struct LendingProtocolAddressUpdated {
    pub old_address: [u8; 20],
    pub new_address: [u8; 20],
    pub chain_id: u64,
}

#[event]
pub struct DepositInitiated {
    pub user: Pubkey,
    pub asset: Pubkey,
    pub amount: u64,
    pub on_behalf_of: [u8; 20],
}

#[event]
pub struct RepayInitiated {
    pub user: Pubkey,
    pub asset: Pubkey,
    pub amount: u64,
    pub on_behalf_of: [u8; 20],
}

#[event]
pub struct BorrowCrossChainInitiated {
    pub user: Pubkey,
    pub asset: [u8; 20],
    pub amount: u64,
    pub destination_chain: u64,
    pub recipient: [u8; 20],
}

#[event]
pub struct WithdrawCrossChainInitiated {
    pub user: Pubkey,
    pub asset: [u8; 20],
    pub amount: u64,
    pub destination_chain: u64,
    pub recipient: [u8; 20],
}

#[event]
pub struct PauseStateChanged {
    pub is_paused: bool,
}

// Errors

#[error_code]
pub enum DepositContractError {
    #[msg("Unauthorized access")]
    Unauthorized,
    #[msg("Invalid amount")]
    InvalidAmount,
    #[msg("Unsupported asset")]
    UnsupportedAsset,
    #[msg("Invalid chain ID")]
    InvalidChainId,
    #[msg("Deposit failed")]
    DepositFailed,
    #[msg("Contract is paused")]
    ContractPaused,
    #[msg("Use deposit_sol for native SOL")]
    UseDepositSol,
    #[msg("Use repay_sol for native SOL")]
    UseRepaySol,
    #[msg("Insufficient deposit fee")]
    InsufficientDepositFee,
}
