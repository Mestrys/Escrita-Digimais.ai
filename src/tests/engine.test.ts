import { describe, expect, it } from 'vitest';
import { DEFAULT_PROFILE } from '../config/language-profile';
import { COMMUNICATION_TYPES } from '../domain/types';
import type { CommunicationType, TicketContext } from '../domain/types';
import { codes, gen, NOW, profileWith } from './helpers';

const FULL: Record<CommunicationType, TicketContext> = {
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

const PROFILE_OPEN = profileWith({ closureRules: { ...DEFAULT_PROFILE.closureRules, noResponseEnabled: true } });

describe('regressão dos templates (padrão, cordial)', () => {
  it.each(COMMUNICATION_TYPES)('%s', (type) => {
    const r = gen(type, FULL[type], type === 'technical_note' ? { recipient: 'technical_team' } : {}, PROFILE_OPEN);
    expect(r.blocked, JSON.stringify(r.warnings)).toBe(false);
    expect(r.text).toMatchSnapshot();
  });

  it('nenhum texto usa travessão, emoji ou caixa alta para ênfase', () => {
    for (const type of COMMUNICATION_TYPES) {
      for (const formality of ['cordial', 'formal', 'direct'] as const) {
        for (const length of ['short', 'standard', 'detailed'] as const) {
          const r = gen(type, FULL[type], { formality, length }, PROFILE_OPEN);
          expect(r.blocked).toBe(false);
          expect(r.text).not.toMatch(/[—–]/);
          expect(r.text).not.toMatch(/\p{Extended_Pictographic}/u);
          expect(codes(r)).not.toContain('all_caps_emphasis');
        }
      }
    }
  });

  it('é determinístico e as variações são controladas', () => {
    const a = gen('request_information', FULL.request_information);
    const b = gen('request_information', FULL.request_information);
    const v1 = gen('request_information', FULL.request_information, { variant: 1 });
    expect(a.text).toBe(b.text);
    expect(v1.text).not.toBe(a.text);
  });

  it('registro interno não tem saudação, cortesia nem assinatura', () => {
    const r = gen('technical_note', FULL.technical_note, { recipient: 'technical_team' });
    expect(r.text).not.toMatch(/^(Olá|Prezad)/);
    expect(r.text).not.toContain('Equipe de Service Desk');
  });

  it('separa ações concluídas de planejadas', () => {
    const r = gen('technical_note', FULL.technical_note, { recipient: 'technical_team' });
    expect(r.text).toContain('Próximos passos: Reiniciar o serviço de autenticação.');
    expect(r.text).not.toContain('Planejado');
  });

  it('tamanho curto é menor que detalhado', () => {
    const ctx = { ...FULL.progress_update, evidence: ['Captura de tela anexada.'], notes: 'Observação extra.' };
    const s = gen('progress_update', ctx, { length: 'short' }).text.length;
    const d = gen('progress_update', ctx, { length: 'detailed' }).text.length;
    expect(s).toBeLessThan(d);
  });
});

describe('suficiência e campos vazios', () => {
  it.each(COMMUNICATION_TYPES)('%s sem nada pergunta ao analista e não gera texto', (type) => {
    const r = gen(type, {});
    expect(r.blocked).toBe(true);
    expect(r.blockReason === 'missing_information' || r.blockReason === 'policy').toBe(true);
    expect(r.text).toBe('');
    if (r.blockReason === 'missing_information') expect(r.missingInformation.length).toBeGreaterThan(0);
  });

  it('espaços e linhas em branco contam como vazio', () => {
    const r = gen('request_information', { questions: ['   ', '\n'], summary: '  ' });
    expect(r.blockReason).toBe('missing_information');
  });

  it('campos recomendados ausentes só geram alerta', () => {
    const r = gen('pending', { pendingItem: 'Retorno do fornecedor' }, { recipient: 'vendor' });
    expect(r.blocked).toBe(false);
    expect(codes(r)).toContain('pending_without_expected_action');
    expect(r.quality.completeness).toBeLessThan(100);
  });

  it('bloqueia conteúdo grande demais', () => {
    const r = gen('technical_note', { summary: 'x '.repeat(4000), actions: ['a'] });
    expect(r.blockReason).toBe('input_too_long');
  });

  it('aceita caracteres especiais sem quebrar', () => {
    const r = gen('technical_note', { actions: ['Verificado "A&B" <teste> `x` \\ 日本語 😀'], observedResult: 'Ok.' });
    expect(r.blocked).toBe(false);
    expect(codes(r)).toContain('emoji');
  });
});

describe('proteção de dados no motor', () => {
  it('bloqueia segredos e não os devolve em nenhum lugar', () => {
    const secret = 'Xy7!pQ9zLmN2';
    const r = gen('request_information', { questions: ['Qual o erro exibido?'], summary: `Login com senha: ${secret}` });
    expect(r.blocked).toBe(true);
    expect(r.blockReason).toBe('sensitive_data');
    expect(r.text).toBe('');
    expect(JSON.stringify(r)).not.toContain(secret);
  });

  it('mascara dados pessoais no texto gerado e avisa', () => {
    const r = gen('progress_update', { summary: 'Contato com ana.teste@exemplo.test', actions: ['Ligado para (11) 91234-5678'] });
    expect(r.blocked).toBe(false);
    expect(r.text).not.toContain('ana.teste');
    expect(r.text).not.toContain('91234');
    expect(r.text).toContain('[e-mail omitido]');
    expect(codes(r)).toEqual(expect.arrayContaining(['sensitive_email', 'sensitive_phone']));
    expect(r.quality.safety).toBeLessThan(100);
    expect(JSON.stringify(r.warnings)).not.toContain('ana.teste');
  });

  it('bloqueia quando o texto pede credenciais ao destinatário', () => {
    const r = gen('request_information', { questions: ['Informe sua senha de acesso para testarmos'] });
    expect(r.blocked).toBe(true);
    expect(r.blockReason).toBe('unsafe_content');
    expect(r.text).toBe('');
  });
});

describe('riscos de conteúdo', () => {
  const base = { summary: 'Erro no sistema.', actions: ['Verificado o log do aplicativo'], observedResult: 'Erro persiste.' };

  it('detecta voz acusatória e frases proibidas', () => {
    const r = gen('progress_update', { ...base, expectedAction: 'Conforme já informado, você deveria ter reiniciado o computador' });
    expect(codes(r)).toEqual(expect.arrayContaining(['accusatory_voice', 'forbidden_term']));
    expect(r.quality.cordiality).toBeLessThan(80);
  });

  it('detecta linguagem hostil, caixa alta e pontuação exagerada', () => {
    const r = gen('progress_update', { ...base, notes: 'Isso é um ABSURDO!!! ATENÇÃO ao prazo' }, { length: 'detailed' });
    expect(codes(r)).toEqual(expect.arrayContaining(['hostile_language', 'all_caps_emphasis', 'excessive_punctuation']));
  });

  it('detecta promessa indevida e prazo não informado', () => {
    const r = gen('progress_update', { ...base, expectedAction: 'Garantimos que ficará pronto amanhã' });
    expect(codes(r)).toEqual(expect.arrayContaining(['unfounded_promise', 'unsupported_deadline']));
  });

  it('não acusa prazo quando ele foi informado explicitamente', () => {
    const r = gen('progress_update', { ...base, explicitDeadline: 'amanhã às 10h', expectedAction: 'Retorno amanhã às 10h' });
    expect(codes(r)).not.toContain('unsupported_deadline');
  });

  it('detecta prazo implícito', () => {
    const r = gen('progress_update', { ...base, expectedAction: 'Retornaremos em breve' });
    expect(codes(r)).toContain('vague_deadline_phrase');
  });

  it('detecta causa raiz sem evidência e certeza indevida', () => {
    const r = gen('technical_note', { ...base, summary: 'A causa raiz foi o cache, certamente.' }, { recipient: 'technical_team' });
    expect(codes(r)).toEqual(expect.arrayContaining(['root_cause_without_evidence', 'undue_certainty']));
    const ok = gen('technical_note', { ...base, summary: 'A causa raiz foi o cache.', evidence: ['Log mostra cache corrompido'] }, { recipient: 'technical_team' });
    expect(codes(ok)).not.toContain('root_cause_without_evidence');
  });

  it('detecta afirmação de resolução fora de encerramento', () => {
    const r = gen('progress_update', { ...base, observedResult: 'O problema foi resolvido.' });
    expect(codes(r)).toContain('resolution_claim');
  });

  it('detecta pergunta vaga, siglas e jargão', () => {
    const r = gen('request_information', { questions: ['Pode me dar mais detalhes?', 'O DNS e o SLA do TTL estão corretos neste caso?'] });
    expect(codes(r)).toEqual(expect.arrayContaining(['vague_question', 'unexplained_acronym', 'excess_jargon']));
  });

  it('não alerta jargão para equipe técnica', () => {
    const r = gen('request_information', { questions: ['O DNS resolve o host corretamente neste caso?'] }, { recipient: 'technical_team', techLevel: 'technical' });
    expect(codes(r)).not.toContain('excess_jargon');
  });

  it('detecta ameaça de encerramento em pendência', () => {
    const r = gen('pending', { pendingItem: 'Retorno do usuário', expectedAction: 'Caso não responda, o chamado será encerrado' });
    expect(codes(r)).toContain('closure_threat');
  });

  it('detecta urgência sem justificativa', () => {
    const r = gen('progress_update', { ...base, notes: 'Isso é urgente' }, { length: 'detailed' });
    expect(codes(r)).toContain('unjustified_urgency');
  });

  it('detecta parágrafo longo e repetição', () => {
    const long = 'O sistema apresentou comportamento inesperado durante a rotina diária. '.repeat(10);
    const r = gen('progress_update', { ...base, summary: long });
    expect(codes(r)).toEqual(expect.arrayContaining(['long_paragraph', 'repetition']));
  });

  it('aprovação com objeto vago gera alerta', () => {
    const r = gen('manager_approval', { approvalObject: 'isso', summary: 'Necessário para o trabalho.' }, { recipient: 'manager' });
    expect(codes(r)).toContain('approval_without_object');
  });
});

describe('encerramentos', () => {
  it('encerramento solucionado exige resultado validado', () => {
    const r = gen('closure_resolved', { actions: ['Reinstalado o driver'] });
    expect(r.blockReason).toBe('missing_information');
  });

  it.each([
    ['pendência aberta', { pendingItem: 'Aguardando peça' }, 'closure_with_pending'],
    ['usuário negou', { userConfirmation: 'no' as const }, 'closure_user_denied'],
    ['resultado negativo', { observedResult: 'O problema persiste após a troca.' }, 'closure_negative_result'],
  ])('bloqueia encerramento inconsistente: %s', (_n, patch, code) => {
    const r = gen('closure_resolved', { ...FULL.closure_resolved, ...patch });
    expect(r.blocked).toBe(true);
    expect(r.blockReason).toBe('inconsistent');
    expect(codes(r)).toContain(code);
  });

  it('não declara validação do usuário sem confirmação', () => {
    const r = gen('closure_resolved', { ...FULL.closure_resolved, userConfirmation: 'unknown' });
    expect(r.blocked).toBe(false);
    expect(r.text).toContain('não há registro de confirmação do usuário');
    expect(r.text).not.toContain('O usuário confirmou');
  });

  it('resultado com incerteza gera alerta', () => {
    const r = gen('closure_resolved', { ...FULL.closure_resolved, observedResult: 'Parece que voltou a funcionar.' });
    expect(codes(r)).toContain('closure_uncertain_result');
  });

  describe('por ausência de retorno', () => {
    it('vem desativado por padrão', () => {
      const r = gen('closure_no_response', FULL.closure_no_response);
      expect(r.blockReason).toBe('policy');
      expect(codes(r)).toContain('closure_no_response_disabled');
    });

    it('gera quando as regras são atendidas', () => {
      const r = gen('closure_no_response', FULL.closure_no_response, {}, PROFILE_OPEN);
      expect(r.blocked).toBe(false);
      expect(r.text).toContain('01/10/2026');
      expect(r.text).toContain('Este encerramento não indica que a situação foi resolvida.');
    });

    it('exige o número mínimo de tentativas em datas distintas', () => {
      const r = gen('closure_no_response', { ...FULL.closure_no_response, contactAttempts: ['01/10/2026', '01/10/2026', '05/10/2026'] }, {}, PROFILE_OPEN);
      expect(codes(r)).toContain('insufficient_attempts');
    });

    it('respeita o mínimo configurável', () => {
      const p = profileWith({ closureRules: { ...PROFILE_OPEN.closureRules, minAttempts: 5 } });
      expect(codes(gen('closure_no_response', FULL.closure_no_response, {}, p))).toContain('insufficient_attempts');
      const p2 = profileWith({ closureRules: { ...PROFILE_OPEN.closureRules, minAttempts: 2 } });
      expect(gen('closure_no_response', { ...FULL.closure_no_response, contactAttempts: ['01/10/2026', '05/10/2026'] }, {}, p2).blocked).toBe(false);
    });

    it('bloqueia sem aviso prévio, aviso recente, datas inválidas ou futuras', () => {
      const without = { ...FULL.closure_no_response, priorNoticeDate: undefined };
      expect(codes(gen('closure_no_response', without, {}, PROFILE_OPEN))).toContain('missing_prior_notice');
      const recent = { ...FULL.closure_no_response, priorNoticeDate: '14/10/2026' };
      expect(codes(gen('closure_no_response', recent, {}, PROFILE_OPEN))).toContain('notice_period_not_elapsed');
      const invalid = { ...FULL.closure_no_response, contactAttempts: ['31/02/2026', '05/10/2026', '08/10/2026'] };
      expect(codes(gen('closure_no_response', invalid, {}, PROFILE_OPEN))).toContain('invalid_attempt_date');
      const future = { ...FULL.closure_no_response, contactAttempts: ['01/10/2026', '05/10/2026', '20/12/2026'] };
      expect(codes(gen('closure_no_response', future, {}, PROFILE_OPEN))).toContain('future_attempt_date');
    });

    it('dispensa aviso prévio quando a organização não exige', () => {
      const p = profileWith({ closureRules: { ...PROFILE_OPEN.closureRules, requirePriorNotice: false } });
      expect(gen('closure_no_response', { ...FULL.closure_no_response, priorNoticeDate: undefined }, {}, p).blocked).toBe(false);
    });
  });
});

describe('perfil de linguagem aplicado', () => {
  it('usa saudação, fechamento, assinatura e textos obrigatórios do perfil', () => {
    const p = profileWith({
      signature: 'Central de Atendimento',
      requiredTexts: [{ text: 'Mensagem sujeita a registro.', types: [] }],
    });
    const r = gen('progress_update', FULL.progress_update, {}, p);
    expect(r.text).toContain('Central de Atendimento');
    expect(r.text).toContain('Mensagem sujeita a registro.');
  });

  it('alerta termos proibidos e limite de tamanho', () => {
    const p = profileWith({ forbiddenTerms: ['sistema'], maxLength: 200 });
    const r = gen('progress_update', { ...FULL.progress_update, summary: 'Erro no sistema ' + 'x'.repeat(10) }, {}, p);
    expect(codes(r)).toEqual(expect.arrayContaining(['forbidden_term', 'max_length_exceeded']));
  });

  it('reporta a data fixa usada nos testes', () => {
    expect(NOW.getFullYear()).toBe(2026);
  });
});
