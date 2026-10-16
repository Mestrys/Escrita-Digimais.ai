/* global document, CSSStyleSheet -- usados dentro de page.evaluate, que roda no navegador */
// Verificação manual de reflow em navegador real (WCAG 1.4.10 e 1.4.12). Não roda no CI.
// Uso: npm run build && node scripts/a11y-reflow.mjs [dist]
// Requer o Playwright instalado (PLAYWRIGHT_MODULE pode apontar para o módulo) e carrega a extensão em Chromium.
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
const dist = resolve(root, process.argv[2] ?? 'dist');
let chromium;
try {
  ({ chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright'));
} catch {
  console.error('Playwright não encontrado. Instale-o ou aponte PLAYWRIGHT_MODULE para o módulo.');
  process.exit(2);
}

const ctx = await chromium.launchPersistentContext('', {
  channel: 'chromium',
  headless: true,
  viewport: { width: 320, height: 640 },
  args: [`--disable-extensions-except=${dist}`, `--load-extension=${dist}`],
});
let [sw] = ctx.serviceWorkers();
if (!sw) sw = await ctx.waitForEvent('serviceworker', { timeout: 10000 });
const page = await ctx.newPage();
await page.goto(`chrome-extension://${new URL(sw.url()).host}/sidepanel.html`);

let failures = 0;
const measure = async (label) => {
  const r = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const outside = [...document.querySelectorAll('body *')]
      .filter((e) => {
        if (e.closest('.visually-hidden')) return false;
        const b = e.getBoundingClientRect();
        return b.width > 0 && (b.right > vw + 1 || b.left < -1);
      })
      .map((e) => `${e.tagName.toLowerCase()}${e.id ? `#${e.id}` : ''}`)
      .slice(0, 5);
    return { vw, scrollWidth: document.documentElement.scrollWidth, outside };
  });
  const ok = r.scrollWidth <= r.vw && r.outside.length === 0;
  if (!ok) failures += 1;
  console.log(`${ok ? 'OK    ' : 'FALHA '} ${label}${ok ? '' : ` (rolagem ${r.scrollWidth} > ${r.vw}; fora da tela: ${r.outside.join(', ')})`}`);
};

await measure('inicial a 320 px');
await page.getByLabel(/^Perguntas ao destinatário/).fill('Qual erro aparece na tela com uma pergunta bem longa para testar a quebra de linha do campo');
await page.getByRole('button', { name: 'Gerar prévia', exact: true }).click();
await page.getByLabel('Prévia editável').waitFor();
await measure('com prévia, alertas e indicadores');
await page.getByRole('button', { name: 'Comparar com o texto inicial' }).click();
await measure('com comparação');
await page.getByRole('button', { name: 'Configurações' }).click();
await measure('configurações abertas');
await page.getByRole('button', { name: 'Limpar tudo' }).click();
await measure('confirmação de limpeza');
// Espaçamento de texto do usuário (1.4.12), por folha construída: a CSP da extensão bloqueia <style> injetado.
await page.evaluate(() => {
  const sheet = new CSSStyleSheet();
  sheet.replaceSync('*{line-height:1.5 !important;letter-spacing:.12em !important;word-spacing:.16em !important} p{margin-bottom:2em !important}');
  document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
});
await measure('espaçamento de texto do usuário');
await page.evaluate(() => {
  document.documentElement.style.fontSize = '200%';
});
await measure('fonte a 200% com espaçamento');
await ctx.close();
process.exit(failures ? 1 : 0);
