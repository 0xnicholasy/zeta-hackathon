import { parseUnits, formatUnits } from 'viem';

/**
 * Comprehensive input validation utilities for lending protocol
 * Handles edge cases like decimal precision, minimum amounts, balance checks
 */

export interface ValidationResult {
    isValid: boolean;
    error?: string;
    warnings?: string[];
    normalizedValue?: string;
}

export interface AmountValidationOptions {
    decimals: number;
    maxAmount?: string;
    minAmount?: string;
    maxDecimalPlaces?: number;
    allowZero?: boolean;
    tokenSymbol?: string;
}

/**
 * Validates and normalizes amount input with comprehensive edge case handling
 */
export function validateAmountInput(
    input: string,
    options: AmountValidationOptions
): ValidationResult {
    const {
        decimals,
        maxAmount,
        minAmount = '0',
        maxDecimalPlaces,
        allowZero = false,
        tokenSymbol = 'token'
    } = options;

    // Handle empty input
    if (!input || input.trim() === '') {
        return {
            isValid: false,
            error: 'Amount is required'
        };
    }

    const trimmedInput = input.trim();

    // Check for invalid characters
    // Option 1: Keep simple format, explicitly reject scientific notation
    if (!/^[0-9]*\.?[0-9]*$/.test(trimmedInput)) {
        return {
            isValid: false,
            error: 'Amount must contain only numbers and decimal point'
        };
    }
    
    // Later, after parseFloat:
    if (trimmedInput.toLowerCase().includes('e')) {
        return {
            isValid: false,
            error: 'Scientific notation is not allowed'
        };
    }

    // Check for multiple decimal points
    if ((trimmedInput.match(/\./g) ?? []).length > 1) {
        return {
            isValid: false,
            error: 'Amount cannot have multiple decimal points'
        };
    }

    // Check for leading/trailing decimal points
    if (trimmedInput.startsWith('.') || trimmedInput.endsWith('.')) {
        return {
            isValid: false,
            error: 'Amount cannot start or end with decimal point'
        };
    }

    // Parse as number for validation
    const numericValue = parseFloat(trimmedInput);

    // Check if it's a valid number
    if (isNaN(numericValue) || !isFinite(numericValue)) {
        return {
            isValid: false,
            error: 'Invalid number format'
        };
    }

    // Check for negative values
    if (numericValue < 0) {
        return {
            isValid: false,
            error: 'Amount cannot be negative'
        };
    }

    // Check for zero when not allowed
    if (!allowZero && numericValue === 0) {
        return {
            isValid: false,
            error: 'Amount must be greater than zero'
        };
    }

    // Check decimal places
    const decimalPart = trimmedInput.split('.')[1];
    const actualDecimalPlaces = decimalPart ? decimalPart.length : 0;
    const maxAllowedDecimals = maxDecimalPlaces ?? decimals;

    if (actualDecimalPlaces > maxAllowedDecimals) {
        return {
            isValid: false,
            error: `Amount cannot have more than ${maxAllowedDecimals} decimal places`
        };
    }

    // Check minimum amount
    if (minAmount && minAmount !== '0') {
        try {
            const inputWei = parseUnits(trimmedInput, decimals);
            const minWei = parseUnits(minAmount, decimals);
            if (inputWei < minWei) {
                return {
                    isValid: false,
                    error: `Amount must be at least ${minAmount} ${tokenSymbol}`
                };
            }
        } catch {
            // Fallback to float comparison if parseUnits fails
            const minAmountNum = parseFloat(minAmount);
            if (numericValue < minAmountNum) {
                return {
                    isValid: false,
                    error: `Amount must be at least ${minAmount} ${tokenSymbol}`
                };
            }
        }
    }

    // Check maximum amount (balance check)
    if (maxAmount) {
        try {
            const inputWei = parseUnits(trimmedInput, decimals);
            const maxWei = parseUnits(maxAmount, decimals);
            if (inputWei > maxWei) {
                return {
                    isValid: false,
                    error: `Amount cannot exceed ${maxAmount} ${tokenSymbol} (available balance)`
                };
            }
        } catch {
            // Fallback to float comparison
            const maxAmountNum = parseFloat(maxAmount);
            if (numericValue > maxAmountNum) {
                return {
                    isValid: false,
                    error: `Amount cannot exceed ${maxAmount} ${tokenSymbol} (available balance)`
                };
            }
        }
    }

    // Check for very small amounts that might cause precision issues
    const warnings: string[] = [];
    try {
        const wei = parseUnits(trimmedInput, decimals);
        const reformatted = formatUnits(wei, decimals);
        
        // Check if the reformatted value differs significantly (precision loss)
        const originalNum = parseFloat(trimmedInput);
        const reformattedNum = parseFloat(reformatted);
        const precisionDiff = originalNum === 0 ? 0 : Math.abs(originalNum - reformattedNum) / originalNum;
        
        if (precisionDiff > 0.0001) { // 0.01% difference threshold
            warnings.push('Amount may lose precision due to token decimals');
        }

        // Check for dust amounts (very small values)
        if (wei > 0n && wei < parseUnits('0.000001', decimals)) {
            warnings.push('Very small amount may not be economical due to gas costs');
        }

    } catch {
        return {
            isValid: false,
            error: 'Amount is too large or precise to handle'
        };
    }

    // All validations passed
    return {
        isValid: true,
        normalizedValue: numericValue.toString(),
        ...(warnings.length > 0 && { warnings })
    };
}

/**
 * Validates health factor requirements for lending operations
 */
export function validateHealthFactorRequirement(
    currentHealthFactor: number,
    newHealthFactor: number,
    operation: 'borrow' | 'withdraw',
    minimumHealthFactor = 1.5
): ValidationResult {
    if (newHealthFactor < minimumHealthFactor) {
        const operationText = operation === 'borrow' ? 'borrowing' : 'withdrawing';
        return {
            isValid: false,
            error: `This ${operationText} would reduce your health factor to ${newHealthFactor.toFixed(3)}, below the minimum of ${minimumHealthFactor}. Please reduce the amount.`
        };
    }

    const warnings: string[] = [];
    
    // Warn if health factor is getting close to liquidation threshold
    if (newHealthFactor < 1.8 && newHealthFactor >= minimumHealthFactor) {
        warnings.push('Your health factor will be close to liquidation risk. Consider reducing the amount.');
    }

    // Warn about significant health factor reduction
    const healthFactorReduction = currentHealthFactor - newHealthFactor;
    if (healthFactorReduction > 1.0) {
        warnings.push('This transaction will significantly reduce your health factor.');
    }

    return {
        isValid: true,
        ...(warnings.length > 0 && { warnings })
    };
}

/**
 * Validates address inputs with proper format checking
 */
export function validateAddressInput(
    address: string,
    addressType: 'evm' | 'solana'
): ValidationResult {
    if (!address || address.trim() === '') {
        return {
            isValid: false,
            error: 'Address is required'
        };
    }

    const trimmedAddress = address.trim();

    if (addressType === 'evm') {
        // EVM address validation (0x + 40 hex chars)
        if (!/^0x[a-fA-F0-9]{40}$/.test(trimmedAddress)) {
            return {
                isValid: false,
                error: 'Invalid EVM address format. Must be 0x followed by 40 hexadecimal characters.'
            };
        }

        // Check for zero address
        if (trimmedAddress.toLowerCase() === '0x0000000000000000000000000000000000000000') {
            return {
                isValid: false,
                error: 'Cannot use zero address'
            };
        }

    } else if (addressType === 'solana') {
        // Solana address validation (base58, typically 32-44 chars)
        if (!/^[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]{32,44}$/.test(trimmedAddress)) {
            return {
                isValid: false,
                error: 'Invalid Solana address format. Must be a base58 encoded string.'
            };
        }
    }

    return {
        isValid: true,
        normalizedValue: trimmedAddress
    };
}

/**
 * Validates gas fee requirements and availability
 */
export function validateGasRequirements(
    gasTokenBalance: string,
    estimatedGasFee: string,
    gasTokenSymbol: string
): ValidationResult {
    const balanceNum = parseFloat(gasTokenBalance);
    const feeNum = parseFloat(estimatedGasFee);

    if (balanceNum < feeNum) {
        return {
            isValid: false,
            error: `Insufficient ${gasTokenSymbol} balance for gas fees. Need ${estimatedGasFee} ${gasTokenSymbol}, have ${gasTokenBalance} ${gasTokenSymbol}.`
        };
    }

    const warnings: string[] = [];

    // Warn if gas fee is a significant portion of balance
    const feePercentage = (feeNum / balanceNum) * 100;
    if (feePercentage > 50) {
        warnings.push(`Gas fee (${estimatedGasFee} ${gasTokenSymbol}) is ${feePercentage.toFixed(1)}% of your balance.`);
    }

    // Warn about high gas fees
    const highGasThreshold = 0.01; // Adjust based on token
    if (feeNum > highGasThreshold) {
        warnings.push(`Gas fee is relatively high. Consider waiting for lower network congestion.`);
    }

    return {
        isValid: true,
        ...(warnings.length > 0 && { warnings })
    };
}

/**
 * Validates slippage tolerance for cross-chain operations
 */
export function validateSlippageTolerance(slippage: string): ValidationResult {
    const slippageNum = parseFloat(slippage);

    if (isNaN(slippageNum) || slippageNum < 0) {
        return {
            isValid: false,
            error: 'Slippage must be a positive number'
        };
    }

    if (slippageNum > 100) {
        return {
            isValid: false,
            error: 'Slippage cannot exceed 100%'
        };
    }

    const warnings: string[] = [];

    if (slippageNum < 0.1) {
        warnings.push('Very low slippage may cause transaction failures');
    }

    if (slippageNum > 5) {
        warnings.push('High slippage tolerance may result in unfavorable rates');
    }

    return {
        isValid: true,
        ...(warnings.length > 0 && { warnings })
    };
}

/**
 * Utility to format validation errors for display
 */
export function formatValidationError(result: ValidationResult): {
    errorMessage?: string;
    warningMessages?: string[];
    hasErrors: boolean;
    hasWarnings: boolean;
} {
    return {
        ...(result.error && { errorMessage: result.error }),
        ...(result.warnings && { warningMessages: result.warnings }),
        hasErrors: !result.isValid,
        hasWarnings: Boolean(result.warnings?.length)
    };
}