import type { CommunicationType, Formality, LabelKey, TechLevel, TemplateOverrides } from '../domain/types';

/**
 * Frases-base dos templates. Todas as variações são fixas e selecionadas de forma determinística
 * (índice de variação), sem aleatoriedade. A organização pode sobrescrever via perfil de linguagem.
 * Placeholders permitidos: {organization} e {destination}.
 */

export type PhraseTable = Record<CommunicationType, Record<Formality, string[]>>;

const none: Record<Formality, string[]> = { cordial: [], formal: [], direct: [] };

export const DEFAULT_OPENINGS: PhraseTable = {
  request_information: {
    cordial: [
      'Para continuarmos a análise, precisamos de algumas informações.',
      'Para darmos andamento à análise, precisamos de algumas informações complementares.',
    ],
    formal: [
      'Para dar continuidade à análise deste chamado, solicitamos as informações abaixo.',
      'Solicitamos as informações a seguir para a continuidade da análise deste chamado.',
    ],
    direct: [
      'Precisamos das informações abaixo para continuar a análise.',
      'Por favor, envie as informações abaixo para continuarmos a análise.',
    ],
  },
  technical_note: none,
  pending: {
    cordial: ['O atendimento permanece pendente. Seguem os detalhes.', 'Registramos uma pendência neste atendimento. Seguem os detalhes.'],
    formal: [
      'Registramos a pendência descrita abaixo para a continuidade deste atendimento.',
      'Informamos que o atendimento permanece pendente, conforme descrito abaixo.',
    ],
    direct: ['O atendimento permanece pendente.', 'Há uma pendência neste atendimento.'],
  },
  manager_approval: {
    cordial: [
      'Precisamos do seu “De acordo” para prosseguir com a solicitação descrita abaixo.',
      'Solicitamos a sua manifestação sobre o item descrito abaixo.',
    ],
    formal: [
      'Solicitamos a sua manifestação formal quanto ao item descrito abaixo.',
      'Encaminhamos o item abaixo para a sua avaliação e manifestação.',
    ],
    direct: ['Solicitamos o seu “De acordo” para o item abaixo.', 'Precisamos da sua manifestação sobre o item abaixo.'],
  },
  progress_update: {
    cordial: ['Passamos para informar o andamento do seu chamado.', 'Seguem as atualizações do atendimento até o momento.'],
    formal: ['Informamos o andamento atual deste atendimento.', 'Seguem as informações sobre o andamento deste chamado.'],
    direct: ['Segue o andamento do atendimento.', 'Atualização do atendimento:'],
  },
  solution_confirmation: {
    cordial: [
      'Realizamos as ações descritas abaixo e gostaríamos de confirmar se a situação foi resolvida.',
      'Gostaríamos de confirmar com você se a situação foi resolvida após as ações descritas abaixo.',
    ],
    formal: [
      'Após as ações descritas abaixo, solicitamos a confirmação sobre a resolução da situação.',
      'Solicitamos a sua confirmação quanto à resolução da situação, após as ações descritas abaixo.',
    ],
    direct: [
      'Realizamos as ações abaixo. Pode confirmar se a situação foi resolvida?',
      'Feitas as ações abaixo, precisamos da sua confirmação sobre o resultado.',
    ],
  },
  closure_resolved: {
    cordial: [
      'Estamos encerrando este chamado com a situação solucionada, conforme descrito abaixo.',
      'Este chamado está sendo encerrado porque a situação foi solucionada. Seguem os detalhes.',
    ],
    formal: [
      'Informamos o encerramento deste chamado, com a situação solucionada, conforme descrito abaixo.',
      'Registramos o encerramento deste chamado com a situação solucionada, conforme detalhado abaixo.',
    ],
    direct: ['Chamado encerrado com a situação solucionada.', 'Encerramos o chamado com a situação solucionada.'],
  },
  closure_no_response: {
    cordial: [
      'Estamos encerrando este chamado porque não recebemos retorno às tentativas de contato registradas abaixo.',
      'Não recebemos retorno às tentativas de contato registradas abaixo, por isso estamos encerrando este chamado.',
    ],
    formal: [
      'Informamos o encerramento deste chamado por ausência de retorno, após as tentativas de contato registradas abaixo.',
      'Registramos o encerramento deste chamado por ausência de retorno, conforme as tentativas de contato abaixo.',
    ],
    direct: ['Chamado encerrado por ausência de retorno, após as tentativas de contato abaixo.', 'Encerramos o chamado por ausência de retorno.'],
  },
  redirect_or_escalate: {
    cordial: [
      'Para que a análise tenha continuidade, estamos encaminhando este atendimento. Destino: {destination}.',
      'Este atendimento seguirá para outra equipe, para a continuidade da análise. Destino: {destination}.',
    ],
    formal: [
      'Informamos que este atendimento está sendo encaminhado para a continuidade da análise. Destino: {destination}.',
      'Encaminhamos este atendimento conforme o motivo descrito abaixo. Destino: {destination}.',
    ],
    direct: ['Este atendimento está sendo encaminhado. Destino: {destination}.', 'Encaminhamos o atendimento. Destino: {destination}.'],
  },
  guided_free_text: none,
};

export const DEFAULT_TYPE_CLOSINGS: PhraseTable = {
  request_information: {
    cordial: ['O seu retorno permitirá que continuemos a análise.', 'Com o seu retorno, conseguiremos dar andamento à análise.'],
    formal: ['O retorno dessas informações permitirá a continuidade da análise.', 'O envio dessas informações viabilizará a continuidade da análise.'],
    direct: ['Com o retorno, continuamos a análise.', 'Com as informações, seguimos com a análise.'],
  },
  technical_note: none,
  pending: {
    cordial: ['Aguardamos a conclusão do item acima para seguirmos com o atendimento.', 'Após a conclusão do item acima, retomaremos o atendimento.'],
    formal: ['Aguardamos a conclusão do item acima para a continuidade do atendimento.', 'Concluído o item acima, retomaremos o atendimento.'],
    direct: ['Aguardamos a conclusão do item acima.', 'Aguardamos o item acima para retomar o atendimento.'],
  },
  manager_approval: none,
  progress_update: none,
  solution_confirmation: {
    cordial: ['A sua confirmação nos permitirá registrar o resultado do atendimento.', 'Com a sua confirmação, poderemos registrar o resultado do atendimento.'],
    formal: ['A confirmação permitirá registrar o resultado do atendimento.', 'A sua confirmação possibilitará o registro do resultado do atendimento.'],
    direct: ['Com a confirmação, registramos o resultado.', 'Precisamos da confirmação para registrar o resultado.'],
  },
  closure_resolved: none,
  closure_no_response: none,
  redirect_or_escalate: {
    cordial: ['O atendimento seguirá com a equipe indicada.', 'A equipe indicada dará continuidade ao atendimento.'],
    formal: ['O atendimento seguirá com a equipe indicada.', 'A continuidade do atendimento ficará a cargo da equipe indicada.'],
    direct: ['O atendimento segue com a equipe indicada.', 'A equipe indicada continua o atendimento.'],
  },
  guided_free_text: none,
};

export const DEFAULT_LABELS: Record<TechLevel, Record<LabelKey, string>> = {
  balanced: {
    context: 'Contexto',
    justification: 'Justificativa',
    actions_done: 'Ações realizadas',
    actions_planned: 'Próximos passos',
    result: 'Resultado observado',
    pending: 'Pendência',
    depends_on: 'Pendente com',
    questions: 'Informações necessárias',
    expected_action: 'Ação esperada',
    deadline: 'Prazo informado',
    evidence: 'Evidências',
    notes: 'Observações',
    approval_object: 'Objeto da aprovação',
    approval_effect: 'Efeito da aprovação',
    attempts: 'Tentativas de contato registradas',
    notice: 'Aviso prévio',
    reason: 'Motivo do encaminhamento',
  },
  simple: {
    context: 'Situação',
    justification: 'Motivo da solicitação',
    actions_done: 'O que foi feito',
    actions_planned: 'O que será feito',
    result: 'O que observamos',
    pending: 'O que está pendente',
    depends_on: 'Pendente com',
    questions: 'O que precisamos saber',
    expected_action: 'O que é necessário agora',
    deadline: 'Prazo informado',
    evidence: 'Evidências',
    notes: 'Observações',
    approval_object: 'O que será aprovado',
    approval_effect: 'O que muda com a aprovação',
    attempts: 'Datas em que tentamos contato',
    notice: 'Aviso prévio',
    reason: 'Motivo do encaminhamento',
  },
  technical: {
    context: 'Contexto',
    justification: 'Justificativa',
    actions_done: 'Validações e ações realizadas',
    actions_planned: 'Próximos passos',
    result: 'Resultado observado',
    pending: 'Pendência',
    depends_on: 'Pendente com',
    questions: 'Informações necessárias',
    expected_action: 'Ação esperada',
    deadline: 'Prazo informado',
    evidence: 'Evidências',
    notes: 'Observações',
    approval_object: 'Objeto da aprovação',
    approval_effect: 'Efeito da aprovação',
    attempts: 'Tentativas de contato registradas',
    notice: 'Aviso prévio',
    reason: 'Motivo do encaminhamento',
  },
};

/** Rótulos específicos por tipo, aplicados por cima dos rótulos do nível técnico. */
export const LABEL_OVERRIDES: Partial<Record<CommunicationType, Partial<Record<LabelKey, string>>>> = {
  request_information: { deadline: 'Prazo para retorno', context: 'Contexto' },
  technical_note: { pending: 'Situação atual', expected_action: 'Próximo passo' },
  manager_approval: { deadline: 'Prazo para manifestação', context: 'Justificativa' },
  solution_confirmation: { deadline: 'Prazo para retorno' },
  closure_resolved: { result: 'Resultado validado' },
  closure_no_response: { context: 'Solicitação do atendimento', pending: 'Informação aguardada' },
  redirect_or_escalate: { actions_done: 'Verificações já realizadas', expected_action: 'Continuidade esperada' },
};

/**
 * Frases de ligação do estilo natural, no lugar dos rótulos secos. Duas variações por seção, escolhidas
 * pelo índice de variação. Aplicadas só a textos para pessoas (usuário, gestor, outro) e só quando a
 * organização não definiu rótulos próprios no perfil.
 */
export const NATURAL_LEADS: Partial<Record<LabelKey, readonly string[]>> = {
  context: ['Resumo da situação', 'Sobre o seu atendimento'],
  actions_done: ['O que já fizemos', 'Até aqui, realizamos'],
  actions_planned: ['Os próximos passos são', 'Em seguida, faremos o seguinte'],
  result: ['O que observamos', 'Resultado até o momento'],
  pending: ['O que ainda está pendente', 'Pendência no momento'],
  questions: ['Para avançarmos, precisamos saber', 'Pode nos ajudar com as informações abaixo'],
};

/** Quem age em "ação esperada" muda conforme o destinatário. */
export const NATURAL_EXPECTED_ACTION: Record<'person' | 'manager', readonly string[]> = {
  person: ['O que precisamos de você', 'Próximo passo do seu lado'],
  manager: ['Ação esperada do gestor', 'Encaminhamento esperado'],
};

/** Frases fixas por formalidade, usadas em seções específicas. */
export const FIXED_PHRASES = {
  approval_response: {
    cordial: ['Por favor, responda com “De acordo” ou “Não aprovado”.'],
    formal: ['Solicitamos que a manifestação seja registrada como “De acordo” ou “Não aprovado”.'],
    direct: ['Responda com “De acordo” ou “Não aprovado”.'],
  },
  user_confirmed: 'O usuário confirmou a solução.',
  user_not_confirmed: 'Até o momento do encerramento, não há registro de confirmação do usuário sobre a solução.',
  no_response_meaning: 'Este encerramento não indica que a situação foi resolvida.',
  notice: 'Aviso prévio de encerramento registrado em {date}.',
} as const;

export interface ResolvedTemplates {
  openings: PhraseTable;
  typeClosings: PhraseTable;
  labels: Record<TechLevel, Record<LabelKey, string>>;
}


export function resolveTemplates(overrides: TemplateOverrides = {}): ResolvedTemplates {
  const mergeTable = (base: PhraseTable, patch: TemplateOverrides['openings']): PhraseTable => {
    const out = structuredClone(base);
    for (const [type, byFormality] of Object.entries(patch ?? {}) as [CommunicationType, Partial<Record<Formality, string[]>>][]) {
      for (const [formality, list] of Object.entries(byFormality ?? {}) as [Formality, string[]][]) {
        if (Array.isArray(list)) out[type][formality] = [...list];
      }
    }
    return out;
  };
  const labels = structuredClone(DEFAULT_LABELS);
  for (const [level, patch] of Object.entries(overrides.labels ?? {}) as [TechLevel, Partial<Record<LabelKey, string>>][]) {
    Object.assign(labels[level], patch);
  }
  return {
    openings: mergeTable(DEFAULT_OPENINGS, overrides.openings),
    typeClosings: mergeTable(DEFAULT_TYPE_CLOSINGS, overrides.typeClosings),
    labels,
  };
}
