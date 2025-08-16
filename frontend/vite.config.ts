import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  server: {
    watch: {
      usePolling: false, // Use native file watching
    }
  },
  plugins: [
    react(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      buffer: "buffer",
      crypto: "crypto-browserify",
      stream: "stream-browserify",
      util: "util",
    },
  },
  define: {
    global: "globalThis",
    __DEV__: JSON.stringify(process.env.NODE_ENV === 'development')
  },
  esbuild: {
    // Make TypeScript errors fail the build
    logOverride: { 'this-is-undefined-in-esm': 'silent' }
  },
  build: {
    // Fail build on warnings
    rollupOptions: {
      onwarn(warning) {
        // Treat warnings as errors during build
        if (warning.code === 'UNUSED_EXTERNAL_IMPORT') return
        if (warning.code === 'CIRCULAR_DEPENDENCY') return
        if (warning.code === 'THIS_IS_UNDEFINED') return
        // Ignore pure annotation warnings from dependencies
        if (warning.message?.includes('/*#__PURE__*/')) return
        if (warning.message?.includes('/* @__PURE__ */')) return
        // Ignore warnings from @noble/curves library
        if (warning.message?.includes('@noble/curves')) return
        if (warning.message?.includes('ed25519.js')) return
        // Ignore Rollup annotation warnings
        if (warning.message?.includes('annotation that Rollup cannot interpret')) return
        // Ignore polyfill externalization warnings
        if (warning.message?.includes('has been externalized for browser compatibility')) return
        // eslint-disable-next-line no-console
        console.error(`Build warning treated as error: ${warning.message}`)
        throw new Error(`Build failed due to warning: ${warning.message}`)
      },
      // Manual chunking for better code splitting
      output: {
        manualChunks: {
          // Vendor chunks
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'web3-vendor': ['ethers', 'viem', 'wagmi', '@rainbow-me/rainbowkit'],
          'solana-vendor': ['@solana/web3.js', '@solana/spl-token'],
          'ui-vendor': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-label',
            '@radix-ui/react-select',
            '@radix-ui/react-slot',
            '@radix-ui/react-switch',
            'lucide-react',
            'react-icons',
            'react-loader-spinner'
          ],
          'form-vendor': [
            'react-hook-form',
            '@hookform/resolvers',
            'zod'
          ],
          'utils-vendor': [
            'class-variance-authority',
            'clsx',
            'tailwind-merge',
            'tailwindcss-animate'
          ]
        }
      }
    },
    // Enable source maps for better debugging
    sourcemap: true,
    // Strict mode for better error catching
    minify: 'esbuild',
    target: 'esnext',
    // Increase chunk size warning limit (in kB)
    chunkSizeWarningLimit: 1000,
    // Enable CSS code splitting
    cssCodeSplit: true,
    // Enable module preloading
    modulePreload: {
      polyfill: true
    }
  },
  // Optimize dependencies pre-bundling
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'ethers',
      'viem',
      'wagmi',
      '@rainbow-me/rainbowkit',
      '@solana/web3.js',
      '@solana/spl-token',
      'react-hook-form',
      'zod'
    ]
  },
})

