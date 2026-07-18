# Watchdog Anti-Pausa (SEMPRE — permanente)

> Pedido do operador (Lucas), 18/07/2026: "não deixe nenhum travar mais".
> Vale em TODOS os repos e sessões (Claude Code remoto/web).

Sempre que a sessão tiver **trabalho longo em andamento** — subagentes em
background (auditorias, pesquisas, uploads), loops de vários ciclos, ou
qualquer tarefa que atravesse mais de ~20 minutos — aplicar o protocolo:

1. **Armar check-in**: `send_later` (MCP claude-code-remote) com
   `delay_minutes: 30`, mensagem instruindo a: verificar se os agentes em
   background progrediram (tamanho/mtime dos arquivos em
   `<scratchpad>/../tasks/*.output` ou notificações recebidas), **retomar
   via SendMessage qualquer agente morto/estagnado** (a suspensão do
   container mata agentes sem aviso — eles retomam do próprio transcript),
   e processar resultados que chegaram.
2. **Re-armar** o mesmo check-in a cada disparo enquanto o trabalho não
   terminar. Silencioso: não mandar mensagem ao Lucas se nada mudou.
3. **Desligar ao final**: quando o trabalho concluir, não re-armar (e
   apagar triggers recorrentes criados como fallback via `delete_trigger`).

Racional: o container remoto é suspenso por inatividade e o relógio do
trabalho para junto. O check-in acorda a sessão, religa o que travou e o
trabalho avança em janelas de 30 min mesmo sem ninguém olhando.

Diagnóstico de agente travado: último evento do transcript é `user`/tool
result antigo (>30 min) sem texto final de veredito → retomar com
SendMessage ("continue de onde parou e entregue o produto final").
