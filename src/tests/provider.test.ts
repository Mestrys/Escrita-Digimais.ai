import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildRedactedRequest, createProvider, DISABLED_AI_POLICY, generateWithFallback, isPolicyUsable, LocalProvider,
  RemoteProviderStub,
} from '../application/provider';
import { DEFAULT_PROFILE } from '../config/language-profile';
import { settings } from './helpers';

const input = {
  settings: settings('progress_update'),
  context: { summary: 'Contato com ana.teste@exemplo.test sobre erro.', actions: ['Verificado o log'] },
};

afterEach(() => vi.unstubAllGlobals());

describe('provedores de geração', () => {
  it('o padrão é o provedor local', () => {
    expect(createProvider()).toBeInstanceOf(LocalProvider);
    expect(createProvider(DISABLED_AI_POLICY).kind).toBe('local');
  });

  it('política incompleta ou insegura nunca ativa o remoto', () => {
    expect(isPolicyUsable({ enabled: true, endpoint: 'https://ia.exemplo.test/v1', privacyConsentAcknowledged: false })).toBe(false);
    expect(isPolicyUsable({ enabled: true, endpoint: 'http://ia.exemplo.test', privacyConsentAcknowledged: true })).toBe(false);
    expect(isPolicyUsable({ enabled: true, endpoint: 'https://u:p@ia.exemplo.test', privacyConsentAcknowledged: true })).toBe(false);
    expect(isPolicyUsable({ enabled: true, endpoint: 'https://ia.exemplo.test/v1?key=abc', privacyConsentAcknowledged: true })).toBe(false);
    expect(isPolicyUsable({ enabled: false, endpoint: 'https://ia.exemplo.test', privacyConsentAcknowledged: true })).toBe(false);
    expect(createProvider({ enabled: true, endpoint: 'https://ia.exemplo.test/v1', privacyConsentAcknowledged: true }).kind).toBe('remote');
  });

  it('o remoto falha de modo seguro, volta ao motor local e não faz rede', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const remote = new RemoteProviderStub({ enabled: true, endpoint: 'https://ia.exemplo.test/v1', privacyConsentAcknowledged: true });
    const out = await generateWithFallback(remote, { input, profile: DEFAULT_PROFILE });
    expect(out.usedFallback).toBe(true);
    expect(out.notice?.code).toBe('provider_fallback');
    expect(out.result.text).toContain('verificamos o log');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('reduz e mascara antes de qualquer envio e nunca envia segredos', () => {
    const req = buildRedactedRequest(input, DEFAULT_PROFILE);
    expect(JSON.stringify(req)).not.toContain('ana.teste');
    expect(req.context.summary).toContain('[e-mail omitido]');
    expect(() =>
      buildRedactedRequest({ ...input, context: { summary: 'senha: Abc@12345' } }, DEFAULT_PROFILE),
    ).toThrow();
  });
});
