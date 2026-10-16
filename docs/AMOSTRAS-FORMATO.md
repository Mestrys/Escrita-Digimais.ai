# Amostras de texto para validar o formato no sistema de chamados

Arquivo gerado por `src/tests/sample-docs.test.ts` (rode `UPDATE_SAMPLES=1 npx vitest run src/tests/sample-docs.test.ts` para atualizar). Todos os casos são fictícios, no perfil padrão, com data de referência fixa. Use o roteiro em [VALIDACAO-PILOTO.md](VALIDACAO-PILOTO.md).

## 1. Solicitar informações (`request_information`)

Destinatário: user. Alertas: nenhum.

```text
Olá,

Para continuarmos a análise, precisamos de algumas informações.

Contexto: Usuária relata erro ao abrir a planilha de custos.

Informações necessárias:
1. Qual mensagem de erro aparece na tela?
2. O erro ocorre com outros arquivos?

Prazo para retorno: 20/10/2026 às 17h

Por segurança, não envie senhas, tokens ou outros dados de acesso neste chamado.

O seu retorno permitirá que continuemos a análise.

Agradecemos a colaboração.
Equipe de Service Desk
```

## 2. Nota técnica (`technical_note`)

Destinatário: technical_team. Alertas: nenhum.

```text
Contexto: Falha de login no portal.

Ações realizadas: Validado cadastro do usuário.

Resultado observado: Cadastro ativo.

Situação atual: Aguardando janela de manutenção.

Próximos passos: Reiniciar o serviço de autenticação.
```

## 3. Registrar pendência (`pending`)

Destinatário: user. Alertas: nenhum.

```text
Olá,

O atendimento permanece pendente. Seguem os detalhes.

Pendência: Envio da planilha corrigida pelo usuário.

Pendente com: usuário

Ação esperada: Enviar o arquivo atualizado.

Aguardamos a conclusão do item acima para seguirmos com o atendimento.

Agradecemos a colaboração.
Equipe de Service Desk
```

## 4. Solicitar “De acordo” do gestor (`manager_approval`)

Destinatário: user. Alertas: nenhum.

```text
Olá,

Precisamos do seu “De acordo” para prosseguir com a solicitação descrita abaixo.

Objeto da aprovação: Instalação do software de modelagem no equipamento patrimonial 00123.

Justificativa: O software é necessário para a rotina de fechamento mensal.

Efeito da aprovação: Com a aprovação, a instalação será agendada.

Por favor, responda com “De acordo” ou “Não aprovado”.

Agradecemos a colaboração.
Equipe de Service Desk
```

## 5. Comunicar andamento (`progress_update`)

Destinatário: user. Alertas: nenhum.

```text
Olá,

Passamos para informar o andamento do seu chamado.

Contexto: Lentidão ao abrir o sistema.

Ações realizadas: Limpeza do cache do navegador.

Resultado observado: A lentidão diminuiu parcialmente.

Pendência: Acompanhar o comportamento por dois dias.

Agradecemos a colaboração.
Equipe de Service Desk
```

## 6. Confirmar solução com o usuário (`solution_confirmation`)

Destinatário: user. Alertas: nenhum.

```text
Olá,

Realizamos as ações descritas abaixo e gostaríamos de confirmar se a situação foi resolvida.

Contexto: Impressora não imprimia.

Ações realizadas: Reinstalado o driver da impressora.

Resultado observado: Página de teste impressa.

A sua confirmação nos permitirá registrar o resultado do atendimento.

Agradecemos a colaboração.
Equipe de Service Desk
```

## 7. Encerrar chamado solucionado (`closure_resolved`)

Destinatário: user. Alertas: nenhum.

```text
Olá,

Estamos encerrando este chamado com a situação solucionada, conforme descrito abaixo.

Contexto: Impressora não imprimia.

Ações realizadas: Reinstalado o driver da impressora.

Resultado validado: Página de teste impressa e confirmada no equipamento.

O usuário confirmou a solução.

O chamado foi encerrado com base no resultado descrito acima.

Se precisar de apoio novamente, entre em contato conosco.

Agradecemos a colaboração.
Equipe de Service Desk
```

## 8. Encerrar por ausência de retorno (`closure_no_response`)

Destinatário: user. Alertas: nenhum.

```text
Olá,

Estamos encerrando este chamado porque não recebemos retorno às tentativas de contato registradas abaixo.

Solicitação do atendimento: Solicitação de acesso à pasta compartilhada.

Informação aguardada: Confirmação do nome da pasta.

Tentativas de contato registradas:
1. 01/10/2026
2. 05/10/2026
3. 08/10/2026

Aviso prévio de encerramento registrado em 09/10/2026.

Este encerramento não indica que a situação foi resolvida.

Se precisar de apoio novamente, entre em contato conosco.

Agradecemos a colaboração.
Equipe de Service Desk
```

## 9. Redirecionar ou escalonar (`redirect_or_escalate`)

Destinatário: user. Alertas: nenhum.

```text
Olá,

Para que a análise tenha continuidade, estamos encaminhando este atendimento. Destino: Equipe de Infraestrutura.

Motivo do encaminhamento: A análise exige acesso administrativo ao ambiente de armazenamento.

Verificações já realizadas: Validadas as permissões do usuário.

O atendimento seguirá com a equipe indicada.

Agradecemos a colaboração.
Equipe de Service Desk
```

## 10. Texto livre guiado (`guided_free_text`)

Destinatário: user. Alertas: nenhum.

```text
Olá,

O atendimento presencial foi agendado.

Contexto: Troca de equipamento solicitada.

Agradecemos a colaboração.
Equipe de Service Desk
```
