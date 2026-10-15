import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_PROFILE } from '../config/language-profile';
import { exportProfileJson } from '../config/profile-schema';
import { AppStorage } from '../infrastructure/storage';
import { App } from '../ui/App';
import { Popup } from '../ui/Popup';
import { MemoryArea } from './memory-storage';
import { NOW } from './helpers';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function setup(initial: Record<string, unknown> = {}, copy = vi.fn(async () => true)) {
  const local = new MemoryArea(initial);
  const storage = new AppStorage(local, new MemoryArea());
  const user = userEvent.setup();
  render(<App storage={storage} copy={copy} now={() => NOW} />);
  return { local, user, copy };
}

const pick = (label: string | RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const typeIn = (label: string | RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

async function generateRequest(user: ReturnType<typeof userEvent.setup>) {
  typeIn(/Por que a informação é necessária/, 'Erro ao abrir a planilha de custos.');
  typeIn(/Perguntas ao destinatário/, 'Qual mensagem de erro aparece na tela\nO erro ocorre com outros arquivos');
  await user.click(screen.getByRole('button', { name: 'Gerar prévia' }));
  return screen.findByLabelText('Prévia editável');
}

describe('fluxo principal', () => {
  it('gera prévia editável e só copia por ação explícita', async () => {
    const { user, copy } = setup();
    const preview = (await generateRequest(user)) as HTMLTextAreaElement;
    expect(preview.value).toContain('1. Qual mensagem de erro aparece na tela?');
    expect(copy).not.toHaveBeenCalled();

    fireEvent.change(preview, { target: { value: preview.value + '\nLinha extra do analista.' } });
    await user.click(screen.getByRole('button', { name: 'Copiar texto' }));
    expect(copy).toHaveBeenCalledTimes(1);
    expect(copy).toHaveBeenCalledWith(expect.stringContaining('Linha extra do analista.'));
    expect(await screen.findByText(/Deseja limpar o conteúdo agora/)).toBeInTheDocument();
  });

  it('oferece limpeza imediata após copiar e limpa tudo', async () => {
    const { user } = setup();
    await generateRequest(user);
    await user.click(screen.getByRole('button', { name: 'Copiar texto' }));
    await user.click(await screen.findByRole('button', { name: 'Limpar agora' }));
    expect(screen.queryByLabelText('Prévia editável')).toBeNull();
    expect((screen.getByLabelText(/Perguntas ao destinatário/) as HTMLTextAreaElement).value).toBe('');
  });

  it('mostra perguntas objetivas quando falta informação e liga ao campo', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Gerar prévia' }));
    const alert = await screen.findByText('Faltam informações essenciais. Nada foi inventado.');
    expect(alert).toBeInTheDocument();
    const field = screen.getByLabelText(/Perguntas ao destinatário/);
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(field).toHaveAccessibleDescription(/Quais perguntas objetivas/);
    await user.click(screen.getByRole('button', { name: 'Ir para o campo' }));
    expect(field).toHaveFocus();
    expect(screen.queryByLabelText('Prévia editável')).toBeNull();
  });

  it('revelação progressiva: campos mudam conforme o tipo', async () => {
    setup();
    expect(screen.queryByLabelText(/Data do aviso prévio/)).toBeNull();
    pick('Tipo de comunicação', 'closure_no_response');
    expect(screen.getByLabelText(/Datas das tentativas de contato/)).toBeInTheDocument();
    expect(screen.getByText(/desativado pela organização/, { selector: 'p' })).toBeInTheDocument();
    pick('Tipo de comunicação', 'manager_approval');
    expect(screen.getByLabelText(/O que será aprovado/)).toBeInTheDocument();
  });

  it('bloqueio de encerramento por ausência de retorno explica a regra', async () => {
    const { user } = setup();
    pick('Tipo de comunicação', 'closure_no_response');
    typeIn(/Solicitação original/, 'Acesso à pasta');
    typeIn(/Informação aguardada/, 'Nome da pasta');
    typeIn(/Datas das tentativas/, '01/10/2026\n05/10/2026\n08/10/2026');
    await user.click(screen.getByRole('button', { name: 'Gerar prévia' }));
    expect(await screen.findByText('Geração bloqueada por regra da organização.')).toBeInTheDocument();
    expect(screen.getByText(/desativado pela organização\./, { selector: 'li span + *, li' })).toBeTruthy();
  });

  it('destinatário aplica padrões do perfil até o analista mexer no estilo', () => {
    setup();
    pick('Destinatário', 'manager');
    expect(screen.getByLabelText('Grau de formalidade')).toHaveValue('formal');
    pick('Grau de formalidade', 'direct');
    pick('Destinatário', 'technical_team');
    expect(screen.getByLabelText('Grau de formalidade')).toHaveValue('direct');
  });

  it('comparação e restauração do modelo', async () => {
    const { user } = setup();
    const preview = (await generateRequest(user)) as HTMLTextAreaElement;
    const original = preview.value;
    fireEvent.change(preview, { target: { value: original + '\nAcréscimo.' } });
    await user.click(screen.getByRole('button', { name: 'Comparar com o texto inicial' }));
    expect(screen.getByText('Adicionada')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Restaurar modelo' }));
    expect((screen.getByLabelText('Prévia editável') as HTMLTextAreaElement).value).toBe(original);
  });

  it('revisar novamente atualiza os alertas sem alterar o texto', async () => {
    const { user } = setup();
    const preview = (await generateRequest(user)) as HTMLTextAreaElement;
    const edited = preview.value + '\nGarantimos que ficará pronto amanhã.';
    fireEvent.change(preview, { target: { value: edited } });
    await user.click(screen.getByRole('button', { name: 'Revisar novamente' }));
    const list = screen.getByRole('list', { name: 'Alertas da revisão' });
    expect(within(list).getByText(/Promessa de resultado/)).toBeInTheDocument();
    expect((screen.getByLabelText('Prévia editável') as HTMLTextAreaElement).value).toBe(edited);
  });

  it('desabilita a cópia se o analista inserir credencial na prévia', async () => {
    const { user } = setup();
    const preview = (await generateRequest(user)) as HTMLTextAreaElement;
    fireEvent.change(preview, { target: { value: preview.value + '\nsenha: Abc@12345' } });
    expect(screen.getByRole('button', { name: 'Copiar texto' })).toBeDisabled();
    expect(screen.getByRole('alert', { name: '' })).toBeTruthy();
  });

  it('contador de caracteres informa o limite', async () => {
    const { user } = setup();
    await generateRequest(user);
    expect(screen.getByText(/\/ 4000 caracteres/)).toBeInTheDocument();
  });
});

describe('dados sensíveis na interface', () => {
  it('credencial bloqueia, mostra trecho mascarado e nunca ecoa o valor', async () => {
    const { user } = setup();
    const secret = 'Xy7!pQ9zLmN2';
    typeIn(/Por que a informação é necessária/, `Login falhou. senha: ${secret}`);
    typeIn(/Perguntas ao destinatário/, 'Qual erro aparece na tela');
    const panel = screen.getByRole('region', { name: /Possíveis dados sensíveis/ });
    expect(panel.textContent).not.toContain(secret);
    expect(panel.textContent).toContain('caracteres');
    await user.click(screen.getByRole('button', { name: 'Gerar prévia' }));
    expect(await screen.findByText(/Geração bloqueada: foram detectadas credenciais/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Prévia editável')).toBeNull();
    expect(screen.getByRole('region', { name: /Prévia e revisão/ }).textContent).not.toContain(secret);
  });

  it('remoção assistida substitui o trecho por ação explícita e permite desfazer', async () => {
    const { user } = setup();
    const field = screen.getByLabelText(/Por que a informação é necessária/) as HTMLTextAreaElement;
    typeIn(/Por que a informação é necessária/, 'Contato: ana.teste@exemplo.test para retorno.');
    expect(field.value).toContain('ana.teste@exemplo.test');
    await user.click(screen.getByRole('button', { name: /Substituir por marcador de omissão: Possível e-mail/ }));
    expect(field.value).toBe('Contato: [e-mail omitido] para retorno.');
    await user.click(screen.getByRole('button', { name: 'Desfazer' }));
    expect(field.value).toBe('Contato: ana.teste@exemplo.test para retorno.');
  });

  it('dado pessoal é mascarado na prévia e avisado, sem mudar o campo', async () => {
    const { user } = setup();
    typeIn(/Por que a informação é necessária/, 'Contato: ana.teste@exemplo.test');
    typeIn(/Perguntas ao destinatário/, 'Qual erro aparece na tela');
    await user.click(screen.getByRole('button', { name: 'Gerar prévia' }));
    const preview = (await screen.findByLabelText('Prévia editável')) as HTMLTextAreaElement;
    expect(preview.value).toContain('[e-mail omitido]');
    expect(preview.value).not.toContain('ana.teste');
    expect((screen.getByLabelText(/^Por que a informação é necessária/) as HTMLTextAreaElement).value).toContain('ana.teste');
  });
});

describe('persistência e limpeza', () => {
  it('só preferências são gravadas; conteúdo nunca', async () => {
    const { user, local } = setup();
    await generateRequest(user);
    await user.click(screen.getByRole('button', { name: 'Configurações' }));
    fireEvent.change(screen.getByLabelText('Tamanho padrão'), { target: { value: 'short' } });
    await waitFor(() => expect(local.data.preferences).toBeDefined());
    const dump = JSON.stringify(local.data);
    expect(Object.keys(local.data)).toEqual(['preferences']);
    expect(dump).not.toMatch(/planilha|mensagem de erro/);
  });

  it('"Limpar tudo" apaga o conteúdo e, se pedido, os dados armazenados', async () => {
    const { user, local } = setup({ preferences: { techLevel: 'technical' } });
    await generateRequest(user);
    await user.click(screen.getByRole('button', { name: 'Limpar tudo' }));
    await user.click(screen.getByLabelText(/Apagar também preferências/));
    await user.click(screen.getByRole('button', { name: 'Apagar agora' }));
    expect(screen.queryByLabelText('Prévia editável')).toBeNull();
    await waitFor(() => expect(local.data).toEqual({}));
  });

  it('limpa o conteúdo após o tempo de inatividade configurado', async () => {
    vi.useFakeTimers();
    const local = new MemoryArea({ preferences: { autoClearMinutes: 5 } });
    render(<App storage={new AppStorage(local, new MemoryArea())} copy={vi.fn()} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(10); });
    fireEvent.change(screen.getByLabelText(/Perguntas ao destinatário/), { target: { value: 'Qual o erro exibido' } });
    expect((screen.getByLabelText(/Perguntas ao destinatário/) as HTMLTextAreaElement).value).toBe('Qual o erro exibido');
    await act(async () => { await vi.advanceTimersByTimeAsync(5 * 60_000 + 100); });
    expect((screen.getByLabelText(/Perguntas ao destinatário/) as HTMLTextAreaElement).value).toBe('');
  });
});

describe('perfil de linguagem na interface', () => {
  it('importa um perfil válido e recusa um inválido com erros visíveis', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Configurações' }));
    const input = screen.getByLabelText('Importar perfil (JSON)');
    const bad = new File(['{"schemaVersion":1,"signature":"<b>x</b>"}'], 'p.json', { type: 'application/json' });
    await user.upload(input, bad);
    expect(await screen.findByText(/Importação recusada/)).toBeInTheDocument();
    const good = new File([exportProfileJson({ ...DEFAULT_PROFILE, organizationName: 'Org Teste' })], 'p.json', { type: 'application/json' });
    await user.upload(input, good);
    expect(await screen.findByText('Perfil importado e validado.')).toBeInTheDocument();
    expect(screen.getByText('Org Teste')).toBeInTheDocument();
  });
});

describe('popup', () => {
  it('abre o painel e informa falha de forma acessível', async () => {
    const open = vi.fn(async () => false);
    render(<Popup open={open} />);
    await userEvent.click(screen.getByRole('button', { name: 'Abrir painel lateral' }));
    expect(open).toHaveBeenCalled();
    expect(await screen.findByRole('alert')).toHaveTextContent(/Não foi possível abrir/);
  });
});
