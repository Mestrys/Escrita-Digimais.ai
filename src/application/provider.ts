import { DEFAULT_PROFILE } from '../config/language-profile';
import { generate } from '../domain/engine';
import { maskContext, scanContext } from '../domain/sensitive';
import { normalizeContext } from '../domain/normalize';
import type { GenerationInput, GenerationResult, LanguageProfile, TicketContext, Warning } from '../domain/types';

/**
 * Interface de geração de texto. O padrão é o motor local determinístico.
 * Um provedor remoto é apenas um adaptador desativado: não faz chamadas reais,
 * não recebe segredo e só poderia ser ativado por política administrativa.
 */
export interface GenerationRequest {
  input: GenerationInput;
  profile: LanguageProfile;
  now?: Date;
}

export interface TextGenerationProvider {
  readonly id: string;
  readonly kind: 'local' | 'remote';
  generate(request: GenerationRequest): Promise<GenerationResult>;
}

export class LocalProvider implements TextGenerationProvider {
  readonly id = 'local-deterministic';
  readonly kind = 'local' as const;
  async generate({ input, profile, now }: GenerationRequest): Promise<GenerationResult> {
    return generate(input, profile ?? DEFAULT_PROFILE, { now });
  }
}

/** Política administrativa. Vem somente de configuração gerenciada, nunca de campos do usuário. */
export interface AiPolicy {
  enabled: boolean;
  endpoint?: string;
  privacyConsentAcknowledged: boolean;
}

export const DISABLED_AI_POLICY: AiPolicy = { enabled: false, privacyConsentAcknowledged: false };

export class ProviderUnavailableError extends Error {}

export function isPolicyUsable(policy: AiPolicy): boolean {
  if (!policy.enabled || !policy.privacyConsentAcknowledged || !policy.endpoint) return false;
  try {
    const url = new URL(policy.endpoint);
    return url.protocol === 'https:' && !url.username && !url.password && !url.search;
  } catch {
    return false;
  }
}

/** Dados já reduzidos e mascarados, a única forma que um provedor remoto poderia receber. */
export interface RedactedRequest {
  type: GenerationInput['settings']['type'];
  settings: GenerationInput['settings'];
  context: TicketContext;
}

export function buildRedactedRequest(input: GenerationInput, profile: LanguageProfile): RedactedRequest {
  const normalized = normalizeContext(input.context);
  const findings = scanContext(normalized, profile.internalDomains);
  if (findings.some((f) => f.blocking)) throw new ProviderUnavailableError('Dados sensíveis impedem qualquer envio.');
  return { type: input.settings.type, settings: input.settings, context: maskContext(normalized, findings) };
}

/** Provedor remoto desativado: não realiza nenhuma chamada. Existe apenas como ponto de extensão. */
export class RemoteProviderStub implements TextGenerationProvider {
  readonly id = 'remote-disabled';
  readonly kind = 'remote' as const;
  constructor(private readonly policy: AiPolicy) {}
  async generate(request: GenerationRequest): Promise<GenerationResult> {
    if (!isPolicyUsable(this.policy)) throw new ProviderUnavailableError('Provedor remoto desativado pela organização.');
    buildRedactedRequest(request.input, request.profile);
    throw new ProviderUnavailableError('Provedor remoto ainda não implementado nesta versão.');
  }
}

export function createProvider(policy: AiPolicy = DISABLED_AI_POLICY): TextGenerationProvider {
  return isPolicyUsable(policy) ? new RemoteProviderStub(policy) : new LocalProvider();
}

export interface GenerationOutcome {
  result: GenerationResult;
  usedFallback: boolean;
  notice?: Warning;
}

/** Falha de modo seguro: qualquer erro do provedor retorna ao motor local. */
export async function generateWithFallback(
  provider: TextGenerationProvider,
  request: GenerationRequest,
): Promise<GenerationOutcome> {
  try {
    return { result: await provider.generate(request), usedFallback: false };
  } catch {
    const result = await new LocalProvider().generate(request);
    return {
      result,
      usedFallback: provider.kind === 'remote',
      notice:
        provider.kind === 'remote'
          ? {
              code: 'provider_fallback',
              severity: 'info',
              message: 'O provedor remoto não está disponível; o texto foi gerado pelo motor local.',
            }
          : undefined,
    };
  }
}
