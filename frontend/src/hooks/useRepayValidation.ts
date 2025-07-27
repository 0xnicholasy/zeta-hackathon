import { useEffect, useState, useCallback } from 'react';
import { useReadContract, useBalance, useAccount } from 'wagmi';
import { UniversalLendingProtocol__factory, IPriceOracle__factory } from '@/contracts/typechain-types';
import { SupportedChain, getTokenAddress } from '../contracts/deployments';
import { safeEVMAddressOrZeroAddress, ZERO_ADDRESS, type EVMAddress, type UserAssetData } from '../components/dashboard/types';

interface UseRepayValidationParams {
    selectedAsset: UserAssetData | null;
    amount: string;
    universalLendingProtocol: EVMAddress;
    priceOracle: EVMAddress;
    userAddress: EVMAddress;
    isLocal: boolean;
}

interface RepayValidationResult {
    isValid: boolean;
    error: string;
    maxRepayAmount: string;
    availableBalance: string;
    formattedAvailableBalance: string;
    currentDebt: string;
    formattedCurrentDebt: string;
    currentHealthFactor: number;
    newHealthFactor: number;
    isFullRepayment: boolean;
}

const DEFAULT_VALIDATION_FAILED_RESULT: RepayValidationResult = {
    isValid: false,
    error: '',
    maxRepayAmount: '0',
    availableBalance: '0',
    formattedAvailableBalance: '0',
    currentDebt: '0',
    formattedCurrentDebt: '0',
    currentHealthFactor: 0,
    newHealthFactor: 0,
    isFullRepayment: false,
};


export function useRepayValidation({
    selectedAsset,
    amount,
    universalLendingProtocol,
    priceOracle,
    userAddress,
    isLocal,
}: UseRepayValidationParams): RepayValidationResult {
    const { address } = useAccount();
    const [validationResult, setValidationResult] = useState<RepayValidationResult>(DEFAULT_VALIDATION_FAILED_RESULT);

    // Get user's current debt for this asset
    const { data: borrowBalance, error: borrowBalanceError } = useReadContract({
        address: universalLendingProtocol,
        abi: UniversalLendingProtocol__factory.abi,
        functionName: 'getBorrowBalance',
        args: selectedAsset ? [userAddress, selectedAsset.address] : undefined,
        query: {
            enabled: Boolean(selectedAsset),
            refetchInterval: 10000,
        },
    });

    // Get user position data (includes health factor, collateral, and debt values)
    const { data: userPositionData, error: userPositionDataError } = useReadContract({
        address: universalLendingProtocol,
        abi: UniversalLendingProtocol__factory.abi,
        functionName: 'getUserPositionData',
        args: [userAddress],
        query: {
            refetchInterval: 10000,
        },
    });

    // Get asset price from the oracle
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

    // Get user's token balance on the foreign chain (where they need to repay from)
    // Map the asset to its corresponding token on the foreign chain
    const getForeignChainTokenAddress = () => {
        if (!selectedAsset) return ZERO_ADDRESS;
        return getTokenAddress(selectedAsset.symbol, selectedAsset.externalChainId);
    };

    const getLocalChainTokenAddress = () => {
        if (!selectedAsset) return ZERO_ADDRESS;
        return getTokenAddress(selectedAsset.symbol, SupportedChain.ZETA_TESTNET);
    };

    const foreignTokenAddress = getForeignChainTokenAddress();
    const localTokenAddress = getLocalChainTokenAddress();
    const isNativeToken = safeEVMAddressOrZeroAddress(foreignTokenAddress) === ZERO_ADDRESS;

    const { data: tokenBalance, } = useBalance({
        address: address,
        token: isNativeToken ? localTokenAddress : foreignTokenAddress,
        chainId: isLocal ? SupportedChain.ZETA_TESTNET : selectedAsset?.externalChainId,
        query: {
            enabled: Boolean(address && selectedAsset && foreignTokenAddress !== undefined),
            refetchInterval: 10000,
        },
    });

    // Validate repay parameters
    const validateRepay = useCallback(() => {
        if (!selectedAsset) {
            setValidationResult({
                ...DEFAULT_VALIDATION_FAILED_RESULT,
                error: 'Missing required parameters',
            });
            return;
        }

        // Check for data loading errors
        if (userPositionDataError || borrowBalanceError || assetPriceError) {
            setValidationResult({
                ...DEFAULT_VALIDATION_FAILED_RESULT,
                error: 'Error loading user data',
            });
            return;
        }

        // Check if data is still loading
        if (userPositionData === undefined || borrowBalance === undefined || assetPrice === undefined || !tokenBalance) {
            console.log({
                selectedAsset,
                tokenBalance,
            });
            setValidationResult({
                ...DEFAULT_VALIDATION_FAILED_RESULT,
                error: 'Loading data...',
            });
            return;
        }

        const [totalCollateralValue, totalDebtValue, healthFactor] = userPositionData;

        // Convert asset price from the contract (18 decimals) to USD
        const assetPriceUsd = Number(assetPrice) / 1e18;

        if (isNaN(assetPriceUsd) || assetPriceUsd <= 0) {
            setValidationResult({
                ...DEFAULT_VALIDATION_FAILED_RESULT,
                error: 'Asset price is invalid or not available',
            });
            return;
        }

        // Format values
        const currentDebtFormatted = Number(borrowBalance) / Math.pow(10, selectedAsset.decimals);
        const availableBalanceFormatted = Number(tokenBalance.value) / Math.pow(10, selectedAsset.decimals);
        const maxRepayAmount = Math.min(currentDebtFormatted, availableBalanceFormatted);

        // Handle health factor - contract returns type(uint256).max when debt is 0
        const totalDebtValueFormatted = Number(totalDebtValue) / 1e18;
        const totalCollateralValueFormatted = Number(totalCollateralValue) / 1e18;

        let currentHealthFactorFormatted;
        if (totalDebtValueFormatted === 0) {
            currentHealthFactorFormatted = 999.99;
        } else {
            currentHealthFactorFormatted = Number(healthFactor) / 1e18;
        }

        // Handle case where there's no debt to repay
        if (currentDebtFormatted === 0) {
            setValidationResult({
                ...DEFAULT_VALIDATION_FAILED_RESULT,
                error: `No debt to repay for ${selectedAsset.unit}`,
                availableBalance: availableBalanceFormatted.toString(),
                formattedAvailableBalance: availableBalanceFormatted.toFixed(6),
                currentHealthFactor: currentHealthFactorFormatted,
                newHealthFactor: currentHealthFactorFormatted,
            });
            return;
        }

        // Only calculate repay validation if amount is entered
        const hasAmount = amount && parseFloat(amount) > 0;
        const repayAmount = hasAmount ? parseFloat(amount) : 0;
        const isFullRepayment = hasAmount ? repayAmount >= currentDebtFormatted : false;

        // Calculate new health factor after repayment (only if amount entered)
        let newHealthFactor = currentHealthFactorFormatted;
        if (hasAmount && totalCollateralValueFormatted > 0 && repayAmount > 0) {
            const repayValueUsd = repayAmount * assetPriceUsd;
            const newTotalDebtValue = Math.max(0, totalDebtValueFormatted - repayValueUsd);
            if (newTotalDebtValue > 0) {
                newHealthFactor = totalCollateralValueFormatted / newTotalDebtValue;
            } else {
                newHealthFactor = 999.99; // No debt = infinite health factor
            }
        }

        // Validation checks (only if amount is entered)
        let error = '';
        let isValid = false; // Default to false

        if (hasAmount) {
            if (repayAmount > availableBalanceFormatted) {
                error = `Insufficient balance. Available: ${availableBalanceFormatted.toFixed(6)} ${selectedAsset.unit}`;
                isValid = false;
            } else if (repayAmount > currentDebtFormatted) {
                error = `Repay amount exceeds debt. Current debt: ${currentDebtFormatted.toFixed(6)} ${selectedAsset.unit}`;
                isValid = false;
            } else {
                isValid = true;
            }
        }

        setValidationResult({
            isValid,
            error,
            maxRepayAmount: maxRepayAmount.toString(),
            availableBalance: availableBalanceFormatted.toString(),
            formattedAvailableBalance: availableBalanceFormatted.toFixed(6),
            currentDebt: currentDebtFormatted.toString(),
            formattedCurrentDebt: currentDebtFormatted.toFixed(6),
            currentHealthFactor: currentHealthFactorFormatted,
            newHealthFactor,
            isFullRepayment,
        });
    }, [selectedAsset, userPositionData, borrowBalance, tokenBalance, assetPrice, amount, userPositionDataError, borrowBalanceError, assetPriceError]);

    // Run validation when dependencies change
    useEffect(() => {
        validateRepay();
    }, [validateRepay]);

    return validationResult;
}