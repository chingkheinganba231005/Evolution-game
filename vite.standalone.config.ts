import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { fileURLToPath, URL } from 'node:url';

/**
 * Produces a single self-contained dist/index.html (all JS/CSS inlined) for
 * hosting as a standalone page. Forces single-thread evaluation since there is
 * no separate worker asset to load in an inlined document.
 */
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  define: {
    'import.meta.env.VITE_FORCE_SINGLE_THREAD': JSON.stringify('1'),
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    target: 'es2022',
    outDir: 'dist-standalone',
    assetsInlineLimit: 100_000_000,
    chunkSizeWarningLimit: 5000,
  },
});
