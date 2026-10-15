import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// fileURLToPath (e não URL.pathname) para funcionar no Windows e em caminhos com espaço.
const fromRoot = (path: string) => fileURLToPath(new URL(path, import.meta.url));

const listFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? listFiles(join(dir, e.name)) : [join(dir, e.name)],
  );

/**
 * Emite o manifest.json da raiz junto com o bundle, tanto no build quanto no modo watch.
 * Em `npm run dev`, alterações no manifest e em public/ (ícones, esquema da política) disparam novo build.
 */
function extensionManifest(): Plugin {
  const source = fromRoot('./manifest.json');
  return {
    name: 'extension-manifest',
    buildStart() {
      for (const file of [source, ...listFiles(fromRoot('./public'))]) this.addWatchFile(file);
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'manifest.json', source: readFileSync(source, 'utf8') });
    },
  };
}

// Build de extensão MV3: duas páginas HTML (painel e popup) e um service worker.
// Sem CDN, sem código remoto, sem polyfill inline (compatível com a CSP restritiva).
// Modo development: saída separada em dist-dev/, com sourcemaps e sem minificação, para depurar no Edge.
export default defineConfig(({ mode }) => {
  const dev = mode === 'development';
  return {
    plugins: [react(), extensionManifest()],
    base: './',
    publicDir: 'public',
    build: {
      outDir: dev ? 'dist-dev' : 'dist',
      emptyOutDir: true,
      target: 'es2022',
      sourcemap: dev,
      minify: !dev,
      modulePreload: { polyfill: false },
      rollupOptions: {
        input: {
          sidepanel: fromRoot('./sidepanel.html'),
          popup: fromRoot('./popup.html'),
          background: fromRoot('./src/infrastructure/background.ts'),
        },
        output: {
          entryFileNames: (chunk) =>
            chunk.name === 'background' ? 'background.js' : 'assets/[name]-[hash].js',
          chunkFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash][extname]',
        },
      },
    },
  };
});
