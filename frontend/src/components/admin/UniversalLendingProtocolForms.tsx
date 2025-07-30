import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '../ui/form';
import { ZERO_ADDRESS, type EVMAddress } from '@/types/address';
import {
  addAssetSchema,
  updatePriceSchema,
  setAllowedChainSchema,
  mapZRC20Schema,
  setPriceOracleSchema,
  AddAssetForm,
  UpdatePriceForm,
  SetAllowedChainForm,
  MapZRC20Form,
  SetPriceOracleForm
} from './schemas';

interface Asset {
  symbol: string;
  address: string;
  label: string;
}

interface UniversalLendingProtocolFormsProps {
  isOnZetaNetwork: boolean;
  isTransactionPending: boolean;
  zetaChainAssets: Asset[];
  contractAddress?: EVMAddress | null;
  mockPriceOracleAddress?: string;
  onAddAsset: (data: AddAssetForm) => void;
  onUpdatePrice: (data: UpdatePriceForm) => void;
  onSetAllowedChain: (data: SetAllowedChainForm) => void;
  onMapZRC20: (data: MapZRC20Form) => void;
  onSetPriceOracle: (data: SetPriceOracleForm) => void;
}

export function UniversalLendingProtocolForms({
  isOnZetaNetwork,
  isTransactionPending,
  zetaChainAssets,
  contractAddress,
  mockPriceOracleAddress,
  onAddAsset,
  onUpdatePrice,
  onSetAllowedChain,
  onMapZRC20,
  onSetPriceOracle,
}: UniversalLendingProtocolFormsProps) {
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

  return (
    <div className="space-y-6">
      <div className="mb-4">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
          <span className="bg-gradient-to-r from-zeta-500 to-zeta-600 bg-clip-text text-transparent font-bold">
            UniversalLendingProtocol
          </span>{' '}
          Admin Functions
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Contract Address: {!contractAddress || contractAddress === ZERO_ADDRESS ? 'Not deployed' : contractAddress}
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
              💡 Price Oracle Address: {mockPriceOracleAddress ?? 'Not deployed'}
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
                          {zetaChainAssets.map((asset) => (
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
                          <SelectItem value="97">BSC Testnet (97)</SelectItem>
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
  );
}