import React from 'react';
import { useContracts, useDeploymentStatus } from '../hooks/useContracts';
import { getDeploymentInfo } from '../contracts/deployments';

const ContractInfo: React.FC = () => {
  const { 
    chainId, 
    networkConfig, 
    contracts, 
    tokens,
    simpleLendingProtocol,
    ethArbi,
    usdcArbi 
  } = useContracts();
  
  const deploymentStatus = useDeploymentStatus();
  const deploymentInfo = getDeploymentInfo();

  if (!chainId) {
    return (
      <div className="bg-surface-light dark:bg-surface-dark p-6 rounded-xl border border-border-light dark:border-border-dark">
        <h3 className="text-lg font-semibold text-text-primary-light dark:text-text-primary-dark mb-4">
          Contract Information
        </h3>
        <p className="text-text-secondary-light dark:text-text-secondary-dark">
          Please connect your wallet to view contract information.
        </p>
      </div>
    );
  }

  if (!deploymentStatus.isSupported) {
    return (
      <div className="bg-surface-light dark:bg-surface-dark p-6 rounded-xl border border-border-light dark:border-border-dark">
        <h3 className="text-lg font-semibold text-text-primary-light dark:text-text-primary-dark mb-4">
          Contract Information
        </h3>
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-700 dark:text-red-400">
            Chain ID {chainId} is not supported yet.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface-light dark:bg-surface-dark p-6 rounded-xl border border-border-light dark:border-border-dark">
      <h3 className="text-lg font-semibold text-text-primary-light dark:text-text-primary-dark mb-4">
        Contract Information
      </h3>
      
      {/* Network Info */}
      <div className="mb-6">
        <h4 className="text-md font-medium text-text-primary-light dark:text-text-primary-dark mb-2">
          Network
        </h4>
        <div className="bg-zeta-50 dark:bg-zeta-900/20 rounded-lg p-3">
          <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
            <span className="font-medium">Name:</span> {networkConfig?.name}
          </p>
          <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
            <span className="font-medium">Chain ID:</span> {chainId}
          </p>
          <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
            <span className="font-medium">Type:</span> {networkConfig?.type}
          </p>
        </div>
      </div>

      {/* Deployment Status */}
      <div className="mb-6">
        <h4 className="text-md font-medium text-text-primary-light dark:text-text-primary-dark mb-2">
          Deployment Status
        </h4>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
              Simple Lending Protocol
            </span>
            <span className={`text-sm px-2 py-1 rounded ${
              deploymentStatus.hasSimpleLendingProtocol 
                ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                : 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400'
            }`}>
              {deploymentStatus.hasSimpleLendingProtocol ? 'Deployed' : 'Not Deployed'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
              Universal Lending Protocol
            </span>
            <span className={`text-sm px-2 py-1 rounded ${
              deploymentStatus.hasUniversalLendingProtocol 
                ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                : 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400'
            }`}>
              {deploymentStatus.hasUniversalLendingProtocol ? 'Deployed' : 'Not Deployed'}
            </span>
          </div>
        </div>
      </div>

      {/* Contract Addresses */}
      {contracts && Object.keys(contracts).length > 0 && (
        <div className="mb-6">
          <h4 className="text-md font-medium text-text-primary-light dark:text-text-primary-dark mb-2">
            Contract Addresses
          </h4>
          <div className="space-y-2">
            {Object.entries(contracts).map(([name, address]) => (
              <div key={name} className="flex flex-col">
                <span className="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
                  {name}
                </span>
                <span className="text-xs text-text-secondary-light dark:text-text-secondary-dark font-mono break-all">
                  {address}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Token Addresses */}
      {tokens && Object.keys(tokens).length > 0 && (
        <div className="mb-6">
          <h4 className="text-md font-medium text-text-primary-light dark:text-text-primary-dark mb-2">
            Token Addresses
          </h4>
          <div className="space-y-2">
            {Object.entries(tokens).map(([symbol, address]) => (
              <div key={symbol} className="flex flex-col">
                <span className="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
                  {symbol}
                </span>
                <span className="text-xs text-text-secondary-light dark:text-text-secondary-dark font-mono break-all">
                  {address}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Deployment Info */}
      <div>
        <h4 className="text-md font-medium text-text-primary-light dark:text-text-primary-dark mb-2">
          Deployment Info
        </h4>
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
          <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
            <span className="font-medium">Last Updated:</span> {new Date(deploymentInfo.lastUpdated).toLocaleString()}
          </p>
          <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
            <span className="font-medium">Deployer:</span> 
            <span className="font-mono ml-1">{deploymentInfo.deployer}</span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ContractInfo;