import { formatUnits } from 'viem';
import { formatHexString } from '../../utils/formatHexString';
import { TransactionType } from '../../types/transactions';

interface TransactionSummaryProps {
    transactionType: TransactionType;
    amount: string;
    tokenSymbol: string;
    destinationChain?: string;
    recipientAddress?: string;
    isGasToken?: boolean;
    // gasFeeAmount?: bigint;
    // gasTokenSymbol?: string;
    // gasTokenDecimals?: number;
    formattedReceiveAmount?: string;
    className?: string;
}

export function TransactionSummary({
    transactionType,
    amount,
    tokenSymbol,
    destinationChain,
    recipientAddress,
    isGasToken = false,
    // gasFeeAmount,
    // gasTokenSymbol,
    // gasTokenDecimals = 18,
    formattedReceiveAmount,
    className = '',
}: TransactionSummaryProps) {
    const isSupply = transactionType === 'supply';
    const isWithdraw = transactionType === 'withdraw';
    const isBorrow = transactionType === 'borrow';
    const isRepay = transactionType === 'repay';

    return (
        <div className={`p-3 border border-border rounded-lg text-sm break-words ${className}`}>
            <div className="text-foreground font-medium mb-1">
                Transaction Summary
            </div>
            <div className="text-muted-foreground break-words">
                {isSupply && (
                    <>
                        You will supply {amount} {tokenSymbol} as collateral to the lending protocol on ZetaChain.
                    </>
                )}
                {isWithdraw && (
                    <>
                        {isGasToken ? (
                            <>
                                You will withdraw {amount} {tokenSymbol} from the lending protocol.
                                After deducting gas fees, you will receive{' '}
                                <strong>
                                    {formattedReceiveAmount ?
                                        Number(formattedReceiveAmount).toLocaleString('en-US', {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 6
                                        }) : '0'} {tokenSymbol}
                                </strong> on {destinationChain}.
                            </>
                        ) : (
                            <>
                                You will withdraw {amount} {tokenSymbol} from the lending protocol back to {destinationChain}.
                            </>
                        )}
                    </>
                )}
                {isBorrow && (
                    <>
                        You will borrow {amount} {tokenSymbol} from the lending protocol using your collateral. The borrowed amount will be sent to your wallet on {destinationChain || 'the selected chain'}.
                    </>
                )}
                {isRepay && (
                    <>
                        You will repay {amount} {tokenSymbol} to the lending protocol. This will reduce your debt and improve your health factor.
                    </>
                )}
            </div>

            {recipientAddress && (
                <div className="text-muted-foreground text-xs mt-2">
                    Recipient: {formatHexString(recipientAddress)}
                </div>
            )}

            <div className="text-muted-foreground text-xs mt-2">
                {isSupply && 'Cross-chain deposit fees may apply.'}
                {isWithdraw && (
                    isGasToken ?
                        'Gas fee is paid from the withdrawal amount' :
                        'Note: Cross-chain withdrawal fees will be deducted from the amount.'
                )}
                {isBorrow && 'Cross-chain transaction fees may apply. Ensure sufficient collateral to maintain health factor above 1.5.'}
                {isRepay && 'Repaying debt will improve your health factor and free up borrowing capacity.'}
            </div>
        </div>
    );
}

interface GasFeeInfoProps {
    isGasToken: boolean;
    gasFeeAmount?: bigint;
    gasTokenSymbol?: string;
    gasTokenDecimals?: number;
    className?: string;
}

export function GasFeeInfo({
    isGasToken,
    gasFeeAmount,
    gasTokenSymbol = 'ETH',
    gasTokenDecimals = 18,
    className = '',
}: GasFeeInfoProps) {
    if (!gasFeeAmount) return null;

    return (
        <div className={`p-3 border border-border rounded-lg bg-muted/50 text-sm ${className}`}>
            <div className="text-foreground font-medium mb-1">
                {isGasToken ? 'Transaction Details' : 'Gas Fee Requirements'}
            </div>
            <div className="text-muted-foreground">
                Gas Fee: {formatUnits(gasFeeAmount, gasTokenDecimals)} {gasTokenSymbol}
            </div>
            <div className="text-muted-foreground text-xs mt-1">
                {isGasToken ? (
                    'Gas fee will be deducted from your withdrawal amount'
                ) : (
                    'Different gas token required for cross-chain withdrawal'
                )}
            </div>
        </div>
    );
}

interface ReceiveAmountDisplayProps {
    amount: string;
    tokenSymbol: string;
    gasFeeAmount: bigint;
    gasTokenSymbol: string;
    gasTokenDecimals: number;
    formattedReceiveAmount: string;
    className?: string;
}

export function ReceiveAmountDisplay({
    amount,
    tokenSymbol,
    gasFeeAmount,
    gasTokenSymbol,
    gasTokenDecimals,
    formattedReceiveAmount,
    className = '',
}: ReceiveAmountDisplayProps) {
    return (
        <div className={`p-3 border border-border rounded-lg bg-primary/5 text-sm ${className}`}>
            <div className="text-foreground font-medium mb-1">
                Amount You'll Receive
            </div>
            <div className="text-lg font-semibold text-primary mb-1">
                {Number(formattedReceiveAmount).toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 6
                })} {tokenSymbol}
            </div>
            <div className="text-xs text-muted-foreground">
                = {amount} {tokenSymbol} (withdrawal) - {formatUnits(gasFeeAmount, gasTokenDecimals)} {gasTokenSymbol} (gas fee)
            </div>
        </div>
    );
}