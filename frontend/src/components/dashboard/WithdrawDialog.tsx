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
import { useContracts } from '../../hooks/useContracts';
import { SupportedChain, type SupportedChainId, getTransactionUrl } from '../../contracts/deployments';
import type { UserAssetData } from './types';

interface WithdrawDialogProps {
    isOpen: boolean;
    onClose: () => void;
    selectedAsset: UserAssetData | null;
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

export function WithdrawDialog({ isOpen, onClose, selectedAsset }: WithdrawDialogProps) {
    const [amount, setAmount] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [currentStep, setCurrentStep] = useState<'input' | 'checkWithdraw' | 'checkGas' | 'approve' | 'approving' | 'withdraw' | 'withdrawing' | 'success'>('input');
    const [withdrawHash, setWithdrawHash] = useState<`0x${string}` | null>(null);
    const [approveHash, setApproveHash] = useState<`0x${string}` | null>(null);
    const [gasTokenInfo, setGasTokenInfo] = useState<{ address: string; amount: bigint; needsApproval: boolean } | null>(null);
    const [validationError, setValidationError] = useState<string | null>(null);

    const { address } = useAccount();

    // Use ZetaChain for lending protocol operations
    const { simpleLendingProtocol } = useContracts(SupportedChain.ZETA_TESTNET as SupportedChainId);

    const { writeContract, data: hash, error: contractError, reset: resetContract } = useWriteContract();

    // Computed values
    const maxAmount = selectedAsset?.formattedSuppliedBalance ?? '0';
    const destinationChain = selectedAsset ? getChainIdFromSourceChain(selectedAsset.sourceChain) : SupportedChain.ARBITRUM_SEPOLIA;
    const destinationChainName = selectedAsset ? getChainDisplayName(selectedAsset.sourceChain) : 'Unknown';
    const amountBigInt = amount && selectedAsset ? parseUnits(amount, 18) : BigInt(0); // Assuming 18 decimals for ZRC20 tokens
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

    // Get gas token balance if gas token is different from asset
    const gasTokenAddress = gasFeeData?.[0];
    const gasFeeAmount = gasFeeData?.[1];
    const { data: gasTokenBalance } = useReadContract({
        address: gasTokenAddress as `0x${string}`,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: address ? [address] : undefined,
        query: {
            enabled: Boolean(address && gasTokenAddress && gasTokenAddress !== selectedAsset?.address),
        },
    });

    // Get gas token allowance if gas token is different from asset
    const { data: gasTokenAllowance } = useReadContract({
        address: gasTokenAddress as `0x${string}`,
        abi: erc20Abi,
        functionName: 'allowance',
        args: address && simpleLendingProtocol ? [address, simpleLendingProtocol as `0x${string}`] : undefined,
        query: {
            enabled: Boolean(address && gasTokenAddress && simpleLendingProtocol && gasTokenAddress !== selectedAsset?.address),
        },
    });

    // Wait for approve transaction
    const { isLoading: isApprovingTx, isSuccess: isApproveSuccess } = useWaitForTransactionReceipt({
        hash: approveHash as `0x${string}`,
    });

    // Wait for withdraw transaction
    const { isLoading: isWithdrawingTx, isSuccess: isWithdrawSuccess } = useWaitForTransactionReceipt({
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

        // If gas token is different from asset, check user balance and allowance
        if (gasTokenAddress !== selectedAsset.address) {
            if (!gasTokenBalance || gasTokenBalance < gasFeeAmount) {
                setValidationError(`Insufficient gas tokens. Need ${formatUnits(gasFeeAmount, 18)} but have ${formatUnits(gasTokenBalance || BigInt(0), 18)}`);
                return false;
            }

            if (!gasTokenAllowance || gasTokenAllowance < gasFeeAmount) {
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
    }, [address, selectedAsset, amountBigInt, simpleLendingProtocol, canWithdraw, gasFeeData, gasTokenAddress, gasFeeAmount, gasTokenBalance, gasTokenAllowance]);

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
                return 'Click to withdraw from protocol';
            case 'withdrawing':
                return 'Waiting for withdrawal confirmation...';
            case 'success':
                return 'Withdrawal successful!';
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
            // Retry withdrawal after approval
            setTimeout(() => {
                handleSubmit();
            }, 1000);
        }
    }, [isApproveSuccess, currentStep, handleSubmit]);

    // Handle withdraw transaction success
    useEffect(() => {
        if (isWithdrawSuccess && currentStep === 'withdrawing') {
            setCurrentStep('success');
            setIsSubmitting(false);
        }
    }, [isWithdrawSuccess, currentStep]);

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
                            <div className="p-3 border border-yellow-200 dark:border-yellow-800 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 text-sm">
                                <div className="text-yellow-800 dark:text-yellow-200 font-medium mb-1">
                                    Gas Fee Requirements
                                </div>
                                <div className="text-yellow-700 dark:text-yellow-300">
                                    Gas Fee: {formatUnits(gasFeeData[1], 18)} tokens
                                </div>
                                {gasFeeData[0] !== selectedAsset.address && (
                                    <div className="text-yellow-600 dark:text-yellow-400 text-xs mt-1">
                                        Different gas token required for cross-chain withdrawal
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Transaction Info */}
                        {amount && (
                            <div className="p-3 border border-blue-200 dark:border-blue-800 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-sm break-words">
                                <div className="text-blue-800 dark:text-blue-200 font-medium mb-1">
                                    Transaction Summary
                                </div>
                                <div className="text-blue-700 dark:text-blue-300 break-words">
                                    You will withdraw {amount} {selectedAsset.unit} from the lending protocol back to {destinationChainName}.
                                </div>
                                <div className="text-blue-600 dark:text-blue-400 text-xs mt-2">
                                    Note: Cross-chain withdrawal fees will be deducted from the amount.
                                </div>
                            </div>
                        )}

                        {/* Validation Error Display */}
                        {validationError && (
                            <div className="p-3 border border-red-200 dark:border-red-800 rounded-lg bg-red-50 dark:bg-red-900/20 text-sm break-words max-w-full">
                                <div className="text-red-800 dark:text-red-200 font-medium">
                                    Validation Error
                                </div>
                                <div className="text-red-700 dark:text-red-300 mt-1 break-words overflow-hidden text-wrap max-w-full">
                                    {validationError}
                                </div>
                            </div>
                        )}

                        {/* Contract Error Display */}
                        {contractError && (
                            <div className="p-3 border border-red-200 dark:border-red-800 rounded-lg bg-red-50 dark:bg-red-900/20 text-sm break-words max-w-full">
                                <div className="text-red-800 dark:text-red-200 font-medium">
                                    Transaction Failed
                                </div>
                                <div className="text-red-700 dark:text-red-300 mt-1 break-words overflow-hidden text-wrap max-w-full">
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
                        <div className="w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center mb-4">
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.268 16.5c-.77.833.192 2.5 1.732 2.5z" />
                            </svg>
                        </div>
                        <div className="text-center text-sm text-muted-foreground">
                            You need to approve gas tokens before proceeding with the withdrawal.
                        </div>
                        {gasTokenInfo && (
                            <div className="mt-2 text-xs text-muted-foreground text-center">
                                Approving {formatUnits(gasTokenInfo.amount, 18)} gas tokens
                            </div>
                        )}
                    </div>
                )}

                {(currentStep === 'checkWithdraw' || currentStep === 'checkGas' || currentStep === 'approving' || currentStep === 'withdrawing') && (
                    <div className="flex flex-col items-center py-6">
                        <Spinner variant="zeta" size="lg" className="mb-4" />
                        <div className="text-center text-sm text-muted-foreground">
                            {currentStep === 'checkWithdraw' && 'Validating withdrawal eligibility...'}
                            {currentStep === 'checkGas' && 'Checking gas token requirements...'}
                            {currentStep === 'approving' && 'Waiting for gas token approval...'}
                            {currentStep === 'withdrawing' && 'Waiting for withdrawal transaction...'}
                        </div>

                        {/* Show transaction hashes */}
                        {approveHash && (currentStep === 'approving') && (
                            <div className="mt-2 text-xs text-muted-foreground">
                                Approval:
                                <a
                                    href={getTransactionUrl(SupportedChain.ZETA_TESTNET, approveHash) || '#'}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="ml-1 text-blue-500 hover:text-blue-700 underline"
                                >
                                    {approveHash.slice(0, 6)}...{approveHash.slice(-4)}
                                </a>
                                {isApprovingTx && <span className="ml-2">⏳</span>}
                                {isApproveSuccess && <span className="ml-2 text-blue-500">✓</span>}
                            </div>
                        )}

                        {withdrawHash && currentStep === 'withdrawing' && (
                            <div className="mt-2 text-xs text-muted-foreground">
                                Withdrawal:
                                <a
                                    href={getTransactionUrl(SupportedChain.ZETA_TESTNET, withdrawHash) || '#'}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="ml-1 text-blue-500 hover:text-blue-700 underline"
                                >
                                    {withdrawHash.slice(0, 6)}...{withdrawHash.slice(-4)}
                                </a>
                                {isWithdrawingTx && <span className="ml-2">⏳</span>}
                                {isWithdrawSuccess && <span className="ml-2 text-blue-500">✓</span>}
                            </div>
                        )}
                    </div>
                )}

                {currentStep === 'success' && (
                    <div className="flex flex-col items-center py-6">
                        <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center mb-4">
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <div className="text-center text-sm text-muted-foreground">
                            Your withdrawal transaction has been completed successfully! Assets are being sent to {destinationChainName}.
                        </div>

                        {withdrawHash && (
                            <div className="mt-2 text-xs text-muted-foreground">
                                Withdrawal:
                                <a
                                    href={getTransactionUrl(SupportedChain.ZETA_TESTNET, withdrawHash) || '#'}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="ml-1 text-blue-500 hover:text-blue-700 underline"
                                >
                                    {withdrawHash.slice(0, 6)}...{withdrawHash.slice(-4)}
                                </a>
                                <span className="ml-2 text-blue-500">✓</span>
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