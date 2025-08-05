import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '../ui/form';
import { ZERO_ADDRESS, type EVMAddress } from '@/types/address';
import { 
  addSupportedAssetSchema, 
  removeSupportedAssetSchema,
  AddSupportedAssetForm,
  RemoveSupportedAssetForm 
} from './schemas';

interface Asset {
  symbol: string;
  address: string;
  label: string;
}

interface DepositContractFormsProps {
  isOnExternalNetwork: boolean;
  isTransactionPending: boolean;
  externalChainAssets: Asset[];
  contractAddress?: EVMAddress | null;
  onAddSupportedAsset: (data: AddSupportedAssetForm) => void;
  onRemoveSupportedAsset: (data: RemoveSupportedAssetForm) => void;
}

export function DepositContractForms({
  isOnExternalNetwork,
  isTransactionPending,
  externalChainAssets,
  contractAddress,
  onAddSupportedAsset,
  onRemoveSupportedAsset,
}: DepositContractFormsProps) {
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

  return (
    <div className="space-y-6">
      <div className="mb-4">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
          <span className="bg-gradient-to-r from-zeta-500 to-zeta-600 bg-clip-text text-transparent font-bold">
            DepositContract
          </span>{' '}
          Admin Functions
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Contract Address: {!contractAddress || contractAddress === ZERO_ADDRESS ? 'Not deployed' : contractAddress}
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
            <form onSubmit={(e) => void removeSupportedAssetForm.handleSubmit(onRemoveSupportedAsset)(e)} className="space-y-4">
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
                          {externalChainAssets.map((asset) => (
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
  );
}