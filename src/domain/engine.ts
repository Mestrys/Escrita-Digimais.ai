import { DEFAULT_PROFILE } from '../config/language-profile';
import { ENGINE_ID, MAX_FIELD_CHARS, MAX_LIST_ITEMS, MAX_TOTAL_CHARS, TEMPLATES_VERSION } from '../config/limits';
import { resolveTemplates } from '../config/templates';
import { classifyContext } from './classify';
import { normalizeContext, totalChars } from './normalize';
import { buildPlan } from './planner';
import { checkPolicy } from './policy';
import { dedupeWarnings, scoreQuality, sortWarnings } from './quality';
import { renderPlan } from './renderer';
import { findingsToWarnings, reviewText } from './review';
import { maskContext, scanContext } from './sensitive';
import { evaluateSufficiency, recommendedWarnings } from './sufficiency';
import type {
  BlockReason,
  ContextField,
  GenerationInput,
  GenerationResult,
  LanguageProfile,
  SensitiveFinding,
  TicketContext,
  Warning,
} from './types';

export interface EngineOptions {
  /** Relógio injetável para regras baseadas em data. */
  now?: Date;
}

function meta(profile: LanguageProfile): GenerationResult['meta'] {
  return { engine: ENGINE_ID, profileVersion: profile.profileVersion, templatesVersion: TEMPLATES_VERSION };
}

function blocked(
  reason: BlockReason,
  warnings: Warning[],
  profile: LanguageProfile,
  extra: Partial<Pick<GenerationResult, 'missingInformation' | 'missingFields' | 'sensitiveFindings'>> = {},
): GenerationResult {
  const sorted = sortWarnings(dedupeWarnings(warnings));
  return {
    text: '',
    warnings: sorted,
    missingInformation: extra.missingInformation ?? [],
    missingFields: extra.missingFields ?? [],
    quality: scoreQuality(sorted),
    blocked: true,
    blockReason: reason,
    sensitiveFindings: extra.sensitiveFindings ?? [],
    meta: meta(profile),
  };
}

function oversize(context: TicketContext): string | null {
  if (totalChars(context) > MAX_TOTAL_CHARS) return 'O conteúdo total é grande demais.';
  for (const [key, value] of Object.entries(context)) {
    if (typeof value === 'string' && value.length > MAX_FIELD_CHARS) return `O campo "${key}" excede ${MAX_FIELD_CHARS} caracteres.`;
    if (Array.isArray(value)) {
      if (value.length > MAX_LIST_ITEMS) return `O campo "${key}" tem itens demais.`;
      if (value.some((v) => String(v).length > MAX_FIELD_CHARS)) return `Um item de "${key}" excede ${MAX_FIELD_CHARS} caracteres.`;
    }
  }
  return null;
}

/**
 * Pipeline determinístico: normalização, detecção de dados sensíveis, classificação,
 * suficiência, política, planejamento, renderização e revisão. Sem rede, sem aleatoriedade.
 */
export function generate(
  input: GenerationInput,
  profile: LanguageProfile = DEFAULT_PROFILE,
  options: EngineOptions = {},
): GenerationResult {
  const now = options.now ?? new Date();
  const { settings } = input;

  // 1. Normalização
  const normalized = normalizeContext(input.context);

  const tooLong = oversize(normalized);
  if (tooLong) {
    return blocked(
      'input_too_long',
      [
        {
          code: 'input_too_long',
          severity: 'block',
          message: tooLong,
          suggestion: 'Resuma o conteúdo. A extensão processa somente o necessário para gerar o texto.',
          dimension: 'objectivity',
          penalty: 25,
        },
      ],
      profile,
    );
  }

  // 2. Dados sensíveis (antes de qualquer outra etapa)
  const findings: SensitiveFinding[] = scanContext(normalized, profile.internalDomains);
  const sensitiveWarnings = findingsToWarnings(findings, settings.type).map((w, i) => {
    const f = findings[i];
    return f?.replaceable && !f.blocking
      ? { ...w, suggestion: `${w.suggestion} O trecho foi omitido na prévia com um marcador; o campo original continua intacto.` }
      : w;
  });
  if (findings.some((f) => f.blocking)) {
    return blocked('sensitive_data', sensitiveWarnings, profile, { sensitiveFindings: findings });
  }
  const masked = maskContext(normalized, findings);

  // 3. Suficiência
  const sufficiency = evaluateSufficiency(settings.type, masked);
  if (sufficiency.missingRequired.length) {
    const missingFields = sufficiency.missingRequired.map((m) => m.fields[0]).filter((f): f is ContextField => Boolean(f));
    return blocked(
      'missing_information',
      [
        ...sensitiveWarnings,
        ...sufficiency.missingRequired.map((m) => ({
          code: 'missing_required',
          severity: 'block' as const,
          message: m.question,
          field: m.fields[0],
          dimension: 'completeness' as const,
          penalty: 15,
        })),
      ],
      profile,
      {
        missingInformation: sufficiency.missingRequired.map((m) => m.question),
        missingFields,
        sensitiveFindings: findings,
      },
    );
  }

  // 4. Classificação e política
  const classified = classifyContext(masked);
  const policy = checkPolicy(settings.type, classified, profile, now);
  if (policy.blockReason) {
    return blocked(policy.blockReason, [...sensitiveWarnings, ...policy.warnings], profile, { sensitiveFindings: findings });
  }

  // 5. Planejamento e renderização
  const plan = buildPlan(settings, classified, profile, resolveTemplates(profile.templates));
  const text = renderPlan(plan);

  // 6. Revisão do texto gerado
  const review = reviewText(
    text,
    {
      type: settings.type,
      recipient: settings.recipient,
      techLevel: settings.techLevel,
      explicitDeadline: classified.deadline,
      hasEvidence: classified.evidence.length > 0,
      userConfirmation: classified.userConfirmation,
      pendingItem: classified.pendingItem,
    },
    profile,
    { skipSensitive: true },
  );

  const warnings = sortWarnings(
    dedupeWarnings([...sensitiveWarnings, ...policy.warnings, ...recommendedWarnings(sufficiency), ...review.warnings]),
  );
  if (warnings.some((w) => w.severity === 'block')) {
    return blocked('unsafe_content', warnings, profile, { sensitiveFindings: findings });
  }

  return {
    text,
    warnings,
    missingInformation: [],
    missingFields: [],
    quality: scoreQuality(warnings),
    blocked: false,
    sensitiveFindings: findings,
    meta: meta(profile),
  };
}
