import { useState, useCallback, useEffect } from 'react';
import { useReadContract } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { UniversalLendingProtocol__factory, ERC20__factory } from '@/contracts/typechain-types';
import type { UserAssetData } from '../components/dashboard/types';
import { EVMAddress, ZERO_ADDRESS, isZeroAddress, addressesEqual, safeEVMAddressOrZeroAddress } from '@/types/address';
import { getGasTokenSymbol, getGasTokenDecimals } from '../utils/chainUtils';


// Default gas token info
const EMPTY_GAS_TOKEN_INFO = {
    address: ZERO_ADDRESS,
    amount: BigInt(0),
    needsApproval: false,
};

const DEFAULT_VALIDATION_FAILED_RESULT: WithdrawValidationResult = {
    isValid: false,
    error: '',
    needsApproval: false,
    gasTokenInfo: EMPTY_GAS_TOKEN_INFO,
    receiveAmount: BigInt(0),
    formattedReceiveAmount: '0',
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
    universalLendingProtocol: EVMAddress;
    userAddress: EVMAddress;
}

// Helper function to check if the selected token is the gas token
const isTokenGasToken = (selectedAsset: UserAssetData, gasTokenAddress: EVMAddress): boolean => {
    if (isZeroAddress(selectedAsset.address) || isZeroAddress(gasTokenAddress)) return false;
    return addressesEqual(selectedAsset.address, gasTokenAddress);
};

export function useWithdrawValidation({
    selectedAsset,
    amount,
    universalLendingProtocol,
    userAddress,
}: UseWithdrawValidationProps): WithdrawValidationResult {
    const [validationResult, setValidationResult] = useState<WithdrawValidationResult>(DEFAULT_VALIDATION_FAILED_RESULT);

    // Computed values
    const amountBigInt = amount && selectedAsset && selectedAsset.address !== ZERO_ADDRESS ? parseUnits(amount, selectedAsset.decimals) : BigInt(0);
    const maxAmount = selectedAsset?.formattedSuppliedBalance ?? '0';
    const gasTokenSymbol = selectedAsset?.sourceChain ? getGasTokenSymbol(selectedAsset.sourceChain) : '';
    const gasTokenDecimals = selectedAsset?.sourceChain ? getGasTokenDecimals(selectedAsset.sourceChain) : 18;

    // Check if user can withdraw this amount (health factor validation)
    const { data: canWithdraw, error: canWithdrawError } = useReadContract({
        address: universalLendingProtocol,
        abi: UniversalLendingProtocol__factory.abi,
        functionName: 'canWithdraw',
        args: selectedAsset && amountBigInt > 0 ? [
            userAddress,
            selectedAsset.address,
            amountBigInt,
        ] : undefined,
        query: {
            enabled: Boolean(selectedAsset && amountBigInt > 0),
            refetchInterval: 10000,
        },
    });

    // Get gas fee requirements
    const { data: gasFeeData, error: gasFeeError } = useReadContract({
        address: universalLendingProtocol,
        abi: UniversalLendingProtocol__factory.abi,
        functionName: 'getWithdrawGasFee',
        args: selectedAsset ? [selectedAsset.address] : undefined,
        query: {
            enabled: Boolean(selectedAsset),
            refetchInterval: 10000,
        },
    });

    // Get gas token address and fee amount with safe defaults
    const gasTokenAddress = gasFeeData?.[0] ? safeEVMAddressOrZeroAddress(gasFeeData[0]) : ZERO_ADDRESS;
    const gasFeeAmount = gasFeeData?.[1] ?? BigInt(0);

    // Check if the selected token is the gas token
    const isGasToken = selectedAsset && !isZeroAddress(selectedAsset.address) ? isTokenGasToken(selectedAsset, gasTokenAddress) : false;

    // Calculate receive amount for gas tokens (withdrawal amount - gas fee)
    const receiveAmount = isGasToken && gasFeeAmount && amountBigInt > 0
        ? amountBigInt - gasFeeAmount
        : amountBigInt;

    // Format receive amount for display
    const formattedReceiveAmount = receiveAmount > 0 && selectedAsset
        ? formatUnits(receiveAmount, selectedAsset.decimals)
        : '0';

    // Get gas token balance only if gas token is different from asset
    const { data: gasTokenBalance, error: gasTokenBalanceError } = useReadContract({
        address: gasTokenAddress,
        abi: ERC20__factory.abi,
        functionName: 'balanceOf',
        args: [userAddress],
        query: {
            enabled: Boolean(!isZeroAddress(gasTokenAddress) && !isGasToken),
            refetchInterval: 10000,
        },
    });

    // Get withdrawal token allowance - protocol needs this for transferFrom
    const { data: withdrawalTokenAllowance, error: withdrawalTokenAllowanceError } = useReadContract({
        address: selectedAsset?.address ?? ZERO_ADDRESS,
        abi: ERC20__factory.abi,
        functionName: 'allowance',
        args: [userAddress, universalLendingProtocol],
        query: {
            enabled: Boolean(selectedAsset && !isZeroAddress(selectedAsset.address)),
            refetchInterval: 10000,
        },
    });

    // Get gas token allowance only if gas token is different from asset
    const { data: gasTokenAllowance, error: gasTokenAllowanceError } = useReadContract({
        address: gasTokenAddress,
        abi: ERC20__factory.abi,
        functionName: 'allowance',
        args: [userAddress, universalLendingProtocol],
        query: {
            enabled: Boolean(!isZeroAddress(gasTokenAddress) && !isGasToken),
            refetchInterval: 10000,
        },
    });

    // Validate withdrawal parameters
    const validateWithdrawal = useCallback(() => {
        if (!selectedAsset) {
            setValidationResult({
                ...DEFAULT_VALIDATION_FAILED_RESULT,
                error: 'Missing required parameters',
            });
            return;
        }

        // Check for data loading errors
        if (canWithdrawError || gasFeeError || gasTokenBalanceError || gasTokenAllowanceError || withdrawalTokenAllowanceError) {
            setValidationResult({
                ...DEFAULT_VALIDATION_FAILED_RESULT,
                error: 'Error loading data',
            });
            return;
        }

        // Check if data is still loading (only check what's needed)
        if (gasFeeData === undefined) {
            setValidationResult({
                ...DEFAULT_VALIDATION_FAILED_RESULT,
                error: 'Loading data...',
            });
            return;
        }

        // Handle case where no amount is entered yet
        if (!amount || parseFloat(amount) <= 0) {
            setValidationResult({
                ...DEFAULT_VALIDATION_FAILED_RESULT,
                error: '',
                receiveAmount,
                formattedReceiveAmount,
            });
            return;
        }

        // Check if withdrawal is allowed (health factor)
        if (canWithdraw === false) {
            setValidationResult({
                ...DEFAULT_VALIDATION_FAILED_RESULT,
                error: 'Withdrawal would break collateral requirements',
                receiveAmount,
                formattedReceiveAmount,
            });
            return;
        }

        // Check gas fee requirements
        if (isZeroAddress(gasTokenAddress) || !gasFeeAmount) {
            setValidationResult({
                ...DEFAULT_VALIDATION_FAILED_RESULT,
                error: 'Unable to determine gas fee requirements',
                receiveAmount,
                formattedReceiveAmount,
            });
            return;
        }

        let error = '';
        let isValid = true;
        let needsApproval = false;
        let currentGasTokenInfo = EMPTY_GAS_TOKEN_INFO;

        if (isGasToken) {
            // For gas tokens: check if user has enough tokens for withdrawal amount (gas is paid from withdrawal amount)
            const totalNeeded = amountBigInt;
            const availableBalance = parseUnits(maxAmount, selectedAsset.decimals);

            if (totalNeeded > availableBalance) {
                error = `Insufficient balance. You need ${formatUnits(totalNeeded, selectedAsset.decimals)} ${selectedAsset.unit} total (${amount} withdrawal + ${formatUnits(gasFeeAmount, gasTokenDecimals)} gas fee) but only have ${maxAmount} ${selectedAsset.unit} available.`;
                isValid = false;
            } else if (receiveAmount <= 0) {
                error = `Gas fee (${formatUnits(gasFeeAmount, gasTokenDecimals)} ${gasTokenSymbol}) is greater than or equal to withdrawal amount. You would receive 0 or negative tokens.`;
                isValid = false;
            }
        } else {
            // For non-gas tokens: check gas token balance and approval only
            const safeGasTokenBalance = gasTokenBalance ?? BigInt(0);

            if (safeGasTokenBalance < gasFeeAmount) {
                error = `Insufficient ${gasTokenSymbol} in wallet for gas fees. Need ${formatUnits(gasFeeAmount, gasTokenDecimals)} ${gasTokenSymbol} but have ${formatUnits(safeGasTokenBalance, gasTokenDecimals)} ${gasTokenSymbol}. Please get more ${gasTokenSymbol} in your wallet before proceeding.`;
                isValid = false;
            } else {
                // Check allowance for gas token
                const safeGasTokenAllowance = gasTokenAllowance ?? BigInt(0);

                if (safeGasTokenAllowance < gasFeeAmount) {
                    error = `Please approve ${gasTokenSymbol} spending for gas fees. The protocol needs permission to pay gas fees for your cross-chain withdrawal.`;
                    needsApproval = true;
                    currentGasTokenInfo = {
                        address: gasTokenAddress,
                        amount: gasFeeAmount,
                        needsApproval: true,
                    };
                    isValid = true; // Keep true so approval button shows
                }
            }
        }

        setValidationResult({
            isValid,
            error,
            needsApproval,
            gasTokenInfo: currentGasTokenInfo,
            receiveAmount,
            formattedReceiveAmount,
        });

    }, [selectedAsset, amount, canWithdraw, gasFeeData, gasTokenAddress, gasFeeAmount, gasTokenBalance, gasTokenAllowance, withdrawalTokenAllowance, gasTokenSymbol, gasTokenDecimals, isGasToken, receiveAmount, formattedReceiveAmount, maxAmount, amountBigInt, canWithdrawError, gasFeeError, gasTokenBalanceError, gasTokenAllowanceError, withdrawalTokenAllowanceError]);

    // Run validation when dependencies change
    useEffect(() => {
        validateWithdrawal();
    }, [validateWithdrawal]);

    return validationResult;
}