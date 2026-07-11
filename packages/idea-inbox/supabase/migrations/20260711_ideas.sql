-- Memoria permanente do idea-inbox (packages/idea-inbox/src/store-remote.mjs).
-- Escrita exclusivamente server-side via SUPABASE_SERVICE_KEY (bypassa RLS) —
-- por design, nenhuma policy publica e criada aqui.

create extension if not exists pgcrypto;

create table if not exists public.ideas (
  id uuid primary key default gen_random_uuid(),
  run_id text,
  source text,
  channel text,
  text text,
  score int,
  project text,
  branch text,
  blocked boolean,
  created_at timestamptz default now()
);

alter table public.ideas enable row level security;

-- Nenhuma policy publica: a service key (server-only) ignora RLS. Se algum dia
-- for necessario acesso via anon/authenticated key, adicione policies explicitas
-- aqui em vez de desabilitar RLS.
