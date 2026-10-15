import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generateWithFallback, LocalProvider } from '../application/provider';
import { DEFAULT_PROFILE } from '../config/language-profile';
import { COMMUNICATION_TYPES } from '../domain/types';
import { AppStorage } from '../infrastructure/storage';
import { App } from '../ui/App';
import { gen, settings } from './helpers';
import { MemoryArea } from './memory-storage';

const spies = {
  fetch: vi.fn(),
  xhr: vi.fn(),
  ws: vi.fn(),
  beacon: vi.fn(),
  es: vi.fn(),
};

beforeEach(() => {
  vi.stubGlobal('fetch', spies.fetch);
  vi.stubGlobal('XMLHttpRequest', spies.xhr);
  vi.stubGlobal('WebSocket', spies.ws);
  vi.stubGlobal('EventSource', spies.es);
  Object.defineProperty(navigator, 'sendBeacon', { value: spies.beacon, configurable: true });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  Object.values(spies).forEach((s) => s.mockClear());
});

const noCalls = () => Object.entries(spies).forEach(([name, s]) => expect(s, name).not.toHaveBeenCalled());

describe('sem chamadas de rede no modo local', () => {
  it('motor e provedor local', async () => {
    for (const type of COMMUNICATION_TYPES) {
      gen(type, { summary: 'Teste.', actions: ['Ação'], observedResult: 'Ok', questions: ['Qual o erro exibido?'] });
      await generateWithFallback(new LocalProvider(), {
        input: { settings: settings(type), context: { summary: 'Teste ana.teste@exemplo.test' } },
        profile: DEFAULT_PROFILE,
      });
    }
    noCalls();
  });

  it('interface completa (gerar, revisar, copiar, configurar)', async () => {
    const user = userEvent.setup();
    render(<App storage={new AppStorage(new MemoryArea(), new MemoryArea())} copy={vi.fn(async () => true)} />);
    fireEvent.change(screen.getByLabelText(/Perguntas ao destinatário/), { target: { value: 'Qual erro aparece na tela' } });
    await user.click(screen.getByRole('button', { name: 'Gerar prévia' }));
    await screen.findByLabelText('Prévia editável');
    await user.click(screen.getByRole('button', { name: 'Revisar novamente' }));
    await user.click(screen.getByRole('button', { name: 'Copiar texto' }));
    await user.click(screen.getByRole('button', { name: 'Configurações' }));
    noCalls();
  });
});

describe('análise estática do código-fonte', () => {
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((n) => {
      const p = join(dir, n);
      return statSync(p).isDirectory() ? (n === 'tests' ? [] : walk(p)) : [p];
    });
  const files = walk('src').filter((f) => /\.(ts|tsx)$/.test(f));

  it.each([
    [/\bfetch\s*\(/, 'fetch'],
    [/\bXMLHttpRequest\b/, 'XMLHttpRequest'],
    [/\bWebSocket\b/, 'WebSocket'],
    [/\bEventSource\b/, 'EventSource'],
    [/\bsendBeacon\b/, 'sendBeacon'],
    [/\beval\s*\(/, 'eval'],
    [/new\s+Function\s*\(/, 'new Function'],
    [/\bimportScripts\b/, 'importScripts'],
    [/https?:\/\//, 'URL remota'],
    [/dangerouslySetInnerHTML|innerHTML\s*=/, 'HTML não sanitizado'],
    [/chrome\.(tabs|scripting|history|cookies|webRequest)\b/, 'API fora do escopo'],
    [/localStorage|sessionStorage|indexedDB/, 'armazenamento fora da allowlist'],
  ])('não usa %s', (re) => {
    const hits = files.filter((f) => re.test(readFileSync(f, 'utf8')));
    expect(hits).toEqual([]);
  });

  it('não contém segredos ou chaves de API', () => {
    const hits = files.filter((f) => /(?:AKIA[0-9A-Z]{16}|sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{30,}|-----BEGIN [A-Z ]*PRIVATE KEY)/.test(readFileSync(f, 'utf8')));
    expect(hits).toEqual([]);
  });
});
