import { MAX_PROFILE_FILE_BYTES } from '../config/limits';
import { validateProfile } from '../config/profile-schema';
import type { LanguageProfile } from '../domain/types';

/**
 * Perfil assinado (ECDSA P-256 com SHA-256). A organização assina fora da extensão com a chave privada e
 * distribui a chave pública pela política gerenciada (`profileSigningPublicKeys`, até duas, para rotação).
 *
 * Envelope: { "format": "signed-profile-v1", "profile": { ... }, "signatureValue": "<base64url, formato r||s>" }
 * A assinatura cobre o JSON canônico (chaves ordenadas) do perfil. Falha fechada: sem assinatura válida, nada é
 * importado quando a política exige assinatura.
 */

export const SIGNED_FORMAT = 'signed-profile-v1';
export const MAX_SIGNING_KEYS = 2;
const SIGNATURE_BYTES = 64;
const B64 = /^[A-Za-z0-9+/]+={0,2}$/;
const B64URL = /^[A-Za-z0-9_-]+$/;

export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (typeof value === 'object' && value !== null) {
    const obj = value as Record<string, unknown>;
    // Como no JSON, chaves com valor undefined não existem (o validador as produz; o armazenamento as descarta).
    const body = Object.keys(obj)
      .filter((k) => obj[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`);
    return `{${body.join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

function fromBase64(text: string): Uint8Array<ArrayBuffer> {
  const bin = atob(text);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/');
  return fromBase64(padded + '='.repeat((4 - (padded.length % 4)) % 4));
}

/** Chaves públicas (SPKI em base64) lidas da política: formato validado, no máximo duas. */
export function sanitizeSigningKeys(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((k): k is string => typeof k === 'string' && k.length >= 80 && k.length <= 200 && B64.test(k))
    .slice(0, MAX_SIGNING_KEYS);
}

/** true somente se alguma das chaves verifica a assinatura sobre o JSON canônico do perfil. */
export async function verifyProfileSignature(profile: unknown, signature: string, publicKeys: readonly string[]): Promise<boolean> {
  try {
    const subtle = globalThis.crypto?.subtle;
    if (!subtle || typeof signature !== 'string' || !B64URL.test(signature)) return false;
    const sig = fromBase64Url(signature);
    if (sig.length !== SIGNATURE_BYTES) return false;
    const encoded = new TextEncoder().encode(canonicalJson(profile));
    const data = new Uint8Array(new ArrayBuffer(encoded.length));
    data.set(encoded);
    for (const key of sanitizeSigningKeys([...publicKeys])) {
      try {
        const imported = await subtle.importKey('spki', fromBase64(key), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
        if (await subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, imported, sig, data)) return true;
      } catch {
        /* chave inválida: tenta a próxima */
      }
    }
    return false;
  } catch {
    return false;
  }
}

export type ImportResult =
  | { ok: true; profile: LanguageProfile; signature?: string }
  | { ok: false; errors: string[] };

const fail = (message: string): ImportResult => ({ ok: false, errors: [message] });

/**
 * Importa texto JSON de perfil. Com chaves configuradas, exige envelope assinado e válido.
 * Sem chaves, aceita perfil simples; um envelope assinado é recusado porque não há como verificá-lo.
 */
export async function importProfileText(text: string, publicKeys: readonly string[]): Promise<ImportResult> {
  if (new TextEncoder().encode(text).length > MAX_PROFILE_FILE_BYTES) {
    return fail(`O arquivo excede ${Math.round(MAX_PROFILE_FILE_BYTES / 1024)} KB.`);
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return fail('O arquivo não é um JSON válido.');
  }
  const isEnvelope = typeof raw === 'object' && raw !== null && !Array.isArray(raw) && (raw as Record<string, unknown>).format === SIGNED_FORMAT;
  const required = sanitizeSigningKeys([...publicKeys]).length > 0;

  if (!isEnvelope) {
    if (required) return fail('A organização exige perfil assinado. Importe o arquivo assinado fornecido pelo administrador.');
    const plain = validateProfile(raw);
    return plain.ok ? { ok: true, profile: plain.profile } : plain;
  }

  const env = raw as Record<string, unknown>;
  const extra = Object.keys(env).filter((k) => !['format', 'profile', 'signatureValue'].includes(k));
  if (extra.length > 0 || typeof env.signatureValue !== 'string') return fail('Envelope assinado malformado.');
  if (!required) return fail('Este arquivo é assinado, mas nenhuma chave de assinatura foi configurada pela organização.');
  if (!(await verifyProfileSignature(env.profile, env.signatureValue, publicKeys))) {
    return fail('Assinatura inválida: o perfil foi alterado ou não foi assinado pela organização.');
  }
  const checked = validateProfile(env.profile);
  if (!checked.ok) return checked;
  // O que será guardado precisa ser exatamente o que foi assinado, para poder ser reverificado a cada abertura.
  if (canonicalJson(checked.profile) !== canonicalJson(env.profile)) {
    return fail('O perfil assinado não está na forma normalizada. Exporte o perfil pela extensão, assine de novo e importe.');
  }
  return { ok: true, profile: checked.profile, signature: env.signatureValue };
}
