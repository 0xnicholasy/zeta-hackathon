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
  }));

  // Mock @rainbow-me/rainbowkit
  vi.mock('@rainbow-me/rainbowkit', () => ({
    ConnectButton: () => null,
  }));

  // Mock viem
  vi.mock('viem', () => ({
    formatUnits: vi.fn(() => '100.00'),
    parseUnits: vi.fn(() => BigInt(100)),
    isAddress: vi.fn(() => true),
    getAddress: vi.fn((address: string) => address),
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
});