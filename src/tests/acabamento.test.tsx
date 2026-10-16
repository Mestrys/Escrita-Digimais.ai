import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_PROFILE } from '../config/language-profile';
import { reviewText } from '../domain/review';
import type { ReviewContext } from '../domain/risks';
import { AppStorage } from '../infrastructure/storage';
import { App } from '../ui/App';
import { WarningsList } from '../ui/components/ReviewPanel';
import { NOW } from './helpers';
import { MemoryArea } from './memory-storage';

afterEach(() => cleanup());

const ctx: ReviewContext = { type: 'progress_update', recipient: 'user', techLevel: 'simple' };
const codesOf = (text: string): string[] => reviewText(text, ctx, DEFAULT_PROFILE).warnings.map((w) => w.code);

describe('caixa alta e siglas em nomes de variável', () => {
  it('não alerta ênfase nem sigla para identificadores, e o bloqueio da credencial continua', () => {
    const pwd = ['hunter', '2022', 'x'].join('');
    const r = reviewText(`No script ficou DB_PASSWORD=${pwd} e também API_KEY definido.`, ctx, DEFAULT_PROFILE);
    const codes = r.warnings.map((w) => w.code);
    expect(codes).not.toContain('all_caps_emphasis');
    expect(codes).not.toContain('unexplained_acronym');
    expect(r.blocked).toBe(true);
  });

  it('identificadores sem segredo também deixam de alertar', () => {
    const codes = codesOf('Ajustamos JAVA_HOME e PATH=C para a aplicação voltar.');
    expect(codes).not.toContain('all_caps_emphasis');
    expect(codes).not.toContain('unexplained_acronym');
  });

  it('ênfase e sigla reais continuam sendo alertadas', () => {
    expect(codesOf('Isso é URGENTE e PRECISA de atenção.')).toContain('all_caps_emphasis');
    expect(codesOf('A VPN caiu e o SSO também.')).toContain('unexplained_acronym');
    expect(codesOf('Ajustamos DB_HOST, mas a PRECISA continua. Veja a VPN.')).toEqual(
      expect.arrayContaining(['all_caps_emphasis', 'unexplained_acronym']),
    );
  });
});

describe('destaque só do gatilho', () => {
  it('o gatilho é parte exata do contexto', () => {
    const r = reviewText('Garantimos que isso não vai acontecer novamente em nenhuma situação.', { ...ctx, techLevel: 'balanced' }, DEFAULT_PROFILE);
    const w = r.warnings.find((x) => x.trigger);
    expect(w).toBeDefined();
    expect(w?.excerpt).toContain(w?.trigger ?? '\u0000');
    expect((w?.trigger ?? '').length).toBeLessThan((w?.excerpt ?? '').length);
  });

  it('a lista marca só o gatilho e mantém o resto como texto comum', () => {
    const { container } = render(
      <WarningsList warnings={[{ code: 'x', severity: 'warning', message: 'Aviso.', excerpt: '…isso é URGENTE e grave…', trigger: 'URGENTE' }]} />,
    );
    const marks = container.querySelectorAll('mark');
    expect(marks).toHaveLength(1);
    expect(marks[0]?.textContent).toBe('URGENTE');
    expect(container.textContent).toContain('…isso é URGENTE e grave…');
  });

  it('sem gatilho, ou com gatilho fora do trecho, destaca o trecho inteiro', () => {
    const { container } = render(
      <WarningsList warnings={[
        { code: 'a', severity: 'info', message: 'A.', excerpt: 'trecho mascarado [e-mail omitido]' },
        { code: 'b', severity: 'info', message: 'B.', excerpt: 'outro trecho', trigger: 'ausente' },
      ]} />,
    );
    expect([...container.querySelectorAll('mark')].map((m) => m.textContent)).toEqual(['trecho mascarado [e-mail omitido]', 'outro trecho']);
  });
});

describe('interface de acabamento', () => {
  const setup = (initial: Record<string, unknown> = {}) => {
    const local = new MemoryArea(initial);
    const user = userEvent.setup();
    render(<App storage={new AppStorage(local, new MemoryArea())} now={() => NOW} />);
    return { user };
  };

  it('seletor de modo segmentado mantém os botões com estado pressionado', () => {
    setup();
    const group = screen.getByRole('group', { name: 'Modo de uso' });
    expect(group).toHaveClass('segmented');
    expect(within(group).getByRole('button', { name: 'Gerar texto' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(group).getByRole('button', { name: 'Revisar texto pronto' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('os três botões de limpar têm nomes distintos por escopo', async () => {
    const { user } = setup();
    fireEventTyping();
    await user.click(screen.getByRole('button', { name: 'Gerar prévia' }));
    await screen.findByLabelText('Prévia editável');
    const names = ['Limpar tudo', 'Limpar formulário e prévia'];
    for (const n of names) expect(screen.getAllByRole('button', { name: n })).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Revisar texto pronto' }));
    expect(screen.getByRole('button', { name: 'Limpar revisão' })).toBeInTheDocument();
  });

  it('ações secundárias ficam em "Mais ações"', async () => {
    const { user } = setup();
    fireEventTyping();
    await user.click(screen.getByRole('button', { name: 'Gerar prévia' }));
    await screen.findByLabelText('Prévia editável');
    const more = screen.getByText('Mais ações').closest('details');
    expect(more).not.toBeNull();
    for (const n of ['Restaurar modelo', 'Comparar com o texto inicial', 'Limpar formulário e prévia']) {
      expect(within(more as HTMLElement).getByRole('button', { name: n })).toBeInTheDocument();
    }
    for (const n of ['Copiar texto', 'Revisar novamente', 'Outra variação']) {
      expect(within(more as HTMLElement).queryByRole('button', { name: n })).toBeNull();
      expect(screen.getByRole('button', { name: n })).toBeInTheDocument();
    }
  });

  it('a legenda das preferências descreve tudo o que é guardado', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Configurações' }));
    expect(screen.queryByText(/únicos dados salvos/)).toBeNull();
    expect(screen.getByText(/Conteúdo de chamado nunca é guardado/)).toBeInTheDocument();
  });

  it('a camada ativa lista as regras que acrescenta', async () => {
    const { user } = setup({
      profileOverlay: {
        schemaVersion: 1, overlayName: 'Equipe Redes', forbiddenTerms: ['a', 'b'], maxLength: 1500,
        closureRules: { noResponseEnabled: false, minAttempts: 4 },
      },
    });
    await user.click(screen.getByRole('button', { name: 'Configurações' }));
    const list = await screen.findByRole('list', { name: 'Regras acrescentadas pela camada' });
    const items = within(list).getAllByRole('listitem').map((li) => li.textContent);
    expect(items).toEqual([
      '2 termos proibidos',
      'Tamanho máximo de até 1500 caracteres (vale o menor)',
      'Encerramento por ausência de retorno desligado',
      'Pelo menos 4 tentativas antes de encerrar por ausência de retorno',
    ]);
  });
});

function fireEventTyping(): void {
  const field = screen.getByLabelText(/Perguntas ao destinatário/) as HTMLTextAreaElement;
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
  setter?.call(field, 'Qual mensagem de erro aparece na tela');
  field.dispatchEvent(new Event('input', { bubbles: true }));
  const why = screen.getByLabelText(/Por que a informação é necessária/) as HTMLTextAreaElement;
  setter?.call(why, 'Erro ao abrir a planilha de custos.');
  why.dispatchEvent(new Event('input', { bubbles: true }));
}
