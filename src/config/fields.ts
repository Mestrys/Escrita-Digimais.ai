import type { CommunicationType, ContextField } from '../domain/types';

/** Metadados dos campos do formulário: rótulos, dicas e quais campos aparecem em cada tipo. */
export interface FieldMeta {
  label: string;
  hint?: string;
  kind: 'text' | 'textarea' | 'date' | 'select';
  rows?: number;
}

export const FIELD_META: Record<ContextField, FieldMeta> = {
  summary: { label: 'Contexto do chamado', hint: 'Qual é o problema ou a solicitação, em poucas frases.', kind: 'textarea', rows: 3 },
  actions: { label: 'Ações realizadas', hint: 'Uma por linha. Prefixe com "Planejado:" o que ainda não foi feito.', kind: 'textarea', rows: 4 },
  observedResult: { label: 'Resultado observado', hint: 'O que foi verificado após as ações. Apenas fatos.', kind: 'textarea', rows: 3 },
  pendingItem: { label: 'Pendência atual', hint: 'O que está pendente neste momento.', kind: 'textarea', rows: 2 },
  expectedAction: { label: 'Ação esperada do destinatário', hint: 'O que o destinatário precisa fazer.', kind: 'textarea', rows: 2 },
  explicitDeadline: { label: 'Prazo (somente se existir)', hint: 'Informe apenas um prazo já definido. Deixe em branco se não houver.', kind: 'text' },
  evidence: { label: 'Evidências', hint: 'Uma por linha. Descreva sem colar logs extensos.', kind: 'textarea', rows: 3 },
  notes: { label: 'Observações (opcional)', kind: 'textarea', rows: 2 },
  questions: { label: 'Perguntas ao destinatário', hint: 'Uma pergunta específica por linha.', kind: 'textarea', rows: 4 },
  approvalObject: { label: 'O que será aprovado', hint: 'Descreva o item, ação ou acesso com precisão.', kind: 'textarea', rows: 2 },
  approvalEffect: { label: 'Efeito da aprovação', hint: 'O que acontece no atendimento se for aprovado.', kind: 'textarea', rows: 2 },
  contactAttempts: { label: 'Datas das tentativas de contato', hint: 'Uma data por linha, no formato DD/MM/AAAA.', kind: 'textarea', rows: 3 },
  priorNoticeDate: { label: 'Data do aviso prévio de encerramento', hint: 'Formato DD/MM/AAAA.', kind: 'text' },
  userConfirmation: { label: 'Confirmação do usuário', kind: 'select' },
  destinationTeam: { label: 'Equipe de destino', kind: 'text' },
  escalationReason: { label: 'Motivo funcional do encaminhamento', hint: 'Por que outra equipe deve assumir, sem detalhes internos desnecessários.', kind: 'textarea', rows: 2 },
  freeIntent: { label: 'Mensagem principal', hint: 'Escreva a frase principal como deve aparecer no texto. Ela é usada exatamente como informada.', kind: 'textarea', rows: 3 },
};

export type FieldOverrides = Partial<Record<ContextField, Partial<Pick<FieldMeta, 'label' | 'hint'>>>>;

interface TypeFields {
  main: ContextField[];
  advanced: ContextField[];
  overrides?: FieldOverrides;
}

export const TYPE_FIELDS: Record<CommunicationType, TypeFields> = {
  request_information: {
    main: ['summary', 'questions', 'expectedAction', 'explicitDeadline'],
    advanced: ['actions', 'evidence', 'notes'],
    overrides: {
      summary: { label: 'Por que a informação é necessária', hint: 'Contexto resumido do chamado e motivo do pedido.' },
      actions: { label: 'Ações já realizadas', hint: 'Evita pedir novamente algo já disponível.' },
    },
  },
  technical_note: {
    main: ['summary', 'actions', 'observedResult', 'pendingItem', 'expectedAction', 'explicitDeadline'],
    advanced: ['evidence', 'notes'],
    overrides: { expectedAction: { label: 'Próximo passo' }, pendingItem: { label: 'Situação atual ou pendência' } },
  },
  pending: {
    main: ['pendingItem', 'expectedAction', 'summary', 'explicitDeadline'],
    advanced: ['actions', 'observedResult', 'evidence', 'notes'],
    overrides: { expectedAction: { label: 'Ação esperada e próximo passo' } },
  },
  manager_approval: {
    main: ['approvalObject', 'summary', 'approvalEffect', 'explicitDeadline'],
    advanced: ['actions', 'expectedAction', 'evidence', 'notes'],
    overrides: { summary: { label: 'Justificativa', hint: 'Por que a aprovação é necessária.' } },
  },
  progress_update: {
    main: ['summary', 'actions', 'observedResult', 'pendingItem', 'expectedAction', 'explicitDeadline'],
    advanced: ['evidence', 'notes'],
  },
  solution_confirmation: {
    main: ['summary', 'actions', 'observedResult', 'expectedAction', 'explicitDeadline'],
    advanced: ['evidence', 'notes'],
    overrides: { observedResult: { label: 'Resultado observado após as ações' } },
  },
  closure_resolved: {
    main: ['summary', 'actions', 'observedResult', 'userConfirmation'],
    advanced: ['pendingItem', 'evidence', 'notes'],
    overrides: {
      observedResult: { label: 'Resultado validado', hint: 'Evidência de que a situação foi resolvida. Tentativas e orientações não bastam.' },
      pendingItem: { label: 'Pendência atual (deve estar vazia para encerrar)' },
    },
  },
  closure_no_response: {
    main: ['summary', 'pendingItem', 'contactAttempts', 'priorNoticeDate'],
    advanced: ['notes'],
    overrides: {
      summary: { label: 'Solicitação original do chamado' },
      pendingItem: { label: 'Informação aguardada do usuário' },
    },
  },
  redirect_or_escalate: {
    main: ['destinationTeam', 'escalationReason', 'summary', 'actions', 'observedResult', 'expectedAction', 'explicitDeadline'],
    advanced: ['pendingItem', 'evidence', 'notes'],
    overrides: {
      actions: { label: 'Verificações já realizadas' },
      expectedAction: { label: 'Continuidade esperada' },
    },
  },
  guided_free_text: {
    main: ['freeIntent', 'summary', 'actions', 'observedResult', 'pendingItem', 'expectedAction', 'explicitDeadline'],
    advanced: ['evidence', 'notes'],
  },
};

export function fieldLabel(field: ContextField, type?: CommunicationType): string {
  return (type && TYPE_FIELDS[type].overrides?.[field]?.label) || FIELD_META[field].label;
}

export function fieldHint(field: ContextField, type?: CommunicationType): string | undefined {
  return (type && TYPE_FIELDS[type].overrides?.[field]?.hint) || FIELD_META[field].hint;
}

export const RECIPIENT_LABELS = {
  user: 'Usuário',
  manager: 'Gestor',
  technical_team: 'Equipe técnica',
  vendor: 'Fornecedor',
  other: 'Outro',
} as const;

export const TECH_LEVEL_LABELS = { simple: 'Simples', balanced: 'Equilibrado', technical: 'Técnico' } as const;
export const FORMALITY_LABELS = { cordial: 'Cordial', formal: 'Formal', direct: 'Direto respeitoso' } as const;
export const LENGTH_LABELS = { short: 'Curto', standard: 'Padrão', detailed: 'Detalhado' } as const;
