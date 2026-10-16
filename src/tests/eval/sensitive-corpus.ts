import type { SensitiveCategory } from '../../domain/types';

/**
 * Corpus 100% sintético para medir a detecção de dados sensíveis. Nenhum dado real:
 * CPFs, CNPJs e cartões usam números de teste conhecidos, hosts usam o domínio reservado .test.
 * "expected" é o conjunto exato de categorias que um revisor humano esperaria. Casos em que o
 * detector atual erra ficam marcados em "gap" e continuam contando nas métricas.
 */
export type CaseKind = 'positive' | 'negative' | 'hard_negative';

export interface EvalCase {
  id: string;
  text: string;
  expected: SensitiveCategory[];
  kind: CaseKind;
  /** Falha conhecida do detector, registrada para acompanhamento (não esconde o erro). */
  gap?: 'miss' | 'false_positive';
}

const p = (id: string, text: string, ...expected: SensitiveCategory[]): EvalCase => ({ id, text, expected, kind: 'positive' });
const n = (id: string, text: string): EvalCase => ({ id, text, expected: [], kind: 'negative' });
const h = (id: string, text: string): EvalCase => ({ id, text, expected: [], kind: 'hard_negative' });

/**
 * Valores com formato de token são montados em tempo de execução: o repositório não guarda nenhum
 * literal parecido com segredo, para não acionar a proteção de push do GitHub (secret scanning).
 */
const join = (...parts: string[]): string => parts.join('');

export const INTERNAL_DOMAINS = ['exemplo.test', 'corp.exemplo.test'];

export const CORPUS: EvalCase[] = [
  // ---- Credenciais
  p('cred-01', 'A senha é Abc@12345 para o acesso.', 'credential'),
  p('cred-02', 'senha: Xk9#mP2$vL', 'credential'),
  p('cred-03', 'password=Tr0ub4dor&3', 'credential'),
  p('cred-04', 'Usuário: joao.teste / Senha: 12345678', 'credential'),
  p('cred-05', 'pwd: qwerty123', 'credential'),
  p('cred-06', 'a senha temporária é Zx9!Qw7e', 'credential'),
  p('cred-07', 'Informei a nova senha: Mudar@2026 ao usuário.', 'credential'),
  p('cred-08', 'wifi senha: Visitante#2026', 'credential'),
  p('cred-09', 'passwd = "s3nh4F0rte"', 'credential'),
  p('cred-10', 'Senha da conta: Banana!9922', 'credential'),
  p('cred-11', 'DB_PASSWORD=Sup3rS3cret!', 'credential'),
  p('cred-12', 'ADMIN_PASSWD: Qwerty!2026', 'credential'),
  h('cred-neg-01', 'A senha expirada impede o login.'),
  h('cred-neg-02', 'O usuário informou que a senha está incorreta.'),
  h('cred-neg-03', 'Foi feita a redefinição de senha pelo portal.'),
  h('cred-neg-04', 'A senha foi alterada e o acesso voltou ao normal.'),
  h('cred-neg-05', 'Política de senha exige 12 caracteres.'),
  h('cred-neg-06', 'O campo senha é obrigatório no formulário.'),

  // ---- Tokens e chaves
  p('tok-01', 'Authorization: Bearer abcdefghijklmnopqrstuvwxyz123456', 'token'),
  p('tok-02', join('ey', 'JhbGciOiJIUzI1.eyJzdWIiOiIxMjM0NTY.SflKxwRJSMeKKF2QT4fw'), 'token'),
  p('tok-03', join('chave AK', 'IAABCDEFGHIJKLMNOP'), 'token'),
  p('tok-04', 'https://exemplo.test/x?token=abcdef123456', 'token'),
  // Atribuição de chave ou token com valor aparente pertence à categoria "secret" (a URL com ?token= é "token").
  p('tok-05', 'access_token=ya29a0AfH6SMBxxxxxxxxxxxxxxxxxx', 'secret'),
  p('tok-06', join('gh', 'p_abcdefghijklmnopqrstuvwxyz0123456789'), 'token'),
  p('tok-07', join('xo', 'xb-123456789012-abcdefghijklmnop'), 'token'),
  p('sec-01', 'api_key = a1b2c3d4e5f6g7h8', 'secret'),
  p('sec-02', 'client_secret: 9f8e7d6c5b4a39281716', 'secret'),
  p('sec-03', 'SECRET_KEY="k3yS3cr3tV4lu3xyz"', 'secret'),
  p('sec-04', join('AWS_SECRET_ACCESS_', 'KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY'), 'secret'),
  p('sec-05', 'API_TOKEN=abcd1234efgh5678', 'secret'),
  p('key-01', '-----BEGIN RSA PRIVATE KEY-----\nMIIabc\n-----END RSA PRIVATE KEY-----', 'private_key'),
  p('key-02', '-----BEGIN OPENSSH PRIVATE KEY-----\nb3BlbnNzaC1rZXk=\n-----END OPENSSH PRIVATE KEY-----', 'private_key'),
  h('tok-neg-01', 'O token expirou e foi necessário autenticar novamente.'),
  h('tok-neg-02', 'Solicitamos a emissão de um novo token pelo portal.'),
  h('tok-neg-03', 'Autenticação por chave pública está habilitada no servidor.'),
  h('tok-neg-04', 'Gerar chave de API é uma ação do administrador.'),

  // ---- Strings de conexão
  p('conn-01', 'Server=db;Database=x;User Id=a;Password=zzz123;', 'connection_string'),
  p('conn-02', 'postgres://admin:s3cret@db.exemplo.test/app', 'connection_string'),
  p('conn-03', 'mongodb://user:pw12345@10.0.0.5:27017/base', 'connection_string'),
  h('conn-neg-01', 'A conexão com o banco foi encerrada por timeout.'),

  // ---- CPF e CNPJ
  p('cpf-01', 'CPF do usuário: 529.982.247-25', 'cpf'),
  p('cpf-02', 'cpf 52998224725', 'cpf'),
  p('cpf-03', 'Titular 529.982.247-25 solicitou a alteração.', 'cpf'),
  { ...h('cpf-neg-01', 'Protocolo 111.111.111-11 registrado no atendimento.'), gap: 'false_positive' },
  { ...h('cpf-neg-02', 'Chamado 123.456.789-00 aberto ontem.'), gap: 'false_positive' },
  h('cpf-neg-03', 'Número do pedido 12345678901 consta no sistema.'),
  p('cnpj-01', 'CNPJ da empresa: 11.222.333/0001-81', 'cnpj'),
  p('cnpj-02', 'cnpj 11222333000181', 'cnpj'),
  { ...h('cnpj-neg-01', 'Documento 11.222.333/0001-80 não consta na base.'), gap: 'false_positive' },

  // ---- Cartão e dados bancários
  p('card-01', 'Cartão 4111 1111 1111 1111 vence em 12/30', 'card'),
  p('card-02', 'cartão 4111-1111-1111-1111', 'card'),
  p('card-03', 'número do cartão: 5555555555554444', 'card'),
  h('card-neg-01', 'Protocolo 4111 1111 1111 1112 do atendimento.'),
  h('card-neg-02', 'Sequência 1234 5678 9012 3456 do equipamento.'),
  p('bank-01', 'Agência 1234 conta 56789-0 do Banco Teste', 'bank'),
  p('bank-02', 'Chave Pix: 529.982.247-25', 'bank'),
  h('bank-neg-01', 'O banco de dados está lento desde ontem.'),

  // ---- E-mail
  p('mail-01', 'Contato: ana.teste@exemplo.test', 'email'),
  p('mail-02', 'Enviar para maria.silva@empresa-ficticia.test', 'email'),
  p('mail-03', 'Responder a joao_teste+suporte@dominio.test', 'email'),
  h('mail-neg-01', 'O servidor de e-mail está fora do ar.'),
  h('mail-neg-02', 'Enviei um e-mail ao usuário solicitando mais detalhes.'),
  h('mail-neg-03', 'Use o formato nome@dominio para o cadastro.'),

  // ---- Telefone
  p('tel-01', 'Telefone: (11) 91234-5678', 'phone'),
  p('tel-02', 'ligar para 11 3456-7890', 'phone'),
  p('tel-03', 'WhatsApp +55 21 98765-4321', 'phone'),
  h('tel-neg-01', 'Versão 10.0.19045 do Windows.'),
  h('tel-neg-02', 'Chamado 202610150001 em andamento.'),
  h('tel-neg-03', 'Ramal 4567 da central.'),
  h('tel-neg-04', 'Prazo de 30 a 45 dias úteis.'),

  // ---- Endereço
  p('addr-01', 'Endereço: Rua das Flores, 123, Bairro Centro', 'address'),
  p('addr-02', 'Mora na Av. Paulista, 1000, apto 52', 'address'),
  p('addr-03', 'CEP 01310-100', 'address'),
  h('addr-neg-01', 'A rua de acesso ao sistema foi bloqueada por política.'),
  h('addr-neg-02', 'O endereço de e-mail do grupo foi atualizado.'),

  // ---- IP, host, URL e caminho internos
  p('ip-01', 'Servidor 10.20.30.40 sem resposta', 'ip'),
  p('ip-02', 'IP 192.168.1.15 da estação', 'ip'),
  p('ip-03', 'endereço 172.16.5.9 bloqueado', 'ip'),
  { ...h('ip-neg-01', 'Versão 10.2.3.4 do aplicativo instalada.'), gap: 'false_positive' },
  h('ip-neg-02', 'Compilação 10.0.19045.3693 do Windows.'),
  p('host-01', 'Acessar srv-arquivos01.corp.exemplo.test', 'hostname'),
  p('host-02', 'falha em dc01.exemplo.test', 'hostname'),
  // Nome de servidor seguido de ":" ou "=" é a forma comum de escrever uma linha de erro: precisa continuar detectado.
  p('host-03', 'O servidor srv-fin01: está fora do ar', 'hostname'),
  p('host-04', 'Erro em fs-01.corp.local: acesso negado', 'hostname'),
  p('host-05', 'dc01.corp.local:445 recusou a conexão', 'hostname'),
  p('host-06', 'ws-0042 = reiniciado', 'hostname'),
  h('host-neg-01', 'A variável DB_PASSWORD está definida no servidor.'),
  p('url-01', 'Acesse https://intranet.corp.exemplo.test/chamados/123', 'url'),
  p('url-02', 'portal em http://wiki.exemplo.test/ti', 'url'),
  h('url-neg-01', 'Consulte a documentação oficial do fabricante.'),
  p('path-01', 'Arquivo em \\\\srv-arquivos01\\financeiro\\2026\\folha.xlsx', 'path'),
  p('path-02', 'caminho C:\\Users\\joao.teste\\Documents\\relatorio.docx', 'path'),
  p('path-03', 'pasta /home/joao/projetos/segredo', 'path'),
  h('path-neg-01', 'Abra a pasta Documentos e selecione o arquivo.'),
  h('path-neg-02', 'Use o formato dia/mês/ano na planilha.'),

  // ---- Log extenso
  p(
    'log-01',
    Array.from({ length: 10 }, (_, i) => `2026-10-15 10:0${i}:11 INFO servico.auth: tentativa ${i} concluida`).join('\n'),
    'log_block',
  ),
  h('log-neg-01', 'O log mostra erro 500 às 10:15.\nO erro se repete a cada hora.'),

  // ---- Textos comuns sem dado sensível
  n('neg-01', 'Olá, precisamos de mais informações para continuar a análise do chamado.'),
  n('neg-02', 'Qual mensagem de erro aparece na tela ao abrir a planilha?'),
  n('neg-03', 'Reiniciamos o serviço e o usuário confirmou que o acesso foi normalizado.'),
  n('neg-04', 'Solicitamos a aprovação do gestor para a instalação do software.'),
  n('neg-05', 'O chamado está pendente aguardando retorno do usuário desde ontem.'),
  n('neg-06', 'A impressora do 3º andar apresenta falha intermitente ao imprimir.'),
  n('neg-07', 'Encaminhamos o chamado para a equipe de redes para análise.'),
  n('neg-08', 'Agradecemos a colaboração e ficamos à disposição.'),
  n('neg-09', 'O erro 0x80070005 ocorre ao instalar a atualização.'),
  n('neg-10', 'A VPN desconecta após cerca de 10 minutos de uso.'),
  n('neg-11', 'Atualização KB5034441 pendente em 3 estações.'),
  n('neg-12', 'O pedido número 4587 foi atendido em 2 dias.'),
  n('neg-13', 'A reunião é às 14:30 na sala 12.'),
  n('neg-14', 'O arquivo tem 15 MB e foi enviado em 3 partes.'),
  n('neg-15', 'Testamos em 5 máquinas diferentes com o mesmo resultado.'),
];
