import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';


// Build de extensão MV3: duas páginas HTML (painel e popup) e um service worker.
// Sem CDN, sem código remoto, sem polyfill inline (compatível com a CSP restritiva).
export default defineConfig({
  plugins: [react()],
  base: './',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2022',
    sourcemap: false,
    modulePreload: { polyfill: false },
    rollupOptions: {
      input: {
        sidepanel: new URL('./sidepanel.html', import.meta.url).pathname,
        popup: new URL('./popup.html', import.meta.url).pathname,
        background: new URL('./src/infrastructure/background.ts', import.meta.url).pathname,
      },
      output: {
        entryFileNames: (chunk) =>
          chunk.name === 'background' ? 'background.js' : 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
});
