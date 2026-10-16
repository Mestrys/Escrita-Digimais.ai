import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync('src/ui/styles/app.css', 'utf8');

/**
 * O reflow real é medido em navegador (scripts/a11y-reflow.mjs), porque o jsdom não calcula layout.
 * Este teste só impede que as regras que o corrigiram sejam removidas sem querer.
 */
describe('regras de reflow (WCAG 1.4.10 e 1.4.12)', () => {
  it('quebra palavras longas e permite que campos e fieldsets encolham', () => {
    expect(css).toMatch(/body\s*\{\s*overflow-wrap:\s*anywhere;?\s*\}/);
    expect(css).toMatch(/fieldset\s*\{\s*min-width:\s*0;?\s*\}/);
    expect(css).toMatch(/\.field,\s*\.row > \*\s*\{\s*min-width:\s*0;?\s*\}/);
    expect(css).toMatch(/input\[type='file'\]\s*\{\s*max-width:\s*100%;?\s*\}/);
  });

  it('o foco por teclado continua visível', () => {
    expect(css).toMatch(/:focus-visible\s*\{\s*outline:\s*3px solid/);
  });
});
