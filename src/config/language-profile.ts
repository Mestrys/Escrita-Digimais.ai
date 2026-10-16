import type { LanguageProfile } from '../domain/types';
import { DEFAULT_KNOWN_ACRONYMS } from './vocabulary';

/**
 * Perfil de linguagem padrão. Pode ser substituído por perfil importado ou por política gerenciada.
 * Termos evitados pelo guia de linguagem inicial ficam em `forbiddenTerms` e `preferredTerms`.
 */
export const DEFAULT_PROFILE: LanguageProfile = {
  schemaVersion: 1,
  profileVersion: '1.0.0',
  organizationName: '',
  categoryNames: {
    request_information: 'Solicitar informações',
    technical_note: 'Nota técnica',
    pending: 'Registrar pendência',
    manager_approval: 'Solicitar “De acordo” do gestor',
    progress_update: 'Comunicar andamento',
    solution_confirmation: 'Confirmar solução com o usuário',
    closure_resolved: 'Encerrar chamado solucionado',
    closure_no_response: 'Encerrar por ausência de retorno',
    redirect_or_escalate: 'Redirecionar ou escalonar',
    guided_free_text: 'Texto livre guiado',
  },
  greetings: {
    cordial: {
      user: 'Olá,',
      manager: 'Olá,',
      technical_team: 'Olá, equipe,',
      vendor: 'Olá,',
      other: 'Olá,',
    },
    formal: {
      user: 'Prezado(a),',
      manager: 'Prezado(a) gestor(a),',
      technical_team: 'Prezada equipe,',
      vendor: 'Prezados,',
      other: 'Prezado(a),',
    },
    direct: {
      user: 'Olá,',
      manager: 'Olá,',
      technical_team: 'Olá, equipe,',
      vendor: 'Olá,',
      other: 'Olá,',
    },
  },
  closings: {
    cordial: ['Agradecemos a colaboração.', 'Ficamos à disposição.'],
    formal: ['Atenciosamente,', 'Cordialmente,'],
    direct: ['Obrigado.', 'Agradecemos.'],
  },
  signature: 'Equipe de Service Desk',
  recipients: {
    user: { displayName: 'usuário', defaultTechLevel: 'simple', defaultFormality: 'cordial', allowJargon: false },
    manager: { displayName: 'gestor', defaultTechLevel: 'balanced', defaultFormality: 'formal', allowJargon: false },
    technical_team: { displayName: 'equipe técnica', defaultTechLevel: 'technical', defaultFormality: 'direct', allowJargon: true },
    vendor: { displayName: 'fornecedor', defaultTechLevel: 'technical', defaultFormality: 'formal', allowJargon: true },
    other: { displayName: 'outro destinatário', defaultTechLevel: 'balanced', defaultFormality: 'cordial', allowJargon: false },
  },
  preferredTerms: [
    { avoid: 'o quanto antes', prefer: 'informe um prazo explícito' },
    { avoid: 'sem mais', prefer: 'Aguardamos o seu retorno' },
    { avoid: 'conforme já informado', prefer: 'Para continuarmos a análise' },
  ],
  forbiddenTerms: [
    'conforme já informado',
    'como você deveria',
    'falha humana',
    'não é de nossa responsabilidade',
    'o quanto antes',
    'sem mais',
  ],
  requiredTexts: [],
  privacyNotice: {
    text: 'Por segurança, não envie senhas, tokens ou outros dados de acesso neste chamado.',
    types: ['request_information'],
  },
  maxLength: 4000,
  closureRules: {
    noResponseEnabled: false,
    minAttempts: 3,
    requirePriorNotice: true,
    minDaysAfterNotice: 2,
    reopenInstruction: 'Se precisar de apoio novamente, entre em contato conosco.',
  },
  knownAcronyms: [...DEFAULT_KNOWN_ACRONYMS],
  internalDomains: [],
  templates: {},
};

export function cloneProfile(profile: LanguageProfile): LanguageProfile {
  return structuredClone(profile);
}
