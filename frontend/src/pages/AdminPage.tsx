import { useState } from 'react';
import { useAccount, useChainId, useSwitchChain } from 'wagmi';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Header } from '../components/dashboard/Header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '../components/ui/form';
import { useContracts, SupportedChain } from '../hooks/useContracts';
import { isEVMAddress } from '../components/dashboard/types';
import { SupportedChainId } from '@/contracts/deployments';

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

type AddSupportedAssetForm = z.infer<typeof addSupportedAssetSchema>;
type RemoveSupportedAssetForm = z.infer<typeof removeSupportedAssetSchema>;
type AddAssetForm = z.infer<typeof addAssetSchema>;
type UpdatePriceForm = z.infer<typeof updatePriceSchema>;


function AdminPage() {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const [activeContract, setActiveContract] = useState<'deposit' | 'lending'>('deposit');

  // Get contract addresses
  const contracts = useContracts(chainId as SupportedChainId);  // TODO: fix this type casting

  // Check if we're on the correct network
  const isOnZetaNetwork = chainId === SupportedChain.ZETA_TESTNET;
  const isOnExternalNetwork = chainId === SupportedChain.ARBITRUM_SEPOLIA || chainId === SupportedChain.ETHEREUM_SEPOLIA;

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

  // Forms for SimpleLendingProtocol
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

  const handleSwitchToZeta = () => {
    switchChain({ chainId: SupportedChain.ZETA_TESTNET });
  };

  const handleSwitchToArbitrum = () => {
    switchChain({ chainId: SupportedChain.ARBITRUM_SEPOLIA });
  };

  const onAddSupportedAsset = (data: AddSupportedAssetForm) => {
    // TODO: Implement contract call
    void data;
  };

  const onRemoveSupportedAsset = (data: RemoveSupportedAssetForm) => {
    // TODO: Implement contract call
    void data;
  };

  const onAddAsset = (data: AddAssetForm) => {
    // TODO: Implement contract call
    void data;
  };

  const onUpdatePrice = (data: UpdatePriceForm) => {
    // TODO: Implement contract call
    void data;
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
            Manage contract functions for DepositContract and SimpleLendingProtocol
          </p>
        </div>

        {/* Contract Selector */}
        <div className="mb-6">
          <div className="flex gap-4">
            <Button
              variant={activeContract === 'deposit' ? 'default' : 'outline'}
              onClick={() => setActiveContract('deposit')}
              disabled={activeContract === 'lending' && !isOnExternalNetwork}
            >
              DepositContract
              {!isOnExternalNetwork && activeContract === 'deposit' && (
                <span className="ml-2 text-xs text-yellow-600">Wrong Network</span>
              )}
            </Button>
            <Button
              variant={activeContract === 'lending' ? 'default' : 'outline'}
              onClick={() => setActiveContract('lending')}
              disabled={activeContract === 'deposit' && !isOnZetaNetwork}
            >
              SimpleLendingProtocol
              {!isOnZetaNetwork && activeContract === 'lending' && (
                <span className="ml-2 text-xs text-yellow-600">Wrong Network</span>
              )}
            </Button>
          </div>
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
              disabled={isOnExternalNetwork}
            >
              Switch to Arbitrum ({chainId === SupportedChain.ARBITRUM_SEPOLIA ? 'Current' : 'Switch'})
            </Button>
          </div>
        </div>

        {/* DepositContract Functions */}
        {activeContract === 'deposit' && (
          <div className="space-y-6">
            <div className="mb-4">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
                DepositContract Admin Functions
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
                  <form onSubmit={(e) => void addSupportedAssetForm.handleSubmit(onAddSupportedAsset)(e)} className="space-y-4">
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
                    <Button type="submit" disabled={!isOnExternalNetwork}>
                      Add Supported Asset
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
                  <form onSubmit={(e) => void removeSupportedAssetForm.handleSubmit(onRemoveSupportedAsset)(e)} className="space-y-4">
                    <FormField
                      control={removeSupportedAssetForm.control}
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
                            The address of the asset token to remove from supported list
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="submit" variant="destructive" disabled={!isOnExternalNetwork}>
                      Remove Supported Asset
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </div>
        )}

        {/* SimpleLendingProtocol Functions */}
        {activeContract === 'lending' && (
          <div className="space-y-6">
            <div className="mb-4">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
                SimpleLendingProtocol Admin Functions
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Contract Address: {contracts?.simpleLendingProtocol ?? 'Not deployed'}
              </p>
              {!isOnZetaNetwork && (
                <div className="mt-2 p-3 bg-yellow-100 dark:bg-yellow-900/20 rounded-lg">
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    ⚠️ SimpleLendingProtocol functions are only available on ZetaChain testnet
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
                    <Button type="submit" disabled={!isOnZetaNetwork}>
                      Add Asset
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
                  Update the USD price of an existing asset
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...updatePriceForm}>
                  <form onSubmit={(e) => void updatePriceForm.handleSubmit(onUpdatePrice)(e)} className="space-y-4">
                    <FormField
                      control={updatePriceForm.control}
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
                    <Button type="submit" disabled={!isOnZetaNetwork}>
                      Update Price
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminPage;