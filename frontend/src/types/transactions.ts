/**
 * Transaction types supported by the lending protocol
 */
export type TransactionType = 'supply' | 'withdraw' | 'borrow' | 'repay' | 'liquidate';

/**
 * Common transaction steps shared across all transaction types
 */
export type CommonTransactionStep = 'input' | 'approve' | 'approving' | 'switchNetwork' | 'success' | 'failed';

/**
 * Supply transaction specific steps
 */
export type SupplyTransactionStep = CommonTransactionStep | 'deposit' | 'depositing';

/**
 * Withdraw transaction specific steps
 */
export type WithdrawTransactionStep = CommonTransactionStep | 'withdraw' | 'withdrawing' | 'checkWithdraw' | 'checkGas';

/**
 * Borrow transaction specific steps
 */
export type BorrowTransactionStep = CommonTransactionStep | 'borrow' | 'borrowing';

/**
 * Repay transaction specific steps
 */
export type RepayTransactionStep = CommonTransactionStep | 'repay' | 'repaying';

/**
 * Liquidate transaction specific steps
 */
export type LiquidateTransactionStep = CommonTransactionStep | 'liquidate' | 'liquidating';

/**
 * Union of all possible transaction steps
 */
export type TransactionStep = SupplyTransactionStep | WithdrawTransactionStep | BorrowTransactionStep | RepayTransactionStep | LiquidateTransactionStep;

/**
 * Type mapping for transaction types to their specific steps
 */
export type TransactionStepMap = {
    [K in TransactionType]: K extends 'supply' ? SupplyTransactionStep :
    K extends 'withdraw' ? WithdrawTransactionStep :
    K extends 'borrow' ? BorrowTransactionStep :
    K extends 'repay' ? RepayTransactionStep :
    K extends 'liquidate' ? LiquidateTransactionStep :
    never;
};

/**
 * Helper type to get the specific step type for a transaction type
 */
export type StepsForTransactionType<T extends TransactionType> = TransactionStepMap[T];