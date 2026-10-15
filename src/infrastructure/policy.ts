import { DISABLED_AI_POLICY } from '../application/provider';
import type { AiPolicy } from '../application/provider';

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
