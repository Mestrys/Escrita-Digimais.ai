import { DRAFT_CLASSES } from '../config/draft-rules';
import type { DraftClass } from '../config/draft-rules';
import { stripAccents } from './text-utils';

/** Palavras do trecho em minúsculas e sem acento, sem números soltos. Usado no treino e na classificação. */
export function draftTokens(text: string): string[] {
  return (stripAccents(text.toLocaleLowerCase('pt-BR')).match(/[a-z]{2,}/g) ?? []).filter((w) => w.length <= 24);
}

export interface DraftModel {
  version: 1;
  classes: DraftClass[];
  /** Log da probabilidade a priori de cada classe. */
  prior: number[];
  /** Log da verossimilhança por classe, para palavras vistas no treino. */
  vocab: Record<string, number[]>;
}

type Corpus = Record<DraftClass, string[]>;

const round = (n: number): number => Math.round(n * 1000) / 1000;

/**
 * Naive Bayes multinomial com suavização de Laplace. Determinístico: mesma entrada, mesmo arquivo.
 * Palavras que aparecem em uma só frase são descartadas para o modelo não decorar o corpus.
 */
export function trainDraftModel(corpus: Corpus): DraftModel {
  const counts = new Map<string, number[]>();
  const docFreq = new Map<string, number>();
  const totals = DRAFT_CLASSES.map(() => 0);
  const docs = DRAFT_CLASSES.map(() => 0);
  DRAFT_CLASSES.forEach((cls, ci) => {
    for (const sentence of corpus[cls]) {
      docs[ci] = (docs[ci] ?? 0) + 1;
      const tokens = draftTokens(sentence);
      for (const w of new Set(tokens)) docFreq.set(w, (docFreq.get(w) ?? 0) + 1);
      for (const w of tokens) {
        const row = counts.get(w) ?? DRAFT_CLASSES.map(() => 0);
        row[ci] = (row[ci] ?? 0) + 1;
        counts.set(w, row);
      }
    }
  });
  const kept = [...counts.keys()].filter((w) => (docFreq.get(w) ?? 0) >= 2).sort();
  const keptSet = new Set(kept);
  DRAFT_CLASSES.forEach((_, ci) => {
    let total = 0;
    for (const [w, row] of counts) if (keptSet.has(w)) total += row[ci] ?? 0;
    totals[ci] = total;
  });
  const V = kept.length + 1;
  const totalDocs = docs.reduce((a, b) => a + b, 0);
  const vocab: Record<string, number[]> = {};
  for (const w of kept) {
    const row = counts.get(w) ?? [];
    vocab[w] = DRAFT_CLASSES.map((_, ci) => round(Math.log(((row[ci] ?? 0) + 1) / ((totals[ci] ?? 0) + V))));
  }
  return {
    version: 1,
    classes: [...DRAFT_CLASSES],
    prior: DRAFT_CLASSES.map((_, ci) => round(Math.log((docs[ci] ?? 0) / totalDocs))),
    vocab,
  };
}
