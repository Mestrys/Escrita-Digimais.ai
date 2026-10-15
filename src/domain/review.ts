import { fieldLabel } from '../config/fields';
import { detectProfileIssues, detectTextRisks } from './risks';
import type { ReviewContext } from './risks';
import { dedupeWarnings, scoreQuality, sortWarnings } from './quality';
import { CATEGORY_LABELS, scanText } from './sensitive';
import type { LanguageProfile, QualityScore, SensitiveFinding, Warning } from './types';

export function findingsToWarnings(findings: SensitiveFinding[], type?: ReviewContext['type']): Warning[] {
  return findings.map((f) => {
    const where = f.field ? ` em "${fieldLabel(f.field, type)}"` : '';
    return {
      code: `sensitive_${f.category}`,
      severity: f.blocking ? ('block' as const) : ('warning' as const),
      message: `${CATEGORY_LABELS[f.category]}${where}. ${f.reason}`,
      suggestion: f.action,
      field: f.field,
      excerpt: f.maskedExcerpt,
      dimension: 'safety' as const,
      penalty: f.blocking ? 30 : 12,
    };
  });
}

export interface ReviewOptions {
  /** Evita rever dados sensíveis já tratados na entrada (usado na geração). */
  skipSensitive?: boolean;
}

export interface ReviewResult {
  warnings: Warning[];
  quality: QualityScore;
  findings: SensitiveFinding[];
  blocked: boolean;
}

/**
 * Revisão automática de um texto (gerado ou editado pelo analista).
 * Nunca altera o texto; apenas retorna alertas, sugestões e pontuação.
 */
export function reviewText(
  text: string,
  ctx: ReviewContext,
  profile: LanguageProfile,
  options: ReviewOptions = {},
): ReviewResult {
  const findings = options.skipSensitive ? [] : scanText(text, { internalDomains: profile.internalDomains });
  const warnings = sortWarnings(
    dedupeWarnings([
      ...findingsToWarnings(findings, ctx.type),
      ...detectTextRisks(text, ctx, profile),
      ...detectProfileIssues(text, ctx, profile),
    ]),
  );
  return {
    warnings,
    quality: scoreQuality(warnings),
    findings,
    blocked: warnings.some((w) => w.severity === 'block'),
  };
}
