import type { MessagePlan, PlannedSection } from './planner';
import { numberedList } from './text-utils';

function renderSection(s: PlannedSection): string {
  if (s.items?.length) {
    if (s.items.length === 1) return s.label ? `${s.label}: ${s.items[0]}` : (s.items[0] ?? '');
    return `${s.label ? `${s.label}:\n` : ''}${numberedList(s.items)}`;
  }
  const text = s.text ?? '';
  if (!s.label) return text;
  return text.includes('\n') ? `${s.label}:\n${text}` : `${s.label}: ${text}`;
}

/** Renderização: apenas formata o plano. Não decide conteúdo. */
export function renderPlan(plan: MessagePlan): string {
  let out = '';
  let previous: PlannedSection | undefined;
  for (const section of plan.sections) {
    const piece = renderSection(section);
    if (!piece) continue;
    if (previous) {
      const sameParagraph =
        previous.group !== undefined && previous.group === section.group && !previous.items?.length && !section.items?.length &&
        !out.endsWith('\n') && !piece.includes('\n');
      if (sameParagraph) out += ' ';
      else out += previous.kind === 'courtesy' && section.kind === 'signature' ? '\n' : '\n\n';
    }
    out += piece;
    previous = section;
  }
  return out.trim();
}
