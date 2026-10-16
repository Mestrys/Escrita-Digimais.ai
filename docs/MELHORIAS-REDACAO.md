# Qualidade da redação: diagnóstico, melhorias e decisão sobre IA

## 1. Diagnóstico (medido nos textos gerados)

| Sintoma | Causa no motor | Efeito |
|---|---|---|
| Texto "de formulário" (`Contexto: ...`, `Ações realizadas: ...`) | Cada campo vira um bloco com rótulo fixo (`planner.ts` e `renderer.ts`) | Parece relatório, não mensagem a uma pessoa |
| Mistura de vozes ("Passamos para informar" + "Resetei a senha") | Os campos do analista entram palavra por palavra | O usuário lê a nota interna do analista |
| "Pendente com: usuário" escrito ao próprio usuário | Rótulo fixo sem considerar o destinatário | Estranho e levemente acusatório |
| Saudação genérica ("Olá,") | Não existe campo de nome | Todo texto parece o mesmo |
| Fechos que repetem a abertura ("O chamado foi encerrado com base no resultado descrito acima") | Frases-base fixas por tipo | Enchimento sem informação |
| "Não fiel à demanda" | O motor só reorganiza o que o formulário capta; não interpreta a anotação livre do analista | O analista precisa reescrever o que já sabia |

Limite estrutural: um motor de templates só reorganiza. Naturalidade plena exige interpretar texto livre, e isso é um problema de linguagem, não de regras.

## 2. O que esta versão já entrega (determinístico, sem IA)

- **Estilo Natural (padrão para texto a pessoas)** e **Estruturada** (comportamento anterior, preservado). Preferência salva em Configurações.
- **Voz da equipe** (`src/domain/voice.ts`): converte "resetei" em "resetamos", "Reinstalado o driver" em "Reinstalamos o driver", "vou validar" em "vamos validar", "meu" em "nosso". Lista fechada de verbos; nunca regra genérica; cada conversão é avisada (`voice_adjusted`, informativo, sem penalidade).
- **Frases corridas**: até 3 ações com verbo reconhecido viram uma frase ("Até aqui, resetamos a senha e testamos a conexão."); caso contrário, lista numerada.
- **Frases de ligação** no lugar dos rótulos secos, com duas variações cada.
- **Saudação com primeiro nome** (campo opcional, validado, varrido por dados sensíveis, nunca gravado).
- Respeita o perfil da organização: rótulos próprios, saudação própria e textos obrigatórios desligam ou preservam o que foi definido.
- Notas técnicas e destinatários técnicos não mudam.

## 3. Sobre o "micro modelo de IA que aprende no dia a dia"

### Veredito
Aprender com o conteúdo dos chamados é incompatível com as regras não negociáveis do projeto (nada de conteúdo de chamado persistido, sem rede, permissões só `sidePanel` e `storage`, CSP estrita). Um modelo generativo embarcado também não cabe hoje. Há, porém, dois caminhos compatíveis.

### Opções

| Opção | O que faz | Custo | Risco | Compatível com as regras? |
|---|---|---|---|---|
| A. Aprendizado de preferência (recomendada) | Aprende quais variações de abertura, frase de ligação e fecho o analista escolhe e mantém; ajusta a ordem de sugestão | Baixo (reaproveita `usage-counters`, só inteiros e chaves fechadas) | Baixo | Sim: nenhum texto é guardado |
| B. Classificador de rascunho livre | O analista cola a anotação bruta; um classificador pequeno (regras mais regressão logística de poucos KB, pesos no pacote) separa em ações, resultado, pendência e perguntas | Médio | Médio (erros de classificação; sempre mostrar a divisão antes de gerar) | Sim, se treinado fora e embarcado como dado; sem aprender com conteúdo real |
| C. Modelo generativo local (WebGPU/WASM) | Reescreve o texto livremente | Alto (dezenas a centenas de MB, `wasm-unsafe-eval` na CSP, desempenho em máquina corporativa) | Alto (alucina; compromete prazos, causas e promessas, justo o que o motor protege) | Não sem revisar a CSP e a política de privacidade |

### Recomendação
1. Aprovar a **opção A** agora: a única que "aprende no dia a dia" sem violar privacidade.
2. Avaliar a **opção B** depois do piloto, com dados do analisador de uso (`scripts/analyze-usage.mjs`) e amostras reais anonimizadas autorizadas.
3. **Não adotar a opção C** neste ciclo. Reavaliar só se o piloto mostrar que A e B não resolvem e se a organização aprovar a mudança de CSP.

### Critérios de validação
- Piloto de 14 dias comparando Natural e Estruturada: proporção de textos copiados sem edição e nota do analista (ver `FEEDBACK-PILOTO.md`).
- Nenhuma regressão nos testes de dados sensíveis, prazo, compromisso implícito e encerramento.
- Alvo sugerido: pelo menos 60% dos textos copiados sem edição manual no estilo Natural, a confirmar com o piloto.

## 3.1 Opção A: implementada (aprovada)
- **Sinais**: copiar o texto = "mantida" para cada ponto com mais de uma redação (abertura, fecho do tipo, cortesia, frase de ligação); "Outra variação" = "trocada", só para os pontos cuja redação mudou.
- **Armazenamento**: `learnedStyle`, contadores inteiros em chaves fechadas `acc|rej.<ponto>.<escopo>.<índice>`; sanitizados na leitura e na gravação; incluídos em "Limpar tudo".
- **Efeito**: com saldo líquido de pelo menos 3 (mantidas menos trocadas) para uma redação que não é a padrão, ela passa a ser a "variação 0" daquele tipo ou formalidade. A variação continua girando a partir dela.
- **Esquecimento**: ao chegar a 60, as contagens do mesmo ponto e escopo são divididas por dois.
- **Controle**: opt-in em Configurações, botão "Zerar aprendizado", desligado quando a política `usageCounters` é `off`.
- **Fora do alcance, de propósito**: não lê nem guarda o que o analista edita no texto; não altera regras de segurança, bloqueios ou alertas.

## 3.2 Catálogo ampliado
- Aberturas por tipo e formalidade: de 2 para 4 redações (9 tipos que têm abertura). Fechos por tipo: de 2 para 4 nos 4 tipos que os usam. Cortesia do perfil padrão: de 2 para 4 por formalidade.
- Frases de ligação e de ação esperada: de 2 para 4 (`LEAD_SIZE`), e 4 aberturas para cada frase corrida de ações feitas e planejadas.
- As redações novas ficam depois das originais: a variação 0 e os textos já validados não mudam. "Outra variação" passa de 8 para 64 textos distintos em "Solicitar informações".
- Regras de escrita para qualquer redação nova: pt-BR, sem travessão, sem emoji, sem caixa alta, sem prazo, culpa ou promessa; fora dos encerramentos, nada que afirme solução sem pedir confirmação (as regras `resolution_claim` e `pending_without_expected_action` já pegaram duas frases minhas durante o desenvolvimento). O teste de variações percorre as 64 combinações de todos os tipos e formalidades, para destinatário usuário e gestor.
- O limite de 10 redações por ponto vem do aprendizado (`MAX_INDEX`); o perfil da organização aceita até 6 fechos.

## 3.3 Opção B: implementada (autorizada), com ressalva sobre os dados
Rascunho livre: o analista cola a anotação, confere a divisão sugerida e só então os campos são preenchidos. Regras mais um classificador pequeno embarcado. Detalhes, medida e limites em [AVALIACAO-RASCUNHO.md](AVALIACAO-RASCUNHO.md). Como não existem anotações reais anonimizadas, o modelo foi treinado em exemplos fictícios; a taxa de acerto em produção é desconhecida e será medida no piloto pelas correções dos analistas.

## 3.4 Prosa determinística v2
Motivada pelo estudo de IA ([ESTUDO-IA-EMBARCADA.md](ESTUDO-IA-EMBARCADA.md)): o ganho de naturalidade mais seguro está em regras, não em modelo.
- **Voz para o destinatário** (`toRecipientVoice`, só quando o texto é para o usuário e no estilo Natural): "com o usuário" vira "com você", "o teste do usuário" vira "o seu teste", "conta dele" vira "sua conta", "Aguardando teste do usuário" vira "Aguardamos seu teste". Substantivos em lista fechada (com gênero e número); "usuário" seguido de nome próprio nunca é convertido; fora da lista, nada muda. Cada troca aparece no alerta informativo `voice_adjusted`.
- **Frases fixas ao usuário**: "Você confirmou a solução." e "não há registro de confirmação da sua parte"; para o gestor continuam em terceira pessoa.
- **Parágrafos**: seções de fatos (contexto, ações feitas, resultado) formam um parágrafo e as de próximos passos (pendência, ações planejadas, ação esperada) outro; listas numeradas continuam em bloco próprio.
- **Limite conhecido**: os rótulos ainda aparecem dentro dos parágrafos ("O que observamos: ..."). Fragmentos soltos ("Conexão ok no nosso teste") não podem ser reescritos em frase completa sem interpretar o texto, e isso só um modelo faria, com o risco medido no estudo.

## 4. Decisões que cabem ao usuário
- D-IA-1: opção A aprovada e implementada (seção 3.1).
- D-IA-2: opção B autorizada e implementada com dados fictícios; falta fornecer (ou autorizar a coleta de) anotações reais anonimizadas para melhorar o modelo.
- D-IA-3: manter a opção C fora do escopo (recomendado).
