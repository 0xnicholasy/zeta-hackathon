import { useState, useCallback, useEffect } from 'react';
import { useAccount, useReadContract } from 'wagmi';
import { formatUnits } from 'viem';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { useContracts, SupportedChain } from '../hooks/useContracts';
import { useNavigateTo } from '../types/routes';
import { ROUTES } from '../config/routes';
import { Header } from '../components/dashboard/Header';
import { EVMAddress, isEVMAddress } from '../components/dashboard/types';
import { UniversalLendingProtocol__factory } from '../contracts/typechain-types';
import { FaWallet, FaExclamationTriangle, FaCheckCircle, FaArrowLeft, FaPlus, FaTrash } from 'react-icons/fa';
import { LiquidationDialog } from '../components/dashboard/LiquidationDialog';
import { HourglassLoader } from '../components/ui/hourglass-loader';

interface TrackedAddress {
  address: EVMAddress;
  alias?: string;
  healthFactor?: string;
  isLiquidatable?: boolean;
  lastUpdated?: Date;
}

// Default address to track
const DEFAULT_TRACKED_ADDRESS = '0xe1C5Bf97A7Ffb50988DeF972E1E242072298a59C' as EVMAddress;


export default function LiquidationPage() {
  const { isConnected } = useAccount();
  const navigate = useNavigateTo();
  const [liquidationDialogAddress, setLiquidationDialogAddress] = useState<EVMAddress | null>(null);

  // State for tracking multiple addresses (max 10)
  const [trackedAddresses, setTrackedAddresses] = useState<TrackedAddress[]>([
    { address: DEFAULT_TRACKED_ADDRESS, alias: 'Default Address' }
  ]);
  const [newAddress, setNewAddress] = useState('');
  const [newAlias, setNewAlias] = useState('');
  const [selectedAddressIndex, setSelectedAddressIndex] = useState(0);

  const { universalLendingProtocol } = useContracts(SupportedChain.ZETA_TESTNET);

  // Get current selected address
  const currentAddress = trackedAddresses[selectedAddressIndex]?.address;

  // Read health factor for the currently selected address
  const {
    data: userAccountData,
    isLoading: isLoadingHealthFactor,
    refetch: refetchHealthFactor
  } = useReadContract({
    address: universalLendingProtocol as EVMAddress,
    abi: UniversalLendingProtocol__factory.abi,
    functionName: 'getUserAccountData',
    args: currentAddress ? [currentAddress] : undefined,
    query: {
      enabled: Boolean(universalLendingProtocol && currentAddress),
      refetchInterval: 30000, // Refetch every 30 seconds
    },
  });

  // Update health factor when data changes
  useEffect(() => {
    if (userAccountData && currentAddress && userAccountData[4]) {
      const factor = formatUnits(userAccountData[4], 18);
      const isLiquidatable = parseFloat(factor) < 1.2;

      setTrackedAddresses(prev => prev.map((tracked, index) =>
        index === selectedAddressIndex
          ? {
            ...tracked,
            healthFactor: factor,
            isLiquidatable,
            lastUpdated: new Date()
          }
          : tracked
      ));
    }
  }, [userAccountData, currentAddress, selectedAddressIndex]);


  // Add new address to track
  const handleAddAddress = useCallback(() => {
    if (!newAddress.trim() || !isEVMAddress(newAddress) || trackedAddresses.length >= 10) {
      return;
    }

    // Check if address already exists
    const exists = trackedAddresses.some(tracked =>
      tracked.address.toLowerCase() === newAddress.toLowerCase()
    );

    if (exists) {
      alert('Address already being tracked');
      return;
    }

    const newTracked: TrackedAddress = {
      address: newAddress,
      alias: newAlias.trim() || '',
    };

    setTrackedAddresses(prev => [...prev, newTracked]);
    setNewAddress('');
    setNewAlias('');
  }, [newAddress, newAlias, trackedAddresses]);

  // Remove address from tracking
  const handleRemoveAddress = useCallback((index: number) => {
    if (trackedAddresses.length <= 1) return; // Keep at least one address

    setTrackedAddresses(prev => prev.filter((_, i) => i !== index));

    // Adjust selected index if needed
    if (selectedAddressIndex >= index && selectedAddressIndex > 0) {
      setSelectedAddressIndex(prev => prev - 1);
    }
  }, [trackedAddresses.length, selectedAddressIndex]);

  // Open liquidation dialog
  const handleLiquidate = useCallback((targetAddress: EVMAddress) => {
    setLiquidationDialogAddress(targetAddress);
  }, []);

  // Count liquidatable addresses
  const liquidatableCount = trackedAddresses.filter(addr => addr.isLiquidatable).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-zeta-50 to-zeta-100 dark:from-background dark:to-secondary">
      <Header />

      {!isConnected ? (
        <div className="container mx-auto py-8 px-4">
          <Card className="p-8 text-center">
            <FaWallet className="mx-auto mb-4 text-4xl text-muted-foreground" />
            <h2 className="text-2xl font-bold mb-2">Connect Your Wallet</h2>
            <p className="text-muted-foreground mb-4">
              Please connect your wallet to access the liquidation dashboard.
            </p>
          </Card>
        </div>
      ) : (
        <div className="container mx-auto py-8 px-4 space-y-6">
          {/* Header */}
          <div className="mb-8">
            <div className="flex flex-row justify-between items-center w-full">
              <div>
                <h1 className="text-4xl font-bold text-foreground mb-2">
                  Liquidation Dashboard
                </h1>
                <p className="text-muted-foreground">
                  Monitor up to 10 addresses for liquidation opportunities.
                </p>
              </div>
              <div className="flex items-center gap-4 mb-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(ROUTES.DASHBOARD)}
                  className="flex items-center gap-2"
                >
                  <FaArrowLeft className="w-4 h-4" />
                  Back to Dashboard
                </Button>
              </div>
            </div>
          </div>

          {/* Add Address Section */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Add Address to Track</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  placeholder="0x..."
                  value={newAddress}
                  onChange={(e) => setNewAddress(e.target.value)}
                  className={newAddress && !isEVMAddress(newAddress) ? 'border-red-500' : ''}
                />
                {newAddress && !isEVMAddress(newAddress) && (
                  <p className="text-sm text-red-500 mt-1">Invalid Ethereum address</p>
                )}
              </div>
              <div>
                <Label htmlFor="alias">Alias (Optional)</Label>
                <Input
                  id="alias"
                  placeholder="e.g., User123"
                  value={newAlias}
                  onChange={(e) => setNewAlias(e.target.value)}
                />
              </div>
              <div className="flex items-end">
                <Button
                  onClick={handleAddAddress}
                  disabled={!newAddress || !isEVMAddress(newAddress) || trackedAddresses.length >= 10}
                  className="w-full"
                >
                  <FaPlus className="mr-2" />
                  Add Address ({trackedAddresses.length}/10)
                </Button>
              </div>
            </div>
          </Card>

          {/* Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-4">
              <div className="text-2xl font-bold">{trackedAddresses.length}</div>
              <div className="text-sm text-muted-foreground">Tracked Addresses</div>
            </Card>
            <Card className="p-4">
              <div className={`text-2xl font-bold ${liquidatableCount > 0 ? 'text-red-500' : 'text-green-500'}`}>
                {liquidatableCount}
              </div>
              <div className="text-sm text-muted-foreground">Liquidatable</div>
            </Card>
            <Card className="p-4">
              <div className={`text-2xl font-bold ${liquidatableCount > 0 ? 'text-green-500' : 'text-red-500'}`}>
                {trackedAddresses.length - liquidatableCount}
              </div>
              <div className="text-sm text-muted-foreground">Healthy</div>
            </Card>
          </div>

          {/* Tracked Addresses */}
          <Card className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Tracked Addresses</h2>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void refetchHealthFactor()}
                disabled={isLoadingHealthFactor}
              >
                {isLoadingHealthFactor ? (
                  <HourglassLoader size="sm" />
                ) : (
                  'Refresh Current'
                )}
              </Button>
            </div>

            {trackedAddresses.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">
                  No addresses being tracked. Add addresses above to start monitoring.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {trackedAddresses.map((tracked, index) => (
                  <div
                    key={tracked.address}
                    className={`border rounded-lg p-4 cursor-pointer transition-colors ${index === selectedAddressIndex
                      ? 'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-900/20'
                      : tracked.isLiquidatable
                        ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20'
                        : 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20'
                      }`}
                    onClick={() => setSelectedAddressIndex(index)}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          {tracked.isLiquidatable ? (
                            <FaExclamationTriangle className="text-red-500" />
                          ) : (
                            <FaCheckCircle className="text-green-500" />
                          )}
                          <span className="font-mono text-sm">{tracked.address}</span>
                          {tracked.alias && (
                            <span className="text-sm text-muted-foreground">
                              ({tracked.alias})
                            </span>
                          )}
                          {index === selectedAddressIndex && (
                            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                              Currently Monitoring
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                          <div>
                            <div className="text-muted-foreground">Health Factor</div>
                            <div className={`font-medium ${tracked.healthFactor && parseFloat(tracked.healthFactor) < 1.2
                              ? 'text-red-500'
                              : 'text-green-500'
                              }`}>
                              {tracked.healthFactor ? parseFloat(tracked.healthFactor).toFixed(4) : 'Click to load'}
                            </div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Status</div>
                            <div className={tracked.isLiquidatable ? 'text-red-500' : 'text-green-500'}>
                              {tracked.healthFactor ? (tracked.isLiquidatable ? 'Liquidatable' : 'Healthy') : 'Unknown'}
                            </div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Last Updated</div>
                            <div>
                              {tracked.lastUpdated
                                ? tracked.lastUpdated.toLocaleTimeString()
                                : 'Never'
                              }
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        {tracked.isLiquidatable && (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleLiquidate(tracked.address);
                            }}
                          >
                            Liquidate
                          </Button>
                        )}

                        {trackedAddresses.length > 1 && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveAddress(index);
                            }}
                          >
                            <FaTrash />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

        </div>
      )}

      {/* Liquidation Dialog */}
      {liquidationDialogAddress && (
        <LiquidationDialog
          targetAddress={liquidationDialogAddress}
          isOpen={Boolean(liquidationDialogAddress)}
          onClose={() => setLiquidationDialogAddress(null)}
        />
      )}
    </div>
  );
}