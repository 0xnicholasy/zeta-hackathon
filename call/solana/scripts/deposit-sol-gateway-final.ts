import * as anchor from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey, SystemProgram, TransactionInstruction } from "@solana/web3.js";
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

        if (balance < 0.05 * anchor.web3.LAMPORTS_PER_SOL) {
            throw new Error("Insufficient SOL balance for transaction (need at least 0.05 SOL including fees)");
        }

        // Get PDA (Program Derived Address)
        const [pda] = PublicKey.findProgramAddressSync(
            [Buffer.from("meta", "utf8")],
            GATEWAY_PROGRAM_ID
        );

        // Amount to deposit (0.01 SOL = 10,000,000 lamports) + 0.002 SOL fee
        const depositAmount = new anchor.BN(10_000_000); // 0.01 SOL
        const feeAmount = new anchor.BN(2_000_000);      // 0.002 SOL fee
        const totalAmount = depositAmount.add(feeAmount); // Total: 0.012 SOL

        console.log(`Depositing ${depositAmount.toNumber() / anchor.web3.LAMPORTS_PER_SOL} SOL + ${feeAmount.toNumber() / anchor.web3.LAMPORTS_PER_SOL} SOL fee`);
        console.log(`Total amount: ${totalAmount.toNumber() / anchor.web3.LAMPORTS_PER_SOL} SOL`);

        // Convert destination address to bytes (exactly 20 bytes)
        const destinationBuffer = Buffer.from(DESTINATION_ADDRESS.slice(2), "hex");
        if (destinationBuffer.length !== 20) {
            throw new Error(`Invalid destination address length: expected 20 bytes, got ${destinationBuffer.length}`);
        }

        console.log("Destination address:", DESTINATION_ADDRESS);
        console.log("Gateway PDA:", pda.toString());

        // Construct deposit instruction
        // Deposit discriminator: [242, 35, 198, 137, 82, 225, 242, 182]
        const discriminator = Buffer.from([242, 35, 198, 137, 82, 225, 242, 182]);
        
        // Serialize amount as u64 (8 bytes, little endian)
        const amountBuffer = Buffer.allocUnsafe(8);
        amountBuffer.writeUInt32LE(totalAmount.toNumber(), 0);
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
            revertOptionsBuffer   // 1 byte
        ]);

        // Create instruction
        const instruction = new TransactionInstruction({
            keys: [
                { pubkey: keypair.publicKey, isSigner: true, isWritable: true },   // signer
                { pubkey: pda, isSigner: false, isWritable: true },               // pda
                { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // system_program
            ],
            programId: GATEWAY_PROGRAM_ID,
            data: instructionData,
        });

        console.log("Sending cross-chain deposit transaction...");

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
        console.log(`Deposited ${depositAmount.toNumber() / anchor.web3.LAMPORTS_PER_SOL} SOL to ${DESTINATION_ADDRESS} on ZetaChain`);
        console.log(`Transaction URL: https://explorer.solana.com/tx/${signature}?cluster=devnet`);
        
    } catch (error) {
        console.error("❌ Error:", error);
    }
}

main().catch(console.error);