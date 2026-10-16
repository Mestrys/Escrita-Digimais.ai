import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { canonicalJson, importProfileText, sanitizeSigningKeys, verifyProfileSignature } from '../application/profile-signing';
import { AppStorage } from '../infrastructure/storage';
import { loadSigningKeys } from '../infrastructure/policy';
import { MemoryArea } from './memory-storage';
import { closeSigningDir, keygen, normalized, openSigningDir, signWith } from './signing-helpers';
import type { Keys } from './signing-helpers';

let a: Keys;
let b: Keys;

beforeAll(() => {
  openSigningDir();
  a = keygen('a');
  b = keygen('b');
});
afterAll(closeSigningDir);

describe('assinatura de perfil', () => {
  it('o script gera chave SPKI base64 aceita pela política e assina perfil verificável', async () => {
    expect(sanitizeSigningKeys([a.publicKey])).toEqual([a.publicKey]);
    const env = signWith(a, normalized('Org Assinada'));
    const r = await importProfileText(JSON.stringify(env), [a.publicKey]);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.profile.organizationName).toBe('Org Assinada');
      expect(r.signature).toBe(env.signatureValue);
    }
  });

  it('recusa perfil alterado depois de assinado', async () => {
    const env = signWith(a, normalized('Original'));
    env.profile.organizationName = 'Adulterada';
    const r = await importProfileText(JSON.stringify(env), [a.publicKey]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]).toMatch(/Assinatura inválida/);
  });

  it('recusa assinatura de outra chave e aceita qualquer uma das duas na rotação', async () => {
    const env = signWith(b, normalized('Org B'));
    expect((await importProfileText(JSON.stringify(env), [a.publicKey])).ok).toBe(false);
    expect((await importProfileText(JSON.stringify(env), [a.publicKey, b.publicKey])).ok).toBe(true);
  });

  it('com chave configurada, perfil simples é recusado (falha fechada)', async () => {
    const plain = JSON.stringify(normalized('Sem assinatura'));
    const r = await importProfileText(plain, [a.publicKey]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]).toMatch(/exige perfil assinado/);
  });

  it('sem chave configurada, perfil simples continua aceito e envelope assinado é recusado', async () => {
    expect((await importProfileText(JSON.stringify(normalized('Livre')), [])).ok).toBe(true);
    const env = signWith(a, normalized('Org'));
    const r = await importProfileText(JSON.stringify(env), []);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]).toMatch(/nenhuma chave/i);
  });

  it('recusa envelope malformado, assinatura truncada e campos extras', async () => {
    const env = signWith(a, normalized('Org'));
    const cases: unknown[] = [
      { ...env, extra: 1 },
      { ...env, signatureValue: env.signatureValue.slice(0, 40) },
      { ...env, signatureValue: '@@@' },
      { ...env, signatureValue: 7 },
      { format: env.format, profile: env.profile },
    ];
    for (const c of cases) expect((await importProfileText(JSON.stringify(c), [a.publicKey])).ok).toBe(false);
  });

  it('recusa perfil assinado que não está na forma normalizada', async () => {
    const env = signWith(a, { ...normalized('x'), organizationName: '  Org com espaços  ' });
    const r = await importProfileText(JSON.stringify(env), [a.publicKey]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]).toMatch(/normalizada/);
  });

  it('perfil assinado válido porém com conteúdo proibido ainda é recusado pelo validador', async () => {
    const env = signWith(a, { ...normalized('x'), organizationName: '<b>x</b>' });
    expect((await importProfileText(JSON.stringify(env), [a.publicKey])).ok).toBe(false);
  });

  it('chaves da política: formato validado e no máximo duas', () => {
    expect(sanitizeSigningKeys('x')).toEqual([]);
    expect(sanitizeSigningKeys(['curta', 7, '<script>'.repeat(20), a.publicKey, b.publicKey, a.publicKey])).toEqual([a.publicKey, b.publicKey]);
  });

  it('canonicalJson ignora a ordem das chaves', () => {
    expect(canonicalJson({ b: 1, a: [{ d: 1, c: 2 }] })).toBe(canonicalJson({ a: [{ c: 2, d: 1 }], b: 1 }));
  });

  it('verificação nunca lança com entradas lixo', async () => {
    expect(await verifyProfileSignature({}, 'AAAA', ['lixo'])).toBe(false);
    expect(await verifyProfileSignature({}, 'A'.repeat(86), [a.publicKey])).toBe(false);
  });
});

describe('reverificação a cada abertura', () => {
  const signedStore = async (keys: string[]) => {
    const profile = normalized('Org Guardada');
    const env = signWith(a, profile, 'guardado');
    const local = new MemoryArea();
    const store = new AppStorage(local, null);
    await store.saveProfile(profile, env.signatureValue);
    return { local, store, keys };
  };

  it('perfil guardado com assinatura válida é usado', async () => {
    const { store } = await signedStore([a.publicKey]);
    const loaded = await store.loadProfile([a.publicKey]);
    expect(loaded.source).toBe('imported');
    expect(loaded.profile.organizationName).toBe('Org Guardada');
  });

  it('perfil guardado adulterado ou sem assinatura cai para o padrão quando há exigência', async () => {
    const { local, store } = await signedStore([a.publicKey]);
    (local.data.languageProfile as { organizationName: string }).organizationName = 'Trocada no disco';
    expect((await store.loadProfile([a.publicKey])).source).toBe('default');

    delete local.data.profileSignature;
    expect((await store.loadProfile([a.publicKey])).source).toBe('default');
  });

  it('troca de chave na política invalida o perfil guardado', async () => {
    const { store } = await signedStore([a.publicKey]);
    expect((await store.loadProfile([b.publicKey])).source).toBe('default');
  });

  it('sem exigência, perfil importado sem assinatura segue valendo', async () => {
    const local = new MemoryArea();
    const store = new AppStorage(local, null);
    await store.saveProfile(normalized('Simples'));
    expect(local.data.profileSignature).toBeUndefined();
    expect((await store.loadProfile([])).source).toBe('imported');
  });

  it('perfil gerenciado pelo administrador não depende de assinatura', async () => {
    const managed = new MemoryArea({ languageProfile: JSON.stringify(normalized('Gerenciada')) });
    const store = new AppStorage(new MemoryArea(), managed);
    expect((await store.loadProfile([a.publicKey])).source).toBe('managed');
  });
});

describe('política gerenciada', () => {
  it('lê as chaves, ignora lixo e volta a vazio em falha', async () => {
    const g = globalThis as { chrome?: unknown };
    const original = g.chrome;
    try {
      g.chrome = { storage: { managed: { get: async () => ({ profileSigningPublicKeys: [a.publicKey, 'lixo', b.publicKey, a.publicKey] }) } } };
      expect(await loadSigningKeys()).toEqual([a.publicKey, b.publicKey]);
      g.chrome = { storage: { managed: { get: async () => { throw new Error('x'); } } } };
      expect(await loadSigningKeys()).toEqual([]);
    } finally {
      g.chrome = original;
    }
  });
});

describe('forma canônica', () => {
  it('chaves undefined equivalem a chaves ausentes (como no JSON e no armazenamento)', () => {
    expect(canonicalJson({ a: 1, b: undefined })).toBe(canonicalJson({ a: 1 }));
    expect(canonicalJson(normalized('X'))).toBe(canonicalJson(JSON.parse(JSON.stringify(normalized('X')))));
  });
});
