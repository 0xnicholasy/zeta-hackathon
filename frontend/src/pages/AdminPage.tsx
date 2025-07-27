import { useAccount, useChainId, useSwitchChain, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useState, useEffect } from 'react';
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { Header } from '../components/dashboard/Header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '../components/ui/form';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { useContracts, SupportedChain } from '../hooks/useContracts';
import { isEVMAddress, validateEVMAddress } from '../components/dashboard/types';
import { SupportedChainId } from '@/contracts/deployments';
import { contractsData } from '../config/contracts-data';
import { DepositContract__factory } from '../contracts/typechain-types/factories/contracts/DepositContract__factory';
import { UniversalLendingProtocol__factory } from '../contracts/typechain-types/factories/contracts/UniversalLendingProtocol__factory';
import { parseUnits } from 'viem';
import { IPriceOracle__factory } from '@/contracts/typechain-types/factories/contracts/interfaces/IPriceOracle__factory';

// Form schemas
const addSupportedAssetSchema = z.object({
  asset: z.string().min(1, 'Asset address is required').refine(isEVMAddress, 'Invalid EVM address'),
  decimals: z.coerce.number().min(0).max(18, 'Decimals must be between 0 and 18'),
  isNative: z.boolean(),
});

const removeSupportedAssetSchema = z.object({
  asset: z.string().min(1, 'Asset address is required').refine(isEVMAddress, 'Invalid EVM address'),
});

const addAssetSchema = z.object({
  asset: z.string().min(1, 'Asset address is required').refine(isEVMAddress, 'Invalid EVM address'),
  priceInUSD: z.coerce.number().min(0, 'Price must be positive'),
});

const updatePriceSchema = z.object({
  asset: z.string().min(1, 'Asset address is required').refine(isEVMAddress, 'Invalid EVM address'),
  priceInUSD: z.coerce.number().min(0, 'Price must be positive'),
});

const setAllowedChainSchema = z.object({
  chainId: z.coerce.number().min(1, 'Chain ID is required'),
  allowed: z.boolean(),
});

const mapZRC20Schema = z.object({
  zrc20: z.string().min(1, 'ZRC20 address is required').refine(isEVMAddress, 'Invalid EVM address'),
  chainId: z.coerce.number().min(1, 'Chain ID is required'),
  symbol: z.string().min(1, 'Symbol is required'),
});

const setPriceOracleSchema = z.object({
  priceOracle: z.string().min(1, 'Price oracle address is required').refine(isEVMAddress, 'Invalid EVM address'),
});

type AddSupportedAssetForm = z.infer<typeof addSupportedAssetSchema>;
type RemoveSupportedAssetForm = z.infer<typeof removeSupportedAssetSchema>;
type AddAssetForm = z.infer<typeof addAssetSchema>;
type UpdatePriceForm = z.infer<typeof updatePriceSchema>;
type SetAllowedChainForm = z.infer<typeof setAllowedChainSchema>;
type MapZRC20Form = z.infer<typeof mapZRC20Schema>;
type SetPriceOracleForm = z.infer<typeof setPriceOracleSchema>;

// Notification dialog state
interface NotificationState {
  isOpen: boolean;
  type: 'success' | 'error' | 'pending';
  title: string;
  message: string;
  txHash?: `0x${string}`;
}

// Helper functions to get available assets based on network
const getZetaChainAssets = () => {
  const zetaNetwork = contractsData.networks[7001];
  if (!zetaNetwork?.tokens) return [];

  return Object.entries(zetaNetwork.tokens)
    .filter(([, address]) => address !== "0x0000000000000000000000000000000000000000")
    .map(([symbol, address]) => ({
      symbol,
      address,
      label: `${symbol} (${address})`
    }));
};

const getExternalChainAssets = (chainId: number) => {
  const network = contractsData.networks[chainId as keyof typeof contractsData.networks];
  if (!network?.tokens) return [];

  return Object.entries(network.tokens).map(([symbol, address]) => ({
    symbol,
    address,
    label: `${symbol} (${address === "0x0000000000000000000000000000000000000000" ? "Native ETH" : address})`
  }));
};

function AdminPage() {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();

  // Get contract addresses
  const contracts = useContracts(chainId as SupportedChainId);  // TODO: fix this type casting

  // Check if we're on the correct network
  const isOnZetaNetwork = chainId === SupportedChain.ZETA_TESTNET;
  const isOnExternalNetwork = chainId === SupportedChain.ARBITRUM_SEPOLIA || chainId === SupportedChain.ETHEREUM_SEPOLIA;

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

  // Forms for DepositContract
  const addSupportedAssetForm = useForm({
    resolver: zodResolver(addSupportedAssetSchema),
    defaultValues: {
      asset: '',
      decimals: 18,
      isNative: false,
    },
  });

  const removeSupportedAssetForm = useForm({
    resolver: zodResolver(removeSupportedAssetSchema),
    defaultValues: {
      asset: '',
    },
  });

  // Forms for UniversalLendingProtocol
  const addAssetForm = useForm({
    resolver: zodResolver(addAssetSchema),
    defaultValues: {
      asset: '',
      priceInUSD: 0,
    },
  });

  const updatePriceForm = useForm({
    resolver: zodResolver(updatePriceSchema),
    defaultValues: {
      asset: '',
      priceInUSD: 0,
    },
  });

  const setAllowedChainForm = useForm({
    resolver: zodResolver(setAllowedChainSchema),
    defaultValues: {
      chainId: 0,
      allowed: true,
    },
  });

  const mapZRC20Form = useForm({
    resolver: zodResolver(mapZRC20Schema),
    defaultValues: {
      zrc20: '',
      chainId: 0,
      symbol: '',
    },
  });

  const setPriceOracleForm = useForm({
    resolver: zodResolver(setPriceOracleSchema),
    defaultValues: {
      priceOracle: '',
    },
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

  const handleSwitchToZeta = () => {
    switchChain({ chainId: SupportedChain.ZETA_TESTNET });
  };

  const handleSwitchToArbitrum = () => {
    switchChain({ chainId: SupportedChain.ARBITRUM_SEPOLIA });
  };

  const handleSwitchToEthereum = () => {
    switchChain({ chainId: SupportedChain.ETHEREUM_SEPOLIA });
  };

  const closeNotification = () => {
    setNotification(prev => ({ ...prev, isOpen: false }));
  };

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
    // Get the MockPriceOracle address from contracts data
    const mockPriceOracleAddress = contractsData.networks[7001]?.contracts?.MockPriceOracle;

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

  // Notification Dialog Component
  const NotificationDialog = () => {
    const getIcon = () => {
      switch (notification.type) {
        case 'success':
          return <CheckCircle className="h-6 w-6 text-green-500" />;
        case 'error':
          return <AlertCircle className="h-6 w-6 text-red-500" />;
        case 'pending':
          return <Loader2 className="h-6 w-6 text-blue-500 animate-spin" />;
        default:
          return null;
      }
    };

    return (
      <Dialog
        open={notification.isOpen}
        onOpenChange={(open) => {
          if (!open && notification.type !== 'pending') {
            closeNotification();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              {getIcon()}
              {notification.title}
            </DialogTitle>
            <DialogDescription className="text-left">
              {notification.message}
            </DialogDescription>
            {notification.txHash && (
              <div className="text-xs text-muted-foreground mt-2">
                Transaction Hash: {notification.txHash}
              </div>
            )}
          </DialogHeader>
          <DialogFooter>
            {notification.type !== 'pending' && (
              <Button onClick={closeNotification}>Close</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
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


        {/* Network Switch Buttons */}
        <div className="mb-6">
          <div className="flex gap-4">
            <Button
              variant="outline"
              onClick={() => void handleSwitchToZeta()}
              disabled={isOnZetaNetwork}
            >
              Switch to ZetaChain ({isOnZetaNetwork ? 'Current' : 'Switch'})
            </Button>
            <Button
              variant="outline"
              onClick={() => void handleSwitchToArbitrum()}
              disabled={chainId === SupportedChain.ARBITRUM_SEPOLIA}
            >
              Switch to Arbitrum ({chainId === SupportedChain.ARBITRUM_SEPOLIA ? 'Current' : 'Switch'})
            </Button>
            <Button
              variant="outline"
              onClick={() => void handleSwitchToEthereum()}
              disabled={chainId === SupportedChain.ETHEREUM_SEPOLIA}
            >
              Switch to Ethereum ({chainId === SupportedChain.ETHEREUM_SEPOLIA ? 'Current' : 'Switch'})
            </Button>
          </div>
        </div>

        {/* DepositContract Functions */}
        {isOnExternalNetwork && (
          <div className="space-y-6">
            <div className="mb-4">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
                <span className="bg-gradient-to-r from-zeta-500 to-zeta-600 bg-clip-text text-transparent font-bold">DepositContract</span> Admin Functions
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Contract Address: {contracts?.depositContract ?? 'Not deployed'}
              </p>
              {!isOnExternalNetwork && (
                <div className="mt-2 p-3 bg-yellow-100 dark:bg-yellow-900/20 rounded-lg">
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    ⚠️ DepositContract functions are only available on Arbitrum Sepolia or Ethereum Sepolia
                  </p>
                </div>
              )}
            </div>

            {/* Add Supported Asset */}
            <Card>
              <CardHeader>
                <CardTitle>Add Supported Asset</CardTitle>
                <CardDescription>
                  Add a new asset that can be deposited through this contract
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...addSupportedAssetForm}>
                  <form onSubmit={(e) => void addSupportedAssetForm.handleSubmit(onDepositContractAddSupportedAsset)(e)} className="space-y-4">
                    <FormField
                      control={addSupportedAssetForm.control}
                      name="asset"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Asset Address</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="0x..."
                              {...field}
                              disabled={!isOnExternalNetwork}
                            />
                          </FormControl>
                          <FormDescription>
                            The address of the asset token (use 0x0000000000000000000000000000000000000000 for native ETH)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={addSupportedAssetForm.control}
                      name="decimals"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Decimals</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="0"
                              max="18"
                              {...field}
                              value={field.value?.toString() ?? ''}
                              disabled={!isOnExternalNetwork}
                            />
                          </FormControl>
                          <FormDescription>
                            The number of decimals the token uses (18 for ETH, 6 for USDC, etc.)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={addSupportedAssetForm.control}
                      name="isNative"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Is Native Token</FormLabel>
                          <FormControl>
                            <Select
                              value={field.value === true ? 'true' : 'false'}
                              onValueChange={(value) => field.onChange(value === 'true')}
                              disabled={!isOnExternalNetwork}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select if native token" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="true">Yes (Native ETH)</SelectItem>
                                <SelectItem value="false">No (ERC20 Token)</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormControl>
                          <FormDescription>
                            True if this is the native chain token (ETH), false for ERC20 tokens
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="submit" disabled={!isOnExternalNetwork || isTransactionPending}>
                      {isTransactionPending ? 'Adding...' : 'Add Supported Asset'}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>

            {/* Remove Supported Asset */}
            <Card>
              <CardHeader>
                <CardTitle>Remove Supported Asset</CardTitle>
                <CardDescription>
                  Remove an asset from the supported assets list
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...removeSupportedAssetForm}>
                  <form onSubmit={(e) => void removeSupportedAssetForm.handleSubmit(onDepositContractRemoveSupportedAsset)(e)} className="space-y-4">
                    <FormField
                      control={removeSupportedAssetForm.control}
                      name="asset"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Asset Address</FormLabel>
                          <FormControl>
                            <Select
                              value={field.value}
                              onValueChange={field.onChange}
                              disabled={!isOnExternalNetwork}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select asset to remove" />
                              </SelectTrigger>
                              <SelectContent>
                                {getExternalChainAssets(chainId).map((asset) => (
                                  <SelectItem key={asset.address} value={asset.address}>
                                    {asset.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </FormControl>
                          <FormDescription>
                            Select the asset token to remove from supported list
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="submit" variant="destructive" disabled={!isOnExternalNetwork || isTransactionPending}>
                      {isTransactionPending ? 'Removing...' : 'Remove Supported Asset'}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </div>
        )}

        {/* UniversalLendingProtocol Functions */}
        {isOnZetaNetwork && (
          <div className="space-y-6">
            <div className="mb-4">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
                <span className="bg-gradient-to-r from-zeta-500 to-zeta-600 bg-clip-text text-transparent font-bold">UniversalLendingProtocol</span> Admin Functions
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Contract Address: {contracts?.universalLendingProtocol ?? 'Not deployed'}
              </p>
              {!isOnZetaNetwork && (
                <div className="mt-2 p-3 bg-yellow-100 dark:bg-yellow-900/20 rounded-lg">
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    ⚠️ UniversalLendingProtocol functions are only available on ZetaChain testnet
                  </p>
                </div>
              )}
            </div>

            {/* Add Asset */}
            <Card>
              <CardHeader>
                <CardTitle>Add Asset</CardTitle>
                <CardDescription>
                  Add a new asset to the lending protocol with its USD price
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...addAssetForm}>
                  <form onSubmit={(e) => void addAssetForm.handleSubmit(onAddAsset)(e)} className="space-y-4">
                    <FormField
                      control={addAssetForm.control}
                      name="asset"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Asset Address</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="0x..."
                              {...field}
                              disabled={!isOnZetaNetwork}
                            />
                          </FormControl>
                          <FormDescription>
                            The ZRC-20 token address on ZetaChain
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={addAssetForm.control}
                      name="priceInUSD"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Price in USD</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              {...field}
                              value={field.value?.toString() ?? ''}
                              disabled={!isOnZetaNetwork}
                            />
                          </FormControl>
                          <FormDescription>
                            The current USD price of the asset (e.g., 3000 for ETH)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="submit" disabled={!isOnZetaNetwork || isTransactionPending}>
                      {isTransactionPending ? 'Adding...' : 'Add Asset'}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>

            {/* Update Price */}
            <Card>
              <CardHeader>
                <CardTitle>Update Asset Price</CardTitle>
                <CardDescription>
                  Update the USD price of an existing asset via MockPriceOracle
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    💡 Price Oracle Address: {contractsData.networks[7001]?.contracts?.MockPriceOracle ?? 'Not deployed'}
                  </p>
                </div>
                <Form {...updatePriceForm}>
                  <form onSubmit={(e) => void updatePriceForm.handleSubmit(onUpdatePrice)(e)} className="space-y-4">
                    <FormField
                      control={updatePriceForm.control}
                      name="asset"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Asset Address</FormLabel>
                          <FormControl>
                            <Select
                              value={field.value}
                              onValueChange={field.onChange}
                              disabled={!isOnZetaNetwork}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select asset to update price" />
                              </SelectTrigger>
                              <SelectContent>
                                {getZetaChainAssets().map((asset) => (
                                  <SelectItem key={asset.address} value={asset.address}>
                                    {asset.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </FormControl>
                          <FormDescription>
                            Select the ZRC-20 token address on ZetaChain
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={updatePriceForm.control}
                      name="priceInUSD"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>New Price in USD</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              {...field}
                              value={field.value?.toString() ?? ''}
                              disabled={!isOnZetaNetwork}
                            />
                          </FormControl>
                          <FormDescription>
                            The new USD price of the asset
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="submit" disabled={!isOnZetaNetwork || isTransactionPending}>
                      {isTransactionPending ? 'Updating...' : 'Update Price'}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>

            {/* Set Allowed Source Chain */}
            <Card>
              <CardHeader>
                <CardTitle>Set Allowed Source Chain</CardTitle>
                <CardDescription>
                  Enable or disable cross-chain deposits from a specific chain
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...setAllowedChainForm}>
                  <form onSubmit={(e) => void setAllowedChainForm.handleSubmit(onSetAllowedChain)(e)} className="space-y-4">
                    <FormField
                      control={setAllowedChainForm.control}
                      name="chainId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Chain ID</FormLabel>
                          <FormControl>
                            <Select
                              value={field.value?.toString() ?? ''}
                              onValueChange={(value) => field.onChange(parseInt(value))}
                              disabled={!isOnZetaNetwork}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select chain ID" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="421614">Arbitrum Sepolia (421614)</SelectItem>
                                <SelectItem value="11155111">Ethereum Sepolia (11155111)</SelectItem>
                                <SelectItem value="84532">Base Sepolia (84532)</SelectItem>
                                <SelectItem value="80002">Polygon Amoy (80002)</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormControl>
                          <FormDescription>
                            The chain ID to allow or disallow for cross-chain deposits
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={setAllowedChainForm.control}
                      name="allowed"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Allowed Status</FormLabel>
                          <FormControl>
                            <Select
                              value={field.value === true ? 'true' : 'false'}
                              onValueChange={(value) => field.onChange(value === 'true')}
                              disabled={!isOnZetaNetwork}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select allowed status" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="true">Allow</SelectItem>
                                <SelectItem value="false">Disallow</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormControl>
                          <FormDescription>
                            Whether to allow cross-chain deposits from this chain
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="submit" disabled={!isOnZetaNetwork || isTransactionPending}>
                      {isTransactionPending ? 'Setting...' : 'Set Allowed Chain'}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>

            {/* Map ZRC20 Asset */}
            <Card>
              <CardHeader>
                <CardTitle>Map ZRC20 Asset</CardTitle>
                <CardDescription>
                  Map a ZRC20 token to its source chain and symbol
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...mapZRC20Form}>
                  <form onSubmit={(e) => void mapZRC20Form.handleSubmit(onMapZRC20)(e)} className="space-y-4">
                    <FormField
                      control={mapZRC20Form.control}
                      name="zrc20"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>ZRC20 Address</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="0x..."
                              {...field}
                              disabled={!isOnZetaNetwork}
                            />
                          </FormControl>
                          <FormDescription>
                            The ZRC20 token address on ZetaChain
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={mapZRC20Form.control}
                      name="chainId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Source Chain ID</FormLabel>
                          <FormControl>
                            <Select
                              value={field.value?.toString() ?? ''}
                              onValueChange={(value) => field.onChange(parseInt(value))}
                              disabled={!isOnZetaNetwork}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select source chain" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="421614">Arbitrum Sepolia (421614)</SelectItem>
                                <SelectItem value="11155111">Ethereum Sepolia (11155111)</SelectItem>
                                <SelectItem value="84532">Base Sepolia (84532)</SelectItem>
                                <SelectItem value="80002">Polygon Amoy (80002)</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormControl>
                          <FormDescription>
                            The source chain where this asset originates
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={mapZRC20Form.control}
                      name="symbol"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Asset Symbol</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="ETH, USDC, etc."
                              {...field}
                              disabled={!isOnZetaNetwork}
                            />
                          </FormControl>
                          <FormDescription>
                            The symbol of the asset (e.g., ETH, USDC)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="submit" disabled={!isOnZetaNetwork || isTransactionPending}>
                      {isTransactionPending ? 'Mapping...' : 'Map ZRC20 Asset'}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>

            {/* Set Price Oracle */}
            <Card>
              <CardHeader>
                <CardTitle>Set Price Oracle</CardTitle>
                <CardDescription>
                  Update the price oracle contract address
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...setPriceOracleForm}>
                  <form onSubmit={(e) => void setPriceOracleForm.handleSubmit(onSetPriceOracle)(e)} className="space-y-4">
                    <FormField
                      control={setPriceOracleForm.control}
                      name="priceOracle"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Price Oracle Address</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="0x..."
                              {...field}
                              disabled={!isOnZetaNetwork}
                            />
                          </FormControl>
                          <FormDescription>
                            The new price oracle contract address
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="submit" disabled={!isOnZetaNetwork || isTransactionPending}>
                      {isTransactionPending ? 'Setting...' : 'Set Price Oracle'}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
      <NotificationDialog />
    </div>
  );
}

export default AdminPage;