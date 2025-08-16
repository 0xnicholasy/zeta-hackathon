import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { getAccount, getAssociatedTokenAddress } from '@solana/spl-token';
import { type SolanaToken } from '../components/dashboard/solana/SolanaSupplyDialog';

// Solana devnet RPC endpoint
const SOLANA_RPC_URL = 'https://api.devnet.solana.com';

// Devnet USDC mint address
const DEVNET_USDC_MINT = 'Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr';

/**
 * Creates a connection to Solana devnet
 */
export function createSolanaConnection(): Connection {
    return new Connection(SOLANA_RPC_URL, 'confirmed');
}

/**
 * Fetches the SOL balance for a given public key
 */
export async function getSOLBalance(publicKey: string): Promise<number> {
    try {
        const connection = createSolanaConnection();
        const pubKey = new PublicKey(publicKey);
        
        const balance = await connection.getBalance(pubKey);
        return balance / LAMPORTS_PER_SOL;
    } catch (error) {
        console.error('Error fetching SOL balance:', error);
        return 0;
    }
}

/**
 * Fetches the USDC token balance for a given public key
 */
export async function getUSDCBalance(publicKey: string): Promise<number> {
    try {
        const connection = createSolanaConnection();
        const pubKey = new PublicKey(publicKey);
        const usdcMint = new PublicKey(DEVNET_USDC_MINT);
        
        // Get the associated token account address for USDC
        const associatedTokenAccount = await getAssociatedTokenAddress(
            usdcMint,
            pubKey
        );
        
        try {
            // Get the token account info
            const tokenAccount = await getAccount(
                connection,
                associatedTokenAccount
            );
            
            // USDC has 6 decimals
            const balance = Number(tokenAccount.amount) / Math.pow(10, 6);
            return balance;
        } catch (accountError) {
            // Account doesn't exist or has no USDC
            console.log('USDC token account not found or empty for address:', publicKey);
            return 0;
        }
    } catch (error) {
        console.error('Error fetching USDC balance:', error);
        return 0;
    }
}

/**
 * Fetches all Solana token balances for a given public key
 */
export async function fetchSolanaTokenBalances(publicKey: string): Promise<SolanaToken[]> {
    try {
        // Fetch balances in parallel for better performance
        const [solBalance, usdcBalance] = await Promise.all([
            getSOLBalance(publicKey),
            getUSDCBalance(publicKey)
        ]);
        
        const tokens: SolanaToken[] = [
            {
                symbol: 'SOL',
                name: 'Solana',
                balance: solBalance,
                decimals: 9,
                isNative: true
            },
            {
                symbol: 'USDC',
                name: 'USD Coin',
                balance: usdcBalance,
                decimals: 6,
                mintAddress: DEVNET_USDC_MINT,
                isNative: false
            }
        ];
        
        return tokens;
    } catch (error) {
        console.error('Error fetching Solana token balances:', error);
        // Return default tokens with zero balances on error
        return [
            {
                symbol: 'SOL',
                name: 'Solana',
                balance: 0,
                decimals: 9,
                isNative: true
            },
            {
                symbol: 'USDC',
                name: 'USD Coin',
                balance: 0,
                decimals: 6,
                mintAddress: DEVNET_USDC_MINT,
                isNative: false
            }
        ];
    }
}

/**
 * Validates if a public key string is valid
 */
export function isValidSolanaAddress(address: string): boolean {
    try {
        new PublicKey(address);
        return true;
    } catch {
        return false;
    }
}

/**
 * Formats a Solana token balance for display
 */
export function formatTokenBalance(balance: number, decimals: number = 2): string {
    if (balance === 0) return '0';
    if (balance < 0.000001) return '< 0.000001';
    
    return balance.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    });
}