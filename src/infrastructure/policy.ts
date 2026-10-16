import { DISABLED_AI_POLICY } from '../application/provider';
import type { AiPolicy } from '../application/provider';
import { sanitizeSigningKeys } from '../application/profile-signing';
import type { UsagePolicy } from '../application/usage-counters';

/** Lê a política de IA da configuração gerenciada. Qualquer falha resulta em "desativado". */
export async function loadAiPolicy(): Promise<AiPolicy> {
  try {
    const managed = typeof chrome !== 'undefined' ? chrome.storage?.managed : undefined;
    if (!managed) return DISABLED_AI_POLICY;
    const data = (await managed.get('aiProvider')) as { aiProvider?: Partial<AiPolicy> };
    const p = data.aiProvider;
    if (!p) return DISABLED_AI_POLICY;
    return {
      enabled: p.enabled === true,
      endpoint: typeof p.endpoint === 'string' ? p.endpoint : undefined,
      privacyConsentAcknowledged: p.privacyConsentAcknowledged === true,
    };
  } catch {
    return DISABLED_AI_POLICY;
  }
}

/** Chaves públicas (SPKI base64) que assinam perfis. Ausente ou inválida: sem exigência de assinatura. */
export async function loadSigningKeys(): Promise<string[]> {
  try {
    const managed = typeof chrome !== 'undefined' ? chrome.storage?.managed : undefined;
    if (!managed) return [];
    const data = (await managed.get('profileSigningPublicKeys')) as { profileSigningPublicKeys?: unknown };
    return sanitizeSigningKeys(data.profileSigningPublicKeys);
  } catch {
    return [];
  }
}

/** Política dos contadores de uso: "off" força desligado, "on" força ligado, "optional" (padrão) deixa com o analista. */
export async function loadUsagePolicy(): Promise<UsagePolicy> {
  try {
    const managed = typeof chrome !== 'undefined' ? chrome.storage?.managed : undefined;
    if (!managed) return 'optional';
    const data = (await managed.get('usageCounters')) as { usageCounters?: unknown };
    const v = data.usageCounters;
    return v === 'off' || v === 'on' || v === 'optional' ? v : 'optional';
  } catch {
    return 'optional';
  }
}
