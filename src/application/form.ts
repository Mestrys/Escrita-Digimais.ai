import { TYPE_FIELDS } from '../config/fields';
import type {
  CommunicationType,
  ContextField,
  Formality,
  GenerationInput,
  LengthMode,
  Recipient,
  TechLevel,
  TextStyle,
  TicketContext,
  UserConfirmation,
} from '../domain/types';

/** Estado bruto do formulário (somente strings), mapeado para o contrato do domínio. */
export interface FormState {
  type: CommunicationType;
  recipient: Recipient;
  techLevel: TechLevel;
  formality: Formality;
  length: LengthMode;
  variant: number;
  summary: string;
  actions: string;
  observedResult: string;
  pendingItem: string;
  expectedAction: string;
  explicitDeadline: string;
  evidence: string;
  notes: string;
  questions: string;
  approvalObject: string;
  approvalEffect: string;
  contactAttempts: string;
  priorNoticeDate: string;
  userConfirmation: UserConfirmation;
  destinationTeam: string;
  escalationReason: string;
  freeIntent: string;
  requesterName: string;
  textStyle: TextStyle;
}

export type TextFormField = Exclude<
  keyof FormState,
  'type' | 'recipient' | 'techLevel' | 'formality' | 'length' | 'variant' | 'userConfirmation' | 'textStyle'
>;

export const TEXT_FORM_FIELDS: TextFormField[] = [
  'summary', 'actions', 'observedResult', 'pendingItem', 'expectedAction', 'explicitDeadline', 'evidence', 'notes',
  'questions', 'approvalObject', 'approvalEffect', 'contactAttempts', 'priorNoticeDate', 'destinationTeam',
  'escalationReason', 'freeIntent', 'requesterName',
];

export function emptyContent(): Pick<FormState, TextFormField | 'userConfirmation'> {
  return {
    summary: '', actions: '', observedResult: '', pendingItem: '', expectedAction: '', explicitDeadline: '',
    evidence: '', notes: '', questions: '', approvalObject: '', approvalEffect: '', contactAttempts: '',
    priorNoticeDate: '', destinationTeam: '', escalationReason: '', freeIntent: '', requesterName: '', userConfirmation: 'unknown',
  };
}

export function initialForm(): FormState {
  return {
    type: 'request_information',
    recipient: 'user',
    techLevel: 'simple',
    formality: 'cordial',
    length: 'standard',
    variant: 0,
    textStyle: 'natural',
    ...emptyContent(),
  };
}

const lines = (s: string): string[] => s.split('\n');

export function toGenerationInput(form: FormState): GenerationInput {
  const context: TicketContext = {
    summary: form.summary,
    actions: lines(form.actions),
    observedResult: form.observedResult,
    pendingItem: form.pendingItem,
    expectedAction: form.expectedAction,
    explicitDeadline: form.explicitDeadline,
    evidence: lines(form.evidence),
    notes: form.notes,
    questions: lines(form.questions),
    approvalObject: form.approvalObject,
    approvalEffect: form.approvalEffect,
    contactAttempts: lines(form.contactAttempts),
    priorNoticeDate: form.priorNoticeDate,
    userConfirmation: form.userConfirmation,
    destinationTeam: form.destinationTeam,
    escalationReason: form.escalationReason,
    freeIntent: form.freeIntent,
    requesterName: form.requesterName,
  };
  // Minimização: apenas os campos exibidos para o tipo atual entram na geração.
  const visible = new Set<ContextField>([...TYPE_FIELDS[form.type].main, ...TYPE_FIELDS[form.type].advanced]);
  for (const key of Object.keys(context) as ContextField[]) {
    if (!visible.has(key)) delete context[key];
  }
  return {
    settings: {
      type: form.type,
      recipient: form.recipient,
      techLevel: form.techLevel,
      formality: form.formality,
      length: form.length,
      variant: form.variant,
      style: form.textStyle,
    },
    context,
  };
}
