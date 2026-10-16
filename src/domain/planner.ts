import { BLUEPRINTS, RECORD_SKIPPED, includedAt, isRecordStyle } from '../config/blueprints';
import type { SectionKind } from '../config/blueprints';
import { FIXED_PHRASES, LABEL_OVERRIDES } from '../config/templates';
import type { ResolvedTemplates } from '../config/templates';
import type { ClassifiedContext } from './classify';
import { capitalizeFirst, ensureQuestion, ensureTerminalPunctuation, stripTerminalPunctuation } from './text-utils';
import type { GenerationSettings, LabelKey, LanguageProfile } from './types';
import { isoToBr } from './validators';

/**
 * Planejamento da mensagem: decide quais seções existem e com qual conteúdo.
 * Não escreve texto corrido; a renderização apenas formata o plano.
 */

export interface PlannedSection {
  kind: SectionKind;
  label?: string;
  text?: string;
  items?: string[];
}

export interface MessagePlan {
  sections: PlannedSection[];
}

const LABEL_KEY: Partial<Record<SectionKind, LabelKey>> = {
  context: 'context',
  justification: 'justification',
  actions_done: 'actions_done',
  actions_planned: 'actions_planned',
  result: 'result',
  pending: 'pending',
  depends_on: 'depends_on',
  questions: 'questions',
  approval_object: 'approval_object',
  approval_effect: 'approval_effect',
  expected_action: 'expected_action',
  deadline: 'deadline',
  evidence: 'evidence',
  notes: 'notes',
  attempts: 'attempts',
  reason: 'reason',
};

function pick(list: readonly string[], variant: number): string | undefined {
  if (list.length === 0) return undefined;
  return list[((variant % list.length) + list.length) % list.length];
}

/**
 * Escolhe um índice de variação independente para cada seção (sistema posicional misto).
 * A variação 0 usa o primeiro item de todas as listas. Cada incremento avança a primeira lista que
 * ainda tem opções e "vai um" para a seguinte, então N listas de tamanhos a, b, c geram a x b x c textos
 * distintos antes de repetir, sempre de forma determinística.
 */
export function variantIndexes(variant: number, sizes: readonly number[]): number[] {
  const total = sizes.reduce((acc, n) => (n > 1 ? acc * n : acc), 1);
  let rest = ((Math.trunc(variant) % total) + total) % total;
  return sizes.map((n) => {
    if (n <= 1) return 0;
    const digit = rest % n;
    rest = Math.floor(rest / n);
    return digit;
  });
}

function sentence(text: string): string {
  return ensureTerminalPunctuation(capitalizeFirst(text));
}

export function fillPlaceholders(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_whole, key: string) => vars[key] ?? '');
}

export function buildPlan(
  settings: GenerationSettings,
  c: ClassifiedContext,
  profile: LanguageProfile,
  templates: ResolvedTemplates,
): MessagePlan {
  const { type, recipient, formality, techLevel, length } = settings;
  const variant = settings.variant ?? 0;
  const openingPool = templates.openings[type][formality];
  const typeClosingPool = templates.typeClosings[type][formality];
  const courtesyPool = profile.closings[formality];
  const [openingIdx, typeClosingIdx, courtesyIdx] = variantIndexes(variant, [
    openingPool.length,
    typeClosingPool.length,
    courtesyPool.length,
  ]);
  const record = isRecordStyle(type, recipient);
  const vars = { organization: profile.organizationName, destination: c.destinationTeam ?? '' };
  const labels = { ...templates.labels[techLevel], ...(LABEL_OVERRIDES[type] ?? {}) };

  const content = (kind: SectionKind): Pick<PlannedSection, 'text' | 'items'> | undefined => {
    switch (kind) {
      case 'greeting':
        return { text: profile.greetings[formality][recipient] };
      case 'opening': {
        const t = pick(openingPool, openingIdx);
        return t ? { text: fillPlaceholders(t, vars) } : undefined;
      }
      case 'intent':
        return c.freeIntent ? { text: sentence(c.freeIntent) } : undefined;
      case 'context':
      case 'justification':
        return c.summary ? { text: sentence(c.summary) } : undefined;
      case 'actions_done':
        return c.actionsDone.length ? { items: c.actionsDone.map(sentence) } : undefined;
      case 'actions_planned':
        return c.actionsPlanned.length ? { items: c.actionsPlanned.map(sentence) } : undefined;
      case 'result':
        return c.observedResult ? { text: sentence(c.observedResult) } : undefined;
      case 'pending':
        return c.pendingItem ? { text: sentence(c.pendingItem) } : undefined;
      case 'depends_on':
        return recipient === 'other' ? undefined : { text: profile.recipients[recipient].displayName };
      case 'questions':
        return c.questions.length ? { items: c.questions.map((q) => ensureQuestion(capitalizeFirst(q))) } : undefined;
      case 'approval_object':
        return c.approvalObject ? { text: sentence(c.approvalObject) } : undefined;
      case 'approval_effect':
        return c.approvalEffect ? { text: sentence(c.approvalEffect) } : undefined;
      case 'approval_response': {
        const t = pick(FIXED_PHRASES.approval_response[formality], variant);
        return t ? { text: t } : undefined;
      }
      case 'expected_action':
        return c.expectedAction ? { text: sentence(c.expectedAction) } : undefined;
      case 'deadline':
        return c.deadline ? { text: stripTerminalPunctuation(c.deadline) } : undefined;
      case 'evidence':
        return c.evidence.length ? { items: c.evidence.map(sentence) } : undefined;
      case 'notes':
        return c.notes ? { text: sentence(c.notes) } : undefined;
      case 'attempts': {
        const dates = [...new Set(c.attempts.map((a) => a.iso).filter((v): v is string => v !== null))].sort();
        return dates.length ? { items: dates.map(isoToBr) } : undefined;
      }
      case 'notice': {
        const iso = c.priorNotice?.iso;
        return iso ? { text: FIXED_PHRASES.notice.replace('{date}', isoToBr(iso)) } : undefined;
      }
      case 'no_response_meaning':
        return { text: FIXED_PHRASES.no_response_meaning };
      case 'user_confirmation':
        return { text: c.userConfirmation === 'yes' ? FIXED_PHRASES.user_confirmed : FIXED_PHRASES.user_not_confirmed };
      case 'reason':
        return c.escalationReason ? { text: sentence(c.escalationReason) } : undefined;
      case 'privacy':
        return profile.privacyNotice.text && profile.privacyNotice.types.includes(type)
          ? { text: fillPlaceholders(profile.privacyNotice.text, vars) }
          : undefined;
      case 'type_closing': {
        const t = pick(typeClosingPool, typeClosingIdx);
        return t ? { text: fillPlaceholders(t, vars) } : undefined;
      }
      case 'reopen':
        return profile.closureRules.reopenInstruction ? { text: profile.closureRules.reopenInstruction } : undefined;
      case 'required': {
        const texts = profile.requiredTexts
          .filter((r) => r.types.length === 0 || r.types.includes(type))
          .map((r) => fillPlaceholders(r.text, vars));
        return texts.length ? { text: [...new Set(texts)].join('\n') } : undefined;
      }
      case 'courtesy': {
        const t = pick(courtesyPool, courtesyIdx);
        return t ? { text: fillPlaceholders(t, vars) } : undefined;
      }
      case 'signature':
        return profile.signature ? { text: fillPlaceholders(profile.signature, vars).trim() } : undefined;
    }
  };

  const sections: PlannedSection[] = [];
  for (const [kind, min] of BLUEPRINTS[type]) {
    if (!includedAt(min, length)) continue;
    if (record && RECORD_SKIPPED.includes(kind)) continue;
    const body = content(kind);
    if (!body) continue;
    const key = LABEL_KEY[kind];
    sections.push({ kind, label: key ? labels[key] : undefined, ...body });
  }
  return { sections };
}
