# Avaliação da detecção de dados sensíveis

A detecção de dados sensíveis é heurística e pode errar. Este documento mostra quanto erra hoje, medido contra um corpus sintético, e como o CI impede que a qualidade piore sem que ninguém perceba.

## Como funciona

- Corpus: `src/tests/eval/sensitive-corpus.ts`, com 107 casos 100% sintéticos (CPFs, CNPJs e cartões de teste, domínio reservado `.test`). Há casos positivos (um ou mais dados esperados), negativos comuns e negativos difíceis (textos que parecem dado sensível mas não são).
- Avaliador: `src/tests/eval/run-eval.ts` compara, por caso, o conjunto de categorias esperado com o detectado.
- Teste: `src/tests/eval/sensitive-eval.test.ts`, executado em `npm test` e no CI.

## Pisos aplicados no CI

| Métrica | Piso | Por quê |
| --- | --- | --- |
| Nenhum segredo bloqueante escapa (credencial, token, chave privada, segredo, string de conexão) | 100% dos casos | É o erro mais grave: um segredo seguiria para o texto. |
| Revocação por categoria bloqueante | 100% | Cada tipo de segredo precisa ser pego. |
| Precisão global | 90% | Falso positivo cansa o analista, mas custa menos que um vazamento. |
| Revocação global | 99% | |
| Caso sem falha conhecida | acerto exato | Qualquer regressão aparece com o nome do caso. |

## Resultado atual

| Categoria | Acertos | Falsos positivos | Perdas | Precisão | Revocação |
| --- | --- | --- | --- | --- | --- |
| Credencial | 12 | 0 | 0 | 100% | 100% |
| Token | 6 | 0 | 0 | 100% | 100% |
| Segredo ou chave | 6 | 0 | 0 | 100% | 100% |
| Chave privada | 2 | 0 | 0 | 100% | 100% |
| String de conexão | 3 | 0 | 0 | 100% | 100% |
| CPF | 3 | 2 | 0 | 60% | 100% |
| CNPJ | 2 | 1 | 0 | 67% | 100% |
| Cartão | 3 | 0 | 0 | 100% | 100% |
| Dados bancários (Pix, agência e conta) | 2 | 0 | 0 | 100% | 100% |
| E-mail | 3 | 0 | 0 | 100% | 100% |
| Telefone | 3 | 0 | 0 | 100% | 100% |
| Endereço | 3 | 0 | 0 | 100% | 100% |
| IP | 3 | 1 | 0 | 75% | 100% |
| Servidor interno | 2 | 0 | 0 | 100% | 100% |
| URL interna | 2 | 0 | 0 | 100% | 100% |
| Caminho interno | 3 | 0 | 0 | 100% | 100% |
| Bloco de log | 1 | 0 | 0 | 100% | 100% |
| **Global** | **59** | **4** | **0** | **93,7%** | **100%** |

## Falhas conhecidas (aceitas por desenho)

- CPF e CNPJ com pontuação são sinalizados mesmo com dígito verificador inválido (`111.111.111-11`, `123.456.789-00`, `11.222.333/0001-80`). A escolha é conservadora: formato de CPF em chamado merece atenção. O custo é falso positivo em números de protocolo parecidos.
- Número de versão com quatro partes dentro da faixa de IP (`10.2.3.4`) é sinalizado como IP. O motivo do alerta já informa que pode ser uma versão.

Esses casos ficam marcados com `gap` no corpus e continuam contando nas métricas. Se alguém corrigir um deles, o teste pede para remover a marcação.

## Achado desta avaliação

A primeira medição encontrou perdas reais: credenciais em formato de variável de ambiente (`DB_PASSWORD=...`, `SECRET_KEY=...`, `AWS_SECRET_ACCESS_KEY=...`, `API_TOKEN=...`) não eram bloqueadas, e `DB_PASSWORD` era classificado como nome de servidor. Os detectores foram ajustados (com repetição limitada para não piorar o tempo de execução) e os casos viraram teste de regressão.

## Limites desta avaliação

- O corpus é pequeno e foi escrito por quem conhece o detector. As métricas são otimistas e servem como guarda de regressão, não como estimativa de desempenho em chamados reais.
- Não há dados reais por regra de privacidade. Uma avaliação cega com textos revisados por analistas sêniores continua sendo o próximo passo (roadmap, item 34).
- Os indicadores de qualidade do texto (clareza, objetividade e outros) não são cobertos aqui.

## Como adicionar casos

1. Inclua o caso em `sensitive-corpus.ts` com `p(...)`, `n(...)` ou `h(...)`. Use apenas dados fictícios.
2. Rode `npx vitest run src/tests/eval`. A mensagem de falha traz o relatório completo.
3. Se o detector errar de forma aceita, marque `gap` e registre o motivo neste documento. Se errar por defeito, corrija o detector e mantenha o caso.
