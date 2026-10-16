import { describe, expect, it } from 'vitest';
import { DEFAULT_PROFILE } from '../config/language-profile';
import { exportProfileJson } from '../config/profile-schema';
import { DEFAULT_PREFERENCES, sanitizePreferences } from '../application/preferences';
import { emptyCounters, increment } from '../application/usage-counters';
import { AppStorage, ALLOWED_KEYS } from '../infrastructure/storage';
import { MemoryArea } from './memory-storage';

describe('persistência', () => {
  it('padrões quando nada foi salvo', async () => {
    const s = new AppStorage(new MemoryArea(), new MemoryArea());
    expect(await s.loadPreferences()).toEqual(DEFAULT_PREFERENCES);
    expect((await s.loadProfile()).source).toBe('default');
  });

  it('grava somente preferências permitidas e descarta o resto', async () => {
    const local = new MemoryArea();
    const s = new AppStorage(local, null);
    await s.savePreferences({
      techLevel: 'technical',
      summary: 'conteúdo do chamado',
      senha: 'x',
      autoClearMinutes: 7,
    } as never);
    expect(Object.keys(local.data)).toEqual(['preferences']);
    expect(local.data.preferences).toEqual({ ...DEFAULT_PREFERENCES, techLevel: 'technical' });
    expect(JSON.stringify(local.data)).not.toMatch(/conteúdo|senha/);
  });

  it('sanitiza valores inválidos vindos do armazenamento', () => {
    expect(sanitizePreferences({ techLevel: 'x', formality: 5, length: null, autoClearMinutes: -1 })).toEqual(DEFAULT_PREFERENCES);
    expect(sanitizePreferences('lixo')).toEqual(DEFAULT_PREFERENCES);
  });

  it('precedência do perfil: política gerenciada, importado, padrão', async () => {
    const imported = { ...DEFAULT_PROFILE, organizationName: 'Importada' };
    const managedJson = exportProfileJson({ ...DEFAULT_PROFILE, organizationName: 'Gerenciada' });
    const local = new MemoryArea({ languageProfile: imported });
    expect((await new AppStorage(local, null).loadProfile()).profile.organizationName).toBe('Importada');
    const managed = new MemoryArea({ languageProfile: managedJson });
    const both = await new AppStorage(local, managed).loadProfile();
    expect(both.source).toBe('managed');
    expect(both.profile.organizationName).toBe('Gerenciada');
  });

  it('ignora perfil gerenciado ou armazenado inválido', async () => {
    const bad = new MemoryArea({ languageProfile: '{"schemaVersion":1,"x":1}' });
    const local = new MemoryArea({ languageProfile: { schemaVersion: 2 } });
    expect((await new AppStorage(local, bad).loadProfile()).source).toBe('default');
  });

  it('recusa salvar perfil inválido e limpa tudo', async () => {
    const local = new MemoryArea();
    const s = new AppStorage(local, null);
    await expect(s.saveProfile({ ...DEFAULT_PROFILE, maxLength: 1 })).rejects.toThrow();
    await s.saveProfile(DEFAULT_PROFILE);
    await s.savePreferences({ length: 'short' });
    await s.saveCounters(increment(emptyCounters('2026-10-15'), 'copy'));
    expect(Object.keys(local.data).sort()).toEqual([...ALLOWED_KEYS].sort());
    await s.clearAll();
    expect(local.data).toEqual({});
  });
});
