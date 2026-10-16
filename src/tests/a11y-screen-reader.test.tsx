import axe from 'axe-core';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppStorage } from '../infrastructure/storage';
import { App } from '../ui/App';
import { MemoryArea } from './memory-storage';

afterEach(cleanup);

function setup() {
  const user = userEvent.setup();
  const view = render(<App storage={new AppStorage(new MemoryArea(), new MemoryArea())} copy={vi.fn(async () => true)} />);
  return { user, ...view };
}

const liveNode = (container: HTMLElement): Element | null => container.querySelector('[aria-live="polite"] > span');
const liveText = (container: HTMLElement): string => liveNode(container)?.textContent ?? '';

/** Contraste é verificado em contrast.test.ts (o jsdom não calcula estilos renderizados). */
async function wcagViolations(node: Element): Promise<string[]> {
  const res = await axe.run(node, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] },
    rules: { 'color-contrast': { enabled: false } },
  });
  return res.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
}

function outline(container: HTMLElement): number[] {
  return Array.from(container.querySelectorAll('h1,h2,h3,h4,h5,h6')).map((h) => Number(h.tagName[1]));
}

function expectValidOutline(levels: number[], where: string): void {
  expect(levels.filter((l) => l === 1), `${where}: um único h1`).toHaveLength(1);
  expect(levels[0], `${where}: começa no h1`).toBe(1);
  levels.forEach((level, i) => {
    if (i > 0) expect(level, `${where}: sem pular níveis (posição ${i})`).toBeLessThanOrEqual(levels[i - 1]! + 1);
  });
}

async function generate(user: ReturnType<typeof userEvent.setup>) {
  fireEvent.change(screen.getByLabelText(/^Perguntas ao destinatário/), { target: { value: 'Qual erro aparece na tela' } });
  await user.click(screen.getByRole('button', { name: 'Gerar prévia' }));
  return screen.findByLabelText('Prévia editável');
}

describe('estrutura para leitores de tela', () => {
  it('expõe marcos de navegação: banner, principal e formulário nomeado', () => {
    setup();
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('form', { name: 'Dados do texto a gerar' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('a hierarquia de títulos é válida em todos os estados principais', async () => {
    const { user, container } = setup();
    expectValidOutline(outline(container), 'inicial');

    await user.click(screen.getByRole('button', { name: 'Configurações' }));
    expectValidOutline(outline(container), 'configurações');
    await user.click(screen.getByRole('button', { name: 'Configurações' }));

    await generate(user);
    expectValidOutline(outline(container), 'com prévia');

    await user.click(screen.getByRole('button', { name: 'Limpar tudo' }));
    expectValidOutline(outline(container), 'confirmação de limpeza');
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    fireEvent.change(screen.getByLabelText(/^Por que a informação é necessária/), { target: { value: 'ana.teste@exemplo.test senha: Abc@12345' } });
    await user.click(screen.getByRole('button', { name: 'Gerar prévia' }));
    await screen.findByText(/Geração bloqueada: foram detectadas credenciais/);
    expectValidOutline(outline(container), 'bloqueio e dados sensíveis');
  });

  it('todo controle interativo tem nome acessível, em todos os tipos de comunicação', () => {
    const { container } = setup();
    const type = screen.getByLabelText('Tipo de comunicação') as HTMLSelectElement;
    for (const option of Array.from(type.options)) {
      fireEvent.change(type, { target: { value: option.value } });
      const controls = [
        ...screen.getAllByRole('button'),
        ...screen.getAllByRole('textbox'),
        ...screen.getAllByRole('combobox'),
      ];
      expect(controls.length).toBeGreaterThan(5);
      for (const c of controls) expect(c, `${option.value}: ${c.outerHTML.slice(0, 80)}`).toHaveAccessibleName();
      const ids = Array.from(container.querySelectorAll('[id]')).map((e) => e.id);
      expect(new Set(ids).size, `${option.value}: ids repetidos`).toBe(ids.length);
    }
  });

  it('botões "Ir para o campo" dizem para qual campo levam', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Gerar prévia' }));
    await screen.findByText('Faltam informações essenciais. Nada foi inventado.');
    const buttons = screen.getAllByRole('button', { name: /^Ir para o campo/ });
    expect(buttons.length).toBeGreaterThan(0);
    for (const b of buttons) expect(b).toHaveAccessibleName(/^Ir para o campo .+/);
    const names = buttons.map((b) => b.getAttribute('aria-label'));
    expect(new Set(names).size).toBe(names.length);
  });

  it('o axe com regras WCAG 2.2 AA e boas práticas não encontra violações', async () => {
    const { user, container } = setup();
    expect(await wcagViolations(container), 'inicial').toEqual([]);
    await generate(user);
    expect(await wcagViolations(container), 'com prévia').toEqual([]);
    await user.click(screen.getByRole('button', { name: 'Limpar tudo' }));
    expect(await wcagViolations(container), 'confirmação').toEqual([]);
  });
});

describe('foco e anúncios', () => {
  it('a confirmação de limpeza recebe o foco, descreve a ação e fecha com Esc devolvendo o foco', async () => {
    const { user } = setup();
    const opener = screen.getByRole('button', { name: 'Limpar tudo' });
    await user.click(opener);
    const dialog = screen.getByRole('alertdialog', { name: 'Apagar todo o conteúdo?' });
    expect(dialog).toHaveFocus();
    expect(dialog).toHaveAccessibleDescription(/serão apagados deste painel/);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(opener).toHaveFocus();
  });

  it('Cancelar e Apagar agora também devolvem o foco ao botão de origem', async () => {
    const { user } = setup();
    const opener = screen.getByRole('button', { name: 'Limpar tudo' });
    await user.click(opener);
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(opener).toHaveFocus();
    await user.click(opener);
    await user.click(screen.getByRole('button', { name: 'Apagar agora' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(opener).toHaveFocus();
  });

  it('Esc só fecha a confirmação quando ela está aberta', async () => {
    const { user } = setup();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('anuncia as ações principais na região ao vivo', async () => {
    const { user, container } = setup();
    await generate(user);
    expect(liveText(container)).toMatch(/Prévia gerada com \d+ alerta\(s\)/);
    await user.click(screen.getByRole('button', { name: 'Revisar novamente' }));
    expect(liveText(container)).toMatch(/Revisão concluída/);
    await user.click(screen.getByRole('button', { name: 'Copiar texto' }));
    expect(liveText(container)).toBe('Texto copiado.');
  });

  it('repete um anúncio idêntico: cada anúncio é um nó novo na região', async () => {
    const { user, container } = setup();
    await generate(user);
    await user.click(screen.getByRole('button', { name: 'Copiar texto' }));
    const first = liveNode(container);
    expect(first?.textContent).toBe('Texto copiado.');
    await user.click(screen.getByRole('button', { name: 'Copiar texto' }));
    const second = liveNode(container);
    expect(second?.textContent).toBe('Texto copiado.');
    expect(second).not.toBe(first);
    expect(within(container).getAllByRole('status').length).toBeGreaterThan(0);
  });
});
