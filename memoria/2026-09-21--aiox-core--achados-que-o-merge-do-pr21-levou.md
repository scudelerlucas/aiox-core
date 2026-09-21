# 2026-09-21 · aiox-core · os achados que o merge do PR #21 levou junto

## Feito
- Drenei a fila de 89 avisos parados desde 14/09. O decisivo: **o PR #21 foi
  mergeado pelo Lucas em 14/09 às 21:02** — a sessão foi desinscrita dele.
- CodeRabbit e Codex postaram achados **depois do último envio** daquele PR.
  Ninguém os tratou, e o merge os levou para a `main`. Conferi um a um contra o
  código de hoje: **6 ainda vivos**.
- Branch reiniciada da `main` (o PR dela foi mergeado; a branch antiga estava
  inteira superada pelas migrations 0022–0024 e pelo CI novo de outras sessões).
- Corrigidos, com teste que fica vermelho quando a correção é desfeita (6 de 6):
  - **D50** medir de novo o mesmo valor não renovava a hora da medição; passadas
    12 h a trava recusava todo disparo da conta. Migration 0025.
  - **D51** recusa por medição parada mostrava frase de "sem espaço livre".
  - **D52** checagem de dono da sessão lia sem trava (conta errada para sempre).
  - **A** o aviso de saída do navegador desarmava no meio da gravação.
  - **C** erro velho de uma porta aparecia depois de a outra dar certo.
  - **B** relógio órfão desarmava confirmação nova na fila.
- Guarda do SQL deixou de usar número mágico: agora nomeia o bloco que falhou.

## Decisões
- **Não apliquei a 0025 em produção.** O DEPLOY.md de 15/09 diz que identidade
  de projeto vem do operador, não de script. Ela vai pelo PR; aplicar é passo do
  Lucas. Provas rodaram em transações que se desfazem.
- Teste antigo `D3` trocou de conta: a Alma Petra passou a ter dois motivos de
  recusa ao mesmo tempo e o bloco deixaria de medir o que o nome dele diz.
- Story: não criei. A exigência foi retirada em 14/09 por decisão do operador.

## Pendências
- Aplicar a 0025 no Supabase e rodar T60/T61/T62 no SQL Editor.
- D52 só tem conferência de trava — a corrida de duas conexões não é
  reproduzível de dentro de uma transação.

## Links
- PR #21 (mergeado): https://github.com/scudelerlucas/aiox-core/pull/21
- Migration: `packages/lifeboard/supabase/migrations/0025_lifeboard_v3_medicao_fresca_e_dono.sql`

## Ferramentas usadas
Supabase MCP (provas revertidas), GitHub MCP, vitest, tsc, eslint.

## Vetos aceitos: 0
