import type { TicketContext, UserConfirmation } from './types';
import { parseDateToIso } from './validators';

/**
 * Classificação do contexto: separa o que o analista informou explicitamente.
 * Nada é inferido além do que está nos campos: prazo só existe se informado,
 * e ações são separadas em concluídas e planejadas por marcadores textuais claros.
 */

export interface ParsedAttempt {
  raw: string;
  iso: string | null;
}

export interface ClassifiedContext {
  summary?: string;
  observedResult?: string;
  pendingItem?: string;
  expectedAction?: string;
  /** Prazo explícito informado pelo analista. */
  deadline?: string;
  notes?: string;
  approvalObject?: string;
  approvalEffect?: string;
  destinationTeam?: string;
  escalationReason?: string;
  freeIntent?: string;
  requesterName?: string;
  actionsDone: string[];
  actionsPlanned: string[];
  evidence: string[];
  questions: string[];
  attempts: ParsedAttempt[];
  priorNotice?: ParsedAttempt;
  userConfirmation: UserConfirmation;
}

const PLANNED_PREFIX = /^\[?\s*(?:planejad[oa]s?|previst[oa]s?|pr[óo]ximo passo|a fazer|agendad[oa]s?)\s*\]?\s*[:.-]?\s*/iu;
const PLANNED_PATTERN =
  /\b(?:ser[áa]o?|vamos|iremos|pretend\w+|planej\w+|agend\w+|a (?:realizar|validar|verificar|testar|executar|enviar)|ser[áa] (?:realizad|feit|enviad|testad)\w*)\b/iu;

export function isPlannedAction(item: string): boolean {
  return PLANNED_PREFIX.test(item) || PLANNED_PATTERN.test(item);
}

function stripPlannedPrefix(item: string): string {
  return item.replace(PLANNED_PREFIX, '').trim();
}

export function classifyContext(context: TicketContext): ClassifiedContext {
  const actionsDone: string[] = [];
  const actionsPlanned: string[] = [];
  for (const item of context.actions ?? []) {
    if (isPlannedAction(item)) actionsPlanned.push(stripPlannedPrefix(item));
    else actionsDone.push(item);
  }
  const parseDate = (raw: string): ParsedAttempt => ({ raw, iso: parseDateToIso(raw) });
  return {
    summary: context.summary,
    observedResult: context.observedResult,
    pendingItem: context.pendingItem,
    expectedAction: context.expectedAction,
    deadline: context.explicitDeadline,
    notes: context.notes,
    approvalObject: context.approvalObject,
    approvalEffect: context.approvalEffect,
    destinationTeam: context.destinationTeam,
    escalationReason: context.escalationReason,
    freeIntent: context.freeIntent,
    requesterName: context.requesterName,
    actionsDone,
    actionsPlanned,
    evidence: context.evidence ?? [],
    questions: context.questions ?? [],
    attempts: (context.contactAttempts ?? []).map(parseDate),
    priorNotice: context.priorNoticeDate ? parseDate(context.priorNoticeDate) : undefined,
    userConfirmation: context.userConfirmation ?? 'unknown',
  };
}
