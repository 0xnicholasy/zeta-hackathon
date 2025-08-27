import { createPublicClient, http, type Address, parseUnits, formatUnits, encodeFunctionData } from 'viem';
import { SupportedChain, getUniversalLendingProtocolAddress } from '../contracts/deployments';
import { UniversalLendingProtocol__factory } from '../contracts/typechain-types/factories/contracts/UniversalLendingProtocol__factory';
import { ERC20__factory } from '../contracts/typechain-types';
import { getAssetConfig, getAssetPrice, getAllSupportedAssets } from './directContractCalls';
import { isLiquidatable, isBelowRecommended, compareHealthFactors } from './healthFactorUtils';

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
  healthFactorAfter?: string; // Changed to string for precision preservation
  warnings?: string[];
  isEstimate?: boolean; // Flag to indicate if health factor is estimated
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
 * Get user's current health factor as a precise string representation
 */
async function getUserHealthFactor(userAddress: string): Promise<string> {
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

    // Return precise string representation instead of converted Number
    return formatUnits(result, 18);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error getting user health factor:', error);
    return '0';
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
 * Compute health factor based on all user positions, asset prices, and liquidation thresholds
 * Returns healthFactor = totalEffectiveCollateral / totalBorrows as precise string
 */
async function computeHealthFactor(
  userAddress: string,
  simulatedBorrowAsset?: string,
  simulatedBorrowAmount?: bigint,
  simulatedSupplyAsset?: string,
  simulatedSupplyAmount?: bigint,
  simulatedWithdrawAsset?: string,
  simulatedWithdrawAmount?: bigint,
  simulatedRepayAsset?: string,
  simulatedRepayAmount?: bigint
): Promise<{ healthFactor: string; isEstimate: boolean; error?: string }> {
  try {
    // Get all supported assets
    const supportedAssets = await getAllSupportedAssets();
    
    if (supportedAssets.length === 0) {
      return { healthFactor: '0', isEstimate: true, error: 'No supported assets found' };
    }

    let totalEffectiveCollateral = BigInt(0);
    let totalBorrows = BigInt(0);
    let hasIncompleteData = false;

    // Process each asset to calculate collateral and borrows
    for (const assetAddress of supportedAssets) {
      try {
        // Get asset configuration, price, and user balances in parallel
        const [config, price, supplyBalance, borrowBalance] = await Promise.all([
          getAssetConfig(assetAddress),
          getAssetPrice(assetAddress),
          getUserSupplyBalance(userAddress, assetAddress),
          getUserBorrowBalance(userAddress, assetAddress)
        ]);

        if (!config || !config.isSupported || price === BigInt(0)) {
          hasIncompleteData = true;
          continue;
        }

        // Apply simulations to balances
        let adjustedSupplyBalance = supplyBalance;
        let adjustedBorrowBalance = borrowBalance;

        if (simulatedSupplyAsset === assetAddress && simulatedSupplyAmount) {
          adjustedSupplyBalance += simulatedSupplyAmount;
        }
        if (simulatedWithdrawAsset === assetAddress && simulatedWithdrawAmount) {
          adjustedSupplyBalance = adjustedSupplyBalance > simulatedWithdrawAmount ? 
            adjustedSupplyBalance - simulatedWithdrawAmount : BigInt(0);
        }
        if (simulatedBorrowAsset === assetAddress && simulatedBorrowAmount) {
          adjustedBorrowBalance += simulatedBorrowAmount;
        }
        if (simulatedRepayAsset === assetAddress && simulatedRepayAmount) {
          adjustedBorrowBalance = adjustedBorrowBalance > simulatedRepayAmount ?
            adjustedBorrowBalance - simulatedRepayAmount : BigInt(0);
        }

        // Calculate collateral value: supplyBalance * price * liquidationThreshold / 1e18
        // liquidationThreshold is in basis points (e.g., 8000 = 80%)
        if (adjustedSupplyBalance > BigInt(0)) {
          const collateralValue = (adjustedSupplyBalance * price * config.liquidationThreshold) / (BigInt(10000) * BigInt(10) ** BigInt(18));
          totalEffectiveCollateral += collateralValue;
        }

        // Calculate borrow value: borrowBalance * price
        if (adjustedBorrowBalance > BigInt(0)) {
          const borrowValue = (adjustedBorrowBalance * price) / (BigInt(10) ** BigInt(18));
          totalBorrows += borrowValue;
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.warn(`Error processing asset ${assetAddress}:`, error);
        hasIncompleteData = true;
        continue;
      }
    }

    // Calculate health factor using BigInt precision
    if (totalBorrows === BigInt(0)) {
      // No borrows means infinite health factor
      return { healthFactor: 'Infinity', isEstimate: hasIncompleteData };
    }

    // Use BigInt arithmetic for precise calculation: (totalEffectiveCollateral * 1e18) / totalBorrows
    // This maintains precision by scaling up before division
    const healthFactorBigInt = (totalEffectiveCollateral * BigInt(10) ** BigInt(18)) / totalBorrows;
    const healthFactor = formatUnits(healthFactorBigInt, 18);
    
    return { 
      healthFactor, 
      isEstimate: hasIncompleteData,
      ...(hasIncompleteData && { error: 'Health factor calculated with incomplete data' })
    };
  } catch (error) {
    return {
      healthFactor: '0',
      isEstimate: true,
      error: `Failed to compute health factor: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
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
        isEstimate: false, // Current health factor is accurate
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
    if (isBelowRecommended(currentHealthFactor)) {
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

    // Calculate estimated health factor after borrow using proper computation
    const healthFactorResult = await computeHealthFactor(
      userAddress,
      assetAddress,
      amountBigInt
    );
    
    if (healthFactorResult.error && !healthFactorResult.isEstimate) {
      warnings.push(`Health factor calculation warning: ${healthFactorResult.error}`);
    }
    
    if (healthFactorResult.isEstimate) {
      warnings.push('Health factor is estimated - actual value will be calculated on-chain');
    }
    
    if (healthFactorResult.healthFactor !== '0' && healthFactorResult.healthFactor !== 'Infinity') {
      if (isLiquidatable(healthFactorResult.healthFactor)) {
        return {
          success: false,
          error: 'Borrowing this amount would put your position at risk of liquidation',
        };
      }
      
      if (isBelowRecommended(healthFactorResult.healthFactor)) {
        warnings.push('This borrow will bring your health factor below the recommended 1.5x');
      }
    }

    try {
      const borrowCalldata = encodeFunctionData({
        abi: UniversalLendingProtocol__factory.abi,
        functionName: 'borrow',
        args: [assetAddress as Address, amountBigInt, userAddress as Address],
      });

      const gasEstimate = await zetaTestnetClient.estimateGas({
        account: userAddress as Address,
        to: protocolAddress as Address,
        data: borrowCalldata,
      });

      return {
        success: true,
        gasEstimate,
        healthFactorAfter: healthFactorResult.healthFactor === 'Infinity' ? 
          currentHealthFactor : healthFactorResult.healthFactor,
        warnings,
        isEstimate: healthFactorResult.isEstimate,
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
    
    // Calculate estimated health factor after withdrawal
    const healthFactorResult = await computeHealthFactor(
      userAddress,
      undefined, undefined, // no borrow simulation
      undefined, undefined, // no supply simulation  
      assetAddress, amountBigInt // withdrawal simulation
    );
    
    if (healthFactorResult.error && !healthFactorResult.isEstimate) {
      warnings.push(`Health factor calculation warning: ${healthFactorResult.error}`);
    }
    
    if (healthFactorResult.isEstimate) {
      warnings.push('Health factor is estimated - actual value will be calculated on-chain');
    }
    
    // Check if withdrawal would affect health factor (if user has borrows)  
    if (currentHealthFactor !== '0' && compareHealthFactors(currentHealthFactor, '2.0') < 0) {
      warnings.push('Withdrawing collateral may affect your health factor');
      
      if (healthFactorResult.healthFactor !== '0' && healthFactorResult.healthFactor !== 'Infinity') {
        if (isLiquidatable(healthFactorResult.healthFactor)) {
          return {
            success: false,
            error: 'Withdrawing this amount would put your position at risk of liquidation',
          };
        }
        
        if (isBelowRecommended(healthFactorResult.healthFactor)) {
          warnings.push('This withdrawal will bring your health factor below the recommended 1.5x');
        }
      } else if (isBelowRecommended(currentHealthFactor)) {
        warnings.push('Your health factor is already below recommended levels');
      }
    }

    try {
      const protocolAddress = getUniversalLendingProtocolAddress(SupportedChain.ZETA_TESTNET);
      if (!protocolAddress) {
        throw new Error('UniversalLendingProtocol address not found');
      }

      const withdrawCalldata = encodeFunctionData({
        abi: UniversalLendingProtocol__factory.abi,
        functionName: 'withdraw',
        args: [assetAddress as Address, amountBigInt, userAddress as Address],
      });

      const gasEstimate = await zetaTestnetClient.estimateGas({
        account: userAddress as Address,
        to: protocolAddress as Address,
        data: withdrawCalldata,
      });

      return {
        success: true,
        gasEstimate,
        healthFactorAfter: healthFactorResult.healthFactor === 'Infinity' ? 
          currentHealthFactor : healthFactorResult.healthFactor,
        warnings,
        isEstimate: healthFactorResult.isEstimate,
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

    // Calculate estimated health factor after repay
    const healthFactorResult = await computeHealthFactor(
      userAddress,
      undefined, undefined, // no borrow simulation
      undefined, undefined, // no supply simulation
      undefined, undefined, // no withdrawal simulation  
      assetAddress, amountBigInt // repay simulation
    );
    
    if (healthFactorResult.error && !healthFactorResult.isEstimate) {
      warnings.push(`Health factor calculation warning: ${healthFactorResult.error}`);
    }
    
    if (healthFactorResult.isEstimate) {
      warnings.push('Health factor is estimated - actual value will be calculated on-chain');
    }

    try {
      const protocolAddress = getUniversalLendingProtocolAddress(SupportedChain.ZETA_TESTNET);
      if (!protocolAddress) {
        throw new Error('UniversalLendingProtocol address not found');
      }

      const repayCalldata = encodeFunctionData({
        abi: UniversalLendingProtocol__factory.abi,
        functionName: 'repay',
        args: [assetAddress as Address, amountBigInt, userAddress as Address],
      });

      const gasEstimate = await zetaTestnetClient.estimateGas({
        account: userAddress as Address,
        to: protocolAddress as Address,
        data: repayCalldata,
      });

      return {
        success: true,
        gasEstimate,
        healthFactorAfter: healthFactorResult.healthFactor === 'Infinity' ? 
          await getUserHealthFactor(userAddress) : healthFactorResult.healthFactor,
        warnings,
        isEstimate: healthFactorResult.isEstimate,
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