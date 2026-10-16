import { scanText } from '../../domain/sensitive';
import type { SensitiveCategory } from '../../domain/types';
import { CORPUS, INTERNAL_DOMAINS } from './sensitive-corpus';
import type { EvalCase } from './sensitive-corpus';

export interface CaseOutcome {
  case: EvalCase;
  predicted: SensitiveCategory[];
  missed: SensitiveCategory[];
  extra: SensitiveCategory[];
}

export interface CategoryStats {
  tp: number;
  fp: number;
  fn: number;
}

export interface EvalReport {
  outcomes: CaseOutcome[];
  byCategory: Partial<Record<SensitiveCategory, CategoryStats>>;
  micro: CategoryStats & { precision: number; recall: number };
}

export const BLOCKING_CATEGORIES: SensitiveCategory[] = ['credential', 'token', 'private_key', 'secret', 'connection_string'];

const ratio = (a: number, b: number): number => (b === 0 ? 1 : a / b);
export const precisionOf = (s: CategoryStats): number => ratio(s.tp, s.tp + s.fp);
export const recallOf = (s: CategoryStats): number => ratio(s.tp, s.tp + s.fn);

/** Avalia o detector contra o corpus, comparando conjuntos de categorias por caso. */
export function runEval(cases: EvalCase[] = CORPUS): EvalReport {
  const byCategory: EvalReport['byCategory'] = {};
  const stat = (c: SensitiveCategory): CategoryStats => (byCategory[c] ??= { tp: 0, fp: 0, fn: 0 });
  const outcomes: CaseOutcome[] = cases.map((c) => {
    const predicted = [...new Set(scanText(c.text, { internalDomains: INTERNAL_DOMAINS }).map((f) => f.category))];
    const missed = c.expected.filter((x) => !predicted.includes(x));
    const extra = predicted.filter((x) => !c.expected.includes(x));
    for (const x of c.expected) {
      if (predicted.includes(x)) stat(x).tp += 1;
      else stat(x).fn += 1;
    }
    for (const x of extra) stat(x).fp += 1;
    return { case: c, predicted, missed, extra };
  });
  const micro = { tp: 0, fp: 0, fn: 0 };
  for (const s of Object.values(byCategory)) {
    micro.tp += s.tp;
    micro.fp += s.fp;
    micro.fn += s.fn;
  }
  return { outcomes, byCategory, micro: { ...micro, precision: precisionOf(micro), recall: recallOf(micro) } };
}

export function formatReport(report: EvalReport): string {
  const rows = Object.entries(report.byCategory)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([cat, s]) => `${cat.padEnd(18)} TP ${String(s.tp).padStart(3)}  FP ${String(s.fp).padStart(3)}  FN ${String(s.fn).padStart(3)}  P ${(precisionOf(s) * 100).toFixed(0).padStart(3)}%  R ${(recallOf(s) * 100).toFixed(0).padStart(3)}%`);
  const wrong = report.outcomes
    .filter((o) => o.missed.length || o.extra.length)
    .map((o) => `  ${o.case.id}: esperado [${o.case.expected.join(', ')}], obtido [${o.predicted.join(', ')}]${o.case.gap ? ` (gap conhecido: ${o.case.gap})` : ''}`);
  return [
    `Casos: ${report.outcomes.length}`,
    ...rows,
    `GLOBAL             TP ${report.micro.tp}  FP ${report.micro.fp}  FN ${report.micro.fn}  P ${(report.micro.precision * 100).toFixed(1)}%  R ${(report.micro.recall * 100).toFixed(1)}%`,
    wrong.length ? 'Divergências:' : 'Sem divergências.',
    ...wrong,
  ].join('\n');
}
