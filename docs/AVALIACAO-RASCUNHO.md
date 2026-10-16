# Avaliação do rascunho livre (opção B)

## O que é
O analista cola uma anotação bruta; a extensão a divide em trechos e sugere o campo de cada um (contexto, ação feita, ação planejada, resultado, pendência, ação esperada, pergunta). O analista confere e corrige antes de qualquer campo ser preenchido. O texto colado não é guardado.

## Como funciona
1. **Divisão**: uma linha ou frase por trecho, sem marcadores de lista (`segmentDraft`).
2. **Decisões fixas**: pergunta (interrogação ou palavra interrogativa) e ação ainda por fazer ("vou", "vamos", "planejado") nunca são reclassificadas pelo modelo.
3. **Regras de palavras** (`config/draft-rules.ts`): somam pesos por campo (verbo no pretérito de 1ª pessoa, "aguardando", "persiste", "por favor" e semelhantes).
4. **Modelo estatístico pequeno** (`config/draft-model.json`, cerca de 9 KB): Naive Bayes sobre palavras, treinado de forma reprodutível por `trainDraftModel` a partir de `scripts/data/draft-corpus.json` (165 trechos fictícios). Desempata o que as regras não decidem.
5. **Aprendizado com as suas correções** (opt-in, o mesmo interruptor do aprendizado de redação): contagens `fix.<origem>.<destino>` viram um viés pequeno (máximo de 2 pontos, só com saldo mínimo de 3 correções), que desempata sem anular as regras.

## Medida atual (técnica, com dados fictícios)

| Conjunto | Trechos | Acerto |
|---|---|---|
| Anotações fictícias, escritas à parte do corpus de treino | 48 | 48 (100%) |
| Anotações bagunçadas (abreviações, sem verbo claro) | 24 | 21 (87,5%) |

Erros conhecidos no conjunto bagunçado: "acompanhar até sexta" (sugerido como ação esperada em vez de pendência), "fila travada" (contexto em vez de resultado) e "wifi com problema" (sugerido como pergunta).

## Por que esses números não bastam
- Corpus e conjuntos de teste foram escritos pela mesma pessoa (eu, o assistente) e no mesmo estilo; parte das regras foi ajustada depois de ver o conjunto bagunçado. **Os números são otimistas.**
- Não há anotações reais. O analista real escreve de outro jeito, com siglas e nomes internos que o modelo nunca viu.
- Expectativa honesta para o primeiro uso real: acerto bem abaixo dos 87,5%, especialmente em trechos curtos ("reboot feito", "ok") e em anotações sem verbo.

## O que torna isso seguro mesmo errando
- Nada preenche o formulário sem a conferência do analista; trechos de baixa confiança são marcados como "Revise".
- A anotação passa pela detecção de dados sensíveis antes de ser dividida, e dado que bloqueia a geração impede a divisão.
- O formulário nunca é sobrescrito: o conteúdo novo entra depois do que já existe.
- A geração do texto final segue exatamente as mesmas regras de sempre (dados sensíveis, prazo, compromisso implícito, voz da equipe).

## Como medir no piloto (14 dias)
1. Ligar o aprendizado em Configurações.
2. Ligar também os contadores de uso: eles registram `draft_split` (anotações divididas) e `draft_apply` (formulários preenchidos).
3. As correções ficam no aprendizado (`fix.*`), que hoje não é exportado em arquivo. Para o piloto, a leitura é indireta: se `draft_split` for muito maior que `draft_apply`, os analistas estão desistindo depois de ver a divisão. Exportar as chaves `fix.*` é um passo pequeno a incluir se o piloto confirmar o valor da função.
4. Meta sugerida: pelo menos 70% das divisões chegam a preencher o formulário (`draft_apply` sobre `draft_split`). Abaixo de 50%, o rascunho livre atrapalha mais do que ajuda e deve voltar ao desenho.

## Dados reais anonimizados
Para treinar de fato com a linguagem da equipe, o corpus precisa de anotações reais anonimizadas. Isso exige autorização de privacidade da organização e remoção de nomes, matrículas, hosts e dados de acesso. Até lá, o modelo é um ponto de partida genérico.
