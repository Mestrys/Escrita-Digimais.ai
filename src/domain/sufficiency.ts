import type { CommunicationType, ContextField, TicketContext, Warning } from './types';
import { hasValue } from './normalize';

/**
 * Matriz de campos mínimos por tipo de texto.
 * `required` impede a geração; `recommended` gera apenas um alerta de completude.
 * Cada requisito é satisfeito por qualquer um dos campos de `anyOf`.
 */
export interface Requirement {
  anyOf: ContextField[];
  level: 'required' | 'recommended';
  question: string;
  code?: string;
}

const R = (anyOf: ContextField[], question: string): Requirement => ({ anyOf, level: 'required', question });
const C = (anyOf: ContextField[], question: string, code?: string): Requirement => ({
  anyOf,
  level: 'recommended',
  question,
  code,
});

export const SUFFICIENCY_MATRIX: Record<CommunicationType, Requirement[]> = {
  request_information: [
    R(['questions'], 'Quais perguntas objetivas devem ser feitas ao destinatário? (uma por linha)'),
    C(['summary'], 'Por que essas informações são necessárias para a análise?'),
  ],
  technical_note: [
    R(['actions', 'observedResult'], 'Quais validações ou ações foram feitas, ou qual resultado foi observado?'),
    C(['summary'], 'Qual é o contexto do chamado?'),
    C(['pendingItem', 'expectedAction'], 'Qual é a situação atual ou o próximo passo?'),
  ],
  pending: [
    R(['pendingItem'], 'O que exatamente está pendente?'),
    C(
      ['expectedAction'],
      'Qual ação é esperada para resolver a pendência e de quem ela depende?',
      'pending_without_expected_action',
    ),
  ],
  manager_approval: [
    R(['approvalObject'], 'O que o gestor deve aprovar (objeto da aprovação)?'),
    R(['summary'], 'Qual é a justificativa da solicitação?'),
    C(['approvalEffect'], 'Qual é o efeito da aprovação sobre o atendimento?'),
  ],
  progress_update: [
    R(['actions', 'observedResult', 'pendingItem'], 'Qual andamento deve ser informado (ações, resultado ou pendência)?'),
    C(['summary'], 'Qual é o contexto do chamado?'),
  ],
  solution_confirmation: [
    R(['actions', 'observedResult'], 'O que foi feito ou observado que justifica pedir a confirmação?'),
    C(['summary'], 'Qual era o problema original?'),
  ],
  closure_resolved: [
    R(['observedResult'], 'Qual resultado foi validado que comprova a solução?'),
    R(['actions'], 'Quais ações levaram à solução?'),
    C(['summary'], 'Qual era o problema original?'),
  ],
  closure_no_response: [
    R(['summary'], 'Qual era a solicitação original do chamado?'),
    R(['pendingItem'], 'Qual informação ou retorno foi solicitado e não foi recebido?'),
    R(['contactAttempts'], 'Quais foram as datas das tentativas de contato?'),
  ],
  redirect_or_escalate: [
    R(['destinationTeam'], 'Para qual equipe o atendimento será encaminhado?'),
    R(['escalationReason'], 'Qual é o motivo funcional do encaminhamento?'),
    C(['actions', 'observedResult'], 'O que já foi verificado antes do encaminhamento?'),
  ],
  guided_free_text: [R(['freeIntent'], 'Qual é a intenção da mensagem?')],
};

export interface SufficiencyResult {
  missingRequired: { question: string; fields: ContextField[] }[];
  missingRecommended: { question: string; fields: ContextField[]; code: string }[];
}

export function evaluateSufficiency(type: CommunicationType, context: TicketContext): SufficiencyResult {
  const result: SufficiencyResult = { missingRequired: [], missingRecommended: [] };
  for (const req of SUFFICIENCY_MATRIX[type]) {
    if (req.anyOf.some((f) => hasValue(context, f))) continue;
    if (req.level === 'required') result.missingRequired.push({ question: req.question, fields: req.anyOf });
    else
      result.missingRecommended.push({
        question: req.question,
        fields: req.anyOf,
        code: req.code ?? 'missing_recommended',
      });
  }
  return result;
}

export function recommendedWarnings(result: SufficiencyResult): Warning[] {
  return result.missingRecommended.map((m) => ({
    code: m.code,
    severity: 'warning' as const,
    message: `Informação recomendada ausente: ${m.question}`,
    suggestion: 'Complemente o campo correspondente para um texto mais completo.',
    field: m.fields[0],
    dimension: 'completeness' as const,
    penalty: 12,
  }));
}
