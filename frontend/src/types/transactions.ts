/**
 * Transaction types supported by the lending protocol
 */
export type TransactionType = 'supply' | 'withdraw' | 'borrow' | 'repay';

/**
 * Common transaction steps shared across all transaction types
 */
export type CommonTransactionStep = 'input' | 'approve' | 'approving' | 'success' | 'failed';

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
 * Union of all possible transaction steps
 */
export type TransactionStep = SupplyTransactionStep | WithdrawTransactionStep | BorrowTransactionStep | RepayTransactionStep;

/**
 * Type mapping for transaction types to their specific steps
 */
export interface TransactionStepMap {
    supply: SupplyTransactionStep;
    withdraw: WithdrawTransactionStep;
    borrow: BorrowTransactionStep;
    repay: RepayTransactionStep;
}

/**
 * Helper type to get the specific step type for a transaction type
 */
export type StepsForTransactionType<T extends TransactionType> = TransactionStepMap[T];