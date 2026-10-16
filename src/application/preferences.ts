import { FORMALITIES, LENGTHS, TECH_LEVELS, TEXT_STYLES } from '../domain/types';
import type { Formality, LengthMode, TechLevel, TextStyle } from '../domain/types';

/** Única forma de dado persistido além do perfil: preferências não sensíveis. */
export interface Preferences {
  techLevel: TechLevel;
  formality: Formality;
  length: LengthMode;
  textStyle: TextStyle;
  autoClearMinutes: number;
  /** Opt-in para contadores de uso agregados e sem conteúdo (padrão: desligado). */
  usageCounters: boolean;
}

export const AUTO_CLEAR_OPTIONS = [0, 5, 15, 30] as const;

export const DEFAULT_PREFERENCES: Preferences = {
  techLevel: 'simple',
  formality: 'cordial',
  length: 'standard',
  textStyle: 'natural',
  autoClearMinutes: 15,
  usageCounters: false,
};

export const PREFERENCE_KEYS = Object.keys(DEFAULT_PREFERENCES) as (keyof Preferences)[];

/** Aceita somente chaves e valores conhecidos; descarta todo o resto. */
export function sanitizePreferences(raw: unknown): Preferences {
  const out: Preferences = { ...DEFAULT_PREFERENCES };
  if (typeof raw !== 'object' || raw === null) return out;
  const r = raw as Record<string, unknown>;
  if (typeof r.techLevel === 'string' && (TECH_LEVELS as readonly string[]).includes(r.techLevel)) out.techLevel = r.techLevel as TechLevel;
  if (typeof r.formality === 'string' && (FORMALITIES as readonly string[]).includes(r.formality)) out.formality = r.formality as Formality;
  if (typeof r.length === 'string' && (LENGTHS as readonly string[]).includes(r.length)) out.length = r.length as LengthMode;
  if (typeof r.textStyle === 'string' && (TEXT_STYLES as readonly string[]).includes(r.textStyle)) out.textStyle = r.textStyle as TextStyle;
  if (typeof r.autoClearMinutes === 'number' && (AUTO_CLEAR_OPTIONS as readonly number[]).includes(r.autoClearMinutes)) {
    out.autoClearMinutes = r.autoClearMinutes;
  }
  if (typeof r.usageCounters === 'boolean') out.usageCounters = r.usageCounters;
  return out;
}
