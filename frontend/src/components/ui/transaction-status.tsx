import { FaCheck, FaTimes, FaClock, FaFileSignature } from 'react-icons/fa';
import { HourglassLoader } from './hourglass-loader';
import { getTransactionUrl, SupportedChain } from '../../contracts/deployments';
import { formatHexString } from '../../utils/formatHexString';
import { useCrossChainTracking } from '../../hooks/useCrossChainTracking';
import { EVMTransactionHash, isEVMTransactionHash, isSolanaTransactionHash } from '@/types/address';
import type { StepsForTransactionType, TransactionType } from '../../types/transactions';
import { getChainDisplayNameFromId } from '../../utils/chainUtils';

interface TransactionStatusProps<T extends TransactionType = TransactionType> {
    currentStep: StepsForTransactionType<T>;
    approvalHash?: EVMTransactionHash | null;
    transactionHash?: EVMTransactionHash | null;
    isApprovingTx?: boolean;
    isApprovalSuccess?: boolean;
    isTransactionTx?: boolean;
    isTransactionSuccess?: boolean;
    chainId?: number;
    crossChain?: ReturnType<typeof useCrossChainTracking>;
    gasTokenInfo?: { amount: bigint; needsApproval: boolean } | null;
    gasTokenSymbol?: string;
    transactionType?: T;
}

function getTransactionLabel(transactionType: TransactionType): string {
    switch (transactionType) {
        case 'supply': return 'Deposit';
        case 'withdraw': return 'Withdrawal';
        case 'borrow': return 'Borrow';
        case 'repay': return 'Repay';
        default: return 'Transaction';
    }
}

export function TransactionStatus<T extends TransactionType = TransactionType>({
    currentStep,
    approvalHash,
    transactionHash,
    isApprovingTx,
    isApprovalSuccess,
    isTransactionTx,
    isTransactionSuccess,
    chainId = SupportedChain.ZETA_TESTNET,
    crossChain,
    gasTokenInfo,
    gasTokenSymbol = 'ETH',
    transactionType = 'supply' as T,
}: TransactionStatusProps<T>) {
    const destinationChainName = getChainDisplayNameFromId(chainId);
    // Network switch step
    if (currentStep === 'switchNetwork') {
        return (
            <div className="flex flex-col items-center py-6">
                <HourglassLoader size="lg" className="mb-4" />
                <div className="text-center text-md text-muted-foreground">
                    Switching network...
                </div>
                <div className="mt-2 text-sm text-muted-foreground text-center">
                    Please approve the network switch in your wallet
                </div>
            </div>
        );
    }

    // Approval step
    if (currentStep === 'approve') {
        return (
            <div className="flex flex-col items-center py-6">
                <div className="size-9 bg-zeta-500 rounded-full flex items-center justify-center mb-4">
                    <FaFileSignature className="w-5 h-5 text-white ml-1" />
                </div>
                <div className="text-center text-md text-muted-foreground">
                    You need to approve {transactionType === 'withdraw' ? 'gas tokens' : 'tokens'} before proceeding.
                </div>
                {gasTokenInfo && transactionType === 'withdraw' && (
                    <div className="mt-2 text-sm text-muted-foreground text-center">
                        Approving {gasTokenInfo.amount.toString()} {gasTokenSymbol}
                    </div>
                )}
            </div>
        );
    }

    // Loading states
    if (['checkWithdraw', 'checkGas', 'approving', 'depositing', 'withdrawing', 'borrowing', 'repaying'].includes(currentStep)) {
        return (
            <div className="flex flex-col items-center py-6">
                <HourglassLoader size="lg" className="mb-4" />
                <div className="text-center text-sm text-muted-foreground">
                    {currentStep === 'checkWithdraw' && 'Validating withdrawal eligibility...'}
                    {currentStep === 'checkGas' && 'Checking gas token requirements...'}
                    {currentStep === 'approving' && 'Waiting for approval transaction...'}
                    {currentStep === 'depositing' && 'Waiting for deposit transaction...'}
                    {currentStep === 'withdrawing' && 'Waiting for withdrawal transaction...'}
                    {currentStep === 'borrowing' && 'Waiting for borrow transaction...'}
                    {currentStep === 'repaying' && 'Waiting for repay transaction...'}
                </div>

                {/* Show transaction hashes */}
                {approvalHash && currentStep === 'approving' && (
                    <div className="mt-2 text-xs text-muted-foreground flex items-center flex-nowrap">
                        <span>Approval:</span>
                        <a
                            href={getTransactionUrl(chainId, approvalHash) ?? '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-1 text-primary hover:text-primary/80 underline flex-shrink-0"
                        >
                            {formatHexString(approvalHash)}
                        </a>
                        {isApprovingTx && <FaClock className="ml-2 w-3 h-3 text-muted-foreground flex-shrink-0" />}
                        {isApprovalSuccess && <FaCheck className="ml-2 w-3 h-3 text-text-success-light dark:text-text-success-dark flex-shrink-0" />}
                    </div>
                )}

                {transactionHash && (currentStep === 'depositing' || currentStep === 'withdrawing' || currentStep === 'borrowing' || currentStep === 'repaying') && (
                    <div className="mt-2 text-xs text-muted-foreground flex items-center flex-nowrap">
                        <span>{getTransactionLabel(transactionType)}:</span>
                        <a
                            href={getTransactionUrl(chainId, transactionHash) ?? '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-1 text-primary hover:text-primary/80 underline flex-shrink-0"
                        >
                            {formatHexString(transactionHash)}
                        </a>
                        {isTransactionTx && <FaClock className="ml-2 w-3 h-3 text-muted-foreground flex-shrink-0" />}
                        {isTransactionSuccess && <FaCheck className="ml-2 w-3 h-3 text-text-success-light dark:text-text-success-dark flex-shrink-0" />}
                    </div>
                )}
            </div>
        );
    }

    // Failed state
    if (currentStep === 'failed') {
        return (
            <div className="flex flex-col items-center py-6">
                <div className="w-8 h-8 bg-text-error-light dark:bg-text-error-dark rounded-full flex items-center justify-center mb-4">
                    <FaTimes className="w-5 h-5 text-white" />
                </div>
                <div className="text-center text-sm text-muted-foreground">
                    {getTransactionLabel(transactionType)} failed. Please try again.
                </div>
            </div>
        );
    }

    // Success state
    if (currentStep === 'success') {
        return (
            <div className="flex flex-col items-center py-6">
                {/* Show appropriate icon based on cross-chain status */}
                {crossChain?.status === 'pending' && (
                    <HourglassLoader size="lg" className="mb-4" />
                )}
                {(crossChain?.status === 'success' || crossChain?.status === 'idle' || !crossChain) && (
                    <div className="w-8 h-8 bg-text-success-light dark:bg-text-success-dark rounded-full flex items-center justify-center mb-4">
                        <FaCheck className="w-5 h-5 text-white" />
                    </div>
                )}
                {crossChain?.status === 'failed' && (
                    <div className="w-8 h-8 bg-text-error-light dark:bg-text-error-dark rounded-full flex items-center justify-center mb-4">
                        <FaTimes className="w-5 h-5 text-white" />
                    </div>
                )}

                <div className="text-center text-sm text-muted-foreground">
                    {!crossChain && `Your ${transactionType} transaction has been completed successfully!`}
                    {crossChain?.status === 'pending' && `Processing cross-chain ${transactionType} ${['withdraw', 'borrow'].includes(transactionType) ? `to ${destinationChainName}` : 'to ZetaChain'}...`}
                    {crossChain?.status === 'success' && `Cross-chain ${transactionType} completed successfully! ${transactionType === 'supply' ? 'Tokens are now available for borrowing.' :
                        transactionType === 'borrow' ? `Borrowed assets have been sent to ${destinationChainName}.` :
                            transactionType === 'repay' ? 'Debt has been successfully repaid.' :
                                `Assets have been sent to ${destinationChainName}.`
                        }`}
                    {crossChain?.status === 'failed' && `Cross-chain ${transactionType} failed. Please check the transaction status or try again.`}
                    {crossChain?.status === 'idle' && `Your ${transactionType} transaction has been completed successfully! Starting cross-chain transfer...`}
                </div>

                {/* Show transaction hashes */}
                {transactionHash && (
                    <div className="mt-2 text-xs text-muted-foreground flex items-center flex-nowrap">
                        <span>{getTransactionLabel(transactionType)}:</span>
                        <a
                            href={getTransactionUrl(chainId, transactionHash) ?? '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-1 text-primary hover:text-primary/80 underline flex-shrink-0"
                        >
                            {formatHexString(transactionHash)}
                        </a>
                        <FaCheck className="ml-2 w-3 h-3 text-text-success-light dark:text-text-success-dark flex-shrink-0" />
                    </div>
                )}

                {/* Show cross-chain transaction hash */}
                {crossChain?.txHash && crossChain?.status !== 'idle' && (
                    <div className="mt-1 text-xs text-muted-foreground flex items-center flex-nowrap">
                        <span>Cross-chain:</span>
                        <a
                            href={`https://zetachain-athens.blockpi.network/lcd/v1/public/zeta-chain/crosschain/inboundHashToCctxData/${crossChain.txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-1 text-primary hover:text-primary/80 underline flex-shrink-0"
                        >
                            {isEVMTransactionHash(crossChain.txHash) && formatHexString(crossChain.txHash)}
                            {isSolanaTransactionHash(crossChain.txHash) && crossChain.txHash}
                        </a>
                        {crossChain.status === 'pending' && <FaClock className="ml-2 w-3 h-3 text-muted-foreground flex-shrink-0" />}
                        {crossChain.status === 'success' && <FaCheck className="ml-2 w-3 h-3 text-text-success-light dark:text-text-success-dark flex-shrink-0" />}
                        {crossChain.status === 'failed' && <FaTimes className="ml-2 w-3 h-3 text-text-error-light dark:text-text-error-dark flex-shrink-0" />}
                    </div>
                )}
            </div>
        );
    }

    return null;
}