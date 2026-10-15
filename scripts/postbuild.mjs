// Copia o manifest da raiz para dist/ e confere que os arquivos referenciados existem.
import { copyFileSync, existsSync, readFileSync } from 'node:fs';

copyFileSync('manifest.json', 'dist/manifest.json');
const m = JSON.parse(readFileSync('dist/manifest.json', 'utf8'));
const refs = [
  m.action?.default_popup, m.side_panel?.default_path, m.background?.service_worker, m.storage?.managed_schema,
  ...Object.values(m.icons ?? {}), ...Object.values(m.action?.default_icon ?? {}),
].filter(Boolean);
const missing = refs.filter((f) => !existsSync(`dist/${f}`));
if (missing.length) {
  console.error('Arquivos referenciados ausentes no dist:', missing);
  process.exit(1);
}
console.log('manifest.json copiado; referências conferidas.');
