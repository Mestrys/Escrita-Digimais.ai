import { DEFAULT_PROFILE } from '../config/language-profile';
import { generate } from '../domain/engine';
import type { CommunicationType, GenerationSettings, LanguageProfile, TicketContext } from '../domain/types';

export const NOW = new Date('2026-10-15T12:00:00');

export function settings(type: CommunicationType, over: Partial<GenerationSettings> = {}): GenerationSettings {
  return { type, recipient: 'user', techLevel: 'balanced', formality: 'cordial', length: 'standard', variant: 0, ...over };
}

export function gen(
  type: CommunicationType,
  context: TicketContext,
  over: Partial<GenerationSettings> = {},
  profile: LanguageProfile = DEFAULT_PROFILE,
) {
  return generate({ settings: settings(type, over), context }, profile, { now: NOW });
}

export function profileWith(patch: Partial<LanguageProfile>): LanguageProfile {
  return { ...structuredClone(DEFAULT_PROFILE), ...patch };
}

export const codes = (r: { warnings: { code: string }[] }): string[] => r.warnings.map((w) => w.code);

/** Contextos completos e fictícios, um por tipo, usados em regressão de templates e nas amostras de validação. */
export const FULL_CONTEXTS: Record<CommunicationType, TicketContext> = {
  request_information: {
    summary: 'Usuária relata erro ao abrir a planilha de custos.',
    questions: ['Qual mensagem de erro aparece na tela', 'O erro ocorre com outros arquivos?'],
    explicitDeadline: '20/10/2026 às 17h',
  },
  technical_note: {
    summary: 'Falha de login no portal.',
    actions: ['Validado cadastro do usuário', 'Planejado: reiniciar o serviço de autenticação'],
    observedResult: 'Cadastro ativo.',
    pendingItem: 'Aguardando janela de manutenção',
  },
  pending: { pendingItem: 'Envio da planilha corrigida pelo usuário', expectedAction: 'Enviar o arquivo atualizado' },
  manager_approval: {
    approvalObject: 'Instalação do software de modelagem no equipamento patrimonial 00123',
    summary: 'O software é necessário para a rotina de fechamento mensal.',
    approvalEffect: 'Com a aprovação, a instalação será agendada.',
  },
  progress_update: {
    summary: 'Lentidão ao abrir o sistema.',
    actions: ['Limpeza do cache do navegador'],
    observedResult: 'A lentidão diminuiu parcialmente.',
    pendingItem: 'Acompanhar o comportamento por dois dias',
  },
  solution_confirmation: {
    summary: 'Impressora não imprimia.',
    actions: ['Reinstalado o driver da impressora'],
    observedResult: 'Página de teste impressa.',
  },
  closure_resolved: {
    summary: 'Impressora não imprimia.',
    actions: ['Reinstalado o driver da impressora'],
    observedResult: 'Página de teste impressa e confirmada no equipamento.',
    userConfirmation: 'yes',
  },
  closure_no_response: {
    summary: 'Solicitação de acesso à pasta compartilhada.',
    pendingItem: 'Confirmação do nome da pasta',
    contactAttempts: ['01/10/2026', '05/10/2026', '08/10/2026'],
    priorNoticeDate: '09/10/2026',
  },
  redirect_or_escalate: {
    destinationTeam: 'Equipe de Infraestrutura',
    escalationReason: 'A análise exige acesso administrativo ao ambiente de armazenamento.',
    actions: ['Validadas as permissões do usuário'],
  },
  guided_free_text: { freeIntent: 'O atendimento presencial foi agendado', summary: 'Troca de equipamento solicitada.' },
};
