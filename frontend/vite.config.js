import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  server: { port: 5173 },
  // Big shared libraries in their own files: they download in parallel with
  // the app and stay cached when only the app code changes between deploys.
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('@supabase')) return 'vendor-supabase';
          if (/[\/](framer-motion|motion|motion-dom|motion-utils)[\/]/.test(id)) return 'vendor-motion';
          if (/[\/](react|react-dom|scheduler|react-router|react-router-dom|@remix-run)[\/]/.test(id)) return 'vendor-react';
          return undefined;
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    globals: true,
    // jsdom set-up can be slow on this machine (the project lives in a synced
    // OneDrive folder); the 5 s default failed correct tests on slow runs.
    testTimeout: 15000,
  },
});
