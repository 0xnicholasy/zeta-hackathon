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
import { useCrossChainTracking } from '../../hooks/useCrossChainTracking';
import { useContracts } from '../../hooks/useContracts';
import { SupportedChain, getTransactionUrl } from '../../contracts/deployments';
import type {
    UserAssetData,
    EVMAddress,
    EVMTransactionHash
} from './types';
import {
    safeEVMAddress,
    safeEVMTransactionHash,
    addressesEqual
} from './types';
import { FaCheck, FaTimes, FaClock, FaFileSignature } from 'react-icons/fa';
import { ERC20__factory, SimpleLendingProtocol__factory } from '@/contracts/typechain-types';
import { formatHexString } from '@/utils/formatHexString';

interface WithdrawDialogProps {
    isOpen: boolean;
    onClose: () => void;
    selectedAsset: UserAssetData;
}

// SimpleLendingProtocol ABI
const lendingProtocolAbi = SimpleLendingProtocol__factory.abi;

// ERC20 ABI for gas token approval
const erc20Abi = ERC20__factory.abi;

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
    sourceChain = sourceChain.toLowerCase();
    if (sourceChain.includes('arb')) {
        return 'ETH.ARBI';
    } else if (sourceChain.includes('eth')) {
        return 'ETH.ETH';
    } else if (sourceChain.includes('zeta')) {
        return 'ZETA';
    } else {
        return 'Unsupported Network';
    }
};

// Helper function to check if the selected token is the gas token
const isTokenGasToken = (selectedAsset: UserAssetData, gasTokenAddress: EVMAddress | undefined): boolean => {
    if (!selectedAsset || !gasTokenAddress) return false;
    return addressesEqual(selectedAsset.address, gasTokenAddress);
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
    const [currentStep, setCurrentStep] = useState<'input' | 'checkWithdraw' | 'checkGas' | 'approve' | 'approving' | 'withdraw' | 'withdrawing' | 'success'>('input');
    const [withdrawHash, setWithdrawHash] = useState<EVMTransactionHash | null>(null);
    const [approvalHash, setApprovalHash] = useState<EVMTransactionHash | null>(null);
    const [gasTokenInfo, setGasTokenInfo] = useState<{ address: EVMAddress; amount: bigint; needsApproval: boolean } | null>(null);
    const [validationError, setValidationError] = useState<string | null>(null);

    // Use cross-chain tracking hook
    const crossChain = useCrossChainTracking();

    const { address } = useAccount();
    const safeAddress = safeEVMAddress(address);

    // Use ZetaChain for lending protocol operations
    const { simpleLendingProtocol } = useContracts(SupportedChain.ZETA_TESTNET);

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
        address: safeEVMAddress(simpleLendingProtocol),
        abi: lendingProtocolAbi,
        functionName: 'canWithdraw',
        args: selectedAsset && amountBigInt > 0 ? [
            safeAddress,
            selectedAsset.address,
            amountBigInt,
        ] : undefined,
        query: {
            enabled: Boolean(selectedAsset && amountBigInt > 0 && simpleLendingProtocol),
        },
    });

    // Get gas fee requirements
    const { data: gasFeeData } = useReadContract({
        address: safeEVMAddress(simpleLendingProtocol),
        abi: lendingProtocolAbi,
        functionName: 'getWithdrawGasFee',
        args: selectedAsset ? [selectedAsset.address] : undefined,
        query: {
            enabled: Boolean(selectedAsset && simpleLendingProtocol),
        },
    });

    // Get gas token address and fee amount
    const gasTokenAddress = gasFeeData?.[0] ? safeEVMAddress(gasFeeData[0]) : undefined;
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
        address: gasTokenAddress,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [safeAddress],
        query: {
            enabled: Boolean(gasTokenAddress && !isGasToken),
        },
    });

    // Get gas token allowance only if gas token is different from asset
    const { data: gasTokenAllowance, refetch: refetchGasTokenAllowance } = useReadContract({
        address: gasTokenAddress,
        abi: erc20Abi,
        functionName: 'allowance',
        args: [safeAddress, safeEVMAddress(simpleLendingProtocol)],
        query: {
            enabled: Boolean(gasTokenAddress && simpleLendingProtocol && !isGasToken),
        },
    });

    // Wait for approve transaction
    const { isLoading: isApprovingTx, isSuccess: isApproveSuccess } = useWaitForTransactionReceipt({
        hash: approvalHash || undefined,
        query: {
            enabled: !!approvalHash,
        },
    });

    // Wait for withdraw transaction
    const { isLoading: isWithdrawingTx, isSuccess: isWithdrawSuccess, isError: isWithdrawError, error: withdrawError } = useWaitForTransactionReceipt({
        hash: withdrawHash || undefined,
        query: {
            enabled: !!withdrawHash,
        },
    });

    // Validation logic
    const validateWithdrawal = useCallback(() => {
        if (!selectedAsset || !amountBigInt || !simpleLendingProtocol) {
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
    }, [selectedAsset, amountBigInt, simpleLendingProtocol, canWithdraw, gasFeeData, gasTokenAddress, gasFeeAmount, gasTokenBalance, gasTokenAllowance, gasTokenSymbol, gasTokenDecimals, isGasToken, receiveAmount, maxAmount, amount]);

    // Handle gas token approval
    const handleApproveGasToken = useCallback(() => {
        if (!gasTokenInfo || !simpleLendingProtocol) return;

        setCurrentStep('approving');
        writeContract({
            address: gasTokenInfo.address,
            abi: erc20Abi,
            functionName: 'approve',
            args: [safeEVMAddress(simpleLendingProtocol), gasTokenInfo.amount],
        });
    }, [gasTokenInfo, simpleLendingProtocol, writeContract]);

    // Main submit handler following withdraw-all-fixed.ts workflow
    const handleSubmit = useCallback(async () => {
        if (!amount || !selectedAsset || !amountBigInt || !simpleLendingProtocol) return;

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
            address: safeEVMAddress(simpleLendingProtocol),
            abi: lendingProtocolAbi,
            functionName: 'withdrawCrossChain',
            args: [
                selectedAsset.address,
                amountBigInt,
                BigInt(destinationChain),
                safeAddress,
            ],
        });
    }, [amount, selectedAsset, amountBigInt, simpleLendingProtocol, resetContract, validateWithdrawal, writeContract, destinationChain, safeAddress]);

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
        setApprovalHash(null);
        setGasTokenInfo(null);
        setValidationError(null);
        crossChain.reset();
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
                return 'Sign transaction to withdraw from protocol';
            case 'withdrawing':
                return 'Waiting for withdrawal confirmation...';
            case 'success':
                if (crossChain.status === 'pending') {
                    return 'Processing cross-chain withdrawal...';
                } else if (crossChain.status === 'success') {
                    return 'Cross-chain withdrawal completed!';
                } else if (crossChain.status === 'failed') {
                    return 'Cross-chain withdrawal failed';
                } else {
                    return 'Withdrawal transaction confirmed!';
                }
            default:
                return `Enter amount to withdraw to ${destinationChainName}`;
        }
    }, [currentStep, destinationChainName, crossChain.status]);

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


    // Handle withdraw transaction success
    useEffect(() => {
        if (isWithdrawSuccess && currentStep === 'withdrawing' && withdrawHash) {
            setCurrentStep('success');
            setIsSubmitting(false);
            // Start cross-chain tracking
            crossChain.startTracking(withdrawHash);
        }
    }, [isWithdrawSuccess, currentStep, withdrawHash, crossChain]);

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
                const validHash = safeEVMTransactionHash(hash);
                if (validHash) {
                    setApprovalHash(validHash);
                }
            } else if (currentStep === 'withdraw') {
                const validHash = safeEVMTransactionHash(hash);
                if (validHash) {
                    setWithdrawHash(validHash);
                    setCurrentStep('withdrawing');
                }
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
                                <span>Withdrawing to chain:</span>
                                <span className="font-medium">{destinationChainName}</span>
                            </div>
                            <div className="flex justify-between mt-1">
                                <span>Asset:</span>
                                <span className="font-medium">{selectedAsset.unit}</span>
                            </div>
                            <div className="flex justify-between mt-1">
                                <span>Recipient:</span>
                                <span className="font-medium text-xs">{formatHexString(safeAddress)}</span>
                            </div>
                        </div>

                        {/* Gas Fee Info */}
                        {!isGasToken && gasFeeData && (
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
                        <div className="size-9 bg-zeta-500 rounded-full flex items-center justify-center mb-4">
                            <FaFileSignature className="w-5 h-5 text-white ml-1" />
                        </div>
                        <div className="text-center text-md text-muted-foreground">
                            You need to approve gas tokens before proceeding with the withdrawal.
                        </div>
                        {gasTokenInfo && (
                            <div className="mt-2 text-sm text-muted-foreground text-center">
                                Approving {formatUnits(gasTokenInfo.amount, gasTokenDecimals)} {gasTokenSymbol}
                            </div>
                        )}
                    </div>
                )}

                {(currentStep === 'checkWithdraw' || currentStep === 'checkGas' || currentStep === 'approving' || currentStep === 'withdrawing') && (
                    <div className="flex flex-col items-center py-6">
                        <HourglassLoader size="lg" className="mb-4" />
                        <div className="text-center text-sm text-muted-foreground">
                            {currentStep === 'checkWithdraw' && 'Validating withdrawal eligibility...'}
                            {currentStep === 'checkGas' && 'Checking gas token requirements...'}
                            {currentStep === 'approving' && 'Waiting for gas token approval...'}
                            {currentStep === 'withdrawing' && 'Waiting for withdrawal transaction...'}
                        </div>

                        {/* Show transaction hashes */}
                        {approvalHash && (currentStep === 'approving') && (
                            <div className="mt-2 text-xs text-muted-foreground">
                                Approval:
                                <a
                                    href={getTransactionUrl(SupportedChain.ZETA_TESTNET, approvalHash) || '#'}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="ml-1 text-primary hover:text-primary/80 underline"
                                >
                                    {formatHexString(approvalHash)}
                                </a>
                                {isApprovingTx && <FaClock className="ml-2 w-3 h-3 text-muted-foreground" />}
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
                                    {formatHexString(withdrawHash)}
                                </a>
                                {isWithdrawingTx && <FaClock className="ml-2 w-3 h-3 text-muted-foreground" />}
                                {isWithdrawSuccess && <FaCheck className="ml-2 w-3 h-3 text-text-success-light dark:text-text-success-dark" />}
                            </div>
                        )}
                    </div>
                )}

                {currentStep === 'success' && (
                    <div className="flex flex-col items-center py-6">
                        {/* Show appropriate icon based on cross-chain status */}
                        {crossChain.status === 'pending' && (
                            <HourglassLoader size="lg" className="mb-4" />
                        )}
                        {(crossChain.status === 'success' || crossChain.status === 'idle') && (
                            <div className="w-8 h-8 bg-text-success-light dark:bg-text-success-dark rounded-full flex items-center justify-center mb-4">
                                <FaCheck className="w-5 h-5 text-white" />
                            </div>
                        )}
                        {crossChain.status === 'failed' && (
                            <div className="w-8 h-8 bg-text-error-light dark:bg-text-error-dark rounded-full flex items-center justify-center mb-4">
                                <FaTimes className="w-5 h-5 text-white" />
                            </div>
                        )}
                        <div className="text-center text-sm text-muted-foreground">
                            {crossChain.status === 'pending' && `Processing cross-chain withdrawal to ${destinationChainName}...`}
                            {crossChain.status === 'success' && `Cross-chain withdrawal completed successfully! Assets have been sent to ${destinationChainName}.`}
                            {crossChain.status === 'failed' && 'Cross-chain withdrawal failed. Please check the transaction status or try again.'}
                            {crossChain.status === 'idle' && 'Your withdrawal transaction has been completed successfully! Starting cross-chain transfer...'}
                        </div>

                        {/* Show withdrawal transaction hash */}
                        {withdrawHash && (
                            <div className="mt-2 text-xs text-muted-foreground flex items-center">
                                <span>Withdrawal:</span>
                                <a
                                    href={getTransactionUrl(SupportedChain.ZETA_TESTNET, withdrawHash) || '#'}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="ml-1 text-primary hover:text-primary/80 underline"
                                >
                                    {formatHexString(withdrawHash)}
                                </a>
                                <FaCheck className="ml-2 w-3 h-3 text-text-success-light dark:text-text-success-dark" />
                            </div>
                        )}

                        {/* Show cross-chain transaction hash */}
                        {crossChain.txHash && crossChain.status !== 'idle' && (
                            <div className="mt-1 text-xs text-muted-foreground flex items-center">
                                <span>Cross-chain:</span>
                                <a
                                    href={`https://zetachain-athens.blockpi.network/lcd/v1/public/zeta-chain/crosschain/inboundHashToCctxData/${crossChain.txHash}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="ml-1 text-primary hover:text-primary/80 underline"
                                >
                                    {formatHexString(crossChain.txHash)}
                                </a>
                                {crossChain.status === 'pending' && <FaClock className="ml-2 w-3 h-3 text-muted-foreground" />}
                                {crossChain.status === 'success' && <FaCheck className="ml-2 w-3 h-3 text-text-success-light dark:text-text-success-dark" />}
                                {crossChain.status === 'failed' && <FaTimes className="ml-2 w-3 h-3 text-text-error-light dark:text-text-error-dark" />}
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
                                disabled={!isValidAmount || isSubmitting}
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