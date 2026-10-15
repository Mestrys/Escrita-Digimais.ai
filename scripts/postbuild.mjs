// Confere que o manifest foi emitido no diretório de saída e que os arquivos referenciados existem.
// Uso: node scripts/postbuild.mjs [diretório]  (padrão: dist)
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2] ?? 'dist';
const manifestPath = join(dir, 'manifest.json');
if (!existsSync(manifestPath)) {
  console.error(`${manifestPath} não encontrado: o Edge não carrega a pasta sem ele.`);
  process.exit(1);
}
const m = JSON.parse(readFileSync(manifestPath, 'utf8'));
const refs = [
  m.action?.default_popup, m.side_panel?.default_path, m.background?.service_worker, m.storage?.managed_schema,
  ...Object.values(m.icons ?? {}), ...Object.values(m.action?.default_icon ?? {}),
].filter(Boolean);
const missing = refs.filter((f) => !existsSync(join(dir, f)));
if (missing.length) {
  console.error(`Arquivos referenciados ausentes em ${dir}:`, missing);
  process.exit(1);
}
console.log(`${manifestPath} presente; referências conferidas.`);
