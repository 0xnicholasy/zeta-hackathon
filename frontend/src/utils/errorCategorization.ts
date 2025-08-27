/**
 * Standardized error categorization system for the lending protocol
 * Provides consistent, user-friendly error messages and actionable guidance
 */

export const ErrorCategory = {
    // User-related errors
    USER_REJECTION: 'USER_REJECTION',
    INSUFFICIENT_FUNDS: 'INSUFFICIENT_FUNDS',
    INVALID_INPUT: 'INVALID_INPUT',
    
    // Network/Connection errors
    NETWORK_ERROR: 'NETWORK_ERROR',
    RPC_ERROR: 'RPC_ERROR',
    WALLET_CONNECTION: 'WALLET_CONNECTION',
    
    // Gas-related errors
    GAS_ESTIMATION_FAILED: 'GAS_ESTIMATION_FAILED',
    INSUFFICIENT_GAS: 'INSUFFICIENT_GAS',
    GAS_PRICE_TOO_LOW: 'GAS_PRICE_TOO_LOW',
    
    // Smart contract errors
    CONTRACT_REVERT: 'CONTRACT_REVERT',
    CONTRACT_NOT_FOUND: 'CONTRACT_NOT_FOUND',
    
    // Protocol-specific errors
    HEALTH_FACTOR_TOO_LOW: 'HEALTH_FACTOR_TOO_LOW',
    INSUFFICIENT_COLLATERAL: 'INSUFFICIENT_COLLATERAL',
    LIQUIDATION_THRESHOLD: 'LIQUIDATION_THRESHOLD',
    ORACLE_ERROR: 'ORACLE_ERROR',
    
    // Cross-chain specific
    CROSS_CHAIN_FAILURE: 'CROSS_CHAIN_FAILURE',
    BRIDGE_ERROR: 'BRIDGE_ERROR',
    
    // Unknown/Generic
    UNKNOWN_ERROR: 'UNKNOWN_ERROR'
} as const;

export type ErrorCategory = typeof ErrorCategory[keyof typeof ErrorCategory];

export interface CategorizedError {
    category: ErrorCategory;
    title: string;
    message: string;
    userAction?: string;
    technicalDetails?: string;
    severity: 'info' | 'warning' | 'error';
    canRetry: boolean;
}

/**
 * Error patterns to match against error messages
 */
const ERROR_PATTERNS: {
    pattern: RegExp | string;
    category: ErrorCategory;
    titleTemplate?: string;
    messageTemplate?: string;
    userAction?: string;
    severity: 'info' | 'warning' | 'error';
    canRetry: boolean;
}[] = [
    // User rejection patterns
    {
        pattern: /user rejected|user denied|user cancelled|rejected by user/i,
        category: ErrorCategory.USER_REJECTION,
        titleTemplate: 'Transaction Cancelled',
        messageTemplate: 'You cancelled the transaction in your wallet.',
        userAction: 'Click "Try Again" to retry the transaction.',
        severity: 'info',
        canRetry: true
    },
    
    // Insufficient funds patterns
    {
        pattern: /insufficient funds|insufficient balance|insufficient.*balance/i,
        category: ErrorCategory.INSUFFICIENT_FUNDS,
        titleTemplate: 'Insufficient Funds',
        messageTemplate: 'You don\'t have enough tokens to complete this transaction.',
        userAction: 'Add more funds to your wallet or reduce the amount.',
        severity: 'error',
        canRetry: false
    },
    
    // Gas estimation patterns
    {
        pattern: /gas.*required.*exceeds.*allowance|out of gas|gas.*limit|gas.*estimation.*failed|cannot estimate gas/i,
        category: ErrorCategory.GAS_ESTIMATION_FAILED,
        titleTemplate: 'Gas Estimation Failed',
        messageTemplate: 'Unable to estimate gas costs for this transaction.',
        userAction: 'This usually indicates a transaction that would fail. Check your balance and try again.',
        severity: 'warning',
        canRetry: true
    },
    
    // Network errors
    {
        pattern: /network.*error|connection.*error|fetch.*error|timeout|network.*request.*failed/i,
        category: ErrorCategory.NETWORK_ERROR,
        titleTemplate: 'Network Error',
        messageTemplate: 'Unable to connect to the blockchain network.',
        userAction: 'Check your internet connection and try again.',
        severity: 'warning',
        canRetry: true
    },
    
    // RPC errors
    {
        pattern: /rpc.*error|json.*rpc|rpc.*call.*failed/i,
        category: ErrorCategory.RPC_ERROR,
        titleTemplate: 'RPC Error',
        messageTemplate: 'Communication error with the blockchain network.',
        userAction: 'Try switching to a different RPC endpoint or try again later.',
        severity: 'warning',
        canRetry: true
    },
    
    // Wallet connection errors
    {
        pattern: /wallet.*not.*connected|no.*provider|wallet.*connection|metamask.*not.*installed/i,
        category: ErrorCategory.WALLET_CONNECTION,
        titleTemplate: 'Wallet Connection Error',
        messageTemplate: 'Unable to connect to your wallet.',
        userAction: 'Make sure your wallet is installed and connected.',
        severity: 'error',
        canRetry: true
    },
    
    // Contract revert errors
    {
        pattern: /execution.*reverted|transaction.*reverted|revert/i,
        category: ErrorCategory.CONTRACT_REVERT,
        titleTemplate: 'Transaction Failed',
        messageTemplate: 'The smart contract rejected this transaction.',
        userAction: 'Check the transaction parameters and try again.',
        severity: 'error',
        canRetry: false
    },
    
    // Health factor specific errors  
    {
        pattern: /insufficient.*collateral/i,
        category: ErrorCategory.HEALTH_FACTOR_TOO_LOW,
        titleTemplate: 'Insufficient Collateral',
        messageTemplate: 'This transaction would put your position at risk of liquidation.',
        userAction: 'Add more collateral or reduce the borrowed amount.',
        severity: 'error',
        canRetry: false
    },
    
    // Liquidation threshold errors
    {
        pattern: /liquidation.*threshold|position.*underwater|can.*be.*liquidated/i,
        category: ErrorCategory.LIQUIDATION_THRESHOLD,
        titleTemplate: 'Liquidation Risk',
        messageTemplate: 'Your position is at risk of liquidation.',
        userAction: 'Repay some debt or add more collateral immediately.',
        severity: 'error',
        canRetry: false
    },
    
    // Oracle errors
    {
        pattern: /oracle.*error|price.*feed|stale.*price|invalid.*price/i,
        category: ErrorCategory.ORACLE_ERROR,
        titleTemplate: 'Price Oracle Error',
        messageTemplate: 'Unable to get accurate price information.',
        userAction: 'Wait a moment for price feeds to update and try again.',
        severity: 'warning',
        canRetry: true
    },
    
    // Cross-chain errors
    {
        pattern: /cross.*chain|bridge.*error|gateway.*error|destination.*chain/i,
        category: ErrorCategory.CROSS_CHAIN_FAILURE,
        titleTemplate: 'Cross-Chain Error',
        messageTemplate: 'Failed to complete cross-chain transaction.',
        userAction: 'Check that the destination chain is available and try again.',
        severity: 'warning',
        canRetry: true
    }
];

/**
 * Default error messages for each category
 */
const DEFAULT_CATEGORY_MESSAGES: Record<ErrorCategory, {
    title: string;
    message: string;
    userAction: string;
    severity: 'info' | 'warning' | 'error';
    canRetry: boolean;
}> = {
    [ErrorCategory.USER_REJECTION]: {
        title: 'Transaction Cancelled',
        message: 'The transaction was cancelled.',
        userAction: 'Try the transaction again if you want to proceed.',
        severity: 'info',
        canRetry: true
    },
    [ErrorCategory.INSUFFICIENT_FUNDS]: {
        title: 'Insufficient Funds',
        message: 'You don\'t have enough funds to complete this transaction.',
        userAction: 'Add funds to your wallet or reduce the transaction amount.',
        severity: 'error',
        canRetry: false
    },
    [ErrorCategory.INVALID_INPUT]: {
        title: 'Invalid Input',
        message: 'The transaction parameters are invalid.',
        userAction: 'Check your input values and try again.',
        severity: 'error',
        canRetry: false
    },
    [ErrorCategory.NETWORK_ERROR]: {
        title: 'Network Error',
        message: 'Unable to connect to the network.',
        userAction: 'Check your connection and try again.',
        severity: 'warning',
        canRetry: true
    },
    [ErrorCategory.RPC_ERROR]: {
        title: 'RPC Error',
        message: 'Communication error with the blockchain.',
        userAction: 'Try again or switch to a different network.',
        severity: 'warning',
        canRetry: true
    },
    [ErrorCategory.WALLET_CONNECTION]: {
        title: 'Wallet Error',
        message: 'Unable to connect to your wallet.',
        userAction: 'Check that your wallet is installed and unlocked.',
        severity: 'error',
        canRetry: true
    },
    [ErrorCategory.GAS_ESTIMATION_FAILED]: {
        title: 'Gas Estimation Failed',
        message: 'Unable to estimate transaction costs.',
        userAction: 'The transaction may fail. Check your balance and try again.',
        severity: 'warning',
        canRetry: true
    },
    [ErrorCategory.INSUFFICIENT_GAS]: {
        title: 'Insufficient Gas',
        message: 'Not enough gas to complete the transaction.',
        userAction: 'Add more ETH for gas or reduce the gas limit.',
        severity: 'warning',
        canRetry: false
    },
    [ErrorCategory.GAS_PRICE_TOO_LOW]: {
        title: 'Gas Price Too Low',
        message: 'Transaction gas price is too low.',
        userAction: 'Increase the gas price and try again.',
        severity: 'info',
        canRetry: true
    },
    [ErrorCategory.CONTRACT_REVERT]: {
        title: 'Contract Error',
        message: 'The smart contract rejected the transaction.',
        userAction: 'Check the transaction parameters and try again.',
        severity: 'warning',
        canRetry: true
    },
    [ErrorCategory.CONTRACT_NOT_FOUND]: {
        title: 'Contract Not Found',
        message: 'Unable to find the smart contract.',
        userAction: 'Check that you\'re on the correct network.',
        severity: 'error',
        canRetry: false
    },
    [ErrorCategory.HEALTH_FACTOR_TOO_LOW]: {
        title: 'Health Factor Too Low',
        message: 'This would put your position at risk.',
        userAction: 'Add more collateral or reduce the borrowed amount.',
        severity: 'error',
        canRetry: false
    },
    [ErrorCategory.INSUFFICIENT_COLLATERAL]: {
        title: 'Insufficient Collateral',
        message: 'Not enough collateral for this transaction.',
        userAction: 'Add more collateral before proceeding.',
        severity: 'error',
        canRetry: false
    },
    [ErrorCategory.LIQUIDATION_THRESHOLD]: {
        title: 'Liquidation Risk',
        message: 'Your position is at risk of liquidation.',
        userAction: 'Add collateral or repay debt immediately.',
        severity: 'error',
        canRetry: false
    },
    [ErrorCategory.ORACLE_ERROR]: {
        title: 'Price Feed Error',
        message: 'Unable to get current price information.',
        userAction: 'Wait for price feeds to update and try again.',
        severity: 'warning',
        canRetry: true
    },
    [ErrorCategory.CROSS_CHAIN_FAILURE]: {
        title: 'Cross-Chain Error',
        message: 'Cross-chain transaction failed.',
        userAction: 'Check network status and try again.',
        severity: 'warning',
        canRetry: true
    },
    [ErrorCategory.BRIDGE_ERROR]: {
        title: 'Bridge Error',
        message: 'Error with cross-chain bridge.',
        userAction: 'Check bridge status and try again later.',
        severity: 'warning',
        canRetry: true
    },
    [ErrorCategory.UNKNOWN_ERROR]: {
        title: 'Unknown Error',
        message: 'An unexpected error occurred.',
        userAction: 'Try again or contact support if the problem persists.',
        severity: 'error',
        canRetry: true
    }
};

/**
 * Categorize an error and return structured information
 */
export function categorizeError(error: Error | string | null | undefined): CategorizedError {
    if (!error) {
        const defaultError = DEFAULT_CATEGORY_MESSAGES[ErrorCategory.UNKNOWN_ERROR];
        return {
            category: ErrorCategory.UNKNOWN_ERROR,
            title: defaultError.title,
            message: 'An unexpected error occurred. Please try again.',
            userAction: defaultError.userAction,
            technicalDetails: 'No error details available',
            severity: defaultError.severity,
            canRetry: defaultError.canRetry
        };
    }

    const errorMessage = typeof error === 'string' ? error : error.message || 'Unknown error';
    const errorStack = typeof error === 'string' ? undefined : error.stack;

    // Try to match against known patterns
    for (const pattern of ERROR_PATTERNS) {
        let matches = false;
        
        if (typeof pattern.pattern === 'string') {
            matches = errorMessage.toLowerCase().includes(pattern.pattern.toLowerCase());
        } else {
            matches = pattern.pattern.test(errorMessage);
        }

        if (matches) {
            let message = pattern.messageTemplate ?? DEFAULT_CATEGORY_MESSAGES[pattern.category].message;
            
            // For contract reverts, try to extract the revert reason
            if (pattern.category === ErrorCategory.CONTRACT_REVERT) {
                const revertMatch = errorMessage.match(/execution reverted: (.+)/);
                if (revertMatch) {
                    message = revertMatch[1];
                }
            }
            
            return {
                category: pattern.category,
                title: pattern.titleTemplate ?? DEFAULT_CATEGORY_MESSAGES[pattern.category].title,
                message,
                userAction: pattern.userAction ?? DEFAULT_CATEGORY_MESSAGES[pattern.category].userAction,
                technicalDetails: errorStack ?? errorMessage,
                severity: pattern.severity,
                canRetry: pattern.canRetry
            };
        }
    }

    // Fallback to unknown error
    const defaultError = DEFAULT_CATEGORY_MESSAGES[ErrorCategory.UNKNOWN_ERROR];
    return {
        category: ErrorCategory.UNKNOWN_ERROR,
        title: defaultError.title,
        message: typeof error === 'string' ? errorMessage : defaultError.message,
        userAction: defaultError.userAction,
        technicalDetails: errorStack ?? errorMessage,
        severity: defaultError.severity,
        canRetry: defaultError.canRetry
    };
}

/**
 * Get color classes for different error severities
 */
export function getSeverityClasses(severity: 'info' | 'warning' | 'error'): string {
    switch (severity) {
        case 'info':
            return 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-200';
        case 'warning':
            return 'border-yellow-200 bg-yellow-50 text-yellow-800 dark:border-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200';
        case 'error':
            return 'border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200';
        default:
            return 'border-gray-200 bg-gray-50 text-gray-800 dark:border-gray-800 dark:bg-gray-900/20 dark:text-gray-200';
    }
}

/**
 * Get appropriate icon for error severity
 */
export function getSeverityIcon(severity: 'info' | 'warning' | 'error'): string {
    switch (severity) {
        case 'info':
            return 'ℹ️';
        case 'warning':
            return '⚠️';
        case 'error':
            return '⚠️';
        default:
            return '❓';
    }
}