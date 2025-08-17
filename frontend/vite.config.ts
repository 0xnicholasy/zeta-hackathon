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
    // Use esbuild to avoid rare Terser/rollup reorder bugs
    minify: 'esbuild',
    target: 'es2020',
    // Reduce chunk size warning limit to optimize bundle
    chunkSizeWarningLimit: 500,
    // Disable CSS code splitting to reduce chunks
    cssCodeSplit: false,
    // Optimize memory usage (only used if minify: 'terser')
    // terserOptions: {
    //   compress: {
    //     drop_console: true,
    //     drop_debugger: true,
    //   },
    // },
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
      // Let Vite decide optimal vendor chunking to avoid reorder issues
      // output: {
      //   manualChunks: undefined,
      // },
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
      'react-hook-form',
      'zod'
    ]
  },
})

