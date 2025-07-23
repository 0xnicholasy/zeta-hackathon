import { useEffect, useState, useCallback } from 'react';
import { useReadContract, useBalance } from 'wagmi';
import { SimpleLendingProtocol__factory } from '@/contracts/typechain-types';
import type { EVMAddress, UserAssetData } from '../components/dashboard/types';

interface UseRepayValidationParams {
    selectedAsset: UserAssetData | null;
    amount: string;
    simpleLendingProtocol: EVMAddress | null;
    userAddress: EVMAddress | null;
}

interface RepayValidationResult {
    isValid: boolean;
    error: string;
    maxRepayAmount: string;
    availableBalance: string;
    formattedAvailableBalance: string;
    currentDebt: string;
    formattedCurrentDebt: string;
    newHealthFactor: number;
    isFullRepayment: boolean;
}

export function useRepayValidation({
    selectedAsset,
    amount,
    simpleLendingProtocol,
    userAddress,
}: UseRepayValidationParams): RepayValidationResult {
    const [validationResult, setValidationResult] = useState<RepayValidationResult>({
        isValid: false,
        error: '',
        maxRepayAmount: '0',
        availableBalance: '0',
        formattedAvailableBalance: '0',
        currentDebt: '0',
        formattedCurrentDebt: '0',
        newHealthFactor: 0,
        isFullRepayment: false,
    });

    // Get user's current debt for this asset
    const { data: borrowBalance } = useReadContract({
        address: simpleLendingProtocol || undefined,
        abi: SimpleLendingProtocol__factory.abi,
        functionName: 'getBorrowBalance',
        args: userAddress && selectedAsset ? [userAddress, selectedAsset.address] : undefined,
        query: {
            enabled: !!(simpleLendingProtocol && userAddress && selectedAsset),
            refetchInterval: 10000,
        },
    });

    // Get user account data for health factor calculation
    const { data: userAccountData } = useReadContract({
        address: simpleLendingProtocol || undefined,
        abi: SimpleLendingProtocol__factory.abi,
        functionName: 'getUserAccountData',
        args: userAddress ? [userAddress] : undefined,
        query: {
            enabled: !!(simpleLendingProtocol && userAddress),
            refetchInterval: 10000,
        },
    });

    // Get user's token balance (ZRC-20 balance on ZetaChain)
    const { data: tokenBalance } = useBalance({
        address: userAddress || undefined,
        token: selectedAsset?.address,
        query: {
            enabled: !!(userAddress && selectedAsset),
            refetchInterval: 10000,
        },
    });

    // Validate repay parameters
    const validateRepay = useCallback(() => {
        if (!selectedAsset || !userAddress || !simpleLendingProtocol) {
            setValidationResult({
                isValid: false,
                error: 'Missing required parameters',
                maxRepayAmount: '0',
                availableBalance: '0',
                formattedAvailableBalance: '0',
                currentDebt: '0',
                formattedCurrentDebt: '0',
                newHealthFactor: 0,
                isFullRepayment: false,
            });
            return;
        }

        if (!borrowBalance || !tokenBalance || !userAccountData) {
            setValidationResult({
                isValid: false,
                error: 'Loading data...',
                maxRepayAmount: '0',
                availableBalance: '0',
                formattedAvailableBalance: '0',
                currentDebt: '0',
                formattedCurrentDebt: '0',
                newHealthFactor: 0,
                isFullRepayment: false,
            });
            return;
        }

        // Format current debt and available balance
        const currentDebtBigInt = borrowBalance;
        const availableBalanceBigInt = tokenBalance.value;
        
        const currentDebtFormatted = Number(currentDebtBigInt) / Math.pow(10, selectedAsset.decimals);
        const availableBalanceFormatted = Number(availableBalanceBigInt) / Math.pow(10, selectedAsset.decimals);

        // Calculate max repay amount (minimum of debt and available balance)
        const maxRepayAmountNumber = Math.min(currentDebtFormatted, availableBalanceFormatted);
        const maxRepayAmount = maxRepayAmountNumber.toString();

        // Check if no debt exists
        if (currentDebtFormatted === 0) {
            setValidationResult({
                isValid: false,
                error: `No debt to repay for ${selectedAsset.unit}`,
                maxRepayAmount: '0',
                availableBalance: availableBalanceFormatted.toString(),
                formattedAvailableBalance: availableBalanceFormatted.toFixed(6),
                currentDebt: '0',
                formattedCurrentDebt: '0',
                newHealthFactor: 0,
                isFullRepayment: false,
            });
            return;
        }

        // If no amount entered yet, return basic info
        if (!amount || parseFloat(amount) <= 0) {
            setValidationResult({
                isValid: false,
                error: '',
                maxRepayAmount,
                availableBalance: availableBalanceFormatted.toString(),
                formattedAvailableBalance: availableBalanceFormatted.toFixed(6),
                currentDebt: currentDebtFormatted.toString(),
                formattedCurrentDebt: currentDebtFormatted.toFixed(6),
                newHealthFactor: 0,
                isFullRepayment: false,
            });
            return;
        }

        const repayAmount = parseFloat(amount);
        const isFullRepayment = repayAmount >= currentDebtFormatted;

        // Calculate new health factor after repayment
        const [
            totalCollateralValue,
            totalDebtValue,
            ,
            ,
            healthFactor
        ] = userAccountData;

        const assetPriceUsd = parseFloat(selectedAsset.price || '0');
        const repayValueUsd = repayAmount * assetPriceUsd;
        
        const totalCollateralValueFormatted = Number(totalCollateralValue) / 1e18;
        const totalDebtValueFormatted = Number(totalDebtValue) / 1e18;
        const currentHealthFactorFormatted = Number(healthFactor) / 1e18;

        let newHealthFactor = currentHealthFactorFormatted;
        if (totalDebtValueFormatted > 0 && repayValueUsd > 0) {
            const newTotalDebtValue = Math.max(0, totalDebtValueFormatted - repayValueUsd);
            newHealthFactor = newTotalDebtValue > 0 
                ? (totalCollateralValueFormatted * 0.8) / newTotalDebtValue // Assuming 80% LTV
                : Infinity; // No debt = infinite health factor
        }

        // Validation checks
        let error = '';
        let isValid = true;

        // Check if user has sufficient balance
        if (repayAmount > availableBalanceFormatted) {
            error = `Insufficient balance. Available: ${availableBalanceFormatted.toFixed(6)} ${selectedAsset.unit}`;
            isValid = false;
        }
        // Check if repay amount exceeds debt
        else if (repayAmount > currentDebtFormatted) {
            error = `Repay amount exceeds debt. Current debt: ${currentDebtFormatted.toFixed(6)} ${selectedAsset.unit}`;
            isValid = false;
        }

        setValidationResult({
            isValid,
            error,
            maxRepayAmount,
            availableBalance: availableBalanceFormatted.toString(),
            formattedAvailableBalance: availableBalanceFormatted.toFixed(6),
            currentDebt: currentDebtFormatted.toString(),
            formattedCurrentDebt: currentDebtFormatted.toFixed(6),
            newHealthFactor,
            isFullRepayment,
        });
    }, [selectedAsset, userAddress, simpleLendingProtocol, amount, borrowBalance, tokenBalance, userAccountData]);

    // Run validation when dependencies change
    useEffect(() => {
        validateRepay();
    }, [validateRepay]);

    return validationResult;
}