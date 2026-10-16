import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  hasReviewContent, initialReviewForm, reviewInputProblem, toReviewContext,
} from '../application/review-form';
import { MAX_TOTAL_CHARS } from '../config/limits';
import { DEFAULT_PROFILE } from '../config/language-profile';
import { AppStorage } from '../infrastructure/storage';
import { App, UNDO_CLEAR_MS } from '../ui/App';
import { MemoryArea } from './memory-storage';
import { NOW } from './helpers';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function setup() {
  const local = new MemoryArea();
  const storage = new AppStorage(local, new MemoryArea());
  const user = userEvent.setup();
  render(<App storage={storage} copy={vi.fn(async () => true)} now={() => NOW} />);
  return { local, user };
}

const typeIn = (label: string | RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const openReview = (user: ReturnType<typeof userEvent.setup>) => user.click(screen.getByRole('button', { name: 'Revisar texto pronto' }));

describe('review-form (aplicação)', () => {
  it('monta o contexto de revisão a partir do perfil, sem inventar fatos', () => {
    const form = { ...initialReviewForm(), recipient: 'manager' as const, explicitDeadline: ' 20/10 ', hasEvidence: true };
    const ctx = toReviewContext(form, DEFAULT_PROFILE);
    expect(ctx.techLevel).toBe(DEFAULT_PROFILE.recipients.manager.defaultTechLevel);
    expect(ctx.explicitDeadline).toBe('20/10');
    expect(ctx.hasEvidence).toBe(true);
    expect(ctx.userConfirmation).toBe('unknown');
  });

  it('recusa texto vazio e texto grande demais', () => {
    expect(reviewInputProblem(initialReviewForm())).toMatch(/Cole ou digite/);
    expect(reviewInputProblem({ ...initialReviewForm(), text: '   ' })).toMatch(/Cole ou digite/);
    expect(reviewInputProblem({ ...initialReviewForm(), text: 'a'.repeat(MAX_TOTAL_CHARS + 1) })).toMatch(/excede/);
    expect(reviewInputProblem({ ...initialReviewForm(), text: 'Olá.' })).toBeNull();
  });

  it('detecta conteúdo para decidir se há o que desfazer', () => {
    expect(hasReviewContent(initialReviewForm())).toBe(false);
    expect(hasReviewContent({ ...initialReviewForm(), text: 'x' })).toBe(true);
  });
});

describe('modo revisar texto pronto', () => {
  it('alerta tom acusatório e não altera o texto do analista', async () => {
    const { user } = setup();
    await openReview(user);
    const original = 'Olá. Como você deveria ter lido no manual, o erro é seu.';
    typeIn('Texto a revisar', original);
    await user.click(screen.getByRole('button', { name: 'Revisar agora' }));
    const region = await screen.findByRole('region', { name: 'Resultado da revisão' });
    expect(within(region).getByRole('list', { name: 'Alertas da revisão' })).toBeInTheDocument();
    expect(within(region).getByText(/O texto original não foi alterado/)).toBeInTheDocument();
    expect((screen.getByLabelText('Texto a revisar') as HTMLTextAreaElement).value).toBe(original);
  });

  it('bloqueia o uso quando há credencial e mascara o trecho exibido', async () => {
    const { user } = setup();
    await openReview(user);
    typeIn('Texto a revisar', 'Acesse com a senha: Abc12345!x agora.');
    await user.click(screen.getByRole('button', { name: 'Revisar agora' }));
    expect(await screen.findByText(/Remova antes de usar/)).toBeInTheDocument();
    const region = screen.getByRole('region', { name: 'Resultado da revisão' });
    expect(within(region).queryByText(/Abc12345!x/)).toBeNull();
  });

  it('o contexto opcional de evidência muda o resultado', async () => {
    const { user } = setup();
    await openReview(user);
    typeIn('Texto a revisar', 'A causa raiz foi a falha do servidor de arquivos.');
    await user.click(screen.getByRole('button', { name: 'Revisar agora' }));
    expect(await screen.findByText(/Causa declarada sem evidência/)).toBeInTheDocument();
    await user.click(screen.getByLabelText(/Há evidência registrada/));
    await user.click(screen.getByRole('button', { name: 'Revisar agora' }));
    expect(screen.queryByText(/Causa declarada sem evidência/)).toBeNull();
  });

  it('pede o texto quando vazio e anuncia o problema', async () => {
    const { user } = setup();
    await openReview(user);
    await user.click(screen.getByRole('button', { name: 'Revisar agora' }));
    expect((await screen.findAllByText(/Cole ou digite o texto/)).length).toBeGreaterThan(0);
    expect(screen.queryByRole('region', { name: 'Resultado da revisão' })).toBeNull();
  });

  it('não persiste o texto revisado em nenhum armazenamento', async () => {
    const { user, local } = setup();
    await openReview(user);
    typeIn('Texto a revisar', 'Texto confidencial do chamado.');
    await user.click(screen.getByRole('button', { name: 'Revisar agora' }));
    expect(JSON.stringify(local.data)).not.toContain('confidencial');
  });

  it('alterna entre os modos sem perder o que foi digitado', async () => {
    const { user } = setup();
    await openReview(user);
    typeIn('Texto a revisar', 'Rascunho em revisão.');
    await user.click(screen.getByRole('button', { name: 'Gerar texto' }));
    expect(screen.getByRole('button', { name: 'Gerar prévia' })).toBeInTheDocument();
    await openReview(user);
    expect((screen.getByLabelText('Texto a revisar') as HTMLTextAreaElement).value).toBe('Rascunho em revisão.');
  });
});

describe('desfazer limpeza', () => {
  it('restaura o conteúdo limpo manualmente enquanto o prazo não expira', async () => {
    const { user } = setup();
    typeIn(/Perguntas ao destinatário/, 'Qual erro aparece na tela');
    await user.click(screen.getByRole('button', { name: 'Gerar prévia' }));
    await screen.findByLabelText('Prévia editável');
    await user.click(screen.getByRole('button', { name: 'Limpar' }));
    expect(screen.queryByLabelText('Prévia editável')).toBeNull();
    expect((screen.getByLabelText(/Perguntas ao destinatário/) as HTMLTextAreaElement).value).toBe('');
    await user.click(screen.getByRole('button', { name: 'Desfazer limpeza' }));
    expect((screen.getByLabelText(/Perguntas ao destinatário/) as HTMLTextAreaElement).value).toBe('Qual erro aparece na tela');
    expect(await screen.findByLabelText('Prévia editável')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Desfazer limpeza' })).toBeNull();
  });

  it('o conteúdo guardado expira sozinho e sai da memória', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    setup();
    typeIn(/Perguntas ao destinatário/, 'Qual erro aparece na tela');
    fireEvent.click(screen.getByRole('button', { name: 'Gerar prévia' }));
    await act(async () => { await vi.advanceTimersByTimeAsync(50); });
    fireEvent.click(screen.getByRole('button', { name: 'Limpar' }));
    expect(screen.getByRole('button', { name: 'Desfazer limpeza' })).toBeInTheDocument();
    await act(async () => { await vi.advanceTimersByTimeAsync(UNDO_CLEAR_MS + 100); });
    expect(screen.queryByRole('button', { name: 'Desfazer limpeza' })).toBeNull();
  });

  it('digitar depois de limpar descarta a possibilidade de desfazer', async () => {
    const { user } = setup();
    typeIn(/Perguntas ao destinatário/, 'Qual erro aparece na tela');
    await user.click(screen.getByRole('button', { name: 'Gerar prévia' }));
    await screen.findByLabelText('Prévia editável');
    await user.click(screen.getByRole('button', { name: 'Limpar' }));
    expect(screen.getByRole('button', { name: 'Desfazer limpeza' })).toBeInTheDocument();
    typeIn(/Perguntas ao destinatário/, 'Outra pergunta');
    expect(screen.queryByRole('button', { name: 'Desfazer limpeza' })).toBeNull();
  });

  it('a limpeza por inatividade não guarda nada para desfazer', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    setup();
    typeIn(/Perguntas ao destinatário/, 'Qual erro aparece na tela');
    await act(async () => { await vi.advanceTimersByTimeAsync(15 * 60_000 + 100); });
    expect((screen.getByLabelText(/Perguntas ao destinatário/) as HTMLTextAreaElement).value).toBe('');
    expect(screen.queryByRole('button', { name: 'Desfazer limpeza' })).toBeNull();
  });

  it('não oferece desfazer quando não havia conteúdo', async () => {
    const { user } = setup();
    await openReview(user);
    await user.click(screen.getByRole('button', { name: 'Limpar' }));
    expect(screen.queryByRole('button', { name: 'Desfazer limpeza' })).toBeNull();
  });
});

describe('acessibilidade do modo de revisão (axe)', () => {
  it('sem violações com resultado e com o aviso de desfazer', async () => {
    const { user } = setup();
    await openReview(user);
    typeIn('Texto a revisar', 'Como você deveria ter lido, o erro é seu. Garantimos a solução.');
    await user.click(screen.getByRole('button', { name: 'Revisar agora' }));
    await screen.findByRole('region', { name: 'Resultado da revisão' });
    await user.click(screen.getByRole('button', { name: 'Limpar' }));
    await screen.findByRole('button', { name: 'Desfazer limpeza' });
    const res = await axe.run(document.body, { rules: { 'color-contrast': { enabled: false } } });
    expect(res.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
  });
});

describe('correções da revisão de segurança e de código', () => {
  it('"Limpar tudo" com dados armazenados descarta a cópia do desfazer', async () => {
    const { user } = setup();
    typeIn(/^Perguntas ao destinatário/, 'Qual erro aparece na tela');
    await user.click(screen.getByRole('button', { name: 'Gerar prévia' }));
    await screen.findByLabelText('Prévia editável');
    await user.click(screen.getByRole('button', { name: 'Limpar', exact: true }));
    expect(screen.getByRole('button', { name: 'Desfazer limpeza' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Limpar tudo' }));
    await user.click(screen.getByLabelText(/Apagar também preferências/));
    await user.click(screen.getByRole('button', { name: 'Apagar agora' }));
    expect(screen.queryByRole('button', { name: 'Desfazer limpeza' })).toBeNull();
    expect((screen.getByLabelText(/^Perguntas ao destinatário/) as HTMLTextAreaElement).value).toBe('');
  });

  it('mudar qualquer contexto da revisão invalida o resultado exibido', async () => {
    const { user } = setup();
    await openReview(user);
    typeIn('Texto a revisar', 'A causa raiz foi a falha do servidor.');
    await user.click(screen.getByRole('button', { name: 'Revisar agora' }));
    expect(await screen.findByRole('region', { name: 'Resultado da revisão' })).toBeInTheDocument();
    await user.click(screen.getByLabelText(/Há evidência registrada/));
    expect(screen.queryByRole('region', { name: 'Resultado da revisão' })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Revisar agora' }));
    expect(await screen.findByRole('region', { name: 'Resultado da revisão' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Confirmação do usuário'), { target: { value: 'yes' } });
    expect(screen.queryByRole('region', { name: 'Resultado da revisão' })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Revisar agora' }));
    expect(await screen.findByRole('region', { name: 'Resultado da revisão' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Prazo já definido/), { target: { value: '20/10' } });
    expect(screen.queryByRole('region', { name: 'Resultado da revisão' })).toBeNull();
  });

  it('"Limpar" no modo de revisão preserva o formulário de geração e permite desfazer', async () => {
    const { user } = setup();
    typeIn(/^Perguntas ao destinatário/, 'Pergunta do modo de geração');
    await openReview(user);
    typeIn('Texto a revisar', 'Texto em revisão.');
    await user.click(screen.getByRole('button', { name: 'Limpar', exact: true }));
    expect((screen.getByLabelText('Texto a revisar') as HTMLTextAreaElement).value).toBe('');
    await user.click(screen.getByRole('button', { name: 'Gerar texto' }));
    expect((screen.getByLabelText(/^Perguntas ao destinatário/) as HTMLTextAreaElement).value).toBe('Pergunta do modo de geração');
    await user.click(screen.getByRole('button', { name: 'Desfazer limpeza' }));
    await openReview(user);
    expect((screen.getByLabelText('Texto a revisar') as HTMLTextAreaElement).value).toBe('Texto em revisão.');
  });

  it('confirmar a limpeza sem nada preenchido ainda anuncia o resultado', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Limpar tudo' }));
    await user.click(screen.getByRole('button', { name: 'Apagar agora' }));
    expect(document.querySelector('[aria-live="polite"]')?.textContent).toMatch(/Não há conteúdo para limpar/);
  });

  it('o modo de revisão abre com um tipo voltado ao usuário, coerente com o destinatário padrão', async () => {
    const { user } = setup();
    await openReview(user);
    expect((screen.getByLabelText('Tipo de comunicação') as HTMLSelectElement).value).toBe('progress_update');
    expect((screen.getByLabelText('Destinatário') as HTMLSelectElement).value).toBe('user');
  });
});

