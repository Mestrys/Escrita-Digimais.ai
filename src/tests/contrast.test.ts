import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync('src/ui/styles/tokens.css', 'utf8');
const tokens = Object.fromEntries([...css.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1], m[2]]));

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}
function ratio(a: string, b: string): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1! + 0.05) / (l2! + 0.05);
}

describe('contraste (WCAG 2.1 AA)', () => {
  const text: [string, string][] = [
    ['color-text', 'color-bg'], ['color-text', 'color-surface'], ['color-muted', 'color-bg'], ['color-muted', 'color-surface'],
    ['color-primary-contrast', 'color-primary'], ['color-primary', 'color-bg'], ['color-danger', 'color-bg'],
    ['color-danger', 'color-danger-bg'], ['color-warning', 'color-warning-bg'], ['color-info', 'color-info-bg'],
    ['color-ok', 'color-ok-bg'], ['color-text', 'color-danger-bg'], ['color-text', 'color-warning-bg'],
    ['color-text', 'color-info-bg'], ['color-text', 'color-ok-bg'], ['color-muted', 'color-warning-bg'],
    ['color-muted', 'color-danger-bg'], ['color-muted', 'color-ok-bg'], ['color-muted', 'color-info-bg'],
  ];
  it.each(text)('texto %s sobre %s >= 4.5:1', (fg, bg) => {
    expect(tokens[fg], fg).toBeDefined();
    expect(ratio(tokens[fg]!, tokens[bg]!)).toBeGreaterThanOrEqual(4.5);
  });
  it.each([['color-border', 'color-bg'], ['color-focus', 'color-bg'], ['color-border', 'color-surface']] as [string, string][])(
    'componente %s sobre %s >= 3:1',
    (fg, bg) => expect(ratio(tokens[fg]!, tokens[bg]!)).toBeGreaterThanOrEqual(3),
  );
});
