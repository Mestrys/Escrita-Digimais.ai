import { describe, expect, it } from 'vitest';
import { classifyContext, isPlannedAction } from '../domain/classify';
import { normalizeContext, normalizeText, toItems } from '../domain/normalize';
import { renderPlan } from '../domain/renderer';
import { evaluateSufficiency } from '../domain/sufficiency';
import { ensureQuestion, ensureTerminalPunctuation } from '../domain/text-utils';
import { parseDateToIso } from '../domain/validators';
import { diffLines } from '../ui/diff';
import { reviewText } from '../domain/review';
import { DEFAULT_PROFILE } from '../config/language-profile';

describe('normalização', () => {
  it('remove ruído sem alterar palavras e preserva parágrafos', () => {
    expect(normalizeText('  Olá\u200B   mundo\t!\r\n\r\n\r\n\r\nNovo   parágrafo  ')).toBe('Olá mundo !\n\nNovo parágrafo');
    expect(normalizeText(undefined)).toBe('');
  });
  it('converte listas e remove marcadores do analista', () => {
    expect(toItems('- um\n2) dois\n• três\n\n  ')).toEqual(['um', 'dois', 'três']);
  });
  it('descarta campos vazios', () => {
    expect(normalizeContext({ summary: '   ', actions: ['', ' '], notes: 'x' })).toEqual({ notes: 'x' });
  });
});

describe('classificação', () => {
  it('separa ações planejadas apenas por marcadores explícitos', () => {
    expect(isPlannedAction('Planejado: trocar o cabo')).toBe(true);
    expect(isPlannedAction('Será feita a troca do cabo')).toBe(true);
    expect(isPlannedAction('Trocado o cabo de rede')).toBe(false);
    const c = classifyContext({ actions: ['Trocado o cabo', 'Próximo passo: testar a porta'] });
    expect(c.actionsDone).toEqual(['Trocado o cabo']);
    expect(c.actionsPlanned).toEqual(['testar a porta']);
  });
  it('prazo só existe quando informado', () => {
    expect(classifyContext({ summary: 'resolver amanhã' }).deadline).toBeUndefined();
    expect(classifyContext({ explicitDeadline: '20/10/2026' }).deadline).toBe('20/10/2026');
  });
  it('datas', () => {
    expect(parseDateToIso('05/10/2026')).toBe('2026-10-05');
    expect(parseDateToIso('2026-10-05')).toBe('2026-10-05');
    expect(parseDateToIso('31/02/2026')).toBeNull();
    expect(parseDateToIso('ontem')).toBeNull();
  });
});

describe('suficiência', () => {
  it('requisito "qualquer um de" é satisfeito por um único campo', () => {
    expect(evaluateSufficiency('technical_note', { observedResult: 'Ok' }).missingRequired).toEqual([]);
    expect(evaluateSufficiency('technical_note', {}).missingRequired).toHaveLength(1);
  });
});

describe('renderização e utilitários', () => {
  it('formata lista com um item inline e vários numerados', () => {
    expect(renderPlan({ sections: [{ kind: 'questions', label: 'Perguntas', items: ['A?'] }] })).toBe('Perguntas: A?');
    expect(renderPlan({ sections: [{ kind: 'questions', label: 'P', items: ['A?', 'B?'] }] })).toBe('P:\n1. A?\n2. B?');
    expect(renderPlan({ sections: [{ kind: 'courtesy', text: 'Obrigado.' }, { kind: 'signature', text: 'Equipe' }] })).toBe('Obrigado.\nEquipe');
  });
  it('pontuação', () => {
    expect(ensureQuestion('Qual o erro.')).toBe('Qual o erro?');
    expect(ensureTerminalPunctuation('Feito')).toBe('Feito.');
    expect(ensureTerminalPunctuation('Feito!')).toBe('Feito!');
  });
  it('diff por linhas', () => {
    expect(diffLines('a\nb\nc', 'a\nc\nd')).toEqual([
      { type: 'same', text: 'a' },
      { type: 'del', text: 'b' },
      { type: 'same', text: 'c' },
      { type: 'add', text: 'd' },
    ]);
  });
  it('revisão de texto editado nunca altera o texto e detecta segredo', () => {
    const text = 'Olá, segue o acesso: senha: Abc@12345';
    const r = reviewText(text, { type: 'progress_update', recipient: 'user', techLevel: 'simple' }, DEFAULT_PROFILE);
    expect(r.blocked).toBe(true);
    expect(text).toBe('Olá, segue o acesso: senha: Abc@12345');
    expect(JSON.stringify(r.warnings)).not.toContain('Abc@12345');
  });
});

describe('mapeamento do formulário', () => {
  it('envia ao motor apenas os campos visíveis do tipo atual', async () => {
    const { initialForm, toGenerationInput } = await import('../application/form');
    const form = { ...initialForm(), type: 'pending' as const, pendingItem: 'Retorno', questions: 'senha: Abc@12345', freeIntent: 'oculto' };
    const input = toGenerationInput(form);
    expect(input.context.pendingItem).toBe('Retorno');
    expect(input.context.questions).toBeUndefined();
    expect(input.context.freeIntent).toBeUndefined();
  });
});
