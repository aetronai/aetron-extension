import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import { viteStaticCopy } from 'vite-plugin-static-copy'
import { resolve } from 'path'

// Get target browser from environment variable (default: chrome)
const browser = process.env.BROWSER || 'chrome'
const isFirefox = browser === 'firefox'

export default defineConfig({
  base: '',
  plugins: [
    react(),
    nodePolyfills({
      include: ['buffer', 'crypto', 'stream', 'util', 'process'],
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
    }),
    viteStaticCopy({
      targets: [
        { src: `manifest.${browser}.json`, dest: '.', rename: 'manifest.json' },
        { src: 'public/icons/*', dest: 'icons' },
        { src: 'public/logo/*', dest: 'logo' },
      ],
    }),
  ],
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared'),
      '@popup': resolve(__dirname, 'src/popup'),
      '@background': resolve(__dirname, 'src/background'),
      '@lib': resolve(__dirname, 'src/lib'),
    },
  },
  build: {
    outDir: `dist-${browser}`,
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'popup.html'),
        background: resolve(__dirname, 'src/background/index.ts'),
        content: resolve(__dirname, 'src/content/index.ts'),
        injected: resolve(__dirname, 'src/injected/index.ts'),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'popup') {
            return 'popup.js'
          }
          return '[name].js'
        },
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
        // Firefox needs inlined chunks for background script
        ...(isFirefox && {
          manualChunks: (id) => {
            // Don't split background script - inline everything
            if (id.includes('background')) {
              return undefined
            }
            // For other entries, allow chunking
            if (id.includes('node_modules')) {
              return 'vendor'
            }
            return undefined
          },
        }),
      },
    },
    target: 'esnext',
    minify: false,
  },
  define: {
    'process.env': {},
    __BROWSER__: JSON.stringify(browser),
  },
})
