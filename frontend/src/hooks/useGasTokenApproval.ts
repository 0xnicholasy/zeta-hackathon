import { useEffect, useState } from 'react';
import { useReadContract, useAccount } from 'wagmi';
import { maxUint256 } from 'viem';
import { IERC20__factory, UniversalLendingProtocol__factory } from '@/contracts/typechain-types';
import type { UserAssetData } from '../components/dashboard/types';
import { EVMAddress, safeEVMAddressOrZeroAddress } from '@/types/address';

interface UseGasTokenApprovalParams {
    selectedAsset: UserAssetData | null;
    borrowAmount: bigint;
    universalLendingProtocol: EVMAddress;
}

interface GasTokenApprovalState {
    gasTokenAddress: EVMAddress;
    gasFee: bigint;
    needsApproval: boolean;
    isLoading: boolean;
    error: string | null;
    hasInsufficientBalance: boolean;
    userGasBalance: bigint;
}

const IERC20_ABI = IERC20__factory.abi;

export function useGasTokenApproval({
    selectedAsset,
    borrowAmount,
    universalLendingProtocol,
}: UseGasTokenApprovalParams): GasTokenApprovalState {
    const { address } = useAccount();
    const safeAddress = safeEVMAddressOrZeroAddress(address);
    const [needsApproval, setNeedsApproval] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Get withdraw gas fee for the asset
    const { data: gasInfo, error: gasInfoError } = useReadContract({
        address: universalLendingProtocol,
        abi: UniversalLendingProtocol__factory.abi,
        functionName: 'getWithdrawGasFee',
        args: selectedAsset ? [selectedAsset.address] : undefined,
        query: {
            enabled: Boolean(selectedAsset),
            refetchInterval: 30000, // Refetch every 30 seconds
        },
    });

    const gasTokenAddress = gasInfo ? safeEVMAddressOrZeroAddress(gasInfo[0]) : safeEVMAddressOrZeroAddress('');
    const gasFee = gasInfo ? gasInfo[1] : BigInt(0);

    // Get user's gas token balance
    const { data: userGasBalance = BigInt(0) } = useReadContract({
        address: gasTokenAddress,
        abi: IERC20_ABI,
        functionName: 'balanceOf',
        args: safeAddress ? [safeAddress] : undefined,
        query: {
            enabled: Boolean(gasTokenAddress && safeAddress),
            refetchInterval: 10000,
        },
    });

    // Get current allowance for gas token
    const { data: currentAllowance = BigInt(0) } = useReadContract({
        address: gasTokenAddress,
        abi: IERC20_ABI,
        functionName: 'allowance',
        args: safeAddress && universalLendingProtocol ? [safeAddress, universalLendingProtocol] as const : undefined,
        query: {
            enabled: Boolean(gasTokenAddress && safeAddress && universalLendingProtocol),
            refetchInterval: 10000,
        },
    });

    // Check if approval is needed
    useEffect(() => {
        if (!selectedAsset || borrowAmount === BigInt(0) || !gasTokenAddress || !gasFee) {
            setNeedsApproval(false);
            setError(null);
            return;
        }

        setIsLoading(true);

        try {
            // If borrowing the same asset as gas token, no approval needed (gas deducted from borrow amount)
            if (selectedAsset.address.toLowerCase() === gasTokenAddress.toLowerCase()) {
                setNeedsApproval(false);
                setError(null);
                setIsLoading(false);
                return;
            }

            // Check if user has sufficient gas token balance
            if (userGasBalance < gasFee) {
                setError(`Insufficient gas token balance. Need ${gasFee.toString()} but have ${userGasBalance.toString()}`);
                setNeedsApproval(false);
                setIsLoading(false);
                return;
            }

            // Check if current allowance is sufficient for gas fees
            const needsApprovalValue = currentAllowance < gasFee;
            setNeedsApproval(needsApprovalValue);
            setError(null);
        } catch (err) {
            console.error('Error checking gas token approval:', err);
            setError('Failed to check gas token approval requirements');
            setNeedsApproval(false);
        } finally {
            setIsLoading(false);
        }
    }, [selectedAsset, borrowAmount, gasTokenAddress, gasFee, userGasBalance, currentAllowance]);

    // Handle gas info errors
    useEffect(() => {
        if (gasInfoError) {
            setError(`Failed to get gas fee information: ${gasInfoError.message}`);
        }
    }, [gasInfoError]);

    return {
        gasTokenAddress,
        gasFee,
        needsApproval,
        isLoading,
        error,
        hasInsufficientBalance: userGasBalance < gasFee,
        userGasBalance,
    };
}

export function getGasTokenApprovalContractCall(gasTokenAddress: EVMAddress, universalLendingProtocol: EVMAddress) {
    return {
        address: gasTokenAddress,
        abi: IERC20_ABI,
        functionName: 'approve' as const,
        args: [universalLendingProtocol, maxUint256] as const,
    };
}