/**
 * Utility functions for health factor calculations and display
 * Provides both legacy Number-based utilities and new precision-safe string-based utilities
 */

import { parseUnits } from 'viem';

/**
 * Safely parse a decimal string to a 1e18-scaled bigint
 */
const parseHealthFactorToBigInt = (value: string): bigint => {
  return parseUnits(value, 18);
};

/**
 * Compare two health factor strings with full precision
 * @param healthFactorA - First health factor as formatted string
 * @param healthFactorB - Second health factor as formatted string  
 * @returns -1 if A < B, 0 if A = B, 1 if A > B
 */
export const compareHealthFactors = (healthFactorA: string, healthFactorB: string): number => {
  // Handle infinity cases
  const aIsInf = healthFactorA === 'Infinity' || healthFactorA === '∞';
  const bIsInf = healthFactorB === 'Infinity' || healthFactorB === '∞';
  if (aIsInf && bIsInf) return 0;
  if (aIsInf) return 1;
  if (bIsInf) return -1;

  const a = parseHealthFactorToBigInt(healthFactorA);
  const b = parseHealthFactorToBigInt(healthFactorB);

  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
};

/**
 * Check if health factor is below liquidation threshold (1.2)
 * @param healthFactor - The health factor as formatted string
 * @returns true if liquidatable
 */
export const isLiquidatable = (healthFactor: string): boolean => {
  if (healthFactor === 'Infinity' || healthFactor === '∞') {
    return false;
  }
  return compareHealthFactors(healthFactor, '1.2') < 0;
};

/**
 * Check if health factor is below recommended threshold
 * @param healthFactor - The health factor as formatted string
 * @param recommendedThreshold - The recommended threshold as formatted string (default 2.0)
 * @returns true if below recommended
 */
export const isBelowRecommended = (healthFactor: string, recommendedThreshold: string = '2.0'): boolean => {
  if (healthFactor === 'Infinity' || healthFactor === '∞') {
    return false;
  }
  return compareHealthFactors(healthFactor, recommendedThreshold) < 0;
};

/**
 * Get health factor color class using string-based health factor
 * @param healthFactor - The health factor as formatted string
 * @returns CSS color class string for the health factor
 */
export const getHealthFactorColorClassFromString = (healthFactor: string): string => {
  if (healthFactor === 'Infinity' || healthFactor === '∞') {
    return 'text-green-600 dark:text-green-400';
  }
  if (compareHealthFactors(healthFactor, '1.2') < 0) {
    return 'text-red-600 dark:text-red-400';
  } else if (compareHealthFactors(healthFactor, '2.0') <= 0) {
    return 'text-yellow-600 dark:text-yellow-400';
  } else {
    return 'text-green-600 dark:text-green-400';
  }
};

/**
 * Format a string health factor for display, handling infinity cases
 * @param healthFactor - The health factor as formatted string
 * @returns Formatted string representation of the health factor
 */
export const formatHealthFactorFromString = (healthFactor: string): string => {
  if (healthFactor === 'Infinity' || healthFactor === '∞') {
    return '∞';
  }
  
  // Handle invalid input
  const numValue = parseFloat(healthFactor);
  if (isNaN(numValue)) {
    return '0.00';
  }
  
  // Handle very large values (>= 999.9 treated as infinity)
  if (numValue >= 999.9) {
    return '∞';
  }
  
  // Format to 2 decimal places
  return numValue.toFixed(2);
};

// Legacy Number-based utilities (deprecated - use string-based versions for precision)

/**
 * Returns the appropriate CSS color class string based on health factor value
 * @deprecated Use getHealthFactorColorClassFromString for better precision
 * @param healthFactor - The health factor value to evaluate
 * @returns CSS color class string for the health factor
 */
export const getHealthFactorColorClass = (healthFactor: number): string => {
    if (healthFactor < 1.2) {
        return 'text-red-600 dark:text-red-400';
    } else if (healthFactor < 1.5) {
        return 'text-yellow-600 dark:text-yellow-400';
    } else {
        return 'text-green-600 dark:text-green-400';
    }
};

/**
 * Formats a health factor value for display, handling infinity cases
 * @deprecated Use formatHealthFactorFromString for better precision
 * @param healthFactor - The health factor value to format
 * @returns Formatted string representation of the health factor
 */
export const formatHealthFactor = (healthFactor: number): string => {
    if (healthFactor === Infinity || healthFactor > 999) {
        return '∞';
    }
    return healthFactor.toFixed(2);
};