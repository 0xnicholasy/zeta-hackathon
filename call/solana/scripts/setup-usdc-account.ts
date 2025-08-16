import * as anchor from "@coral-xyz/anchor";
import { Connection, Keypair } from "@solana/web3.js";
import { createAssociatedTokenAccountInstruction, getAssociatedTokenAddress } from "@solana/spl-token";
import fs from "fs";
import { config } from "./config";

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

        // Get configuration values
        const solanaConfig = config.getSolanaConfig();
        const usdcConfig = config.getUSDCConfig();
        const usdcMint = config.getTokenMint("usdc")!;
        
        // Connect to Solana network
        const connection = new Connection(
            solanaConfig.rpcUrl,
            solanaConfig.commitment as anchor.web3.Commitment
        );

        console.log("Network:", config.getNetwork());

        // Check wallet balance
        const balance = await connection.getBalance(keypair.publicKey);
        console.log("Wallet SOL balance:", balance / anchor.web3.LAMPORTS_PER_SOL);

        if (balance < 0.01 * anchor.web3.LAMPORTS_PER_SOL) {
            throw new Error("Insufficient SOL balance for transaction fees (need at least 0.01 SOL)");
        }

        // Get associated token account address
        const userTokenAccount = await getAssociatedTokenAddress(usdcMint, keypair.publicKey);
        console.log(`${usdcConfig.symbol} token account address:`, userTokenAccount.toString());

        // Check if token account already exists
        try {
            const accountInfo = await connection.getAccountInfo(userTokenAccount);
            if (accountInfo) {
                console.log(`✅ ${usdcConfig.symbol} token account already exists!`);
                
                // Check balance
                const tokenBalance = await connection.getTokenAccountBalance(userTokenAccount);
                console.log(`Current ${usdcConfig.symbol} balance:`, tokenBalance.value.uiAmount || 0);
                
                if (tokenBalance.value.uiAmount && tokenBalance.value.uiAmount > 0) {
                    console.log(`✅ You already have ${usdcConfig.symbol} tokens!`);
                    console.log("🚀 You can now run the deposit script: bun run solana/scripts/deposit-spl-gateway-final.ts");
                } else {
                    console.log(`💡 Token account exists but no balance. Get ${usdcConfig.symbol} from:`);
                    console.log(`   - A Solana ${config.getNetwork()} faucet`);
                    console.log("   - A DEX like Jupiter or Raydium");
                    console.log(`   - Ask someone to send you some test ${usdcConfig.symbol}`);
                }
                return;
            }
        } catch (error) {
            console.log("Token account doesn't exist, creating it...");
        }

        // Create associated token account
        const createAccountInstruction = createAssociatedTokenAccountInstruction(
            keypair.publicKey,    // payer
            userTokenAccount,     // ata
            keypair.publicKey,    // owner
            usdcMint             // mint
        );

        console.log(`Creating ${usdcConfig.symbol} token account...`);

        const transaction = new anchor.web3.Transaction().add(createAccountInstruction);
        const signature = await anchor.web3.sendAndConfirmTransaction(
            connection,
            transaction,
            [keypair],
            { commitment: 'confirmed' }
        );

        console.log(`✅ ${usdcConfig.symbol} token account created successfully!`);
        console.log("Transaction signature:", signature);
        console.log("Token account address:", userTokenAccount.toString());
        console.log("");
        console.log("📝 Next steps:");
        console.log(`1. Get ${usdcConfig.symbol} tokens from a faucet or DEX`);
        console.log("2. Run: bun run solana/scripts/deposit-spl-gateway-final.ts");
        console.log("");
        console.log(`💡 To get ${usdcConfig.symbol} on ${config.getNetwork()}:`);
        console.log(`   - Try Solana faucets that offer ${usdcConfig.symbol}`);
        console.log(`   - Use a ${config.getNetwork()} DEX to swap SOL for ${usdcConfig.symbol}`);
        console.log(`   - ${usdcConfig.symbol} mint address: ${usdcMint.toString()}`);

    } catch (error) {
        console.error("❌ Error:", error);
    }
}

main().catch(console.error);