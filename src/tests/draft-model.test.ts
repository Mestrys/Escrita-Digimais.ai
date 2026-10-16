import { readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { trainDraftModel } from '../domain/draft-train';
import corpus from '../../scripts/data/draft-corpus.json';

const FILE = 'src/config/draft-model.json';

describe('modelo do rascunho livre', () => {
  it('o arquivo versionado é exatamente o resultado do treino sobre o corpus', () => {
    const fresh = JSON.stringify(trainDraftModel(corpus as never)) + '\n';
    if (process.env.UPDATE_MODEL === '1') writeFileSync(FILE, fresh);
    expect(readFileSync(FILE, 'utf8')).toBe(fresh);
  });
});
