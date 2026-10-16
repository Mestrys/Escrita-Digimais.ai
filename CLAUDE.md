# CLAUDE.md

Extensão MV3 para Microsoft Edge que gera sugestões de texto para chamados de Service Desk. 100% local, sem rede.

## Arquitetura
- `src/domain`: motor determinístico e puro (normalize, sensitive, classify, sufficiency, policy, planner, renderer, risks, review, quality, engine). Sem DOM, sem chrome.*.
- `src/config`: dados (vocabulário, templates, blueprints, campos, perfil padrão, validação do perfil). Não colocar lógica de UI aqui.
- `src/application`: casos de uso (provedor local, adaptador remoto desativado, mapeamento do formulário, preferências).
- `src/infrastructure`: chrome.storage, clipboard, sidePanel, service worker, política gerenciada.
- `src/ui`: React (painel lateral e popup). Só orquestra; regra de negócio fica no domínio.

## Comandos de verificação
```
npm run check        # lint + typecheck + testes + build + verify:dist + build:dev
npm run dev          # dist-dev/ em modo watch para carregar no Edge (docs/DESENVOLVIMENTO-EDGE.md)
npm test             # Vitest (jsdom, Testing Library, axe-core)
npm run package      # gera release/*.zip
```
Atualizar snapshots de template só quando a mudança de texto for intencional: `npx vitest run src/tests/engine.test.ts -u`.

## Padrões
- TypeScript estrito; sem `any`; `import type` para tipos.
- Textos gerados em pt-BR, sem travessão, sem emoji, sem caixa alta para ênfase.
- Regras novas: dado em `src/config/vocabulary.ts`, lógica em `src/domain/risks.ts`, teste positivo e negativo.
- Nunca alterar o texto do analista silenciosamente: alertar, sugerir, e só mudar por ação explícita.
- Mudou detector de dado sensível? Adicione caso ao corpus (`src/tests/eval/sensitive-corpus.ts`, só dados fictícios) e atualize `docs/AVALIACAO.md` se as métricas mudarem.

- Visual: Material Design 3 por tokens (`src/ui/styles/tokens.css`). Cor nova entra como token nos temas claro e escuro e em `contrast.test.ts`. Fonte só local (Google Sans Flex em `fonts.css`), sem CDN, sem `@import`, sem `data:`.
- Movimento só em opacidade e cor, com `prefers-reduced-motion` respeitado. Não adicionar biblioteca de animação (por exemplo `motion`) nem `backdrop-filter`; a skill `apple-design` serve de guia de princípios, não de dependências.

## Restrições de segurança (não negociáveis)
- Permissões: apenas `sidePanel` e `storage`. Nada de host_permissions, content_scripts, tabs ou clipboardWrite.
- Sem `fetch`, XHR, WebSocket, sendBeacon, `eval`, `new Function`, CDN ou script inline (ESLint e testes bloqueiam).
- Persistir apenas preferências (allowlist em `application/preferences.ts`) e perfil validado. Nunca conteúdo de chamado.
- Credenciais, tokens e chaves bloqueiam a geração; demais dados sensíveis são mascarados com aviso.
- Perfil importado: só texto simples validado por `config/profile-schema.ts`; termos nunca viram regex. Com `profileSigningPublicKeys` na política, só vale perfil assinado (`application/profile-signing.ts`); chave privada nunca no repositório.
- Nenhum segredo ou chave de API no repositório. Provedor remoto permanece desativado.

## Definição de pronto
`npm run check` verde, snapshots revisados, README/PRIVACY/SECURITY atualizados quando houver mudança de comportamento, permissões ou dados.
