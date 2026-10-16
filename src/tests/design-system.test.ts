import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const dir = 'src/ui/styles';
const sheets = readdirSync(dir).filter((f) => f.endsWith('.css'));
const fonts = readFileSync(join(dir, 'fonts.css'), 'utf8');
const app = readFileSync(join(dir, 'app.css'), 'utf8');

describe('sistema de design (Material Design 3, Google Sans Flex)', () => {
  it('folhas de estilo não usam @import, URLs remotas nem data:', () => {
    for (const f of sheets) {
      const text = readFileSync(join(dir, f), 'utf8');
      expect(text, f).not.toMatch(/@import/);
      expect(text, f).not.toMatch(/(?:https?:)?\/\/[\w-]+\.[a-z]/i);
      expect(text, f).not.toMatch(/url\(\s*['"]?data:/i);
    }
  });

  it('a fonte vem de arquivo local existente, com fontes de reserva no token', () => {
    const files = [...fonts.matchAll(/url\('([^']+\.woff2)'\)/g)].map((m) => m[1]!);
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) expect(existsSync(join(dir, f)), f).toBe(true);
    const tokens = readFileSync(join(dir, 'tokens.css'), 'utf8');
    expect(tokens).toMatch(/--md-sys-typescale-font:\s*'Google Sans Flex Variable'.*sans-serif;/);
  });

  it('a licença OFL da fonte acompanha o pacote', () => {
    const shipped = readFileSync('public/licenses/google-sans-flex-OFL.txt', 'utf8');
    const upstream = readFileSync('node_modules/@fontsource-variable/google-sans-flex/LICENSE', 'utf8');
    expect(shipped).toBe(upstream);
    expect(shipped).toContain('SIL OPEN FONT LICENSE Version 1.1');
  });

  it('respeita movimento reduzido, contraste alto e cores forçadas', () => {
    expect(app).toMatch(/@media \(prefers-reduced-motion: reduce\)/);
    expect(app).toMatch(/@media \(forced-colors: active\)/);
    expect(readFileSync(join(dir, 'tokens.css'), 'utf8')).toMatch(/@media \(prefers-contrast: more\)/);
  });

  it('a ação destrutiva em contêiner colorido tem estilo próprio e não herda a cor do contêiner', () => {
    expect(app).toMatch(/\.panel\.warn button:not\(\.danger\)/);
    expect(app).toMatch(/\.panel button\.danger\s*\{[^}]*background:\s*var\(--md-sys-color-error\)/);
  });

  it('alvos pequenos foram ampliados (caixa de seleção e resumo)', () => {
    expect(app).toMatch(/input\[type='checkbox'\]\s*\{[^}]*width:\s*1\.25rem/);
    expect(app).toMatch(/summary\s*\{[^}]*padding:\s*0\.5rem 0/);
  });

  it('o foco por teclado continua visível e o clique tem resposta imediata', () => {
    expect(app).toMatch(/:focus-visible\s*\{\s*outline:\s*3px solid/);
    expect(app).toMatch(/button:active::after\s*\{[^}]*transition:\s*none/);
  });
});
