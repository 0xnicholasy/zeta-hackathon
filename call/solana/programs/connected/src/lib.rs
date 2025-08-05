use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};
use std::mem::size_of;

declare_id!("2g2QbdzV9raDR9k5PGwSyCRGxmNC7RXdvqQf4npjvxz4");

// NOTE: this is just example contract that can be called from gateway in execute function for testing withdraw and call
#[program]
pub mod connected {
    use super::*;

    pub fn initialize(_ctx: Context<Initialize>) -> Result<()> {
        Ok(())
    }

    pub fn on_call(
        ctx: Context<OnCall>,
        amount: u64,
        sender: [u8; 20],
        data: Vec<u8>,
    ) -> Result<()> {
        let pda = &mut ctx.accounts.pda;

        // Store the sender's public key
        pda.last_sender = sender;

        // Convert data to a string and store it
        let message = String::from_utf8(data).map_err(|_| ErrorCode::InvalidDataFormat)?;
        pda.last_message = message;

        if pda.last_message == "sol" {
            msg!(
                "On call sol executed with amount {}, sender {:?} and message {}",
                amount,
                pda.last_sender,
                pda.last_message
            );
        } else {
            msg!(
                "On call spl executed with amount {}, spl {:?}, sender {:?} and message {}",
                amount,
                ctx.accounts.mint_account,
                pda.last_sender,
                pda.last_message
            );
        }

        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(init, payer = signer, space = size_of::<Pda>() + 32, seeds = [b"connected"], bump)]
    pub pda: Account<'info, Pda>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct OnCall<'info> {
    #[account(mut, seeds = [b"connected"], bump)]
    pub pda: Account<'info, Pda>,

    #[account(mut)]
    pub pda_ata: Account<'info, TokenAccount>,

    pub mint_account: Account<'info, Mint>,

    /// CHECK: Test contract
    pub gateway_pda: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,

    pub system_program: Program<'info, System>,
}

#[account]
pub struct Pda {
    pub last_sender: [u8; 20],
    pub last_message: String,
}

#[error_code]
pub enum ErrorCode {
    #[msg("The data provided could not be converted to a valid UTF-8 string.")]
    InvalidDataFormat,
}
