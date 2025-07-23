import { useEffect, useState, useCallback } from 'react';
import { useReadContract } from 'wagmi';
import { parseUnits } from 'viem';
import { SimpleLendingProtocol__factory } from '@/contracts/typechain-types';
import type { EVMAddress, UserAssetData } from '../components/dashboard/types';

interface UseBorrowValidationParams {
    selectedAsset: UserAssetData | null;
    amount: string;
    simpleLendingProtocol: EVMAddress | null;
    userAddress: EVMAddress | null;
}

interface BorrowValidationResult {
    isValid: boolean;
    error: string;
    canBorrow: boolean;
    maxBorrowAmount: string;
    estimatedHealthFactor: number;
    borrowValueUsd: number;
}

export function useBorrowValidation({
    selectedAsset,
    amount,
    simpleLendingProtocol,
    userAddress,
}: UseBorrowValidationParams): BorrowValidationResult {
    const [validationResult, setValidationResult] = useState<BorrowValidationResult>({
        isValid: false,
        error: '',
        canBorrow: false,
        maxBorrowAmount: '0',
        estimatedHealthFactor: 0,
        borrowValueUsd: 0,
    });

    // Get user account data
    const { data: userAccountData } = useReadContract({
        address: simpleLendingProtocol || undefined,
        abi: SimpleLendingProtocol__factory.abi,
        functionName: 'getUserAccountData',
        args: userAddress ? [userAddress] : undefined,
        query: {
            enabled: !!(simpleLendingProtocol && userAddress),
            refetchInterval: 10000, // Refetch every 10 seconds
        },
    });

    // Check if user can borrow the specific amount
    const amountBigInt = amount && selectedAsset ? parseUnits(amount, selectedAsset.decimals) : BigInt(0);
    
    const { data: canBorrowResult } = useReadContract({
        address: simpleLendingProtocol || undefined,
        abi: SimpleLendingProtocol__factory.abi,
        functionName: 'canBorrow',
        args: userAddress && selectedAsset && amountBigInt > 0 
            ? [userAddress, selectedAsset.address, amountBigInt] 
            : undefined,
        query: {
            enabled: !!(simpleLendingProtocol && userAddress && selectedAsset && amountBigInt > 0),
            refetchInterval: 5000,
        },
    });

    // Validate borrow parameters
    const validateBorrow = useCallback(() => {
        if (!selectedAsset || !userAddress || !simpleLendingProtocol) {
            setValidationResult({
                isValid: false,
                error: 'Missing required parameters',
                canBorrow: false,
                maxBorrowAmount: '0',
                estimatedHealthFactor: 0,
                borrowValueUsd: 0,
            });
            return;
        }

        if (!amount || parseFloat(amount) <= 0) {
            setValidationResult({
                isValid: false,
                error: '',
                canBorrow: false,
                maxBorrowAmount: '0',
                estimatedHealthFactor: 0,
                borrowValueUsd: 0,
            });
            return;
        }

        if (!userAccountData) {
            setValidationResult({
                isValid: false,
                error: 'Loading user account data...',
                canBorrow: false,
                maxBorrowAmount: '0',
                estimatedHealthFactor: 0,
                borrowValueUsd: 0,
            });
            return;
        }

        const [
            totalCollateralValue,
            totalDebtValue,
            availableBorrows,
            ,
            healthFactor
        ] = userAccountData;

        // Calculate borrow value in USD
        const assetPriceUsd = parseFloat(selectedAsset.price || '0');
        const borrowValueUsd = parseFloat(amount) * assetPriceUsd;
        
        // Calculate max borrow amount based on available borrows
        const availableBorrowsFormatted = Number(availableBorrows) / 1e18; // Convert from wei to USD
        const maxBorrowAmount = assetPriceUsd > 0 ? (availableBorrowsFormatted / assetPriceUsd).toString() : '0';

        // Calculate estimated health factor after borrow
        const currentHealthFactorFormatted = Number(healthFactor) / 1e18;
        const totalDebtValueFormatted = Number(totalDebtValue) / 1e18;
        const totalCollateralValueFormatted = Number(totalCollateralValue) / 1e18;
        
        let estimatedHealthFactor = currentHealthFactorFormatted;
        if (totalCollateralValueFormatted > 0 && borrowValueUsd > 0) {
            const newTotalDebtValue = totalDebtValueFormatted + borrowValueUsd;
            estimatedHealthFactor = newTotalDebtValue > 0 
                ? (totalCollateralValueFormatted * 0.8) / newTotalDebtValue // Assuming 80% LTV
                : currentHealthFactorFormatted;
        }

        // Validation checks
        let error = '';
        let isValid = true;

        // Check if user has any collateral
        if (totalCollateralValueFormatted === 0) {
            error = 'No collateral supplied. Please supply collateral first.';
            isValid = false;
        }
        // Check if borrow amount exceeds available borrows
        else if (borrowValueUsd > availableBorrowsFormatted) {
            error = `Insufficient collateral. Max borrow: ${Number(maxBorrowAmount).toFixed(6)} ${selectedAsset.unit}`;
            isValid = false;
        }
        // Check if estimated health factor is too low
        else if (estimatedHealthFactor < 1.5) {
            error = `Health factor too low (${estimatedHealthFactor.toFixed(2)}). Minimum required: 1.50`;
            isValid = false;
        }
        // Check contract validation
        else if (canBorrowResult === false) {
            error = 'Contract validation failed. Please check your collateral and try a smaller amount.';
            isValid = false;
        }

        setValidationResult({
            isValid: isValid && canBorrowResult === true,
            error,
            canBorrow: canBorrowResult === true,
            maxBorrowAmount,
            estimatedHealthFactor,
            borrowValueUsd,
        });
    }, [selectedAsset, userAddress, simpleLendingProtocol, amount, userAccountData, canBorrowResult]);

    // Run validation when dependencies change
    useEffect(() => {
        validateBorrow();
    }, [validateBorrow]);

    return validationResult;
}