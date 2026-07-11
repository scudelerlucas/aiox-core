-- =============================================================================
-- OS-LIFEBOARD · Migration 0002_harden_function_search_path
-- =============================================================================
-- Fecha o advisor WARN "function_search_path_mutable" (Supabase database
-- linter) para as 2 funções criadas em 0001_init: sem search_path fixo, o
-- search_path da sessão poderia em tese redirecionar referências não
-- qualificadas de schema dentro da função (hardening padrão Supabase).
--
-- Aplicada no Supabase real (hciiilopyivjaekaxfqp) em 2026-07-09 via MCP.
-- =============================================================================

alter function public.lifeboard_touch_updated_at() set search_path = public, pg_temp;
alter function public.lifeboard_check_task_dag() set search_path = public, pg_temp;
