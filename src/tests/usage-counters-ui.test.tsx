import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { UsagePolicy } from '../application/usage-counters';
import { AppStorage } from '../infrastructure/storage';
import { loadUsagePolicy } from '../infrastructure/policy';
import { App } from '../ui/App';
import { MemoryArea } from './memory-storage';
import { NOW } from './helpers';

afterEach(() => cleanup());

const SEGREDO = 'Texto exclusivo do analista 7Q9Z';

function setup(initial: Record<string, unknown> = {}, policy: UsagePolicy = 'optional') {
  const local = new MemoryArea(initial);
  const storage = new AppStorage(local, new MemoryArea());
  const user = userEvent.setup();
  const copy = vi.fn(async () => true);
  render(<App storage={storage} copy={copy} now={() => NOW} loadUsage={async () => policy} />);
  return { local, user };
}

async function generate(user: ReturnType<typeof userEvent.setup>) {
  fireEvent.change(screen.getByLabelText(/Por que a informação é necessária/), { target: { value: `Erro ao abrir a planilha. ${SEGREDO}` } });
  fireEvent.change(screen.getByLabelText(/Perguntas ao destinatário/), { target: { value: 'Qual mensagem de erro aparece na tela\nO erro ocorre com outros arquivos' } });
  await user.click(screen.getByRole('button', { name: 'Gerar prévia' }));
  await screen.findByLabelText('Prévia editável');
}

const counters = (local: MemoryArea) => local.data.usageCounters as { counts: Record<string, number> } | undefined;

describe('contadores de uso na interface', () => {
  it('desligado por padrão: gerar e copiar não grava nada', async () => {
    const { local, user } = setup();
    await generate(user);
    await user.click(screen.getByRole('button', { name: 'Copiar texto' }));
    await user.click(screen.getByRole('button', { name: 'Outra variação' }));
    expect(local.data.usageCounters).toBeUndefined();
  });

  it('com opt-in grava contagens numéricas e nenhum texto digitado', async () => {
    const { local, user } = setup({ preferences: { usageCounters: true } });
    await generate(user);
    await user.click(screen.getByRole('button', { name: 'Copiar texto' }));
    await user.click(screen.getByRole('button', { name: 'Revisar novamente' }));
    await waitFor(() => expect(counters(local)?.counts.copy).toBe(1));
    const c = counters(local)!.counts;
    expect(c['generate.request_information']).toBe(1);
    expect(c.review_again).toBe(1);
    expect(Object.keys(c).some((k) => k.startsWith('time_to_copy.'))).toBe(true);
    expect(Object.values(c).every((v) => Number.isInteger(v))).toBe(true);
    const dump = JSON.stringify(local.data);
    expect(dump).not.toContain(SEGREDO);
    expect(dump).not.toMatch(/planilha|Qual mensagem/);
  });

  it('geração bloqueada conta pelo motivo, sem guardar o dado sensível', async () => {
    const { local, user } = setup({ preferences: { usageCounters: true } });
    const token = ['ghp', 'A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8'].join('_');
    fireEvent.change(screen.getByLabelText(/Por que a informação é necessária/), { target: { value: `Token ${token} no script` } });
    await user.click(screen.getByRole('button', { name: 'Gerar prévia' }));
    await waitFor(() => expect(Object.keys(counters(local)?.counts ?? {}).some((k) => k.startsWith('blocked.'))).toBe(true));
    expect(JSON.stringify(local.data)).not.toContain(token);
  });

  it('política "off" impede a gravação mesmo com preferência ligada e esconde a opção', async () => {
    const { local, user } = setup({ preferences: { usageCounters: true } }, 'off');
    await generate(user);
    await user.click(screen.getByRole('button', { name: 'Copiar texto' }));
    expect(local.data.usageCounters).toBeUndefined();
    await user.click(screen.getByRole('button', { name: /Configurações/ }));
    expect(await screen.findByText(/desligados pela política da organização/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Registrar contadores de uso/)).not.toBeInTheDocument();
  });

  it('política "on" grava sem opt-in do analista', async () => {
    const { local, user } = setup({}, 'on');
    await generate(user);
    await waitFor(() => expect(counters(local)?.counts['generate.request_information']).toBe(1));
  });

  it('o analista liga, vê o total e zera', async () => {
    const { local, user } = setup();
    await user.click(screen.getByRole('button', { name: /Configurações/ }));
    await user.click(await screen.findByLabelText(/Registrar contadores de uso/));
    await waitFor(() => expect((local.data.preferences as { usageCounters?: boolean }).usageCounters).toBe(true));
    await user.click(screen.getByRole('button', { name: /Configurações/ }));
    await generate(user);
    await waitFor(() => expect(counters(local)).toBeDefined());
    await user.click(screen.getByRole('button', { name: /Configurações/ }));
    await user.click(await screen.findByRole('button', { name: 'Zerar contadores' }));
    await waitFor(() => expect(local.data.usageCounters).toBeUndefined());
    expect(await screen.findByText('Total registrado: 0')).toBeInTheDocument();
  });

  it('lê a política gerenciada e usa "optional" quando ausente ou inválida', async () => {
    const original = (globalThis as { chrome?: unknown }).chrome;
    const withManaged = (value: unknown) => {
      (globalThis as { chrome?: unknown }).chrome = { storage: { managed: { get: async () => ({ usageCounters: value }) } } };
    };
    try {
      for (const v of ['off', 'on', 'optional']) {
        withManaged(v);
        expect(await loadUsagePolicy()).toBe(v);
      }
      withManaged('talvez');
      expect(await loadUsagePolicy()).toBe('optional');
      (globalThis as { chrome?: unknown }).chrome = { storage: { managed: { get: async () => { throw new Error('x'); } } } };
      expect(await loadUsagePolicy()).toBe('optional');
    } finally {
      (globalThis as { chrome?: unknown }).chrome = original;
    }
  });
});
