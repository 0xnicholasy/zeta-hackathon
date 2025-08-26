import { createPublicClient, http, type Address, parseUnits, formatUnits } from 'viem';
import { SupportedChain, getUniversalLendingProtocolAddress } from '../contracts/deployments';
import { UniversalLendingProtocol__factory } from '../contracts/typechain-types/factories/contracts/UniversalLendingProtocol__factory';
import { ERC20__factory } from '../contracts/typechain-types';
import { getAssetConfig, getAssetPrice } from './directContractCalls';

const ALCHEMY_API_KEY = import.meta.env['VITE_ALCHEMY_API_KEY'] ?? '';
if (!ALCHEMY_API_KEY) {
  throw new Error('ALCHEMY_API_KEY is not set');
}

// ZetaChain Testnet configuration
const ZETA_TESTNET_RPC = `https://zetachain-testnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;

// Create a public client for ZetaChain testnet
const zetaTestnetClient = createPublicClient({
  transport: http(ZETA_TESTNET_RPC),
  chain: {
    id: SupportedChain.ZETA_TESTNET,
    name: 'ZetaChain Athens Testnet',
    network: 'zetachain-athens',
    nativeCurrency: {
      name: 'ZETA',
      symbol: 'ZETA',
      decimals: 18,
    },
    rpcUrls: {
      default: {
        http: [ZETA_TESTNET_RPC],
      },
      public: {
        http: [ZETA_TESTNET_RPC],
      },
    },
  },
});

export interface SimulationResult {
  success: boolean;
  error?: string;
  gasEstimate?: bigint;
  healthFactorAfter?: number;
  warnings?: string[];
}

export interface SupplySimulationParams {
  userAddress: string;
  assetAddress: string;
  amount: string;
  decimals: number;
}

export interface BorrowSimulationParams {
  userAddress: string;
  assetAddress: string;
  amount: string;
  decimals: number;
}

export interface WithdrawSimulationParams {
  userAddress: string;
  assetAddress: string;
  amount: string;
  decimals: number;
}

export interface RepaySimulationParams {
  userAddress: string;
  assetAddress: string;
  amount: string;
  decimals: number;
}

/**
 * Get user's current health factor
 */
async function getUserHealthFactor(userAddress: string): Promise<number> {
  try {
    const protocolAddress = getUniversalLendingProtocolAddress(SupportedChain.ZETA_TESTNET);
    if (!protocolAddress) {
      throw new Error('UniversalLendingProtocol address not found');
    }

    const result = await zetaTestnetClient.readContract({
      address: protocolAddress as Address,
      abi: UniversalLendingProtocol__factory.abi,
      functionName: 'getHealthFactor',
      args: [userAddress as Address],
    });

    return Number(formatUnits(result, 18));
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error getting user health factor:', error);
    return 0;
  }
}

/**
 * Get user's current supply balance for an asset
 */
async function getUserSupplyBalance(userAddress: string, assetAddress: string): Promise<bigint> {
  try {
    const protocolAddress = getUniversalLendingProtocolAddress(SupportedChain.ZETA_TESTNET);
    if (!protocolAddress) {
      throw new Error('UniversalLendingProtocol address not found');
    }

    const result = await zetaTestnetClient.readContract({
      address: protocolAddress as Address,
      abi: UniversalLendingProtocol__factory.abi,
      functionName: 'getSupplyBalance',
      args: [userAddress as Address, assetAddress as Address],
    });

    return result;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error getting user supply balance:', error);
    return BigInt(0);
  }
}

/**
 * Get user's current borrow balance for an asset
 */
async function getUserBorrowBalance(userAddress: string, assetAddress: string): Promise<bigint> {
  try {
    const protocolAddress = getUniversalLendingProtocolAddress(SupportedChain.ZETA_TESTNET);
    if (!protocolAddress) {
      throw new Error('UniversalLendingProtocol address not found');
    }

    const result = await zetaTestnetClient.readContract({
      address: protocolAddress as Address,
      abi: UniversalLendingProtocol__factory.abi,
      functionName: 'getBorrowBalance',
      args: [userAddress as Address, assetAddress as Address],
    });

    return result;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error getting user borrow balance:', error);
    return BigInt(0);
  }
}

/**
 * Get user's token balance
 */
async function getUserTokenBalance(userAddress: string, tokenAddress: string): Promise<bigint> {
  try {
    const result = await zetaTestnetClient.readContract({
      address: tokenAddress as Address,
      abi: ERC20__factory.abi,
      functionName: 'balanceOf',
      args: [userAddress as Address],
    });

    return result;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error getting user token balance:', error);
    return BigInt(0);
  }
}

/**
 * Check if user has enough allowance for the protocol
 */
async function checkAllowance(userAddress: string, tokenAddress: string, amount: bigint): Promise<boolean> {
  try {
    const protocolAddress = getUniversalLendingProtocolAddress(SupportedChain.ZETA_TESTNET);
    if (!protocolAddress) {
      throw new Error('UniversalLendingProtocol address not found');
    }

    const allowance = await zetaTestnetClient.readContract({
      address: tokenAddress as Address,
      abi: ERC20__factory.abi,
      functionName: 'allowance',
      args: [userAddress as Address, protocolAddress as Address],
    });

    return allowance >= amount;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error checking allowance:', error);
    return false;
  }
}

/**
 * Get ERC20 token decimals
 */
export async function getTokenDecimals(tokenAddress: string): Promise<number> {
  try {
    const result = await zetaTestnetClient.readContract({
      address: tokenAddress as Address,
      abi: ERC20__factory.abi,
      functionName: 'decimals',
    });

    return result;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`Error getting token decimals for ${tokenAddress}:`, error);
    return 18; // Default to 18 decimals
  }
}

/**
 * Simulate a supply transaction
 */
export async function simulateSupply(params: SupplySimulationParams): Promise<SimulationResult> {
  try {
    const { userAddress, assetAddress, amount, decimals } = params;
    const amountBigInt = parseUnits(amount, decimals);
    const warnings: string[] = [];

    // Check if asset is supported
    const assetConfig = await getAssetConfig(assetAddress);
    if (!assetConfig?.isSupported) {
      return {
        success: false,
        error: 'Asset is not supported by the protocol',
      };
    }

    // Check user balance
    const userBalance = await getUserTokenBalance(userAddress, assetAddress);
    if (userBalance < amountBigInt) {
      return {
        success: false,
        error: `Insufficient balance. You have ${formatUnits(userBalance, decimals)} but trying to supply ${amount}`,
      };
    }

    // Check allowance
    const hasAllowance = await checkAllowance(userAddress, assetAddress, amountBigInt);
    if (!hasAllowance) {
      warnings.push('Token approval required before supply');
    }

    // Get current health factor
    const currentHealthFactor = await getUserHealthFactor(userAddress);

    // Estimate gas (supply should always improve or maintain health factor)
    try {
      const protocolAddress = getUniversalLendingProtocolAddress(SupportedChain.ZETA_TESTNET);
      if (!protocolAddress) {
        throw new Error('UniversalLendingProtocol address not found');
      }

      const gasEstimate = await zetaTestnetClient.estimateGas({
        account: userAddress as Address,
        to: protocolAddress as Address,
        data: '0x', // This would be the actual supply call data
      });

      return {
        success: true,
        gasEstimate,
        healthFactorAfter: currentHealthFactor, // Supply doesn't decrease health factor
        warnings,
      };
    } catch (error) {
      return {
        success: false,
        error: `Transaction simulation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  } catch (error) {
    return {
      success: false,
      error: `Simulation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Simulate a borrow transaction
 */
export async function simulateBorrow(params: BorrowSimulationParams): Promise<SimulationResult> {
  try {
    const { userAddress, assetAddress, amount, decimals } = params;
    const amountBigInt = parseUnits(amount, decimals);
    const warnings: string[] = [];

    // Check if asset is supported
    const assetConfig = await getAssetConfig(assetAddress);
    if (!assetConfig?.isSupported) {
      return {
        success: false,
        error: 'Asset is not supported by the protocol',
      };
    }

    // Get current health factor
    const currentHealthFactor = await getUserHealthFactor(userAddress);
    if (currentHealthFactor < 1.5) {
      warnings.push('Current health factor is below recommended 1.5x');
    }

    // Check protocol liquidity
    const protocolAddress = getUniversalLendingProtocolAddress(SupportedChain.ZETA_TESTNET);
    if (!protocolAddress) {
      throw new Error('UniversalLendingProtocol address not found');
    }

    const protocolBalance = await getUserTokenBalance(protocolAddress, assetAddress);
    if (protocolBalance < amountBigInt) {
      return {
        success: false,
        error: `Insufficient protocol liquidity. Available: ${formatUnits(protocolBalance, decimals)}`,
      };
    }

    // Calculate estimated health factor after borrow
    // This is a simplified calculation - the actual calculation would need to consider
    // all user positions, asset prices, and collateral factors
    const assetPrice = await getAssetPrice(assetAddress);
    const borrowValueUSD = Number(formatUnits(amountBigInt * assetPrice, 36)); // 18 + 18 decimals
    
    // Simplified health factor calculation (would need more data for accuracy)
    if (currentHealthFactor > 0 && borrowValueUSD > 0) {
      // This is a rough estimation - actual calculation would be more complex
      const estimatedHealthFactorAfter = currentHealthFactor * 0.9; // Rough estimation
      
      if (estimatedHealthFactorAfter < 1.2) {
        return {
          success: false,
          error: 'Borrowing this amount would put your position at risk of liquidation',
        };
      }
      
      if (estimatedHealthFactorAfter < 1.5) {
        warnings.push('This borrow will bring your health factor below the recommended 1.5x');
      }
    }

    try {
      const gasEstimate = await zetaTestnetClient.estimateGas({
        account: userAddress as Address,
        to: protocolAddress as Address,
        data: '0x', // This would be the actual borrow call data
      });

      return {
        success: true,
        gasEstimate,
        healthFactorAfter: currentHealthFactor * 0.9, // Rough estimation
        warnings,
      };
    } catch (error) {
      return {
        success: false,
        error: `Transaction simulation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  } catch (error) {
    return {
      success: false,
      error: `Simulation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Simulate a withdraw transaction
 */
export async function simulateWithdraw(params: WithdrawSimulationParams): Promise<SimulationResult> {
  try {
    const { userAddress, assetAddress, amount, decimals } = params;
    const amountBigInt = parseUnits(amount, decimals);
    const warnings: string[] = [];

    // Check user supply balance
    const supplyBalance = await getUserSupplyBalance(userAddress, assetAddress);
    if (supplyBalance < amountBigInt) {
      return {
        success: false,
        error: `Insufficient supply balance. You have ${formatUnits(supplyBalance, decimals)} supplied`,
      };
    }

    // Get current health factor
    const currentHealthFactor = await getUserHealthFactor(userAddress);
    
    // Check if withdrawal would affect health factor (if user has borrows)
    if (currentHealthFactor > 0 && currentHealthFactor < 2.0) {
      warnings.push('Withdrawing collateral may affect your health factor');
      
      // Simplified check - actual calculation would be more complex
      if (currentHealthFactor < 1.5) {
        warnings.push('Your health factor is already below recommended levels');
      }
    }

    try {
      const protocolAddress = getUniversalLendingProtocolAddress(SupportedChain.ZETA_TESTNET);
      if (!protocolAddress) {
        throw new Error('UniversalLendingProtocol address not found');
      }

      const gasEstimate = await zetaTestnetClient.estimateGas({
        account: userAddress as Address,
        to: protocolAddress as Address,
        data: '0x', // This would be the actual withdraw call data
      });

      return {
        success: true,
        gasEstimate,
        healthFactorAfter: currentHealthFactor, // Simplified - would need actual calculation
        warnings,
      };
    } catch (error) {
      return {
        success: false,
        error: `Transaction simulation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  } catch (error) {
    return {
      success: false,
      error: `Simulation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Simulate a repay transaction
 */
export async function simulateRepay(params: RepaySimulationParams): Promise<SimulationResult> {
  try {
    const { userAddress, assetAddress, amount, decimals } = params;
    const amountBigInt = parseUnits(amount, decimals);
    const warnings: string[] = [];

    // Check user borrow balance
    const borrowBalance = await getUserBorrowBalance(userAddress, assetAddress);
    if (borrowBalance === BigInt(0)) {
      return {
        success: false,
        error: 'You have no outstanding borrows for this asset',
      };
    }

    // Check if trying to repay more than borrowed
    if (amountBigInt > borrowBalance) {
      warnings.push(`Repaying more than borrowed. Outstanding debt: ${formatUnits(borrowBalance, decimals)}`);
    }

    // Check user token balance
    const userBalance = await getUserTokenBalance(userAddress, assetAddress);
    if (userBalance < amountBigInt) {
      return {
        success: false,
        error: `Insufficient balance to repay. You have ${formatUnits(userBalance, decimals)} but trying to repay ${amount}`,
      };
    }

    // Check allowance
    const hasAllowance = await checkAllowance(userAddress, assetAddress, amountBigInt);
    if (!hasAllowance) {
      warnings.push('Token approval required before repay');
    }

    // Get current health factor
    const currentHealthFactor = await getUserHealthFactor(userAddress);

    try {
      const protocolAddress = getUniversalLendingProtocolAddress(SupportedChain.ZETA_TESTNET);
      if (!protocolAddress) {
        throw new Error('UniversalLendingProtocol address not found');
      }

      const gasEstimate = await zetaTestnetClient.estimateGas({
        account: userAddress as Address,
        to: protocolAddress as Address,
        data: '0x', // This would be the actual repay call data
      });

      return {
        success: true,
        gasEstimate,
        healthFactorAfter: currentHealthFactor, // Repay improves health factor
        warnings,
      };
    } catch (error) {
      return {
        success: false,
        error: `Transaction simulation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  } catch (error) {
    return {
      success: false,
      error: `Simulation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * General transaction simulation dispatcher
 */
export async function simulateTransaction(
  type: 'supply' | 'borrow' | 'withdraw' | 'repay',
  params: SupplySimulationParams | BorrowSimulationParams | WithdrawSimulationParams | RepaySimulationParams
): Promise<SimulationResult> {
  switch (type) {
    case 'supply':
      return simulateSupply(params as SupplySimulationParams);
    case 'borrow':
      return simulateBorrow(params as BorrowSimulationParams);
    case 'withdraw':
      return simulateWithdraw(params as WithdrawSimulationParams);
    case 'repay':
      return simulateRepay(params as RepaySimulationParams);
    default:
      return {
        success: false,
        error: 'Unknown transaction type',
      };
  }
}