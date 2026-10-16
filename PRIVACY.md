# Política de privacidade

Assistente de Textos do Service Desk, versão 0.1.0.

## Resumo
A extensão funciona inteiramente no navegador do analista. Ela não coleta, não transmite e não vende dados. Não há servidores, telemetria, analytics, pixels ou rastreadores.

## O que é processado
| Dado | Onde | Por quanto tempo |
|---|---|---|
| Texto digitado nos campos (contexto, ações, perguntas e similares) | Memória do painel lateral | Até o painel ser fechado, o analista limpar, ou o tempo de inatividade configurado expirar (padrão: 15 minutos). Após uma limpeza manual, uma cópia fica só em memória por 30 segundos para “Desfazer limpeza” e então é descartada |
| Texto gerado e editado na prévia | Memória do painel lateral | Mesmo critério acima |
| Resultado da detecção de dados sensíveis | Memória do painel lateral | Mesmo critério acima |

O processamento é local e determinístico. Os dados sensíveis detectados são exibidos somente de forma mascarada.

## O que é armazenado
Somente em `chrome.storage.local`, neste navegador:
- **Preferências**: nível técnico, formalidade, tamanho padrão e tempo de limpeza automática.
- **Perfil de linguagem importado** (opcional): textos institucionais validados, sem dados de chamados.

O texto colado no modo “Revisar texto pronto” segue as mesmas regras do restante do conteúdo. Nenhum conteúdo de chamado, texto gerado, histórico ou dado pessoal é armazenado. O botão “Limpar tudo” permite apagar também o que estiver salvo.

Administradores podem fornecer um perfil por política (`chrome.storage.managed`), somente leitura para a extensão.

## O que não é feito
- Não lê o conteúdo de páginas, abas, histórico, cookies nem campos de sistemas de chamados.
- Não envia mensagens nem altera chamados.
- Não copia nada para a área de transferência sem um clique explícito em “Copiar texto”.
- Não faz nenhuma chamada de rede. A política de segurança de conteúdo (CSP) da extensão contém `connect-src 'none'`.

## Inteligência artificial
Esta versão não usa serviços de IA. Existe apenas um ponto de extensão desativado. Uma ativação futura dependeria de política da organização, aviso de privacidade e consentimento organizacional, e de mascaramento prévio dos dados. Credenciais nunca seriam enviadas.

## Contato
Dúvidas sobre privacidade devem ser encaminhadas ao responsável pela implantação na sua organização.
