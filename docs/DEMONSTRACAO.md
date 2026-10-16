# Roteiro de demonstração (7 minutos)

Roteiro para apresentar a extensão funcionando. Todos os dados são fictícios. O roteiro foi ensaiado em Chromium real, com o `.zip` extraído, por `scripts/demo-capture.mjs`; as imagens geradas servem de plano B.

## Antes de começar (2 minutos)
1. Extraia o `.zip` em uma pasta própria (a que contém `manifest.json`).
2. Em `edge://extensions`, ative "Modo de desenvolvedor", clique em "Carregar sem compactação" e escolha a pasta.
3. Mostre as permissões da extensão: somente `sidePanel` e `storage`. Não há permissão de site, de abas nem de rede.
4. Clique no ícone e abra o painel lateral.

## Passo a passo
| Passo | O que fazer | O que mostrar e dizer |
|---|---|---|
| 1 | Tipo "Solicitar informações". Em "Por que a informação é necessária": `Usuária relata erro ao abrir a planilha de custos.` Em "Perguntas": `Qual mensagem de erro aparece na tela` e, na linha de baixo, `O erro ocorre com outros arquivos`. Clique em "Gerar prévia". | Texto pronto, cordial, com perguntas numeradas e o aviso de segurança. Tudo gerado localmente, por regras, sem IA externa. A prévia é editável. |
| 2 | Troque o contexto por `Usuária maria.souza@exemplo.test relata erro ao abrir a planilha.` | Aviso de possível dado pessoal, com botão "Substituir por [e-mail omitido]" e "Desfazer". O texto do analista nunca muda sem ação dele. |
| 3 | Troque o contexto por `O usuário informou: senha: Teste@12345 para acessar o portal.` e gere. | Bloqueio: a geração e a cópia ficam impedidas, e o valor aparece mascarado (`•••• (11 caracteres)`), nunca em claro. |
| 4 | Volte ao contexto normal, gere e clique em "Outra variação". | Texto diferente, mesmo conteúdo e mesmas regras. |
| 5 | Clique em "Copiar texto". | Texto copiado e pergunta sobre limpar. Nada é enviado nem aplicado ao chamado. |
| 6 | Abra "Mais ações" e use "Limpar formulário e prévia", depois "Desfazer limpeza". | Conteúdo some e volta por 30 segundos. Depois disso é descartado da memória. |
| 7 | Clique em "Revisar texto pronto" e cole: `Como você deveria ter lido, o erro é seu. Garantimos a solução ainda hoje. URGENTE!!` Clique em "Revisar agora". | Alertas de tom acusatório, compromisso que a equipe não pode assumir e ênfase em caixa alta, cada um com o trecho destacado e uma sugestão. |
| 8 | Abra "Configurações". | Perfil de linguagem (importável, validado), camada da equipe (só restringe regras), contadores de uso desligados por padrão e o que o navegador guarda. |
| 9 | Feche o painel e reabra. | Nenhum conteúdo de chamado permanece. |

## Mensagens principais
- Funciona 100% local: sem rede, sem telemetria, permissões mínimas, política de conteúdo estrita.
- O analista sempre revisa: a extensão alerta e sugere, não altera nem envia sozinha.
- Credenciais bloqueiam, dados pessoais são mascarados com aviso.
- A organização controla o perfil por política, com assinatura opcional.

## Se algo falhar
| Sintoma | Causa provável | O que fazer |
|---|---|---|
| "Carregar sem compactação" recusa a pasta | Pasta errada (sem `manifest.json` na raiz) | Selecione a pasta extraída que contém `manifest.json` |
| O painel não abre | Edge anterior à versão 116 | Atualize o Edge ou use o modo popup |
| Cópia não funciona | O navegador exige clique direto no botão | Clique em "Copiar texto" sem teclar antes; ou selecione e copie a prévia |
| Qualquer outra falha na hora | | Mostre as imagens de `demo/` (plano B) e o resultado dos testes em `docs/ENTREGA.md` |
