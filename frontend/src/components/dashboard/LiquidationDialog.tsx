import { useState, useCallback, useEffect, useMemo } from 'react';
import { useAccount, useReadContract } from 'wagmi';
import { parseUnits, formatUnits, erc20Abi } from 'viem';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { useContracts, SupportedChain } from '../../hooks/useContracts';
import { EVMAddress } from './types';
import { UniversalLendingProtocol__factory } from '../../contracts/typechain-types';
import { getTokenDecimals, getTokenSymbol } from '../../contracts/deployments';
import { useLiquidateTransactionFlow } from '../../hooks/useTransactionFlow';
import { FaBolt } from 'react-icons/fa';
import { HourglassLoader } from '../ui/hourglass-loader';

interface UserPositionData {
  totalCollateralValue: string;
  totalDebtValue: string;
  healthFactor: string;
  maxBorrowUsdValue: string;
  liquidationThreshold: string;
  suppliedAssets: EVMAddress[];
  suppliedAmounts: string[];
  suppliedValues: string[];
  borrowedAssets: EVMAddress[];
  borrowedAmounts: string[];
  borrowedValues: string[];
}

interface LiquidationDialogProps {
  targetAddress: EVMAddress;
  isOpen: boolean;
  onClose: () => void;
}

export function LiquidationDialog({ targetAddress, isOpen, onClose }: LiquidationDialogProps) {
  const { address: userAddress } = useAccount();
  const [selectedCollateralAsset, setSelectedCollateralAsset] = useState<EVMAddress | ''>('');
  const [selectedDebtAsset, setSelectedDebtAsset] = useState<EVMAddress | ''>('');
  const [repayAmount, setRepayAmount] = useState('');
  const [maxRepayAmount, setMaxRepayAmount] = useState('0');
  const [needsApproval, setNeedsApproval] = useState(false);

  const { universalLendingProtocol } = useContracts(SupportedChain.ZETA_TESTNET);

  // Fetch user position data
  const {
    data: positionData,
    isLoading: isLoadingPosition,
    refetch: refetchPosition
  } = useReadContract({
    address: universalLendingProtocol as EVMAddress,
    abi: UniversalLendingProtocol__factory.abi,
    functionName: 'getUserPositionData',
    args: [targetAddress],
    query: {
      enabled: Boolean(universalLendingProtocol && targetAddress && isOpen),
    },
  });

  // Use liquidation transaction flow
  const {
    state: { currentStep, approvalHash, transactionHash },
    actions: { setCurrentStep, writeContract, reset: resetTransaction },
    contractState: {
      error: contractError,
      isApprovingTx,
      isApprovalSuccess,
      isTransactionTx,
      isTransactionSuccess,
      isTransactionError,
      transactionError
    }
  } = useLiquidateTransactionFlow();

  const { data: getMaxLiquidationData } = useReadContract({
    address: universalLendingProtocol as EVMAddress,
    abi: UniversalLendingProtocol__factory.abi,
    functionName: 'getMaxLiquidation',
    args: [userAddress as EVMAddress, selectedCollateralAsset as EVMAddress, selectedDebtAsset as EVMAddress],
    query: {
      enabled: Boolean(universalLendingProtocol && userAddress && selectedCollateralAsset && selectedDebtAsset && isOpen),
    },
  });

  // Check current allowance for the debt asset
  const { data: currentAllowance } = useReadContract({
    address: selectedDebtAsset as EVMAddress,
    abi: erc20Abi,
    functionName: 'allowance',
    args: [userAddress as EVMAddress, universalLendingProtocol as EVMAddress],
    query: {
      enabled: Boolean(selectedDebtAsset && userAddress && universalLendingProtocol && isOpen),
    },
  });

  // Check user balance for the debt asset
  const { data: userBalance } = useReadContract({
    address: selectedDebtAsset as EVMAddress,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [userAddress as EVMAddress],
    query: {
      enabled: Boolean(selectedDebtAsset && userAddress && isOpen),
    },
  });

  // Parse position data
  const parsedPositionData: UserPositionData | null = useMemo(() => positionData ? {
    totalCollateralValue: formatUnits(positionData[0], 18),
    totalDebtValue: formatUnits(positionData[1], 18),
    healthFactor: formatUnits(positionData[2], 18),
    maxBorrowUsdValue: formatUnits(positionData[3], 18),
    liquidationThreshold: formatUnits(positionData[4], 18),
    suppliedAssets: positionData[5] as EVMAddress[],
    suppliedAmounts: positionData[6].map((amount: bigint, index: number) => {
      const asset = positionData[5][index];
      return asset ? formatUnits(amount, getTokenDecimals(asset as EVMAddress)) : formatUnits(amount, 18);
    }),
    suppliedValues: positionData[7].map((value: bigint) => formatUnits(value, 18)),
    borrowedAssets: positionData[8] as EVMAddress[],
    borrowedAmounts: positionData[9].map((amount: bigint, index: number) => {
      const asset = positionData[8][index];
      return asset ? formatUnits(amount, getTokenDecimals(asset as EVMAddress)) : formatUnits(amount, 18);
    }),
    borrowedValues: positionData[10].map((value: bigint) => formatUnits(value, 18)),
  } : null, [positionData]);

  // Set max repay amount when debt asset is selected
  useEffect(() => {
    if (getMaxLiquidationData) {
      setMaxRepayAmount(formatUnits(getMaxLiquidationData[0], getTokenDecimals(selectedDebtAsset as EVMAddress)));
    }
  }, [getMaxLiquidationData, selectedDebtAsset]);

  // Check if approval is needed
  useEffect(() => {
    if (currentAllowance && repayAmount && selectedDebtAsset) {
      const repayAmountWei = parseUnits(repayAmount, getTokenDecimals(selectedDebtAsset));
      setNeedsApproval(currentAllowance < repayAmountWei);
    } else {
      setNeedsApproval(false);
    }
  }, [currentAllowance, repayAmount, selectedDebtAsset]);

  // Handle liquidation
  const handleLiquidate = useCallback(() => {
    if (!universalLendingProtocol || !userAddress || !selectedCollateralAsset || !selectedDebtAsset || !repayAmount) {
      return;
    }

    // Convert repay amount to proper decimals
    const repayAmountWei = parseUnits(repayAmount, getTokenDecimals(selectedDebtAsset));
    setCurrentStep('liquidate');

    writeContract({
      address: universalLendingProtocol,
      abi: UniversalLendingProtocol__factory.abi,
      functionName: 'liquidate',
      args: [
        targetAddress,
        selectedCollateralAsset,
        selectedDebtAsset,
        repayAmountWei
      ],
    });
  }, [universalLendingProtocol, userAddress, targetAddress, selectedCollateralAsset, selectedDebtAsset, repayAmount, writeContract, setCurrentStep]);

  // Handle approval success -> proceed to liquidation
  useEffect(() => {
    if (isApprovalSuccess && currentStep === 'approving') {
      handleLiquidate();
    }
  }, [isApprovalSuccess, currentStep, handleLiquidate]);

  // Handle transaction success
  useEffect(() => {
    if (isTransactionSuccess) {
      setCurrentStep('success');
    }
  }, [isTransactionSuccess, setCurrentStep]);

  // Handle transaction error
  useEffect(() => {
    if (isTransactionError) {
      setCurrentStep('failed');
    }
  }, [isTransactionError, setCurrentStep]);

  // Handle approval
  const handleApprove = useCallback(() => {
    if (!selectedDebtAsset || !universalLendingProtocol || !repayAmount) {
      return;
    }

    const repayAmountWei = parseUnits(repayAmount, getTokenDecimals(selectedDebtAsset));
    setCurrentStep('approve');

    writeContract({
      address: selectedDebtAsset,
      abi: erc20Abi,
      functionName: 'approve',
      args: [universalLendingProtocol, repayAmountWei],
    });
  }, [selectedDebtAsset, universalLendingProtocol, repayAmount, writeContract, setCurrentStep]);


  // Main submit handler that starts the approval flow
  const handleSubmit = useCallback(() => {
    if (!universalLendingProtocol || !userAddress || !selectedCollateralAsset || !selectedDebtAsset || !repayAmount) {
      return;
    }

    // Reset any previous state
    resetTransaction();

    // Check if approval is needed before initiating the flow
    if (needsApproval) {
      handleApprove();
    } else {
      handleLiquidate();
    }
  }, [
    universalLendingProtocol,
    userAddress,
    selectedCollateralAsset,
    selectedDebtAsset,
    repayAmount,
    resetTransaction,
    handleApprove,
    handleLiquidate,
    needsApproval,
  ]);

  const isLiquidatable = parsedPositionData && parseFloat(parsedPositionData.healthFactor) < 1.2;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Liquidate Position</DialogTitle>
          <DialogDescription>
            Liquidate undercollateralized position for {targetAddress.slice(0, 8)}...{targetAddress.slice(-6)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {isLoadingPosition ? (
            <div className="flex items-center justify-center py-8">
              <HourglassLoader size="lg" />
              <span className="ml-2">Loading position data...</span>
            </div>
          ) : !parsedPositionData ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Failed to load position data</p>
              <Button variant="outline" onClick={() => void refetchPosition()}>
                Retry
              </Button>
            </div>
          ) : (
            <>
              {/* Position Overview */}
              <Card className="p-4">
                <h3 className="font-semibold mb-3">Position Overview</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <div className="text-muted-foreground">Health Factor</div>
                    <div className={`font-medium ${parseFloat(parsedPositionData.healthFactor) < 1.2 ? 'text-red-500' : 'text-green-500'}`}>
                      {parseFloat(parsedPositionData.healthFactor).toFixed(4)}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Total Collateral</div>
                    <div>${parseFloat(parsedPositionData.totalCollateralValue).toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Total Debt</div>
                    <div>${parseFloat(parsedPositionData.totalDebtValue).toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Status</div>
                    <div className={isLiquidatable ? 'text-red-500' : 'text-green-500'}>
                      {isLiquidatable ? 'Liquidatable' : 'Healthy'}
                    </div>
                  </div>
                </div>
              </Card>

              {!isLiquidatable && (
                <Card className="p-4 border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20">
                  <div className="text-yellow-600 dark:text-yellow-400">
                    <strong>Warning:</strong> This position is not currently liquidatable (health factor ≥ 1.2)
                  </div>
                </Card>
              )}

              {/* Show collateral and debt breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="p-4">
                  <h4 className="font-medium mb-2">Collateral Assets</h4>
                  <div className="space-y-2">
                    {parsedPositionData.suppliedAssets.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No collateral assets</p>
                    ) : (
                      parsedPositionData.suppliedAssets.map((asset, index) => (
                        <div key={asset} className="flex justify-between text-sm">
                          <span>{getTokenSymbol(asset)}</span>
                          <span>{parseFloat(parsedPositionData.suppliedAmounts[index] ?? '0').toFixed(4)}</span>
                        </div>
                      ))
                    )}
                  </div>
                </Card>

                <Card className="p-4">
                  <h4 className="font-medium mb-2">Debt Assets</h4>
                  <div className="space-y-2">
                    {parsedPositionData.borrowedAssets.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No debt assets</p>
                    ) : (
                      parsedPositionData.borrowedAssets.map((asset, index) => (
                        <div key={asset} className="flex justify-between text-sm">
                          <span>{getTokenSymbol(asset)}</span>
                          <span>{parseFloat(parsedPositionData.borrowedAmounts[index] ?? '0').toFixed(4)}</span>
                        </div>
                      ))
                    )}
                  </div>
                </Card>
              </div>

              {/* Only show liquidation parameters if position has debt */}
              {parsedPositionData.borrowedAssets.length > 0 && (
                <Card className="p-4">
                  <h3 className="font-semibold mb-3">Liquidation Parameters</h3>
                  <div className="space-y-4">
                    {/* Collateral Asset Selection */}
                    <div>
                      <Label htmlFor="collateral-asset">Collateral Asset to Seize</Label>
                      <Select value={selectedCollateralAsset} onValueChange={(value) => setSelectedCollateralAsset(value as EVMAddress)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select collateral asset" />
                        </SelectTrigger>
                        <SelectContent>
                          {parsedPositionData.suppliedAssets.map((asset, index) => (
                            <SelectItem key={asset} value={asset}>
                              {getTokenSymbol(asset)} - {parseFloat(parsedPositionData.suppliedAmounts[index] ?? '0').toFixed(4)}
                              (${parseFloat(parsedPositionData.suppliedValues[index] ?? '0').toFixed(2)})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Debt Asset Selection */}
                    <div>
                      <Label htmlFor="debt-asset">Debt Asset to Repay</Label>
                      <Select value={selectedDebtAsset} onValueChange={(value) => setSelectedDebtAsset(value as EVMAddress)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select debt asset" />
                        </SelectTrigger>
                        <SelectContent>
                          {parsedPositionData.borrowedAssets.map((asset, index) => (
                            <SelectItem key={asset} value={asset}>
                              {getTokenSymbol(asset)} - {parseFloat(parsedPositionData.borrowedAmounts[index] ?? '0').toFixed(4)}
                              (${parseFloat(parsedPositionData.borrowedValues[index] ?? '0').toFixed(2)})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Repay Amount */}
                    <div>
                      <Label htmlFor="repay-amount">Repay Amount</Label>
                      <div className="flex gap-2">
                        <Input
                          id="repay-amount"
                          type="number"
                          placeholder="0.0"
                          value={repayAmount}
                          onChange={(e) => setRepayAmount(e.target.value)}
                          className="flex-1"
                          step="0.000001"
                          min="0"
                        />
                        <Button
                          variant="outline"
                          onClick={() => setRepayAmount(maxRepayAmount)}
                          disabled={!maxRepayAmount || maxRepayAmount === '0'}
                        >
                          Max
                        </Button>
                      </div>
                      {selectedDebtAsset && (
                        <div className="space-y-1 mt-1">
                          <p className="text-sm text-muted-foreground">
                            Max: {parseFloat(maxRepayAmount).toFixed(6)} {getTokenSymbol(selectedDebtAsset)}
                          </p>
                          {userBalance && (
                            <p className="text-sm text-muted-foreground">
                              Your balance: {formatUnits(userBalance, getTokenDecimals(selectedDebtAsset))} {getTokenSymbol(selectedDebtAsset)}
                            </p>
                          )}
                          {needsApproval && currentStep === 'input' && (
                            <p className="text-sm text-yellow-600">
                              Approval required for {repayAmount} {selectedDebtAsset ? getTokenSymbol(selectedDebtAsset) : ''}
                            </p>
                          )}
                          {currentStep === 'approve' && (
                            <p className="text-sm text-blue-600">
                              Click to approve token spending...
                            </p>
                          )}
                          {currentStep === 'approving' && (
                            <p className="text-sm text-blue-600">
                              Waiting for approval confirmation...
                            </p>
                          )}
                          {currentStep === 'liquidate' && (
                            <p className="text-sm text-blue-600">
                              Sign transaction to liquidate position...
                            </p>
                          )}
                          {currentStep === 'liquidating' && (
                            <p className="text-sm text-blue-600">
                              Waiting for liquidation confirmation...
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3">
                <Button
                  onClick={handleSubmit}
                  disabled={
                    parsedPositionData.borrowedAssets.length === 0 ||
                    !selectedCollateralAsset ||
                    !selectedDebtAsset ||
                    !repayAmount ||
                    parseFloat(repayAmount) <= 0 ||
                    parseFloat(repayAmount) > parseFloat(maxRepayAmount) ||
                    currentStep === 'approve' ||
                    currentStep === 'approving' ||
                    currentStep === 'liquidate' ||
                    currentStep === 'liquidating' ||
                    isApprovingTx ||
                    isTransactionTx ||
                    Boolean(userBalance && selectedDebtAsset && parseUnits(repayAmount, getTokenDecimals(selectedDebtAsset)) > userBalance)
                  }
                  className="flex-1"
                  variant={isLiquidatable ? "destructive" : "outline"}
                >
                  {currentStep === 'approve' || isApprovingTx ? (
                    <>
                      <HourglassLoader size="sm" className="mr-2" />
                      Approving {selectedDebtAsset ? getTokenSymbol(selectedDebtAsset) : ''}...
                    </>
                  ) : currentStep === 'liquidate' || currentStep === 'liquidating' || isTransactionTx ? (
                    <>
                      <HourglassLoader size="sm" className="mr-2" />
                      Liquidating...
                    </>
                  ) : (
                    <>
                      <FaBolt className="mr-2" />
                      {needsApproval ? 'Approve & Liquidate' : 'Liquidate Position'}
                    </>
                  )}
                </Button>
                <Button variant="outline" onClick={onClose}>
                  Cancel
                </Button>
              </div>

              {/* Transaction Status */}
              {contractError && (
                <Card className="p-4 border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20">
                  <div className="text-red-600 dark:text-red-400">
                    <strong>Transaction Error:</strong> {contractError.message}
                  </div>
                </Card>
              )}

              {transactionError && (
                <Card className="p-4 border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20">
                  <div className="text-red-600 dark:text-red-400">
                    <strong>Transaction Failed:</strong> {transactionError.message}
                  </div>
                </Card>
              )}

              {isApprovalSuccess && (
                <Card className="p-4 border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20">
                  <div className="text-green-600 dark:text-green-400">
                    <strong>Approval Success!</strong> You can now proceed with liquidation. Tx: {approvalHash}
                  </div>
                </Card>
              )}

              {isTransactionSuccess && (
                <Card className="p-4 border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20">
                  <div className="text-green-600 dark:text-green-400">
                    <strong>Success!</strong> Liquidation completed. Tx: {transactionHash}
                  </div>
                </Card>
              )}

              {currentStep === 'failed' && (
                <Card className="p-4 border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20">
                  <div className="text-red-600 dark:text-red-400">
                    <strong>Transaction Failed:</strong> Please try again.
                    <Button variant="outline" size="sm" className="ml-2" onClick={resetTransaction}>
                      Reset
                    </Button>
                  </div>
                </Card>
              )}

              {userBalance && repayAmount && selectedDebtAsset && parseUnits(repayAmount, getTokenDecimals(selectedDebtAsset)) > userBalance && (
                <Card className="p-4 border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20">
                  <div className="text-red-600 dark:text-red-400">
                    <strong>Insufficient Balance:</strong> You don't have enough {selectedDebtAsset ? getTokenSymbol(selectedDebtAsset) : 'tokens'} to complete this liquidation.
                  </div>
                </Card>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}