# Estudo: IA embarcada na extensão

Data do estudo: 16/10/2026. Pergunta: dá para a extensão gerar textos mais naturais com um modelo de linguagem rodando no próprio computador, sem violar as regras do projeto (sem rede, sem conteúdo de chamado fora do navegador, permissões só `sidePanel` e `storage`)?

## 1. Caminhos possíveis

| Caminho | Situação em 16/10/2026 | Pontos de atenção |
|---|---|---|
| IA embutida do Edge (Prompt API e Writing Assistance APIs: Writer, Rewriter, Summarizer) | **Prévia para desenvolvedores só nos canais Canary e Dev** (versão 138.0.3309.2 ou superior), com flag ligada. Extensões podem usar. Modelo Phi-4-mini; a partir da 150.0.4070 há o modelo prévio Aion-1.0-Instruct, que roda também em CPU | Não está no Edge estável da maioria das empresas. Exige Windows 10/11 ou macOS 13.3+, 20 GB livres no perfil, 5,5 GB de VRAM para o Phi-4-mini e conexão sem limite para baixar o modelo. A documentação não lista idiomas, então o português precisa ser testado. Aceita saída restrita por JSON ou expressão regular (`responseConstraint`), útil para travar o formato |
| API embutida do Chrome (Rewriter, Prompt) | Teste de origem até o Chrome 148 para extensões; não vale para o Edge | Só serve de referência |
| Modelo empacotado na extensão (WebGPU ou WASM com WebLLM, transformers.js ou ONNX Runtime Web) | Funciona hoje em qualquer Edge com WebGPU | Pesos de centenas de MB a alguns GB dentro do pacote (ou baixados, o que quebra o "sem rede"); a política de conteúdo precisa liberar `'wasm-unsafe-eval'`, o que enfraquece a CSP atual; desempenho depende da máquina do analista |

Fontes: [Prompt API no Edge](https://learn.microsoft.com/microsoft-edge/web-platform/prompt-api), [Writing Assistance APIs no Edge](https://learn.microsoft.com/microsoft-edge/web-platform/writing-assistance-apis), [Rewriter API no Chrome](https://developer.chrome.com/docs/ai/rewriter-api).

## 2. Experimento (modelos reais, mesmo texto do motor)

Rodei modelos pequenos em CPU (4 núcleos, bf16, decodificação determinística) sobre 7 textos do próprio motor, um por tipo de comunicação. Dois desenhos:

- **Reescrita**: o modelo recebe o texto pronto do motor e deve "soar natural" sem mudar fatos.
- **Geração do corpo**: o modelo recebe só os fatos estruturados, mais 2 exemplos de texto bom, e escreve o corpo da mensagem (saudação e assinatura seriam colocadas pelo código).

Trava automática usada: nomes, siglas, números, datas e termos entre aspas do original precisam continuar no texto; nenhum número ou data novo; nenhum alerta novo da revisão do próprio produto (`reviewText`); sem travessão ou emoji; saudação e assinatura preservadas (no desenho de reescrita).

| Modelo | Desenho | Passou na trava | Tempo médio por texto (CPU) | Leitura humana da qualidade |
|---|---|---|---|---|
| Qwen2.5-0.5B-Instruct | reescrita | 3 de 7 | 7 s | Copia o texto em 3 casos e inventa em 2: "Vou enviar o retorno logo após essa data", assinatura "[Seu Nome]" |
| Qwen2.5-1.5B-Instruct | reescrita | 6 de 7 | 15 s | Praticamente devolve o texto igual: passa na trava, mas **não fica mais natural** |
| Qwen2.5-1.5B-Instruct | geração do corpo | 6 de 7 | 9 s | Fluente em parte, mas com erros de sentido: inverteu a pendência ("a planilha está sendo enviada"), respondeu "De acordo" no lugar do gestor, acrescentou promessa ("faremos o melhor esforço") e "solução implementada" |
| Phi-4-mini-instruct (o modelo do Edge) | geração do corpo | 5 de 7 | 18 s | O mais natural de todos ("Atualizamos o status do seu chamado... Resetamos sua senha"), mas **só 2 dos 7 textos ficaram usáveis**: aprovou sozinho em nome do gestor ("De acordo. A instalação será agendada conforme possível"), disse "Fico feliz em saber" onde ninguém relatou nada, embaralhou o encaminhamento |

Duas conclusões que importam:

1. **A trava automática é necessária, mas não basta.** Ela deixou passar textos com sentido errado (pendência invertida, promessa nova sem número ou data). A taxa "passou na trava" superestima a qualidade real. Só leitura humana pega esses erros.
2. **Modelos abaixo de cerca de 4 bilhões de parâmetros não seguem de forma confiável a regra "só os fatos".** Eles melhoram o português corrido, mas trocam quem faz o quê, criam compromissos e decidem pelo analista. Justamente o que o motor atual bloqueia.

Velocidade: uma máquina com GPU compatível tende a ser bem mais rápida que os 3 a 15 tokens por segundo medidos em CPU, mas isso não foi medido aqui.

Limites do experimento: 7 casos, sem GPU, sem o Aion-1.0-Instruct, sem modelos de 7B ou mais, um único conjunto de instruções. Não é uma medida de produção; é evidência suficiente para decidir o desenho.

## 3. Arquitetura recomendada

1. **Motor determinístico continua sendo a fonte de verdade.** Ele produz o texto base, com todas as travas.
2. **Prosa determinística melhor (prioridade)**: o ganho de naturalidade mais seguro está em tirar do texto o que denuncia o formulário. Exemplos vistos nas saídas: "conta dele" e "o teste do usuário" escritos para o próprio usuário; blocos com rótulo ("Resumo da situação: ..."); conectores repetidos. Isso é regra, não modelo, e não tem risco de invenção.
3. **IA embutida do Edge como recurso opcional, desligado por padrão, "Sugerir reescrita"**, só quando `LanguageModel.availability()` ou `Rewriter.availability()` responder "available":
   - entrada: o texto base já mascarado pelo motor, nunca o campo cru;
   - saída restrita por `responseConstraint` ao formato esperado;
   - a sugestão só vira texto se passar na trava (fatos preservados, nenhum número ou data novo, nenhum alerta novo, nenhuma aprovação ou confirmação em nome de terceiros) e é mostrada com comparação lado a lado; o analista aceita ou descarta;
   - qualquer falha volta ao texto do motor, sem aviso de erro;
   - o recurso se esconde sozinho onde a API não existe (hoje, o Edge estável).
4. **Não empacotar modelo próprio** neste ciclo: exigiria enfraquecer a CSP e carregar centenas de MB sem ganho comprovado sobre a opção 3.

## 4. Como decidir com dados
- Antes de qualquer código da opção 3: o analista testar o texto-base e a sugestão do Edge Canary/Dev (ou da Aion) em 10 chamados reais e marcar quantos ficaram melhores. Critério de entrada: pelo menos 7 em 10 melhores e nenhum com sentido alterado.
- Se o piloto rodar em Edge estável, a opção 3 não ajuda ninguém ainda; vale então concentrar tudo na prosa determinística.

## 4.1 Decisão (16/10/2026)
A equipe usa o **Microsoft Edge estável**. Segundo a documentação do Edge (atualizada em 06/10/2026), a Prompt API e as APIs Writer e Rewriter continuam em prévia só nos canais Canary e Dev. Portanto o recurso opcional "Sugerir reescrita" (opção 3) **não funcionaria hoje para ninguém da equipe** e fica adiado. Todo o esforço de naturalidade segue na prosa determinística. Reavaliar quando a API chegar ao Edge estável ou se a equipe adotar um canal de pré-lançamento.

## 5. Como reproduzir
Os scripts e as saídas brutas estão em `scripts/estudo-ia/` (`rodar_reescrita.py`, `rodar_geracao.py`, `fatos.json`, `rascunhos.json`, `saidas-dos-modelos.json`). Requer Python, `torch` (CPU) e `transformers`; baixa os modelos da Hugging Face. Rode fora do pacote da extensão: nada disso entra no zip.
