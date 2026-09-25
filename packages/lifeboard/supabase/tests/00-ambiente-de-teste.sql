-- =============================================================================
-- OS-LIFEBOARD · P7 — O AMBIENTE MÍNIMO PARA RODAR AS MIGRATIONS FORA DO SUPABASE
-- =============================================================================
-- MÉDIO 1 (rodada 12). A guarda de COMPORTAMENTO do caminho do dinheiro é
-- `supabase/tests/fila_prompts.test.sql`, e até aqui ela não rodava em CI
-- nenhum: `.github/workflows/ci.yml` executava, para o lifeboard, só
-- `npm test` e `npm run typecheck`. Medido pelo crítico: com a mutação
-- `and f.custo_estimado_usd <= v_headroom + 100000` na migration — o pull
-- passa a ignorar o teto do dia inteiro — os 1387 testes do vitest ficavam
-- VERDES. O caminho do dinheiro tinha zero cobertura automática.
--
-- Para rodar num Postgres cru (o `services: postgres` do GitHub Actions, ou um
-- `initdb` local) faltam duas coisas que o Supabase dá de graça, e nenhuma
-- delas é do produto:
--   1. os papéis `anon` / `authenticated` / `service_role` e o esquema `auth`
--      com `auth.uid()` / `auth.jwt()` — as migrations dão `grant` a eles e as
--      policies de RLS os chamam;
--   2. as tabelas do PAINEL DE FRENTES, que vivem no hub
--      (`Lucas-Contexto-Geral/supabase/migrations/
--        20260912a_painel_frentes_tres_contas.sql`) e são PRÉ-REQUISITO
--      declarado da 0007. O CI deste repositório não tem o hub clonado, então
--      o DDL delas é espelhado aqui — só as tabelas, porque é só delas que as
--      migrations do lifeboard dependem.
--
-- Este arquivo NÃO é migration: ele não entra em `supabase/migrations/` e nada
-- em produção o aplica. É o palco onde a suíte roda.
-- =============================================================================

create extension if not exists pgcrypto;
create schema if not exists auth;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end $$;

grant usage on schema public to anon, authenticated, service_role;

-- Os dois stubs que as policies chamam. Sem JWT na sessão, os dois devolvem
-- vazio — que é exatamente o que a suíte quer: ela roda como dono do banco e
-- não exercita RLS.
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
create or replace function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb)
$$;
create or replace function auth.role() returns text language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'anon')
$$;

-- ── PRÉ-REQUISITO DO HUB — espelho do DDL, não do arquivo inteiro ───────────
create table if not exists public.painel_frentes_prs (
  repo text not null,
  numero integer not null,
  titulo text not null,
  estado text not null check (estado in ('aberto','mergeado','fechado')),
  rascunho boolean not null default false,
  branch text,
  base text,
  autor text,
  url text not null,
  criado_em timestamptz not null,
  atualizado_em timestamptz not null,
  fechado_em timestamptz,
  mergeado_em timestamptz,
  sessao_ids text[] not null default '{}',
  labels text[] not null default '{}',
  checks text check (checks in ('verde','vermelho','pendente')),
  sincronizado_em timestamptz not null default now(),
  primary key (repo, numero)
);

create table if not exists public.painel_frentes_branches (
  repo text not null,
  branch text not null,
  ultimo_commit_em timestamptz,
  ultimo_commit_msg text,
  sessao_ids text[] not null default '{}',
  tem_pr boolean not null default false,
  sincronizado_em timestamptz not null default now(),
  primary key (repo, branch)
);

create table if not exists public.painel_frentes_sessoes (
  sessao_id text primary key,
  conta text not null,
  titulo text not null,
  estado text not null,
  estado_detalhe text,
  precisa_de text,
  branches text[] not null default '{}',
  repos text[] not null default '{}',
  url text generated always as ('https://claude.ai/code/' || sessao_id) stored,
  criado_em timestamptz,
  atualizado_em timestamptz,
  custo_usd numeric,
  publicado_em timestamptz not null default now()
);
create index if not exists painel_frentes_sessoes_conta_idx
  on public.painel_frentes_sessoes (conta, atualizado_em desc);

create table if not exists public.painel_frentes_sync (
  id bigserial primary key,
  fonte text not null,
  executado_em timestamptz not null default now(),
  ok boolean not null,
  itens integer not null default 0,
  erro text
);

create table if not exists public.painel_frentes_leitores (
  email text primary key,
  nome text,
  criado_em timestamptz not null default now()
);

-- A função de autorização que as policies de `painel_fila_prompts` e
-- `painel_teto_diario` chamam (0007 §7). Mesma definição do hub.
create or replace function public.painel_frentes_leitor_autorizado()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.painel_frentes_leitores l
    where l.email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;
