import React from 'react';
import { WagmiProvider } from 'wagmi';
import { RainbowKitProvider, darkTheme, lightTheme } from '@rainbow-me/rainbowkit';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { config } from '../config/wagmi';
import { useTheme } from '../hooks/useTheme';

// Import RainbowKit styles
import '@rainbow-me/rainbowkit/styles.css';

const queryClient = new QueryClient();

interface Web3ProvidersProps {
  children: React.ReactNode;
}

export const Web3Providers: React.FC<Web3ProvidersProps> = ({ children }) => {
  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={config}>
        <RainbowKitThemeWrapper>
          {children}
        </RainbowKitThemeWrapper>
      </WagmiProvider>
    </QueryClientProvider>
  );
};

const RainbowKitThemeWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { theme } = useTheme();

  return (
    <RainbowKitProvider
      theme={theme === 'dark' ? darkTheme({
        accentColor: '#008462',
        accentColorForeground: 'white',
        borderRadius: 'medium',
        overlayBlur: 'small',
      }) : lightTheme({
        accentColor: '#008462',
        accentColorForeground: 'white',
        borderRadius: 'medium',
        overlayBlur: 'small',
      })}
    >
      {children}
    </RainbowKitProvider>
  );
};