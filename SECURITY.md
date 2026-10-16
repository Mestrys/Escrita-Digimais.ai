# Segurança

## Modelo de ameaça resumido
| Ameaça | Mitigação |
|---|---|
| Vazamento de conteúdo de chamado para terceiros | Sem rede: CSP `connect-src 'none'`, sem permissões de host, ESLint e testes proíbem `fetch`, XHR, WebSocket e `sendBeacon`; `verify-dist` audita o pacote |
| Credenciais coladas em chamados | Detecção local bloqueia a geração e a cópia; o valor nunca é exibido nem retornado em alertas |
| Exposição de dados pessoais ou de infraestrutura | Detecção conservadora com mascaramento visível na prévia e remoção assistida com “Desfazer” |
| Persistência indevida de dados | Allowlist de chaves em `chrome.storage.local`; conteúdo vive só em memória; limpeza por inatividade e “Limpar tudo” |
| Perfil institucional trocado por um adulterado (arquivo ou disco local) | Com `profileSigningPublicKeys` na política: só importa envelope assinado (ECDSA P-256, WebCrypto local), falha fechada sem assinatura válida e reverifica o perfil guardado a cada abertura; a chave privada fica fora da extensão e do repositório |
| Camada de equipe afrouxando regras da organização | Mesclagem só restritiva (união de termos, menor tamanho, regras de encerramento mais rígidas); campos de estilo e de silenciamento de alertas são recusados; mesma validação de texto simples do perfil; revalidada a cada abertura |
| Perfil importado malicioso (XSS, links de phishing, ReDoS, poluição de protótipo) | Validação estrita: só texto simples, sem HTML, URLs ou esquemas; chaves desconhecidas recusadas; termos escapados, nunca usados como regex; limite de 100 KB; React sem `innerHTML` |
| Código remoto ou injetado | CSP `script-src 'self'`, sem CDN, sem `eval`/`new Function`, sem scripts inline; build com Vite sem polyfill inline |
| Abuso de permissões | Somente `sidePanel` e `storage` |
| Texto que induz o usuário a enviar credenciais | Regra bloqueante `ask_credentials` impede gerar ou copiar pedidos de senha, token ou código |
| Entradas abusivas (desempenho) | Limites de tamanho por campo e total; regexes sem retrocesso catastrófico, com teste de entrada longa |

Limitações conhecidas: a detecção é heurística e pode ter falsos negativos. O analista continua responsável por revisar o texto.

## Permissões e justificativas
- `sidePanel`: exibir a interface principal no painel lateral.
- `storage`: salvar preferências não sensíveis e o perfil de linguagem; ler política gerenciada (`storage.managed`).

## Reportar vulnerabilidade
Envie um relato privado ao responsável de segurança da sua organização ou ao mantenedor do repositório, com passos de reprodução, versão e impacto. Não abra issue pública com detalhes exploráveis. Meta de resposta inicial: 5 dias úteis.

## Dependências
- Versões fixadas (sem `^` ou `~`), `package-lock.json` versionado e `save-exact=true` em `.npmrc`.
- Somente React em tempo de execução; ferramentas de build e teste são dependências de desenvolvimento.
- Rode `npm audit` antes de cada versão e revise atualizações manualmente.
- O teste `manifest.test.ts` falha se surgir biblioteca de rede, analytics ou rastreamento.
- No CI, as GitHub Actions são fixadas por SHA de commit (não por tag), o token do workflow tem somente `contents: read` e o checkout não persiste credenciais.
- A fonte Google Sans Flex é uma dependência de desenvolvimento (`@fontsource-variable/google-sans-flex`, versão fixa) e vira arquivo local em `assets/`. A CSP não libera `data:` nem hosts externos: a build usa `assetsInlineLimit: 0` e `verify:dist` recusa `data:` em CSS.

## Segredos
É proibido versionar segredos, chaves de API, tokens, certificados ou arquivos `.env`. O `.gitignore` bloqueia padrões comuns, e um teste procura formatos conhecidos de chave no código-fonte. A extensão nunca deve pedir chave de API ao usuário.
