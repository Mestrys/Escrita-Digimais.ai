import { DRAFT_CLASSES, DRAFT_RULES, INTERROGATIVE_START, MAX_DRAFT_SEGMENTS, MIN_SEGMENT_CHARS, REASONS } from '../config/draft-rules';
import type { DraftClass } from '../config/draft-rules';
import model from '../config/draft-model.json';
import { isPlannedAction } from './classify';
import { draftTokens } from './draft-train';
import type { DraftModel } from './draft-train';
import { normalizeText, toItems } from './normalize';
import { capitalizeFirst, ensureTerminalPunctuation, stripTerminalPunctuation } from './text-utils';

/**
 * Rascunho livre: separa uma anotação bruta em trechos e sugere em qual campo cada um entra.
 * É apenas uma sugestão: nada preenche o formulário sem o analista conferir a divisão. Nenhum texto é guardado.
 * Funciona em duas camadas: regras de palavras (decidem a maioria) e um classificador estatístico pequeno,
 * embarcado no pacote, que desempata. Sem rede, sem aleatoriedade.
 */

const MODEL = model as DraftModel;

export interface DraftSegment {
  text: string;
  predicted: DraftClass;
  /** Ação ainda por fazer (vira "Planejado:" no campo de ações). */
  planned: boolean;
  /** Heurística de 0 a 1 baseada na distância entre as duas melhores classes. Não é probabilidade calibrada. */
  confidence: number;
  reason: string;
}

export type DraftBias = Partial<Record<DraftClass, number>>;

const SENTENCE_BOUNDARY = /(?<=[.!?;])\s+/u;

/** Divide a anotação em trechos curtos: um por linha e por frase, sem marcadores de lista. */
export function segmentDraft(raw: string): string[] {
  const out: string[] = [];
  for (const line of toItems(normalizeText(raw))) {
    for (const part of line.split(SENTENCE_BOUNDARY)) {
      const text = part.trim().replace(/[.;,]+$/u, '').trim();
      if (text.length >= MIN_SEGMENT_CHARS && /\p{L}/u.test(text)) out.push(text);
      if (out.length >= MAX_DRAFT_SEGMENTS) return out;
    }
  }
  return out;
}

/** Futuro na primeira pessoa, comum em anotação ('vou validar amanhã'); o motor não o trata como planejado. */
const FIRST_PERSON_FUTURE = /\b(?:vou|irei|farei|vamos|iremos|faremos)\b/iu;

function isQuestion(text: string): boolean {
  return /\?\s*["”')\]]?$/u.test(text) || INTERROGATIVE_START.test(text);
}

function scoreAll(text: string, index: number, bias: DraftBias): { scores: number[]; ruleBoost: number[] } {
  const tokens = draftTokens(text);
  const scores = MODEL.classes.map((_, ci) => MODEL.prior[ci] ?? 0);
  for (const w of tokens) {
    const row = MODEL.vocab[w];
    if (row) row.forEach((v, ci) => { scores[ci] = (scores[ci] ?? 0) + v; });
  }
  const ruleBoost = DRAFT_CLASSES.map(() => 0);
  for (const rule of DRAFT_RULES) {
    if (rule.pattern.test(text)) {
      const ci = DRAFT_CLASSES.indexOf(rule.cls);
      ruleBoost[ci] = (ruleBoost[ci] ?? 0) + rule.weight;
    }
  }
  if (index === 0) ruleBoost[DRAFT_CLASSES.indexOf('summary')] = (ruleBoost[DRAFT_CLASSES.indexOf('summary')] ?? 0) + 1.5;
  DRAFT_CLASSES.forEach((cls, ci) => {
    scores[ci] = (scores[ci] ?? 0) + (ruleBoost[ci] ?? 0) + (bias[cls] ?? 0);
  });
  return { scores, ruleBoost };
}

const argmax = (xs: number[]): number => xs.reduce((best, v, i) => (v > (xs[best] ?? -Infinity) ? i : best), 0);

function classifyOne(text: string, index: number, bias: DraftBias): DraftSegment {
  if (isQuestion(text)) return { text, predicted: 'question', planned: false, confidence: 0.95, reason: REASONS.question };
  if (isPlannedAction(text) || FIRST_PERSON_FUTURE.test(text)) return { text, predicted: 'action', planned: true, confidence: 0.9, reason: REASONS.planned };

  const { scores, ruleBoost } = scoreAll(text, index, bias);
  const best = argmax(scores);
  const sorted = [...scores].sort((a, b) => b - a);
  const margin = (sorted[0] ?? 0) - (sorted[1] ?? 0);
  const length = Math.max(1, draftTokens(text).length);
  const confidence = Math.round((1 / (1 + Math.exp(-margin / (1 + 0.25 * length)))) * 100) / 100;

  const withoutBias = scoreAll(text, index, {}).scores;
  let reason: string = REASONS.model;
  if (argmax(withoutBias) !== best) reason = REASONS.learned;
  else if ((ruleBoost[best] ?? 0) >= 3) reason = REASONS.rule;
  else if (index === 0 && DRAFT_CLASSES[best] === 'summary') reason = REASONS.first;
  return { text, predicted: DRAFT_CLASSES[best] ?? 'summary', planned: false, confidence, reason };
}

export function classifyDraft(raw: string, bias: DraftBias = {}): DraftSegment[] {
  return segmentDraft(raw).map((text, i) => classifyOne(text, i, bias));
}

/** Abaixo disso o trecho é marcado para o analista revisar com atenção. */
export const LOW_CONFIDENCE = 0.6;

export type DraftTarget = DraftClass | 'notes' | 'ignore';

export interface DraftAssignment {
  text: string;
  target: DraftTarget;
  planned: boolean;
}

export interface DraftFields {
  summary?: string;
  actions?: string;
  observedResult?: string;
  pendingItem?: string;
  expectedAction?: string;
  questions?: string;
  notes?: string;
}

const PLANNED_PREFIX = /^\[?\s*(?:planejad[oa]s?|previst[oa]s?|pr[óo]ximo passo|a fazer|agendad[oa]s?)\s*\]?\s*[:.-]?\s*/iu;

const sentenceJoin = (parts: string[]): string =>
  parts.map((p) => ensureTerminalPunctuation(capitalizeFirst(p))).join(' ');

/** Monta o texto de cada campo a partir da conferência do analista. Não altera o conteúdo dos trechos. */
export function assembleDraft(items: readonly DraftAssignment[]): DraftFields {
  const by = (t: DraftTarget): DraftAssignment[] => items.filter((i) => i.target === t);
  const out: DraftFields = {};
  const summary = by('summary').map((i) => i.text);
  if (summary.length) out.summary = sentenceJoin(summary);
  const actions = by('action').map((i) =>
    i.planned ? `Planejado: ${stripTerminalPunctuation(i.text.replace(PLANNED_PREFIX, ''))}` : stripTerminalPunctuation(i.text),
  );
  if (actions.length) out.actions = actions.join('\n');
  const result = by('result').map((i) => i.text);
  if (result.length) out.observedResult = sentenceJoin(result);
  const pending = by('pending').map((i) => i.text);
  if (pending.length) out.pendingItem = sentenceJoin(pending);
  const expected = by('expected').map((i) => i.text);
  if (expected.length) out.expectedAction = sentenceJoin(expected);
  const questions = by('question').map((i) => stripTerminalPunctuation(i.text));
  if (questions.length) out.questions = questions.join('\n');
  const notes = by('notes').map((i) => i.text);
  if (notes.length) out.notes = sentenceJoin(notes);
  return out;
}
