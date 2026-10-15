import { DEFAULT_PROFILE } from './language-profile';
import { MAX_PROFILE_FILE_BYTES, MAX_PROFILE_LIST, MAX_PROFILE_STRING } from './limits';
import {
  COMMUNICATION_TYPES,
  FORMALITIES,
  RECIPIENTS,
  TECH_LEVELS,
} from '../domain/types';
import type {
  ClosureRules,
  CommunicationType,
  Formality,
  LabelKey,
  LanguageProfile,
  RecipientProfile,
  TechLevel,
  TemplateOverrides,
} from '../domain/types';

/**
 * Validação estrita do perfil de linguagem importado.
 * - Chaves desconhecidas são recusadas (inclusive __proto__ e constructor).
 * - Apenas texto simples: sem HTML, URLs, esquemas executáveis ou caracteres de controle.
 * - Termos nunca são interpretados como expressões regulares.
 * - O objeto resultante é construído campo a campo, nunca por mesclagem do JSON recebido.
 */

export type ProfileValidation =
  | { ok: true; profile: LanguageProfile }
  | { ok: false; errors: string[] };

const LABEL_KEYS: LabelKey[] = [
  'context', 'justification', 'actions_done', 'actions_planned', 'result', 'pending', 'depends_on', 'questions',
  'expected_action', 'deadline', 'evidence', 'notes', 'approval_object', 'approval_effect', 'attempts', 'notice', 'reason',
];

const UNSAFE_TEXT = /<[^>]*>|javascript:|vbscript:|data:|file:|https?:\/\/|www\./iu;
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
const BASE_PLACEHOLDERS = ['organization'];

class Validator {
  readonly errors: string[] = [];

  fail(path: string, message: string): void {
    if (this.errors.length < 40) this.errors.push(`${path}: ${message}`);
  }

  isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  keys(obj: Record<string, unknown>, allowed: readonly string[], path: string): void {
    for (const key of Object.keys(obj)) {
      if (!allowed.includes(key)) this.fail(path, `chave desconhecida ou não permitida "${key.slice(0, 40)}".`);
    }
  }

  string(
    value: unknown,
    path: string,
    opts: { max?: number; min?: number; multiline?: boolean; placeholders?: string[] } = {},
  ): string | undefined {
    if (typeof value !== 'string') {
      this.fail(path, 'deve ser texto.');
      return undefined;
    }
    const text = value.trim();
    const max = opts.max ?? MAX_PROFILE_STRING;
    if (text.length > max) this.fail(path, `excede ${max} caracteres.`);
    if (text.length < (opts.min ?? 0)) this.fail(path, 'não pode ser vazio.');
    if (CONTROL_CHARS.test(text) || (!opts.multiline && /[\r\n]/.test(text))) this.fail(path, 'contém caracteres de controle.');
    if (UNSAFE_TEXT.test(text)) this.fail(path, 'não pode conter HTML, links ou esquemas executáveis.');
    const allowed = [...BASE_PLACEHOLDERS, ...(opts.placeholders ?? [])];
    for (const m of text.matchAll(/\{([^}]*)\}/g)) {
      if (!allowed.includes(m[1] ?? '')) this.fail(path, `placeholder não permitido "{${m[1]}}".`);
    }
    return text;
  }

  stringList(
    value: unknown,
    path: string,
    opts: { maxItems?: number; max?: number; placeholders?: string[]; pattern?: RegExp } = {},
  ): string[] | undefined {
    if (!Array.isArray(value)) {
      this.fail(path, 'deve ser uma lista.');
      return undefined;
    }
    if (value.length > (opts.maxItems ?? MAX_PROFILE_LIST)) this.fail(path, `excede ${opts.maxItems ?? MAX_PROFILE_LIST} itens.`);
    const out: string[] = [];
    value.slice(0, opts.maxItems ?? MAX_PROFILE_LIST).forEach((item, i) => {
      const text = this.string(item, `${path}[${i}]`, { max: opts.max, min: 1, placeholders: opts.placeholders });
      if (text === undefined) return;
      if (opts.pattern && !opts.pattern.test(text)) this.fail(`${path}[${i}]`, 'formato inválido.');
      out.push(text);
    });
    return out;
  }

  boolean(value: unknown, path: string): boolean | undefined {
    if (typeof value !== 'boolean') {
      this.fail(path, 'deve ser verdadeiro ou falso.');
      return undefined;
    }
    return value;
  }

  integer(value: unknown, path: string, min: number, max: number): number | undefined {
    if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
      this.fail(path, `deve ser um inteiro entre ${min} e ${max}.`);
      return undefined;
    }
    return value;
  }

  oneOf<T extends string>(value: unknown, path: string, options: readonly T[]): T | undefined {
    if (typeof value !== 'string' || !options.includes(value as T)) {
      this.fail(path, `valor inválido; use um de: ${options.join(', ')}.`);
      return undefined;
    }
    return value as T;
  }

  /** Lê um mapa com chaves de um conjunto fixo; chaves ausentes herdam o padrão. */
  record<K extends string, V>(
    value: unknown,
    path: string,
    keys: readonly K[],
    fallback: Record<K, V>,
    read: (v: unknown, p: string, key: K) => V | undefined,
  ): Record<K, V> {
    const out = { ...fallback };
    if (value === undefined) return out;
    if (!this.isObject(value)) {
      this.fail(path, 'deve ser um objeto.');
      return out;
    }
    this.keys(value, keys, path);
    for (const key of keys) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        const v = read(value[key], `${path}.${key}`, key);
        if (v !== undefined) out[key] = v;
      }
    }
    return out;
  }
}

function readTemplatePhrases(
  v: Validator,
  value: unknown,
  path: string,
): Partial<Record<CommunicationType, Partial<Record<Formality, string[]>>>> | undefined {
  if (value === undefined) return undefined;
  if (!v.isObject(value)) {
    v.fail(path, 'deve ser um objeto.');
    return undefined;
  }
  v.keys(value, COMMUNICATION_TYPES, path);
  const out: Partial<Record<CommunicationType, Partial<Record<Formality, string[]>>>> = {};
  for (const type of COMMUNICATION_TYPES) {
    const entry = value[type];
    if (entry === undefined) continue;
    if (!v.isObject(entry)) {
      v.fail(`${path}.${type}`, 'deve ser um objeto.');
      continue;
    }
    v.keys(entry, FORMALITIES, `${path}.${type}`);
    const byFormality: Partial<Record<Formality, string[]>> = {};
    for (const formality of FORMALITIES) {
      if (entry[formality] === undefined) continue;
      const list = v.stringList(entry[formality], `${path}.${type}.${formality}`, {
        maxItems: 6,
        max: 300,
        placeholders: type === 'redirect_or_escalate' ? ['destination'] : [],
      });
      if (list) byFormality[formality] = list;
    }
    out[type] = byFormality;
  }
  return out;
}

export function validateProfile(raw: unknown): ProfileValidation {
  const v = new Validator();
  const d = DEFAULT_PROFILE;
  if (!v.isObject(raw)) return { ok: false, errors: ['O perfil deve ser um objeto JSON.'] };

  v.keys(
    raw,
    [
      'schemaVersion', 'profileVersion', 'organizationName', 'categoryNames', 'greetings', 'closings', 'signature',
      'recipients', 'preferredTerms', 'forbiddenTerms', 'requiredTexts', 'privacyNotice', 'maxLength', 'closureRules',
      'knownAcronyms', 'internalDomains', 'templates',
    ],
    'perfil',
  );
  if (raw.schemaVersion !== 1) v.fail('schemaVersion', 'versão de esquema não suportada; use 1.');

  const profileVersion = raw.profileVersion === undefined ? d.profileVersion : v.string(raw.profileVersion, 'profileVersion', { max: 20 });
  if (profileVersion !== undefined && !/^\d+\.\d+\.\d+$/.test(profileVersion)) v.fail('profileVersion', 'use o formato 1.0.0.');

  const organizationName = raw.organizationName === undefined ? d.organizationName : v.string(raw.organizationName, 'organizationName', { max: 80 });

  const categoryNames = v.record(raw.categoryNames, 'categoryNames', COMMUNICATION_TYPES, d.categoryNames, (x, p) =>
    v.string(x, p, { max: 80, min: 1 }),
  );

  const greetings = v.record(raw.greetings, 'greetings', FORMALITIES, d.greetings, (x, p, formality) =>
    v.record(x, p, RECIPIENTS, d.greetings[formality], (y, q) => v.string(y, q, { max: 80, min: 1 })),
  );

  const closings = v.record(raw.closings, 'closings', FORMALITIES, d.closings, (x, p) =>
    v.stringList(x, p, { maxItems: 6, max: 160 }),
  );

  const signature = raw.signature === undefined ? d.signature : v.string(raw.signature, 'signature', { max: 160 });

  const recipients = v.record(raw.recipients, 'recipients', RECIPIENTS, d.recipients, (x, p, key) => {
    if (!v.isObject(x)) {
      v.fail(p, 'deve ser um objeto.');
      return undefined;
    }
    v.keys(x, ['displayName', 'defaultTechLevel', 'defaultFormality', 'allowJargon'], p);
    const base = d.recipients[key];
    const out: RecipientProfile = {
      displayName: x.displayName === undefined ? base.displayName : (v.string(x.displayName, `${p}.displayName`, { max: 60, min: 1 }) ?? base.displayName),
      defaultTechLevel: x.defaultTechLevel === undefined ? base.defaultTechLevel : (v.oneOf<TechLevel>(x.defaultTechLevel, `${p}.defaultTechLevel`, TECH_LEVELS) ?? base.defaultTechLevel),
      defaultFormality: x.defaultFormality === undefined ? base.defaultFormality : (v.oneOf<Formality>(x.defaultFormality, `${p}.defaultFormality`, FORMALITIES) ?? base.defaultFormality),
      allowJargon: x.allowJargon === undefined ? base.allowJargon : (v.boolean(x.allowJargon, `${p}.allowJargon`) ?? base.allowJargon),
    };
    return out;
  });

  let preferredTerms = d.preferredTerms;
  if (raw.preferredTerms !== undefined) {
    preferredTerms = [];
    if (!Array.isArray(raw.preferredTerms)) v.fail('preferredTerms', 'deve ser uma lista.');
    else {
      if (raw.preferredTerms.length > MAX_PROFILE_LIST) v.fail('preferredTerms', 'itens demais.');
      raw.preferredTerms.slice(0, MAX_PROFILE_LIST).forEach((item: unknown, i: number) => {
        const p = `preferredTerms[${i}]`;
        if (!v.isObject(item)) return v.fail(p, 'deve ser um objeto.');
        v.keys(item, ['avoid', 'prefer'], p);
        const avoid = v.string(item.avoid, `${p}.avoid`, { max: 120, min: 1 });
        const prefer = v.string(item.prefer, `${p}.prefer`, { max: 200, min: 1 });
        if (avoid && prefer) preferredTerms.push({ avoid, prefer });
      });
    }
  }

  const forbiddenTerms = raw.forbiddenTerms === undefined ? d.forbiddenTerms : (v.stringList(raw.forbiddenTerms, 'forbiddenTerms', { max: 120 }) ?? d.forbiddenTerms);

  const readTypes = (x: unknown, p: string): CommunicationType[] => {
    const list = v.stringList(x, p, { maxItems: COMMUNICATION_TYPES.length, max: 40 }) ?? [];
    return list.filter((t): t is CommunicationType => {
      const ok = (COMMUNICATION_TYPES as readonly string[]).includes(t);
      if (!ok) v.fail(p, `tipo desconhecido "${t.slice(0, 30)}".`);
      return ok;
    });
  };

  let requiredTexts = d.requiredTexts;
  if (raw.requiredTexts !== undefined) {
    requiredTexts = [];
    if (!Array.isArray(raw.requiredTexts)) v.fail('requiredTexts', 'deve ser uma lista.');
    else {
      if (raw.requiredTexts.length > 20) v.fail('requiredTexts', 'no máximo 20 itens.');
      raw.requiredTexts.slice(0, 20).forEach((item: unknown, i: number) => {
        const p = `requiredTexts[${i}]`;
        if (!v.isObject(item)) return v.fail(p, 'deve ser um objeto.');
        v.keys(item, ['text', 'types'], p);
        const text = v.string(item.text, `${p}.text`, { max: 300, min: 1, multiline: true });
        const types = item.types === undefined ? [] : readTypes(item.types, `${p}.types`);
        if (text) requiredTexts.push({ text, types });
      });
    }
  }

  let privacyNotice = d.privacyNotice;
  if (raw.privacyNotice !== undefined) {
    if (!v.isObject(raw.privacyNotice)) v.fail('privacyNotice', 'deve ser um objeto.');
    else {
      v.keys(raw.privacyNotice, ['text', 'types'], 'privacyNotice');
      const text = raw.privacyNotice.text === undefined ? '' : (v.string(raw.privacyNotice.text, 'privacyNotice.text', { max: 300, multiline: true }) ?? '');
      const types = raw.privacyNotice.types === undefined ? [] : readTypes(raw.privacyNotice.types, 'privacyNotice.types');
      privacyNotice = { text, types };
    }
  }

  const maxLength = raw.maxLength === undefined ? d.maxLength : (v.integer(raw.maxLength, 'maxLength', 200, 20000) ?? d.maxLength);

  let closureRules: ClosureRules = d.closureRules;
  if (raw.closureRules !== undefined) {
    if (!v.isObject(raw.closureRules)) v.fail('closureRules', 'deve ser um objeto.');
    else {
      const c = raw.closureRules;
      v.keys(c, ['noResponseEnabled', 'minAttempts', 'requirePriorNotice', 'minDaysAfterNotice', 'reopenInstruction'], 'closureRules');
      closureRules = {
        noResponseEnabled: c.noResponseEnabled === undefined ? d.closureRules.noResponseEnabled : (v.boolean(c.noResponseEnabled, 'closureRules.noResponseEnabled') ?? false),
        minAttempts: c.minAttempts === undefined ? d.closureRules.minAttempts : (v.integer(c.minAttempts, 'closureRules.minAttempts', 1, 10) ?? d.closureRules.minAttempts),
        requirePriorNotice: c.requirePriorNotice === undefined ? d.closureRules.requirePriorNotice : (v.boolean(c.requirePriorNotice, 'closureRules.requirePriorNotice') ?? true),
        minDaysAfterNotice: c.minDaysAfterNotice === undefined ? d.closureRules.minDaysAfterNotice : (v.integer(c.minDaysAfterNotice, 'closureRules.minDaysAfterNotice', 0, 30) ?? d.closureRules.minDaysAfterNotice),
        reopenInstruction: c.reopenInstruction === undefined ? d.closureRules.reopenInstruction : (v.string(c.reopenInstruction, 'closureRules.reopenInstruction', { max: 200 }) ?? ''),
      };
    }
  }

  const knownAcronyms = raw.knownAcronyms === undefined ? d.knownAcronyms : (v.stringList(raw.knownAcronyms, 'knownAcronyms', { max: 8, pattern: /^[A-ZÀ-Ú]{2,8}$/u }) ?? d.knownAcronyms);
  const internalDomains = raw.internalDomains === undefined ? d.internalDomains : (v.stringList(raw.internalDomains, 'internalDomains', { max: 100, maxItems: 50, pattern: /^[a-z0-9][a-z0-9.-]{1,98}[a-z0-9]$/iu }) ?? d.internalDomains);

  let templates: TemplateOverrides = {};
  if (raw.templates !== undefined) {
    if (!v.isObject(raw.templates)) v.fail('templates', 'deve ser um objeto.');
    else {
      const t = raw.templates;
      v.keys(t, ['openings', 'typeClosings', 'labels'], 'templates');
      templates = {
        openings: readTemplatePhrases(v, t.openings, 'templates.openings'),
        typeClosings: readTemplatePhrases(v, t.typeClosings, 'templates.typeClosings'),
      };
      if (t.labels !== undefined) {
        if (!v.isObject(t.labels)) v.fail('templates.labels', 'deve ser um objeto.');
        else {
          v.keys(t.labels, TECH_LEVELS, 'templates.labels');
          const labels: Partial<Record<TechLevel, Partial<Record<LabelKey, string>>>> = {};
          for (const level of TECH_LEVELS) {
            const entry = t.labels[level];
            if (entry === undefined) continue;
            if (!v.isObject(entry)) {
              v.fail(`templates.labels.${level}`, 'deve ser um objeto.');
              continue;
            }
            v.keys(entry, LABEL_KEYS, `templates.labels.${level}`);
            const one: Partial<Record<LabelKey, string>> = {};
            for (const key of LABEL_KEYS) {
              if (entry[key] === undefined) continue;
              const text = v.string(entry[key], `templates.labels.${level}.${key}`, { max: 60, min: 1 });
              if (text) one[key] = text;
            }
            labels[level] = one;
          }
          templates.labels = labels;
        }
      }
    }
  }

  if (v.errors.length) return { ok: false, errors: v.errors };

  const profile: LanguageProfile = {
    schemaVersion: 1,
    profileVersion: profileVersion ?? d.profileVersion,
    organizationName: organizationName ?? '',
    categoryNames,
    greetings,
    closings,
    signature: signature ?? '',
    recipients,
    preferredTerms,
    forbiddenTerms,
    requiredTexts,
    privacyNotice,
    maxLength,
    closureRules,
    knownAcronyms,
    internalDomains,
    templates,
  };
  return { ok: true, profile };
}

export function parseProfileJson(text: string): ProfileValidation {
  if (new TextEncoder().encode(text).length > MAX_PROFILE_FILE_BYTES) {
    return { ok: false, errors: [`O arquivo excede ${Math.round(MAX_PROFILE_FILE_BYTES / 1024)} KB.`] };
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, errors: ['O arquivo não é um JSON válido.'] };
  }
  return validateProfile(raw);
}

export function exportProfileJson(profile: LanguageProfile): string {
  return JSON.stringify(profile, null, 2) + '\n';
}
