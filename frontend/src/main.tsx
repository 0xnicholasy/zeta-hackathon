import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ThemeProvider } from './contexts/ThemeContext'
import { Web3Providers } from './providers/Web3Providers'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <Web3Providers>
        <App />
      </Web3Providers>
    </ThemeProvider>
  </StrictMode>,
)
