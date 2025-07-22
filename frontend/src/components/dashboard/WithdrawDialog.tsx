import { useState, useEffect, useCallback } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits, readContract } from 'viem';
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
import { SupportedChain, type SupportedChainId } from '../../contracts/deployments';
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
    const [currentStep, setCurrentStep] = useState<'input' | 'checkGas' | 'approve' | 'approving' | 'withdraw' | 'withdrawing' | 'success'>('input');
    const [withdrawHash, setWithdrawHash] = useState<`0x${string}` | null>(null);
    const [approveHash, setApproveHash] = useState<`0x${string}` | null>(null);
    const [gasTokenInfo, setGasTokenInfo] = useState<{ address: string; amount: bigint; needsApproval: boolean } | null>(null);

    const { address } = useAccount();

    // Use ZetaChain for lending protocol operations
    const { simpleLendingProtocol } = useContracts(SupportedChain.ZETA_TESTNET as SupportedChainId);

    const { writeContract, data: hash, error: contractError, reset: resetContract } = useWriteContract();

    // Wait for approve transaction
    const { isLoading: isApprovingTx, isSuccess: isApproveSuccess } = useWaitForTransactionReceipt({
        hash: approveHash as `0x${string}`,
    });

    // Wait for withdraw transaction
    const { isLoading: isWithdrawingTx, isSuccess: isWithdrawSuccess } = useWaitForTransactionReceipt({
        hash: withdrawHash as `0x${string}`,
    });

    // Computed values
    const maxAmount = selectedAsset?.formattedSuppliedBalance ?? '0';
    const destinationChain = selectedAsset ? getChainIdFromSourceChain(selectedAsset.sourceChain) : SupportedChain.ARBITRUM_SEPOLIA;
    const destinationChainName = selectedAsset ? getChainDisplayName(selectedAsset.sourceChain) : 'Unknown';
    const amountBigInt = amount && selectedAsset ? parseUnits(amount, 18) : BigInt(0); // Assuming 18 decimals for ZRC20 tokens
    const isValidAmount = amount && parseFloat(amount) > 0 && parseFloat(amount) <= parseFloat(maxAmount);

    // Check gas token requirements and handle approval flow
    const handleSubmit = useCallback(async () => {
        if (!address || !amount || !selectedAsset || !amountBigInt || !simpleLendingProtocol) return;

        setIsSubmitting(true);
        resetContract(); // Clear previous errors

        try {
            // For now, proceed directly to withdraw
            // The contract will handle gas token validation internally
            // TODO: Add gas token checking and approval flow in a future update
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
        } catch (error) {
            console.error('Transaction failed:', error);
            setIsSubmitting(false);
            setCurrentStep('input');
        }
    }, [address, amount, selectedAsset, amountBigInt, simpleLendingProtocol, destinationChain, writeContract, resetContract]);

    // Memoize the max click handler
    const handleMaxClick = useCallback(() => {
        if (selectedAsset) {
            setAmount(selectedAsset.formattedSuppliedBalance);
        }
    }, [selectedAsset]);

    // Memoize the close handler
    const handleClose = useCallback(() => {
        setAmount('');
        setCurrentStep('input');
        setIsSubmitting(false);
        setWithdrawHash(null);
        setApproveHash(null);
        setGasTokenInfo(null);
        resetContract(); // Clear any error states from the contract hook
        onClose();
    }, [onClose, resetContract]);

    // Memoize the step text getter
    const getStepText = useCallback(() => {
        switch (currentStep) {
            case 'checkGas':
                return 'Checking gas token requirements...';
            case 'approve':
                return 'Click to approve gas tokens';
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

    // Memoize amount change handler
    const handleAmountChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setAmount(e.target.value);
    }, []);

    // Handle withdraw transaction success -> show success
    useEffect(() => {
        if (isWithdrawSuccess && currentStep === 'withdrawing') {
            setCurrentStep('success');
            setIsSubmitting(false);
        }
    }, [isWithdrawSuccess, currentStep]);

    // Update current hash when writeContract returns new hash
    useEffect(() => {
        if (hash && currentStep === 'withdraw') {
            setWithdrawHash(hash);
            setCurrentStep('withdrawing');
        }
    }, [hash, currentStep]);

    // Early return AFTER all hooks have been called
    console.log('WithdrawDialog debug:', {
        selectedAsset,
        simpleLendingProtocol,
        isOpen,
        hasSelectedAsset: !!selectedAsset,
        hasContract: !!simpleLendingProtocol
    });

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

                        {/* Error Display */}
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

                {currentStep !== 'input' && (
                    <div className="flex flex-col items-center py-6">
                        {currentStep !== 'success' && (
                            <Spinner variant="zeta" size="lg" className="mb-4" />
                        )}
                        {currentStep === 'success' && (
                            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center mb-4">
                                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                        )}
                        <div className="text-center text-sm text-muted-foreground">
                            {currentStep === 'withdraw' && 'Please confirm the withdrawal transaction in your wallet...'}
                            {currentStep === 'withdrawing' && 'Waiting for withdrawal transaction to be confirmed...'}
                            {currentStep === 'success' && `Your withdrawal transaction has been completed successfully! Assets are being sent to ${destinationChainName}.`}
                        </div>

                        {/* Show withdraw transaction hash */}
                        {withdrawHash && (currentStep === 'withdrawing' || currentStep === 'success') && (
                            <div className="mt-2 text-xs text-muted-foreground">
                                Withdrawal: {withdrawHash.slice(0, 6)}...{withdrawHash.slice(-4)}
                                {isWithdrawingTx && <span className="ml-2">⏳</span>}
                                {isWithdrawSuccess && <span className="ml-2 text-blue-500">✓</span>}
                            </div>
                        )}

                        {/* Show current transaction hash for withdraw step */}
                        {hash && currentStep === 'withdraw' && (
                            <div className="mt-2 text-xs text-muted-foreground">
                                Transaction: {hash.slice(0, 6)}...{hash.slice(-4)}
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
                                {isSubmitting ? 'Submitting...' : 'Withdraw'}
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