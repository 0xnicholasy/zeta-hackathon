import * as anchor from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey, SystemProgram, TransactionInstruction } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from "@solana/spl-token";
import { AbiCoder } from "ethers";
import { createHash } from "crypto";
import fs from "fs";
import { config } from "./config";

// Configuration-based constants
const ON_BEHALF_OF = "0xe1C5Bf97A7Ffb50988DeF972E1E242072298a59C";

// Function to calculate Anchor discriminator for deposit_spl_token_and_call
function calculateDiscriminator(functionName: string): Buffer {
    const hash = createHash('sha256').update(`global:${functionName}`).digest();
    return hash.subarray(0, 8);
}

// Function to encode message for UniversalLendingProtocol.onCall()
function encodeSupplyMessage(onBehalfOf: string): Buffer {
    // ABI encode ("supply", onBehalfOf) - matches Solidity abi.encode("supply", onBehalfOf)
    const abiCoder = new AbiCoder();
    const encoded = abiCoder.encode(["string", "address"], ["supply", onBehalfOf]);
    
    // Convert hex string to buffer - this should be exactly what abi.decode expects
    const encodedBuffer = Buffer.from(encoded.slice(2), "hex");
    
    // The contract expects exactly 128 bytes, but abi.encode already creates the correct format
    // Let's verify the length and pad with zeros if needed, but preserve the ABI structure
    console.log("ABI encoded length:", encodedBuffer.length);
    
    if (encodedBuffer.length === 128) {
        // Perfect, already 128 bytes
        return encodedBuffer;
    } else if (encodedBuffer.length < 128) {
        // Pad with zeros at the end to reach 128 bytes
        const padding = Buffer.alloc(128 - encodedBuffer.length, 0);
        return Buffer.concat([encodedBuffer, padding]);
    } else {
        // This shouldn't happen with (string, address) encoding, but handle it
        throw new Error(`ABI encoded message too long: ${encodedBuffer.length} bytes, expected max 128`);
    }
}

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
        const gatewayProgramId = config.getGatewayProgramId();
        const destinationAddress = config.getUniversalLendingProtocolAddress();
        const transactionConfig = config.getTransactionConfig();
        const usdcConfig = config.getUSDCConfig();
        
        // Connect to Solana network
        const connection = new Connection(
            solanaConfig.rpcUrl,
            solanaConfig.commitment as anchor.web3.Commitment
        );

        // Check wallet balance
        const balance = await connection.getBalance(keypair.publicKey);
        console.log("Wallet SOL balance:", balance / anchor.web3.LAMPORTS_PER_SOL);
        console.log("Network:", config.getNetwork());

        const minBalanceForFees = 0.01 * anchor.web3.LAMPORTS_PER_SOL;
        if (balance < minBalanceForFees) {
            throw new Error("Insufficient SOL balance for transaction fees");
        }

        // SPL Token setup from configuration
        const tokenMint = config.getTokenMint("usdc")!;
        const depositAmountDecimal = transactionConfig.usdcDepositAmount;
        const amount = new anchor.BN(depositAmountDecimal * Math.pow(10, usdcConfig.decimals));

        // Get associated token accounts
        const userTokenAccount = await getAssociatedTokenAddress(tokenMint, keypair.publicKey);
        console.log("User token account:", userTokenAccount.toString());

        // Check token balance
        try {
            const tokenAccountInfo = await connection.getTokenAccountBalance(userTokenAccount);
            console.log("Token balance:", tokenAccountInfo.value.uiAmount);
            
            if (!tokenAccountInfo.value.uiAmount || tokenAccountInfo.value.uiAmount < depositAmountDecimal) {
                console.log(`❌ Insufficient ${usdcConfig.symbol} balance. You need at least ${depositAmountDecimal} ${usdcConfig.symbol} to test this script.`);
                console.log(`💡 To get ${usdcConfig.symbol} on Solana ${config.getNetwork()}:`);
                console.log("   1. Go to https://faucet.solana.com/ and get some SOL");
                console.log("   2. Use a faucet or DEX to get USDC tokens");
                console.log("   3. Or modify the script to use a smaller amount if you have some USDC");
                console.log(`🔧 Your current balance: ${tokenAccountInfo.value.uiAmount || 0} ${usdcConfig.symbol}`);
                return;
            }
        } catch (error) {
            console.log(`❌ ${usdcConfig.symbol} token account not found.`);
            console.log(`💡 To create a ${usdcConfig.symbol} token account and get tokens:`);
            console.log("   1. Install spl-token CLI: npm install -g @solana/spl-token");
            console.log(`   2. Create token account: spl-token create-account ${tokenMint.toString()} --url ${config.getNetwork()}`);
            console.log("   3. Get USDC from a faucet or DEX");
            console.log(`   4. Token mint address: ${tokenMint.toString()}`);
            return;
        }

        // Get PDAs
        const pda = config.getGatewayPDA();

        const [whitelistEntry] = PublicKey.findProgramAddressSync(
            [Buffer.from("whitelist"), tokenMint.toBuffer()],
            gatewayProgramId
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
        console.log(`Depositing ${depositAmountDecimal} ${usdcConfig.symbol}`);

        // Convert destination address to bytes (exactly 20 bytes)
        const destinationBuffer = Buffer.from(destinationAddress.slice(2), "hex");
        if (destinationBuffer.length !== 20) {
            throw new Error(`Invalid destination address length: expected 20 bytes, got ${destinationBuffer.length}`);
        }

        console.log("Destination address:", destinationAddress);
        console.log("On behalf of:", ON_BEHALF_OF);

        // Encode message for lending protocol onCall function
        const message = encodeSupplyMessage(ON_BEHALF_OF);
        console.log("Message length:", message.length, "bytes");

        // Construct deposit_spl_token_and_call instruction
        // Calculate deposit_spl_token_and_call discriminator
        const discriminator = calculateDiscriminator("deposit_spl_token_and_call");
        
        // Serialize amount as u64 (8 bytes, little endian)
        const amountBuffer = Buffer.allocUnsafe(8);
        amountBuffer.writeUInt32LE(amount.toNumber(), 0);
        amountBuffer.writeUInt32LE(0, 4); // high 32 bits
        
        // Destination is 20 bytes (fixed array [u8; 20])
        const receiverBuffer = destinationBuffer;
        
        // Message as Vec<u8> (length prefix + data)
        const messageLengthBuffer = Buffer.allocUnsafe(4);
        messageLengthBuffer.writeUInt32LE(message.length, 0);
        const messageBuffer = Buffer.concat([messageLengthBuffer, message]);
        
        // RevertOptions as Option<RevertOptions> - None = 0x00
        const revertOptionsBuffer = Buffer.from([0x00]);
        
        // Combine instruction data for deposit_spl_token_and_call
        const instructionData = Buffer.concat([
            discriminator,        // 8 bytes
            amountBuffer,         // 8 bytes  
            receiverBuffer,       // 20 bytes
            messageBuffer,        // 4 bytes length + 128 bytes message = 132 bytes
            revertOptionsBuffer   // 1 byte
        ]);
        
        console.log("Discriminator:", discriminator.toString('hex'));
        console.log("Total instruction data length:", instructionData.length, "bytes");

        // Create instruction with all required accounts for deposit_spl_token_and_call
        const instruction = new TransactionInstruction({
            keys: [
                { pubkey: keypair.publicKey, isSigner: true, isWritable: true },    // signer
                { pubkey: pda, isSigner: false, isWritable: true },               // pda (writable for deposit_and_call)
                { pubkey: whitelistEntry, isSigner: false, isWritable: false },    // whitelist_entry
                { pubkey: tokenMint, isSigner: false, isWritable: false },         // mint_account
                { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },  // token_program
                { pubkey: userTokenAccount, isSigner: false, isWritable: true },   // from
                { pubkey: gatewayTokenAccount, isSigner: false, isWritable: true }, // to
                { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // system_program (required for deposit_and_call)
            ],
            programId: gatewayProgramId,
            data: instructionData,
        });

        // Check if whitelist entry exists before trying to deposit
        console.log("🔍 Checking if token is whitelisted...");
        try {
            const whitelistAccount = await connection.getAccountInfo(whitelistEntry);
            console.log("Whitelist entry account info:", {
                exists: !!whitelistAccount,
                owner: whitelistAccount?.owner.toString(),
                expectedOwner: gatewayProgramId.toString(),
                lamports: whitelistAccount?.lamports
            });
            
            if (!whitelistAccount) {
                console.log("❌ Whitelist entry account does not exist");
                console.log(`   Whitelist address: ${whitelistEntry.toString()}`);
                console.log("💡 This means the token is not supported for cross-chain deposits");
                console.log("🔄 Try using the SOL deposit script instead: deposit-sol-gateway-final.ts");
                return;
            }
            
            if (!whitelistAccount.owner.equals(gatewayProgramId)) {
                console.log("❌ Whitelist entry exists but is not owned by gateway program");
                console.log(`   Current owner: ${whitelistAccount.owner.toString()}`);
                console.log(`   Expected owner: ${gatewayProgramId.toString()}`);
                console.log("💡 This token may need to be properly whitelisted by the gateway authority");
                console.log("🔄 Try using the SOL deposit script instead: deposit-sol-gateway-final.ts");
                return;
            }
            console.log("✅ Token is properly whitelisted for cross-chain deposits");
        } catch (error) {
            console.log("❌ Error checking whitelist status:", error);
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
        console.log(`Deposited ${depositAmountDecimal} ${usdcConfig.symbol} to lending protocol at ${destinationAddress} on ZetaChain`);
        console.log(`Supply action triggered for address: ${ON_BEHALF_OF}`);
        console.log(`Transaction URL: ${config.getSolanaExplorerUrl(signature)}`);
        console.log(`Cross-chain transaction URL: ${config.getZetaChainCCTXUrl(signature)}`);

    } catch (error) {
        console.error("❌ Error:", error);
    }
}

main().catch(console.error);