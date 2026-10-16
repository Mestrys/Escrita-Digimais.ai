import { describe, expect, it } from 'vitest';
import { DEFAULT_PROFILE } from '../config/language-profile';
import { applyOverlay, parseOverlayJson, validateOverlay } from '../config/profile-overlay';
import type { ProfileOverlay } from '../config/profile-overlay';
import { AppStorage } from '../infrastructure/storage';
import { codes, gen, profileWith } from './helpers';
import { MemoryArea } from './memory-storage';

const ok = (raw: unknown): ProfileOverlay => {
  const r = validateOverlay(raw);
  if (!r.ok) throw new Error(r.errors.join('; '));
  return r.overlay;
};
const base = { schemaVersion: 1, overlayName: 'Equipe Redes' };
const PROGRESS = {
  actions: ['Limpeza do cache do navegador'],
  observedResult: 'A lentidão diminuiu parcialmente.',
  pendingItem: 'Acompanhar o comportamento por dois dias',
};

describe('validação da camada', () => {
  it('aceita só campos restritivos e normaliza', () => {
    const o = ok({
      ...base,
      forbiddenTerms: ['  gambiarra '],
      preferredTerms: [{ avoid: 'travou', prefer: 'ficou sem resposta' }],
      requiredTexts: [{ text: 'Ref. interna: Redes', types: ['technical_note'] }],
      internalDomains: ['redes.exemplo.local'],
      maxLength: 1500,
      closureRules: { minAttempts: 4 },
    });
    expect(o.forbiddenTerms).toEqual(['gambiarra']);
    expect(o.closureRules).toEqual({ minAttempts: 4 });
    expect(ok(o)).toEqual(o);
  });

  it('recusa campos que mudam estilo ou podem silenciar alertas', () => {
    for (const extra of [
      { greetings: {} }, { closings: {} }, { signature: 'x' }, { categoryNames: {} }, { templates: {} },
      { recipients: {} }, { knownAcronyms: ['TI'] }, { privacyNotice: { text: 'x', types: [] } }, { profileVersion: '2.0.0' },
    ]) {
      const r = validateOverlay({ ...base, ...extra });
      expect(r.ok, JSON.stringify(extra)).toBe(false);
    }
    const reopen = validateOverlay({ ...base, closureRules: { reopenInstruction: 'x' } });
    expect(reopen.ok).toBe(false);
  });

  it('exige nome e versão e reaproveita as proteções do validador de perfil', () => {
    expect(validateOverlay({ schemaVersion: 1, forbiddenTerms: ['a'] }).ok).toBe(false);
    expect(validateOverlay({ overlayName: 'X' }).ok).toBe(false);
    expect(validateOverlay('lixo').ok).toBe(false);
    expect(validateOverlay({ ...base, forbiddenTerms: ['<b>x</b>'] }).ok).toBe(false);
    expect(validateOverlay({ ...base, overlayName: 'http://x.com' }).ok).toBe(false);
    expect(validateOverlay({ ...base, maxLength: 5 }).ok).toBe(false);
    const proto = parseOverlayJson('{"schemaVersion":1,"overlayName":"X","__proto__":{"a":1}}');
    expect(proto.ok).toBe(false);
    expect(parseOverlayJson('{').ok).toBe(false);
    expect(parseOverlayJson('x'.repeat(200 * 1024)).ok).toBe(false);
  });

  it('erros citam overlayName, não organizationName', () => {
    const r = validateOverlay({ ...base, overlayName: '<b>x</b>' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(' ')).toMatch(/overlayName/);
  });
});

describe('mesclagem restritiva', () => {
  it('sem camada devolve o perfil intacto', () => {
    expect(applyOverlay(DEFAULT_PROFILE, null)).toBe(DEFAULT_PROFILE);
  });

  it('une listas sem duplicar e sem alterar a base', () => {
    const snapshot = structuredClone(DEFAULT_PROFILE);
    const org = profileWith({ forbiddenTerms: ['Gambiarra'], internalDomains: ['a.local'] });
    const merged = applyOverlay(org, ok({ ...base, forbiddenTerms: ['gambiarra', 'macete'], internalDomains: ['a.local', 'b.local'] }));
    expect(merged.forbiddenTerms).toEqual(['Gambiarra', 'macete']);
    expect(merged.internalDomains).toEqual(['a.local', 'b.local']);
    expect(DEFAULT_PROFILE).toEqual(snapshot);
  });

  it('termo preferido da organização vence o da camada para o mesmo "avoid"', () => {
    const org = profileWith({ preferredTerms: [{ avoid: 'Travou', prefer: 'ficou sem resposta' }] });
    const merged = applyOverlay(org, ok({
      ...base,
      preferredTerms: [{ avoid: 'travou', prefer: 'outra coisa' }, { avoid: 'caiu', prefer: 'ficou indisponível' }],
    }));
    expect(merged.preferredTerms).toEqual([
      { avoid: 'Travou', prefer: 'ficou sem resposta' },
      { avoid: 'caiu', prefer: 'ficou indisponível' },
    ]);
  });

  it('textos obrigatórios são somados sem repetir', () => {
    const item = { text: 'Ref. interna', types: ['technical_note' as const] };
    const org = profileWith({ requiredTexts: [item] });
    const merged = applyOverlay(org, ok({ ...base, requiredTexts: [item, { text: 'Outro', types: [] }] }));
    expect(merged.requiredTexts.map((r) => r.text)).toEqual(['Ref. interna', 'Outro']);
  });

  it('tamanho máximo só diminui', () => {
    const org = profileWith({ maxLength: 2000 });
    expect(applyOverlay(org, ok({ ...base, maxLength: 1000 })).maxLength).toBe(1000);
    expect(applyOverlay(org, ok({ ...base, maxLength: 9000 })).maxLength).toBe(2000);
  });

  it('regras de encerramento só endurecem', () => {
    const open = profileWith({ closureRules: { ...DEFAULT_PROFILE.closureRules, noResponseEnabled: true, minAttempts: 3, requirePriorNotice: true, minDaysAfterNotice: 5 } });
    const loose = applyOverlay(open, ok({ ...base, closureRules: { noResponseEnabled: true, minAttempts: 1, requirePriorNotice: false, minDaysAfterNotice: 0 } }));
    expect(loose.closureRules).toEqual(open.closureRules);

    const tight = applyOverlay(open, ok({ ...base, closureRules: { noResponseEnabled: false, minAttempts: 5, minDaysAfterNotice: 9 } }));
    expect(tight.closureRules).toMatchObject({ noResponseEnabled: false, minAttempts: 5, requirePriorNotice: true, minDaysAfterNotice: 9 });

    const closed = profileWith({ closureRules: { ...DEFAULT_PROFILE.closureRules, noResponseEnabled: false, requirePriorNotice: false } });
    const stillClosed = applyOverlay(closed, ok({ ...base, closureRules: { noResponseEnabled: true } }));
    expect(stillClosed.closureRules.noResponseEnabled).toBe(false);
    expect(applyOverlay(closed, ok({ ...base, closureRules: { requirePriorNotice: true } })).closureRules.requirePriorNotice).toBe(true);
  });

  it('campo ausente na camada não altera nada, mesmo com valores padrão diferentes', () => {
    const org = profileWith({ closureRules: { ...DEFAULT_PROFILE.closureRules, noResponseEnabled: true, minAttempts: 2 } });
    const merged = applyOverlay(org, ok({ ...base, closureRules: { minDaysAfterNotice: 7 } }));
    expect(merged.closureRules).toMatchObject({ noResponseEnabled: true, minAttempts: 2, minDaysAfterNotice: 7 });
  });

  it('o motor passa a alertar o termo da camada e respeita o limite menor', () => {
    const ctx = { ...PROGRESS, summary: 'Aplicamos uma gambiarra no servidor para voltar a funcionar.' };
    const merged = applyOverlay(DEFAULT_PROFILE, ok({ ...base, forbiddenTerms: ['gambiarra'], maxLength: 200 }));
    expect(codes(gen('progress_update', ctx))).not.toContain('forbidden_term');
    expect(codes(gen('progress_update', ctx, {}, merged))).toContain('forbidden_term');
    expect(codes(gen('progress_update', ctx, {}, merged))).toContain('max_length_exceeded');
  });
});

describe('persistência da camada', () => {
  it('grava e relê a camada, recusa inválida e a limpa com "Limpar tudo"', async () => {
    const local = new MemoryArea();
    const store = new AppStorage(local, null);
    const o = ok({ ...base, forbiddenTerms: ['macete'] });
    await store.saveOverlay(o);
    expect(await store.loadOverlay()).toEqual(o);
    await expect(store.saveOverlay({ ...o, signature: 'x' } as never)).rejects.toThrow();
    await store.clearAll();
    expect(await store.loadOverlay()).toBeNull();
  });

  it('camada adulterada no armazenamento é ignorada', async () => {
    const local = new MemoryArea({ profileOverlay: { schemaVersion: 1, overlayName: 'X', greetings: { cordial: {} } } });
    expect(await new AppStorage(local, null).loadOverlay()).toBeNull();
  });
});
