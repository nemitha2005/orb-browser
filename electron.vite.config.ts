import { resolve } from 'path';

import { defineConfig, externalizeDepsPlugin } from 'electron-vite';

export default defineConfig({
  // `main` controls how Electron's main process code is bundled.
  main: {
    // Keep Node/Electron dependencies external so runtime behavior stays predictable.
    plugins: [externalizeDepsPlugin()],
    build: {
      // Emit main-process output into the existing dist/main folder.
      outDir: 'dist/main',
      // Source maps help debug stack traces during development.
      sourcemap: true,
      // Use fast, production-safe minification.
      minify: 'esbuild',
      rollupOptions: {
        output: {
          // Stable main entry filename keeps electron-builder configuration simple.
          entryFileNames: 'index.js',
          // Group any generated chunks under one predictable folder.
          chunkFileNames: 'chunks/[name]-[hash].js',
          // Keep emitted assets organized and cache-friendly.
          assetFileNames: 'assets/[name]-[hash][extname]',
          // Force one runtime bundle for the main process entry graph.
          inlineDynamicImports: true,
        },
      },
    },
  },

  // `preload` controls how the isolated bridge script is bundled.
  preload: {
    // Keep preload dependencies bundled so sandbox preload never relies on runtime Node resolution.
    plugins: [],
    build: {
      // Emit preload build output next to main for simple relative path loading.
      outDir: 'dist/preload',
      // Keep source maps for preload debugging in dev.
      sourcemap: true,
      // Minify preload output for production startup performance.
      minify: 'esbuild',
      rollupOptions: {
        output: {
          // Keep preload entry filename stable for BrowserWindow preload path config.
          entryFileNames: 'index.js',
          // Place any extra chunks in a dedicated folder.
          chunkFileNames: 'chunks/[name]-[hash].js',
          // Place emitted assets in an assets folder for clarity.
          assetFileNames: 'assets/[name]-[hash][extname]',
          // Produce a single preload runtime bundle to avoid module resolution pitfalls.
          inlineDynamicImports: true,
        },
      },
    },
  },

  // `renderer` controls Vite's web build for BrowserWindow pages.
  renderer: {
    build: {
      // Emit renderer pages into dist/renderer for production loadFile usage.
      outDir: resolve(__dirname, 'dist/renderer'),
      // Clear the renderer output folder each build so artifacts stay deterministic.
      emptyOutDir: true,
      // Keep source maps for easier renderer debugging.
      sourcemap: true,
      // Minify renderer bundle for production performance.
      minify: 'esbuild',
      rollupOptions: {
        // Multi-page setup: main browser window UI + floating quick-search window UI.
        input: {
          index: resolve(__dirname, 'src/renderer/index.html'),
          float: resolve(__dirname, 'src/renderer/float.html'),
        },
        output: {
          // Use deterministic renderer entry names for simple diagnostics.
          entryFileNames: 'assets/[name].js',
          // Keep shared chunks grouped under assets.
          chunkFileNames: 'assets/[name]-[hash].js',
          // Keep emitted CSS/static files in assets.
          assetFileNames: 'assets/[name]-[hash][extname]',
          // Ask Rollup not to force extra manual chunks unless needed.
          manualChunks: undefined,
        },
      },
    },
  },
});
