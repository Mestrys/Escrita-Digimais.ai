import { DEFAULT_PROFILE } from '../config/language-profile';
import { generate } from '../domain/engine';
import type { CommunicationType, GenerationSettings, LanguageProfile, TicketContext } from '../domain/types';

export const NOW = new Date('2026-10-15T12:00:00');

export function settings(type: CommunicationType, over: Partial<GenerationSettings> = {}): GenerationSettings {
  return { type, recipient: 'user', techLevel: 'balanced', formality: 'cordial', length: 'standard', variant: 0, ...over };
}

export function gen(
  type: CommunicationType,
  context: TicketContext,
  over: Partial<GenerationSettings> = {},
  profile: LanguageProfile = DEFAULT_PROFILE,
) {
  return generate({ settings: settings(type, over), context }, profile, { now: NOW });
}

export function profileWith(patch: Partial<LanguageProfile>): LanguageProfile {
  return { ...structuredClone(DEFAULT_PROFILE), ...patch };
}

export const codes = (r: { warnings: { code: string }[] }): string[] => r.warnings.map((w) => w.code);
