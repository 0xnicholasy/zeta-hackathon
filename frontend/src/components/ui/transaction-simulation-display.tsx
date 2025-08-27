import { AlertTriangle, CheckCircle, Clock, TrendingUp, TrendingDown, Shield } from 'lucide-react';
import { Alert, AlertDescription } from './alert';
import type { SimulationResult } from '@/utils/transactionSimulation';
import { isLiquidatable, isBelowRecommended, formatHealthFactorFromString, getHealthFactorColorClassFromString } from '@/utils/healthFactorUtils';

interface TransactionSimulationDisplayProps {
  simulation: {
    isSimulating: boolean;
    result?: SimulationResult;
    lastSimulatedAmount?: string;
  };
  currentAmount: string;
  className?: string;
}

/**
 * Component to display transaction simulation results with health factor and warnings
 */
export function TransactionSimulationDisplay({
  simulation,
  currentAmount,
  className = ''
}: TransactionSimulationDisplayProps) {
  const { isSimulating, result, lastSimulatedAmount } = simulation;

  // Don't show anything if no simulation has been run
  if (!result && !isSimulating) {
    return null;
  }

  // Show loading state
  if (isSimulating) {
    return (
      <div className={`p-3 bg-blue-50 border border-blue-200 rounded-lg ${className}`}>
        <div className="flex items-center gap-2 text-blue-700">
          <Clock className="h-4 w-4 animate-spin" />
          <span className="text-sm font-medium">Simulating transaction...</span>
        </div>
      </div>
    );
  }

  // Don't show stale results if amount has changed
  if (lastSimulatedAmount !== currentAmount) {
    return null;
  }

  if (!result) {
    return null;
  }

  // Simulation failed
  if (!result.success) {
    return (
      <Alert className={`border-red-200 bg-red-50 ${className}`}>
        <AlertTriangle className="h-4 w-4 text-red-600" />
        <AlertDescription className="text-red-800">
          <div className="font-medium mb-1">Transaction Simulation Failed</div>
          <div className="text-sm">{result.error}</div>
        </AlertDescription>
      </Alert>
    );
  }

  // Simulation successful
  return (
    <div className={`space-y-3 ${className}`}>
      {/* Success indicator */}
      <div className="flex items-center gap-2 text-green-700 bg-green-50 p-3 rounded-lg border border-green-200">
        <CheckCircle className="h-4 w-4" />
        <span className="text-sm font-medium">Transaction simulation successful</span>
      </div>

      {/* Health factor display */}
      {result.healthFactorAfter !== undefined && (
        <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-gray-600" />
              <span className="text-sm font-medium text-gray-700">Health Factor After</span>
            </div>
            <div className="flex items-center gap-1">
              {!isBelowRecommended(result.healthFactorAfter) ? (
                <TrendingUp className="h-4 w-4 text-green-600" />
              ) : !isLiquidatable(result.healthFactorAfter) ? (
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-600" />
              )}
              <span className={`text-sm font-bold ${getHealthFactorColorClassFromString(result.healthFactorAfter)}`}>
                {formatHealthFactorFromString(result.healthFactorAfter)}x
              </span>
            </div>
          </div>

          {/* Health factor explanation */}
          <div className="mt-2 text-xs text-gray-600">
            {!isBelowRecommended(result.healthFactorAfter) ? (
              "✓ Safe - Your position is well collateralized"
            ) : !isLiquidatable(result.healthFactorAfter) ? (
              "⚠ Caution - Your position is approaching liquidation risk"
            ) : (
              "⚠ Risk - Your position may be liquidated"
            )}
          </div>
        </div>
      )}

      {/* Gas estimate */}
      {result.gasEstimate && !isNaN(Number(result.gasEstimate)) && (
        <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-blue-700">Estimated Gas</span>
            <span className="text-sm text-blue-600">
              {Number(result.gasEstimate).toLocaleString()} gas units
            </span>
          </div>
        </div>
      )}

      {/* Warnings */}
      {result.warnings && result.warnings.length > 0 && (
        <div className="space-y-2">
          {result.warnings.map((warning, index) => (
            <Alert key={index} className="border-yellow-200 bg-yellow-50">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="text-yellow-800">
                <div className="text-sm">{warning}</div>
              </AlertDescription>
            </Alert>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Lightweight simulation status indicator for compact displays
 */
export function SimulationStatusIndicator({
  simulation,
  currentAmount,
  className = ''
}: TransactionSimulationDisplayProps) {
  const { isSimulating, result, lastSimulatedAmount } = simulation;

  if (isSimulating) {
    return (
      <div className={`flex items-center gap-1 text-blue-600 ${className}`}>
        <Clock className="h-3 w-3 animate-spin" />
        <span className="text-xs">Simulating...</span>
      </div>
    );
  }

  if (!result || lastSimulatedAmount !== currentAmount) {
    return null;
  }

  if (!result.success) {
    return (
      <div className={`flex items-center gap-1 text-red-600 ${className}`}>
        <AlertTriangle className="h-3 w-3" />
        <span className="text-xs">Simulation failed</span>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-1 text-green-600 ${className}`}>
      <CheckCircle className="h-3 w-3" />
      <span className="text-xs">Ready</span>
    </div>
  );
}