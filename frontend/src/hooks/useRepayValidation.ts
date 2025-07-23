import { useEffect, useState, useCallback } from 'react';
import { useReadContract, useBalance, useAccount } from 'wagmi';
import { SimpleLendingProtocol__factory } from '@/contracts/typechain-types';
import { SupportedChain, getTokenAddress } from '../contracts/deployments';
import { safeEVMAddressOrZeroAddress, ZERO_ADDRESS, type EVMAddress, type UserAssetData } from '../components/dashboard/types';

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
    currentHealthFactor: number;
    newHealthFactor: number;
    isFullRepayment: boolean;
}

export function useRepayValidation({
    selectedAsset,
    amount,
    simpleLendingProtocol,
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
        address: simpleLendingProtocol ?? undefined,
        abi: SimpleLendingProtocol__factory.abi,
        functionName: 'getBorrowBalance',
        args: userAddress && selectedAsset ? [userAddress, selectedAsset.address] : undefined,
        query: {
            enabled: Boolean(simpleLendingProtocol && userAddress && selectedAsset),
            refetchInterval: 10000,
        },
    });

    // Get user's health factor
    const { data: healthFactor } = useReadContract({
        address: simpleLendingProtocol ?? undefined,
        abi: SimpleLendingProtocol__factory.abi,
        functionName: 'getHealthFactor',
        args: userAddress ? [userAddress] : undefined,
        query: {
            enabled: Boolean(simpleLendingProtocol && userAddress),
            refetchInterval: 10000,
        },
    });

    // Get user's total collateral value
    const { data: totalCollateralValue } = useReadContract({
        address: simpleLendingProtocol ?? undefined,
        abi: SimpleLendingProtocol__factory.abi,
        functionName: 'getTotalCollateralValue',
        args: userAddress ? [userAddress] : undefined,
        query: {
            enabled: Boolean(simpleLendingProtocol && userAddress),
            refetchInterval: 10000,
        },
    });

    // Get user's total debt value
    const { data: totalDebtValue } = useReadContract({
        address: simpleLendingProtocol ?? undefined,
        abi: SimpleLendingProtocol__factory.abi,
        functionName: 'getTotalDebtValue',
        args: userAddress ? [userAddress] : undefined,
        query: {
            enabled: Boolean(simpleLendingProtocol && userAddress),
            refetchInterval: 10000,
        },
    });

    // Get user's token balance on the foreign chain (where they need to repay from)
    // Map the asset to its corresponding token on the foreign chain
    const getForeignChainTokenAddress = () => {
        if (!selectedAsset) return undefined;

        // Map ZetaChain asset to foreign chain token
        if (selectedAsset.sourceChain === 'ARBI') {
            // For Arbitrum assets
            if (selectedAsset.unit === 'ETH') {
                return getTokenAddress('ETH', SupportedChain.ARBITRUM_SEPOLIA); // address(0) for native ETH
            } else if (selectedAsset.unit === 'USDC') {
                return getTokenAddress('USDC', SupportedChain.ARBITRUM_SEPOLIA);
            }
        } else if (selectedAsset.sourceChain === 'ETH') {
            // For Ethereum assets
            if (selectedAsset.unit === 'ETH') {
                return getTokenAddress('ETH', SupportedChain.ETHEREUM_SEPOLIA); // address(0) for native ETH
            } else if (selectedAsset.unit === 'USDC') {
                return getTokenAddress('USDC', SupportedChain.ETHEREUM_SEPOLIA);
            }
        }
        return undefined;
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
                currentHealthFactor: 0,
                newHealthFactor: 0,
                isFullRepayment: false,
            });
            return;
        }

        if (!borrowBalance || !tokenBalance || healthFactor === undefined || totalCollateralValue === undefined || totalDebtValue === undefined) {
            setValidationResult({
                isValid: false,
                error: 'Loading data...',
                maxRepayAmount: '0',
                availableBalance: '0',
                formattedAvailableBalance: '0',
                currentDebt: '0',
                formattedCurrentDebt: '0',
                currentHealthFactor: 0,
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

        // Calculate current health factor
        const totalCollateralValueFormatted = Number(totalCollateralValue) / 1e18;
        const totalDebtValueFormatted = Number(totalDebtValue) / 1e18;
        const currentHealthFactorFormatted = Number(healthFactor) / 1e18;

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
                currentHealthFactor: currentHealthFactorFormatted > 999 ? Infinity : currentHealthFactorFormatted,
                newHealthFactor: currentHealthFactorFormatted > 999 ? Infinity : currentHealthFactorFormatted,
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
                currentHealthFactor: currentHealthFactorFormatted > 999 ? Infinity : currentHealthFactorFormatted,
                newHealthFactor: currentHealthFactorFormatted > 999 ? Infinity : currentHealthFactorFormatted,
                isFullRepayment: false,
            });
            return;
        }

        const repayAmount = parseFloat(amount);
        const isFullRepayment = repayAmount >= currentDebtFormatted;

        // Calculate new health factor after repayment
        const priceString = selectedAsset.price || '0';
        const assetPriceUsd = parseFloat(priceString.replace(/[$,]/g, '') || '0');
        const repayValueUsd = repayAmount * assetPriceUsd;

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
            currentHealthFactor: currentHealthFactorFormatted > 999 ? Infinity : currentHealthFactorFormatted,
            newHealthFactor,
            isFullRepayment,
        });
    }, [selectedAsset, userAddress, simpleLendingProtocol, amount, borrowBalance, tokenBalance, healthFactor, totalCollateralValue, totalDebtValue]);

    // Run validation when dependencies change
    useEffect(() => {
        validateRepay();
    }, [validateRepay]);

    return validationResult;
}