import { describe, expect, it } from 'vitest';
import {
  effectiveUsageMode, emptyCounters, exportCounters, FIXED_KEYS, generationKeys, increment, isCounterKey, MAX_ALERT_KEYS,
  sanitizeCounters, timeBucket, UsageRecorder,
} from '../application/usage-counters';
import type { UsageCounters } from '../application/usage-counters';
import { COMMUNICATION_TYPES } from '../domain/types';
import { AppStorage, STORAGE_KEYS } from '../infrastructure/storage';
import { MemoryArea } from './memory-storage';

const TODAY = '2026-10-15';

describe('contadores de uso: chaves e sanitização', () => {
  it('aceita só chaves da lista fechada e códigos de alerta bem formados', () => {
    for (const t of COMMUNICATION_TYPES) expect(isCounterKey(`generate.${t}`)).toBe(true);
    expect(isCounterKey('copy')).toBe(true);
    expect(isCounterKey('alert.caps_lock')).toBe(true);
    for (const bad of ['generate.inexistente', 'alert.', 'alert.Texto Livre', 'alert.1abc', 'senha=123', 'alert.a@b.com', '__proto__', '']) {
      expect(isCounterKey(bad), bad).toBe(false);
    }
  });

  it('descarta chaves desconhecidas e valores que não são inteiros positivos', () => {
    const raw = {
      version: 1,
      since: '2026-01-02',
      counts: { copy: 3, variant: -1, review_again: 1.5, 'generate.request_information': '7', 'texto livre do chamado': 9, 'alert.ok_code': 2 },
    };
    expect(sanitizeCounters(raw, TODAY)).toEqual({ version: 1, since: '2026-01-02', counts: { copy: 3, 'alert.ok_code': 2 } });
    expect(sanitizeCounters('lixo', TODAY)).toEqual(emptyCounters(TODAY));
    expect(sanitizeCounters({ since: 'ontem às 10h', counts: null }, TODAY)).toEqual(emptyCounters(TODAY));
  });

  it('limita a quantidade de códigos de alerta distintos e o valor máximo', () => {
    let c: UsageCounters = emptyCounters(TODAY);
    for (let i = 0; i < MAX_ALERT_KEYS + 20; i += 1) c = increment(c, `alert.codigo_${String(i).padStart(3, 'a')}`);
    expect(Object.keys(c.counts).length).toBe(MAX_ALERT_KEYS);
    const big = sanitizeCounters({ counts: { copy: 5_000_000_000 } }, TODAY);
    expect(big.counts.copy).toBe(1_000_000_000);
  });

  it('increment ignora chave inválida e soma nas válidas', () => {
    let c = emptyCounters(TODAY);
    c = increment(c, 'conteúdo do chamado');
    expect(c.counts).toEqual({});
    c = increment(increment(c, 'copy'), 'copy');
    expect(c.counts.copy).toBe(2);
  });

  it('faixas de tempo não guardam o instante exato', () => {
    expect(timeBucket(0)).toBe('lt1m');
    expect(timeBucket(59_999)).toBe('lt1m');
    expect(timeBucket(60_000)).toBe('1to3m');
    expect(timeBucket(180_000)).toBe('3to10m');
    expect(timeBucket(600_000)).toBe('gt10m');
    expect(timeBucket(Number.NaN)).toBe('lt1m');
    expect(timeBucket(-5)).toBe('lt1m');
  });

  it('chaves de uma geração: tipo ou motivo de bloqueio, mais códigos distintos', () => {
    expect(generationKeys('request_information', undefined, ['a_b', 'a_b', 'c_d'])).toEqual([
      'generate.request_information', 'alert.a_b', 'alert.c_d',
    ]);
    expect(generationKeys('request_information', 'sensitive_data', [])).toEqual(['blocked.sensitive_data']);
    expect(generationKeys('request_information', undefined, ['Código Inválido'])).toEqual(['generate.request_information']);
  });

  it('a lista fixa não tem duplicatas', () => {
    expect(new Set(FIXED_KEYS).size).toBe(FIXED_KEYS.length);
  });
});

describe('contadores de uso: política', () => {
  it('off e on travam a escolha; optional segue o analista', () => {
    expect(effectiveUsageMode('off', true)).toEqual({ enabled: false, locked: true });
    expect(effectiveUsageMode('on', false)).toEqual({ enabled: true, locked: true });
    expect(effectiveUsageMode('optional', false)).toEqual({ enabled: false, locked: false });
    expect(effectiveUsageMode('optional', true)).toEqual({ enabled: true, locked: false });
  });
});

describe('contadores de uso: gravação', () => {
  const make = () => {
    const local = new MemoryArea();
    const store = new AppStorage(local, null);
    const rec = new UsageRecorder({ load: () => store.loadCounters(), save: (c) => store.saveCounters(c) });
    return { local, store, rec };
  };

  it('desligado, nada é gravado', async () => {
    const { local, rec } = make();
    await rec.record(['copy', 'variant']);
    expect(local.data).toEqual({});
  });

  it('ligado, grava somente números nas chaves permitidas e serializa chamadas concorrentes', async () => {
    const { local, rec } = make();
    rec.setEnabled(true);
    await Promise.all([rec.record('copy'), rec.record('copy'), rec.record(['variant', 'chave solta']), rec.record('copy')]);
    const stored = local.data[STORAGE_KEYS.usageCounters] as UsageCounters;
    expect(stored.counts).toEqual({ copy: 3, variant: 1 });
    expect(Object.values(stored.counts).every((v) => Number.isInteger(v))).toBe(true);
  });

  it('falha de armazenamento nunca interrompe o uso', async () => {
    const rec = new UsageRecorder({
      load: async () => { throw new Error('indisponível'); },
      save: async () => { throw new Error('indisponível'); },
    });
    rec.setEnabled(true);
    await expect(rec.record('copy')).resolves.toBeUndefined();
    await expect(rec.record('copy')).resolves.toBeUndefined();
  });

  it('exporta JSON sem conteúdo e zera', async () => {
    const { store, rec } = make();
    rec.setEnabled(true);
    await rec.record('copy');
    const json = JSON.parse(exportCounters(await rec.snapshot())) as { contadores: Record<string, number>; desde: string };
    expect(json.contadores).toEqual({ copy: 1 });
    expect(json.desde).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    await store.resetCounters();
    expect((await store.loadCounters(new Date('2026-10-15T00:00:00Z'))).counts).toEqual({});
  });

  it('valor adulterado no armazenamento é saneado na leitura', async () => {
    const local = new MemoryArea({ usageCounters: { version: 1, since: TODAY, counts: { copy: 2, 'Maria Silva abriu chamado 123': 4 } } });
    const loaded = await new AppStorage(local, null).loadCounters();
    expect(loaded.counts).toEqual({ copy: 2 });
  });
});
