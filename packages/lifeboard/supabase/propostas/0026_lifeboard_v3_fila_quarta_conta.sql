-- =============================================================================
-- OS-LIFEBOARD · Migration 0026 — a fila PULL passa a aceitar a 4ª conta.
-- =============================================================================
-- ⚠ PROPOSTA — NÃO APLICADA EM PRODUÇÃO. Precisa da decisão descrita em
--   `ACHADO-quarta-conta-esta-em-4-funcoes-2026-09-21.md`, nesta mesma pasta.
--
-- HISTÓRICO HONESTO: em 21/09 esta migration FOI aplicada em produção e
--   REVERTIDA no mesmo dia, pela sessão que a escreveu. O motivo está no
--   ACHADO: ampliar só o CHECK deixa a 4ª conta aceita pela TABELA e recusada
--   pelas FUNÇÕES, que guardam a lista das contas por dentro. Meio-caminho não
--   serve, e produção não deve andar à frente da revisão.
--
-- POR QUÊ A MUDANÇA EXISTE
--   `painel_teto_diario` já lista 4 contas (a 4ª, `arborcactus@gmail.com`,
--   entrou depois da 0007) e `painel_fila_prompts` trava em 3. Teto e fila
--   discordando = conta com orçamento e sem fila: item escrito para ela é
--   recusado pelo banco e o trabalho nunca anda.
--
-- ADITIVO: só amplia o conjunto aceito. Nenhuma linha muda, nada é apagado.
-- DESFAZER: recriar o check com as 3 contas da 0007 (feito em 21/09; a tabela
--   está vazia, então a volta é limpa).
--
-- NÃO BASTA SOZINHA. Falta, no mesmo commit:
--   1. as 4 funções que guardam a lista: `fila_prompts_enfileirar`,
--      `fila_prompts_listar`, `fila_prompts_pegar_interno`,
--      `fila_prompts_fechar_interno` — nas guardas `not in (…)` e na ordem de
--      desempate `case t.conta … then N`;
--   2. o TypeScript (`src/core/prompts/tipos.ts`, `src/lib/frentes/compose.ts`,
--      `src/lib/frentes/types.ts`, `src/components/frentes/conta-chip.tsx`) —
--      já feito nesta branch, `tsc --noEmit` limpo;
--   3. a decisão sobre o teste-guarda `tests/unit/prompts-espelho-sql.test.ts`.
-- =============================================================================

alter table public.painel_fila_prompts
  drop constraint if exists painel_fila_prompts_conta_check;

alter table public.painel_fila_prompts
  add constraint painel_fila_prompts_conta_check
  check (conta = any (array[
    'lucasscudeler@gmail.com',
    'lsgpandora@gmail.com',
    'almapetra.ltda@gmail.com',
    'arborcactus@gmail.com'
  ]::text[]));

comment on constraint painel_fila_prompts_conta_check on public.painel_fila_prompts is
  'As contas que podem receber item da fila PULL. Ampliado de 3 para 4 para casar com public.painel_teto_diario.';
