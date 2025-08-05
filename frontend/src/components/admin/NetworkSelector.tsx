import { NetworkIcon } from '@web3icons/react';
import { FaChevronDown } from 'react-icons/fa';
import { Button } from '../ui/button';
import { useChainModal } from '@rainbow-me/rainbowkit';

interface ChainInfo {
  name: string;
  icon: string;
}

interface NetworkSelectorProps {
  currentChain: ChainInfo;
}

export function NetworkSelector({ currentChain }: NetworkSelectorProps) {
  const { openChainModal } = useChainModal();
  return (
    <div className="mb-6">
      <Button
        variant="outline"
        size="sm"
        onClick={openChainModal}
        disabled={!openChainModal}
        className="flex items-center gap-2 min-w-48"
      >
        <NetworkIcon name={currentChain.icon} className="w-4 h-4" />
        <span>{currentChain.name}</span>
        <FaChevronDown className="w-4 h-4 ml-auto" />
      </Button>
    </div>
  );
}