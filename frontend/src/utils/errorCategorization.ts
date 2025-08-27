/**
 * Standardized error categorization system for the lending protocol
 * Provides consistent, user-friendly error messages and actionable guidance
 */

export const ErrorCategory = {
    // User-related errors
    USER_REJECTION: 'user_rejection',
    INSUFFICIENT_FUNDS: 'insufficient_funds',
    INVALID_INPUT: 'invalid_input',
    
    // Network/Connection errors
    NETWORK_ERROR: 'network_error',
    RPC_ERROR: 'rpc_error',
    WALLET_CONNECTION: 'wallet_connection',
    
    // Gas-related errors
    GAS_ESTIMATION_FAILED: 'gas_estimation_failed',
    INSUFFICIENT_GAS: 'insufficient_gas',
    GAS_PRICE_TOO_LOW: 'gas_price_too_low',
    
    // Smart contract errors
    CONTRACT_REVERT: 'contract_revert',
    CONTRACT_NOT_FOUND: 'contract_not_found',
    
    // Protocol-specific errors
    HEALTH_FACTOR_TOO_LOW: 'health_factor_too_low',
    INSUFFICIENT_COLLATERAL: 'insufficient_collateral',
    LIQUIDATION_THRESHOLD: 'liquidation_threshold',
    ORACLE_ERROR: 'oracle_error',
    
    // Cross-chain specific
    CROSS_CHAIN_FAILURE: 'cross_chain_failure',
    BRIDGE_ERROR: 'bridge_error',
    
    // Unknown/Generic
    UNKNOWN_ERROR: 'unknown_error'
} as const;

export type ErrorCategory = typeof ErrorCategory[keyof typeof ErrorCategory];

export interface CategorizedError {
    category: ErrorCategory;
    title: string;
    message: string;
    userAction?: string;
    technicalDetails?: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
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
    severity: 'low' | 'medium' | 'high' | 'critical';
    canRetry: boolean;
}[] = [
    // User rejection patterns
    {
        pattern: /user rejected|user denied|user cancelled|rejected by user/i,
        category: ErrorCategory.USER_REJECTION,
        titleTemplate: 'Transaction Cancelled',
        messageTemplate: 'You cancelled the transaction in your wallet.',
        userAction: 'Click "Try Again" to retry the transaction.',
        severity: 'low',
        canRetry: true
    },
    
    // Insufficient funds patterns
    {
        pattern: /insufficient funds|insufficient balance|insufficient.*balance/i,
        category: ErrorCategory.INSUFFICIENT_FUNDS,
        titleTemplate: 'Insufficient Balance',
        messageTemplate: 'You don\'t have enough tokens to complete this transaction.',
        userAction: 'Add more funds to your wallet or reduce the amount.',
        severity: 'medium',
        canRetry: false
    },
    
    // Gas estimation patterns
    {
        pattern: /gas.*required.*exceeds.*allowance|out of gas|gas.*limit|gas.*estimation.*failed/i,
        category: ErrorCategory.GAS_ESTIMATION_FAILED,
        titleTemplate: 'Gas Estimation Failed',
        messageTemplate: 'Unable to estimate gas costs for this transaction.',
        userAction: 'This usually indicates a transaction that would fail. Check your balance and try again.',
        severity: 'medium',
        canRetry: true
    },
    
    // Network errors
    {
        pattern: /network.*error|connection.*error|fetch.*error|timeout|network.*request.*failed/i,
        category: ErrorCategory.NETWORK_ERROR,
        titleTemplate: 'Network Error',
        messageTemplate: 'Unable to connect to the blockchain network.',
        userAction: 'Check your internet connection and try again.',
        severity: 'medium',
        canRetry: true
    },
    
    // RPC errors
    {
        pattern: /rpc.*error|json.*rpc|rpc.*call.*failed/i,
        category: ErrorCategory.RPC_ERROR,
        titleTemplate: 'RPC Error',
        messageTemplate: 'Communication error with the blockchain network.',
        userAction: 'Try switching to a different RPC endpoint or try again later.',
        severity: 'medium',
        canRetry: true
    },
    
    // Wallet connection errors
    {
        pattern: /wallet.*not.*connected|no.*provider|wallet.*connection|metamask.*not.*installed/i,
        category: ErrorCategory.WALLET_CONNECTION,
        titleTemplate: 'Wallet Connection Error',
        messageTemplate: 'Unable to connect to your wallet.',
        userAction: 'Make sure your wallet is installed and connected.',
        severity: 'high',
        canRetry: true
    },
    
    // Contract revert errors
    {
        pattern: /execution.*reverted|transaction.*reverted|revert/i,
        category: ErrorCategory.CONTRACT_REVERT,
        titleTemplate: 'Transaction Failed',
        messageTemplate: 'The smart contract rejected this transaction.',
        userAction: 'Check the transaction parameters and try again.',
        severity: 'medium',
        canRetry: true
    },
    
    // Health factor specific errors
    {
        pattern: /health.*factor|insufficient.*collateral|below.*minimum.*collateral/i,
        category: ErrorCategory.HEALTH_FACTOR_TOO_LOW,
        titleTemplate: 'Health Factor Too Low',
        messageTemplate: 'This transaction would put your position at risk of liquidation.',
        userAction: 'Add more collateral or reduce the borrowed amount.',
        severity: 'high',
        canRetry: false
    },
    
    // Liquidation threshold errors
    {
        pattern: /liquidation.*threshold|position.*underwater|can.*be.*liquidated/i,
        category: ErrorCategory.LIQUIDATION_THRESHOLD,
        titleTemplate: 'Liquidation Risk',
        messageTemplate: 'Your position is at risk of liquidation.',
        userAction: 'Repay some debt or add more collateral immediately.',
        severity: 'critical',
        canRetry: false
    },
    
    // Oracle errors
    {
        pattern: /oracle.*error|price.*feed|stale.*price|invalid.*price/i,
        category: ErrorCategory.ORACLE_ERROR,
        titleTemplate: 'Price Oracle Error',
        messageTemplate: 'Unable to get accurate price information.',
        userAction: 'Wait a moment for price feeds to update and try again.',
        severity: 'medium',
        canRetry: true
    },
    
    // Cross-chain errors
    {
        pattern: /cross.*chain|bridge.*error|gateway.*error|destination.*chain/i,
        category: ErrorCategory.CROSS_CHAIN_FAILURE,
        titleTemplate: 'Cross-Chain Error',
        messageTemplate: 'Failed to complete cross-chain transaction.',
        userAction: 'Check that the destination chain is available and try again.',
        severity: 'medium',
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
    severity: 'low' | 'medium' | 'high' | 'critical';
    canRetry: boolean;
}> = {
    [ErrorCategory.USER_REJECTION]: {
        title: 'Transaction Cancelled',
        message: 'The transaction was cancelled.',
        userAction: 'Try the transaction again if you want to proceed.',
        severity: 'low',
        canRetry: true
    },
    [ErrorCategory.INSUFFICIENT_FUNDS]: {
        title: 'Insufficient Balance',
        message: 'You don\'t have enough funds to complete this transaction.',
        userAction: 'Add funds to your wallet or reduce the transaction amount.',
        severity: 'medium',
        canRetry: false
    },
    [ErrorCategory.INVALID_INPUT]: {
        title: 'Invalid Input',
        message: 'The transaction parameters are invalid.',
        userAction: 'Check your input values and try again.',
        severity: 'medium',
        canRetry: false
    },
    [ErrorCategory.NETWORK_ERROR]: {
        title: 'Network Error',
        message: 'Unable to connect to the network.',
        userAction: 'Check your connection and try again.',
        severity: 'medium',
        canRetry: true
    },
    [ErrorCategory.RPC_ERROR]: {
        title: 'RPC Error',
        message: 'Communication error with the blockchain.',
        userAction: 'Try again or switch to a different network.',
        severity: 'medium',
        canRetry: true
    },
    [ErrorCategory.WALLET_CONNECTION]: {
        title: 'Wallet Error',
        message: 'Unable to connect to your wallet.',
        userAction: 'Check that your wallet is installed and unlocked.',
        severity: 'high',
        canRetry: true
    },
    [ErrorCategory.GAS_ESTIMATION_FAILED]: {
        title: 'Gas Estimation Failed',
        message: 'Unable to estimate transaction costs.',
        userAction: 'The transaction may fail. Check your balance and try again.',
        severity: 'medium',
        canRetry: true
    },
    [ErrorCategory.INSUFFICIENT_GAS]: {
        title: 'Insufficient Gas',
        message: 'Not enough gas to complete the transaction.',
        userAction: 'Add more ETH for gas or reduce the gas limit.',
        severity: 'medium',
        canRetry: false
    },
    [ErrorCategory.GAS_PRICE_TOO_LOW]: {
        title: 'Gas Price Too Low',
        message: 'Transaction gas price is too low.',
        userAction: 'Increase the gas price and try again.',
        severity: 'low',
        canRetry: true
    },
    [ErrorCategory.CONTRACT_REVERT]: {
        title: 'Contract Error',
        message: 'The smart contract rejected the transaction.',
        userAction: 'Check the transaction parameters and try again.',
        severity: 'medium',
        canRetry: true
    },
    [ErrorCategory.CONTRACT_NOT_FOUND]: {
        title: 'Contract Not Found',
        message: 'Unable to find the smart contract.',
        userAction: 'Check that you\'re on the correct network.',
        severity: 'high',
        canRetry: false
    },
    [ErrorCategory.HEALTH_FACTOR_TOO_LOW]: {
        title: 'Health Factor Too Low',
        message: 'This would put your position at risk.',
        userAction: 'Add more collateral or reduce the borrowed amount.',
        severity: 'high',
        canRetry: false
    },
    [ErrorCategory.INSUFFICIENT_COLLATERAL]: {
        title: 'Insufficient Collateral',
        message: 'Not enough collateral for this transaction.',
        userAction: 'Add more collateral before proceeding.',
        severity: 'high',
        canRetry: false
    },
    [ErrorCategory.LIQUIDATION_THRESHOLD]: {
        title: 'Liquidation Risk',
        message: 'Your position is at risk of liquidation.',
        userAction: 'Add collateral or repay debt immediately.',
        severity: 'critical',
        canRetry: false
    },
    [ErrorCategory.ORACLE_ERROR]: {
        title: 'Price Feed Error',
        message: 'Unable to get current price information.',
        userAction: 'Wait for price feeds to update and try again.',
        severity: 'medium',
        canRetry: true
    },
    [ErrorCategory.CROSS_CHAIN_FAILURE]: {
        title: 'Cross-Chain Error',
        message: 'Cross-chain transaction failed.',
        userAction: 'Check network status and try again.',
        severity: 'medium',
        canRetry: true
    },
    [ErrorCategory.BRIDGE_ERROR]: {
        title: 'Bridge Error',
        message: 'Error with cross-chain bridge.',
        userAction: 'Check bridge status and try again later.',
        severity: 'medium',
        canRetry: true
    },
    [ErrorCategory.UNKNOWN_ERROR]: {
        title: 'Unexpected Error',
        message: 'An unexpected error occurred.',
        userAction: 'Try again or contact support if the problem persists.',
        severity: 'medium',
        canRetry: true
    }
};

/**
 * Categorize an error and return structured information
 */
export function categorizeError(error: Error | string): CategorizedError {
    const errorMessage = typeof error === 'string' ? error : error.message;
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
            return {
                category: pattern.category,
                title: pattern.titleTemplate ?? DEFAULT_CATEGORY_MESSAGES[pattern.category].title,
                message: pattern.messageTemplate ?? DEFAULT_CATEGORY_MESSAGES[pattern.category].message,
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
        message: defaultError.message,
        userAction: defaultError.userAction,
        technicalDetails: errorStack ?? errorMessage,
        severity: defaultError.severity,
        canRetry: defaultError.canRetry
    };
}

/**
 * Get color classes for different error severities
 */
export function getSeverityClasses(severity: 'low' | 'medium' | 'high' | 'critical'): {
    borderClass: string;
    bgClass: string;
    textClass: string;
    iconClass: string;
} {
    switch (severity) {
        case 'low':
            return {
                borderClass: 'border-blue-200 dark:border-blue-800',
                bgClass: 'bg-blue-50 dark:bg-blue-900/20',
                textClass: 'text-blue-800 dark:text-blue-200',
                iconClass: 'text-blue-600'
            };
        case 'medium':
            return {
                borderClass: 'border-yellow-200 dark:border-yellow-800',
                bgClass: 'bg-yellow-50 dark:bg-yellow-900/20',
                textClass: 'text-yellow-800 dark:text-yellow-200',
                iconClass: 'text-yellow-600'
            };
        case 'high':
            return {
                borderClass: 'border-orange-200 dark:border-orange-800',
                bgClass: 'bg-orange-50 dark:bg-orange-900/20',
                textClass: 'text-orange-800 dark:text-orange-200',
                iconClass: 'text-orange-600'
            };
        case 'critical':
            return {
                borderClass: 'border-red-200 dark:border-red-800',
                bgClass: 'bg-red-50 dark:bg-red-900/20',
                textClass: 'text-red-800 dark:text-red-200',
                iconClass: 'text-red-600'
            };
        default:
            return {
                borderClass: 'border-gray-200 dark:border-gray-800',
                bgClass: 'bg-gray-50 dark:bg-gray-900/20',
                textClass: 'text-gray-800 dark:text-gray-200',
                iconClass: 'text-gray-600'
            };
    }
}

/**
 * Get appropriate icon for error severity
 */
export function getSeverityIcon(severity: 'low' | 'medium' | 'high' | 'critical'): string {
    switch (severity) {
        case 'low':
            return 'ℹ️';
        case 'medium':
            return '⚠️';
        case 'high':
            return '🚨';
        case 'critical':
            return '🔥';
        default:
            return '❓';
    }
}