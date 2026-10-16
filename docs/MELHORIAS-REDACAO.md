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

## 4. Decisões que cabem ao usuário
- D-IA-1: aprovar a opção A (preferência local) para a próxima fase.
- D-IA-2: autorizar o uso de amostras reais anonimizadas para treinar a opção B.
- D-IA-3: manter a opção C fora do escopo (recomendado).
