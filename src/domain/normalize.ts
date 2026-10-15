import type { ContextField, TicketContext } from './types';

const ZERO_WIDTH = /[\u200B-\u200D\u2060\uFEFF]/g;
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

/**
 * Normalização conservadora: remove ruído de espaçamento e caracteres invisíveis,
 * preserva parágrafos e não altera palavras nem pontuação.
 */
export function normalizeText(value: string | undefined): string {
  if (!value) return '';
  return value
    .replace(/\r\n?/g, '\n')
    .replace(ZERO_WIDTH, '')
    .replace(CONTROL, '')
    .replace(/\t/g, ' ')
    .replace(/[ \u00A0]+/g, ' ')
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const LIST_MARKER = /^\s*(?:[-*•·]|[–—]|\d{1,3}[.)])\s+/u;

/** Converte um texto multilinha (ou lista) em itens, removendo marcadores de lista do analista. */
export function toItems(value: string | string[] | undefined): string[] {
  if (value === undefined) return [];
  const raw = Array.isArray(value) ? value : value.split('\n');
  return raw
    .map((line) => normalizeText(line).replace(LIST_MARKER, '').trim())
    .filter((line) => line.length > 0);
}

const TEXT_FIELDS: ContextField[] = [
  'summary',
  'observedResult',
  'pendingItem',
  'expectedAction',
  'explicitDeadline',
  'notes',
  'approvalObject',
  'approvalEffect',
  'priorNoticeDate',
  'destinationTeam',
  'escalationReason',
  'freeIntent',
];
const LIST_FIELDS: ContextField[] = ['actions', 'evidence', 'questions', 'contactAttempts'];

export function normalizeContext(context: TicketContext): TicketContext {
  const out: Record<string, unknown> = {};
  for (const field of TEXT_FIELDS) {
    const v = normalizeText(context[field] as string | undefined);
    if (v) out[field] = v;
  }
  for (const field of LIST_FIELDS) {
    const items = toItems(context[field] as string[] | undefined);
    if (items.length) out[field] = items;
  }
  if (context.userConfirmation) out.userConfirmation = context.userConfirmation;
  return out as TicketContext;
}

export function hasValue(context: TicketContext, field: ContextField): boolean {
  const v = context[field];
  if (Array.isArray(v)) return v.length > 0;
  return typeof v === 'string' ? v.trim().length > 0 : v !== undefined;
}

export function totalChars(context: TicketContext): number {
  let total = 0;
  for (const value of Object.values(context)) {
    if (typeof value === 'string') total += value.length;
    else if (Array.isArray(value)) total += value.reduce((n, v) => n + String(v).length, 0);
  }
  return total;
}
