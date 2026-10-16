import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DEFAULT_PROFILE } from '../config/language-profile';
import { validateProfile } from '../config/profile-schema';

/** Auxiliares de teste: chaves geradas em tempo de execução pelo script real, em diretório temporário. */
const SCRIPT = join(process.cwd(), 'scripts', 'sign-profile.mjs');
let dir = '';

export interface Keys { publicKey: string; privatePath: string }
export interface Envelope { format: string; profile: Record<string, unknown>; signatureValue: string }

export function openSigningDir(): void {
  dir = mkdtempSync(join(tmpdir(), 'sign-test-'));
}

export function closeSigningDir(): void {
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = '';
}

export function keygen(name: string): Keys {
  if (!dir) openSigningDir();
  const prefix = join(dir, name);
  const out = execFileSync('node', [SCRIPT, 'keygen', prefix], { encoding: 'utf8' }).trim().split('\n');
  return { publicKey: out[out.length - 1] ?? '', privatePath: `${prefix}.private.pem` };
}

export function signWith(keys: Keys, profile: unknown, name = 'perfil'): Envelope {
  const input = join(dir, `${name}.json`);
  const output = join(dir, `${name}.assinado.json`);
  writeFileSync(input, JSON.stringify(profile));
  execFileSync('node', [SCRIPT, 'sign', input, keys.privatePath, output], { encoding: 'utf8' });
  return JSON.parse(readFileSync(output, 'utf8')) as Envelope;
}

export const normalized = (org: string) => {
  const r = validateProfile({ ...DEFAULT_PROFILE, organizationName: org });
  if (!r.ok) throw new Error('perfil de teste inválido');
  return r.profile;
};
