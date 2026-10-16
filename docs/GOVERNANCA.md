# Governança do repositório

Passos que exigem permissão de administração do repositório ou da conta. Foram preparados mas **não aplicados**: o ambiente de desenvolvimento automatizado não tem permissão para alterar proteções e configurações (o proxy recusa a rota de rulesets e o classificador de segurança nega a alteração). Quem administra o repositório aplica pela interface do GitHub.

O repositório é **público**. Nada aqui deve conter conteúdo de chamado, nomes de pessoas ou dados internos.

## 1. Proteger a `main`
Objetivo: a `main` só recebe alterações por pull request e só com o CI verde. Não exige aprovação de outra pessoa (contagem 0), para que quem administra consiga mesclar o próprio PR.

Caminho rápido: Settings, Rules, Rulesets, New ruleset, **Import a ruleset** e envie [`docs/ruleset-main.json`](ruleset-main.json). Se a importação recusar o arquivo, crie manualmente:

1. Settings, Rules, Rulesets, New branch ruleset. Nome: "Proteger main". Enforcement: **Active**.
2. Target branches: Add target, **Include default branch**.
3. Marque: **Restrict deletions**, **Block force pushes**, **Require a pull request before merging** (aprovações exigidas: 0) e **Require status checks to pass**.
4. Em status checks, adicione exatamente: `Lint, typecheck, testes, build e verificação do pacote`.
5. Deixe a lista de bypass vazia. Salve.

Como verificar: tente um push direto na `main` (deve ser recusado) e abra um PR com CI vermelho (o botão de mesclar deve ficar bloqueado).

## 2. Apagar branches mescladas automaticamente
Settings, General, Pull Requests, marque **Automatically delete head branches**. Isso evita acumular as dezenas de branches `claude/*` depois das mesclagens.

## 3. Branch do PR #1
A branch `claude/extensao-service-desk` ficou do PR #1 (já mesclado). Abra o PR #1 e use **Delete branch**, ou apague em Code, Branches, ícone de lixeira. Confira antes que nenhum PR aberto usa essa branch como base.

## 4. GitHub Actions bloqueado por cobrança
O workflow de outro repositório da conta (MestrysHome, PR 73) não roda por bloqueio de cobrança. Resolva em github.com/settings/billing (limite de gastos e forma de pagamento). Este repositório não é afetado: o CI daqui roda normalmente.

## 5. Ao mesclar a integração
1. Mescle o PR de integração com **Create a merge commit** (não squash nem rebase).
2. Os PRs que ele contém passam a ficar redundantes; feche-os depois de conferir.
3. Retargeteie os PRs empilhados (acabamento e kit de validação) para a `main`.
4. Gere o pacote final na `main`: `npm ci && npm run package`, e registre o SHA-256 do `.zip` na release.
