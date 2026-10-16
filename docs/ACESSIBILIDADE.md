# Acessibilidade e teste com leitor de tela

Este documento separa o que já é verificado automaticamente do que exige uma pessoa com leitor de tela, e traz o roteiro para essa verificação. Nenhuma execução com leitor de tela foi feita até agora: a tabela de resultados está em branco de propósito.

## O que já é verificado automaticamente

| Verificação | Onde | O que prova |
| --- | --- | --- |
| axe-core (WCAG 2.0 a 2.2 nível AA e boas práticas) em vários estados | `src/tests/a11y.test.tsx`, `src/tests/a11y-screen-reader.test.tsx` | Sem violações de nome, papel, valor e estrutura nos estados testados |
| Marcos de navegação | `a11y-screen-reader.test.tsx` | Há banner, principal e formulário nomeado ("Dados do texto a gerar") |
| Hierarquia de títulos | idem | Um único h1, sem pular níveis, em vários estados |
| Nome acessível de todo controle | idem | Botões, campos e seletores têm nome em todos os tipos de comunicação, sem ids repetidos |
| Botões "Ir para o campo" | idem | Cada botão diz para qual campo leva |
| Foco da confirmação de limpeza | idem | O foco entra na caixa de diálogo, que tem título e descrição; Esc, Cancelar e Apagar agora devolvem o foco ao botão de origem |
| Anúncios na região ao vivo | idem | Gerar, revisar e copiar são anunciados; um anúncio idêntico se repete, porque cada anúncio é um nó novo |
| Contraste de texto e de componentes | `src/tests/contrast.test.ts` | Pares de cor usados atendem 4,5:1 e 3:1 |
| Reflow a 320 px e espaçamento de texto | `scripts/a11y-reflow.mjs` (navegador real, fora do CI) e guarda em `a11y-reflow.test.ts` | Sem rolagem horizontal a 320 px, com espaçamento de texto do usuário e com fonte a 200% |

Para repetir o reflow: `npm run build` e depois `node scripts/a11y-reflow.mjs` (precisa do Playwright; use `PLAYWRIGHT_MODULE` se ele estiver em outro lugar).

Ferramentas automáticas pegam só uma parte dos problemas reais: não avaliam se a ordem de leitura faz sentido, se as mensagens são compreensíveis nem como cada leitor de tela as fala. Por isso o roteiro abaixo é necessário.

## Ambiente do teste manual

- Windows 11, Microsoft Edge atual, extensão carregada sem pacote (pasta `dist`).
- NVDA na versão estável mais recente, modo de navegação padrão, e o Narrador do Windows. Se possível, repita um subconjunto com JAWS.
- Use somente dados fictícios. Exemplo de contexto: "Erro ao abrir a planilha de custos." e pergunta "Qual mensagem de erro aparece na tela".
- Para o cenário de dados sensíveis, use valores de teste, como o e-mail `ana.teste@exemplo.test` e a frase `senha: Abc@12345`.

Teclas úteis do NVDA: D (marcos), H (títulos), F (campos de formulário), B (botões), Insert+F7 (lista de elementos).

## Roteiro

Para cada cenário, anote o que o leitor falou, compare com o esperado e registre na tabela de resultados.

| Cód. | Cenário | Passos | Esperado |
| --- | --- | --- | --- |
| R1 | Marcos e títulos | Abrir o painel lateral. Navegar com D e depois com H. | Marcos: banner, principal e formulário "Dados do texto a gerar". Títulos em ordem: nome da extensão, depois as quatro seções numeradas. |
| R2 | Preencher o formulário | Navegar com F por todos os campos. | Cada campo é lido com o rótulo, a indicação (obrigatório, recomendado) e a dica. Os seletores informam o valor atual. |
| R3 | Gerar sem informação | Ativar "Gerar prévia" com o formulário vazio. | Anúncio de geração bloqueada. Mensagem de alerta lida. Botões "Ir para o campo" com o nome do campo. Ao ativar, o foco vai ao campo correto, que é lido como inválido. |
| R4 | Gerar com sucesso | Preencher a pergunta e ativar "Gerar prévia". | Anúncio "Prévia gerada com N alerta(s). Revise antes de copiar." Navegar por H até "4. Prévia e revisão". |
| R5 | Editar a prévia | Entrar na caixa "Prévia editável" e digitar. | O campo é lido com o contador de caracteres como descrição. |
| R6 | Revisar novamente | Ativar "Revisar novamente". | Anúncio "Revisão concluída: N alerta(s)...". A lista "Alertas da revisão" é lida com a gravidade (Alerta, Bloqueio, Informação) antes de cada mensagem. |
| R7 | Copiar | Ativar "Copiar texto" duas vezes. | Anúncio "Texto copiado." nas duas vezes (a repetição deve ser anunciada). |
| R8 | Dados sensíveis | Digitar o e-mail e a frase de senha de teste. | Seção "Possíveis dados sensíveis (N)", cada item com a categoria, o campo e o trecho mascarado. O valor original nunca é lido. Botão "Substituir..." com nome completo. Depois da substituição, o anúncio e o botão "Desfazer". |
| R9 | Confirmação de limpeza | Ativar "Limpar tudo". | O foco entra na caixa, que é lida como diálogo de alerta com título e descrição. Esc fecha e o foco volta para "Limpar tudo". O mesmo vale para "Cancelar" e "Apagar agora". |
| R10 | Comparar com o texto inicial | Editar a prévia e ativar o botão. | O estado "pressionado" é anunciado. A lista de diferenças indica "Adicionada" e "Removida" antes das linhas. |
| R11 | Indicadores de qualidade | Navegar até "Indicadores locais". | Cada indicador é lido com o nome, o valor e a barra de progresso. O aviso de que são heurísticas é lido. |
| R12 | Configurações | Abrir "Configurações". Importar um JSON inválido e depois um válido. | Seletores lidos com rótulo. O erro de importação é anunciado como alerta e o sucesso como status. |
| R13 | Somente teclado | Percorrer toda a interface sem mouse. | Ordem de foco lógica, foco sempre visível, nenhuma armadilha de foco. |
| R14 | Zoom e texto | Ampliar o navegador a 400% (equivale a 320 px) e aumentar a fonte para 200%. | Tudo continua utilizável sem rolagem horizontal. |
| R15 | Aparência do sistema | Ativar o Alto Contraste do Windows. Se o tema escuro estiver disponível na versão instalada, ativá-lo também. | Bordas, botões e foco continuam visíveis e legíveis. |

## Critério de aprovação

- Nenhum cenário bloqueia a tarefa principal (gerar, revisar e copiar um texto).
- Todo erro, alerta e confirmação é percebido sem olhar a tela.
- Não há controle sem nome, nem foco perdido após fechar a confirmação.
- Problemas leves (redação de um anúncio, ordem de uma dica) viram melhorias, não reprovam.

## Tabela de resultados

| Cód. | NVDA | Narrador | Observações | Data | Responsável |
| --- | --- | --- | --- | --- | --- |
| R1 | não executado | não executado | | | |
| R2 | não executado | não executado | | | |
| R3 | não executado | não executado | | | |
| R4 | não executado | não executado | | | |
| R5 | não executado | não executado | | | |
| R6 | não executado | não executado | | | |
| R7 | não executado | não executado | | | |
| R8 | não executado | não executado | | | |
| R9 | não executado | não executado | | | |
| R10 | não executado | não executado | | | |
| R11 | não executado | não executado | | | |
| R12 | não executado | não executado | | | |
| R13 | não executado | não executado | | | |
| R14 | não executado | não executado | | | |
| R15 | não executado | não executado | | | |

## Como registrar um problema

Informe o cenário, o leitor e a versão, o que foi falado, o que era esperado, e o texto exato anunciado (copie do visualizador de fala do NVDA). Abra uma issue com o rótulo de acessibilidade.

## O que mudou com a primeira análise

- A confirmação de limpeza não movia o foco: agora recebe o foco, descreve a ação e devolve o foco ao fechar, inclusive com Esc.
- Mensagens idênticas e repetidas (por exemplo, copiar duas vezes) podiam não ser anunciadas: cada anúncio agora é um nó novo na região ao vivo.
- Os botões "Ir para o campo" eram idênticos entre si: agora dizem para qual campo levam.
- O formulário não tinha nome: agora é um marco nomeado.
- A 320 px com espaçamento de texto do usuário, o painel gerava rolagem horizontal: corrigido com quebra de palavras, `min-width` nos campos e limite de largura no seletor de arquivo.
