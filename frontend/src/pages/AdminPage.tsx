import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { useState, useEffect } from 'react';
import { parseUnits } from 'viem';

import { Header } from '../components/dashboard/Header';
import {
  NotificationDialog,
  NetworkSelector,
  DepositContractForms,
  UniversalLendingProtocolForms,
  NotificationState,
  AddSupportedAssetForm,
  RemoveSupportedAssetForm,
  AddAssetForm,
  UpdatePriceForm,
  SetAllowedChainForm,
  MapZRC20Form,
  SetPriceOracleForm
} from '../components/admin';

import { useContracts } from '../hooks/useContracts';
import { useAdminData } from '../hooks/useAdminData';
import { validateEVMAddress } from '@/types/address';
import { SupportedChainId } from '@/contracts/deployments';
import { DepositContract__factory } from '../contracts/typechain-types/factories/contracts/DepositContract__factory';
import { UniversalLendingProtocol__factory } from '../contracts/typechain-types/factories/contracts/UniversalLendingProtocol__factory';
import { IPriceOracle__factory } from '@/contracts/typechain-types/factories/contracts/interfaces/IPriceOracle__factory';

function AdminPage() {
  const { isConnected } = useAccount();

  // Use admin data hook
  const {
    chainId,
    currentChain,
    isOnZetaNetwork,
    isOnExternalNetwork,
    zetaChainAssets,
    externalChainAssets,
    mockPriceOracleAddress
  } = useAdminData();

  // Get contract addresses
  const contracts = useContracts(chainId as SupportedChainId);

  // Contract interaction hooks
  const { writeContract, data: contractHash, error: contractError } = useWriteContract();

  // Transaction receipt tracking
  const {
    isLoading: isTransactionPending,
    isSuccess: isTransactionSuccess,
    isError: isTransactionError,
    error: transactionError
  } = useWaitForTransactionReceipt({
    hash: contractHash,
    query: {
      enabled: Boolean(contractHash),
    },
  });

  // Notification state
  const [notification, setNotification] = useState<NotificationState>({
    isOpen: false,
    type: 'success',
    title: '',
    message: '',
  });

  // Handle transaction hash changes
  useEffect(() => {
    if (contractHash) {
      setNotification({
        isOpen: true,
        type: 'pending',
        title: 'Transaction Submitted',
        message: 'Your transaction has been submitted and is being processed...',
        ...(contractHash && { txHash: contractHash }),
      });
    }
  }, [contractHash]);

  // Handle transaction success
  useEffect(() => {
    if (isTransactionSuccess) {
      setNotification({
        isOpen: true,
        type: 'success',
        title: 'Transaction Successful',
        message: 'Your admin operation has been completed successfully!',
        ...(contractHash && { txHash: contractHash }),
      });
    }
  }, [isTransactionSuccess, contractHash]);

  // Handle transaction error
  useEffect(() => {
    if (isTransactionError || contractError) {
      const errorMessage = (transactionError?.message ?? contractError?.message) ?? 'Transaction failed';
      setNotification({
        isOpen: true,
        type: 'error',
        title: 'Transaction Failed',
        message: errorMessage,
        ...(contractHash && { txHash: contractHash }),
      });
    }
  }, [isTransactionError, contractError, transactionError, contractHash]);

  const closeNotification = () => {
    setNotification(prev => ({ ...prev, isOpen: false }));
  };

  // DepositContract handlers
  const onDepositContractAddSupportedAsset = async (data: AddSupportedAssetForm) => {
    if (!contracts?.depositContract) {
      setNotification({
        isOpen: true,
        type: 'error',
        title: 'Contract Not Found',
        message: 'DepositContract not found. Please check your network connection.',
      });
      return;
    }

    try {
      const contractAddress = validateEVMAddress(contracts.depositContract);
      const assetAddress = validateEVMAddress(data.asset);

      writeContract({
        address: contractAddress,
        abi: DepositContract__factory.abi,
        functionName: 'addSupportedAsset',
        args: [assetAddress, data.decimals, data.isNative],
      });
    } catch (error) {
      setNotification({
        isOpen: true,
        type: 'error',
        title: 'Transaction Error',
        message: `Failed to add supported asset: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  };

  const onDepositContractRemoveSupportedAsset = async (data: RemoveSupportedAssetForm) => {
    if (!contracts?.depositContract) {
      setNotification({
        isOpen: true,
        type: 'error',
        title: 'Contract Not Found',
        message: 'DepositContract not found. Please check your network connection.',
      });
      return;
    }

    try {
      const contractAddress = validateEVMAddress(contracts.depositContract);
      const assetAddress = validateEVMAddress(data.asset);

      writeContract({
        address: contractAddress,
        abi: DepositContract__factory.abi,
        functionName: 'removeSupportedAsset',
        args: [assetAddress],
      });
    } catch (error) {
      setNotification({
        isOpen: true,
        type: 'error',
        title: 'Transaction Error',
        message: `Failed to remove supported asset: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  };

  // UniversalLendingProtocol handlers
  const onAddAsset = async (data: AddAssetForm) => {
    if (!contracts?.universalLendingProtocol) {
      setNotification({
        isOpen: true,
        type: 'error',
        title: 'Contract Not Found',
        message: 'UniversalLendingProtocol not found. Please check your network connection.',
      });
      return;
    }

    try {
      const contractAddress = validateEVMAddress(contracts.universalLendingProtocol);
      const assetAddress = validateEVMAddress(data.asset);

      // Standard DeFi parameters - these should ideally be configurable in the form
      const collateralFactor = parseUnits('0.8', 18); // 80% collateral factor
      const liquidationThreshold = parseUnits('0.85', 18); // 85% liquidation threshold  
      const liquidationBonus = parseUnits('0.05', 18); // 5% liquidation bonus

      writeContract({
        address: contractAddress,
        abi: UniversalLendingProtocol__factory.abi,
        functionName: 'addAsset',
        args: [assetAddress, collateralFactor, liquidationThreshold, liquidationBonus],
      });
    } catch (error) {
      setNotification({
        isOpen: true,
        type: 'error',
        title: 'Transaction Error',
        message: `Failed to add asset to lending protocol: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  };

  const onUpdatePrice = async (data: UpdatePriceForm) => {
    if (!mockPriceOracleAddress || mockPriceOracleAddress === "0x0000000000000000000000000000000000000000") {
      setNotification({
        isOpen: true,
        type: 'error',
        title: 'Contract Not Found',
        message: 'MockPriceOracle not found. Please check your network connection.',
      });
      return;
    }

    try {
      // Convert price to wei (assuming price is in USD with 18 decimals)
      const priceInWei = parseUnits(data.priceInUSD.toString(), 18);
      const contractAddress = validateEVMAddress(mockPriceOracleAddress);
      const assetAddress = validateEVMAddress(data.asset);

      writeContract({
        address: contractAddress,
        abi: IPriceOracle__factory.abi,
        functionName: "setPrice",
        args: [assetAddress, priceInWei],
      });
    } catch (error) {
      setNotification({
        isOpen: true,
        type: 'error',
        title: 'Transaction Error',
        message: `Failed to update asset price: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  };

  const onSetAllowedChain = async (data: SetAllowedChainForm) => {
    if (!contracts?.universalLendingProtocol) {
      setNotification({
        isOpen: true,
        type: 'error',
        title: 'Contract Not Found',
        message: 'UniversalLendingProtocol not found. Please check your network connection.',
      });
      return;
    }

    try {
      const contractAddress = validateEVMAddress(contracts.universalLendingProtocol);

      writeContract({
        address: contractAddress,
        abi: UniversalLendingProtocol__factory.abi,
        functionName: 'setAllowedSourceChain',
        args: [BigInt(data.chainId), data.allowed],
      });
    } catch (error) {
      setNotification({
        isOpen: true,
        type: 'error',
        title: 'Transaction Error',
        message: `Failed to set allowed chain: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  };

  const onMapZRC20 = async (data: MapZRC20Form) => {
    if (!contracts?.universalLendingProtocol) {
      setNotification({
        isOpen: true,
        type: 'error',
        title: 'Contract Not Found',
        message: 'UniversalLendingProtocol not found. Please check your network connection.',
      });
      return;
    }

    try {
      const contractAddress = validateEVMAddress(contracts.universalLendingProtocol);
      const zrc20Address = validateEVMAddress(data.zrc20);

      writeContract({
        address: contractAddress,
        abi: UniversalLendingProtocol__factory.abi,
        functionName: 'mapZRC20Asset',
        args: [zrc20Address, BigInt(data.chainId), data.symbol],
      });
    } catch (error) {
      setNotification({
        isOpen: true,
        type: 'error',
        title: 'Transaction Error',
        message: `Failed to map ZRC20 asset: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  };

  const onSetPriceOracle = async (data: SetPriceOracleForm) => {
    if (!contracts?.universalLendingProtocol) {
      setNotification({
        isOpen: true,
        type: 'error',
        title: 'Contract Not Found',
        message: 'UniversalLendingProtocol not found. Please check your network connection.',
      });
      return;
    }

    try {
      const contractAddress = validateEVMAddress(contracts.universalLendingProtocol);
      const priceOracleAddress = validateEVMAddress(data.priceOracle);

      writeContract({
        address: contractAddress,
        abi: UniversalLendingProtocol__factory.abi,
        functionName: 'setPriceOracle',
        args: [priceOracleAddress],
      });
    } catch (error) {
      setNotification({
        isOpen: true,
        type: 'error',
        title: 'Transaction Error',
        message: `Failed to set price oracle: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-zeta-50 to-zeta-100 dark:from-background dark:to-secondary">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Connect Your Wallet
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              Please connect your wallet to access admin functions.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-zeta-50 to-zeta-100 dark:from-background dark:to-secondary">
      <Header />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
            Admin Panel
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage contract functions for DepositContract and UniversalLendingProtocol
          </p>
        </div>

        {/* Network Selector */}
        <NetworkSelector
          currentChain={currentChain}
        />

        {/* DepositContract Functions */}
        {isOnExternalNetwork && (
          <DepositContractForms
            isOnExternalNetwork={isOnExternalNetwork}
            isTransactionPending={isTransactionPending}
            externalChainAssets={externalChainAssets}
            contractAddress={contracts?.depositContract}
            onAddSupportedAsset={onDepositContractAddSupportedAsset}
            onRemoveSupportedAsset={onDepositContractRemoveSupportedAsset}
          />
        )}

        {/* UniversalLendingProtocol Functions */}
        {isOnZetaNetwork && (
          <UniversalLendingProtocolForms
            isOnZetaNetwork={isOnZetaNetwork}
            isTransactionPending={isTransactionPending}
            zetaChainAssets={zetaChainAssets}
            contractAddress={contracts?.universalLendingProtocol}
            mockPriceOracleAddress={mockPriceOracleAddress}
            onAddAsset={onAddAsset}
            onUpdatePrice={onUpdatePrice}
            onSetAllowedChain={onSetAllowedChain}
            onMapZRC20={onMapZRC20}
            onSetPriceOracle={onSetPriceOracle}
          />
        )}
      </div>

      <NotificationDialog
        notification={notification}
        onClose={closeNotification}
      />
    </div>
  );
}

export default AdminPage;