import { DEFAULT_PROFILE } from '../config/language-profile';
import { validateProfile } from '../config/profile-schema';
import { DEFAULT_PREFERENCES, sanitizePreferences } from '../application/preferences';
import type { Preferences } from '../application/preferences';
import type { LanguageProfile } from '../domain/types';

/** Subconjunto mínimo de chrome.storage.StorageArea, injetável em testes. */
export interface StorageArea {
  get(keys?: string | string[] | null): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(keys: string | string[]): Promise<void>;
  clear?(): Promise<void>;
}

export const STORAGE_KEYS = { preferences: 'preferences', profile: 'languageProfile' } as const;
export const ALLOWED_KEYS: string[] = Object.values(STORAGE_KEYS);

function chromeArea(name: 'local' | 'managed'): StorageArea | null {
  try {
    const area = typeof chrome !== 'undefined' ? chrome.storage?.[name] : undefined;
    return area ? (area as unknown as StorageArea) : null;
  } catch {
    return null;
  }
}

export class AppStorage {
  constructor(
    private readonly local: StorageArea | null = chromeArea('local'),
    private readonly managed: StorageArea | null = chromeArea('managed'),
  ) {}

  async loadPreferences(): Promise<Preferences> {
    if (!this.local) return { ...DEFAULT_PREFERENCES };
    try {
      const data = await this.local.get(STORAGE_KEYS.preferences);
      return sanitizePreferences(data[STORAGE_KEYS.preferences]);
    } catch {
      return { ...DEFAULT_PREFERENCES };
    }
  }

  /** Persiste apenas o que passa pela allowlist de preferências. */
  async savePreferences(prefs: Partial<Preferences>): Promise<Preferences> {
    const clean = sanitizePreferences({ ...(await this.loadPreferences()), ...prefs });
    await this.local?.set({ [STORAGE_KEYS.preferences]: clean });
    return clean;
  }

  /** Precedência: política gerenciada, perfil importado, padrão. Tudo é revalidado. */
  async loadProfile(): Promise<{ profile: LanguageProfile; source: 'managed' | 'imported' | 'default' }> {
    try {
      const managed = await this.managed?.get('languageProfile');
      const json = managed?.languageProfile;
      if (typeof json === 'string' && json.trim()) {
        const result = validateProfile(JSON.parse(json));
        if (result.ok) return { profile: result.profile, source: 'managed' };
      }
    } catch {
      /* política ausente ou inválida: segue para o próximo nível */
    }
    try {
      const data = await this.local?.get(STORAGE_KEYS.profile);
      const stored = data?.[STORAGE_KEYS.profile];
      if (stored) {
        const result = validateProfile(stored);
        if (result.ok) return { profile: result.profile, source: 'imported' };
      }
    } catch {
      /* ignora */
    }
    return { profile: structuredClone(DEFAULT_PROFILE), source: 'default' };
  }

  async saveProfile(profile: LanguageProfile): Promise<void> {
    const check = validateProfile(profile);
    if (!check.ok) throw new Error('Perfil inválido.');
    await this.local?.set({ [STORAGE_KEYS.profile]: check.profile });
  }

  async clearAll(): Promise<void> {
    await this.local?.remove(ALLOWED_KEYS);
  }
}
