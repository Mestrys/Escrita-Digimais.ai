import { MAX_TOTAL_CHARS } from '../config/limits';
import type { ReviewContext } from '../domain/risks';
import type { CommunicationType, LanguageProfile, Recipient, UserConfirmation } from '../domain/types';

/** Estado do modo "revisar texto pronto". Vive só em memória, como o resto do conteúdo. */
export interface ReviewFormState {
  type: CommunicationType;
  recipient: Recipient;
  text: string;
  /** Contexto opcional que evita alertas indevidos (o motor não vê o chamado). */
  hasEvidence: boolean;
  userConfirmation: UserConfirmation;
  explicitDeadline: string;
}

export function initialReviewForm(): ReviewFormState {
  return { type: 'technical_note', recipient: 'user', text: '', hasEvidence: false, userConfirmation: 'unknown', explicitDeadline: '' };
}

export function hasReviewContent(form: ReviewFormState): boolean {
  return form.text.trim().length > 0 || form.explicitDeadline.trim().length > 0;
}

/** Retorna o motivo pelo qual o texto não pode ser revisado, ou null. */
export function reviewInputProblem(form: ReviewFormState): string | null {
  if (!form.text.trim()) return 'Cole ou digite o texto que deseja revisar.';
  if (form.text.length > MAX_TOTAL_CHARS) return `O texto excede ${MAX_TOTAL_CHARS} caracteres. Revise por partes.`;
  return null;
}

export function toReviewContext(form: ReviewFormState, profile: LanguageProfile): ReviewContext {
  const rp = profile.recipients[form.recipient];
  return {
    type: form.type,
    recipient: form.recipient,
    techLevel: rp.defaultTechLevel,
    explicitDeadline: form.explicitDeadline.trim() || undefined,
    hasEvidence: form.hasEvidence,
    userConfirmation: form.userConfirmation,
  };
}
