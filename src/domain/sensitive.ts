import { LOG_BLOCK_MIN_LINES } from '../config/limits';
import type { ContextField, SensitiveCategory, SensitiveFinding, TicketContext } from './types';
import { isValidCnpj, isValidCpf, passesLuhn } from './validators';

/**
 * Detecção local, conservadora e explicável de possíveis dados sensíveis.
 * Nunca afirma certeza: cada achado traz categoria, trecho mascarado, motivo e ação recomendada.
 * Nenhum valor original sai deste módulo em campos de exibição.
 */

export const CATEGORY_LABELS: Record<SensitiveCategory, string> = {
  credential: 'Possível senha ou credencial',
  token: 'Possível token de acesso',
  private_key: 'Possível chave privada',
  secret: 'Possível segredo ou chave',
  connection_string: 'Possível string de conexão',
  cpf: 'Possível CPF',
  cnpj: 'Possível CNPJ',
  email: 'Possível e-mail',
  phone: 'Possível telefone',
  address: 'Possível endereço',
  card: 'Possível número de cartão',
  bank: 'Possíveis dados bancários',
  ip: 'Possível endereço IP',
  hostname: 'Possível nome de servidor interno',
  url: 'Possível URL interna',
  path: 'Possível caminho interno',
  log_block: 'Possível bloco de log extenso',
};

interface Detector {
  id: string;
  category: SensitiveCategory;
  blocking: boolean;
  pattern: RegExp;
  /** Índice do grupo que contém o valor sensível; se ausente, usa o trecho inteiro. */
  valueGroup?: number;
  validate?: (m: RegExpMatchArray) => boolean;
  reason: string;
  action: string;
  placeholder: string;
}

const NOT_A_PASSWORD = new Set([
  'expirada', 'expirou', 'bloqueada', 'incorreta', 'invalida', 'inválida', 'errada', 'redefinida', 'alterada',
  'correta', 'resetada', 'vencida', 'nula', 'vazia', 'obrigatoria', 'obrigatória', 'ok', 'null', 'none',
  'required', 'expired', 'invalid', 'wrong', 'reset', 'changed',
]);

const SECRET_ACTION_BLOCK =
  'Remova o valor do campo. Informe apenas que a credencial foi tratada por canal seguro, sem reproduzi-la.';
const PERSONAL_ACTION = 'Confirme se o dado é necessário. Se não for, omita ou substitua por uma descrição genérica.';
const INFRA_ACTION = 'Evite expor estrutura interna. Use uma descrição funcional (por exemplo, "servidor de arquivos").';

const URL_WITH_SECRET_PARAM =
  /https?:\/\/[^\s<>"']*[?&](?:token|access_token|id_token|api[_-]?key|apikey|key|sig|signature|password|pwd|secret|auth|sessionid|session)=[^&\s"'<>]{6,}/giu;

const DETECTORS: Detector[] = [
  {
    id: 'private_key_block',
    category: 'private_key',
    blocking: true,
    pattern: /-----BEGIN (?:[A-Z]+ )*PRIVATE KEY(?: BLOCK)?-----[\s\S]*?(?:-----END (?:[A-Z]+ )*PRIVATE KEY(?: BLOCK)?-----|$)/g,
    reason: 'O trecho começa como um bloco de chave privada.',
    action: SECRET_ACTION_BLOCK,
    placeholder: '[chave privada omitida]',
  },
  {
    id: 'password_assignment',
    category: 'credential',
    blocking: true,
    pattern:
      /\b(?:[A-Za-z0-9]+[_-]){0,4}(senha|password|passwd|pwd)(?:[_-][A-Za-z0-9]+){0,3}\b(?:[ \t]+(?:tempor[áa]ria|provis[óo]ria|nova|atual|antiga|de acesso|do usu[áa]rio|da conta|do wi-?fi))?[ \t]*(:|=|é|eh|era|foi|seria|is)[ \t]*(["'“‘]?)([^\s"'”’,;]{3,})/giu,
    valueGroup: 4,
    validate: (m) => {
      const separator = (m[2] ?? '').toLowerCase();
      const quoted = Boolean(m[3]);
      const value = (m[4] ?? '').replace(/[.!?)]+$/u, '');
      if (value.length < 3) return false;
      if (NOT_A_PASSWORD.has(value.toLowerCase())) return false;
      if (separator === ':' || separator === '=') return true;
      // Formas verbais ("a senha é ...") exigem aparência de segredo para evitar falsos positivos.
      return quoted || /\d/.test(value) || /[^\p{L}\p{N}]/u.test(value) || (/\p{Ll}/u.test(value) && /\p{Lu}/u.test(value));
    },
    reason: 'Há uma atribuição de senha com valor aparente.',
    action: SECRET_ACTION_BLOCK,
    placeholder: '[credencial omitida]',
  },
  {
    id: 'url_with_credentials',
    category: 'connection_string',
    blocking: true,
    pattern: /\b[a-z][a-z0-9+.-]{1,15}:\/\/[^\s:@/]+:[^\s@/]+@[^\s]+/giu,
    reason: 'Endereço com usuário e senha embutidos.',
    action: SECRET_ACTION_BLOCK,
    placeholder: '[string de conexão omitida]',
  },
  {
    id: 'connection_string_password',
    category: 'connection_string',
    blocking: true,
    pattern: /\b(?:Server|Data Source|Host)=[^;\n]{2,};[^\n]*?\b(?:Password|Pwd)=[^;\s]+/giu,
    reason: 'String de conexão com parâmetro de senha.',
    action: SECRET_ACTION_BLOCK,
    placeholder: '[string de conexão omitida]',
  },
  {
    id: 'bearer_token',
    category: 'token',
    blocking: true,
    pattern: /\bBearer\s+[A-Za-z0-9\-._~+/]{16,}=*/gu,
    reason: 'Formato de cabeçalho Bearer com token aparente.',
    action: SECRET_ACTION_BLOCK,
    placeholder: '[token omitido]',
  },
  {
    id: 'jwt',
    category: 'token',
    blocking: true,
    pattern: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/gu,
    reason: 'Formato compatível com token JWT.',
    action: SECRET_ACTION_BLOCK,
    placeholder: '[token omitido]',
  },
  {
    id: 'known_token_prefix',
    category: 'token',
    blocking: true,
    pattern:
      /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b|\bgh[pousr]_[A-Za-z0-9]{30,}\b|\bgithub_pat_[A-Za-z0-9_]{30,}\b|\bxox[abprs]-[A-Za-z0-9-]{10,}\b|\bsk-[A-Za-z0-9_-]{20,}\b|\bAIza[0-9A-Za-z_-]{35}\b/gu,
    reason: 'Prefixo e formato típicos de chave ou token de serviço.',
    action: SECRET_ACTION_BLOCK,
    placeholder: '[token omitido]',
  },
  {
    id: 'url_secret_param',
    category: 'token',
    blocking: true,
    pattern: URL_WITH_SECRET_PARAM,
    reason: 'URL com parâmetro que costuma carregar token, chave ou senha.',
    action: SECRET_ACTION_BLOCK,
    placeholder: '[URL com segredo omitida]',
  },
  {
    id: 'secret_assignment',
    category: 'secret',
    blocking: true,
    pattern:
      /\b(?:[A-Za-z0-9]+[_-]){0,4}(?:api[_-]?key|apikey|client[_-]?secret|secret|access[_-]?token|auth[_-]?token|refresh[_-]?token|token|chave(?: de api| secreta| privada)?|segredo)(?:[_-][A-Za-z0-9]+){0,3}\b[ \t]*(:|=|é|eh)[ \t]*(["'“]?)([A-Za-z0-9\-._~+/=]{8,})/giu,
    valueGroup: 3,
    validate: (m) => {
      const value = m[3] ?? '';
      return /\d/.test(value) || value.length >= 20;
    },
    reason: 'Há uma atribuição de chave, token ou segredo com valor aparente.',
    action: SECRET_ACTION_BLOCK,
    placeholder: '[segredo omitido]',
  },
  {
    id: 'cpf',
    category: 'cpf',
    blocking: false,
    pattern: /(?<![\d.-])\d{3}\.?\d{3}\.?\d{3}-?\d{2}(?![\d-])/gu,
    validate: (m) => {
      const text = m[0];
      return /[.-]/.test(text) ? true : isValidCpf(text);
    },
    reason: 'Sequência com formato de CPF.',
    action: PERSONAL_ACTION,
    placeholder: '[CPF omitido]',
  },
  {
    id: 'cnpj',
    category: 'cnpj',
    blocking: false,
    pattern: /(?<![\d./-])\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}(?![\d-])/gu,
    validate: (m) => (/[./-]/.test(m[0]) ? true : isValidCnpj(m[0])),
    reason: 'Sequência com formato de CNPJ.',
    action: PERSONAL_ACTION,
    placeholder: '[CNPJ omitido]',
  },
  {
    id: 'email',
    category: 'email',
    blocking: false,
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}\b/gu,
    reason: 'Endereço de e-mail identifica uma pessoa ou caixa postal.',
    action: PERSONAL_ACTION,
    placeholder: '[e-mail omitido]',
  },
  {
    id: 'phone_br',
    category: 'phone',
    blocking: false,
    pattern: /(?<![\d.])(?:\+55[ .-]?)?(?:\(\d{2}\)|\d{2})[ .-]?9?\d{4}[ .-]\d{4}(?!\d)/gu,
    reason: 'Sequência com formato de telefone.',
    action: PERSONAL_ACTION,
    placeholder: '[telefone omitido]',
  },
  {
    id: 'street_address',
    category: 'address',
    blocking: false,
    pattern:
      /\b(?:rua|r\.|avenida|av\.?|alameda|travessa|rodovia|pra[çc]a|estrada)\s+[\p{L}0-9 .'-]{2,60}?,?\s*(?:n[º°o.]*\s*)?\d{1,5}\b/giu,
    reason: 'Logradouro seguido de número.',
    action: PERSONAL_ACTION,
    placeholder: '[endereço omitido]',
  },
  {
    id: 'cep',
    category: 'address',
    blocking: false,
    pattern: /(?<![\d-])\d{5}-\d{3}(?!\d)/gu,
    reason: 'Sequência com formato de CEP.',
    action: PERSONAL_ACTION,
    placeholder: '[endereço omitido]',
  },
  {
    id: 'card_number',
    category: 'card',
    blocking: false,
    pattern: /(?<![\d-])(?:\d[ -]?){12,18}\d(?![\d-])/gu,
    validate: (m) => passesLuhn(m[0]),
    reason: 'Sequência numérica compatível com número de cartão (validação de Luhn).',
    action: 'Remova o número. Nunca registre dados de cartão em chamados.',
    placeholder: '[cartão omitido]',
  },
  {
    id: 'bank_data',
    category: 'bank',
    blocking: false,
    pattern:
      /\b(?:ag[êe]ncia|agencia|ag\.|conta(?: corrente| poupan[çc]a)?|c\/c)\s*[:.]?\s*\d{3,6}(?:-?[\dxX])?\b|\bchave pix\b\s*[:=]\s*\S+/giu,
    reason: 'Indicação de agência, conta ou chave bancária.',
    action: PERSONAL_ACTION,
    placeholder: '[dado bancário omitido]',
  },
  {
    id: 'ipv4',
    category: 'ip',
    blocking: false,
    pattern: /(?<![\d.])(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)(?![\d.]*\d)/gu,
    reason: 'Endereço IP (pode também ser um número de versão).',
    action: INFRA_ACTION,
    placeholder: '[endereço IP omitido]',
  },
  {
    id: 'ipv6',
    category: 'ip',
    blocking: false,
    pattern: /\b(?:[A-Fa-f0-9]{1,4}:){7}[A-Fa-f0-9]{1,4}\b/gu,
    reason: 'Endereço IPv6.',
    action: INFRA_ACTION,
    placeholder: '[endereço IP omitido]',
  },
  {
    id: 'internal_hostname',
    category: 'hostname',
    blocking: false,
    pattern:
      /\b[a-z][a-z0-9-]*(?:\.[a-z0-9-]+)*\.(?:local|corp|internal|lan|intra|intranet|localdomain|home)\b|\b(?:srv|svr|dc|fs|sql|db|app|web|vm|ws|nb)[-_][a-z0-9][a-z0-9-]{1,}\b|\b(?:srv|svr|dc|fs|sql)\d{2,}\b/giu,
    // "DB_PASSWORD" é nome de variável de ambiente (tudo em maiúsculas, com sublinhado), não servidor.
    // Nomes de servidor seguidos de ":" ou "=" (por exemplo "srv-fin01: sem resposta") continuam detectados.
    validate: (m) => !/^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$/u.test(m[0]),
    reason: 'Nome com padrão de servidor ou domínio interno.',
    action: INFRA_ACTION,
    placeholder: '[nome de servidor omitido]',
  },
  {
    id: 'windows_path',
    category: 'path',
    blocking: false,
    pattern: /\b[A-Za-z]:\\[^\s"<>|*?]*|\\\\[A-Za-z0-9._$-]+\\[^\s"<>|*?]*/gu,
    reason: 'Caminho de arquivo ou compartilhamento de rede.',
    action: INFRA_ACTION,
    placeholder: '[caminho omitido]',
  },
  {
    id: 'unix_path',
    category: 'path',
    blocking: false,
    pattern: /(?<![\w:/.])\/(?:home|etc|var|usr|opt|srv|mnt|root|Users|tmp)\/[^\s"<>|*?]*/gu,
    reason: 'Caminho de arquivo em sistema interno.',
    action: INFRA_ACTION,
    placeholder: '[caminho omitido]',
  },
];

const URL_PATTERN = /https?:\/\/[^\s<>"']+/giu;
const PRIVATE_IPV4 = /^(?:10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.|127\.)/;
const INTERNAL_SUFFIXES = ['.local', '.corp', '.internal', '.lan', '.intra', '.intranet', '.localdomain', '.home'];

function isInternalHost(host: string, internalDomains: string[]): boolean {
  const h = host.toLowerCase();
  if (!h.includes('.')) return true;
  if (PRIVATE_IPV4.test(h)) return true;
  if (INTERNAL_SUFFIXES.some((s) => h.endsWith(s))) return true;
  return internalDomains.some((d) => {
    const dom = d.toLowerCase().replace(/^\./, '');
    return h === dom || h.endsWith('.' + dom);
  });
}

/** Mascara um valor para exibição. Segredos nunca revelam nenhum caractere. */
export function maskForDisplay(value: string, blocking: boolean): string {
  if (blocking) return `•••• (${value.length} caracteres)`;
  if (value.length <= 4) return '••••';
  const visible = value.length >= 10 ? 2 : 1;
  const hidden = Math.min(value.length - visible * 2, 8);
  return value.slice(0, visible) + '•'.repeat(hidden) + value.slice(-visible);
}

interface RawMatch {
  detector: Detector;
  start: number;
  end: number;
  value: string;
  priority: number;
}

function collectMatches(text: string, internalDomains: string[]): RawMatch[] {
  const matches: RawMatch[] = [];
  for (const detector of DETECTORS) {
    // Regex com flag 'd' para obter índices de grupos.
    const re = new RegExp(detector.pattern.source, detector.pattern.flags.includes('d') ? detector.pattern.flags : detector.pattern.flags + 'd');
    for (const m of text.matchAll(re)) {
      if (detector.validate && !detector.validate(m)) continue;
      let start = m.index ?? 0;
      let end = start + m[0].length;
      if (detector.valueGroup !== undefined) {
        const range = (m as RegExpMatchArray & { indices?: Array<[number, number] | undefined> }).indices?.[detector.valueGroup];
        if (!range) continue;
        [start, end] = range;
      }
      if (end <= start) continue;
      matches.push({
        detector,
        start,
        end,
        value: text.slice(start, end),
        priority: detector.blocking ? 2 : 1,
      });
    }
  }
  // URLs internas (sem segredo).
  for (const m of text.matchAll(URL_PATTERN)) {
    const raw = m[0].replace(/[.,;:)\]]+$/u, '');
    const hostMatch = /^https?:\/\/(?:[^@/\s]+@)?([^/:?#\s]+)/iu.exec(raw);
    const host = hostMatch?.[1];
    if (!host || !isInternalHost(host, internalDomains)) continue;
    const start = m.index ?? 0;
    matches.push({
      detector: {
        id: 'internal_url',
        category: 'url',
        blocking: false,
        pattern: URL_PATTERN,
        reason: 'Endereço web que aparenta ser de rede interna.',
        action: INFRA_ACTION,
        placeholder: '[URL interna omitida]',
      },
      start,
      end: start + raw.length,
      value: raw,
      priority: 1,
    });
  }
  return matches;
}

function resolveOverlaps(matches: RawMatch[]): RawMatch[] {
  const ordered = [...matches].sort(
    (a, b) => b.priority - a.priority || b.end - b.start - (a.end - a.start) || a.start - b.start,
  );
  const accepted: RawMatch[] = [];
  for (const candidate of ordered) {
    const overlaps = accepted.some((a) => candidate.start < a.end && a.start < candidate.end);
    if (!overlaps) accepted.push(candidate);
  }
  return accepted.sort((a, b) => a.start - b.start);
}

const LOG_LINE =
  /^\s*(?:\[?\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}|\d{2}\/\d{2}\/\d{4}[ ,]+\d{2}:\d{2}|\[?(?:INFO|WARN(?:ING)?|ERROR|DEBUG|FATAL|TRACE)\]?\b|at\s+[\w.$<>]+\()/iu;

export function looksLikeLogBlock(text: string): number {
  let count = 0;
  for (const line of text.split('\n')) {
    if (LOG_LINE.test(line)) count++;
  }
  return count;
}

export interface ScanOptions {
  field?: ContextField;
  itemIndex?: number;
  internalDomains?: string[];
}

export function scanText(text: string, options: ScanOptions = {}): SensitiveFinding[] {
  if (!text) return [];
  const resolved = resolveOverlaps(collectMatches(text, options.internalDomains ?? []));
  const findings: SensitiveFinding[] = resolved.map((m) => ({
    id: m.detector.id,
    category: m.detector.category,
    field: options.field,
    itemIndex: options.itemIndex,
    start: m.start,
    end: m.end,
    maskedExcerpt: maskForDisplay(m.value, m.detector.blocking),
    reason: m.detector.reason,
    action: m.detector.action,
    blocking: m.detector.blocking,
    replaceable: true,
    placeholder: m.detector.placeholder,
  }));
  const logLines = looksLikeLogBlock(text);
  if (logLines >= LOG_BLOCK_MIN_LINES) {
    findings.push({
      id: 'log_block',
      category: 'log_block',
      field: options.field,
      itemIndex: options.itemIndex,
      start: 0,
      end: text.length,
      maskedExcerpt: `bloco com ${logLines} linhas semelhantes a log`,
      reason: 'Blocos de log costumam conter nomes de usuário, caminhos, IPs e dados de terceiros.',
      action: 'Resuma o achado relevante em uma ou duas frases em vez de colar o log completo.',
      blocking: false,
      replaceable: false,
      placeholder: '',
    });
  }
  return findings;
}

const SCANNED_FIELDS: ContextField[] = [
  'summary', 'observedResult', 'pendingItem', 'expectedAction', 'explicitDeadline', 'notes', 'approvalObject',
  'approvalEffect', 'destinationTeam', 'escalationReason', 'freeIntent',
];
const SCANNED_LIST_FIELDS: ContextField[] = ['actions', 'evidence', 'questions'];

export function scanContext(context: TicketContext, internalDomains: string[] = []): SensitiveFinding[] {
  const findings: SensitiveFinding[] = [];
  for (const field of SCANNED_FIELDS) {
    const value = context[field];
    if (typeof value === 'string') findings.push(...scanText(value, { field, internalDomains }));
  }
  for (const field of SCANNED_LIST_FIELDS) {
    const list = context[field];
    if (Array.isArray(list)) {
      (list as string[]).forEach((item, itemIndex) => findings.push(...scanText(item, { field, itemIndex, internalDomains })));
    }
  }
  return findings;
}

/** Substitui trechos substituíveis por marcadores de omissão. Não modifica o original. */
export function applyMasking(text: string, findings: SensitiveFinding[]): string {
  const replaceable = findings.filter((f) => f.replaceable).sort((a, b) => b.start - a.start);
  let out = text;
  for (const f of replaceable) out = out.slice(0, f.start) + f.placeholder + out.slice(f.end);
  return out;
}

export function maskContext(context: TicketContext, findings: SensitiveFinding[]): TicketContext {
  const out: TicketContext = { ...context };
  const byKey = new Map<string, SensitiveFinding[]>();
  for (const f of findings) {
    if (!f.field) continue;
    const key = `${f.field}:${f.itemIndex ?? -1}`;
    byKey.set(key, [...(byKey.get(key) ?? []), f]);
  }
  for (const [key, list] of byKey) {
    const [field, idxRaw] = key.split(':') as [ContextField, string];
    const idx = Number(idxRaw);
    const current = out[field];
    if (Array.isArray(current) && idx >= 0) {
      const copy = [...current];
      copy[idx] = applyMasking(copy[idx] ?? '', list);
      (out as Record<string, unknown>)[field] = copy;
    } else if (typeof current === 'string') {
      (out as Record<string, unknown>)[field] = applyMasking(current, list);
    }
  }
  return out;
}

/**
 * Trecho de contexto em torno de um achado, com todos os achados do campo mascarados.
 * Usado pela interface para destacar sem expor o valor original.
 */
export function maskedContext(
  text: string,
  finding: SensitiveFinding,
  all: SensitiveFinding[],
  radius = 28,
): { before: string; masked: string; after: string } {
  const siblings = all.filter((f) => f !== finding && f.replaceable && f.field === finding.field && f.itemIndex === finding.itemIndex);
  const safe = (segment: string, offset: number): string => {
    let out = '';
    let cursor = 0;
    const local = siblings
      .filter((s) => s.start < offset + segment.length && s.end > offset)
      .sort((a, b) => a.start - b.start);
    for (const s of local) {
      const from = Math.max(s.start - offset, 0);
      const to = Math.min(s.end - offset, segment.length);
      if (from < cursor) continue;
      out += segment.slice(cursor, from) + s.placeholder;
      cursor = to;
    }
    return out + segment.slice(cursor);
  };
  const beforeStart = Math.max(0, finding.start - radius);
  const afterEnd = Math.min(text.length, finding.end + radius);
  const before = safe(text.slice(beforeStart, finding.start), beforeStart);
  const after = safe(text.slice(finding.end, afterEnd), finding.end);
  return {
    before: (beforeStart > 0 ? '…' : '') + before.replace(/\n/g, ' '),
    masked: finding.maskedExcerpt,
    after: after.replace(/\n/g, ' ') + (afterEnd < text.length ? '…' : ''),
  };
}
