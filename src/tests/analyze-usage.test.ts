import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { emptyCounters, exportCounters, increment } from '../application/usage-counters';

const SCRIPT = join(process.cwd(), 'scripts', 'analyze-usage.mjs');
let dir = '';

const file = (name: string, content: unknown): string => {
  const p = join(dir, name);
  writeFileSync(p, typeof content === 'string' ? content : JSON.stringify(content));
  return p;
};
const run = (...args: string[]): string => execFileSync('node', [SCRIPT, ...args], { encoding: 'utf8' });

beforeAll(() => { dir = mkdtempSync(join(tmpdir(), 'usage-')); });
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const person = (generated: number, blocked: number, since: string, until: string, extra: Record<string, number> = {}) => ({
  desde: since,
  exportadoEm: until,
  contadores: {
    'generate.request_information': generated,
    ...(blocked ? { 'blocked.sensitive_data': blocked } : {}),
    copy: Math.floor(generated / 2),
    variant: 3,
    'time_to_copy.lt1m': 4,
    'alert.all_caps_emphasis': 6,
    ...extra,
  },
});

describe('análise do piloto', () => {
  it('calcula taxas e aplica o critério de corte por pessoa', () => {
    const a = file('a.json', person(36, 4, '2026-10-01', '2026-10-20'));
    const b = file('b.json', person(10, 0, '2026-10-10', '2026-10-20'));
    const out = run(a, b);
    expect(out).toContain('| a.json | 36 | 4 | 19 | sim |');
    expect(out).toContain('| b.json | 10 | 0 | 10 | não |');
    expect(out).toContain('Atendem ao corte: 1 de 2.');
    expect(out).toContain('taxa de bloqueio 8.0%');
    expect(out).toContain('Decida D8 e D9 apenas com os 1 arquivo(s)');
    expect(out).toContain('| all_caps_emphasis | 12 |');
  });

  it('sem arquivos no corte, manda estender o piloto; com todos, libera', () => {
    expect(run(file('c.json', person(5, 0, '2026-10-18', '2026-10-20')))).toContain('não decida D8 e D9 ainda');
    expect(run(file('d.json', person(40, 0, '2026-09-01', '2026-10-20')))).toContain('Todos os arquivos atendem ao corte');
  });

  it('os limites do corte são configuráveis', () => {
    const f = file('e.json', person(8, 0, '2026-10-15', '2026-10-20'));
    expect(run(f, '--min-geracoes=5', '--min-dias=3')).toContain('Atendem ao corte: 1 de 1.');
  });

  it('ignora chaves fora da lista fechada e valores que não são inteiros', () => {
    const f = file('f.json', person(40, 0, '2026-09-01', '2026-10-20', { 'Maria Silva abriu o chamado 123': 9, 'generate.x': 2.5, 'alert.Texto Livre': 1 }));
    const out = run(f);
    expect(out).toContain('Chaves ignoradas por não pertencerem à lista fechada: 3.');
    expect(out).not.toContain('Maria');
  });

  it('data ausente ou inválida impede o corte em vez de supor', () => {
    const f = file('g.json', { contadores: { 'generate.request_information': 90 } });
    expect(run(f)).toContain('| g.json | 90 | 0 | n/d | não |');
  });

  it('erros de uso e de leitura saem com código diferente de zero', () => {
    expect(spawnSync('node', [SCRIPT]).status).toBe(2);
    expect(spawnSync('node', [SCRIPT, file('h.json', '{ruim')]).status).toBe(1);
    expect(spawnSync('node', [SCRIPT, join(dir, 'nao-existe.json')]).status).toBe(1);
  });

  it('lê o arquivo exatamente como a extensão exporta', () => {
    let c = emptyCounters('2026-10-01');
    for (let i = 0; i < 31; i += 1) c = increment(c, 'generate.progress_update');
    c = increment(c, 'copy');
    const f = file('i.json', exportCounters(c, new Date('2026-10-20T12:00:00Z')));
    const out = run(f);
    expect(out).toContain('| i.json | 31 | 0 | 19 | sim |');
    expect(out).toContain('Cópias por geração: 3.2%');
  });
});
