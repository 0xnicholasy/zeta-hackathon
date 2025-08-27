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
    decimals: number,
    maxAmount?: string,
    minAmount?: string
): ValidationResult;
export function validateAmountInput(
    input: string,
    options: AmountValidationOptions
): ValidationResult;
export function validateAmountInput(
    input: string,
    decimalsOrOptions: number | AmountValidationOptions,
    maxAmount?: string,
    minAmount?: string
): ValidationResult {
    // Handle overloaded signatures
    const options: AmountValidationOptions = typeof decimalsOrOptions === 'number' 
        ? {
            decimals: decimalsOrOptions,
            ...(maxAmount !== undefined && { maxAmount }),
            ...(minAmount !== undefined && { minAmount }),
            tokenSymbol: ''
          }
        : decimalsOrOptions;
    const {
        decimals,
        maxAmount: finalMaxAmount,
        minAmount: finalMinAmount = '0',
        maxDecimalPlaces,
        allowZero = false    } = options;

    // Handle empty input
    if (!input || input.trim() === '') {
        return {
            isValid: false,
            error: 'Amount is required'
        };
    }

    const trimmedInput = input.trim();

    // Check for invalid characters - allow negative sign for now
    if (!/^-?[0-9]*\.?[0-9]*$/.test(trimmedInput)) {
        return {
            isValid: false,
            error: 'Invalid number format'
        };
    }
    
    // Check for scientific notation
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
            error: 'Amount must be greater than zero'
        };
    }

    // Check for zero when not allowed
    if (!allowZero && numericValue === 0) {
        return {
            isValid: false,
            error: 'Amount must be greater than zero'
        };
    }

    // Handle decimal precision - round to required decimals
    const decimalPart = trimmedInput.split('.')[1];
    const actualDecimalPlaces = decimalPart ? decimalPart.length : 0;
    const maxAllowedDecimals = maxDecimalPlaces ?? decimals;
    
    let normalizedValue = trimmedInput;
    if (actualDecimalPlaces > maxAllowedDecimals) {
        // Round to the required decimal places
        normalizedValue = numericValue.toFixed(maxAllowedDecimals);
    }

    // Check minimum amount
    if (finalMinAmount && finalMinAmount !== '0') {
        const minAmountNum = parseFloat(finalMinAmount);
        if (numericValue < minAmountNum) {
            return {
                isValid: false,
                error: `Minimum amount is ${finalMinAmount}`
            };
        }
    }

    // Check maximum amount (balance check)
    if (finalMaxAmount) {
        const maxAmountNum = parseFloat(finalMaxAmount);
        if (numericValue > maxAmountNum) {
            // Format the max amount with commas for display
            const formattedMax = new Intl.NumberFormat().format(maxAmountNum);
            return {
                isValid: false,
                error: `Amount exceeds maximum available (${formattedMax})`
            };
        }
    }

    // All validations passed
    return {
        isValid: true,
        normalizedValue,
        error: ''
    };
}


/**
 * Validates address inputs with proper format checking
 */
export function validateAddressInput(address: string): ValidationResult;
export function validateAddressInput(
    address: string,
    addressType: 'evm' | 'solana' = 'evm'
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
                error: 'Invalid address format'
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
        normalizedValue: trimmedAddress,
        error: ''
    };
}

/**
 * Validates health factor requirements for lending operations
 */
export function validateHealthFactorRequirement(
    healthFactor: string,
    minimumHealthFactor: string
): ValidationResult {
    // Handle infinite health factor
    if (healthFactor === '∞' || healthFactor === 'Infinity') {
        return {
            isValid: true,
            error: ''
        };
    }
    
    // Parse health factors
    const hfNum = parseFloat(healthFactor);
    const minHfNum = parseFloat(minimumHealthFactor);
    
    // Check for invalid formats
    if (isNaN(hfNum)) {
        return {
            isValid: false,
            error: 'Invalid health factor format'
        };
    }
    
    if (isNaN(minHfNum)) {
        return {
            isValid: false,
            error: 'Invalid minimum health factor format'
        };
    }
    
    // Check if health factor meets minimum requirement
    if (hfNum < minHfNum) {
        return {
            isValid: false,
            error: `Health factor would drop below minimum requirement (${minHfNum.toFixed(2)})`
        };
    }
    
    return {
        isValid: true,
        error: ''
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