/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeAll, vi } from 'vitest';
import '@testing-library/jest-dom';

// Mock Web3 dependencies
beforeAll(() => {
  // Mock wagmi
  vi.mock('wagmi', () => ({
    useAccount: vi.fn(),
    useChainId: vi.fn(),
    useReadContract: vi.fn(),
    useReadContracts: vi.fn(),
    useWriteContract: vi.fn(),
    useSwitchChain: vi.fn(),
    useWaitForTransactionReceipt: vi.fn(),
    useConfig: vi.fn(),
    useBalance: vi.fn(),
  }));

  // Mock @rainbow-me/rainbowkit
  vi.mock('@rainbow-me/rainbowkit', () => ({
    ConnectButton: () => null,
    getDefaultConfig: vi.fn(() => ({})),
    RainbowKitProvider: ({ children }: { children: React.ReactNode }) => children,
  }));

  // Mock wagmi/chains
  vi.mock('wagmi/chains', () => ({
    arbitrumSepolia: { id: 421614, name: 'Arbitrum Sepolia' },
    sepolia: { id: 11155111, name: 'Sepolia' },
    polygonAmoy: { id: 80002, name: 'Polygon Amoy' },
    baseSepolia: { id: 84532, name: 'Base Sepolia' },
    bscTestnet: { id: 97, name: 'BSC Testnet' },
  }));

  // Mock @scure/base
  vi.mock('@scure/base', () => ({
    base58: {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      decode: vi.fn((_str: string) => new Uint8Array(32).fill(0)),
    },
  }));

  // Mock viem
  vi.mock('viem', () => ({
    formatUnits: vi.fn((value: bigint, decimals: number) => {
      // Simple mock: convert bigint to string with decimal places
      const divisor = BigInt(10) ** BigInt(decimals);
      const whole = value / divisor;
      const fraction = value % divisor;
      return `${whole}.${fraction.toString().padStart(decimals, '0')}`;
    }),
    parseUnits: vi.fn((value: string, decimals: number) => {
      // Simple mock: convert string to bigint scaled by decimals
      const [whole, fraction = ''] = value.split('.');
      const paddedFraction = fraction.padEnd(decimals, '0').slice(0, decimals);
      return BigInt(whole + paddedFraction);
    }),
    isAddress: vi.fn(() => true),
    getAddress: vi.fn((address: string) => address),
    createPublicClient: vi.fn(() => ({
      readContract: vi.fn().mockResolvedValue(BigInt(0)),
      estimateGas: vi.fn().mockResolvedValue(BigInt(21000)),
    })),
    http: vi.fn(),
    stringToHex: vi.fn((str: string) => '0x' + Buffer.from(str, 'utf8').toString('hex')),
    toHex: vi.fn((value: any) => {
      if (typeof value === 'string') {
        // Check if it's a numeric string first
        const num = parseFloat(value);
        if (!isNaN(num) && isFinite(num)) {
          // Use BigInt for large numbers to avoid precision loss
          return '0x' + BigInt(Math.trunc(num)).toString(16);
        }
        // Otherwise treat as hex string
        return '0x' + Buffer.from(value, 'utf8').toString('hex');
      }
      if (typeof value === 'number') {
        if (value < 0) throw new Error('Cannot convert negative number to hex');
        return '0x' + Math.floor(value).toString(16);
      }
      if (typeof value === 'bigint') {
        if (value < 0n) throw new Error('Cannot convert negative bigint to hex');
        return '0x' + value.toString(16);
      }
      if (value instanceof Uint8Array) {
        return '0x' + Array
          .from(value)
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');
      }
      return '0x0';
    }),
    encodeFunctionData: vi.fn(() => '0x'),
    encodeAbiParameters: vi.fn(() => '0x' + '0'.repeat(256)), // 128 bytes in hex
    parseAbiParameters: vi.fn(() => ['string', 'address']),
  }));

  // Mock browser APIs
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });

  // Mock localStorage
  const localStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  };
  Object.defineProperty(window, 'localStorage', { value: localStorageMock });

  // Mock fetch
  global.fetch = vi.fn(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({}),
    })
  ) as unknown as typeof fetch;

  // Mock setInterval and clearInterval for proper cleanup
  global.clearInterval = vi.fn();

  // Mock crypto module
  vi.mock('crypto', () => ({
    default: {
      createHash: vi.fn(() => ({
        update: vi.fn().mockReturnThis(),
        digest: vi.fn(() => Buffer.alloc(32, 0x42))
      }))
    },
    createHash: vi.fn(() => ({
      update: vi.fn().mockReturnThis(),
      digest: vi.fn(() => Buffer.alloc(32, 0x42))
    }))
  }));

  // Mock contracts deployments
  vi.mock('@/contracts/deployments', () => ({
    getUniversalLendingProtocolAddress: vi.fn(() => '0x1234567890123456789012345678901234567890'),
    SupportedChain: {
      ZETA_TESTNET: 7001,
      ARBITRUM_SEPOLIA: 421614,
      ETHEREUM_SEPOLIA: 11155111,
      POLYGON_AMOY: 80002,
      BASE_SEPOLIA: 84532,
      BSC_TESTNET: 97,
      SOLANA_DEVNET: 900001
    },
    TOKEN_SYMBOLS: {
      ETH_ARBI: 'ETH.ARBI',
      USDC_ARBI: 'USDC.ARBI',
      ETH_ETH: 'ETH.ETH',
      USDC_ETH: 'USDC.ETH',
      USDC_POL: 'USDC.POL',
      POL_POL: 'POL.POL',
      USDC_BSC: 'USDC.BSC',
      BNB_BSC: 'BNB.BSC',
      ETH_BASE: 'ETH.BASE',
      USDC_BASE: 'USDC.BASE',
      POL: 'POL',
      BNB: 'BNB',
      SOL_SOL: 'SOL.SOL',
      USDC_SOL: 'USDC.SOL'
    },
    getTokenAddress: vi.fn((symbol: string, chainId: number) => `0x${symbol.replace('.', '').toLowerCase()}token${chainId}`),
    getSupportedChainIds: vi.fn(() => [421614, 11155111, 80002, 84532, 97]),
    getNetworkConfig: vi.fn((chainId: number) => ({
      name: `Test Network ${chainId}`,
      chainId,
      type: 'testnet',
      contracts: {},
      tokens: {}
    })),
    SupportedChainId: {
      ARBITRUM_SEPOLIA: 421614,
      ETHEREUM_SEPOLIA: 11155111,
      POLYGON_AMOY: 80002,
      BASE_SEPOLIA: 84532,
      BSC_TESTNET: 97,
      ZETA_TESTNET: 7001,
      SOLANA_DEVNET: 900001
    }
  }));

  // Mock Solana web3.js
  vi.mock('@solana/web3.js', () => ({
    Connection: vi.fn(),
    PublicKey: vi.fn(),
    Transaction: vi.fn(),
    SystemProgram: {
      programId: 'SystemProgram'
    },
    LAMPORTS_PER_SOL: 1000000000,
    TransactionInstruction: vi.fn()
  }));

  // Mock Solana SPL Token
  vi.mock('@solana/spl-token', () => ({
    TOKEN_PROGRAM_ID: 'TokenProgramId',
    getAssociatedTokenAddress: vi.fn(),
    getAccount: vi.fn()
  }));
});