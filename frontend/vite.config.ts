import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
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
        // eslint-disable-next-line no-console
        console.error(`Build warning treated as error: ${warning.message}`)
        throw new Error(`Build failed due to warning: ${warning.message}`)
      }
    },
    // Enable source maps for better debugging
    sourcemap: true,
    // Strict mode for better error catching
    minify: 'esbuild',
    target: 'esnext'
  },
  // Enable strict mode in development
  define: {
    __DEV__: JSON.stringify(process.env.NODE_ENV === 'development')
  }
})
