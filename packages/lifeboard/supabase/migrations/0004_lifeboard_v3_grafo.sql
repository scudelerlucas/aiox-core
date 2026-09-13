-- =============================================================================
-- OS-LIFEBOARD · Migration 0004 — v3: grafo com 4 tipos de aresta, notas,
-- subtarefas, goal, duração e átomos do score de assimetria; RPC sem segredo.
-- =============================================================================
-- Origem: `Lucas-Contexto-Geral/docs/ops/LIFEBOARD-V3-4z-atomos-e-gargalo-2026-09-13.md`
-- Tudo ADITIVO: nenhuma coluna existente muda de tipo, nenhuma linha some.
-- `predecessor_ids`/`successor_ids` continuam valendo; `task_edges` é a forma
-- nova, e a leitura (`lifeboard_load`) devolve as duas para o app costurar.
--
-- SEGURANÇA (achado do crítico de 13/09): a versão anterior de `lifeboard_load`
-- carregava o segredo em texto puro no corpo da função — quem lê `pg_proc` lia
-- o segredo. Aqui a função passa a ler de `private.lifeboard_config`, tabela em
-- schema sem exposição pela API e sem política de leitura para nenhum papel.
-- O VALOR do segredo NÃO está neste arquivo: é inserido ao vivo, uma vez, por
-- SQL que o copia da função antiga sem passar por nenhum chat ou log.
-- =============================================================================

-- ── 1 · tasks: duração, hierarquia, goal e os átomos declarados ───────────────
alter table public.tasks
  add column if not exists estimativa_dias numeric(6,2)
    check (estimativa_dias is null or estimativa_dias > 0),
  add column if not exists iniciado_em timestamptz,
  add column if not exists parent_id uuid references public.tasks(id) on delete set null,
  add column if not exists is_goal boolean not null default false,
  -- {opcionalidade: 1..3, esforco: 1|2|3|5, custo: 1|2|3|5} — declarados pelo
  -- operador. s1 (alavanca) e s3 (alcance) NÃO ficam aqui: são calculados a cada
  -- leitura a partir do grafo (mudam sozinhos quando o grafo muda).
  add column if not exists assimetria jsonb;

comment on column public.tasks.estimativa_dias is
  'Duração p80 em dias. Sem ela a tarefa fica fora do caminho crítico (CPM), com aviso — nunca erro.';
comment on column public.tasks.parent_id is
  'Subtarefa aponta para a mãe. A mãe herda esforço e custo como soma das filhas abertas.';
comment on column public.tasks.is_goal is
  'Alvo do caminho crítico. O app mostra um goal por vez; várias linhas podem ser goal.';
comment on column public.tasks.assimetria is
  'Átomos DECLARADOS do score de assimetria: {opcionalidade, esforco, custo}. Alavanca e alcance são calculados.';

create index if not exists tasks_parent_id_idx on public.tasks (parent_id) where parent_id is not null;
create index if not exists tasks_is_goal_idx on public.tasks (owner) where is_goal;

-- ── 2 · task_edges: as arestas declaradas ────────────────────────────────────
-- Só 4 tipos são DECLARADOS. "Sucessão" é a aresta de predecessor lida ao
-- contrário (nunca se grava duas vezes). "Caminho crítico" é RESULTADO do CPM.
create table if not exists public.task_edges (
  id          uuid primary key default gen_random_uuid(),
  origem      uuid not null references public.tasks(id) on delete cascade,
  destino     uuid not null references public.tasks(id) on delete cascade,
  tipo        text not null check (tipo in ('predecessor','correlacao','sinergia','obsolescencia')),
  -- sinergia: desconto no custo do destino (0..1). Nos outros tipos, 1.
  peso        numeric(4,3) not null default 1 check (peso >= 0 and peso <= 1),
  nota        text,
  owner       uuid not null default auth.uid(),
  created_at  timestamptz not null default now(),
  constraint task_edges_sem_laco check (origem <> destino),
  constraint task_edges_unica unique (origem, destino, tipo)
);

comment on table public.task_edges is
  'predecessor: origem precisa fechar antes do destino (entra no CPM). correlacao: andam juntas, sem ordem. sinergia: fazer origem barateia destino (peso = desconto). obsolescencia: fazer origem torna destino desnecessário.';

create index if not exists task_edges_origem_idx  on public.task_edges (origem);
create index if not exists task_edges_destino_idx on public.task_edges (destino);

-- Anti-ciclo para arestas de precedência, olhando as DUAS representações
-- (arrays antigos + task_edges). Mesma lógica de lifeboard_check_task_dag.
create or replace function public.lifeboard_check_edge_dag()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_cycle boolean;
begin
  if new.tipo <> 'predecessor' then
    return new;
  end if;

  with recursive edges(src, dst) as (
      select p, r.id from public.tasks r cross join lateral unnest(r.predecessor_ids) as p
    union all
      select r.id, s from public.tasks r cross join lateral unnest(r.successor_ids) as s
    union all
      select e.origem, e.destino from public.task_edges e
      where e.tipo = 'predecessor' and e.id is distinct from new.id
    union all
      select new.origem, new.destino
  ),
  reach(node) as (
      select e.dst from edges e where e.src = new.destino
    union
      select e.dst from edges e join reach rc on e.src = rc.node
  )
  select exists (select 1 from reach where node = new.origem) into v_cycle;

  if v_cycle then
    raise exception
      'DAG cycle detected: edge % -> % would create a precedence cycle', new.origem, new.destino
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_task_edges_dag_check on public.task_edges;
create trigger trg_task_edges_dag_check
  before insert or update of origem, destino, tipo on public.task_edges
  for each row execute function public.lifeboard_check_edge_dag();

-- ── 3 · task_notes: notas em lista (o `notes` text da tarefa continua) ───────
create table if not exists public.task_notes (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid not null references public.tasks(id) on delete cascade,
  texto       text not null check (length(btrim(texto)) > 0),
  autor       text,
  owner       uuid not null default auth.uid(),
  created_at  timestamptz not null default now()
);
create index if not exists task_notes_task_id_idx on public.task_notes (task_id, created_at desc);

-- ── 4 · RLS — owner = auth.uid(), mesma disciplina das 4 tabelas de 0001 ─────
alter table public.task_edges enable row level security;
alter table public.task_notes enable row level security;

drop policy if exists task_edges_select on public.task_edges;
drop policy if exists task_edges_insert on public.task_edges;
drop policy if exists task_edges_update on public.task_edges;
drop policy if exists task_edges_delete on public.task_edges;
create policy task_edges_select on public.task_edges for select using (owner = auth.uid());
create policy task_edges_insert on public.task_edges for insert with check (owner = auth.uid());
create policy task_edges_update on public.task_edges for update using (owner = auth.uid()) with check (owner = auth.uid());
create policy task_edges_delete on public.task_edges for delete using (owner = auth.uid());

drop policy if exists task_notes_select on public.task_notes;
drop policy if exists task_notes_insert on public.task_notes;
drop policy if exists task_notes_update on public.task_notes;
drop policy if exists task_notes_delete on public.task_notes;
create policy task_notes_select on public.task_notes for select using (owner = auth.uid());
create policy task_notes_insert on public.task_notes for insert with check (owner = auth.uid());
create policy task_notes_update on public.task_notes for update using (owner = auth.uid()) with check (owner = auth.uid());
create policy task_notes_delete on public.task_notes for delete using (owner = auth.uid());

-- ── 5 · Segredo fora do corpo da função ──────────────────────────────────────
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.lifeboard_config (
  chave text primary key,
  valor text not null,
  atualizado_em timestamptz not null default now()
);
alter table private.lifeboard_config enable row level security;
-- Nenhuma política: só o dono do schema (o definer das funções) lê.
revoke all on private.lifeboard_config from public, anon, authenticated;

-- O valor é inserido AO VIVO, uma única vez, sem passar por arquivo nem chat:
--   insert into private.lifeboard_config(chave, valor)
--   select 'load_secret',
--          (regexp_match(pg_get_functiondef('public.lifeboard_load'::regproc),
--                        'v_expected constant text := ''([^'']+)'''))[1]
--   on conflict (chave) do nothing;

-- ── 6 · RPC lifeboard_load: lê o segredo da tabela; devolve edges e notes ────
create or replace function public.lifeboard_load(p_secret text)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_expected text;
  v_owner constant uuid := 'ac542c0f-7389-46de-bd72-934a900f1fd0';
  v_result jsonb;
begin
  select valor into v_expected from private.lifeboard_config where chave = 'load_secret';
  if v_expected is null or p_secret is null or p_secret <> v_expected then
    raise exception 'lifeboard_load: unauthorized' using errcode = 'insufficient_privilege';
  end if;

  select jsonb_build_object(
    'sources', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id, 'kind', s.kind, 'label', s.label,
        'authMode', s.auth_mode, 'lastSyncAt', s.last_sync_at
      ) order by s.label)
      from public.sources s where s.owner = v_owner
    ), '[]'::jsonb),
    'syncLogs', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', sl.id, 'sourceId', sl.source_id, 'runAt', sl.run_at,
        'itemsIngested', sl.items_ingested, 'ok', sl.ok, 'error', sl.error
      ) order by sl.run_at desc)
      from public.sync_log sl where sl.owner = v_owner
    ), '[]'::jsonb),
    'projects', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'sourceId', p.source_id, 'externalRef', p.external_ref,
        'title', p.title, 'status', p.status, 'updatedAt', p.updated_at
      ) order by p.title)
      from public.projects p where p.owner = v_owner
    ), '[]'::jsonb),
    'tasks', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', t.id, 'projectId', t.project_id, 'title', t.title, 'notes', t.notes,
        'dueDate', t.due_date, 'status', t.status, 'priorityHierarq', t.priority_hierarq,
        'predecessorIds', t.predecessor_ids, 'successorIds', t.successor_ids,
        'sourceId', t.source_id, 'externalRef', t.external_ref, 'updatedAt', t.updated_at,
        'estimativaDias', t.estimativa_dias, 'iniciadoEm', t.iniciado_em,
        'parentId', t.parent_id, 'isGoal', t.is_goal, 'assimetria', t.assimetria
      ) order by t.due_date nulls last)
      from public.tasks t where t.owner = v_owner
    ), '[]'::jsonb),
    'edges', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', e.id, 'origem', e.origem, 'destino', e.destino, 'tipo', e.tipo,
        'peso', e.peso, 'nota', e.nota, 'createdAt', e.created_at
      ) order by e.created_at)
      from public.task_edges e where e.owner = v_owner
    ), '[]'::jsonb),
    'notes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', n.id, 'taskId', n.task_id, 'texto', n.texto, 'autor', n.autor,
        'createdAt', n.created_at
      ) order by n.created_at desc)
      from public.task_notes n where n.owner = v_owner
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.lifeboard_load(text) from public;
grant execute on function public.lifeboard_load(text) to anon, authenticated;
