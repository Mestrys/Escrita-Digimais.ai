export const COMMUNICATION_TYPES = [
  'request_information',
  'technical_note',
  'pending',
  'manager_approval',
  'progress_update',
  'solution_confirmation',
  'closure_resolved',
  'closure_no_response',
  'redirect_or_escalate',
  'guided_free_text',
] as const;
export type CommunicationType = (typeof COMMUNICATION_TYPES)[number];

export const RECIPIENTS = ['user', 'manager', 'technical_team', 'vendor', 'other'] as const;
export type Recipient = (typeof RECIPIENTS)[number];

export const TECH_LEVELS = ['simple', 'balanced', 'technical'] as const;
export type TechLevel = (typeof TECH_LEVELS)[number];

export const FORMALITIES = ['cordial', 'formal', 'direct'] as const;
export type Formality = (typeof FORMALITIES)[number];

export const LENGTHS = ['short', 'standard', 'detailed'] as const;
export type LengthMode = (typeof LENGTHS)[number];

export const TEXT_STYLES = ['natural', 'structured'] as const;
/** Natural: frases de ligação e voz da equipe. Estruturado: rótulos fixos, como nas versões anteriores. */
export type TextStyle = (typeof TEXT_STYLES)[number];

export type UserConfirmation = 'yes' | 'no' | 'unknown';

export interface TicketContext {
  summary?: string;
  actions?: string[];
  observedResult?: string;
  pendingItem?: string;
  expectedAction?: string;
  explicitDeadline?: string;
  evidence?: string[];
  notes?: string;
  // Extensões específicas por tipo (todas opcionais).
  questions?: string[];
  approvalObject?: string;
  approvalEffect?: string;
  /** Datas das tentativas de contato, uma por entrada (DD/MM/AAAA ou AAAA-MM-DD). */
  contactAttempts?: string[];
  priorNoticeDate?: string;
  userConfirmation?: UserConfirmation;
  destinationTeam?: string;
  escalationReason?: string;
  freeIntent?: string;
  /** Nome de quem recebe o texto. Usado somente na saudação. */
  requesterName?: string;
}
export type ContextField = keyof TicketContext;

export interface GenerationSettings {
  type: CommunicationType;
  recipient: Recipient;
  techLevel: TechLevel;
  formality: Formality;
  length: LengthMode;
  /** Índice de variação controlada dos templates (determinístico). */
  variant?: number;
  /** Padrão: natural. */
  style?: TextStyle;
}

export interface GenerationInput {
  settings: GenerationSettings;
  context: TicketContext;
}

export type Severity = 'info' | 'warning' | 'block';
export type QualityDimension = 'clarity' | 'objectivity' | 'cordiality' | 'completeness' | 'safety';

export interface Warning {
  code: string;
  severity: Severity;
  message: string;
  suggestion?: string;
  field?: ContextField;
  /** Sempre mascarado. Nunca contém o dado sensível original. */
  excerpt?: string;
  /** Trecho exato que acionou a regra, sempre uma parte de `excerpt`. Permite destacar só o gatilho. */
  trigger?: string;
  dimension?: QualityDimension;
  penalty?: number;
}

export interface TriggeredRule {
  code: string;
  dimension: QualityDimension;
  penalty: number;
  severity: Severity;
  message: string;
  suggestion?: string;
}

export interface QualityScore {
  clarity: number;
  objectivity: number;
  cordiality: number;
  completeness: number;
  safety: number;
  triggeredRules: TriggeredRule[];
}

export type SensitiveCategory =
  | 'credential'
  | 'token'
  | 'private_key'
  | 'secret'
  | 'connection_string'
  | 'cpf'
  | 'cnpj'
  | 'email'
  | 'phone'
  | 'address'
  | 'card'
  | 'bank'
  | 'ip'
  | 'hostname'
  | 'url'
  | 'path'
  | 'log_block';

export interface SensitiveFinding {
  id: string;
  category: SensitiveCategory;
  field?: ContextField;
  itemIndex?: number;
  start: number;
  end: number;
  maskedExcerpt: string;
  reason: string;
  action: string;
  blocking: boolean;
  /** Se pode ser substituído por um marcador de omissão. */
  replaceable: boolean;
  /** Marcador textual usado na omissão, por exemplo "[e-mail omitido]". */
  placeholder: string;
}

export type BlockReason =
  | 'sensitive_data'
  | 'missing_information'
  | 'policy'
  | 'inconsistent'
  | 'unsafe_content'
  | 'input_too_long';

export interface GenerationResult {
  text: string;
  warnings: Warning[];
  /** Perguntas objetivas ao analista sobre informações essenciais ausentes. */
  missingInformation: string[];
  missingFields: ContextField[];
  quality: QualityScore;
  blocked: boolean;
  blockReason?: BlockReason;
  sensitiveFindings: SensitiveFinding[];
  meta: { engine: string; profileVersion: string; templatesVersion: string };
}

// ---------- Perfil de linguagem organizacional ----------

export type LabelKey =
  | 'context'
  | 'justification'
  | 'actions_done'
  | 'actions_planned'
  | 'result'
  | 'pending'
  | 'depends_on'
  | 'questions'
  | 'expected_action'
  | 'deadline'
  | 'evidence'
  | 'notes'
  | 'approval_object'
  | 'approval_effect'
  | 'attempts'
  | 'notice'
  | 'reason';

export interface TemplateOverrides {
  openings?: Partial<Record<CommunicationType, Partial<Record<Formality, string[]>>>>;
  typeClosings?: Partial<Record<CommunicationType, Partial<Record<Formality, string[]>>>>;
  labels?: Partial<Record<TechLevel, Partial<Record<LabelKey, string>>>>;
}

export interface RecipientProfile {
  displayName: string;
  defaultTechLevel: TechLevel;
  defaultFormality: Formality;
  allowJargon: boolean;
}

export interface ClosureRules {
  noResponseEnabled: boolean;
  minAttempts: number;
  requirePriorNotice: boolean;
  minDaysAfterNotice: number;
  reopenInstruction: string;
}

export interface LanguageProfile {
  schemaVersion: 1;
  profileVersion: string;
  organizationName: string;
  categoryNames: Record<CommunicationType, string>;
  greetings: Record<Formality, Record<Recipient, string>>;
  closings: Record<Formality, string[]>;
  signature: string;
  recipients: Record<Recipient, RecipientProfile>;
  preferredTerms: { avoid: string; prefer: string }[];
  forbiddenTerms: string[];
  requiredTexts: { text: string; types: CommunicationType[] }[];
  privacyNotice: { text: string; types: CommunicationType[] };
  maxLength: number;
  closureRules: ClosureRules;
  knownAcronyms: string[];
  internalDomains: string[];
  templates: TemplateOverrides;
}
