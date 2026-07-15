import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nitro } from 'nitro/vite';

// Workspace TS sources are consumed directly (no prebuilt dist), so they must
// flow through Vite's transform pipeline rather than esbuild's dep pre-bundler.
// Web Workers created via `new Worker(new URL('./worker.ts', import.meta.url))`
// inside @inkcv/renderer are handled natively by Vite for linked sources.
export default defineConfig(({ mode }) => ({
  // Exclude @inkcv/renderer from Fast Refresh: its .tsx files (react-pdf
  // templates) are imported by the PDF Web Worker, and the injected
  // @react-refresh runtime references `window`, which kills the worker in dev.
  // esbuild still compiles their JSX; they just don't hot-refresh.
  plugins: [
    react({ exclude: [/node_modules/, /packages\/renderer\//] }),
    // Nitro v3 alpha does not currently add rootDir to its route scan list.
    // Keep the explicit scan directory so routes/api works in dev and builds.
    ...(mode === 'test' ? [] : [nitro({ scanDirs: ['.'] })]),
  ],
  base: './',
  server: {
    port: 5173,
    strictPort: true,
  },
  optimizeDeps: {
    exclude: ['@inkcv/core', '@inkcv/ui', '@inkcv/renderer', '@inkcv/exporters', '@inkcv/ai'],
  },
  build: {
    target: 'es2022',
  },
}));
