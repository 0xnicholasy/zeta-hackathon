import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@contracts': path.resolve(__dirname, '../lending-zeta/typechain-types'),
      '@deployments': path.resolve(__dirname, '../lending-zeta'),
    },
  },
  assetsInclude: ['**/*.json'],
})
