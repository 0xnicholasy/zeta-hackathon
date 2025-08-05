import * as anchor from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey, SystemProgram, TransactionInstruction } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from "@solana/spl-token";
import fs from "fs";

// Gateway program ID on Solana devnet
const GATEWAY_PROGRAM_ID = new PublicKey(
    "ZETAjseVjuFsxdRxo6MmTCvqFwb3ZHUx56Co3vCmGis"
);
const DESTINATION_ADDRESS = "0xe1C5Bf97A7Ffb50988DeF972E1E242072298a59C";

async function main() {
    try {
        // Load default Solana CLI keypair
        const homedir = require('os').homedir();
        const keypairPath = `${homedir}/.config/solana/id.json`;
        
        if (!fs.existsSync(keypairPath)) {
            throw new Error(`Default Solana CLI keypair not found at ${keypairPath}. Please run 'solana-keygen new' to create one.`);
        }
        
        const keypairData = JSON.parse(
            fs.readFileSync(keypairPath, "utf8")
        );
        const keypair = Keypair.fromSecretKey(new Uint8Array(keypairData));

        console.log("Wallet address:", keypair.publicKey.toString());

        // Connect to Solana devnet
        const connection = new Connection(
            "https://api.devnet.solana.com",
            "confirmed"
        );

        // Check wallet balance
        const balance = await connection.getBalance(keypair.publicKey);
        console.log("Wallet SOL balance:", balance / anchor.web3.LAMPORTS_PER_SOL);

        if (balance < 0.01 * anchor.web3.LAMPORTS_PER_SOL) {
            throw new Error("Insufficient SOL balance for transaction fees");
        }

        // SPL Token setup (USDC devnet)
        const tokenMint = new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"); // USDC devnet
        const amount = new anchor.BN(1_000_000); // 1 USDC (6 decimals)

        // Get associated token accounts
        const userTokenAccount = await getAssociatedTokenAddress(tokenMint, keypair.publicKey);
        console.log("User token account:", userTokenAccount.toString());

        // Check token balance
        try {
            const tokenAccountInfo = await connection.getTokenAccountBalance(userTokenAccount);
            console.log("Token balance:", tokenAccountInfo.value.uiAmount);
            
            if (!tokenAccountInfo.value.uiAmount || tokenAccountInfo.value.uiAmount < 1) {
                throw new Error("Insufficient token balance for deposit (need at least 1 USDC)");
            }
        } catch (error) {
            throw new Error("Token account not found or no balance");
        }

        // Get PDAs
        const [pda] = PublicKey.findProgramAddressSync(
            [Buffer.from("meta", "utf8")],
            GATEWAY_PROGRAM_ID
        );

        const [whitelistEntry] = PublicKey.findProgramAddressSync(
            [Buffer.from("whitelist"), tokenMint.toBuffer()],
            GATEWAY_PROGRAM_ID
        );

        // Get gateway's token account (PDA's ATA)
        const gatewayTokenAccount = await getAssociatedTokenAddress(
            tokenMint,
            pda,
            true // Allow PDA as owner
        );

        console.log("Gateway PDA:", pda.toString());
        console.log("Whitelist Entry:", whitelistEntry.toString());
        console.log("Gateway Token Account:", gatewayTokenAccount.toString());
        console.log(`Depositing ${amount.toNumber() / 1_000_000} USDC`);

        // Convert destination address to bytes (exactly 20 bytes)
        const destinationBuffer = Buffer.from(DESTINATION_ADDRESS.slice(2), "hex");
        if (destinationBuffer.length !== 20) {
            throw new Error(`Invalid destination address length: expected 20 bytes, got ${destinationBuffer.length}`);
        }

        // Construct deposit_spl_token instruction
        // DepositSplToken discriminator: [86, 172, 212, 121, 63, 233, 96, 144]
        const discriminator = Buffer.from([86, 172, 212, 121, 63, 233, 96, 144]);
        
        // Serialize amount as u64 (8 bytes, little endian)
        const amountBuffer = Buffer.allocUnsafe(8);
        amountBuffer.writeUInt32LE(amount.toNumber(), 0);
        amountBuffer.writeUInt32LE(0, 4); // high 32 bits
        
        // Destination is 20 bytes (fixed array [u8; 20])
        const receiverBuffer = destinationBuffer;
        
        // RevertOptions as Option<RevertOptions> - None = 0x00
        const revertOptionsBuffer = Buffer.from([0x00]);
        
        // Combine instruction data
        const instructionData = Buffer.concat([
            discriminator,        // 8 bytes
            amountBuffer,         // 8 bytes  
            receiverBuffer,       // 20 bytes
            revertOptionsBuffer   // 1 byte (None option)
        ]);

        // Create instruction with all required accounts
        const instruction = new TransactionInstruction({
            keys: [
                { pubkey: keypair.publicKey, isSigner: true, isWritable: true },    // signer
                { pubkey: pda, isSigner: false, isWritable: false },               // pda
                { pubkey: whitelistEntry, isSigner: false, isWritable: false },    // whitelist_entry
                { pubkey: tokenMint, isSigner: false, isWritable: false },         // mint_account
                { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },  // token_program
                { pubkey: userTokenAccount, isSigner: false, isWritable: true },   // from
                { pubkey: gatewayTokenAccount, isSigner: false, isWritable: true }, // to
            ],
            programId: GATEWAY_PROGRAM_ID,
            data: instructionData,
        });

        // Check if whitelist entry exists before trying to deposit
        try {
            const whitelistAccount = await connection.getAccountInfo(whitelistEntry);
            if (!whitelistAccount || !whitelistAccount.owner.equals(GATEWAY_PROGRAM_ID)) {
                throw new Error("Token is not whitelisted for cross-chain deposits");
            }
            console.log("✅ Token is whitelisted");
        } catch (error) {
            console.log("❌ Token is not whitelisted for cross-chain deposits");
            console.log("💡 This token may need to be whitelisted by the gateway authority first");
            console.log("🔄 Try using the SOL deposit script instead: deposit-sol-gateway-final.ts");
            return;
        }

        console.log("Sending cross-chain SPL token deposit transaction...");

        // Send transaction
        const transaction = new anchor.web3.Transaction().add(instruction);
        const signature = await anchor.web3.sendAndConfirmTransaction(
            connection,
            transaction,
            [keypair],
            { commitment: 'confirmed' }
        );

        console.log("✅ Transaction successful!");
        console.log("Transaction signature:", signature);
        console.log(`Deposited ${amount.toNumber() / 1_000_000} USDC to ${DESTINATION_ADDRESS} on ZetaChain`);
        console.log(`Transaction URL: https://explorer.solana.com/tx/${signature}?cluster=devnet`);
        
    } catch (error) {
        console.error("❌ Error:", error);
    }
}

main().catch(console.error);