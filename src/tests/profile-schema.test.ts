import { describe, expect, it } from 'vitest';
import { DEFAULT_PROFILE } from '../config/language-profile';
import { exportProfileJson, parseProfileJson, validateProfile } from '../config/profile-schema';
import { gen } from './helpers';

const base = (patch: Record<string, unknown> = {}) => ({ schemaVersion: 1, ...patch });
const errs = (raw: unknown): string => {
  const r = validateProfile(raw);
  return r.ok ? '' : r.errors.join('\n');
};

describe('perfil de linguagem: importação e exportação', () => {
  it('o perfil padrão faz ida e volta sem perdas', () => {
    const r = parseProfileJson(exportProfileJson(DEFAULT_PROFILE));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.profile).toEqual(DEFAULT_PROFILE);
  });

  it('aceita perfil parcial e completa com o padrão', () => {
    const r = validateProfile(base({ organizationName: 'Organização Teste', maxLength: 1500 }));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.profile.organizationName).toBe('Organização Teste');
      expect(r.profile.greetings).toEqual(DEFAULT_PROFILE.greetings);
    }
  });

  it('aplica o perfil importado na geração', () => {
    const r = validateProfile(base({ signature: 'Central Teste', closings: { cordial: ['Obrigado pela atenção.'] } }));
    if (!r.ok) throw new Error('perfil inválido');
    const out = gen('progress_update', { summary: 'Erro.', actions: ['Verificado o log'] }, {}, r.profile);
    expect(out.text).toContain('Central Teste');
    expect(out.text).toContain('Obrigado pela atenção.');
  });

  it('recusa raiz inválida, versão desconhecida e chaves desconhecidas', () => {
    expect(errs([])).toMatch(/objeto/);
    expect(errs({})).toMatch(/schemaVersion/);
    expect(errs(base({ qualquer: 1 }))).toMatch(/desconhecida/);
  });

  it('recusa tentativa de poluição de protótipo', () => {
    const r = parseProfileJson('{"schemaVersion":1,"__proto__":{"polluted":true},"constructor":{"x":1}}');
    expect(r.ok).toBe(false);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it.each([
    ['HTML', { signature: '<script>alert(1)</script>' }],
    ['link', { signature: 'Acesse https://exemplo.test/x' }],
    ['esquema javascript', { signature: ['java', 'script:alert(1)'].join('') }],
    ['placeholder desconhecido', { signature: 'Equipe {admin}' }],
    ['caractere de controle', { signature: 'Equipe\u0007' }],
    ['texto longo demais', { signature: 'x'.repeat(500) }],
    ['tipo errado', { maxLength: '4000' }],
    ['maxLength fora da faixa', { maxLength: 5 }],
    ['minAttempts fora da faixa', { closureRules: { minAttempts: 99 } }],
    ['booleano inválido', { closureRules: { noResponseEnabled: 'sim' } }],
    ['formalidade desconhecida', { greetings: { informal: {} } }],
    ['tipo de comunicação desconhecido', { requiredTexts: [{ text: 'a', types: ['x'] }] }],
    ['sigla inválida', { knownAcronyms: ['minúscula'] }],
    ['domínio com esquema', { internalDomains: ['https://a.test'] }],
    ['placeholder destination fora do redirecionamento', { templates: { openings: { pending: { cordial: ['Ir para {destination}'] } } } }],
  ])('recusa: %s', (_name, patch) => {
    expect(errs(base(patch))).not.toBe('');
  });

  it('recusa JSON inválido e arquivo grande', () => {
    expect(parseProfileJson('{não é json').ok).toBe(false);
    expect(parseProfileJson(JSON.stringify(base({ organizationName: 'x'.repeat(200 * 1024) }))).ok).toBe(false);
  });

  it('termos são tratados como texto, nunca como expressão regular', () => {
    const r = validateProfile(base({ forbiddenTerms: ['(a+)+$', '.*'] }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const out = gen('progress_update', { summary: 'Erro qualquer.', actions: ['aaaaaaaaaaaaaaaaaaaaaaaaaaaa!'] }, {}, r.profile);
    expect(out.warnings.some((w) => w.code === 'forbidden_term')).toBe(false);
  });
});

describe('perfil de exemplo do repositório', () => {
  it('é válido e habilita o encerramento por ausência de retorno', async () => {
    const { readFileSync } = await import('node:fs');
    const r = parseProfileJson(readFileSync('examples/perfil-exemplo.json', 'utf8'));
    expect(r.ok, r.ok ? '' : r.errors.join('\n')).toBe(true);
    if (r.ok) expect(r.profile.closureRules.noResponseEnabled).toBe(true);
  });
});
