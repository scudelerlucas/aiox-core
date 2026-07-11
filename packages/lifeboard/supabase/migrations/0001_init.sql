-- =============================================================================
-- OS-LIFEBOARD · Migration 0001_init · Épico E1 (Fundação de dados)
-- =============================================================================
-- APLICADA no Supabase real (hciiilopyivjaekaxfqp) em 2026-07-09, com aprovação
-- explícita de Lucas. Migration só-aditiva (nenhum DROP destrutivo), portanto
-- o kill-switch nº 1 (--confirm-destructive) não se aplicou.
-- Ver 0002_harden_function_search_path.sql para o hardening pós-apply.
-- -----------------------------------------------------------------------------
-- Autor: Dara (@data-engineer) · Comando: *create-schema · Data: 2026-07-09
-- Fonte da verdade: packages/lifeboard/PRD.md §7 + architecture.md §5/§9
-- Projeto alvo: Supabase hciiilopyivjaekaxfqp (nome real "quiz-diagnosys",
-- região us-east-1 — o PRD dizia "São Paulo", correção de doc, não de infra;
-- é o mesmo projeto compartilhado por vários outros produtos de Lucas).
-- -----------------------------------------------------------------------------
-- Conteúdo:
--   4 tabelas canônicas: sources, projects, tasks, sync_log
--   RLS owner = auth.uid() em todas (SELECT/INSERT/UPDATE/DELETE)
--   Índices: tasks(due_date), tasks(status), unique (source_id, external_ref)
--            em projects e tasks (idempotência de sync)
--   Validação anti-ciclo DAG (trigger BEFORE em tasks, CTE recursiva)
--
-- Idempotência: usa IF NOT EXISTS / CREATE OR REPLACE onde possível, seguro
--               para reaplicar. NÃO contém DROP destrutivo.
--
-- Nota de dependência de auth: em produção, auth.uid() é provido pelo Supabase.
--   Para teste local (Postgres efêmero, sem GoTrue) crie um stub:
--     create schema if not exists auth;
--     create or replace function auth.uid() returns uuid
--       language sql stable as $$ select current_setting('request.jwt.claim.sub', true)::uuid $$;
--   (ver 0001_init.test.md). A migration em si NÃO cria o schema auth.
-- =============================================================================

-- Extensão para gen_random_uuid() (Supabase normalmente já tem; idempotente).
create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- Tabela: sources — cada fonte de ingestão (Calendar/Gmail/Drive/Notas/chat)
-- -----------------------------------------------------------------------------
create table if not exists public.sources (
  id            uuid primary key default gen_random_uuid(),
  kind          text not null check (kind in ('calendar','gmail','drive','notes','claude_chat')),
  label         text,
  auth_mode     text not null check (auth_mode in ('api','manual')),
  last_sync_at  timestamptz,
  owner         uuid not null default auth.uid(),
  created_at    timestamptz not null default now()
);

comment on table  public.sources           is 'Fontes de ingestão normalizadas para o modelo canônico (PRD §7). RLS por dono.';
comment on column public.sources.kind      is 'calendar | gmail | drive | notes | claude_chat';
comment on column public.sources.auth_mode is 'api = fonte nativa via MCP; manual = colagem/import (Notas/chats)';
comment on column public.sources.owner     is 'Dono da linha (RLS owner = auth.uid()). Camada C do CHC.';

-- -----------------------------------------------------------------------------
-- Tabela: projects — 1 projeto por agenda/label/pasta lógica de uma fonte
-- -----------------------------------------------------------------------------
create table if not exists public.projects (
  id            uuid primary key default gen_random_uuid(),
  source_id     uuid not null references public.sources(id) on delete cascade,
  external_ref  text,
  title         text,
  status        text,
  updated_at    timestamptz not null default now(),
  owner         uuid not null default auth.uid(),
  created_at    timestamptz not null default now()
);

comment on table  public.projects              is 'Projetos consolidados por fonte (PRD §7). Camada C do CHC.';
comment on column public.projects.external_ref is 'Id nativo na fonte; parte da chave de idempotência (source_id, external_ref).';

-- -----------------------------------------------------------------------------
-- Tabela: tasks — coluna vertebral canônica; toda fonte normaliza para cá
-- -----------------------------------------------------------------------------
create table if not exists public.tasks (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid references public.projects(id) on delete cascade,
  title             text,
  notes             text,
  due_date          timestamptz,
  status            text not null default 'open'
                      check (status in ('open','in_progress','blocked','done')),
  priority_hierarq  jsonb not null default '{"s1": 1, "s2": 1, "s3": 1}'::jsonb,
  predecessor_ids   uuid[] not null default '{}'::uuid[],
  successor_ids     uuid[] not null default '{}'::uuid[],
  source_id         uuid references public.sources(id) on delete cascade,
  external_ref      text,
  updated_at        timestamptz not null default now(),
  owner             uuid not null default auth.uid(),
  created_at        timestamptz not null default now()
);

comment on table  public.tasks                  is 'Tarefa canônica com dependências explícitas (PRD §5/§7). Grafo antecedência→posterioridade.';
comment on column public.tasks.priority_hierarq is 'jsonb {s1,s2,s3} — insumo do motor HIERARQ (camada O, inalienável). Score = s1*s2*s3.';
comment on column public.tasks.predecessor_ids  is 'IDs de tarefas que DEVEM terminar antes desta (aresta pred→esta). Declarado, não inferido (PRD §5.3).';
comment on column public.tasks.successor_ids    is 'IDs de tarefas que dependem desta (aresta esta→succ). Declarado, não inferido.';

-- -----------------------------------------------------------------------------
-- Tabela: sync_log — auditoria de cada rodada de ingestão por fonte
-- -----------------------------------------------------------------------------
create table if not exists public.sync_log (
  id             uuid primary key default gen_random_uuid(),
  source_id      uuid not null references public.sources(id) on delete cascade,
  run_at         timestamptz not null default now(),
  items_ingested integer not null default 0,
  ok             boolean not null default false,
  error          text,
  owner          uuid not null default auth.uid(),
  created_at     timestamptz not null default now()
);

comment on table public.sync_log is 'Auditoria de sync por fonte (PRD §7/§9). Alimenta /api/health e a flag "fonte X desatualizada".';

-- -----------------------------------------------------------------------------
-- Índices
-- -----------------------------------------------------------------------------
-- Índices de acesso do motor "hoje" (PRD §7: basta due_date e status).
create index if not exists idx_tasks_due_date on public.tasks (due_date);
create index if not exists idx_tasks_status   on public.tasks (status);

-- Idempotência do sync: rodar 2× não duplica (chave lógica de upsert).
-- NULLS NOT DISTINCT garante que múltiplas linhas com external_ref NULL na mesma
-- fonte não sejam permitidas indevidamente? — não: mantemos NULLs distintos
-- (padrão) para permitir itens sem external_ref; a unicidade só vale quando há ref.
create unique index if not exists uq_projects_source_extref
  on public.projects (source_id, external_ref);
create unique index if not exists uq_tasks_source_extref
  on public.tasks (source_id, external_ref);

-- Índices em foreign keys (evita full scan em cascades/joins).
create index if not exists idx_projects_source_id on public.projects (source_id);
create index if not exists idx_tasks_project_id    on public.tasks (project_id);
create index if not exists idx_tasks_source_id     on public.tasks (source_id);
create index if not exists idx_sync_log_source_id  on public.sync_log (source_id);

-- Manter updated_at coerente em projects/tasks.
create or replace function public.lifeboard_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_projects_touch on public.projects;
create trigger trg_projects_touch
  before update on public.projects
  for each row execute function public.lifeboard_touch_updated_at();

drop trigger if exists trg_tasks_touch on public.tasks;
create trigger trg_tasks_touch
  before update on public.tasks
  for each row execute function public.lifeboard_touch_updated_at();

-- =============================================================================
-- Validação anti-ciclo DAG (stress test 1 do PRD §11)
-- =============================================================================
-- Estratégia: em BEFORE INSERT/UPDATE de tasks, montamos o conjunto de arestas
-- de precedência (x "antes de" y) combinando AS DUAS representações:
--   * y.predecessor_ids contém x   ⇒ aresta x → y
--   * x.successor_ids   contém y   ⇒ aresta x → y
-- Para a linha NEW usamos os valores NEW (que ainda não estão na tabela); para
-- as demais linhas usamos a tabela. Como NEW é a única linha alterada, qualquer
-- ciclo novo passa por NEW. Fazemos uma travessia (CTE recursiva) a partir dos
-- sucessores diretos de NEW; se NEW.id for alcançável de volta ⇒ há ciclo.
--
-- Isso rejeita A→B→A independentemente da representação (predecessor OU
-- successor OU mista), cobre auto-referência e é seguro contra loop infinito
-- (UNION deduplica nós → recursão termina).
-- -----------------------------------------------------------------------------
create or replace function public.lifeboard_check_task_dag()
returns trigger
language plpgsql
as $$
declare
  v_cycle boolean;
begin
  -- Normaliza arrays nulos (defesa; colunas já têm default '{}').
  new.predecessor_ids := coalesce(new.predecessor_ids, '{}'::uuid[]);
  new.successor_ids   := coalesce(new.successor_ids,   '{}'::uuid[]);

  -- Auto-referência é ciclo trivial.
  if new.id = any(new.predecessor_ids) or new.id = any(new.successor_ids) then
    raise exception
      'DAG cycle: task % cannot reference itself in predecessor_ids/successor_ids', new.id
      using errcode = 'check_violation';
  end if;

  with recursive edges(src, dst) as (
      -- Arestas de precedência das demais linhas (via predecessor_ids): p → r
      select p, r.id
      from public.tasks r
      cross join lateral unnest(r.predecessor_ids) as p
      where r.id <> new.id
    union all
      -- Arestas de precedência das demais linhas (via successor_ids): r → s
      select r.id, s
      from public.tasks r
      cross join lateral unnest(r.successor_ids) as s
      where r.id <> new.id
    union all
      -- Arestas de NEW (predecessores): p → NEW
      select p, new.id
      from unnest(new.predecessor_ids) as p
    union all
      -- Arestas de NEW (sucessores): NEW → s
      select new.id, s
      from unnest(new.successor_ids) as s
  ),
  reach(node) as (
      -- Sementes: sucessores diretos de NEW (caminho de comprimento 1).
      select e.dst from edges e where e.src = new.id
    union
      -- Passo recursivo: segue arestas de precedência para frente.
      select e.dst
      from edges e
      join reach rc on e.src = rc.node
  )
  select exists (select 1 from reach where node = new.id) into v_cycle;

  if v_cycle then
    raise exception
      'DAG cycle detected: inserting/updating task % would create a dependency cycle', new.id
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

comment on function public.lifeboard_check_task_dag() is
  'Rejeita ciclos em predecessor_ids/successor_ids (stress test 1 do PRD §11). BEFORE INSERT/UPDATE em tasks.';

drop trigger if exists trg_tasks_dag_check on public.tasks;
create trigger trg_tasks_dag_check
  before insert or update of predecessor_ids, successor_ids, id on public.tasks
  for each row execute function public.lifeboard_check_task_dag();

-- =============================================================================
-- RLS — owner = auth.uid() em todas as 4 tabelas (PRD §7, single-user)
-- =============================================================================
-- service_role do Supabase ignora RLS (bypass) — usar com cautela no server-side.
-- Política por comando (SELECT/INSERT/UPDATE/DELETE) para auditoria explícita.

alter table public.sources  enable row level security;
alter table public.projects enable row level security;
alter table public.tasks    enable row level security;
alter table public.sync_log enable row level security;

-- sources
drop policy if exists sources_select on public.sources;
create policy sources_select on public.sources for select using (owner = auth.uid());
drop policy if exists sources_insert on public.sources;
create policy sources_insert on public.sources for insert with check (owner = auth.uid());
drop policy if exists sources_update on public.sources;
create policy sources_update on public.sources for update using (owner = auth.uid()) with check (owner = auth.uid());
drop policy if exists sources_delete on public.sources;
create policy sources_delete on public.sources for delete using (owner = auth.uid());

-- projects
drop policy if exists projects_select on public.projects;
create policy projects_select on public.projects for select using (owner = auth.uid());
drop policy if exists projects_insert on public.projects;
create policy projects_insert on public.projects for insert with check (owner = auth.uid());
drop policy if exists projects_update on public.projects;
create policy projects_update on public.projects for update using (owner = auth.uid()) with check (owner = auth.uid());
drop policy if exists projects_delete on public.projects;
create policy projects_delete on public.projects for delete using (owner = auth.uid());

-- tasks
drop policy if exists tasks_select on public.tasks;
create policy tasks_select on public.tasks for select using (owner = auth.uid());
drop policy if exists tasks_insert on public.tasks;
create policy tasks_insert on public.tasks for insert with check (owner = auth.uid());
drop policy if exists tasks_update on public.tasks;
create policy tasks_update on public.tasks for update using (owner = auth.uid()) with check (owner = auth.uid());
drop policy if exists tasks_delete on public.tasks;
create policy tasks_delete on public.tasks for delete using (owner = auth.uid());

-- sync_log
drop policy if exists sync_log_select on public.sync_log;
create policy sync_log_select on public.sync_log for select using (owner = auth.uid());
drop policy if exists sync_log_insert on public.sync_log;
create policy sync_log_insert on public.sync_log for insert with check (owner = auth.uid());
drop policy if exists sync_log_update on public.sync_log;
create policy sync_log_update on public.sync_log for update using (owner = auth.uid()) with check (owner = auth.uid());
drop policy if exists sync_log_delete on public.sync_log;
create policy sync_log_delete on public.sync_log for delete using (owner = auth.uid());

-- =============================================================================
-- FIM 0001_init — aplicada no Supabase real em 2026-07-09.
-- =============================================================================
