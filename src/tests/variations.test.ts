import { describe, expect, it } from 'vitest';
import { DEFAULT_PROFILE } from '../config/language-profile';
import { variantIndexes } from '../domain/planner';
import { COMMUNICATION_TYPES } from '../domain/types';
import { codes, gen, profileWith } from './helpers';

const CONTEXT = {
  summary: 'Erro ao abrir a planilha de custos.',
  questions: ['Qual mensagem de erro aparece na tela'],
  actions: ['Validadas as permissões do usuário'],
  observedResult: 'O erro persiste.',
  pendingItem: 'Retorno do usuário com a captura de tela.',
  expectedAction: 'Enviar a captura de tela do erro.',
  approvalObject: 'Instalação do software de planilhas.',
  approvalEffect: 'O usuário poderá abrir o arquivo.',
  destinationTeam: 'Equipe de Infraestrutura',
  escalationReason: 'A análise exige acesso administrativo.',
  freeIntent: 'O atendimento presencial foi agendado',
  userConfirmation: 'yes',
  contactAttempts: ['10/10/2026', '12/10/2026', '14/10/2026'],
  priorNotice: '08/10/2026',
} as never;

const PROFILE_OPEN = profileWith({ closureRules: { ...DEFAULT_PROFILE.closureRules, noResponseEnabled: true } });
const FORMALITIES = ['cordial', 'formal', 'direct'] as const;
const variants = Array.from({ length: 64 }, (_, v) => v);

describe('variantIndexes (índice de variação por seção)', () => {
  it('a variação 0 usa o primeiro item de todas as listas', () => {
    expect(variantIndexes(0, [2, 3, 4])).toEqual([0, 0, 0]);
    expect(variantIndexes(0, [])).toEqual([]);
  });

  it('percorre todas as combinações antes de repetir', () => {
    const seen = new Set(Array.from({ length: 12 }, (_, v) => variantIndexes(v, [2, 3, 2]).join('-')));
    expect(seen.size).toBe(12);
    expect(variantIndexes(12, [2, 3, 2])).toEqual(variantIndexes(0, [2, 3, 2]));
    expect(variantIndexes(1, [2, 3, 2])).toEqual([1, 0, 0]);
    expect(variantIndexes(2, [2, 3, 2])).toEqual([0, 1, 0]);
  });

  it('listas vazias ou com um item não consomem variação', () => {
    expect(variantIndexes(5, [0, 1, 0])).toEqual([0, 0, 0]);
    expect(variantIndexes(1, [1, 2])).toEqual([0, 1]);
  });

  it('aceita variação negativa e fracionária sem sair do intervalo', () => {
    for (const v of [-7, -1, 3.9, 1e9]) {
      const idx = variantIndexes(v, [2, 3]);
      expect(idx[0]).toBeGreaterThanOrEqual(0);
      expect(idx[0]).toBeLessThan(2);
      expect(idx[1]).toBeGreaterThanOrEqual(0);
      expect(idx[1]).toBeLessThan(3);
    }
  });
});

describe('variações do texto gerado', () => {
  it('"Outra variação" percorre 64 textos distintos para solicitar informações e só então repete', () => {
    const texts = variants.map((variant) => gen('request_information', CONTEXT, { variant }).text);
    expect(new Set(texts).size).toBe(64);
    expect(gen('request_information', CONTEXT, { variant: 64 }).text).toBe(texts[0]);
  });

  it('é determinístico: a mesma variação gera sempre o mesmo texto', () => {
    for (const variant of variants) {
      expect(gen('pending', CONTEXT, { variant }).text).toBe(gen('pending', CONTEXT, { variant }).text);
    }
  });

  it('a variação não muda os fatos informados pelo analista', () => {
    for (const variant of variants) {
      const text = gen('request_information', CONTEXT, { variant }).text;
      expect(text).toContain('Qual mensagem de erro aparece na tela?');
      expect(text).toContain('Erro ao abrir a planilha de custos.');
    }
  });

  it('nenhuma variação introduz alerta novo, travessão, emoji ou caixa alta', () => {
    let checked = 0;
    for (const type of COMMUNICATION_TYPES) {
      for (const formality of FORMALITIES) {
        const base = gen(type, CONTEXT, { formality, variant: 0, recipient: type === 'technical_note' ? 'technical_team' : 'user' }, PROFILE_OPEN);
        if (base.blocked) continue;
        const baseM = gen(type, CONTEXT, { formality, variant: 0, recipient: type === 'technical_note' ? 'technical_team' : 'manager' }, PROFILE_OPEN);
        for (const variant of variants) {
          const r = gen(type, CONTEXT, { formality, variant, recipient: type === 'technical_note' ? 'technical_team' : 'user' }, PROFILE_OPEN);
          const m = gen(type, CONTEXT, { formality, variant, recipient: type === 'technical_note' ? 'technical_team' : 'manager' }, PROFILE_OPEN);
          if (!m.blocked) {
            expect(codes(m).filter((c) => !codes(baseM).includes(c)), `gestor ${type}/${formality}/v${variant}`).toEqual([]);
          }
          expect(r.blocked, `${type}/${formality}/v${variant}`).toBe(false);
          const extra = codes(r).filter((c) => !codes(base).includes(c));
          expect(extra, `${type}/${formality}/v${variant}`).toEqual([]);
          expect(r.text).not.toMatch(/[—–]/);
          expect(r.text).not.toMatch(/\p{Extended_Pictographic}/u);
          checked += 1;
        }
      }
    }
    expect(checked).toBeGreaterThan(1500);
  }, 60_000);

  it('tipos sem frases alternativas repetem o texto (sem inventar variação)', () => {
    const a = gen('technical_note', CONTEXT, { variant: 0, recipient: 'technical_team' }).text;
    const b = gen('technical_note', CONTEXT, { variant: 3, recipient: 'technical_team' }).text;
    expect(a).toBe(b);
  });

  it('as listas do perfil da organização também entram na variação', () => {
    const profile = profileWith({ closings: { ...DEFAULT_PROFILE.closings, cordial: ['Obrigado A.', 'Obrigado B.', 'Obrigado C.'] } });
    const ends = Array.from({ length: 100 }, (_, variant) => gen('request_information', CONTEXT, { variant }, profile).text)
      .map((t) => /Obrigado ([ABC])\./.exec(t)?.[1]);
    expect(new Set(ends)).toEqual(new Set(['A', 'B', 'C']));
  });

  it('o texto da variação 0 permanece o mesmo dos snapshots (regressão coberta em engine.test.ts)', () => {
    const t = gen('request_information', CONTEXT, { variant: 0 }).text;
    expect(t).toContain('Para continuarmos a análise, precisamos de algumas informações.');
    expect(t).toContain('O seu retorno permitirá que continuemos a análise.');
    expect(t).toContain('Agradecemos a colaboração.');
  });
});
