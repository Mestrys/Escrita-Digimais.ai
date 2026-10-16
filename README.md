# Escrita-Digimais.ai

A extensão deve ajudar analistas a produzir textos claros, cordiais, objetivos e tecnicamente adequados.

## Assistente de Textos do Service Desk

Extensão para Microsoft Edge (Chromium, Manifest V3) que ajuda analistas de Service Desk a redigir textos claros, cordiais e objetivos para chamados, a partir do contexto informado pelo próprio analista.

## Finalidade
Gera sugestões padronizadas para:
1. solicitar informações ao usuário;
2. registrar nota técnica;
3. registrar pendência;
4. solicitar aprovação ou “De acordo” de gestor;
5. comunicar andamento;
6. confirmar solução com o usuário;
7. encerrar chamado solucionado;
8. encerrar por ausência de retorno (somente com regra da organização e histórico suficiente);
9. redirecionar ou escalonar;
10. texto livre guiado.

## Limitações (por desenho)
- Auxilia a redação. Não decide, não altera chamados e não envia mensagens.
- Não lê páginas nem sistemas de chamados: o analista digita ou cola o contexto.
- O motor é determinístico (templates e regras), não um modelo de linguagem. Ele não reescreve livremente nem infere fatos: se faltar informação essencial, pergunta ao analista.
- A detecção de dados sensíveis e os indicadores de qualidade são heurísticos e podem errar. A revisão humana é obrigatória.
- O texto livre guiado usa a frase principal exatamente como informada.

## Arquitetura
```
src/
  domain/          motor puro e testável
    normalize      normalização conservadora
    sensitive      detecção e mascaramento de dados sensíveis
    classify       ações concluídas e planejadas, datas, prazo explícito
    sufficiency    matriz de campos mínimos por tipo
    policy         consistência de encerramento e regras da organização
    planner        plano de seções da mensagem
    renderer       formatação do plano em texto
    risks, review  riscos e estilo; revisão de texto gerado ou editado
    quality        indicadores de 0 a 100 e regras acionadas
    engine         pipeline completo
  config/          dados: vocabulário, templates, blueprints, campos, perfil padrão, validação do perfil
  application/     provedor local, adaptador remoto desativado, formulário, preferências
  infrastructure/  chrome.storage, clipboard, sidePanel, service worker, política gerenciada
  ui/              React: painel lateral e popup
  tests/           Vitest, Testing Library, axe-core
scripts/           ícones, pós-build, verificação do pacote, empacotamento
examples/          perfil de linguagem de exemplo
```
Pipeline: normalização, dados sensíveis (bloqueio ou mascaramento), suficiência, classificação, política, planejamento, renderização, revisão e pontuação.

## Instalação e comandos
Requisitos: Node.js 20 ou superior.
```
npm ci
npm run check      # lint, typecheck, testes, build e verificação do pacote
npm test           # somente testes
npm run build      # gera dist/
npm run verify:dist
npm run package    # gera release/assistente-textos-service-desk-<versão>.zip
npm run icons      # regenera os ícones PNG (sem dependências externas)
npm run audit:deps # npm audit das dependências de produção
```

## Integração contínua
O workflow `.github/workflows/ci.yml` roda a cada pull request e a cada push no `main`: `npm ci`, `npm run check` (lint, typecheck, testes, build e verificação do pacote), `npm audit` das dependências de produção e o empacotamento. O `.zip` da extensão fica disponível como artefato da execução por 14 dias. As actions são fixadas por SHA de commit, e o token tem apenas permissão de leitura.

## Carregar no Microsoft Edge
1. Rode `npm run build`.
2. Abra `edge://extensions`.
3. Ative “Modo de desenvolvedor”.
4. Clique em “Carregar sem compactação” e selecione a pasta `dist/`.
5. Clique no ícone da extensão e em “Abrir painel lateral”.

Requer Edge 116 ou superior (API `chrome.sidePanel.open`).

## Qualidade da detecção
A detecção de dados sensíveis é medida contra um corpus sintético de 112 casos e protegida no CI por pisos de qualidade, com tolerância zero para segredos bloqueantes que escapem. Resultados, falhas conhecidas e limites em [docs/AVALIACAO.md](docs/AVALIACAO.md).

## Uso
1. Escolha o tipo de comunicação e o destinatário (o destinatário aplica nível técnico e formalidade sugeridos, até você alterar manualmente).
2. Preencha os campos exibidos para o tipo. Campos opcionais ficam em “Campos opcionais”.
3. Confira o painel “Possíveis dados sensíveis”. Credenciais bloqueiam a geração. Outros dados podem ser substituídos por marcador com um clique (e desfeitos).
4. “Gerar prévia”. Se faltar algo essencial, a extensão lista perguntas objetivas e destaca os campos.
5. Revise e edite a prévia. “Revisar novamente” reavalia o texto editado. “Comparar com o texto inicial” mostra as diferenças.
6. “Copiar texto”. Em seguida, a extensão oferece limpar o conteúdo.

## Permissões e justificativas
| Permissão | Justificativa |
|---|---|
| `sidePanel` | Exibir a interface principal no painel lateral |
| `storage` | Salvar preferências não sensíveis e o perfil de linguagem; ler política gerenciada |

Não solicitadas: acesso a sites, abas, histórico, scripts de conteúdo ou `clipboardWrite`. A cópia usa a API padrão em resposta a um clique.

## Configuração organizacional
O perfil de linguagem (JSON, `schemaVersion: 1`) permite configurar: nome da organização, saudações por formalidade e destinatário, fechamentos, assinatura (`{organization}`), nomes das categorias, termos preferidos e proibidos, textos obrigatórios por tipo, aviso de privacidade, tamanho máximo, regras de encerramento, perfis por destinatário, siglas conhecidas, domínios internos e sobrescritas de templates (aberturas, fechamentos por tipo e rótulos). Veja `examples/perfil-exemplo.json`.

Chaves ausentes herdam o padrão. Precedência: política gerenciada, perfil importado, padrão.

### Encerramento por ausência de retorno
Desativado por padrão (opção mais segura). Para habilitar: `closureRules.noResponseEnabled: true`. As regras exigem `minAttempts` tentativas em datas distintas, sem datas futuras, e, se `requirePriorNotice`, aviso prévio após a primeira tentativa e há pelo menos `minDaysAfterNotice` dias.

### Importação e exportação seguras
Em “Configurações > Perfil de linguagem”. A importação é local e recusa: JSON inválido, arquivo acima de 100 KB, chaves desconhecidas (inclusive `__proto__`), HTML, links, esquemas executáveis, caracteres de controle, placeholders não permitidos e valores fora de faixa. Termos são comparados como texto, nunca como expressão regular. A exportação gera o JSON do perfil efetivo.

### Política gerenciada (implantação empresarial)
O esquema está em `public/managed-schema.json`. Exemplo de valor para a chave `languageProfile` (string JSON) via política do Edge (GPO/Intune, `3rdparty > extensions > <id> > policy`). A chave `aiProvider` está reservada e não ativa nenhuma chamada nesta versão.

## Empacotamento
`npm run package` executa build, verificação do pacote e gera um `.zip` de `dist/` em `release/`. A verificação (`scripts/verify-dist.mjs`) falha se encontrar permissões extras, CSP insegura, scripts inline, recursos remotos, `eval`, `new Function`, `fetch`, XHR, WebSocket ou `sendBeacon`.

## Checklist de publicação e implantação
- [ ] Workflow de CI verde no commit a ser publicado (equivale a `npm ci && npm run check` em ambiente limpo).
- [ ] `npm audit` sem vulnerabilidades relevantes; atualizações revisadas.
- [ ] Versão atualizada em `manifest.json` e `package.json`.
- [ ] Snapshots de template revisados por alguém de comunicação/qualidade.
- [ ] Perfil de linguagem da organização validado pela importação e testado com casos reais anonimizados.
- [ ] Decisão sobre `closureRules` registrada pela gestão do Service Desk.
- [ ] Teste manual no Edge: carregar `dist/`, gerar cada tipo, conferir bloqueios, copiar e limpar.
- [ ] Revisão de acessibilidade com leitor de tela (Narrador ou NVDA) e navegação só por teclado.
- [ ] `PRIVACY.md` e `SECURITY.md` revisados por privacidade e segurança.
- [ ] Publicação na Microsoft Edge Add-ons (privada/oculta) ou distribuição por política (`ExtensionInstallForcelist`), com o perfil em `languageProfile`.
- [ ] Canal de reporte de vulnerabilidades comunicado à equipe.

## Licença
Domínio público (Unlicense). Veja `LICENSE`.

## Decisões registradas
- Encerramento por ausência de retorno desativado por padrão.
- Dados pessoais e de infraestrutura são mascarados na prévia (com aviso), mantendo o campo original intacto.
- Credenciais e pedidos de credenciais bloqueiam geração e cópia.
- Conteúdo nunca é persistido; limpeza por inatividade padrão de 15 minutos.
