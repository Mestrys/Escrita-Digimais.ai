/** Utilitários de texto puros, sem dependência de configuração. */

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Compila termos simples (nunca regex fornecida por terceiros) em busca por palavra inteira. */
export function termRegex(term: string): RegExp {
  const escaped = escapeRegExp(term.trim()).replace(/\s+/g, '\\s+');
  return new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'iu');
}

export function stripAccents(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export function words(text: string): string[] {
  return text.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) ?? [];
}

export function countWords(text: string): number {
  return words(text).length;
}

export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/u)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function paragraphs(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
}

export function capitalizeFirst(text: string): string {
  const idx = text.search(/\p{L}/u);
  if (idx < 0) return text;
  return text.slice(0, idx) + text.charAt(idx).toLocaleUpperCase('pt-BR') + text.slice(idx + 1);
}

export function ensureTerminalPunctuation(text: string, fallback = '.'): string {
  const trimmed = text.trim();
  if (!trimmed) return trimmed;
  return /[.!?:;…]["”')\]]?$/u.test(trimmed) ? trimmed : trimmed + fallback;
}

/** Remove a pontuação final de uma frase para encaixá-la em outra construção. */
export function stripTerminalPunctuation(text: string): string {
  return text.trim().replace(/[.!?;:,\s]+$/u, '');
}

export function ensureQuestion(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return trimmed;
  if (/\?["”')\]]?$/.test(trimmed)) return trimmed;
  return stripTerminalPunctuation(trimmed) + '?';
}

export function lowerFirst(text: string): string {
  const idx = text.search(/\p{L}/u);
  if (idx < 0) return text;
  // Preserva siglas e nomes próprios (segunda letra maiúscula).
  const second = text.charAt(idx + 1);
  if (second && second === second.toLocaleUpperCase('pt-BR') && /\p{L}/u.test(second)) return text;
  return text.slice(0, idx) + text.charAt(idx).toLocaleLowerCase('pt-BR') + text.slice(idx + 1);
}

export function numberedList(items: string[]): string {
  return items.map((item, i) => `${i + 1}. ${item}`).join('\n');
}
