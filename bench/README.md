# bench/ — Harness de Medição (ATOM-00)

Prova o ganho de otimização. **Sem medição, nada é comprovável — e você não pode ser agressivo com segurança.**

## O que se otimiza
`valor / tokens_totais` — **NUNCA tokens sozinhos.** Token↓ + valor↓ = reverter.

## Protocolo (funciona nos 3 ambientes)
1. Rode cada tarefa de `TASKS.md` no ambiente.
2. Leia o uso de tokens ao fim do turno:
   - **Claude Code:** rode `/cost`, ou veja o resumo de uso ao fim da resposta.
   - **Claude App (claude.ai):** não expõe token cru — use o comprimento da resposta como proxy, ou conte input via `count_tokens`.
   - **Cowork:** a observabilidade de Agent Runs expõe tokens por run.
3. Dê nota de valor 0-5 à saída (5 = resolveu perfeitamente).
4. Registre 1 linha em `token-value-log.csv`.

## Baseline (faça UMA vez, ANTES de qualquer atom)
Rode as 5 tarefas e registre. Esse é o baseline.
Depois de aplicar ATOM-01/05/etc., rode de novo e compare `valor/token`.

## Meta
≥2x de eficiência de valor vs. baseline, sem queda de nota de valor.
