# Validação e piloto

Roteiro para quem valida a extensão antes e durante o piloto. Cada etapa diz o que fazer, o que esperar e onde registrar. Nada aqui exige enviar dados para fora do navegador.

## 1. Instalação no Edge (15 minutos)
1. Obtenha o `.zip` da release e confira o SHA-256 com o valor registrado na release (`sha256sum arquivo.zip` no Linux ou macOS; `Get-FileHash arquivo.zip` no PowerShell).
2. Extraia o `.zip` em uma pasta própria.
3. Abra `edge://extensions`, ative "Modo de desenvolvedor" e escolha "Carregar sem compactação", selecionando a pasta extraída (a que contém `manifest.json`).
4. Confirme que a extensão pede apenas as permissões `sidePanel` e `storage`.
5. Clique no ícone: o painel lateral abre com o título "Assistente de Textos do Service Desk".

Fluxo completo, com o resultado esperado:

| Passo | Ação | Esperado |
|---|---|---|
| 1 | Tipo "Solicitar informações", preencha contexto e duas perguntas | Gerar prévia habilitado |
| 2 | Gerar prévia | Texto numerado, sem alerta de bloqueio |
| 3 | Colar um e-mail fictício no contexto | Aviso de dado mascarado, com opção de substituir e desfazer |
| 4 | Colar um valor com cara de senha (fictício) | Bloqueio da geração e da cópia, sem exibir o valor |
| 5 | "Outra variação" | Texto diferente, mesmo conteúdo |
| 6 | Copiar texto | Texto na área de transferência; pergunta se deseja limpar |
| 7 | "Mais ações", "Limpar formulário e prévia", "Desfazer limpeza" | Conteúdo some e volta |
| 8 | "Revisar texto pronto", cole um texto, "Revisar agora" | Alertas e indicadores |
| 9 | Configurações, importar perfil e camada da equipe (se houver) | Mensagem de validação |
| 10 | Fechar e reabrir o painel | Nenhum conteúdo de chamado permanece |

## 2. Formato no sistema de chamados (D6)
Objetivo: confirmar que o texto gerado cola e é exibido corretamente no sistema de chamados real.

1. Abra [AMOSTRAS-FORMATO.md](AMOSTRAS-FORMATO.md). Os casos são fictícios.
2. Para cada um dos 10 tipos, copie o bloco de texto, cole em um chamado **de teste** (não em chamado real) e salve.
3. Registre o resultado:

| Tipo | Quebras de linha | Numeração | Acentos e aspas | Limite de caracteres | Campo aceita o texto inteiro | Observação |
|---|---|---|---|---|---|---|
| request_information | | | | | | |
| technical_note | | | | | | |
| pending | | | | | | |
| manager_approval | | | | | | |
| progress_update | | | | | | |
| solution_confirmation | | | | | | |
| closure_resolved | | | | | | |
| closure_no_response | | | | | | |
| redirect_or_escalate | | | | | | |
| guided_free_text | | | | | | |

4. Se algo quebrar (por exemplo o sistema remove linhas em branco), registre o caso. O ajuste é uma decisão de formato no perfil de linguagem, não do motor.
5. Apague os chamados de teste.

## 3. Leitor de tela
Execute o roteiro de [ACESSIBILIDADE.md](ACESSIBILIDADE.md) com NVDA e com o Narrador do Windows e preencha a tabela de resultados daquele documento. Mudanças recentes a conferir: seletor de modo segmentado, menu "Mais ações", os três botões de limpar e o destaque só do gatilho no alerta.

## 4. Piloto
Duração mínima: 14 dias. Participantes: o grupo definido pela organização.

1. Ligue os contadores: pela política `usageCounters` (`on`, ou `optional` com convite) ou pela caixa em Configurações. Eles guardam só números por categoria e ficam no navegador.
2. Peça o feedback semanal em [FEEDBACK-PILOTO.md](FEEDBACK-PILOTO.md), por canal interno.
3. Ao final, cada pessoa usa Configurações, "Exportar contadores", e entrega o arquivo `contadores-de-uso.json`. Não contém texto de chamado.
4. Reúna os arquivos em uma pasta e rode:

```
node scripts/analyze-usage.mjs pasta/*.json
```

O resumo traz taxa de bloqueio, cópias por geração, variações, revisões, tipos mais usados, alertas mais frequentes e tempo até copiar, além de dizer quem atende ao corte (padrão: 30 gerações e 14 dias por pessoa; ajustável com `--min-geracoes` e `--min-dias`).

## 5. Como decidir D8 e D9
- Decida só com os arquivos que atendem ao corte e registre os excluídos.
- Alerta frequente que a maioria ignora: candidato a rebaixar de gravidade ou ajustar a regra.
- Tipo com muitas variações e poucas cópias: o modelo desse tipo precisa de revisão.
- Taxa de bloqueio alta por um único motivo: olhar a regra do detector com o corpus de avaliação (`docs/AVALIACAO.md`) antes de mexer.
- Tempo até copiar sempre na faixa de menos de 1 minuto: pode indicar que o texto não está sendo lido; reforçar a orientação de revisar antes de copiar.
