import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

export function SolanaWalletButton() {
  return (
    <WalletMultiButton
      className="!bg-purple-600 hover:!bg-purple-700 !text-white !border-0 !font-medium !px-4 !py-2 !rounded-lg !text-sm"
    />
  );
}