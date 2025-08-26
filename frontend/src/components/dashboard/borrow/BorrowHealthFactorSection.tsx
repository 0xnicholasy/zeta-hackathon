import { Shield, TrendingDown, TrendingUp, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription } from '../../ui/alert';
import { getHealthFactorColorClass, formatHealthFactor } from '../../../utils/healthFactorUtils';

interface BorrowHealthFactorSectionProps {
  currentHealthFactor: number;
  projectedHealthFactor?: number;
  showProjection?: boolean;
}

export function BorrowHealthFactorSection({
  currentHealthFactor,
  projectedHealthFactor,
  showProjection = false
}: BorrowHealthFactorSectionProps) {
  const currentColorClass = getHealthFactorColorClass(currentHealthFactor);
  const projectedColorClass = projectedHealthFactor ? getHealthFactorColorClass(projectedHealthFactor) : '';

  const getHealthFactorIcon = (healthFactor: number) => {
    if (healthFactor >= 1.5) return <Shield className="h-4 w-4" />;
    if (healthFactor >= 1.2) return <AlertTriangle className="h-4 w-4" />;
    return <TrendingDown className="h-4 w-4" />;
  };

  const getHealthFactorDescription = (healthFactor: number) => {
    if (healthFactor >= 1.5) return "Safe - Your position is well collateralized";
    if (healthFactor >= 1.2) return "Caution - Your position is approaching liquidation risk";
    return "Risk - Your position may be liquidated";
  };

  return (
    <div className="space-y-3">
      {/* Current Health Factor */}
      <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            {getHealthFactorIcon(currentHealthFactor)}
            <span className="text-sm font-medium text-gray-700">Current Health Factor</span>
          </div>
          <div className="flex items-center gap-1">
            <span className={`text-sm font-bold ${currentColorClass}`}>
              {formatHealthFactor(currentHealthFactor)}
            </span>
          </div>
        </div>
        <div className="text-xs text-gray-600">
          {getHealthFactorDescription(currentHealthFactor)}
        </div>
      </div>

      {/* Projected Health Factor */}
      {showProjection && projectedHealthFactor !== undefined && (
        <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              {getHealthFactorIcon(projectedHealthFactor)}
              <span className="text-sm font-medium text-blue-700">Health Factor After Borrow</span>
            </div>
            <div className="flex items-center gap-1">
              {projectedHealthFactor < currentHealthFactor ? (
                <TrendingDown className="h-4 w-4 text-red-600" />
              ) : (
                <TrendingUp className="h-4 w-4 text-green-600" />
              )}
              <span className={`text-sm font-bold ${projectedColorClass}`}>
                {formatHealthFactor(projectedHealthFactor)}
              </span>
            </div>
          </div>
          <div className="text-xs text-blue-600">
            {getHealthFactorDescription(projectedHealthFactor)}
          </div>
        </div>
      )}

      {/* Health Factor Warning */}
      {showProjection && projectedHealthFactor !== undefined && projectedHealthFactor < 1.5 && (
        <Alert className="border-yellow-200 bg-yellow-50">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="text-yellow-800">
            <div className="font-medium mb-1">Health Factor Warning</div>
            <div className="text-sm">
              {projectedHealthFactor < 1.2 
                ? "This borrow amount would put your position at high risk of liquidation. Consider borrowing less or adding more collateral."
                : "This borrow amount will bring your health factor below the recommended 1.5x safety margin."
              }
            </div>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}