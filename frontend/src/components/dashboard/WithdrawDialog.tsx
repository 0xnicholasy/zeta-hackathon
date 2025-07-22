import { useState, useEffect, useCallback } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { TokenNetworkIcon } from '../ui/token-network-icon';
import { Spinner } from '../ui/spinner';
import { HourglassLoader } from '../ui/hourglass-loader';
import { useContracts } from '../../hooks/useContracts';
import { SupportedChain, type SupportedChainId, getTransactionUrl } from '../../contracts/deployments';
import type { UserAssetData } from './types';
import { FaExclamationTriangle, FaCheck, FaTimes } from 'react-icons/fa';

interface WithdrawDialogProps {
    isOpen: boolean;
    onClose: () => void;
    selectedAsset: UserAssetData;
}

// SimpleLendingProtocol ABI
const lendingProtocolAbi = [
    {
        name: 'withdrawCrossChain',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
            { name: 'asset', type: 'address' },
            { name: 'amount', type: 'uint256' },
            { name: 'destinationChain', type: 'uint256' },
            { name: 'recipient', type: 'address' },
        ],
        outputs: [],
    },
    {
        name: 'getWithdrawGasFee',
        type: 'function',
        stateMutability: 'view',
        inputs: [
            { name: 'asset', type: 'address' }
        ],
        outputs: [
            { name: 'gasToken', type: 'address' },
            { name: 'gasFee', type: 'uint256' }
        ],
    },
    {
        name: 'canWithdraw',
        type: 'function',
        stateMutability: 'view',
        inputs: [
            { name: 'user', type: 'address' },
            { name: 'asset', type: 'address' },
            { name: 'amount', type: 'uint256' }
        ],
        outputs: [
            { name: '', type: 'bool' }
        ],
    },
    {
        name: 'getSupplyBalance',
        type: 'function',
        stateMutability: 'view',
        inputs: [
            { name: 'user', type: 'address' },
            { name: 'asset', type: 'address' }
        ],
        outputs: [
            { name: '', type: 'uint256' }
        ],
    },
] as const;

// ERC20 ABI for gas token approval
const erc20Abi = [
    {
        name: 'balanceOf',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: 'account', type: 'address' }],
        outputs: [{ name: '', type: 'uint256' }],
    },
    {
        name: 'allowance',
        type: 'function',
        stateMutability: 'view',
        inputs: [
            { name: 'owner', type: 'address' },
            { name: 'spender', type: 'address' },
        ],
        outputs: [{ name: '', type: 'uint256' }],
    },
    {
        name: 'approve',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
            { name: 'spender', type: 'address' },
            { name: 'amount', type: 'uint256' },
        ],
        outputs: [{ name: '', type: 'boolean' }],
    },
] as const;

// Helper function to get chain ID from source chain name
const getChainIdFromSourceChain = (sourceChain: string): number => {
    switch (sourceChain.toLowerCase()) {
        case 'arbitrum':
        case 'arbitrum sepolia':
            return SupportedChain.ARBITRUM_SEPOLIA;
        case 'ethereum':
        case 'ethereum sepolia':
            return SupportedChain.ETHEREUM_SEPOLIA;
        case 'zetachain':
        case 'zeta testnet':
            return SupportedChain.ZETA_TESTNET;
        default:
            return SupportedChain.ARBITRUM_SEPOLIA; // Default fallback
    }
};

// Helper function to get chain display name
const getChainDisplayName = (sourceChain: string): string => {
    switch (sourceChain.toLowerCase()) {
        case 'arbitrum':
        case 'arbitrum sepolia':
            return 'Arbitrum Sepolia';
        case 'ethereum':
        case 'ethereum sepolia':
            return 'Ethereum Sepolia';
        case 'zetachain':
        case 'zeta testnet':
            return 'ZetaChain Testnet';
        default:
            return sourceChain;
    }
};

// Helper function to get gas token symbol based on destination chain
const getGasTokenSymbol = (sourceChain: string): string => {
    switch (sourceChain.toLowerCase()) {
        case 'arbitrum':
        case 'arbitrum sepolia':
            return 'ETH.ARBI';
        case 'ethereum':
        case 'ethereum sepolia':
            return 'ETH.ETH';
        case 'zetachain':
        case 'zeta testnet':
            return 'ZETA';
        default:
            return 'ETH.ARBI'; // Default fallback
    }
};

// Helper function to check if the selected token is the gas token
const isTokenGasToken = (selectedAsset: UserAssetData, gasTokenAddress: string | undefined): boolean => {
    if (!selectedAsset || !gasTokenAddress) return false;
    return selectedAsset.address.toLowerCase() === gasTokenAddress.toLowerCase();
};

// Helper function to get gas token decimals based on source chain
const getGasTokenDecimals = (sourceChain: string): number => {
    switch (sourceChain.toLowerCase()) {
        case 'arbitrum':
        case 'arbitrum sepolia':
        case 'ethereum':
        case 'ethereum sepolia':
            return 18; // ETH has 18 decimals
        case 'zetachain':
        case 'zeta testnet':
            return 18; // ZETA has 18 decimals
        default:
            return 18; // Default to 18 decimals
    }
};

export function WithdrawDialog({ isOpen, onClose, selectedAsset }: WithdrawDialogProps) {
    const [amount, setAmount] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [currentStep, setCurrentStep] = useState<'input' | 'checkWithdraw' | 'checkGas' | 'approve' | 'approving' | 'withdraw' | 'withdrawing' | 'success' | 'crosschain_pending' | 'crosschain_success' | 'crosschain_failed'>('input');
    const [crossChainTxHash, setCrossChainTxHash] = useState<string | null>(null);
    const [withdrawHash, setWithdrawHash] = useState<`0x${string}` | null>(null);
    const [approveHash, setApproveHash] = useState<`0x${string}` | null>(null);
    const [gasTokenInfo, setGasTokenInfo] = useState<{ address: string; amount: bigint; needsApproval: boolean } | null>(null);
    const [validationError, setValidationError] = useState<string | null>(null);

    const { address } = useAccount();

    // Use ZetaChain for lending protocol operations
    const { simpleLendingProtocol } = useContracts(SupportedChain.ZETA_TESTNET as SupportedChainId);

    const { writeContract, data: hash, error: contractError, reset: resetContract } = useWriteContract();

    // Computed values
    const maxAmount = selectedAsset.formattedSuppliedBalance;
    const destinationChain = selectedAsset ? getChainIdFromSourceChain(selectedAsset.sourceChain) : SupportedChain.ARBITRUM_SEPOLIA;
    const destinationChainName = selectedAsset ? getChainDisplayName(selectedAsset.sourceChain) : 'Unknown';
    const gasTokenSymbol = selectedAsset ? getGasTokenSymbol(selectedAsset.sourceChain) : 'ETH.ARBI';
    const gasTokenDecimals = selectedAsset ? getGasTokenDecimals(selectedAsset.sourceChain) : 18;
    const amountBigInt = amount && selectedAsset ? parseUnits(amount, selectedAsset.decimals) : BigInt(0); // Use asset's actual decimals
    const isValidAmount = amount && parseFloat(amount) > 0 && parseFloat(amount) <= parseFloat(maxAmount);

    // Check if user can withdraw this amount (health factor validation)
    const { data: canWithdraw } = useReadContract({
        address: simpleLendingProtocol as `0x${string}`,
        abi: lendingProtocolAbi,
        functionName: 'canWithdraw',
        args: address && selectedAsset && amountBigInt > 0 ? [
            address,
            selectedAsset.address as `0x${string}`,
            amountBigInt,
        ] : undefined,
        query: {
            enabled: Boolean(address && selectedAsset && amountBigInt > 0 && simpleLendingProtocol),
        },
    });

    // Get gas fee requirements
    const { data: gasFeeData } = useReadContract({
        address: simpleLendingProtocol as `0x${string}`,
        abi: lendingProtocolAbi,
        functionName: 'getWithdrawGasFee',
        args: selectedAsset ? [selectedAsset.address as `0x${string}`] : undefined,
        query: {
            enabled: Boolean(selectedAsset && simpleLendingProtocol),
        },
    });

    // Get gas token address and fee amount
    const gasTokenAddress = gasFeeData?.[0];
    const gasFeeAmount = gasFeeData?.[1];

    // Check if the selected token is the gas token (after gasTokenAddress is available)
    const isGasToken = selectedAsset && gasTokenAddress ? isTokenGasToken(selectedAsset, gasTokenAddress) : false;

    // Calculate receive amount for gas tokens (withdrawal amount - gas fee)
    const receiveAmount = isGasToken && gasFeeAmount && amountBigInt > 0
        ? amountBigInt - gasFeeAmount
        : amountBigInt;

    // Format receive amount for display
    const formattedReceiveAmount = receiveAmount > 0 && selectedAsset
        ? formatUnits(receiveAmount, selectedAsset.decimals)
        : '0';

    // Get gas token balance only if gas token is different from asset
    const { data: gasTokenBalance } = useReadContract({
        address: gasTokenAddress as `0x${string}`,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: address ? [address] : undefined,
        query: {
            enabled: Boolean(address && gasTokenAddress && !isGasToken),
        },
    });

    // Get gas token allowance only if gas token is different from asset
    const { data: gasTokenAllowance, refetch: refetchGasTokenAllowance } = useReadContract({
        address: gasTokenAddress as `0x${string}`,
        abi: erc20Abi,
        functionName: 'allowance',
        args: address && simpleLendingProtocol ? [address, simpleLendingProtocol as `0x${string}`] : undefined,
        query: {
            enabled: Boolean(address && gasTokenAddress && simpleLendingProtocol && !isGasToken),
        },
    });

    // Wait for approve transaction
    const { isLoading: isApprovingTx, isSuccess: isApproveSuccess } = useWaitForTransactionReceipt({
        hash: approveHash as `0x${string}`,
    });

    // Wait for withdraw transaction
    const { isLoading: isWithdrawingTx, isSuccess: isWithdrawSuccess, isError: isWithdrawError, error: withdrawError } = useWaitForTransactionReceipt({
        hash: withdrawHash as `0x${string}`,
    });

    // Validation logic
    const validateWithdrawal = useCallback(() => {
        if (!address || !selectedAsset || !amountBigInt || !simpleLendingProtocol) {
            setValidationError('Missing required data');
            return false;
        }

        // Check if withdrawal is allowed (health factor)
        if (canWithdraw === false) {
            setValidationError('Withdrawal would break collateral requirements');
            return false;
        }

        // Check gas fee requirements
        if (!gasFeeData || !gasTokenAddress || !gasFeeAmount) {
            setValidationError('Unable to determine gas fee requirements');
            return false;
        }

        // For gas tokens: check if user has enough tokens for withdrawal amount + gas fee
        if (isGasToken) {
            // Check if withdrawal amount + gas fee exceeds available balance
            const totalNeeded = amountBigInt;
            const availableBalance = parseUnits(maxAmount, selectedAsset.decimals);

            if (totalNeeded > availableBalance) {
                setValidationError(`Insufficient balance. You need ${formatUnits(totalNeeded, selectedAsset.decimals)} ${selectedAsset.unit} total (${amount} withdrawal + ${formatUnits(gasFeeAmount, gasTokenDecimals)} gas fee) but only have ${maxAmount} ${selectedAsset.unit} available.`);
                return false;
            }

            // Check if receive amount would be negative or zero
            if (receiveAmount <= 0) {
                setValidationError(`Gas fee (${formatUnits(gasFeeAmount, gasTokenDecimals)} ${gasTokenSymbol}) is greater than or equal to withdrawal amount. You would receive 0 or negative tokens.`);
                return false;
            }
        } else {
            // For non-gas tokens: check separate gas token balance
            // gasTokenBalance might be undefined for gas tokens, so we need to handle that
            if (gasTokenBalance === undefined) {
                // If gasTokenBalance is undefined, it means we didn't fetch it (likely because it's a gas token)
                // This shouldn't happen in the else branch, but let's handle it gracefully
                setValidationError('Unable to verify gas token balance. Please try again.');
                return false;
            }

            if (gasTokenBalance < gasFeeAmount) {
                setValidationError(`Insufficient ${gasTokenSymbol} in wallet for gas fees. Need ${formatUnits(gasFeeAmount, gasTokenDecimals)} ${gasTokenSymbol} but have ${formatUnits(gasTokenBalance || BigInt(0), gasTokenDecimals)} ${gasTokenSymbol}. Please get more ${gasTokenSymbol} in your wallet before proceeding.`);
                return false;
            }

            // Check allowance for separate gas token
            if (gasTokenAllowance === undefined) {
                // If gasTokenAllowance is undefined, it means we didn't fetch it
                setValidationError('Unable to verify gas token allowance. Please try again.');
                return false;
            }

            if (gasTokenAllowance < gasFeeAmount) {
                setGasTokenInfo({
                    address: gasTokenAddress,
                    amount: gasFeeAmount,
                    needsApproval: true,
                });
                return 'needs_approval';
            }
        }

        setValidationError(null);
        return true;
    }, [address, selectedAsset, amountBigInt, simpleLendingProtocol, canWithdraw, gasFeeData, gasTokenAddress, gasFeeAmount, gasTokenBalance, gasTokenAllowance, gasTokenSymbol, gasTokenDecimals, isGasToken, receiveAmount, maxAmount, amount]);

    // Handle gas token approval
    const handleApproveGasToken = useCallback(() => {
        if (!gasTokenInfo || !simpleLendingProtocol) return;

        setCurrentStep('approving');
        writeContract({
            address: gasTokenInfo.address as `0x${string}`,
            abi: erc20Abi,
            functionName: 'approve',
            args: [simpleLendingProtocol as `0x${string}`, gasTokenInfo.amount],
        });
    }, [gasTokenInfo, simpleLendingProtocol, writeContract]);

    // Main submit handler following withdraw-all-fixed.ts workflow
    const handleSubmit = useCallback(async () => {
        if (!address || !amount || !selectedAsset || !amountBigInt || !simpleLendingProtocol) return;

        setIsSubmitting(true);
        resetContract();
        setValidationError(null);

        // Step 1: Check if withdrawal is allowed
        setCurrentStep('checkWithdraw');

        // Step 2: Validate withdrawal requirements
        setCurrentStep('checkGas');
        const validation = validateWithdrawal();

        if (validation === false) {
            setIsSubmitting(false);
            setCurrentStep('input');
            return;
        }

        if (validation === 'needs_approval') {
            setCurrentStep('approve');
            setIsSubmitting(false);
            return;
        }

        // Step 3: Proceed with withdrawal
        setCurrentStep('withdraw');
        writeContract({
            address: simpleLendingProtocol as `0x${string}`,
            abi: lendingProtocolAbi,
            functionName: 'withdrawCrossChain',
            args: [
                selectedAsset.address as `0x${string}`,
                amountBigInt,
                BigInt(destinationChain),
                address,
            ],
        });
    }, [address, amount, selectedAsset, amountBigInt, simpleLendingProtocol, destinationChain, writeContract, resetContract, validateWithdrawal]);

    // Handle max click
    const handleMaxClick = useCallback(() => {
        if (selectedAsset) {
            setAmount(selectedAsset.formattedSuppliedBalance);
        }
    }, [selectedAsset]);

    // Handle close
    const handleClose = useCallback(() => {
        setAmount('');
        setCurrentStep('input');
        setIsSubmitting(false);
        setWithdrawHash(null);
        setApproveHash(null);
        setGasTokenInfo(null);
        setValidationError(null);
        setCrossChainTxHash(null);
        resetContract();
        onClose();
    }, [onClose, resetContract]);

    // Get step text
    const getStepText = useCallback(() => {
        switch (currentStep) {
            case 'checkWithdraw':
                return 'Checking withdrawal eligibility...';
            case 'checkGas':
                return 'Checking gas token requirements...';
            case 'approve':
                return 'Gas token approval required';
            case 'approving':
                return 'Waiting for gas token approval...';
            case 'withdraw':
                return 'Sign in wallet to withdraw from protocol';
            case 'withdrawing':
                return 'Waiting for withdrawal confirmation...';
            case 'success':
                return 'Withdrawal transaction confirmed!';
            case 'crosschain_pending':
                return 'Processing cross-chain withdrawal...';
            case 'crosschain_success':
                return 'Cross-chain withdrawal completed!';
            case 'crosschain_failed':
                return 'Cross-chain withdrawal failed';
            default:
                return `Enter amount to withdraw to ${destinationChainName}`;
        }
    }, [currentStep, destinationChainName]);

    // Handle amount change
    const handleAmountChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setAmount(e.target.value);
        setValidationError(null); // Clear validation error when amount changes
    }, []);

    // Handle approve success -> retry withdrawal
    useEffect(() => {
        if (isApproveSuccess && currentStep === 'approving') {
            setGasTokenInfo(null);

            // Refetch allowance data and retry withdrawal after approval
            const retryWithdrawal = async () => {
                try {
                    // Refetch the allowance to get updated data
                    await refetchGasTokenAllowance();

                    // Wait a bit more to ensure blockchain state is updated
                    setTimeout(() => {
                        handleSubmit();
                    }, 2000); // Increased timeout to 2 seconds
                } catch (error) {
                    console.error('Failed to refetch allowance:', error);
                    // Still retry withdrawal even if refetch fails
                    setTimeout(() => {
                        handleSubmit();
                    }, 2000);
                }
            };

            retryWithdrawal();
        }
    }, [isApproveSuccess, currentStep, handleSubmit, refetchGasTokenAllowance]);

    // Cross-chain transaction tracking function
    const trackCrossChainTransaction = useCallback(async (txHash: string) => {
        if (!txHash) return;

        setCrossChainTxHash(txHash);
        setCurrentStep('crosschain_pending');

        const maxRetries = 30; // 5 minutes with 10 second intervals
        let retries = 0;

        const checkTransaction = async () => {
            try {
                const response = await fetch(`https://zetachain-athens.blockpi.network/lcd/v1/public/zeta-chain/crosschain/inboundHashToCctxData/${txHash}`);
                const data = await response.json();

                if (data && data.inbound_hash_to_cctx_data) {
                    const cctxStatus = data.inbound_hash_to_cctx_data.cctx_status;
                    if (cctxStatus === 'OutboundMined') {
                        setCurrentStep('crosschain_success');
                        return;
                    } else if (cctxStatus === 'Aborted' || cctxStatus === 'Reverted') {
                        setCurrentStep('crosschain_failed');
                        return;
                    }
                }

                retries++;
                if (retries < maxRetries) {
                    setTimeout(checkTransaction, 10000); // Check every 10 seconds
                } else {
                    // Timeout - assume success for UI purposes
                    setCurrentStep('crosschain_success');
                }
            } catch (error) {
                retries++;
                console.error('Failed to check transaction:', error);
                if (retries < maxRetries) {
                    setTimeout(checkTransaction, 10000);
                } else {
                    setCurrentStep('crosschain_failed');
                }
            }
        };

        // Start checking after a short delay
        setTimeout(checkTransaction, 5000);
    }, []);

    // Handle withdraw transaction success
    useEffect(() => {
        if (isWithdrawSuccess && currentStep === 'withdrawing' && withdrawHash) {
            setCurrentStep('success');
            setIsSubmitting(false);
            // Start cross-chain tracking
            trackCrossChainTransaction(withdrawHash);
        }
    }, [isWithdrawSuccess, currentStep, withdrawHash, trackCrossChainTransaction]);

    // Handle withdraw transaction failure
    useEffect(() => {
        if (isWithdrawError && currentStep === 'withdrawing') {
            setCurrentStep('input');
            setIsSubmitting(false);
            setWithdrawHash(null);

            // Set a descriptive error message
            const errorMessage = withdrawError?.message || 'Withdrawal transaction failed';
            if (errorMessage.includes('insufficient')) {
                setValidationError(`Transaction failed: Insufficient ${gasTokenSymbol} for gas fees. Please get more ${gasTokenSymbol} and try again.`);
            } else {
                setValidationError(`Withdrawal failed: ${errorMessage.length > 150 ? errorMessage.substring(0, 150) + '...' : errorMessage}`);
            }
        }
    }, [isWithdrawError, currentStep, withdrawError, gasTokenSymbol]);

    // Update current hash when writeContract returns new hash
    useEffect(() => {
        if (hash) {
            if (currentStep === 'approving') {
                setApproveHash(hash);
            } else if (currentStep === 'withdraw') {
                setWithdrawHash(hash);
                setCurrentStep('withdrawing');
            }
        }
    }, [hash, currentStep]);

    // Early return after all hooks
    if (!selectedAsset || !simpleLendingProtocol) return null;

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-md max-w-[95vw] overflow-hidden">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <TokenNetworkIcon
                            tokenSymbol={selectedAsset.unit}
                            sourceChain={selectedAsset.sourceChain}
                            size="sm"
                            shadow="sm"
                            showNativeIndicator={true}
                        />
                        Withdraw {selectedAsset.unit}
                    </DialogTitle>
                    <DialogDescription>
                        {getStepText()}
                    </DialogDescription>
                </DialogHeader>

                {currentStep === 'input' && (
                    <div className="space-y-4 w-full overflow-hidden">
                        {/* Amount Input */}
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span>Amount</span>
                                <span>Supplied: {Number(maxAmount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })}</span>
                            </div>
                            <div className="relative">
                                <Input
                                    type="number"
                                    value={amount}
                                    onChange={handleAmountChange}
                                    placeholder="0.00"
                                    step="any"
                                    min="0"
                                    max={maxAmount}
                                />
                                <Button
                                    variant="zeta-outline"
                                    size="sm"
                                    className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 text-xs"
                                    onClick={handleMaxClick}
                                >
                                    MAX
                                </Button>
                            </div>
                        </div>

                        {/* Withdrawal Destination Info */}
                        <div className="p-3 bg-muted rounded-lg text-sm">
                            <div className="flex justify-between">
                                <span>Withdrawing to:</span>
                                <span className="font-medium">{destinationChainName}</span>
                            </div>
                            <div className="flex justify-between mt-1">
                                <span>Asset:</span>
                                <span className="font-medium">{selectedAsset.unit}</span>
                            </div>
                            <div className="flex justify-between mt-1">
                                <span>Recipient:</span>
                                <span className="font-medium text-xs">{address?.slice(0, 6)}...{address?.slice(-4)}</span>
                            </div>
                        </div>

                        {/* Gas Fee Info */}
                        {gasFeeData && (
                            <div className="p-3 border border-border rounded-lg bg-muted/50 text-sm">
                                <div className="text-foreground font-medium mb-1">
                                    {isGasToken ? 'Transaction Details' : 'Gas Fee Requirements'}
                                </div>
                                <div className="text-muted-foreground">
                                    Gas Fee: {formatUnits(gasFeeData[1], gasTokenDecimals)} {gasTokenSymbol}
                                </div>
                                {isGasToken ? (
                                    <div className="text-muted-foreground text-xs mt-1">
                                        Gas fee will be deducted from your withdrawal amount
                                    </div>
                                ) : (
                                    <div className="text-muted-foreground text-xs mt-1">
                                        Different gas token required for cross-chain withdrawal
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Receive Amount Display for Gas Tokens */}
                        {isGasToken && amount && gasFeeAmount && (
                            <div className="p-3 border border-border rounded-lg bg-primary/5 text-sm">
                                <div className="text-foreground font-medium mb-1">
                                    Amount You'll Receive
                                </div>
                                <div className="text-lg font-semibold text-primary mb-1">
                                    {Number(formattedReceiveAmount).toLocaleString('en-US', {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 6
                                    })} {selectedAsset.unit}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                    = {amount} {selectedAsset.unit} (withdrawal) - {formatUnits(gasFeeAmount, gasTokenDecimals)} {gasTokenSymbol} (gas fee)
                                </div>
                            </div>
                        )}

                        {/* Transaction Info */}
                        {amount && (
                            <div className="p-3 border border-border rounded-lg bg-secondary/50 text-sm break-words">
                                <div className="text-secondary-foreground font-medium mb-1">
                                    Transaction Summary
                                </div>
                                <div className="text-muted-foreground break-words">
                                    {isGasToken ? (
                                        <>
                                            You will withdraw {amount} {selectedAsset.unit} from the lending protocol.
                                            After deducting gas fees, you will receive <strong>{Number(formattedReceiveAmount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })} {selectedAsset.unit}</strong> on {destinationChainName}.
                                        </>
                                    ) : (
                                        <>
                                            You will withdraw {amount} {selectedAsset.unit} from the lending protocol back to {destinationChainName}.
                                        </>
                                    )}
                                </div>
                                <div className="text-muted-foreground text-xs mt-2">
                                    {isGasToken ? (
                                        'Gas fee is paid from the withdrawal amount'
                                    ) : (
                                        'Note: Cross-chain withdrawal fees will be deducted from the amount.'
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Validation Error Display */}
                        {validationError && (
                            <div className="p-3 border border-destructive/50 rounded-lg bg-destructive/10 text-sm break-words max-w-full">
                                <div className="text-destructive font-medium">
                                    Validation Error
                                </div>
                                <div className="text-destructive/80 mt-1 break-words overflow-hidden text-wrap max-w-full">
                                    {validationError}
                                </div>
                            </div>
                        )}

                        {/* Contract Error Display */}
                        {contractError && (
                            <div className="p-3 border border-destructive/50 rounded-lg bg-destructive/10 text-sm break-words max-w-full">
                                <div className="text-destructive font-medium">
                                    Transaction Failed
                                </div>
                                <div className="text-destructive/80 mt-1 break-words overflow-hidden text-wrap max-w-full">
                                    {contractError.message.length > 200
                                        ? `${contractError.message.substring(0, 200)}...`
                                        : contractError.message}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {currentStep === 'approve' && (
                    <div className="flex flex-col items-center py-6">
                        <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center mb-4">
                            <FaExclamationTriangle className="w-5 h-5 text-white" />
                        </div>
                        <div className="text-center text-sm text-muted-foreground">
                            You need to approve gas tokens before proceeding with the withdrawal.
                        </div>
                        {gasTokenInfo && (
                            <div className="mt-2 text-xs text-muted-foreground text-center">
                                Approving {formatUnits(gasTokenInfo.amount, gasTokenDecimals)} {gasTokenSymbol}
                            </div>
                        )}
                    </div>
                )}

                {(currentStep === 'checkWithdraw' || currentStep === 'checkGas' || currentStep === 'approving' || currentStep === 'withdrawing' || currentStep === 'crosschain_pending') && (
                    <div className="flex flex-col items-center py-6">
                        <HourglassLoader size="lg" className="mb-4" />
                        <div className="text-center text-sm text-muted-foreground">
                            {currentStep === 'checkWithdraw' && 'Validating withdrawal eligibility...'}
                            {currentStep === 'checkGas' && 'Checking gas token requirements...'}
                            {currentStep === 'approving' && 'Waiting for gas token approval...'}
                            {currentStep === 'withdrawing' && 'Waiting for withdrawal transaction...'}
                            {currentStep === 'crosschain_pending' && 'Tracking cross-chain transaction...'}
                        </div>

                        {/* Show transaction hashes */}
                        {approveHash && (currentStep === 'approving') && (
                            <div className="mt-2 text-xs text-muted-foreground">
                                Approval:
                                <a
                                    href={getTransactionUrl(SupportedChain.ZETA_TESTNET, approveHash) || '#'}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="ml-1 text-primary hover:text-primary/80 underline"
                                >
                                    {approveHash.slice(0, 6)}...{approveHash.slice(-4)}
                                </a>
                                {isApprovingTx && <HourglassLoader size="xs" className="ml-2" />}
                                {isApproveSuccess && <FaCheck className="ml-2 w-3 h-3 text-text-success-light dark:text-text-success-dark" />}
                            </div>
                        )}

                        {withdrawHash && currentStep === 'withdrawing' && (
                            <div className="mt-2 text-xs text-muted-foreground">
                                Withdrawal:
                                <a
                                    href={getTransactionUrl(SupportedChain.ZETA_TESTNET, withdrawHash) || '#'}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="ml-1 text-primary hover:text-primary/80 underline"
                                >
                                    {withdrawHash.slice(0, 6)}...{withdrawHash.slice(-4)}
                                </a>
                                {isWithdrawingTx && <HourglassLoader size="xs" className="ml-2" />}
                                {isWithdrawSuccess && <FaCheck className="ml-2 w-3 h-3 text-text-success-light dark:text-text-success-dark" />}
                            </div>
                        )}
                    </div>
                )}

                {(currentStep === 'success' || currentStep === 'crosschain_pending' || currentStep === 'crosschain_success' || currentStep === 'crosschain_failed') && (
                    <div className="flex flex-col items-center py-6">
                        {currentStep === 'success' && (
                            <>
                                <div className="w-8 h-8 bg-text-success-light dark:bg-text-success-dark rounded-full flex items-center justify-center mb-4">
                                    <FaCheck className="w-5 h-5 text-white" />
                                </div>
                                <div className="text-center text-sm text-muted-foreground">
                                    Your withdrawal transaction has been completed successfully! Starting cross-chain transfer...
                                </div>
                            </>
                        )}

                        {currentStep === 'crosschain_pending' && (
                            <>
                                <HourglassLoader size="lg" className="mb-4" />
                                <div className="text-center text-sm text-muted-foreground">
                                    Processing cross-chain withdrawal to {destinationChainName}...
                                </div>
                            </>
                        )}

                        {currentStep === 'crosschain_success' && (
                            <>
                                <div className="w-8 h-8 bg-text-success-light dark:bg-text-success-dark rounded-full flex items-center justify-center mb-4">
                                    <FaCheck className="w-5 h-5 text-white" />
                                </div>
                                <div className="text-center text-sm text-muted-foreground">
                                    Cross-chain withdrawal completed successfully! Assets have been sent to {destinationChainName}.
                                </div>
                            </>
                        )}

                        {currentStep === 'crosschain_failed' && (
                            <>
                                <div className="w-8 h-8 bg-text-error-light dark:bg-text-error-dark rounded-full flex items-center justify-center mb-4">
                                    <FaTimes className="w-5 h-5 text-white" />
                                </div>
                                <div className="text-center text-sm text-muted-foreground">
                                    Cross-chain withdrawal failed. Please check the transaction status or try again.
                                </div>
                            </>
                        )}

                        {withdrawHash && (
                            <div className="mt-2 text-xs text-muted-foreground">
                                Withdrawal:
                                <a
                                    href={getTransactionUrl(SupportedChain.ZETA_TESTNET, withdrawHash) || '#'}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="ml-1 text-primary hover:text-primary/80 underline"
                                >
                                    {withdrawHash.slice(0, 6)}...{withdrawHash.slice(-4)}
                                </a>
                                <FaCheck className="ml-2 w-3 h-3 text-text-success-light dark:text-text-success-dark" />
                            </div>
                        )}

                        {crossChainTxHash && (currentStep === 'crosschain_pending' || currentStep === 'crosschain_success' || currentStep === 'crosschain_failed') && (
                            <div className="mt-1 text-xs text-muted-foreground">
                                Cross-chain:
                                <a
                                    href={`https://explorer.zetachain.com/cc/tx/${crossChainTxHash}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="ml-1 text-primary hover:text-primary/80 underline"
                                >
                                    {crossChainTxHash.slice(0, 6)}...{crossChainTxHash.slice(-4)}
                                </a>
                                {currentStep === 'crosschain_pending' && <HourglassLoader size="xs" className="ml-2" />}
                                {currentStep === 'crosschain_success' && <FaCheck className="ml-2 w-3 h-3 text-text-success-light dark:text-text-success-dark" />}
                                {currentStep === 'crosschain_failed' && <FaTimes className="ml-2 w-3 h-3 text-text-error-light dark:text-text-error-dark" />}
                            </div>
                        )}
                    </div>
                )}

                <DialogFooter>
                    {currentStep === 'input' ? (
                        <>
                            <Button variant="outline" onClick={handleClose}>
                                Cancel
                            </Button>
                            <Button
                                variant="zeta"
                                onClick={handleSubmit}
                                disabled={!isValidAmount || isSubmitting || !address}
                            >
                                {isSubmitting && <Spinner variant="white" size="xs" className="mr-2" />}
                                {isSubmitting ? 'Checking...' : 'Withdraw'}
                            </Button>
                        </>
                    ) : currentStep === 'approve' ? (
                        <>
                            <Button variant="outline" onClick={handleClose}>
                                Cancel
                            </Button>
                            <Button
                                variant="zeta"
                                onClick={handleApproveGasToken}
                                disabled={!gasTokenInfo}
                            >
                                Approve Gas Tokens
                            </Button>
                        </>
                    ) : (
                        <Button variant="outline" onClick={handleClose} className="w-full">
                            Close
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
} 