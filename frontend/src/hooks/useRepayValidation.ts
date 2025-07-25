import { useEffect, useState, useCallback } from 'react';
import { useReadContract, useBalance, useAccount } from 'wagmi';
import { UniversalLendingProtocol__factory } from '@/contracts/typechain-types';
import { SupportedChain, getTokenAddress } from '../contracts/deployments';
import { safeEVMAddressOrZeroAddress, ZERO_ADDRESS, type EVMAddress, type UserAssetData } from '../components/dashboard/types';

interface UseRepayValidationParams {
    selectedAsset: UserAssetData | null;
    amount: string;
    universalLendingProtocol: EVMAddress | null;
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
    currentHealthFactor: number;
    newHealthFactor: number;
    isFullRepayment: boolean;
}

const FOREIGN_CHAIN_ASSET_MAPPING = {
    'ARBI': {
        chainId: SupportedChain.ARBITRUM_SEPOLIA,
        tokens: {
            'ETH': 'ETH',
            'USDC': 'USDC',
        }
    },
    'ETH': {
        chainId: SupportedChain.ETHEREUM_SEPOLIA,
        tokens: {
            'ETH': 'ETH',
            'USDC': 'USDC',
        }
    }
} as const;

// Constants for configuration and magic numbers
const HEALTH_FACTOR_INFINITY_THRESHOLD = 999;
const DEFAULT_LTV_RATIO = 0.8;
const PRICE_PRECISION = 1e18;
const DISPLAY_PRECISION = 6;

// Helper function to safely parse asset prices
function parseAssetPrice(priceString: string | undefined): number {
    if (!priceString) return 0;

    try {
        // Remove currency symbols, commas, and whitespace
        const cleanPrice = priceString.replace(/[$,\s]/g, '');
        const parsed = parseFloat(cleanPrice);
        return isNaN(parsed) || !isFinite(parsed) ? 0 : parsed;
    } catch {
        return 0;
    }
}

// Helper function to format asset values from BigInt
function formatAssetValues(
    borrowBalance: bigint,
    tokenBalance: bigint,
    decimals: number
) {
    const currentDebtFormatted = Number(borrowBalance) / Math.pow(10, decimals);
    const availableBalanceFormatted = Number(tokenBalance) / Math.pow(10, decimals);
    const maxRepayAmount = Math.min(currentDebtFormatted, availableBalanceFormatted);

    return {
        currentDebtFormatted,
        availableBalanceFormatted,
        maxRepayAmount: maxRepayAmount.toString(),
    };
}

// Helper function to normalize health factor
function normalizeHealthFactor(healthFactor: number): number {
    return healthFactor > HEALTH_FACTOR_INFINITY_THRESHOLD ? Infinity : healthFactor;
}

// Helper function to calculate new health factor after repayment
function calculateNewHealthFactor(
    currentHealthFactor: number,
    totalCollateralValue: number,
    totalDebtValue: number,
    repayValueUsd: number,
    ltvRatio: number = DEFAULT_LTV_RATIO
): number {
    if (totalDebtValue <= 0 || repayValueUsd <= 0) {
        return currentHealthFactor;
    }

    const newTotalDebtValue = Math.max(0, totalDebtValue - repayValueUsd);

    return newTotalDebtValue > 0
        ? (totalCollateralValue * ltvRatio) / newTotalDebtValue
        : Infinity; // No debt = infinite health factor
}

// Helper function to validate repay amount
function validateRepayAmount(
    repayAmount: number,
    availableBalance: number,
    currentDebt: number,
    assetUnit: string
): { isValid: boolean; error: string } {
    if (repayAmount > availableBalance) {
        return {
            isValid: false,
            error: `Insufficient balance. Available: ${availableBalance.toFixed(DISPLAY_PRECISION)} ${assetUnit}`,
        };
    }

    if (repayAmount > currentDebt) {
        return {
            isValid: false,
            error: `Repay amount exceeds debt. Current debt: ${currentDebt.toFixed(DISPLAY_PRECISION)} ${assetUnit}`,
        };
    }

    return { isValid: true, error: '' };
}

// Helper function to create validation result object
function createValidationResult(
    isValid: boolean,
    error: string,
    maxRepayAmount: string,
    availableBalance: number,
    currentDebt: number,
    currentHealthFactor: number,
    newHealthFactor: number,
    isFullRepayment = false
): RepayValidationResult {
    return {
        isValid,
        error,
        maxRepayAmount,
        availableBalance: availableBalance.toString(),
        formattedAvailableBalance: availableBalance.toFixed(DISPLAY_PRECISION),
        currentDebt: currentDebt.toString(),
        formattedCurrentDebt: currentDebt.toFixed(DISPLAY_PRECISION),
        currentHealthFactor: normalizeHealthFactor(currentHealthFactor),
        newHealthFactor: normalizeHealthFactor(newHealthFactor),
        isFullRepayment,
    };
}

export function useRepayValidation({
    selectedAsset,
    amount,
    universalLendingProtocol,
    userAddress,
}: UseRepayValidationParams): RepayValidationResult {
    const { address } = useAccount();
    const [validationResult, setValidationResult] = useState<RepayValidationResult>({
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
    });

    // Get user's current debt for this asset
    const { data: borrowBalance } = useReadContract({
        address: universalLendingProtocol ?? undefined,
        abi: UniversalLendingProtocol__factory.abi,
        functionName: 'getBorrowBalance',
        args: userAddress && selectedAsset ? [userAddress, selectedAsset.address] : undefined,
        query: {
            enabled: Boolean(universalLendingProtocol && userAddress && selectedAsset),
            refetchInterval: 10000,
        },
    });

    // Get user's health factor
    const { data: healthFactor } = useReadContract({
        address: universalLendingProtocol ?? undefined,
        abi: UniversalLendingProtocol__factory.abi,
        functionName: 'getHealthFactor',
        args: userAddress ? [userAddress] : undefined,
        query: {
            enabled: Boolean(universalLendingProtocol && userAddress),
            refetchInterval: 10000,
        },
    });

    // Get user's total collateral value
    const { data: totalCollateralValue } = useReadContract({
        address: universalLendingProtocol ?? undefined,
        abi: UniversalLendingProtocol__factory.abi,
        functionName: 'getTotalCollateralValue',
        args: userAddress ? [userAddress] : undefined,
        query: {
            enabled: Boolean(universalLendingProtocol && userAddress),
            refetchInterval: 10000,
        },
    });

    // Get user's total debt value
    const { data: totalDebtValue } = useReadContract({
        address: universalLendingProtocol ?? undefined,
        abi: UniversalLendingProtocol__factory.abi,
        functionName: 'getTotalDebtValue',
        args: userAddress ? [userAddress] : undefined,
        query: {
            enabled: Boolean(universalLendingProtocol && userAddress),
            refetchInterval: 10000,
        },
    });

    // Get user's token balance on the foreign chain (where they need to repay from)
    // Map the asset to its corresponding token on the foreign chain
    const getForeignChainTokenAddress = () => {
        if (!selectedAsset) return undefined;

        const chainMapping = FOREIGN_CHAIN_ASSET_MAPPING[selectedAsset.sourceChain as keyof typeof FOREIGN_CHAIN_ASSET_MAPPING];
        if (!chainMapping) return undefined;

        const tokenSymbol = chainMapping.tokens[selectedAsset.unit as keyof typeof chainMapping.tokens];
        if (!tokenSymbol) return undefined;

        return getTokenAddress(tokenSymbol, chainMapping.chainId);
    };

    const foreignTokenAddress = getForeignChainTokenAddress();
    const isNativeToken = safeEVMAddressOrZeroAddress(foreignTokenAddress) === ZERO_ADDRESS;

    const { data: tokenBalance } = useBalance({
        address: address ?? undefined,
        token: isNativeToken ? undefined : foreignTokenAddress,
        chainId: selectedAsset?.externalChainId,
        query: {
            enabled: Boolean(address && selectedAsset && foreignTokenAddress !== undefined),
            refetchInterval: 10000,
        },
    });

    // Refactored validate repay function
    const validateRepay = useCallback(() => {
        // Early validation: check required parameters
        if (!selectedAsset || !userAddress || !universalLendingProtocol) {
            setValidationResult(createValidationResult(
                false,
                'Missing required parameters',
                '0',
                0,
                0,
                0,
                0
            ));
            return;
        }

        // Early validation: check data availability
        if (!borrowBalance || !tokenBalance || healthFactor === undefined ||
            totalCollateralValue === undefined || totalDebtValue === undefined) {
            setValidationResult(createValidationResult(
                false,
                'Loading data...',
                '0',
                0,
                0,
                0,
                0
            ));
            return;
        }

        // Format asset values
        const {
            currentDebtFormatted,
            availableBalanceFormatted,
            maxRepayAmount
        } = formatAssetValues(borrowBalance, tokenBalance.value, selectedAsset.decimals);

        // Format blockchain values
        const totalCollateralValueFormatted = Number(totalCollateralValue) / PRICE_PRECISION;
        const totalDebtValueFormatted = Number(totalDebtValue) / PRICE_PRECISION;
        const currentHealthFactorFormatted = Number(healthFactor) / PRICE_PRECISION;

        // Handle case where there's no debt to repay
        if (currentDebtFormatted === 0) {
            setValidationResult(createValidationResult(
                false,
                `No debt to repay for ${selectedAsset.unit}`,
                '0',
                availableBalanceFormatted,
                0,
                currentHealthFactorFormatted,
                currentHealthFactorFormatted
            ));
            return;
        }

        // Handle case where no amount is entered yet
        if (!amount || parseFloat(amount) <= 0) {
            setValidationResult(createValidationResult(
                false,
                '',
                maxRepayAmount,
                availableBalanceFormatted,
                currentDebtFormatted,
                currentHealthFactorFormatted,
                currentHealthFactorFormatted
            ));
            return;
        }

        // Parse and validate repay amount
        const repayAmount = parseFloat(amount);
        const isFullRepayment = repayAmount >= currentDebtFormatted;

        // Calculate new health factor after repayment
        const assetPriceUsd = parseAssetPrice(selectedAsset.price);
        const repayValueUsd = repayAmount * assetPriceUsd;

        const newHealthFactor = calculateNewHealthFactor(
            currentHealthFactorFormatted,
            totalCollateralValueFormatted,
            totalDebtValueFormatted,
            repayValueUsd
        );

        // Validate the repay amount
        const validation = validateRepayAmount(
            repayAmount,
            availableBalanceFormatted,
            currentDebtFormatted,
            selectedAsset.unit
        );

        // Set final validation result
        setValidationResult(createValidationResult(
            validation.isValid,
            validation.error,
            maxRepayAmount,
            availableBalanceFormatted,
            currentDebtFormatted,
            currentHealthFactorFormatted,
            newHealthFactor,
            isFullRepayment
        ));
    }, [selectedAsset, userAddress, universalLendingProtocol, amount, borrowBalance, tokenBalance, healthFactor, totalCollateralValue, totalDebtValue]);

    // Run validation when dependencies change
    useEffect(() => {
        validateRepay();
    }, [validateRepay]);

    return validationResult;
}