/**
 * Dados das regras do rascunho livre. A lógica fica em `domain/draft.ts`.
 * As regras pesam mais que o modelo estatístico: o modelo só desempata o que as regras não decidem.
 */

export const DRAFT_CLASSES = ['summary', 'action', 'result', 'pending', 'expected', 'question'] as const;
export type DraftClass = (typeof DRAFT_CLASSES)[number];

export const DRAFT_CLASS_LABELS: Record<DraftClass, string> = {
  summary: 'Contexto',
  action: 'Ação realizada',
  result: 'Resultado observado',
  pending: 'Pendência',
  expected: 'Ação esperada',
  question: 'Pergunta ao destinatário',
};

export const MAX_DRAFT_SEGMENTS = 40;
export const MIN_SEGMENT_CHARS = 2;

export interface DraftRule {
  cls: DraftClass;
  pattern: RegExp;
  weight: number;
}

/** Início que, por si só, indica pergunta (mesmo sem o ponto de interrogação). */
export const INTERROGATIVE_START = /^(?:qual|quais|quando|quanto|quantos|quantas|como|onde|por que|quem|desde quando|o que)\b/iu;

/** Pesos somados às pontuações do modelo. Não são probabilidades. */
export const DRAFT_RULES: readonly DraftRule[] = [
  { cls: 'action', pattern: /^(?:fiz|feito|realizei|realizado|apliquei|executei|abri|entrei|conferi|testei|validei|resetei|reinstalei|reiniciei|atualizei|configurei|liberei|desbloqueei|troquei|instalei|habilitei|verifiquei|sincronizei|redefini|recriei|ajustei|copiei|desativei|reparei|limpei|orientei|encaminhei|solicitei|enviei|adicionei|removi|gerei|criei|renovei|migrei)\b/iu, weight: 6 },
  { cls: 'action', pattern: /\b(?:feit|criad|gerad|adicionad|removid|aplicad|migrad)[oa]s?\s*$/iu, weight: 4 },
  { cls: 'action', pattern: /^(?:reinstalad|validad|verificad|reiniciad|atualizad|configurad|reconfigurad|testad|reparad|liberad|conferid|ajustad|analisad|restaurad|redefinid|habilitad|desbloquead|sincronizad)[oa]s?\b/iu, weight: 6 },
  { cls: 'pending', pattern: /\b(?:aguardando|aguardo|aguarda|pendente|pend[êe]ncia|ainda n[ãa]o recebemos|sem retorno|depende d[eao]s?|falta (?:a|o|as|os|confirmar)|fica pendente)\b/iu, weight: 5 },
  { cls: 'expected', pattern: /^(?:por favor|favor|precisamos (?:que|d[oae]s?)|o usu[áa]rio (?:precisa|deve)|o gestor precisa|necess[áa]rio|pedir ao|solicitar ao|enviar|informar|encaminhar|responder|anexar|confirmar|autorizar|testar|entrar em contato)\b/iu, weight: 5 },
  { cls: 'result', pattern: /\b(?:funcionou|funcionando|normalmente|persiste|continua(?:m)? (?:sem|igual|com)|sem sucesso|com sucesso|n[ãa]o houve melhora|voltou(?:m)? a|ficou est[áa]vel|testes? ok|conex[ãa]o ok|resultado:|mesmo erro|mesma mensagem)\b/iu, weight: 4 },
  { cls: 'result', pattern: /\b(?:imprimiu|abriu|conectou|funcionou|travou de novo|caiu de novo|agora (?:abre|funciona|conecta|imprime))\b/iu, weight: 4 },
  { cls: 'summary', pattern: /\b(?:relata|reclama|n[ãa]o consegue|sem acesso|solicita(?:[çc][ãa]o)?|pede|abriu chamado|informa que|dúvida sobre|pedido de|necessidade de)\b/iu, weight: 3 },
];

/** Fonte de cada decisão, em português, mostrada ao analista junto de cada trecho. */
export const REASONS = {
  question: 'Parece uma pergunta.',
  planned: 'Fala de algo ainda por fazer.',
  rule: 'Palavras do trecho indicam este campo.',
  model: 'Semelhante a trechos deste campo em exemplos.',
  first: 'Primeiro trecho do rascunho.',
  learned: 'Ajustado pelas suas correções anteriores.',
} as const;
