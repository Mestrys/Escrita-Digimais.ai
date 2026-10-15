import type { QualityDimension, QualityScore, Severity, TriggeredRule, Warning } from './types';

const DEFAULT_PENALTY: Record<Severity, number> = { info: 3, warning: 10, block: 25 };

const DIMENSIONS: QualityDimension[] = ['clarity', 'objectivity', 'cordiality', 'completeness', 'safety'];

/**
 * Indicadores locais de 0 a 100. São heurísticos: cada pontuação parte de 100 e perde
 * pontos pelas regras acionadas, que ficam listadas em `triggeredRules` com sugestões.
 */
export function scoreQuality(warnings: Warning[]): QualityScore {
  const scores: Record<QualityDimension, number> = {
    clarity: 100,
    objectivity: 100,
    cordiality: 100,
    completeness: 100,
    safety: 100,
  };
  const triggeredRules: TriggeredRule[] = [];
  for (const w of warnings) {
    const dimension = w.dimension ?? 'clarity';
    const penalty = w.penalty ?? DEFAULT_PENALTY[w.severity];
    scores[dimension] = Math.max(0, scores[dimension] - penalty);
    triggeredRules.push({
      code: w.code,
      dimension,
      penalty,
      severity: w.severity,
      message: w.message,
      suggestion: w.suggestion,
    });
  }
  return { ...scores, triggeredRules };
}

export function emptyQuality(): QualityScore {
  return { clarity: 100, objectivity: 100, cordiality: 100, completeness: 100, safety: 100, triggeredRules: [] };
}

export function dimensions(): QualityDimension[] {
  return [...DIMENSIONS];
}

export function dedupeWarnings(warnings: Warning[]): Warning[] {
  const seen = new Set<string>();
  const out: Warning[] = [];
  for (const w of warnings) {
    const key = `${w.code}|${w.field ?? ''}|${w.excerpt ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(w);
  }
  return out;
}

const ORDER: Record<Severity, number> = { block: 0, warning: 1, info: 2 };
export function sortWarnings(warnings: Warning[]): Warning[] {
  return [...warnings].sort((a, b) => ORDER[a.severity] - ORDER[b.severity]);
}
