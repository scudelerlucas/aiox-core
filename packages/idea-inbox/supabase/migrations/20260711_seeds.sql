-- Seed bank do operador (packages/idea-forge/src/seeds/). Escrita
-- exclusivamente server-side via SUPABASE_SERVICE_KEY (idea-forge seeds
-- import / bypassa RLS) — por design, nenhuma policy publica e criada aqui.

create table if not exists public.seeds (
  id text primary key,
  titulo text,
  body text,
  destrava jsonb default '[]',
  compoe_com jsonb default '[]',
  tipo text,
  forja_tier int,
  status text,
  cluster text,
  updated_at timestamptz default now()
);

alter table public.seeds enable row level security;

-- Nenhuma policy publica: a service key (server-only) ignora RLS. Se algum
-- dia for necessario acesso via anon/authenticated key, adicione policies
-- explicitas aqui em vez de desabilitar RLS.
