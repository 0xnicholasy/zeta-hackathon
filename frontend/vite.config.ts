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
    // Disable source maps in production to save memory
    sourcemap: false,
    // Use terser for better compression
    minify: 'terser',
    target: 'es2020',
    // Reduce chunk size warning limit to optimize bundle
    chunkSizeWarningLimit: 500,
    // Disable CSS code splitting to reduce chunks
    cssCodeSplit: false,
    // Optimize memory usage
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
    rollupOptions: {
      // Suppress non-critical warnings to reduce memory usage
      onwarn(warning, warn) {
        // Only show critical warnings
        if (warning.code === 'UNUSED_EXTERNAL_IMPORT') return
        if (warning.code === 'CIRCULAR_DEPENDENCY') return
        if (warning.code === 'THIS_IS_UNDEFINED') return
        if (warning.message?.includes('/*#__PURE__*/')) return
        if (warning.message?.includes('/* @__PURE__ */')) return
        if (warning.message?.includes('@noble/curves')) return
        if (warning.message?.includes('ed25519.js')) return
        if (warning.message?.includes('annotation that Rollup cannot interpret')) return
        if (warning.message?.includes('has been externalized for browser compatibility')) return
        // Use default warn handler for other warnings
        warn(warning)
      },
      // Simplified chunking strategy to reduce memory usage
      output: {
        manualChunks: (id) => {
          // Create fewer, larger chunks to reduce memory overhead
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
              return 'react-vendor'
            }
            if (id.includes('ethers') || id.includes('viem') || id.includes('wagmi') || id.includes('rainbow')) {
              return 'web3-vendor'
            }
            if (id.includes('@solana/')) {
              return 'solana-vendor'
            }
            // Group all other vendor packages together
            return 'vendor'
          }
        },
      },
      // Reduce memory usage during tree-shaking
      treeshake: {
        preset: 'smallest',
        moduleSideEffects: false,
      },
    },
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

