-- =============================================================================
-- OS-LIFEBOARD · Migration 0026 — a fila PULL passa a aceitar a 4ª conta.
-- =============================================================================
-- APLICADA EM PRODUÇÃO em 2026-09-21 (projeto hciiilopyivjaekaxfqp), sob ordem
-- explícita do operador ("aprovar todas execuções e permissões de SQL").
-- Este arquivo existe para que o repositório não fique atrás do banco.
--
-- POR QUÊ
--   Medido em 21/09: `painel_teto_diario` já listava 4 contas (a 4ª,
--   `arborcactus@gmail.com`, entrou depois da 0007) e `painel_fila_prompts`
--   ainda travava em 3, pelo check da 0007. Teto e fila discordando = conta com
--   orçamento e sem fila: item escrito para ela seria RECUSADO pelo banco, e o
--   trabalho nunca andaria. É a mesma classe de falha silenciosa que a 0007 já
--   descrevia em R6 (recusa no banco, nunca em hook).
--
-- ADITIVO: só amplia o conjunto aceito. Nenhuma linha muda, nada é apagado.
-- DESFAZER: recriar o check com as 3 contas da 0007. Em 21/09 não existia
--   nenhuma linha com a 4ª conta (a tabela estava vazia), então a volta é limpa.
--
-- AINDA FALTA (código, não banco): `src/core/prompts/tipos.ts` e
--   `src/lib/frentes/compose.ts` têm a lista das 3 contas no TypeScript. Sem
--   editá-los, a 4ª conta é aceita pelo banco e não aparece na tela.
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
  'As contas que podem receber item da fila PULL. Ampliado de 3 para 4 em 2026-09-21 para casar com public.painel_teto_diario, que já tinha arborcactus@gmail.com.';
