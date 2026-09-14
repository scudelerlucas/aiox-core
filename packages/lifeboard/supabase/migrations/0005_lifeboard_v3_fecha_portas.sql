-- =============================================================================
-- OS-LIFEBOARD · Migration 0005 — fecha as portas que a auditoria da 0004 abriu
-- ao vivo (crítico de segurança, 13/09/2026, provas executadas e revertidas).
-- =============================================================================
-- 1. O gatilho antigo de `tasks` (0001) só via os arrays; um ciclo entrava com
--    a aresta em `task_edges` de um lado e `successor_ids` do outro. Agora as
--    duas guardas leem as DUAS representações.
-- 2. `parent_id` aceitava mãe-de-si-mesma e A↔B — a herança de esforço da
--    peça 3 viraria recursão infinita. CHECK + anti-ciclo de hierarquia.
-- 3. `unique (origem, destino, tipo)` era global: um dono bloqueava o outro com
--    uma linha que a RLS esconde. Passa a ser por dono, e as FKs viram compostas
--    `(id, owner)` — aresta/nota só aponta para tarefa do MESMO dono.
-- 4. Nota escrita à mão é o único dado que não se re-sincroniza de lugar nenhum:
--    `task_notes` passa a `on delete restrict` (apagar exige decisão explícita).
--    Aresta continua `cascade` (sem uma das pontas ela não significa nada).
-- 5. `assimetria` sem CHECK aceitava `{esforco: 0.0001}` → score 10⁴ para sempre.
-- 6. RPC: banco novo nascia sem segredo e dizia "unauthorized" (mensagem
--    mentirosa); e `v_owner` fixo. Agora: erro próprio para segredo ausente e
--    `coalesce(auth.uid(), <dono>)` — chamada anônima com o segredo (o painel,
--    inclusive a leitora sem login) continua lendo o board do operador; um
--    usuário LOGADO com conta própria lê o PRÓPRIO board (vazio, se não for o
--    dono). Quem precisa ver o board do operador não loga: usa o painel.
-- Reaplicável (provado com o arquivo inteiro dentro de begin/rollback contra o
-- banco já migrado). As tabelas novas tinham 0 linhas quando isto rodou.
-- =============================================================================

-- ── 1 · Guarda de `tasks` passa a ver `task_edges` e `parent_id` ─────────────
create or replace function public.lifeboard_check_task_dag()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_cycle boolean;
begin
  new.predecessor_ids := coalesce(new.predecessor_ids, '{}'::uuid[]);
  new.successor_ids   := coalesce(new.successor_ids,   '{}'::uuid[]);

  if new.id = any(new.predecessor_ids) or new.id = any(new.successor_ids) then
    raise exception
      'DAG cycle: task % cannot reference itself in predecessor_ids/successor_ids', new.id
      using errcode = 'check_violation';
  end if;

  -- Precedência: arrays das outras linhas + arrays de NEW + task_edges.
  with recursive edges(src, dst) as (
      select p, r.id from public.tasks r cross join lateral unnest(r.predecessor_ids) as p
      where r.id <> new.id
    union all
      select r.id, s from public.tasks r cross join lateral unnest(r.successor_ids) as s
      where r.id <> new.id
    union all
      select p, new.id from unnest(new.predecessor_ids) as p
    union all
      select new.id, s from unnest(new.successor_ids) as s
    union all
      select e.origem, e.destino from public.task_edges e where e.tipo = 'predecessor'
  ),
  reach(node) as (
      select e.dst from edges e where e.src = new.id
    union
      select e.dst from edges e join reach rc on e.src = rc.node
  )
  select exists (select 1 from reach where node = new.id) into v_cycle;

  if v_cycle then
    raise exception
      'DAG cycle detected: inserting/updating task % would create a dependency cycle', new.id
      using errcode = 'check_violation';
  end if;

  -- Hierarquia: subir pelos pais a partir de NEW.parent_id; chegar em NEW.id é ciclo.
  if new.parent_id is not null then
    if new.parent_id = new.id then
      raise exception 'hierarchy cycle: task % cannot be its own parent', new.id
        using errcode = 'check_violation';
    end if;
    with recursive up(node) as (
        select new.parent_id
      union
        select t.parent_id from public.tasks t join up on t.id = up.node
        where t.parent_id is not null and t.id <> new.id
    )
    select exists (select 1 from up where node = new.id) into v_cycle;
    if v_cycle then
      raise exception
        'hierarchy cycle detected: task % would become an ancestor of itself', new.id
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

comment on function public.lifeboard_check_task_dag() is
  'Rejeita ciclos de precedência (arrays + task_edges) e de hierarquia (parent_id). BEFORE INSERT/UPDATE em tasks.';

drop trigger if exists trg_tasks_dag_check on public.tasks;
create trigger trg_tasks_dag_check
  before insert or update of predecessor_ids, successor_ids, parent_id, id on public.tasks
  for each row execute function public.lifeboard_check_task_dag();

-- ── 2 · parent_id: nunca a si mesma ──────────────────────────────────────────
alter table public.tasks drop constraint if exists tasks_parent_nao_e_si;
alter table public.tasks
  add constraint tasks_parent_nao_e_si check (parent_id is null or parent_id <> id);

-- ── 3 · Escopo por dono: unique e FKs compostas ──────────────────────────────
-- Ordem importa para reaplicar: as FKs filhas (task_edges/task_notes) dependem
-- de `tasks_id_owner_unica` — derrubar as filhas ANTES do pai, senão a 2ª
-- execução para em "cannot drop constraint … other objects depend on it".
alter table public.task_edges drop constraint if exists task_edges_origem_fkey;
alter table public.task_edges drop constraint if exists task_edges_destino_fkey;
alter table public.task_edges drop constraint if exists task_edges_origem_mesmo_dono_fkey;
alter table public.task_edges drop constraint if exists task_edges_destino_mesmo_dono_fkey;
alter table public.task_notes drop constraint if exists task_notes_task_id_fkey;
alter table public.task_notes drop constraint if exists task_notes_task_mesmo_dono_fkey;

alter table public.tasks drop constraint if exists tasks_id_owner_unica;
alter table public.tasks add constraint tasks_id_owner_unica unique (id, owner);

alter table public.task_edges drop constraint if exists task_edges_unica;
alter table public.task_edges drop constraint if exists task_edges_por_dono_unica;
alter table public.task_edges
  add constraint task_edges_por_dono_unica unique (owner, origem, destino, tipo);

alter table public.task_edges
  add constraint task_edges_origem_mesmo_dono_fkey
    foreign key (origem, owner) references public.tasks(id, owner) on delete cascade,
  add constraint task_edges_destino_mesmo_dono_fkey
    foreign key (destino, owner) references public.tasks(id, owner) on delete cascade;

-- ── 4 · Nota: mesmo dono, e apagar a tarefa exige apagar a nota antes ────────
alter table public.task_notes
  add constraint task_notes_task_mesmo_dono_fkey
    foreign key (task_id, owner) references public.tasks(id, owner) on delete restrict;

comment on constraint task_notes_task_mesmo_dono_fkey on public.task_notes is
  'RESTRICT de propósito: nota manuscrita não se recupera de nenhuma fonte. Apagar a tarefa (ou a fonte dela, em cascata) falha enquanto houver nota — decisão explícita, nunca perda silenciosa.';

-- ── 5 · assimetria: domínio dos átomos declarados ────────────────────────────
alter table public.tasks drop constraint if exists tasks_assimetria_dominio;
alter table public.tasks
  add constraint tasks_assimetria_dominio check (
    assimetria is null or (
      jsonb_typeof(assimetria) = 'object'
      and jsonb_typeof(assimetria->'opcionalidade') = 'number'
      and jsonb_typeof(assimetria->'esforco') = 'number'
      and jsonb_typeof(assimetria->'custo') = 'number'
      and (assimetria->>'opcionalidade')::numeric between 1 and 3
      and (assimetria->>'esforco')::numeric in (1, 2, 3, 5)
      and (assimetria->>'custo')::numeric in (1, 2, 3, 5)
    )
  );

-- ── 6 · RPC: erro honesto para segredo ausente; dono = quem chama, ou o operador
create or replace function public.lifeboard_load(p_secret text)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_expected text;
  v_owner uuid := coalesce(auth.uid(), 'ac542c0f-7389-46de-bd72-934a900f1fd0'::uuid);
  v_result jsonb;
begin
  select valor into v_expected from private.lifeboard_config where chave = 'load_secret';
  if v_expected is null then
    raise exception
      'lifeboard_load: segredo nao configurado — inserir a chave load_secret em private.lifeboard_config (ver DEPLOY.md)'
      using errcode = 'config_file_error';
  end if;
  if p_secret is null or p_secret <> v_expected then
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
