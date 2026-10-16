import { describe, expect, it } from 'vitest';
import { CORPUS } from './sensitive-corpus';
import { BLOCKING_CATEGORIES, formatReport, precisionOf, recallOf, runEval } from './run-eval';

/**
 * Avaliação da detecção de dados sensíveis contra um corpus sintético.
 * Pisos de qualidade: se uma mudança no detector piorar as métricas, o CI falha e o relatório vai na mensagem.
 * Melhorar além do piso é bem-vindo: ajuste os pisos junto com docs/AVALIACAO.md.
 */
const report = runEval();
const text = formatReport(report);

const FLOORS = { precision: 0.9, recall: 0.99, blockingCaseRecall: 1, blockingCategoryRecall: 1, minCases: 100 };

describe('avaliação da detecção de dados sensíveis (corpus sintético)', () => {
  it('o corpus tem tamanho mínimo e cobre todas as categorias do detector', () => {
    expect(CORPUS.length, text).toBeGreaterThanOrEqual(FLOORS.minCases);
    const ids = CORPUS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    const covered = new Set(CORPUS.flatMap((c) => c.expected));
    for (const cat of ['credential', 'token', 'private_key', 'secret', 'connection_string', 'cpf', 'cnpj', 'email', 'phone', 'address', 'card', 'bank', 'ip', 'hostname', 'url', 'path', 'log_block']) {
      expect(covered.has(cat as never), `categoria sem caso positivo: ${cat}`).toBe(true);
    }
    expect(CORPUS.filter((c) => c.kind !== 'positive').length).toBeGreaterThanOrEqual(30);
  });

  it('nenhum segredo bloqueante escapa: todo caso com credencial, token, chave ou string de conexão é bloqueado', () => {
    const blockingCases = report.outcomes.filter((o) => o.case.expected.some((c) => BLOCKING_CATEGORIES.includes(c)));
    expect(blockingCases.length).toBeGreaterThanOrEqual(20);
    const escaped = blockingCases.filter((o) => !o.predicted.some((c) => BLOCKING_CATEGORIES.includes(c)));
    expect(escaped.map((o) => o.case.id), text).toEqual([]);
  });

  it('a revocação por categoria bloqueante não cai', () => {
    for (const cat of BLOCKING_CATEGORIES) {
      const s = report.byCategory[cat];
      expect(s, `sem dados para ${cat}`).toBeDefined();
      expect(recallOf(s!), `${cat}\n${text}`).toBeGreaterThanOrEqual(FLOORS.blockingCategoryRecall);
    }
  });

  it('precisão e revocação globais ficam acima dos pisos', () => {
    expect(report.micro.precision, text).toBeGreaterThanOrEqual(FLOORS.precision);
    expect(report.micro.recall, text).toBeGreaterThanOrEqual(FLOORS.recall);
  });

  it('caso sem falha conhecida deve acertar exatamente; falha conhecida deve continuar registrada', () => {
    const unexpected = report.outcomes.filter((o) => !o.case.gap && (o.missed.length || o.extra.length));
    expect(unexpected.map((o) => o.case.id), text).toEqual([]);
    // Se um gap foi corrigido, remova a marcação do corpus: o relatório fica honesto nos dois sentidos.
    const stale = report.outcomes.filter((o) => o.case.gap && !o.missed.length && !o.extra.length);
    expect(stale.map((o) => o.case.id), 'gap já corrigido: remova a marcação').toEqual([]);
  });

  it('a precisão por categoria é informada (sem categoria com precisão zero)', () => {
    for (const [cat, s] of Object.entries(report.byCategory)) expect(precisionOf(s), cat).toBeGreaterThan(0);
  });
});
