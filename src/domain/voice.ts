/**
 * Voz da equipe: o analista costuma anotar na primeira pessoa do singular ("resetei a senha",
 * "no meu teste"), mas o texto enviado ao usuário fala em nome do Service Desk. Este módulo
 * converte apenas formas conhecidas (listas fechadas), nunca por regra genérica, e informa
 * exatamente o que mudou para que a alteração nunca seja silenciosa.
 */

/** Primeira pessoa do singular (pretérito) para a do plural. Lista fechada, sem acento nas chaves. */
const PAST_FIRST_PERSON: Record<string, string> = {
  resetei: 'resetamos', testei: 'testamos', reparei: 'reparamos', limpei: 'limpamos', reinstalei: 'reinstalamos',
  instalei: 'instalamos', validei: 'validamos', verifiquei: 'verificamos', reiniciei: 'reiniciamos',
  atualizei: 'atualizamos', configurei: 'configuramos', liberei: 'liberamos', conferi: 'conferimos',
  orientei: 'orientamos', tentei: 'tentamos', encaminhei: 'encaminhamos', abri: 'abrimos', fiz: 'fizemos',
  alterei: 'alteramos', criei: 'criamos', removi: 'removemos', habilitei: 'habilitamos', desbloqueei: 'desbloqueamos',
  ajustei: 'ajustamos', solicitei: 'solicitamos', enviei: 'enviamos', liguei: 'ligamos', analisei: 'analisamos',
  identifiquei: 'identificamos', corrigi: 'corrigimos', substitui: 'substituímos', troquei: 'trocamos',
  restaurei: 'restauramos', acessei: 'acessamos', consultei: 'consultamos', registrei: 'registramos',
  reabri: 'reabrimos', reativei: 'reativamos', reconfigurei: 'reconfiguramos', sincronizei: 'sincronizamos',
  redefini: 'redefinimos', desativei: 'desativamos', ativei: 'ativamos', movi: 'movemos', copiei: 'copiamos',
  recriei: 'recriamos', informei: 'informamos', avisei: 'avisamos', confirmei: 'confirmamos',
};

/** Particípio no início de uma ação ("Reinstalado o driver") para a forma de equipe ("Reinstalamos o driver"). */
const PARTICIPLE_OPENERS: Record<string, string> = {
  reinstalado: 'reinstalamos', instalado: 'instalamos', validado: 'validamos', verificado: 'verificamos',
  reiniciado: 'reiniciamos', atualizado: 'atualizamos', configurado: 'configuramos', reconfigurado: 'reconfiguramos',
  testado: 'testamos', reparado: 'reparamos', liberado: 'liberamos', conferido: 'conferimos', ajustado: 'ajustamos',
  analisado: 'analisamos', identificado: 'identificamos', corrigido: 'corrigimos', restaurado: 'restauramos',
  redefinido: 'redefinimos', resetado: 'resetamos', habilitado: 'habilitamos', desbloqueado: 'desbloqueamos',
  encaminhado: 'encaminhamos', recriado: 'recriamos', sincronizado: 'sincronizamos', substituído: 'substituímos',
  removido: 'removemos', criado: 'criamos', alterado: 'alteramos', solicitado: 'solicitamos', enviado: 'enviamos',
};

/** Aceita também o feminino e o plural do particípio ("Validadas as permissões"). */
for (const [participle, team] of Object.entries({ ...PARTICIPLE_OPENERS })) {
  const stem = participle.slice(0, -1);
  for (const suffix of ['a', 'os', 'as']) PARTICIPLE_OPENERS[`${stem}${suffix}`] = team;
}

const FUTURE_FIRST_PERSON: Record<string, string> = {
  vou: 'vamos', irei: 'iremos', farei: 'faremos', verei: 'veremos', validarei: 'validaremos', testarei: 'testaremos',
  verificarei: 'verificaremos', retornarei: 'retornaremos', acompanharei: 'acompanharemos', encaminharei: 'encaminharemos',
  reiniciarei: 'reiniciaremos', atualizarei: 'atualizaremos', agendarei: 'agendaremos', contatarei: 'contataremos',
};

const POSSESSIVES: Record<string, string> = { meu: 'nosso', minha: 'nossa', meus: 'nossos', minhas: 'nossas', comigo: 'conosco' };

const WORD = /(?<![\p{L}\p{N}_])[\p{L}]+(?![\p{L}\p{N}_])/gu;

function matchCase(original: string, replacement: string): string {
  const first = original.charAt(0);
  const upper = first !== first.toLowerCase() && first === first.toUpperCase();
  return upper ? replacement.charAt(0).toUpperCase() + replacement.slice(1) : replacement;
}

function lookup(table: Record<string, string>, word: string): string | undefined {
  const key = word.toLocaleLowerCase('pt-BR');
  return Object.prototype.hasOwnProperty.call(table, key) ? table[key] : undefined;
}

export interface VoiceChange {
  from: string;
  to: string;
}

export interface VoiceResult {
  text: string;
  changes: VoiceChange[];
}

/** Converte uma única frase ou item para a voz da equipe. Não toca em palavras fora das listas. */
export function toTeamVoice(text: string): VoiceResult {
  const changes: VoiceChange[] = [];
  const note = (from: string, to: string): string => {
    changes.push({ from, to });
    return to;
  };

  let first = true;
  const converted = text.replace(WORD, (word) => {
    const isFirst = first;
    first = false;
    if (isFirst) {
      const participle = lookup(PARTICIPLE_OPENERS, word);
      if (participle) return note(word, matchCase(word, participle));
    }
    const table = [PAST_FIRST_PERSON, FUTURE_FIRST_PERSON, POSSESSIVES];
    for (const t of table) {
      const hit = lookup(t, word);
      if (hit) return note(word, matchCase(word, hit));
    }
    return word;
  });
  return { text: converted, changes };
}

/** True quando a frase começa com um verbo conhecido na primeira pessoa do plural (pretérito ou futuro). */
const TEAM_VERBS = new Set<string>([
  ...Object.values(PAST_FIRST_PERSON),
  ...Object.values(PARTICIPLE_OPENERS),
  ...Object.values(FUTURE_FIRST_PERSON),
].map((v) => v.toLocaleLowerCase('pt-BR')));

export function startsWithTeamVerb(text: string): boolean {
  const first = text.match(/^[\s\p{P}]*([\p{L}]+)/u)?.[1];
  return first ? TEAM_VERBS.has(first.toLocaleLowerCase('pt-BR')) : false;
}

export function dedupeChanges(changes: VoiceChange[]): VoiceChange[] {
  const seen = new Set<string>();
  const out: VoiceChange[] = [];
  for (const c of changes) {
    const key = `${c.from.toLocaleLowerCase('pt-BR')}>${c.to.toLocaleLowerCase('pt-BR')}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ from: c.from.toLocaleLowerCase('pt-BR'), to: c.to.toLocaleLowerCase('pt-BR') });
  }
  return out;
}

// ---------- Voz para o destinatário (texto escrito ao próprio usuário) ----------

type Gender = 'm' | 'f';
interface NounInfo {
  gender: Gender;
  plural: boolean;
}

/** Substantivos comuns de chamado, com gênero e número. Lista fechada: fora dela, o texto não é tocado. */
const NOUNS: Record<string, NounInfo> = {
  teste: { gender: 'm', plural: false }, retorno: { gender: 'm', plural: false }, envio: { gender: 'm', plural: false },
  contato: { gender: 'm', plural: false }, arquivo: { gender: 'm', plural: false }, print: { gender: 'm', plural: false },
  acesso: { gender: 'm', plural: false }, login: { gender: 'm', plural: false }, perfil: { gender: 'm', plural: false },
  cadastro: { gender: 'm', plural: false }, computador: { gender: 'm', plural: false }, notebook: { gender: 'm', plural: false },
  equipamento: { gender: 'm', plural: false }, usuario: { gender: 'm', plural: false }, email: { gender: 'm', plural: false },
  conta: { gender: 'f', plural: false }, senha: { gender: 'f', plural: false }, resposta: { gender: 'f', plural: false },
  confirmacao: { gender: 'f', plural: false }, validacao: { gender: 'f', plural: false }, aprovacao: { gender: 'f', plural: false },
  informacao: { gender: 'f', plural: false }, planilha: { gender: 'f', plural: false }, captura: { gender: 'f', plural: false },
  maquina: { gender: 'f', plural: false }, estacao: { gender: 'f', plural: false }, conexao: { gender: 'f', plural: false },
  impressora: { gender: 'f', plural: false }, disponibilidade: { gender: 'f', plural: false },
  testes: { gender: 'm', plural: true }, arquivos: { gender: 'm', plural: true }, acessos: { gender: 'm', plural: true },
  permissoes: { gender: 'f', plural: true }, contas: { gender: 'f', plural: true }, senhas: { gender: 'f', plural: true },
  informacoes: { gender: 'f', plural: true }, respostas: { gender: 'f', plural: true },
};

const POSSESSIVE: Record<Gender, [string, string]> = { m: ['seu', 'seus'], f: ['sua', 'suas'] };

const strip = (w: string): string => w.normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase('pt-BR');
const nounOf = (w: string): NounInfo | undefined => {
  const key = strip(w);
  return Object.prototype.hasOwnProperty.call(NOUNS, key) ? NOUNS[key] : undefined;
};
const possessiveFor = (n: NounInfo): string => POSSESSIVE[n.gender][n.plural ? 1 : 0];

/**
 * "Usuário" seguido de nome próprio indica outra pessoa; nesse caso não se converte.
 * Atenção: com a flag `i`, `\p{Lu}` casa também minúsculas, por isso estes padrões não usam `i`.
 */
const NOT_NAMED = '(?!\\s+\\p{Lu})';
const USER = '[Uu]su[áa]ri[oa]s?';

const RULES_PERSON: { pattern: RegExp; to: string; capital: string }[] = [
  { pattern: new RegExp(`(?<![\\p{L}])[Cc]om (?:o|a) ${USER}(?![\\p{L}])${NOT_NAMED}`, 'gu'), to: 'com você', capital: 'Com você' },
  { pattern: new RegExp(`(?<![\\p{L}])[Pp]ara (?:o|a) ${USER}(?![\\p{L}])${NOT_NAMED}`, 'gu'), to: 'para você', capital: 'Para você' },
  { pattern: new RegExp(`(?<![\\p{L}])(?:[Aa]o|[Àà]) ${USER}(?![\\p{L}])${NOT_NAMED}`, 'gu'), to: 'a você', capital: 'A você' },
  { pattern: new RegExp(`(?<![\\p{L}])[Pp]el[oa] ${USER}(?![\\p{L}])${NOT_NAMED}`, 'gu'), to: 'por você', capital: 'Por você' },
];

/**
 * Quando o texto é escrito ao próprio usuário, converte referências a ele em terceira pessoa para a segunda
 * ("com o usuário" para "com você", "o teste do usuário" para "o seu teste", "conta dele" para "sua conta").
 * Só atua em formas conhecidas e lista cada troca; "usuário" seguido de nome próprio nunca é convertido.
 */
export function toRecipientVoice(text: string): VoiceResult {
  const changes: VoiceChange[] = [];
  const note = (from: string, to: string): string => {
    changes.push({ from, to });
    return to;
  };
  let out = text;
  for (const { pattern, to, capital } of RULES_PERSON) {
    out = out.replace(pattern, (m) => note(m, m.charAt(0) === m.charAt(0).toUpperCase() ? capital : to));
  }

  // "o teste do usuário" e "teste do usuário"
  const ofUser = new RegExp(`(?<![\\p{L}])(?:([oOaA]|[oO]s|[aA]s) )?(\\p{L}+) d[oa]s? ${USER}(?![\\p{L}])${NOT_NAMED}`, 'gu');
  out = out.replace(ofUser, (m, article: string | undefined, noun: string) => {
    const info = nounOf(noun);
    if (!info) return m;
    const poss = possessiveFor(info);
    return note(m, `${article ? `${article} ` : ''}${poss} ${noun}`);
  });

  // "conta dele", "senha dela"
  out = out.replace(/(?<![\p{L}])(\p{L}+) (?:dele|dela)(?![\p{L}])/giu, (m, noun: string) => {
    const info = nounOf(noun);
    return info ? note(m, `${possessiveFor(info)} ${noun}`) : m;
  });

  // "Aguardando seu teste" para "Aguardamos seu teste"
  out = out.replace(/^([Aa])guardando(?= (?:o |a )?(?:seu|sua|seus|suas)(?![\p{L}]))/u, (m, first: string) => note(m, `${first}guardamos`));
  return { text: out, changes };
}
