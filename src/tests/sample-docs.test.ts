import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DEFAULT_PROFILE } from '../config/language-profile';
import { COMMUNICATION_TYPES } from '../domain/types';
import { FULL_CONTEXTS, gen, NOW, profileWith } from './helpers';

const DOC = 'docs/AMOSTRAS-FORMATO.md';
const OPEN = profileWith({ closureRules: { ...DEFAULT_PROFILE.closureRules, noResponseEnabled: true } });

/** Texto das amostras: um caso fictício por tipo, no perfil padrão. Serve para colar no sistema de chamados real (D6). */
export function buildSamples(): string {
  const parts: string[] = [
    '# Amostras de texto para validar o formato no sistema de chamados',
    '',
    'Arquivo gerado por `src/tests/sample-docs.test.ts` (rode `UPDATE_SAMPLES=1 npx vitest run src/tests/sample-docs.test.ts` para atualizar). Todos os casos são fictícios, no perfil padrão, com data de referência fixa. Use o roteiro em [VALIDACAO-PILOTO.md](VALIDACAO-PILOTO.md).',
    '',
  ];
  COMMUNICATION_TYPES.forEach((type, i) => {
    const recipient = type === 'technical_note' ? 'technical_team' : 'user';
    const profile = type === 'closure_no_response' ? OPEN : DEFAULT_PROFILE;
    const r = gen(type, FULL_CONTEXTS[type], { recipient }, profile);
    parts.push(`## ${i + 1}. ${DEFAULT_PROFILE.categoryNames[type]} (\`${type}\`)`, '');
    parts.push(`Destinatário: ${recipient}. Alertas: ${r.warnings.length === 0 ? 'nenhum' : r.warnings.map((w) => `\`${w.code}\``).join(', ')}.`, '');
    parts.push('```text', r.text.trimEnd(), '```', '');
  });
  return parts.join('\n');
}

describe('amostras de formato (D6)', () => {
  it('geram texto para todos os tipos, sem alerta de bloqueio e sem travessão', () => {
    const doc = buildSamples();
    expect(doc.match(/^## \d+\./gm)).toHaveLength(COMMUNICATION_TYPES.length);
    expect(doc).not.toMatch(/[—–]/);
    expect(doc).not.toMatch(/\bundefined\b|\[object/);
    for (const type of COMMUNICATION_TYPES) {
      const r = gen(type, FULL_CONTEXTS[type], { recipient: type === 'technical_note' ? 'technical_team' : 'user' }, type === 'closure_no_response' ? OPEN : DEFAULT_PROFILE);
      expect(r.blocked, type).toBe(false);
      expect(r.text.trim().length, type).toBeGreaterThan(40);
    }
  });

  it('o arquivo versionado está em dia com o motor', () => {
    const fresh = buildSamples();
    if (process.env.UPDATE_SAMPLES === '1') writeFileSync(DOC, fresh);
    expect(existsSync(DOC)).toBe(true);
    expect(readFileSync(DOC, 'utf8')).toBe(fresh);
  });

  it('usa a data de referência dos testes', () => {
    expect(NOW.getFullYear()).toBe(2026);
  });
});
