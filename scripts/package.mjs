// Empacota dist/ em release/<nome>-<versão>.zip usando o utilitário zip do sistema.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const { version } = JSON.parse(readFileSync('manifest.json', 'utf8'));
mkdirSync('release', { recursive: true });
const out = resolve('release', `assistente-textos-service-desk-${version}.zip`);
rmSync(out, { force: true });
execFileSync('zip', ['-r', '-X', out, '.'], { cwd: 'dist', stdio: 'inherit' });
console.log(`Pacote criado: ${out}`);
