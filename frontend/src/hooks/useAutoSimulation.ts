import { useEffect, useCallback, useRef } from 'react';
import { useAccount } from 'wagmi';

interface UseAutoSimulationOptions {
  amount: string;
  assetAddress: string;
  decimals: number;
  enabled?: boolean;
  debounceMs?: number;
  runSimulation: (userAddress: string, assetAddress: string, decimals: number) => Promise<void>;
}

/**
 * Hook for automatic transaction simulation with debouncing
 * Triggers simulation when amount changes and all required data is available
 */
export function useAutoSimulation({
  amount,
  assetAddress,
  decimals,
  enabled = true,
  debounceMs = 500,
  runSimulation
}: UseAutoSimulationOptions) {
  const { address: userAddress } = useAccount();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const runSimulationRef = useRef(runSimulation);

  // Update the ref when runSimulation changes
  runSimulationRef.current = runSimulation;

  const triggerSimulation = useCallback(() => {
    if (!enabled || !userAddress || !assetAddress || !amount.trim()) {
      return;
    }

    // Parse amount to check if it's a valid number
    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      return;
    }

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set new timeout for debounced simulation
    const delayMs = Math.max(0, debounceMs ?? 0);
    timeoutRef.current = setTimeout(() => {
      // Swallow errors or route to a logger if available
      runSimulationRef.current(userAddress, assetAddress, decimals).catch(() => { });
    }, delayMs);
  }, [enabled, userAddress, assetAddress, decimals, amount, debounceMs]);

  // Trigger simulation when dependencies change
  useEffect(() => {
    triggerSimulation();

    // Cleanup timeout on unmount or dependency change
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [triggerSimulation]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);
}