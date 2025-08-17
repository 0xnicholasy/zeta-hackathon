// Polyfills for Solana and crypto libraries
import { Buffer } from 'buffer';
(globalThis as any).Buffer = Buffer;

// Process polyfill
(globalThis as any).process = {
  env: {},
  nextTick: (fn: () => void) => setTimeout(fn, 0),
  version: '',
  browser: true,
};

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ThemeProvider } from './contexts/ThemeContext'
import { Web3Providers } from './providers/Web3Providers'

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <ThemeProvider>
      <Web3Providers>
        <App />
      </Web3Providers>
    </ThemeProvider>
  </StrictMode>,
)
