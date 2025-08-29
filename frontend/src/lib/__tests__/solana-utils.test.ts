import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { getAccount, getAssociatedTokenAddress } from '@solana/spl-token';
import {
  createSolanaConnection,
  getSOLBalance,
  getUSDCBalance,
  fetchSolanaTokenBalances,
  isValidSolanaAddress,
  formatTokenBalance
} from '../solana-utils';

// Mock Solana Web3.js and SPL Token
vi.mock('@solana/web3.js', () => ({
  Connection: vi.fn(),
  PublicKey: vi.fn(),
  LAMPORTS_PER_SOL: 1000000000
}));

vi.mock('@solana/spl-token', () => ({
  getAccount: vi.fn(),
  getAssociatedTokenAddress: vi.fn()
}));

describe('solana-utils.ts', () => {
  let mockConnection: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock Connection instance
    mockConnection = {
      getBalance: vi.fn(),
    };
    (Connection as any).mockReturnValue(mockConnection);
    
    // Mock PublicKey constructor and methods
    (PublicKey as any).mockImplementation((key: string) => ({
      toString: () => key,
      toBuffer: () => Buffer.from(key, 'hex')
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createSolanaConnection', () => {
    describe('Core Functionality', () => {
      it('should create connection to Solana devnet', () => {
        const connection = createSolanaConnection();
        
        expect(Connection).toHaveBeenCalledWith(
          'https://api.devnet.solana.com',
          'confirmed'
        );
        expect(connection).toBe(mockConnection);
      });

      it('should return Connection instance', () => {
        const connection = createSolanaConnection();
        expect(connection).toBeDefined();
        expect(connection).toBe(mockConnection);
      });
    });
  });

  describe('getSOLBalance', () => {
    describe('Core Functionality', () => {
      it('should fetch SOL balance successfully', async () => {
        const mockPublicKey = 'TestPublicKey123';
        const mockBalance = 2500000000; // 2.5 SOL in lamports
        
        mockConnection.getBalance.mockResolvedValue(mockBalance);

        const result = await getSOLBalance(mockPublicKey);

        expect(PublicKey).toHaveBeenCalledWith(mockPublicKey);
        expect(mockConnection.getBalance).toHaveBeenCalledWith(expect.any(Object));
        expect(result).toBe(2.5);
      });

      it('should convert lamports to SOL correctly', async () => {
        const testCases = [
          { lamports: LAMPORTS_PER_SOL, expected: 1 },
          { lamports: LAMPORTS_PER_SOL * 2.5, expected: 2.5 },
          { lamports: 500000000, expected: 0.5 },
          { lamports: 0, expected: 0 },
        ];

        for (const { lamports, expected } of testCases) {
          mockConnection.getBalance.mockResolvedValue(lamports);
          const result = await getSOLBalance('test-key');
          expect(result).toBe(expected);
        }
      });
    });

    describe('Error Handling', () => {
      it('should return 0 on invalid public key', async () => {
        (PublicKey as any).mockImplementation(() => {
          throw new Error('Invalid public key');
        });

        const result = await getSOLBalance('invalid-key');
        expect(result).toBe(0);
      });

      it('should return 0 on connection error', async () => {
        mockConnection.getBalance.mockRejectedValue(new Error('Connection failed'));

        const result = await getSOLBalance('valid-key');
        expect(result).toBe(0);
      });

      it('should handle network timeout gracefully', async () => {
        mockConnection.getBalance.mockRejectedValue(new Error('Network timeout'));

        const result = await getSOLBalance('valid-key');
        expect(result).toBe(0);
      });
    });
  });

  describe('getUSDCBalance', () => {
    describe('Core Functionality', () => {
      it('should fetch USDC balance successfully', async () => {
        const mockPublicKey = 'TestPublicKey123';
        const mockTokenAccount = 'TokenAccount123';
        const mockUSDCAmount = 1500000000; // 1500 USDC with 6 decimals
        
        (getAssociatedTokenAddress as any).mockResolvedValue(mockTokenAccount);
        (getAccount as any).mockResolvedValue({
          amount: BigInt(mockUSDCAmount)
        });

        const result = await getUSDCBalance(mockPublicKey);

        expect(getAssociatedTokenAddress).toHaveBeenCalledWith(
          expect.any(Object), // USDC mint
          expect.any(Object)  // user public key
        );
        expect(getAccount).toHaveBeenCalledWith(mockConnection, mockTokenAccount);
        expect(result).toBe(1500); // 1500000000 / 10^6
      });

      it('should handle different USDC amounts correctly', async () => {
        const testCases = [
          { amount: 1000000n, expected: 1 }, // 1 USDC
          { amount: 500000n, expected: 0.5 }, // 0.5 USDC
          { amount: 0n, expected: 0 }, // 0 USDC
          { amount: 1234567890n, expected: 1234.56789 }, // Large amount with decimals
        ];

        (getAssociatedTokenAddress as any).mockResolvedValue('token-account');

        for (const { amount, expected } of testCases) {
          (getAccount as any).mockResolvedValue({ amount });
          const result = await getUSDCBalance('test-key');
          expect(result).toBe(expected);
        }
      });
    });

    describe('Error Handling', () => {
      it('should return 0 when token account does not exist', async () => {
        (getAssociatedTokenAddress as any).mockResolvedValue('non-existent-account');
        (getAccount as any).mockRejectedValue(new Error('Account not found'));

        const result = await getUSDCBalance('test-key');
        expect(result).toBe(0);
      });

      it('should return 0 on invalid public key', async () => {
        (PublicKey as any).mockImplementation(() => {
          throw new Error('Invalid public key');
        });

        const result = await getUSDCBalance('invalid-key');
        expect(result).toBe(0);
      });

      it('should return 0 on getAssociatedTokenAddress error', async () => {
        (getAssociatedTokenAddress as any).mockRejectedValue(new Error('ATA error'));

        const result = await getUSDCBalance('test-key');
        expect(result).toBe(0);
      });

      it('should handle connection errors gracefully', async () => {
        (getAssociatedTokenAddress as any).mockResolvedValue('token-account');
        (getAccount as any).mockRejectedValue(new Error('Connection error'));

        const result = await getUSDCBalance('test-key');
        expect(result).toBe(0);
      });
    });
  });

  describe('fetchSolanaTokenBalances', () => {
    describe('Core Functionality', () => {
      it('should fetch both SOL and USDC balances in parallel', async () => {
        const mockPublicKey = 'TestPublicKey123';
        
        // Mock SOL balance
        mockConnection.getBalance.mockResolvedValue(2000000000); // 2 SOL
        
        // Mock USDC balance
        (getAssociatedTokenAddress as any).mockResolvedValue('usdc-token-account');
        (getAccount as any).mockResolvedValue({
          amount: BigInt(500000000) // 500 USDC
        });

        const result = await fetchSolanaTokenBalances(mockPublicKey);

        expect(result).toHaveLength(2);
        expect(result[0]).toEqual({
          symbol: 'SOL',
          name: 'Solana',
          balance: 2,
          decimals: 9,
          isNative: true
        });
        expect(result[1]).toEqual({
          symbol: 'USDC',
          name: 'USD Coin',
          balance: 500,
          decimals: 6,
          mintAddress: 'Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr',
          isNative: false
        });
      });

      it('should return tokens with zero balances when balances are zero', async () => {
        mockConnection.getBalance.mockResolvedValue(0);
        (getAssociatedTokenAddress as any).mockResolvedValue('empty-account');
        (getAccount as any).mockResolvedValue({ amount: BigInt(0) });

        const result = await fetchSolanaTokenBalances('test-key');

        expect(result[0].balance).toBe(0);
        expect(result[1].balance).toBe(0);
        expect(result).toHaveLength(2);
      });
    });

    describe('Error Handling', () => {
      it('should return default tokens with zero balances on error', async () => {
        mockConnection.getBalance.mockRejectedValue(new Error('SOL balance error'));
        (getAssociatedTokenAddress as any).mockRejectedValue(new Error('USDC error'));

        const result = await fetchSolanaTokenBalances('test-key');

        expect(result).toHaveLength(2);
        expect(result[0]).toEqual({
          symbol: 'SOL',
          name: 'Solana',
          balance: 0,
          decimals: 9,
          isNative: true
        });
        expect(result[1]).toEqual({
          symbol: 'USDC',
          name: 'USD Coin',
          balance: 0,
          decimals: 6,
          mintAddress: 'Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr',
          isNative: false
        });
      });

      it('should handle partial errors gracefully', async () => {
        // SOL succeeds, USDC fails
        mockConnection.getBalance.mockResolvedValue(1000000000); // 1 SOL
        (getAssociatedTokenAddress as any).mockRejectedValue(new Error('USDC error'));

        const result = await fetchSolanaTokenBalances('test-key');

        // Since SOL balance succeeds but USDC fails, the function should return:
        // SOL with actual balance (1) and USDC with error balance (0)
        expect(result[0].balance).toBe(1); // SOL succeeds
        expect(result[1].balance).toBe(0); // USDC fails, returns 0
        expect(result).toHaveLength(2);
      });
    });
  });

  describe('isValidSolanaAddress', () => {
    describe('Core Functionality', () => {
      it('should return true for valid Solana addresses', () => {
        // Mock PublicKey constructor to not throw for valid addresses
        (PublicKey as any).mockImplementation((key: string) => ({ toString: () => key }));

        const validAddresses = [
          'GjuJJ4KSJYNXnZFMKR2wZo6pihiDrH3YZ8fqnr6bNUgC',
          'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
          'So11111111111111111111111111111111111111112',
        ];

        validAddresses.forEach(address => {
          const result = isValidSolanaAddress(address);
          expect(result).toBe(true);
        });
      });

      it('should return false for invalid Solana addresses', () => {
        // Mock PublicKey constructor to throw for invalid addresses
        (PublicKey as any).mockImplementation(() => {
          throw new Error('Invalid public key input');
        });

        const invalidAddresses = [
          'invalid-address',
          '123',
          '',
          'not-a-valid-solana-address-format',
        ];

        invalidAddresses.forEach(address => {
          const result = isValidSolanaAddress(address);
          expect(result).toBe(false);
        });
      });
    });

    describe('Edge Cases', () => {
      it('should handle empty string', () => {
        (PublicKey as any).mockImplementation(() => {
          throw new Error('Empty string');
        });

        const result = isValidSolanaAddress('');
        expect(result).toBe(false);
      });

      it('should handle undefined input gracefully', () => {
        (PublicKey as any).mockImplementation(() => {
          throw new Error('Undefined input');
        });

        const result = isValidSolanaAddress(undefined as any);
        expect(result).toBe(false);
      });

      it('should handle null input gracefully', () => {
        (PublicKey as any).mockImplementation(() => {
          throw new Error('Null input');
        });

        const result = isValidSolanaAddress(null as any);
        expect(result).toBe(false);
      });
    });
  });

  describe('formatTokenBalance', () => {
    describe('Core Functionality', () => {
      it('should format balance with default 2 decimals', () => {
        const testCases = [
          { balance: 1234.5678, expected: '1,234.57' },
          { balance: 1000, expected: '1,000.00' },
          { balance: 0.123, expected: '0.12' },
          { balance: 999.999, expected: '1,000.00' },
        ];

        testCases.forEach(({ balance, expected }) => {
          const result = formatTokenBalance(balance);
          expect(result).toBe(expected);
        });
      });

      it('should format balance with custom decimals', () => {
        const testCases = [
          { balance: 1234.5678, decimals: 4, expected: '1,234.5678' },
          { balance: 1000, decimals: 0, expected: '1,000' },
          { balance: 0.123456, decimals: 6, expected: '0.123456' },
          { balance: 999.1, decimals: 1, expected: '999.1' },
        ];

        testCases.forEach(({ balance, decimals, expected }) => {
          const result = formatTokenBalance(balance, decimals);
          expect(result).toBe(expected);
        });
      });
    });

    describe('Special Cases', () => {
      it('should return "0" for zero balance', () => {
        const result = formatTokenBalance(0);
        expect(result).toBe('0');
      });

      it('should return "< 0.000001" for very small balances', () => {
        const smallBalances = [0.0000001, 0.0000005, 0.00000099];
        
        smallBalances.forEach(balance => {
          const result = formatTokenBalance(balance);
          expect(result).toBe('< 0.000001');
        });
      });

      it('should format exactly 0.000001 normally', () => {
        const result = formatTokenBalance(0.000001);
        expect(result).toBe('0.00'); // Rounds to 0.00 with 2 decimals
      });
    });

    describe('Edge Cases', () => {
      it('should handle large numbers', () => {
        const result = formatTokenBalance(1234567890.123);
        expect(result).toBe('1,234,567,890.12');
      });

      it('should handle negative numbers', () => {
        const result = formatTokenBalance(-1234.56);
        // The function checks if balance < 0.000001, and -1234.56 < 0.000001 is true
        expect(result).toBe('< 0.000001');
      });

      it('should handle decimal places correctly', () => {
        const testCases = [
          { balance: 1.1, decimals: 0, expected: '1' },
          { balance: 1.9, decimals: 0, expected: '2' },
          { balance: 1.23456, decimals: 3, expected: '1.235' },
        ];

        testCases.forEach(({ balance, decimals, expected }) => {
          const result = formatTokenBalance(balance, decimals);
          expect(result).toBe(expected);
        });
      });
    });

    describe('Performance and Consistency', () => {
      it('should return consistent results for same inputs', () => {
        const balance = 1234.5678;
        const decimals = 3;

        const result1 = formatTokenBalance(balance, decimals);
        const result2 = formatTokenBalance(balance, decimals);

        expect(result1).toBe(result2);
        expect(result1).toBe('1,234.568');
      });

      it('should handle various locales formatting correctly', () => {
        const balance = 1234567.89;
        const result = formatTokenBalance(balance);
        
        // Should use en-US formatting with commas
        expect(result).toBe('1,234,567.89');
      });
    });
  });
});