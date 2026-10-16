// Empacota dist/ em release/escrita-digimais.ai_v<versão>.zip usando o utilitário zip do sistema.
// O zip é reprodutível: arquivos em ordem alfabética, datas fixas (SOURCE_DATE_EPOCH, padrão 01/01/2026 UTC),
// sem atributos extras. Gerar duas vezes o mesmo commit produz o mesmo SHA-256.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, rmSync, statSync, utimesSync } from 'node:fs';
import { join, resolve } from 'node:path';

const { version } = JSON.parse(readFileSync('manifest.json', 'utf8'));
const epoch = Number(process.env.SOURCE_DATE_EPOCH ?? 1767225600);
if (!Number.isInteger(epoch) || epoch < 315532800) {
  console.error('SOURCE_DATE_EPOCH inválido (use segundos desde 1970, a partir de 1980).');
  process.exit(1);
}

/** Lista arquivos de forma recursiva, em ordem alfabética estável, e fixa a data de cada item. */
function collect(dir, prefix = '') {
  const files = [];
  for (const name of readdirSync(dir).sort()) {
    const full = join(dir, name);
    const rel = prefix ? `${prefix}/${name}` : name;
    if (statSync(full).isDirectory()) files.push(...collect(full, rel));
    else files.push(rel);
    utimesSync(full, epoch, epoch);
  }
  utimesSync(dir, epoch, epoch);
  return files;
}

const files = collect('dist');
mkdirSync('release', { recursive: true });
const out = resolve('release', `escrita-digimais.ai_v${version}.zip`);
rmSync(out, { force: true });
execFileSync('zip', ['-X', '-D', '-@', out], {
  cwd: 'dist',
  input: `${files.join('\n')}\n`,
  env: { ...process.env, TZ: 'UTC' },
  stdio: ['pipe', 'inherit', 'inherit'],
});
console.log(`Pacote criado: ${out}`);
