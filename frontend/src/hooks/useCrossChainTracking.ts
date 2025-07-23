import { useState, useCallback, useRef } from 'react';
import type { EVMTransactionHash } from '../components/dashboard/types';
import { safeEVMTransactionHash, ZERO_TRANSACTION_HASH } from '../components/dashboard/types';

export type CrossChainStatus = 'idle' | 'submitted' | 'pending' | 'success' | 'failed';

interface CrossChainTrackingResult {
  status: CrossChainStatus;
  txHash: EVMTransactionHash | null;
  startTracking: (txHash: EVMTransactionHash | string) => void;
  reset: () => void;
}

export interface ResponseJson {
  CrossChainTxs: CrossChainTx[]
}

export interface CrossChainTx {
  creator: string
  index: string
  zeta_fees: string
  relayed_message: string
  cctx_status: CctxStatus
  inbound_params: InboundParams
  outbound_params: OutboundParam[]
  protocol_contract_version: string
  revert_options: RevertOptions
}

export interface CctxStatus {
  status: string
  status_message: string
  error_message: string
  lastUpdate_timestamp: string
  isAbortRefunded: boolean
  created_timestamp: string
  error_message_revert: string
  error_message_abort: string
}

export interface InboundParams {
  sender: string
  sender_chain_id: string
  tx_origin: string
  coin_type: string
  asset: string
  amount: string
  observed_hash: string
  observed_external_height: string
  ballot_index: string
  finalized_zeta_height: string
  tx_finalization_status: string
  is_cross_chain_call: boolean
  status: string
  confirmation_mode: string
}

export interface OutboundParam {
  receiver: string
  receiver_chainId: string
  coin_type: string
  amount: string
  tss_nonce: string
  gas_limit: string
  gas_price: string
  gas_priority_fee: string
  hash: string
  ballot_index: string
  observed_external_height: string
  gas_used: string
  effective_gas_price: string
  effective_gas_limit: string
  tss_pubkey: string
  tx_finalization_status: string
  call_options: CallOptions
  confirmation_mode: string
}

export interface CallOptions {
  gas_limit: string
  is_arbitrary_call: boolean
}

export interface RevertOptions {
  revert_address: string
  call_on_revert: boolean
  abort_address: string
  revert_message: string
  revert_gas_limit: string
}


export function useCrossChainTracking(): CrossChainTrackingResult {
  const [status, setStatus] = useState<CrossChainStatus>('idle');
  const [txHash, setTxHash] = useState<EVMTransactionHash | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isTrackingRef = useRef(false);

  const startTracking = useCallback((transactionHash: EVMTransactionHash | string) => {
    if (!transactionHash || isTrackingRef.current) return;

    // Validate and convert transaction hash
    const validTxHash = safeEVMTransactionHash(transactionHash, ZERO_TRANSACTION_HASH);
    if (!validTxHash) {
      return;
    }

    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    isTrackingRef.current = true;
    setTxHash(validTxHash);
    setStatus('submitted');

    const maxRetries = 30; // 2.5 minutes with 10 second intervals
    const retryInterval = 5000; // 5 seconds
    let retries = 0;

    const checkTransaction = async () => {
      if (!isTrackingRef.current) return; // Stop if tracking was reset

      try {
        const response = await fetch(`https://zetachain-athens.blockpi.network/lcd/v1/public/zeta-chain/crosschain/inboundHashToCctxData/${validTxHash}`);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data: ResponseJson = await response.json();

        // Validate response structure using the defined interfaces
        if (data?.CrossChainTxs?.length > 0) {
          const cctxData = data.CrossChainTxs[0];
          if (!cctxData) {
            throw new Error('Invalid response structure from cross-chain API');
          }
          const cctxStatus: CctxStatus = cctxData.cctx_status;
          if (cctxStatus.status === 'PendingOutbound') {
            setStatus('pending');
          }
          else if (cctxStatus.status === 'OutboundMined') {
            setStatus('success');
            isTrackingRef.current = false;
            return;
          } else if (cctxStatus.status === 'Aborted' || cctxStatus.status === 'Reverted') {
            setStatus('failed');
            isTrackingRef.current = false;
            return;
          }
          // Still pending - continue checking
        } else {
          setStatus('idle');
        }

        retries++;
        if (retries < maxRetries && isTrackingRef.current) {
          timeoutRef.current = setTimeout(() => {
            void checkTransaction();
          }, retryInterval);
        } else {
          // Timeout - assume success for UI purposes
          setStatus('success');
          isTrackingRef.current = false;
        }
      } catch (error) {
        console.error('Failed to check cross-chain transaction:', error);
        retries++;
        if (retries < maxRetries && isTrackingRef.current) {
          timeoutRef.current = setTimeout(() => {
            void checkTransaction();
          }, retryInterval);
        } else {
          setStatus('failed');
          isTrackingRef.current = false;
        }
      }
    };

    // Start checking after a short delay
    timeoutRef.current = setTimeout(() => {
      void checkTransaction();
    }, 5000);
  }, []);

  const reset = useCallback(() => {
    // Clear any pending timeouts
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    isTrackingRef.current = false;
    setStatus('idle');
    setTxHash(null);
  }, []);

  return {
    status,
    txHash,
    startTracking,
    reset,
  };
}