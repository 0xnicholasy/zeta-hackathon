import { 
  Connection, 
  PublicKey, 
  Transaction, 
  SystemProgram, 
  LAMPORTS_PER_SOL,
  TransactionInstruction
} from '@solana/web3.js';
import { 
  TOKEN_PROGRAM_ID, 
  getAssociatedTokenAddress
} from '@solana/spl-token';
import { createHash } from 'crypto';
import { AbiCoder } from 'ethers/lib/utils';

export interface SolanaTransactionParams {
  connection: Connection;
  userPublicKey: PublicKey;
  amount: number;
  evmAddress: string;
  tokenMintAddress?: PublicKey; // For SPL tokens like USDC
}

// ZetaChain Gateway configuration (from config.json)
const GATEWAY_PROGRAM_ID = new PublicKey('ZETAjseVjuFsxdRxo6MmTCvqFwb3ZHUx56Co3vCmGis');
const UNIVERSAL_LENDING_PROTOCOL_ADDRESS = '0x32aBC46abc5bC818fF4DB0C0e75ea2dDbb2D9a13';

// Function to calculate Anchor discriminator
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

// Get Gateway PDA
function getGatewayPDA(): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('meta', 'utf8')],
    GATEWAY_PROGRAM_ID
  );
  return pda;
}

export async function createSOLSupplyTransaction({
  connection,
  userPublicKey,
  amount,
  evmAddress
}: SolanaTransactionParams): Promise<Transaction> {
  const transaction = new Transaction();
  
  // Convert amount to lamports (SOL has 9 decimals)
  const depositAmount = Math.floor(amount * LAMPORTS_PER_SOL);
  const feeAmount = Math.floor(0.002 * LAMPORTS_PER_SOL); // 0.002 SOL fee
  const totalAmount = depositAmount + feeAmount;
  
  // Get Gateway PDA
  const pda = getGatewayPDA();
  
  // Convert destination address to bytes (exactly 20 bytes)
  const destinationBuffer = Buffer.from(UNIVERSAL_LENDING_PROTOCOL_ADDRESS.slice(2), 'hex');
  if (destinationBuffer.length !== 20) {
    throw new Error(`Invalid destination address length: expected 20 bytes, got ${destinationBuffer.length}`);
  }
  
  // Encode message for lending protocol onCall function
  const message = encodeSupplyMessage(evmAddress);
  
  // Construct deposit_and_call instruction
  const discriminator = calculateDiscriminator('deposit_and_call');
  
  // Serialize amount as u64 (8 bytes, little endian)
  const amountBuffer = Buffer.allocUnsafe(8);
  amountBuffer.writeUInt32LE(totalAmount, 0);
  amountBuffer.writeUInt32LE(0, 4); // high 32 bits
  
  // Destination is 20 bytes (fixed array [u8; 20])
  const receiverBuffer = destinationBuffer;
  
  // Message as Vec<u8> (length prefix + data)
  const messageLengthBuffer = Buffer.allocUnsafe(4);
  messageLengthBuffer.writeUInt32LE(message.length, 0);
  const messageBuffer = Buffer.concat([messageLengthBuffer, message]);
  
  // RevertOptions as Option<RevertOptions> - None = 0x00
  const revertOptionsBuffer = Buffer.from([0x00]);
  
  // Combine instruction data for deposit_and_call
  const instructionData = Buffer.concat([
    discriminator,        // 8 bytes
    amountBuffer,         // 8 bytes  
    receiverBuffer,       // 20 bytes
    messageBuffer,        // 4 bytes length + 128 bytes message = 132 bytes
    revertOptionsBuffer   // 1 byte
  ]);
  
  // Create instruction
  const instruction = new TransactionInstruction({
    keys: [
      { pubkey: userPublicKey, isSigner: true, isWritable: true },   // signer
      { pubkey: pda, isSigner: false, isWritable: true },           // pda
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // system_program
    ],
    programId: GATEWAY_PROGRAM_ID,
    data: instructionData,
  });
  
  transaction.add(instruction);
  
  // Get recent blockhash
  const { blockhash } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = userPublicKey;
  
  return transaction;
}

export async function createUSDCSupplyTransaction({
  connection,
  userPublicKey,
  amount,
  evmAddress,
  tokenMintAddress
}: SolanaTransactionParams & { tokenMintAddress: PublicKey }): Promise<Transaction> {
  const transaction = new Transaction();
  
  // USDC has 6 decimals
  const tokenAmount = Math.floor(amount * Math.pow(10, 6));
  
  // Get Gateway PDA
  const pda = getGatewayPDA();
  
  // Get whitelist entry PDA
  const [whitelistEntry] = PublicKey.findProgramAddressSync(
    [Buffer.from('whitelist'), tokenMintAddress.toBuffer()],
    GATEWAY_PROGRAM_ID
  );
  
  // Get user's token account
  const userTokenAccount = await getAssociatedTokenAddress(
    tokenMintAddress,
    userPublicKey
  );
  
  // Get gateway's token account (PDA's ATA)
  const gatewayTokenAccount = await getAssociatedTokenAddress(
    tokenMintAddress,
    pda,
    true // Allow PDA as owner
  );
  
  // Convert destination address to bytes (exactly 20 bytes)
  const destinationBuffer = Buffer.from(UNIVERSAL_LENDING_PROTOCOL_ADDRESS.slice(2), 'hex');
  if (destinationBuffer.length !== 20) {
    throw new Error(`Invalid destination address length: expected 20 bytes, got ${destinationBuffer.length}`);
  }
  
  // Encode message for lending protocol onCall function
  const message = encodeSupplyMessage(evmAddress);
  
  // Construct deposit_spl_token_and_call instruction
  const discriminator = calculateDiscriminator('deposit_spl_token_and_call');
  
  // Serialize amount as u64 (8 bytes, little endian)
  const amountBuffer = Buffer.allocUnsafe(8);
  amountBuffer.writeUInt32LE(tokenAmount, 0);
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
  
  // Create instruction with all required accounts for deposit_spl_token_and_call
  const instruction = new TransactionInstruction({
    keys: [
      { pubkey: userPublicKey, isSigner: true, isWritable: true },      // signer
      { pubkey: pda, isSigner: false, isWritable: true },              // pda (writable for deposit_and_call)
      { pubkey: whitelistEntry, isSigner: false, isWritable: false },   // whitelist_entry
      { pubkey: tokenMintAddress, isSigner: false, isWritable: false }, // mint_account
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // token_program
      { pubkey: userTokenAccount, isSigner: false, isWritable: true },  // from
      { pubkey: gatewayTokenAccount, isSigner: false, isWritable: true }, // to
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // system_program
    ],
    programId: GATEWAY_PROGRAM_ID,
    data: instructionData,
  });
  
  transaction.add(instruction);
  
  // Get recent blockhash
  const { blockhash } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = userPublicKey;
  
  return transaction;
}

// Known USDC mint address on Solana devnet (from config.json)
export const USDC_MINT_DEVNET = new PublicKey('Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr');