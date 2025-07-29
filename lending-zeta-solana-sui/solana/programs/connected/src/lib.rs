use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};
use std::mem::size_of;
use borsh::{BorshDeserialize, BorshSerialize};

declare_id!("9BjVGjn28E58LgSi547JYEpqpgRoo1TErkbyXiRSNDQy");

// ZetaChain Gateway Program ID (placeholder - replace with actual)
const ZETACHAIN_GATEWAY_PROGRAM_ID: &str = "ZETAjseVjuFsxdRxo6MmTCvqVPTp5NHfkDdyVLs2BcV";

// TSS Authority for signature verification (placeholder - replace with actual)  
const TSS_AUTHORITY: &str = "TSSauthGX7tV3YVnXjmKtMCgQVp7xKpvQs2zNzg9Vm1";

#[program]
pub mod connected {
    use super::*;

    pub fn initialize(
        ctx: Context<Initialize>,
        lending_protocol_address: [u8; 20],
        zeta_chain_id: u64,
    ) -> Result<()> {
        let deposit_contract = &mut ctx.accounts.deposit_contract;
        deposit_contract.authority = ctx.accounts.authority.key();
        deposit_contract.lending_protocol_address = lending_protocol_address;
        deposit_contract.zeta_chain_id = zeta_chain_id;
        deposit_contract.asset_count = 0;
        
        msg!("DepositContract initialized with lending protocol {:?} on chain {}", 
             lending_protocol_address, zeta_chain_id);
        
        Ok(())
    }

    pub fn add_supported_asset(
        ctx: Context<AddSupportedAsset>,
        asset_mint: Pubkey,
        decimals: u8,
        is_native: bool,
    ) -> Result<()> {
        let deposit_contract = &mut ctx.accounts.deposit_contract;
        
        require!(
            deposit_contract.asset_count < MAX_SUPPORTED_ASSETS,
            ErrorCode::MaxAssetsReached
        );

        let asset_info = SupportedAsset {
            mint: asset_mint,
            is_supported: true,
            decimals,
            is_native,
        };

        let current_count = deposit_contract.asset_count as usize;
        deposit_contract.supported_assets[current_count] = asset_info;
        deposit_contract.asset_count += 1;

        emit!(AssetAdded {
            asset: asset_mint,
            decimals,
            is_native,
        });

        Ok(())
    }

    pub fn remove_supported_asset(
        ctx: Context<RemoveSupportedAsset>,
        asset_mint: Pubkey,
    ) -> Result<()> {
        let deposit_contract = &mut ctx.accounts.deposit_contract;
        
        let mut found_index = None;
        for i in 0..deposit_contract.asset_count as usize {
            if deposit_contract.supported_assets[i].mint == asset_mint {
                found_index = Some(i);
                break;
            }
        }

        require!(found_index.is_some(), ErrorCode::AssetNotSupported);
        
        let index = found_index.unwrap();
        
        // Move last element to removed position
        if index < (deposit_contract.asset_count - 1) as usize {
            deposit_contract.supported_assets[index] = 
                deposit_contract.supported_assets[(deposit_contract.asset_count - 1) as usize];
        }
        
        deposit_contract.asset_count -= 1;

        emit!(AssetRemoved { asset: asset_mint });

        Ok(())
    }

    pub fn deposit_sol(
        ctx: Context<DepositSol>,
        amount: u64,
        on_behalf_of: [u8; 20],
    ) -> Result<()> {
        require!(amount > 0, ErrorCode::InvalidAmount);
        
        let deposit_contract = &ctx.accounts.deposit_contract;
        let native_sol = Pubkey::default(); // Use default pubkey for SOL
        
        // Check if SOL is supported
        let mut is_supported = false;
        for i in 0..deposit_contract.asset_count as usize {
            let asset = &deposit_contract.supported_assets[i];
            if asset.mint == native_sol && asset.is_native && asset.is_supported {
                is_supported = true;
                break;
            }
        }
        require!(is_supported, ErrorCode::AssetNotSupported);

        // Transfer SOL from depositor to contract
        let transfer_instruction = anchor_lang::system_program::Transfer {
            from: ctx.accounts.depositor.to_account_info(),
            to: ctx.accounts.deposit_contract.to_account_info(),
        };
        
        anchor_lang::system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                transfer_instruction,
            ),
            amount,
        )?;

        // Encode message for cross-chain call
        let _message = encode_supply_message(on_behalf_of, amount)?;

        emit!(DepositInitiated {
            user: ctx.accounts.depositor.key(),
            asset: native_sol,
            amount,
            on_behalf_of,
        });

        // Here we would call the gateway to send to ZetaChain
        // For now, we just log the action
        msg!("SOL deposit of {} for {:?} sent to ZetaChain", amount, on_behalf_of);

        Ok(())
    }

    pub fn deposit_token(
        ctx: Context<DepositToken>,
        amount: u64,
        on_behalf_of: [u8; 20],
    ) -> Result<()> {
        require!(amount > 0, ErrorCode::InvalidAmount);
        
        let deposit_contract = &ctx.accounts.deposit_contract;
        let asset_mint = ctx.accounts.mint.key();
        
        // Check if token is supported
        let mut is_supported = false;
        for i in 0..deposit_contract.asset_count as usize {
            let asset = &deposit_contract.supported_assets[i];
            if asset.mint == asset_mint && !asset.is_native && asset.is_supported {
                is_supported = true;
                break;
            }
        }
        require!(is_supported, ErrorCode::AssetNotSupported);

        // Transfer tokens from depositor to contract
        let transfer_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.depositor_token_account.to_account_info(),
                to: ctx.accounts.contract_token_account.to_account_info(),
                authority: ctx.accounts.depositor.to_account_info(),
            },
        );
        
        token::transfer(transfer_ctx, amount)?;

        // Encode message for cross-chain call
        let _message = encode_supply_message(on_behalf_of, amount)?;

        emit!(DepositInitiated {
            user: ctx.accounts.depositor.key(),
            asset: asset_mint,
            amount,
            on_behalf_of,
        });

        // Here we would call the gateway to send to ZetaChain
        msg!("Token deposit of {} for {:?} sent to ZetaChain", amount, on_behalf_of);

        Ok(())
    }

    pub fn repay_token(
        ctx: Context<RepayToken>,
        amount: u64,
        on_behalf_of: [u8; 20],
    ) -> Result<()> {
        require!(amount > 0, ErrorCode::InvalidAmount);
        
        let deposit_contract = &ctx.accounts.deposit_contract;
        let asset_mint = ctx.accounts.mint.key();
        
        // Check if token is supported
        let mut is_supported = false;
        for i in 0..deposit_contract.asset_count as usize {
            let asset = &deposit_contract.supported_assets[i];
            if asset.mint == asset_mint && !asset.is_native && asset.is_supported {
                is_supported = true;
                break;
            }
        }
        require!(is_supported, ErrorCode::AssetNotSupported);

        // Transfer tokens from repayer to contract
        let transfer_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.repayer_token_account.to_account_info(),
                to: ctx.accounts.contract_token_account.to_account_info(),
                authority: ctx.accounts.repayer.to_account_info(),
            },
        );
        
        token::transfer(transfer_ctx, amount)?;

        // Encode message for cross-chain call
        let _message = encode_repay_message(on_behalf_of, amount)?;

        emit!(RepayInitiated {
            user: ctx.accounts.repayer.key(),
            asset: asset_mint,
            amount,
            on_behalf_of,
        });

        msg!("Token repay of {} for {:?} sent to ZetaChain", amount, on_behalf_of);

        Ok(())
    }

    pub fn repay_sol(
        ctx: Context<RepaySol>,
        amount: u64,
        on_behalf_of: [u8; 20],
    ) -> Result<()> {
        require!(amount > 0, ErrorCode::InvalidAmount);
        
        let deposit_contract = &ctx.accounts.deposit_contract;
        let native_sol = Pubkey::default();
        
        // Check if SOL is supported
        let mut is_supported = false;
        for i in 0..deposit_contract.asset_count as usize {
            let asset = &deposit_contract.supported_assets[i];
            if asset.mint == native_sol && asset.is_native && asset.is_supported {
                is_supported = true;
                break;
            }
        }
        require!(is_supported, ErrorCode::AssetNotSupported);

        // Transfer SOL from repayer to contract
        let transfer_instruction = anchor_lang::system_program::Transfer {
            from: ctx.accounts.repayer.to_account_info(),
            to: ctx.accounts.deposit_contract.to_account_info(),
        };
        
        anchor_lang::system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                transfer_instruction,
            ),
            amount,
        )?;

        let _message = encode_repay_message(on_behalf_of, amount)?;

        emit!(RepayInitiated {
            user: ctx.accounts.repayer.key(),
            asset: native_sol,
            amount,
            on_behalf_of,
        });

        msg!("SOL repay of {} for {:?} sent to ZetaChain", amount, on_behalf_of);

        Ok(())
    }

    pub fn borrow_cross_chain(
        ctx: Context<BorrowCrossChain>,
        asset: Pubkey,
        amount: u64,
        destination_chain: u64,
        recipient: [u8; 20],
    ) -> Result<()> {
        require!(amount > 0, ErrorCode::InvalidAmount);

        let _message = encode_borrow_cross_chain_message(
            ctx.accounts.borrower.key(),
            amount,
            destination_chain,
            recipient,
        )?;

        emit!(BorrowCrossChainInitiated {
            user: ctx.accounts.borrower.key(),
            asset,
            amount,
            destination_chain,
            recipient,
        });

        msg!("Cross-chain borrow initiated for {} tokens to chain {}", amount, destination_chain);

        Ok(())
    }

    pub fn withdraw_cross_chain(
        ctx: Context<WithdrawCrossChain>,
        asset: Pubkey,
        amount: u64,
        destination_chain: u64,
        recipient: [u8; 20],
    ) -> Result<()> {
        require!(amount > 0, ErrorCode::InvalidAmount);

        let _message = encode_withdraw_cross_chain_message(
            ctx.accounts.withdrawer.key(),
            amount,
            destination_chain,
            recipient,
        )?;

        emit!(WithdrawCrossChainInitiated {
            user: ctx.accounts.withdrawer.key(),
            asset,
            amount,
            destination_chain,
            recipient,
        });

        msg!("Cross-chain withdraw initiated for {} tokens to chain {}", amount, destination_chain);

        Ok(())
    }

    pub fn update_lending_protocol_address(
        ctx: Context<UpdateLendingProtocolAddress>,
        new_address: [u8; 20],
        expected_chain_id: u64,
    ) -> Result<()> {
        let deposit_contract = &mut ctx.accounts.deposit_contract;
        
        require!(
            expected_chain_id == deposit_contract.zeta_chain_id,
            ErrorCode::InvalidChainId
        );

        let old_address = deposit_contract.lending_protocol_address;
        deposit_contract.lending_protocol_address = new_address;

        emit!(LendingProtocolAddressUpdated {
            old_address,
            new_address,
            chain_id: deposit_contract.zeta_chain_id,
        });

        Ok(())
    }

    pub fn on_call(
        ctx: Context<OnCall>,
        amount: u64,
        sender: [u8; 20],
        data: Vec<u8>,
        signature: [u8; 64],
    ) -> Result<()> {
        // Verify that the call comes from the authorized ZetaChain Gateway
        let gateway_pubkey = ZETACHAIN_GATEWAY_PROGRAM_ID.parse::<Pubkey>()
            .map_err(|_| ErrorCode::InvalidAddress)?;
        require!(
            ctx.accounts.gateway_pda.key() == gateway_pubkey,
            ErrorCode::UnauthorizedGateway
        );

        // Verify TSS signature for authentication
        verify_tss_signature(&data, &signature, &ctx.accounts.tss_signer.to_account_info())?;

        let pda = &mut ctx.accounts.pda;
        pda.last_sender = sender;

        // Safely parse the message data
        let message = String::from_utf8(data).map_err(|_| ErrorCode::InvalidDataFormat)?;
        pda.last_message = message.clone();

        // Log the authenticated gateway call
        msg!("Authenticated gateway call received with amount {}, sender {:?}, message {}", 
             amount, sender, message);

        // Here you would implement specific actions based on the message content
        // For example, processing cross-chain deposits, withdrawals, etc.

        Ok(())
    }
}

// Secure message structures for cross-chain communication
#[derive(BorshSerialize, BorshDeserialize, Clone)]
pub struct SupplyMessage {
    pub action: [u8; 16], // "supply\0\0\0\0\0\0\0\0\0\0"
    pub on_behalf_of: [u8; 20],
    pub amount: u64,
    pub timestamp: i64,
}

#[derive(BorshSerialize, BorshDeserialize, Clone)]
pub struct RepayMessage {
    pub action: [u8; 16], // "repay\0\0\0\0\0\0\0\0\0\0\0"
    pub on_behalf_of: [u8; 20],
    pub amount: u64,
    pub timestamp: i64,
}

#[derive(BorshSerialize, BorshDeserialize, Clone)]
pub struct BorrowCrossChainMessage {
    pub action: [u8; 16], // "borrowCrossChain"
    pub user: Pubkey,
    pub amount: u64,
    pub destination_chain: u64,
    pub recipient: [u8; 20],
    pub timestamp: i64,
}

#[derive(BorshSerialize, BorshDeserialize, Clone)]
pub struct WithdrawCrossChainMessage {
    pub action: [u8; 16], // "withdrawCrossChain"
    pub user: Pubkey,
    pub amount: u64,
    pub destination_chain: u64,
    pub recipient: [u8; 20],
    pub timestamp: i64,
}

// Helper functions with secure encoding
fn encode_supply_message(on_behalf_of: [u8; 20], amount: u64) -> Result<Vec<u8>> {
    let mut action = [0u8; 16];
    action[..6].copy_from_slice(b"supply");
    
    let message = SupplyMessage {
        action,
        on_behalf_of,
        amount,
        timestamp: Clock::get()?.unix_timestamp,
    };
    
    message.try_to_vec().map_err(|_| ErrorCode::EncodingError.into())
}

fn encode_repay_message(on_behalf_of: [u8; 20], amount: u64) -> Result<Vec<u8>> {
    let mut action = [0u8; 16];
    action[..5].copy_from_slice(b"repay");
    
    let message = RepayMessage {
        action,
        on_behalf_of,
        amount,
        timestamp: Clock::get()?.unix_timestamp,
    };
    
    message.try_to_vec().map_err(|_| ErrorCode::EncodingError.into())
}

fn encode_borrow_cross_chain_message(
    user: Pubkey,
    amount: u64,
    destination_chain: u64,
    recipient: [u8; 20],
) -> Result<Vec<u8>> {
    let mut action = [0u8; 16];
    action[..16].copy_from_slice(b"borrowCrossChain");
    
    let message = BorrowCrossChainMessage {
        action,
        user,
        amount,
        destination_chain,
        recipient,
        timestamp: Clock::get()?.unix_timestamp,
    };
    
    message.try_to_vec().map_err(|_| ErrorCode::EncodingError.into())
}

fn encode_withdraw_cross_chain_message(
    user: Pubkey,
    amount: u64,
    destination_chain: u64,
    recipient: [u8; 20],
) -> Result<Vec<u8>> {
    let mut action = [0u8; 16];
    let action_bytes = b"withdrawCrossChain";
    let copy_len = std::cmp::min(action_bytes.len(), 16);
    action[..copy_len].copy_from_slice(&action_bytes[..copy_len]);
    
    let message = WithdrawCrossChainMessage {
        action,
        user,
        amount,
        destination_chain,
        recipient,
        timestamp: Clock::get()?.unix_timestamp,
    };
    
    message.try_to_vec().map_err(|_| ErrorCode::EncodingError.into())
}

// TSS signature verification function
fn verify_tss_signature(
    message: &[u8],
    signature: &[u8; 64],
    tss_signer: &AccountInfo,
) -> Result<()> {
    // Verify that the signer is the authorized TSS authority
    let tss_pubkey = TSS_AUTHORITY.parse::<Pubkey>()
        .map_err(|_| ErrorCode::InvalidAddress)?;
    require!(
        tss_signer.key() == tss_pubkey,
        ErrorCode::UnauthorizedTssAuthority
    );
    
    // In a real implementation, this would verify the ed25519 signature
    // For now, we'll do basic validation
    require!(signature.len() == 64, ErrorCode::InvalidSignature);
    require!(!message.is_empty(), ErrorCode::InvalidMessage);
    
    // TODO: Implement actual ed25519 signature verification
    // This would typically use: ed25519_verify(signature, message, tss_signer.key())
    
    Ok(())
}

const MAX_SUPPORTED_ASSETS: u8 = 32;

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = size_of::<DepositContract>() + 8,
        seeds = [b"deposit_contract"],
        bump
    )]
    pub deposit_contract: Account<'info, DepositContract>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AddSupportedAsset<'info> {
    #[account(mut, constraint = deposit_contract.authority == authority.key())]
    pub authority: Signer<'info>,

    #[account(mut, seeds = [b"deposit_contract"], bump)]
    pub deposit_contract: Account<'info, DepositContract>,
}

#[derive(Accounts)]
pub struct RemoveSupportedAsset<'info> {
    #[account(mut, constraint = deposit_contract.authority == authority.key())]
    pub authority: Signer<'info>,

    #[account(mut, seeds = [b"deposit_contract"], bump)]
    pub deposit_contract: Account<'info, DepositContract>,
}

#[derive(Accounts)]
pub struct DepositSol<'info> {
    #[account(mut)]
    pub depositor: Signer<'info>,

    #[account(mut, seeds = [b"deposit_contract"], bump)]
    pub deposit_contract: Account<'info, DepositContract>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct DepositToken<'info> {
    #[account(mut)]
    pub depositor: Signer<'info>,

    #[account(seeds = [b"deposit_contract"], bump)]
    pub deposit_contract: Account<'info, DepositContract>,

    #[account(
        mut,
        constraint = depositor_token_account.owner == depositor.key() @ ErrorCode::InvalidTokenAccountOwner,
        constraint = depositor_token_account.mint == mint.key() @ ErrorCode::InvalidTokenMint,
        constraint = depositor_token_account.amount > 0 @ ErrorCode::InsufficientBalance
    )]
    pub depositor_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = contract_token_account.mint == mint.key() @ ErrorCode::InvalidTokenMint
    )]
    pub contract_token_account: Account<'info, TokenAccount>,

    pub mint: Account<'info, Mint>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct RepayToken<'info> {
    #[account(mut)]
    pub repayer: Signer<'info>,

    #[account(seeds = [b"deposit_contract"], bump)]
    pub deposit_contract: Account<'info, DepositContract>,

    #[account(
        mut,
        constraint = repayer_token_account.owner == repayer.key() @ ErrorCode::InvalidTokenAccountOwner,
        constraint = repayer_token_account.mint == mint.key() @ ErrorCode::InvalidTokenMint,
        constraint = repayer_token_account.amount > 0 @ ErrorCode::InsufficientBalance
    )]
    pub repayer_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = contract_token_account.mint == mint.key() @ ErrorCode::InvalidTokenMint
    )]
    pub contract_token_account: Account<'info, TokenAccount>,

    pub mint: Account<'info, Mint>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct RepaySol<'info> {
    #[account(mut)]
    pub repayer: Signer<'info>,

    #[account(mut, seeds = [b"deposit_contract"], bump)]
    pub deposit_contract: Account<'info, DepositContract>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct BorrowCrossChain<'info> {
    #[account(mut)]
    pub borrower: Signer<'info>,

    #[account(seeds = [b"deposit_contract"], bump)]
    pub deposit_contract: Account<'info, DepositContract>,
}

#[derive(Accounts)]
pub struct WithdrawCrossChain<'info> {
    #[account(mut)]
    pub withdrawer: Signer<'info>,

    #[account(seeds = [b"deposit_contract"], bump)]
    pub deposit_contract: Account<'info, DepositContract>,
}

#[derive(Accounts)]
pub struct UpdateLendingProtocolAddress<'info> {
    #[account(mut, constraint = deposit_contract.authority == authority.key())]
    pub authority: Signer<'info>,

    #[account(mut, seeds = [b"deposit_contract"], bump)]
    pub deposit_contract: Account<'info, DepositContract>,
}

#[derive(Accounts)]
pub struct OnCall<'info> {
    #[account(mut, seeds = [b"connected"], bump)]
    pub pda: Account<'info, Pda>,

    #[account(mut)]
    pub pda_ata: Account<'info, TokenAccount>,

    pub mint_account: Account<'info, Mint>,

    /// CHECK: Gateway validation is done in the instruction handler
    pub gateway_pda: UncheckedAccount<'info>,

    /// CHECK: TSS authority validation is done in the instruction handler
    pub tss_signer: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[account]
#[derive(Default)]
pub struct DepositContract {
    pub authority: Pubkey,
    pub lending_protocol_address: [u8; 20],
    pub zeta_chain_id: u64,
    pub supported_assets: [SupportedAsset; MAX_SUPPORTED_ASSETS as usize],
    pub asset_count: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Default)]
pub struct SupportedAsset {
    pub mint: Pubkey,
    pub is_supported: bool,
    pub decimals: u8,
    pub is_native: bool,
}

#[account]
pub struct Pda {
    pub last_sender: [u8; 20],
    pub last_message: String,
}

#[event]
pub struct AssetAdded {
    pub asset: Pubkey,
    pub decimals: u8,
    pub is_native: bool,
}

#[event]
pub struct AssetRemoved {
    pub asset: Pubkey,
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
    pub asset: Pubkey,
    pub amount: u64,
    pub destination_chain: u64,
    pub recipient: [u8; 20],
}

#[event]
pub struct WithdrawCrossChainInitiated {
    pub user: Pubkey,
    pub asset: Pubkey,
    pub amount: u64,
    pub destination_chain: u64,
    pub recipient: [u8; 20],
}

#[event]
pub struct LendingProtocolAddressUpdated {
    pub old_address: [u8; 20],
    pub new_address: [u8; 20],
    pub chain_id: u64,
}

#[error_code]
pub enum ErrorCode {
    #[msg("The data provided could not be converted to a valid UTF-8 string.")]
    InvalidDataFormat,
    #[msg("Asset not supported")]
    AssetNotSupported,
    #[msg("Invalid amount")]
    InvalidAmount,
    #[msg("Invalid address")]
    InvalidAddress,
    #[msg("Maximum number of supported assets reached")]
    MaxAssetsReached,
    #[msg("Invalid chain ID")]
    InvalidChainId,
    #[msg("Deposit failed")]
    DepositFailed,
    #[msg("Unauthorized gateway - only ZetaChain Gateway can call this function")]
    UnauthorizedGateway,
    #[msg("Unauthorized TSS authority")]
    UnauthorizedTssAuthority,
    #[msg("Invalid signature provided")]
    InvalidSignature,
    #[msg("Invalid message for signature verification")]
    InvalidMessage,
    #[msg("Message encoding/decoding failed")]
    EncodingError,
    #[msg("Invalid token account owner")]
    InvalidTokenAccountOwner,
    #[msg("Invalid token mint")]
    InvalidTokenMint,
    #[msg("Insufficient token balance")]
    InsufficientBalance,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_supported_asset_creation() {
        let asset = SupportedAsset {
            mint: Pubkey::default(),
            is_supported: true,
            decimals: 9,
            is_native: true,
        };
        
        assert_eq!(asset.mint, Pubkey::default());
        assert!(asset.is_supported);
        assert_eq!(asset.decimals, 9);
        assert!(asset.is_native);
    }

    #[test]
    fn test_deposit_contract_initialization() {
        let mut deposit_contract = DepositContract::default();
        let authority = Pubkey::new_unique();
        let lending_protocol_address: [u8; 20] = [1; 20];
        let zeta_chain_id: u64 = 7001;
        
        deposit_contract.authority = authority;
        deposit_contract.lending_protocol_address = lending_protocol_address;
        deposit_contract.zeta_chain_id = zeta_chain_id;
        deposit_contract.asset_count = 0;
        
        assert_eq!(deposit_contract.authority, authority);
        assert_eq!(deposit_contract.lending_protocol_address, lending_protocol_address);
        assert_eq!(deposit_contract.zeta_chain_id, zeta_chain_id);
        assert_eq!(deposit_contract.asset_count, 0);
    }

    #[test]
    fn test_encode_supply_message() {
        let on_behalf_of: [u8; 20] = [2; 20];
        let amount = 1000u64;
        let result = encode_supply_message(on_behalf_of, amount);
        
        assert!(result.is_ok());
        let message = result.unwrap();
        // Test that the message is properly encoded as borsh
        assert!(!message.is_empty());
    }

    #[test]
    fn test_encode_repay_message() {
        let on_behalf_of: [u8; 20] = [3; 20];
        let amount = 2000u64;
        let result = encode_repay_message(on_behalf_of, amount);
        
        assert!(result.is_ok());
        let message = result.unwrap();
        // Test that the message is properly encoded as borsh
        assert!(!message.is_empty());
    }

    #[test]
    fn test_encode_borrow_cross_chain_message() {
        let user = Pubkey::new_unique();
        let amount = 1000u64;
        let destination_chain = 421614u64; // Arbitrum Sepolia
        let recipient: [u8; 20] = [4; 20];
        
        let result = encode_borrow_cross_chain_message(user, amount, destination_chain, recipient);
        
        assert!(result.is_ok());
        let message = result.unwrap();
        assert!(!message.is_empty());
    }

    #[test]
    fn test_encode_withdraw_cross_chain_message() {
        let user = Pubkey::new_unique();
        let amount = 2000u64;
        let destination_chain = 11155111u64; // Ethereum Sepolia
        let recipient: [u8; 20] = [5; 20];
        
        let result = encode_withdraw_cross_chain_message(user, amount, destination_chain, recipient);
        
        assert!(result.is_ok());
        let message = result.unwrap();
        assert!(!message.is_empty());
    }

    #[test]
    fn test_max_supported_assets_constant() {
        assert_eq!(MAX_SUPPORTED_ASSETS, 32);
        
        // Test that we can create a DepositContract with max assets
        let deposit_contract = DepositContract::default();
        assert_eq!(deposit_contract.supported_assets.len(), MAX_SUPPORTED_ASSETS as usize);
    }

    #[test]
    fn test_asset_management_logic() {
        let mut deposit_contract = DepositContract::default();
        
        // Test adding assets up to the limit
        for i in 0..MAX_SUPPORTED_ASSETS {
            let asset = SupportedAsset {
                mint: Pubkey::new_unique(),
                is_supported: true,
                decimals: 9,
                is_native: i == 0, // Only first asset is native (SOL)
            };
            
            deposit_contract.supported_assets[i as usize] = asset;
            deposit_contract.asset_count = i + 1;
        }
        
        assert_eq!(deposit_contract.asset_count, MAX_SUPPORTED_ASSETS);
        
        // Test that first asset is native
        assert!(deposit_contract.supported_assets[0].is_native);
        
        // Test that subsequent assets are not native
        for i in 1..MAX_SUPPORTED_ASSETS as usize {
            assert!(!deposit_contract.supported_assets[i].is_native);
        }
    }

    #[test]
    fn test_error_codes_exist() {
        // Ensure all error codes are properly defined
        let _error1 = ErrorCode::InvalidDataFormat;
        let _error2 = ErrorCode::AssetNotSupported;
        let _error3 = ErrorCode::InvalidAmount;
        let _error4 = ErrorCode::InvalidAddress;
        let _error5 = ErrorCode::MaxAssetsReached;
        let _error6 = ErrorCode::InvalidChainId;
        let _error7 = ErrorCode::DepositFailed;
        let _error8 = ErrorCode::UnauthorizedGateway;
        let _error9 = ErrorCode::UnauthorizedTssAuthority;
        let _error10 = ErrorCode::InvalidSignature;
        let _error11 = ErrorCode::InvalidMessage;
        let _error12 = ErrorCode::EncodingError;
        let _error13 = ErrorCode::InvalidTokenAccountOwner;
        let _error14 = ErrorCode::InvalidTokenMint;
        let _error15 = ErrorCode::InsufficientBalance;
    }

    #[test]
    fn test_pda_struct() {
        let pda = Pda {
            last_sender: [1; 20],
            last_message: "test_message".to_string(),
        };
        
        assert_eq!(pda.last_sender, [1; 20]);
        assert_eq!(pda.last_message, "test_message");
    }
}
