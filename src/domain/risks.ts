import {
  ACRONYM_PATTERN,
  ASK_CREDENTIALS_PATTERN,
  ASK_PERSONAL_DATA_PATTERN,
  BLAME_RULES,
  CERTAINTY_RULES,
  CLOSURE_INCONSISTENT_PATTERN,
  CLOSURE_THREAT_PATTERN,
  CONCRETE_TIME_PATTERN,
  COURTESY_PATTERN,
  GREETING_PATTERN,
  HEDGE_PATTERN,
  JARGON_TERMS,
  PROMISE_RULES,
  RESOLUTION_CLAIM_PATTERN,
  ROOT_CAUSE_PATTERN,
  SILENCE_AS_SOLUTION_PATTERN,
  SOLUTION_MARKER_PATTERN,
  STYLE_RULES,
  URGENT_JUSTIFICATION_PATTERN,
  URGENT_PATTERN,
  VAGUE_QUESTION_PATTERNS,
} from '../config/vocabulary';
import type { LexicalRule } from '../config/vocabulary';
import { isRecordStyle } from '../config/blueprints';
import {
  countWords,
  paragraphs,
  splitSentences,
  stripAccents,
  termRegex,
  words,
} from './text-utils';
import type { CommunicationType, LanguageProfile, Recipient, TechLevel, UserConfirmation, Warning } from './types';

/** O que a revisão precisa saber sobre a comunicação. Todos os campos são opcionais. */
export interface ReviewContext {
  type: CommunicationType;
  recipient: Recipient;
  techLevel: TechLevel;
  explicitDeadline?: string;
  hasEvidence?: boolean;
  userConfirmation?: UserConfirmation;
  pendingItem?: string;
}

function excerptOf(text: string, match: RegExpMatchArray | null, radius = 24): string | undefined {
  if (!match || match.index === undefined) return undefined;
  const start = Math.max(0, match.index - radius);
  const end = Math.min(text.length, match.index + match[0].length + radius);
  return (start > 0 ? '…' : '') + text.slice(start, end).replace(/\s+/g, ' ') + (end < text.length ? '…' : '');
}

function applyLexical(text: string, rules: LexicalRule[], out: Warning[], skip?: (m: RegExpMatchArray) => boolean): void {
  for (const rule of rules) {
    const m = rule.pattern.exec(text);
    if (!m || skip?.(m)) continue;
    out.push({
      code: rule.code,
      severity: rule.severity,
      message: rule.message,
      suggestion: rule.suggestion,
      excerpt: excerptOf(text, m),
      dimension: rule.dimension,
      penalty: rule.penalty,
    });
  }
}

function isExplained(text: string, acronym: string): boolean {
  return text.includes(`${acronym} (`) || text.includes(`(${acronym})`);
}

function questionsIn(text: string): string[] {
  return splitSentences(text).filter((s) => s.endsWith('?'));
}

/** Detecção de riscos e problemas de estilo no texto (gerado ou editado). */
export function detectTextRisks(text: string, ctx: ReviewContext, profile: LanguageProfile): Warning[] {
  const out: Warning[] = [];
  const closureType = ctx.type === 'closure_resolved' || ctx.type === 'closure_no_response';

  // ---- Linguagem, culpa e hostilidade
  applyLexical(text, BLAME_RULES, out);
  applyLexical(text, STYLE_RULES, out, (m) => Boolean(ctx.explicitDeadline && ctx.explicitDeadline.toLowerCase().includes(m[0].toLowerCase())));
  applyLexical(text, PROMISE_RULES, out);
  applyLexical(text, CERTAINTY_RULES, out);

  const emoji = /\p{Extended_Pictographic}/u.exec(text);
  if (emoji) {
    out.push({
      code: 'emoji',
      severity: 'warning',
      message: 'O texto contém emoji, que não faz parte do padrão de comunicação.',
      suggestion: 'Remova o emoji.',
      dimension: 'cordiality',
      penalty: 8,
    });
  }
  if (/!{2,}|\?{3,}/.test(text)) {
    out.push({
      code: 'excessive_punctuation',
      severity: 'warning',
      message: 'Pontuação repetida (ênfase excessiva).',
      suggestion: 'Use pontuação simples.',
      dimension: 'cordiality',
      penalty: 8,
    });
  }

  // ---- Caixa alta como ênfase e siglas
  const known = new Set(profile.knownAcronyms.map((a) => a.toUpperCase()));
  const upperWords = [...text.matchAll(ACRONYM_PATTERN)].map((m) => m[0]);
  const emphasized = (text.match(/(?<![\p{L}\p{N}])[\p{Lu}]{5,}(?![\p{L}\p{N}])/gu) ?? []).filter((w) => !known.has(w));
  if (emphasized.length >= 1) {
    out.push({
      code: 'all_caps_emphasis',
      severity: 'warning',
      message: `Caixa alta usada como ênfase (${emphasized[0]}).`,
      suggestion: 'Não use caixa alta para ênfase.',
      dimension: 'cordiality',
      penalty: 10,
    });
  }
  const jargonAllowed = ctx.techLevel === 'technical' || profile.recipients[ctx.recipient].allowJargon;
  if (!jargonAllowed) {
    const unknown = [...new Set(upperWords.filter((a) => !known.has(a) && !isExplained(text, a)))];
    if (unknown.length) {
      out.push({
        code: 'unexplained_acronym',
        severity: 'warning',
        message: `Sigla não explicada: ${unknown.slice(0, 4).join(', ')}.`,
        suggestion: 'Escreva o significado na primeira ocorrência, por exemplo "VPN (rede privada virtual)".',
        dimension: 'clarity',
        penalty: 8,
      });
    }
    const normalized = stripAccents(text.toLowerCase());
    const jargon = JARGON_TERMS.filter((t) => termRegex(stripAccents(t)).test(normalized));
    const threshold = ctx.techLevel === 'simple' ? 1 : 2;
    if (jargon.length >= threshold) {
      out.push({
        code: 'excess_jargon',
        severity: 'warning',
        message: `Jargão técnico para este destinatário: ${jargon.slice(0, 4).join(', ')}.`,
        suggestion: 'Troque por uma descrição simples ou explique o termo.',
        dimension: 'clarity',
        penalty: 10,
      });
    }
  }

  // ---- Prazos
  const concrete = CONCRETE_TIME_PATTERN.exec(text);
  if (concrete && !(ctx.explicitDeadline && stripAccents(ctx.explicitDeadline.toLowerCase()).includes(stripAccents(concrete[0].toLowerCase())))) {
    out.push({
      code: 'unsupported_deadline',
      severity: 'warning',
      message: 'O texto cita um prazo que não foi informado no campo de prazo.',
      suggestion: 'Informe o prazo no campo correspondente ou remova a menção. A extensão não promete prazos.',
      excerpt: excerptOf(text, concrete),
      dimension: 'safety',
      penalty: 18,
    });
  }

  // ---- Certeza indevida, causa raiz e resolução
  const rootCause = ROOT_CAUSE_PATTERN.exec(text);
  if (rootCause && !ctx.hasEvidence) {
    out.push({
      code: 'root_cause_without_evidence',
      severity: 'warning',
      message: 'Causa declarada sem evidência explícita no contexto.',
      suggestion: 'Descreva o que foi observado ou inclua a evidência, e evite afirmar a causa raiz.',
      excerpt: excerptOf(text, rootCause),
      dimension: 'safety',
      penalty: 18,
    });
  }
  if (ctx.type !== 'closure_resolved') {
    const claim = RESOLUTION_CLAIM_PATTERN.exec(text);
    if (claim && !/confirm(?:ar|e|a)\b|gostar[íi]amos|solicitamos|precisamos/iu.test(text)) {
      out.push({
        code: 'resolution_claim',
        severity: 'warning',
        message: 'O texto afirma resolução fora de um encerramento solucionado.',
        suggestion: 'Descreva a ação e o resultado observado. Afirme resolução apenas com validação registrada.',
        excerpt: excerptOf(text, claim),
        dimension: 'safety',
        penalty: 18,
      });
    }
  }

  // ---- Encerramentos
  if (closureType) {
    if (SILENCE_AS_SOLUTION_PATTERN.test(text) && ctx.type === 'closure_no_response') {
      out.push({
        code: 'silence_as_solution',
        severity: 'warning',
        message: 'O texto trata o silêncio como solução. Ausência de retorno não significa que o problema foi resolvido.',
        suggestion: 'Diga apenas que não houve retorno às tentativas de contato.',
        dimension: 'safety',
        penalty: 25,
      });
    }
    if (ctx.type === 'closure_resolved') {
      if (!SOLUTION_MARKER_PATTERN.test(text)) {
        out.push({
          code: 'closure_without_solution',
          severity: 'warning',
          message: 'Encerramento sem menção explícita à solução.',
          suggestion: 'Resuma o que foi feito e o resultado validado.',
          dimension: 'completeness',
          penalty: 20,
        });
      }
      const invalid = CLOSURE_INCONSISTENT_PATTERN.exec(text);
      if (invalid) {
        out.push({
          code: 'closure_inconsistent_text',
          severity: 'warning',
          message: 'O texto de encerramento menciona pendência ou continuidade, o que é inconsistente.',
          suggestion: 'Revise: um chamado solucionado não deve conter pendências.',
          excerpt: excerptOf(text, invalid),
          dimension: 'safety',
          penalty: 20,
        });
      }
      if (/(?:usu[áa]rio|voc[êe]|cliente) (?:confirmou|validou|testou)/iu.test(text) && ctx.userConfirmation !== 'yes') {
        out.push({
          code: 'validation_not_recorded',
          severity: 'warning',
          message: 'O texto afirma validação do usuário, mas a confirmação não foi marcada como recebida.',
          suggestion: 'Marque "Confirmado pelo usuário" apenas se houver registro da confirmação.',
          dimension: 'safety',
          penalty: 22,
        });
      }
      if (HEDGE_PATTERN.test(text) && SOLUTION_MARKER_PATTERN.test(text)) {
        out.push({
          code: 'hedged_solution',
          severity: 'info',
          message: 'O texto declara solução com termos de incerteza.',
          suggestion: 'Declare a solução apenas se houver resultado validado.',
          dimension: 'clarity',
          penalty: 6,
        });
      }
    }
  }
  if (!closureType && ctx.type !== 'progress_update' && CLOSURE_THREAT_PATTERN.test(text)) {
    out.push({
      code: 'closure_threat',
      severity: 'warning',
      message: 'O texto ameaça encerrar o chamado, o que pode soar coercitivo.',
      suggestion: 'Informe o que é necessário para continuar, sem condicionar o encerramento.',
      dimension: 'cordiality',
      penalty: 18,
    });
  }

  // ---- Urgência sem justificativa
  if (URGENT_PATTERN.test(text) && !URGENT_JUSTIFICATION_PATTERN.test(text)) {
    out.push({
      code: 'unjustified_urgency',
      severity: 'warning',
      message: 'A palavra "urgente" aparece sem justificativa.',
      suggestion: 'Explique o impacto que justifica a urgência ou remova o termo.',
      dimension: 'objectivity',
      penalty: 10,
    });
  }

  // ---- Pedidos indevidos
  if (ASK_CREDENTIALS_PATTERN.test(text)) {
    out.push({
      code: 'ask_credentials',
      severity: 'block',
      message: 'O texto pede senha, token, chave ou código de acesso ao destinatário.',
      suggestion: 'Nunca solicite credenciais. Indique um canal seguro aprovado pela organização.',
      dimension: 'safety',
      penalty: 30,
    });
  }
  if (ASK_PERSONAL_DATA_PATTERN.test(text)) {
    out.push({
      code: 'ask_personal_data',
      severity: 'warning',
      message: 'O texto pede dado pessoal que pode ser desnecessário.',
      suggestion: 'Solicite apenas o dado indispensável e prefira um identificador do chamado.',
      dimension: 'safety',
      penalty: 18,
    });
  }

  // ---- Perguntas vagas
  if (ctx.type === 'request_information' || text.includes('?')) {
    const vague = questionsIn(text).filter((q) => {
      const body = q.replace(/^\d+\.\s*/, '');
      return VAGUE_QUESTION_PATTERNS.some((p) => p.test(body)) || countWords(body) < 4;
    });
    if (vague.length) {
      out.push({
        code: 'vague_question',
        severity: 'warning',
        message: `Pergunta vaga ou curta demais (${vague.length}).`,
        suggestion: 'Pergunte algo específico, por exemplo: "Qual mensagem de erro aparece ao abrir o sistema?".',
        excerpt: vague[0]?.slice(0, 80),
        dimension: 'clarity',
        penalty: 12,
      });
    }
  }

  // ---- Pendência sem ação esperada (no texto)
  if (ctx.type === 'pending' && !/\b(?:ação esperada|aguardamos|precisamos|solicitamos|por favor|pr[óo]ximo passo)\b/iu.test(text) && ctx.pendingItem) {
    out.push({
      code: 'pending_without_expected_action',
      severity: 'warning',
      message: 'Pendência sem ação esperada ou próximo passo claros.',
      suggestion: 'Diga o que é esperado e de quem.',
      dimension: 'completeness',
      penalty: 15,
    });
  }

  // ---- Saudação em registro interno, cordialidade em mensagem externa
  const record = isRecordStyle(ctx.type, ctx.recipient);
  if (record && GREETING_PATTERN.test(text.trim())) {
    out.push({
      code: 'greeting_in_record',
      severity: 'warning',
      message: 'Registro interno não deve começar com saudação.',
      suggestion: 'Remova a saudação e comece pelo contexto.',
      dimension: 'objectivity',
      penalty: 8,
    });
  }
  if (!record && !COURTESY_PATTERN.test(text) && !GREETING_PATTERN.test(text.trim())) {
    out.push({
      code: 'low_cordiality',
      severity: 'info',
      message: 'Mensagem sem marcas de cordialidade (saudação, agradecimento ou pedido educado).',
      suggestion: 'Inclua uma saudação ou um fechamento cordial.',
      dimension: 'cordiality',
      penalty: 10,
    });
  }

  // ---- Estrutura: parágrafos longos, frases longas, repetição
  const longParagraph = paragraphs(text).find((p) => !/^\d+\.\s/m.test(p) && p.length > 500);
  if (longParagraph) {
    out.push({
      code: 'long_paragraph',
      severity: 'warning',
      message: 'Parágrafo muito longo.',
      suggestion: 'Divida em parágrafos curtos ou em itens numerados.',
      excerpt: longParagraph.slice(0, 60) + '…',
      dimension: 'objectivity',
      penalty: 12,
    });
  }
  const longSentence = splitSentences(text).find((s) => countWords(s) > 40);
  if (longSentence) {
    out.push({
      code: 'long_sentence',
      severity: 'info',
      message: 'Frase com mais de 40 palavras.',
      suggestion: 'Quebre em frases curtas, em ordem direta.',
      excerpt: longSentence.slice(0, 60) + '…',
      dimension: 'clarity',
      penalty: 6,
    });
  }
  if (hasRepetition(text)) {
    out.push({
      code: 'repetition',
      severity: 'info',
      message: 'Trechos repetidos no texto.',
      suggestion: 'Remova a repetição ou una as informações.',
      dimension: 'objectivity',
      penalty: 8,
    });
  }

  return out;
}

export function hasRepetition(text: string): boolean {
  const sentences = splitSentences(text).map((s) => stripAccents(s.toLowerCase()).replace(/[^\p{L}\p{N} ]/gu, '').trim());
  const seen = new Set<string>();
  for (const s of sentences) {
    if (countWords(s) < 4) continue;
    if (seen.has(s)) return true;
    seen.add(s);
  }
  const tokens = words(stripAccents(text.toLowerCase()));
  const grams = new Set<string>();
  for (let i = 0; i + 6 <= tokens.length; i++) {
    const gram = tokens.slice(i, i + 6).join(' ');
    if (grams.has(gram)) return true;
    grams.add(gram);
  }
  return false;
}

/** Regras do perfil da organização: termos proibidos, termos preferidos, tamanho e textos obrigatórios. */
export function detectProfileIssues(text: string, ctx: ReviewContext, profile: LanguageProfile): Warning[] {
  const out: Warning[] = [];
  for (const term of profile.forbiddenTerms) {
    const m = termRegex(term).exec(text);
    if (m) {
      out.push({
        code: 'forbidden_term',
        severity: 'warning',
        message: `Termo não recomendado pelo guia de linguagem: "${term}".`,
        suggestion: profile.preferredTerms.find((p) => p.avoid.toLowerCase() === term.toLowerCase())?.prefer
          ? `Prefira: ${profile.preferredTerms.find((p) => p.avoid.toLowerCase() === term.toLowerCase())?.prefer}.`
          : 'Reescreva sem este termo.',
        dimension: 'cordiality',
        penalty: 10,
      });
    }
  }
  for (const pref of profile.preferredTerms) {
    if (profile.forbiddenTerms.some((f) => f.toLowerCase() === pref.avoid.toLowerCase())) continue;
    if (termRegex(pref.avoid).test(text)) {
      out.push({
        code: 'preferred_term',
        severity: 'info',
        message: `Termo com alternativa preferida: "${pref.avoid}".`,
        suggestion: `Prefira: ${pref.prefer}.`,
        dimension: 'clarity',
        penalty: 4,
      });
    }
  }
  if (text.length > profile.maxLength) {
    out.push({
      code: 'max_length_exceeded',
      severity: 'warning',
      message: `O texto tem ${text.length} caracteres e o limite da organização é ${profile.maxLength}.`,
      suggestion: 'Reduza o texto ou escolha o tamanho "curto".',
      dimension: 'objectivity',
      penalty: 15,
    });
  }
  if (!isRecordStyle(ctx.type, ctx.recipient)) {
    for (const req of profile.requiredTexts) {
      if (req.types.length && !req.types.includes(ctx.type)) continue;
      if (!text.includes(req.text)) {
        out.push({
          code: 'required_text_missing',
          severity: 'warning',
          message: 'Texto obrigatório da organização ausente.',
          suggestion: `Inclua: "${req.text.slice(0, 80)}".`,
          dimension: 'completeness',
          penalty: 15,
        });
      }
    }
  }
  return out;
}
