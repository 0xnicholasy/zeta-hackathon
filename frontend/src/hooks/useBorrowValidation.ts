import { useEffect, useState, useCallback } from 'react';
import { useReadContract } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { SimpleLendingProtocol__factory } from '@/contracts/typechain-types';
import type { EVMAddress, UserAssetData } from '../components/dashboard/types';

interface UseBorrowValidationParams {
    selectedAsset: UserAssetData | null;
    amountToBorrow: string;
    simpleLendingProtocol: EVMAddress;
    userAddress: EVMAddress;
}

interface BorrowValidationResult {
    isValid: boolean;
    error: string;
    canBorrow: boolean;
    maxBorrowAmount: string;
    currentHealthFactor: number;
    estimatedHealthFactor: number;
    borrowValueUsd: number;
}

export function useBorrowValidation({
    selectedAsset,
    amountToBorrow,
    simpleLendingProtocol,
    userAddress,
}: UseBorrowValidationParams): BorrowValidationResult {
    const [validationResult, setValidationResult] = useState<BorrowValidationResult>({
        isValid: false,
        error: '',
        canBorrow: false,
        maxBorrowAmount: '0',
        currentHealthFactor: 0,
        estimatedHealthFactor: 0,
        borrowValueUsd: 0,
    });

    // Get total collateral value
    const { data: totalCollateralValue } = useReadContract({
        address: simpleLendingProtocol,
        abi: SimpleLendingProtocol__factory.abi,
        functionName: 'getTotalCollateralValue',
        args: [userAddress],
        query: {
            refetchInterval: 10000,
        },
    });

    // Get total debt value
    const { data: totalDebtValue } = useReadContract({
        address: simpleLendingProtocol,
        abi: SimpleLendingProtocol__factory.abi,
        functionName: 'getTotalDebtValue',
        args: [userAddress],
        query: {
            refetchInterval: 10000,
        },
    });

    // Get health factor
    const { data: healthFactor } = useReadContract({
        address: simpleLendingProtocol,
        abi: SimpleLendingProtocol__factory.abi,
        functionName: 'getHealthFactor',
        args: [userAddress],
        query: {
            refetchInterval: 10000,
        },
    });

    // Get max available borrows in USD
    const { data: maxAvailableBorrowsInUsd } = useReadContract({
        address: simpleLendingProtocol,
        abi: SimpleLendingProtocol__factory.abi,
        functionName: 'maxAvailableBorrowsInUsd',
        args: [userAddress],
        query: {
            refetchInterval: 10000,
        },
    });

    // Get max available borrows for specific asset (considers protocol's available balance)
    const { data: maxAvailableBorrowsForAsset } = useReadContract({
        address: simpleLendingProtocol,
        abi: SimpleLendingProtocol__factory.abi,
        functionName: 'maxAvailableBorrows',
        args: selectedAsset ? [userAddress, selectedAsset.address] : undefined,
        query: {
            enabled: Boolean(selectedAsset),
            refetchInterval: 10000,
        },
    });

    // Check if user can borrow the specific amount
    const amountBigInt = amountToBorrow && selectedAsset ? parseUnits(amountToBorrow, selectedAsset.decimals) : BigInt(0);

    const { data: canBorrowResult } = useReadContract({
        address: simpleLendingProtocol,
        abi: SimpleLendingProtocol__factory.abi,
        functionName: 'canBorrow',
        args: amountBigInt > 0 && selectedAsset
            ? [userAddress, selectedAsset.address, amountBigInt]
            : undefined,
        query: {
            enabled: amountBigInt > 0 && Boolean(selectedAsset),
            refetchInterval: 5000,
        },
    });

    // Validate borrow parameters
    const validateBorrow = useCallback(() => {
        if (!selectedAsset) {
            setValidationResult({
                isValid: false,
                error: 'Missing required parameters',
                canBorrow: false,
                maxBorrowAmount: '0',
                currentHealthFactor: 0,
                estimatedHealthFactor: 0,
                borrowValueUsd: 0,
            });
            return;
        }

        // We still need to calculate max borrow even if no amount is entered
        // Only skip if no amount for validation, but continue for max borrow calculation

        if (totalCollateralValue === undefined || totalDebtValue === undefined || healthFactor === undefined || maxAvailableBorrowsInUsd === undefined || maxAvailableBorrowsForAsset === undefined) {
            // console.log("🚀 ~ validateBorrow ~ totalCollateralValue:", totalCollateralValue)
            // console.log("🚀 ~ validateBorrow ~ totalDebtValue:", totalDebtValue)
            // console.log("🚀 ~ validateBorrow ~ healthFactor:", healthFactor)
            // console.log("🚀 ~ validateBorrow ~ maxAvailableBorrowsInUsd:", maxAvailableBorrowsInUsd)
            // console.log("🚀 ~ validateBorrow ~ maxAvailableBorrowsForAsset:", maxAvailableBorrowsForAsset)
            setValidationResult({
                isValid: false,
                error: 'Loading user data...',
                canBorrow: false,
                maxBorrowAmount: '0',
                currentHealthFactor: 0,
                estimatedHealthFactor: 0,
                borrowValueUsd: 0,
            });
            return;
        }

        // Parse price by removing currency symbol and parsing
        const priceString = selectedAsset.price.replace(/[$,]/g, '');
        const assetPriceUsd = parseFloat(priceString);

        if (assetPriceUsd <= 0) {
            setValidationResult({
                isValid: false,
                error: 'Asset price is not available',
                canBorrow: false,
                maxBorrowAmount: '0',
                currentHealthFactor: 0,
                estimatedHealthFactor: 0,
                borrowValueUsd: 0,
            });
            return;
        }

        // Get values from contract (already in USD, normalized to 18 decimals)
        const totalDebtValueFormatted = Number(totalDebtValue) / 1e18;
        const totalCollateralValueFormatted = Number(totalCollateralValue) / 1e18;

        // Handle health factor - contract returns type(uint256).max when debt is 0
        let currentHealthFactorFormatted;
        if (totalDebtValueFormatted === 0) {
            // No debt means "infinite" health factor - display as very high number
            currentHealthFactorFormatted = 999.99;
        } else {
            currentHealthFactorFormatted = Number(healthFactor) / 1e18;
        }

        // Use the contract's maxAvailableBorrows result which already considers protocol's available balance
        const maxBorrowAmount = formatUnits(maxAvailableBorrowsForAsset, selectedAsset.decimals);

        // Only calculate borrow validation if amount is entered
        const hasAmount = amountToBorrow && parseFloat(amountToBorrow) > 0;
        const borrowValueUsd = hasAmount ? parseFloat(amountToBorrow) * assetPriceUsd : 0;

        // Calculate estimated health factor after borrow (only if amount entered)
        let estimatedHealthFactor = currentHealthFactorFormatted;
        if (hasAmount && totalCollateralValueFormatted > 0 && borrowValueUsd > 0) {
            const newTotalDebtValue = totalDebtValueFormatted + borrowValueUsd;
            if (newTotalDebtValue > 0) {
                estimatedHealthFactor = totalCollateralValueFormatted / newTotalDebtValue;
            }
        }

        // Validation checks (only if amount is entered)
        let error = '';
        let isValid = !hasAmount; // If no amount, consider it "valid" (neutral state)

        if (hasAmount) {
            // Check if user has any collateral
            if (totalCollateralValueFormatted === 0) {
                error = 'No collateral supplied. Please supply collateral first.';
                isValid = false;
            }
            // Check if borrow amount exceeds max available borrows (this now includes protocol balance check)
            else if (parseFloat(amountToBorrow) > parseFloat(maxBorrowAmount)) {
                if (parseFloat(maxBorrowAmount) === 0) {
                    error = 'No tokens available for borrowing in the protocol.';
                } else {
                    error = `Amount exceeds maximum available. Max borrow: ${Number(maxBorrowAmount).toFixed(6)} ${selectedAsset.unit}`;
                }
                isValid = false;
            }
            // Check if estimated health factor is too low (minimum 1.5)
            else if (estimatedHealthFactor < 1.5) {
                error = `Health factor too low (${estimatedHealthFactor.toFixed(2)}). Minimum required: 1.50`;
                isValid = false;
            }
            // Check contract validation
            else if (canBorrowResult === false) {
                error = 'Contract validation failed. Please check your collateral and try a smaller amount.';
                isValid = false;
            } else {
                // All checks passed
                isValid = true;
            }
        }

        setValidationResult({
            isValid: hasAmount ? (isValid && canBorrowResult === true) : false,
            error,
            canBorrow: canBorrowResult === true,
            maxBorrowAmount,
            currentHealthFactor: currentHealthFactorFormatted,
            estimatedHealthFactor,
            borrowValueUsd,
        });
    }, [selectedAsset, amountToBorrow, totalCollateralValue, totalDebtValue, healthFactor, maxAvailableBorrowsInUsd, maxAvailableBorrowsForAsset, canBorrowResult]);

    // Run validation when dependencies change
    useEffect(() => {
        validateBorrow();
    }, [validateBorrow]);

    return validationResult;
}