// Verificação do pacote final: sem código remoto, sem eval, sem chamadas de rede, permissões mínimas.
// Uso: node scripts/verify-dist.mjs [diretório]  (padrão: dist)
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const problems = [];
const walk = (dir) => readdirSync(dir).flatMap((n) => {
  const p = join(dir, n);
  return statSync(p).isDirectory() ? walk(p) : [p];
});
const dir = process.argv[2] ?? 'dist';
const files = walk(dir);
const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'));

const allowedPermissions = ['sidePanel', 'storage'];
for (const p of manifest.permissions ?? []) if (!allowedPermissions.includes(p)) problems.push(`Permissão não prevista: ${p}`);
if (manifest.host_permissions?.length) problems.push('host_permissions não é permitido nesta versão.');
if (manifest.optional_permissions?.length || manifest.optional_host_permissions?.length) problems.push('Permissões opcionais não previstas.');
if (manifest.content_scripts) problems.push('content_scripts não é permitido (não lemos páginas).');
if (manifest.externally_connectable) problems.push('externally_connectable não é permitido.');
const csp = manifest.content_security_policy?.extension_pages ?? '';
if (/unsafe-eval|unsafe-inline|https?:|\*/.test(csp)) problems.push(`CSP insegura: ${csp}`);
if (!/connect-src 'none'/.test(csp)) problems.push("CSP deve conter connect-src 'none'.");

const forbidden = [
  [/\beval\s*\(/, 'eval('],
  [/new\s+Function\s*\(/, 'new Function('],
  [/\bXMLHttpRequest\b/, 'XMLHttpRequest'],
  [/\bsendBeacon\b/, 'sendBeacon'],
  [/\bnew\s+WebSocket\b/, 'WebSocket'],
  [/\bimportScripts\s*\(/, 'importScripts('],
];
for (const f of files) {
  if (/\.(js|html|css|json)$/.test(f)) {
    const text = readFileSync(f, 'utf8');
    for (const [re, name] of forbidden) if (re.test(text)) problems.push(`${f}: uso de ${name}`);
    if (/\.(js)$/.test(f) && /\bfetch\s*\(/.test(text)) problems.push(`${f}: chamada fetch(`);
    if (/\.html$/.test(f)) {
      if (/<script(?![^>]*\ssrc=)[^>]*>[^<]/i.test(text)) problems.push(`${f}: script inline`);
      if (/<(?:script|link)[^>]+(?:src|href)=["']https?:/i.test(text)) problems.push(`${f}: recurso remoto`);
      if (/\son\w+=/i.test(text)) problems.push(`${f}: manipulador inline`);
    }
    if (/\.(js|css)$/.test(f) && /(?:src|href|url)\(?\s*=?\s*["']https?:\/\/(?!www\.w3\.org|react\.dev|reactjs\.org)/.test(text)) {
      problems.push(`${f}: possível recurso remoto`);
    }
  }
}
if (problems.length) {
  console.error(`Verificação de ${dir} FALHOU:\n- ` + problems.join('\n- '));
  process.exit(1);
}
console.log(`Verificação de ${dir} aprovada (${files.length} arquivos, permissões: ${(manifest.permissions ?? []).join(', ')}).`);
