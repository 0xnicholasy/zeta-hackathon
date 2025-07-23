import { useState, useCallback, useMemo } from 'react';
import { useReadContract } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { SimpleLendingProtocol__factory, ERC20__factory } from '@/contracts/typechain-types';
import type { UserAssetData, EVMAddress } from '../components/dashboard/types';
import {
    safeEVMAddress,
    safeEVMAddressOrZeroAddress,
    addressesEqual,
    ZERO_ADDRESS,
    isZeroAddress
} from '../components/dashboard/types';
import { getGasTokenSymbol, getGasTokenDecimals } from '../utils/chainUtils';

// Default empty asset for safe handling
const EMPTY_ASSET: UserAssetData = {
    address: ZERO_ADDRESS,
    symbol: '',
    unit: '',
    sourceChain: '',
    suppliedBalance: '0',
    borrowedBalance: '0',
    formattedSuppliedBalance: '0',
    formattedBorrowedBalance: '0',
    suppliedUsdValue: '0',
    borrowedUsdValue: '0',
    price: '0',
    isSupported: false,
    decimals: 18,
};

// Default gas token info
const EMPTY_GAS_TOKEN_INFO = {
    address: ZERO_ADDRESS,
    amount: BigInt(0),
    needsApproval: false,
};

export interface GasTokenInfo {
    address: EVMAddress;
    amount: bigint;
    needsApproval: boolean;
}

export interface WithdrawValidationResult {
    isValid: boolean;
    error: string;
    needsApproval: boolean;
    gasTokenInfo: GasTokenInfo;
    receiveAmount: bigint;
    formattedReceiveAmount: string;
}

export interface UseWithdrawValidationProps {
    selectedAsset: UserAssetData | null;
    amount: string;
    simpleLendingProtocol: string | undefined;
    userAddress: EVMAddress;
}

// Helper function to check if the selected token is the gas token
const isTokenGasToken = (selectedAsset: UserAssetData, gasTokenAddress: EVMAddress): boolean => {
    if (isZeroAddress(selectedAsset.address) || isZeroAddress(gasTokenAddress)) return false;
    return addressesEqual(selectedAsset.address, gasTokenAddress);
};

export function useWithdrawValidation(props: UseWithdrawValidationProps): WithdrawValidationResult {
    // Create safe defaults to avoid null/undefined handling throughout the hook
    const selectedAsset = props.selectedAsset || EMPTY_ASSET;
    const amount = props.amount || '';
    const simpleLendingProtocol = props.simpleLendingProtocol || '';
    const userAddress = props.userAddress;

    // State with safe defaults
    // const [validationError, setValidationError] = useState<string>('');
    const [gasTokenInfo, setGasTokenInfo] = useState<GasTokenInfo>(EMPTY_GAS_TOKEN_INFO);

    // Computed values
    const amountBigInt = amount && !isZeroAddress(selectedAsset.address) ? parseUnits(amount, selectedAsset.decimals) : BigInt(0);
    const maxAmount = selectedAsset.formattedSuppliedBalance;
    const gasTokenSymbol = getGasTokenSymbol(selectedAsset.sourceChain);
    const gasTokenDecimals = getGasTokenDecimals(selectedAsset.sourceChain);

    // SimpleLendingProtocol ABI
    const lendingProtocolAbi = SimpleLendingProtocol__factory.abi;
    const erc20Abi = ERC20__factory.abi;

    // Check if user can withdraw this amount (health factor validation)
    const { data: canWithdraw } = useReadContract({
        address: safeEVMAddress(simpleLendingProtocol),
        abi: lendingProtocolAbi,
        functionName: 'canWithdraw',
        args: !isZeroAddress(selectedAsset.address) && amountBigInt > 0 ? [
            userAddress,
            selectedAsset.address,
            amountBigInt,
        ] : undefined,
        query: {
            enabled: Boolean(!isZeroAddress(selectedAsset.address) && amountBigInt > 0 && simpleLendingProtocol),
        },
    });

    // Get gas fee requirements
    const { data: gasFeeData } = useReadContract({
        address: safeEVMAddress(simpleLendingProtocol),
        abi: lendingProtocolAbi,
        functionName: 'getWithdrawGasFee',
        args: !isZeroAddress(selectedAsset.address) ? [selectedAsset.address] : undefined,
        query: {
            enabled: Boolean(!isZeroAddress(selectedAsset.address) && simpleLendingProtocol),
        },
    });

    // Get gas token address and fee amount with safe defaults
    const gasTokenAddress = gasFeeData?.[0] ? safeEVMAddressOrZeroAddress(gasFeeData[0]) : ZERO_ADDRESS;
    const gasFeeAmount = gasFeeData?.[1] || BigInt(0);

    // Check if the selected token is the gas token
    const isGasToken = !isZeroAddress(selectedAsset.address) ? isTokenGasToken(selectedAsset, gasTokenAddress) : false;

    // Calculate receive amount for gas tokens (withdrawal amount - gas fee)
    const receiveAmount = isGasToken && gasFeeAmount && amountBigInt > 0
        ? amountBigInt - gasFeeAmount
        : amountBigInt;

    // Format receive amount for display
    const formattedReceiveAmount = receiveAmount > 0 && !isZeroAddress(selectedAsset.address)
        ? formatUnits(receiveAmount, selectedAsset.decimals)
        : '0';

    // Get gas token balance only if gas token is different from asset
    const { data: gasTokenBalance } = useReadContract({
        address: gasTokenAddress,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [userAddress],
        query: {
            enabled: Boolean(!isZeroAddress(gasTokenAddress) && !isGasToken),
        },
    });

    // Get gas token allowance only if gas token is different from asset
    const { data: gasTokenAllowance } = useReadContract({
        address: gasTokenAddress,
        abi: erc20Abi,
        functionName: 'allowance',
        args: [userAddress, safeEVMAddressOrZeroAddress(simpleLendingProtocol)],
        query: {
            enabled: Boolean(!isZeroAddress(gasTokenAddress) && simpleLendingProtocol && !isGasToken),
        },
    });

    // Create error result helper
    const createErrorResult = useCallback((error: string): WithdrawValidationResult => ({
        isValid: false,
        error,
        needsApproval: false,
        gasTokenInfo: EMPTY_GAS_TOKEN_INFO,
        receiveAmount: BigInt(0),
        formattedReceiveAmount: '0',
    }), []);

    // Create success result helper
    const createSuccessResult = useCallback((needsApproval = false, gasTokenInfo = EMPTY_GAS_TOKEN_INFO): WithdrawValidationResult => ({
        isValid: !needsApproval,
        error: '',
        needsApproval,
        gasTokenInfo,
        receiveAmount,
        formattedReceiveAmount,
    }), [receiveAmount, formattedReceiveAmount]);

    // Validation logic
    const validateWithdrawal = useCallback((): WithdrawValidationResult => {
        // Early validation checks
        if (isZeroAddress(selectedAsset.address) || !amountBigInt || !simpleLendingProtocol) {
            const error = 'Missing required data';
            // setValidationError(error);
            return createErrorResult(error);
        }

        // Check if withdrawal is allowed (health factor)
        if (canWithdraw === false) {
            const error = 'Withdrawal would break collateral requirements';
            // setValidationError(error);
            return createErrorResult(error);
        }

        // Check gas fee requirements
        if (!gasFeeData || isZeroAddress(gasTokenAddress) || !gasFeeAmount) {
            const error = 'Unable to determine gas fee requirements';
            // setValidationError(error);
            return createErrorResult(error);
        }

        // For gas tokens: check if user has enough tokens for withdrawal amount + gas fee
        if (isGasToken) {
            // Check if withdrawal amount + gas fee exceeds available balance
            const totalNeeded = amountBigInt;
            const availableBalance = parseUnits(maxAmount, selectedAsset.decimals);

            if (totalNeeded > availableBalance) {
                const error = `Insufficient balance. You need ${formatUnits(totalNeeded, selectedAsset.decimals)} ${selectedAsset.unit} total (${amount} withdrawal + ${formatUnits(gasFeeAmount, gasTokenDecimals)} gas fee) but only have ${maxAmount} ${selectedAsset.unit} available.`;
                // setValidationError(error);
                return createErrorResult(error);
            }

            // Check if receive amount would be negative or zero
            if (receiveAmount <= 0) {
                const error = `Gas fee (${formatUnits(gasFeeAmount, gasTokenDecimals)} ${gasTokenSymbol}) is greater than or equal to withdrawal amount. You would receive 0 or negative tokens.`;
                // setValidationError(error);
                return createErrorResult(error);
            }
        } else {
            // For non-gas tokens: check separate gas token balance
            const safeGasTokenBalance = gasTokenBalance || BigInt(0);

            if (safeGasTokenBalance < gasFeeAmount) {
                const error = `Insufficient ${gasTokenSymbol} in wallet for gas fees. Need ${formatUnits(gasFeeAmount, gasTokenDecimals)} ${gasTokenSymbol} but have ${formatUnits(safeGasTokenBalance, gasTokenDecimals)} ${gasTokenSymbol}. Please get more ${gasTokenSymbol} in your wallet before proceeding.`;
                // setValidationError(error);
                return createErrorResult(error);
            }

            // Check allowance for separate gas token
            const safeGasTokenAllowance = gasTokenAllowance || BigInt(0);

            if (safeGasTokenAllowance < gasFeeAmount) {
                const newGasTokenInfo: GasTokenInfo = {
                    address: gasTokenAddress,
                    amount: gasFeeAmount,
                    needsApproval: true,
                };
                setGasTokenInfo(newGasTokenInfo);
                // setValidationError('');
                return createSuccessResult(true, newGasTokenInfo);
            }
        }

        // setValidationError('');
        setGasTokenInfo(EMPTY_GAS_TOKEN_INFO);
        return createSuccessResult();
    }, [
        selectedAsset, amountBigInt, simpleLendingProtocol, canWithdraw, gasFeeData,
        gasTokenAddress, gasFeeAmount, gasTokenBalance, gasTokenAllowance, gasTokenSymbol,
        gasTokenDecimals, isGasToken, receiveAmount, maxAmount, amount, createErrorResult, createSuccessResult
    ]);

    const validationResult = useMemo(() => validateWithdrawal(), [
        validateWithdrawal
    ]);

    return useMemo(() => ({
        ...validationResult,
        gasTokenInfo: gasTokenInfo.needsApproval ? gasTokenInfo : validationResult.gasTokenInfo,
    }), [validationResult, gasTokenInfo]);
}