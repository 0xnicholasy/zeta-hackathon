/**
 * Utility functions for health factor calculations and display
 */

/**
 * Returns the appropriate CSS color class string based on health factor value
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
 * @param healthFactor - The health factor value to format
 * @returns Formatted string representation of the health factor
 */
export const formatHealthFactor = (healthFactor: number): string => {
    if (healthFactor === Infinity || healthFactor > 999) {
        return '∞';
    }
    return healthFactor.toFixed(2);
};