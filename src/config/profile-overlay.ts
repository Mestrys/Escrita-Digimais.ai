import { MAX_PROFILE_FILE_BYTES } from './limits';
import { validateProfile } from './profile-schema';
import type { ClosureRules, CommunicationType, LanguageProfile } from '../domain/types';

/**
 * Camada de equipe sobre o perfil da organização, com mesclagem restritiva: a camada só pode endurecer regras,
 * nunca afrouxá-las. Por isso não precisa de assinatura mesmo quando a organização exige perfil assinado.
 *
 * Permitido: acrescentar termos proibidos, termos preferidos, textos obrigatórios e domínios internos; reduzir o
 * tamanho máximo; desligar o encerramento por ausência de retorno; exigir mais tentativas, aviso prévio e mais dias.
 * Não permitido (recusado na validação): saudações, fechamentos, assinatura, nomes, modelos, destinatários, siglas
 * conhecidas, aviso de privacidade e instrução de reabertura, porque mudam o estilo ou podem silenciar alertas.
 */

export interface ProfileOverlay {
  schemaVersion: 1;
  overlayName: string;
  forbiddenTerms?: string[];
  preferredTerms?: { avoid: string; prefer: string }[];
  requiredTexts?: { text: string; types: CommunicationType[] }[];
  internalDomains?: string[];
  maxLength?: number;
  closureRules?: Partial<Pick<ClosureRules, 'noResponseEnabled' | 'minAttempts' | 'requirePriorNotice' | 'minDaysAfterNotice'>>;
}

export type OverlayValidation = { ok: true; overlay: ProfileOverlay } | { ok: false; errors: string[] };

const LIST_KEYS = ['forbiddenTerms', 'preferredTerms', 'requiredTexts', 'internalDomains', 'maxLength', 'closureRules'] as const;
const CLOSURE_KEYS = ['noResponseEnabled', 'minAttempts', 'requirePriorNotice', 'minDaysAfterNotice'] as const;
const MAX_MERGED_TERMS = 400;
const MAX_MERGED_DOMAINS = 100;

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

export function validateOverlay(raw: unknown): OverlayValidation {
  if (!isObject(raw)) return { ok: false, errors: ['A camada deve ser um objeto JSON.'] };
  const errors: string[] = [];
  for (const key of Object.keys(raw)) {
    if (key !== 'schemaVersion' && key !== 'overlayName' && !(LIST_KEYS as readonly string[]).includes(key)) {
      errors.push(`chave "${key.slice(0, 40)}" não é permitida em camada de equipe (ela só pode restringir regras).`);
    }
  }
  if (raw.schemaVersion !== 1) errors.push('schemaVersion: versão de esquema não suportada; use 1.');
  if (typeof raw.overlayName !== 'string' || !raw.overlayName.trim()) errors.push('overlayName: informe o nome da equipe.');
  if (raw.closureRules !== undefined) {
    if (!isObject(raw.closureRules)) errors.push('closureRules: deve ser um objeto.');
    else {
      for (const key of Object.keys(raw.closureRules)) {
        if (!(CLOSURE_KEYS as readonly string[]).includes(key)) {
          errors.push(`closureRules: "${key.slice(0, 40)}" não é permitido em camada de equipe.`);
        }
      }
    }
  }
  if (errors.length > 0) return { ok: false, errors };

  const picked: Record<string, unknown> = { schemaVersion: 1, organizationName: raw.overlayName };
  for (const key of LIST_KEYS) if (raw[key] !== undefined) picked[key] = raw[key];
  const checked = validateProfile(picked);
  if (!checked.ok) return { ok: false, errors: checked.errors.map((e) => e.replace(/^organizationName\b/, 'overlayName')) };

  const p = checked.profile;
  const overlay: ProfileOverlay = { schemaVersion: 1, overlayName: p.organizationName };
  if (raw.forbiddenTerms !== undefined) overlay.forbiddenTerms = p.forbiddenTerms;
  if (raw.preferredTerms !== undefined) overlay.preferredTerms = p.preferredTerms;
  if (raw.requiredTexts !== undefined) overlay.requiredTexts = p.requiredTexts;
  if (raw.internalDomains !== undefined) overlay.internalDomains = p.internalDomains;
  if (raw.maxLength !== undefined) overlay.maxLength = p.maxLength;
  if (isObject(raw.closureRules)) {
    const given: NonNullable<ProfileOverlay['closureRules']> = {};
    for (const key of CLOSURE_KEYS) {
      if (key in raw.closureRules) Object.assign(given, { [key]: p.closureRules[key] });
    }
    overlay.closureRules = given;
  }
  return { ok: true, overlay };
}

export function parseOverlayJson(text: string): OverlayValidation {
  if (new TextEncoder().encode(text).length > MAX_PROFILE_FILE_BYTES) {
    return { ok: false, errors: [`O arquivo excede ${Math.round(MAX_PROFILE_FILE_BYTES / 1024)} KB.`] };
  }
  try {
    return validateOverlay(JSON.parse(text));
  } catch {
    return { ok: false, errors: ['O arquivo não é um JSON válido.'] };
  }
}

function union(base: string[], extra: string[] | undefined, cap: number): string[] {
  const seen = new Set(base.map((t) => t.toLowerCase()));
  const out = [...base];
  for (const term of extra ?? []) {
    if (out.length >= cap) break;
    if (!seen.has(term.toLowerCase())) {
      seen.add(term.toLowerCase());
      out.push(term);
    }
  }
  return out;
}

/** Aplica a camada sobre o perfil base. Nunca afrouxa: o resultado é sempre pelo menos tão restritivo quanto a base. */
export function applyOverlay(base: LanguageProfile, overlay: ProfileOverlay | null): LanguageProfile {
  if (!overlay) return base;
  const out = structuredClone(base);
  out.forbiddenTerms = union(base.forbiddenTerms, overlay.forbiddenTerms, MAX_MERGED_TERMS);
  out.internalDomains = union(base.internalDomains, overlay.internalDomains, MAX_MERGED_DOMAINS);

  const avoided = new Set(base.preferredTerms.map((t) => t.avoid.toLowerCase()));
  for (const pref of overlay.preferredTerms ?? []) {
    if (out.preferredTerms.length >= MAX_MERGED_TERMS) break;
    if (!avoided.has(pref.avoid.toLowerCase())) {
      avoided.add(pref.avoid.toLowerCase());
      out.preferredTerms.push({ ...pref });
    }
  }

  const required = new Set(base.requiredTexts.map((r) => `${r.text}|${[...r.types].sort().join(',')}`));
  for (const item of overlay.requiredTexts ?? []) {
    const key = `${item.text}|${[...item.types].sort().join(',')}`;
    if (!required.has(key) && out.requiredTexts.length < 40) {
      required.add(key);
      out.requiredTexts.push({ text: item.text, types: [...item.types] });
    }
  }

  if (overlay.maxLength !== undefined) out.maxLength = Math.min(base.maxLength, overlay.maxLength);

  const c = overlay.closureRules;
  if (c) {
    if (c.noResponseEnabled === false) out.closureRules.noResponseEnabled = false;
    if (c.minAttempts !== undefined) out.closureRules.minAttempts = Math.max(base.closureRules.minAttempts, c.minAttempts);
    if (c.requirePriorNotice === true) out.closureRules.requirePriorNotice = true;
    if (c.minDaysAfterNotice !== undefined) {
      out.closureRules.minDaysAfterNotice = Math.max(base.closureRules.minDaysAfterNotice, c.minDaysAfterNotice);
    }
  }
  return out;
}
