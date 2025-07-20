import React from 'react';
import { WagmiProvider } from 'wagmi';
import { RainbowKitProvider, darkTheme, lightTheme } from '@rainbow-me/rainbowkit';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { config } from '../config/wagmi';
import { useTheme } from '../contexts/ThemeContext';

// Import RainbowKit styles
import '@rainbow-me/rainbowkit/styles.css';

const queryClient = new QueryClient();

interface Web3ProvidersProps {
  children: React.ReactNode;
}

const Web3ProvidersInner: React.FC<{ children: React.ReactNode }> = ({ children }) => {
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

export const Web3Providers: React.FC<Web3ProvidersProps> = ({ children }) => {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <Web3ProvidersInner>
          {children}
        </Web3ProvidersInner>
      </QueryClientProvider>
    </WagmiProvider>
  );
};