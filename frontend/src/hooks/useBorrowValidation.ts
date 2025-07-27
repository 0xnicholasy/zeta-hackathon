import { useEffect, useState, useCallback } from 'react';
import { useReadContract } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { IPriceOracle__factory, UniversalLendingProtocol__factory } from '@/contracts/typechain-types';
import type { EVMAddress, UserAssetData } from '../components/dashboard/types';

interface UseBorrowValidationParams {
    selectedAsset: UserAssetData | null;
    amountToBorrow: string;
    universalLendingProtocol: EVMAddress;
    priceOracle: EVMAddress;
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

const DEFAULT_VALIDATION_FAILED_RESULT: BorrowValidationResult = {
    isValid: false,
    error: '',
    canBorrow: false,
    maxBorrowAmount: '0',
    currentHealthFactor: 0,
    estimatedHealthFactor: 0,
    borrowValueUsd: 0,
};

export function useBorrowValidation({
    selectedAsset,
    amountToBorrow,
    universalLendingProtocol,
    priceOracle,
    userAddress,
}: UseBorrowValidationParams): BorrowValidationResult {
    const [validationResult, setValidationResult] = useState<BorrowValidationResult>(DEFAULT_VALIDATION_FAILED_RESULT);

    // Get max available borrows for specific asset (considers protocol's available balance)
    const { data: maxAvailableBorrowsForAsset, error: maxAvailableBorrowsForAssetError } = useReadContract({
        address: universalLendingProtocol,
        abi: UniversalLendingProtocol__factory.abi,
        functionName: 'maxAvailableBorrows',
        args: selectedAsset ? [userAddress, selectedAsset.address] : undefined,
        query: {
            enabled: Boolean(selectedAsset),
            refetchInterval: 10000,
        },
    });

    const { data: userPositionData, error: userPositionDataError } = useReadContract({
        address: universalLendingProtocol,
        abi: UniversalLendingProtocol__factory.abi,
        functionName: 'getUserPositionData',
        args: [userAddress],
        query: {
            refetchInterval: 10000,
        },
    });

    // Get asset price from the lending protocol (replaces deprecated selectedAsset.price)
    const { data: assetPrice, error: assetPriceError } = useReadContract({
        address: priceOracle,
        abi: IPriceOracle__factory.abi,
        functionName: 'getPrice',
        args: selectedAsset ? [selectedAsset.address] : undefined,
        query: {
            enabled: Boolean(selectedAsset),
            refetchInterval: 10000,
        },
    });

    // Check if user can borrow the specific amount
    const amountBigInt = amountToBorrow && selectedAsset ? parseUnits(amountToBorrow, selectedAsset.decimals) : BigInt(0);

    const { data: canBorrowResult } = useReadContract({
        address: universalLendingProtocol,
        abi: UniversalLendingProtocol__factory.abi,
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
                ...DEFAULT_VALIDATION_FAILED_RESULT,
                error: 'Missing required parameters',
            });
            return;
        }

        // We still need to calculate max borrow even if no amount is entered
        // Only skip if no amount for validation, but continue for max borrow calculation
        if (userPositionData === undefined || maxAvailableBorrowsForAsset === undefined
            || userPositionDataError || maxAvailableBorrowsForAssetError || assetPriceError) {
            setValidationResult({
                ...DEFAULT_VALIDATION_FAILED_RESULT,
                error: 'Error loading user data',
            });
            return;
        }

        const [totalCollateralValue, totalDebtValue, healthFactor] = userPositionData ?? [];

        // Convert asset price from the contract (18 decimals) to USD
        const assetPriceUsd = Number(assetPrice) / 1e18;

        if (isNaN(assetPriceUsd) || assetPriceUsd <= 0) {
            setValidationResult({
                ...DEFAULT_VALIDATION_FAILED_RESULT,
                error: 'Asset price is invalid or not available',
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
    }, [selectedAsset, userPositionData, maxAvailableBorrowsForAsset, userPositionDataError, maxAvailableBorrowsForAssetError, assetPriceError, assetPrice, amountToBorrow, canBorrowResult]);

    // Run validation when dependencies change
    useEffect(() => {
        validateBorrow();
    }, [validateBorrow]);

    return validationResult;
}