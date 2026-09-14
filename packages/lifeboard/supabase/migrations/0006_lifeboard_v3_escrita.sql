-- =============================================================================
-- OS-LIFEBOARD · Migration 0006 — v3: escrita (peça P6). Uma RPC única,
-- protegida pelo MESMO segredo de `lifeboard_load`, para notas, subtarefas,
-- meta (goal), átomos declarados, duração e as 4 arestas — a partir da página
-- da tarefa.
-- =============================================================================
-- Origem: `Lucas-Contexto-Geral/docs/ops/LIFEBOARD-V3-4z-atomos-e-gargalo-2026-09-13.md`.
-- Só ADITIVO: nenhuma tabela/coluna existente muda; nenhuma linha se apaga por
-- este arquivo. Reaplicável (CREATE OR REPLACE / DROP IF EXISTS antes de recriar).
--
-- Por que uma RPC só, e não uma por operação: o app não tem sessão Supabase
-- por usuário para escrita (o painel lê com o segredo server-only, sem login
-- de app — o login Google é só o portão do middleware). Multiplicar funções
-- multiplicaria a superfície do mesmo segredo sem ganhar nada; uma função com
-- `p_op` centraliza o gate e deixa cada ramo pequeno.
--
-- Toda validação de FORMA (campo obrigatório ausente, tipo errado, enum fora
-- do domínio, dono de outra tarefa) é feita aqui, em português, com
-- `errcode = 'check_violation'`. Validação de REGRA DE NEGÓCIO que já tem
-- guarda no banco (ciclo de precedência, ciclo de hierarquia, domínio de
-- `assimetria`, unicidade de aresta) NÃO é duplicada — a operação roda, o
-- gatilho/CHECK correspondente levanta, e o `EXCEPTION WHEN` deste arquivo
-- traduz a mensagem para português sem reimplementar a lógica.
-- =============================================================================

-- ── 0 · fonte manual de notas/subtarefas — 1 por dono, criada sob demanda ────
-- Convenção: `sources.kind = 'notes'`, `auth_mode = 'manual'`. Se o dono ainda
-- não tem uma (bancos que só ingeriram fontes automáticas), a primeira
-- subtarefa cria a linha. `label` fixo para ser reconhecível no filtro de
-- fontes do dashboard.
create or replace function private.lifeboard_fonte_manual(p_owner uuid)
returns uuid
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_source_id uuid;
begin
  select id into v_source_id
    from public.sources
    where owner = p_owner and kind = 'notes' and auth_mode = 'manual'
    order by created_at
    limit 1;

  if v_source_id is not null then
    return v_source_id;
  end if;

  insert into public.sources (kind, label, auth_mode, owner)
  values ('notes', 'Notas manuais (LifeBoard)', 'manual', p_owner)
  returning id into v_source_id;

  return v_source_id;
end;
$$;

-- ── 1 · guarda de posse — tarefa/aresta/nota precisa ser do MESMO dono ───────
create or replace function private.lifeboard_exige_tarefa(p_id uuid, p_owner uuid, p_rotulo text)
returns void
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if p_id is null then
    raise exception '% é obrigatório.', p_rotulo using errcode = 'check_violation';
  end if;
  if not exists (select 1 from public.tasks where id = p_id and owner = p_owner) then
    raise exception '% não existe (ou não é sua): %', p_rotulo, p_id using errcode = 'check_violation';
  end if;
end;
$$;

-- ── 2 · a RPC de escrita ──────────────────────────────────────────────────────
create or replace function public.lifeboard_mutate(p_secret text, p_op text, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_expected text;
  v_owner uuid := coalesce(auth.uid(), 'ac542c0f-7389-46de-bd72-934a900f1fd0'::uuid);
  v_id uuid;
  v_parent_id uuid;
  v_project_id uuid;
  v_source_id uuid;
  v_texto text;
  v_autor text;
  v_title text;
  v_estimativa numeric;
  v_status text;
  v_is_goal boolean;
  v_assimetria jsonb;
  v_origem uuid;
  v_destino uuid;
  v_tipo text;
  v_peso numeric;
  v_nota text;
begin
  -- ── gate: o MESMO segredo de `lifeboard_load`, mesma disciplina de erro ────
  select valor into v_expected from private.lifeboard_config where chave = 'load_secret';
  if v_expected is null then
    raise exception
      'lifeboard_mutate: segredo nao configurado — inserir a chave load_secret em private.lifeboard_config (ver DEPLOY.md)'
      using errcode = 'config_file_error';
  end if;
  if p_secret is null or p_secret <> v_expected then
    raise exception 'lifeboard_mutate: acesso negado' using errcode = 'insufficient_privilege';
  end if;

  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'payload precisa ser um objeto JSON.' using errcode = 'check_violation';
  end if;

  -- ═══════════════════════════════════════════════════════════ nota_add ════
  if p_op = 'nota_add' then
    v_id := nullif(p_payload->>'task_id', '')::uuid;
    perform private.lifeboard_exige_tarefa(v_id, v_owner, 'task_id');
    v_texto := p_payload->>'texto';
    if v_texto is null or length(btrim(v_texto)) = 0 then
      raise exception 'O texto da nota não pode ficar vazio.' using errcode = 'check_violation';
    end if;
    v_autor := nullif(p_payload->>'autor', '');

    insert into public.task_notes (task_id, texto, autor, owner)
    values (v_id, v_texto, v_autor, v_owner)
    returning id into v_id;

    return jsonb_build_object('ok', true, 'id', v_id);

  -- ═══════════════════════════════════════════════════════════ nota_del ════
  elsif p_op = 'nota_del' then
    v_id := nullif(p_payload->>'id', '')::uuid;
    if v_id is null then
      raise exception 'id da nota é obrigatório.' using errcode = 'check_violation';
    end if;
    delete from public.task_notes where id = v_id and owner = v_owner;
    if not found then
      raise exception 'Nota não encontrada (ou não é sua): %', v_id using errcode = 'check_violation';
    end if;
    return jsonb_build_object('ok', true);

  -- ═════════════════════════════════════════════════════ subtarefa_add ═════
  elsif p_op = 'subtarefa_add' then
    v_parent_id := nullif(p_payload->>'parent_id', '')::uuid;
    perform private.lifeboard_exige_tarefa(v_parent_id, v_owner, 'parent_id');
    v_title := p_payload->>'title';
    if v_title is null or length(btrim(v_title)) = 0 then
      raise exception 'O título da subtarefa não pode ficar vazio.' using errcode = 'check_violation';
    end if;
    v_estimativa := nullif(p_payload->>'estimativa_dias', '')::numeric;
    if v_estimativa is not null and v_estimativa <= 0 then
      raise exception 'A duração (estimativa em dias) precisa ser maior que zero.' using errcode = 'check_violation';
    end if;

    select project_id into v_project_id from public.tasks where id = v_parent_id;
    v_source_id := private.lifeboard_fonte_manual(v_owner);

    insert into public.tasks (
      project_id, title, status, source_id, external_ref, owner, parent_id, estimativa_dias
    ) values (
      v_project_id, v_title, 'open', v_source_id, 'manual:' || gen_random_uuid()::text,
      v_owner, v_parent_id, v_estimativa
    )
    returning id into v_id;

    return jsonb_build_object('ok', true, 'id', v_id);

  -- ═══════════════════════════════════════════════════════════ parent_set ══
  elsif p_op = 'parent_set' then
    v_id := nullif(p_payload->>'task_id', '')::uuid;
    perform private.lifeboard_exige_tarefa(v_id, v_owner, 'task_id');
    if not (p_payload ? 'parent_id') then
      raise exception 'parent_id é obrigatório (uuid, ou null para "nenhuma").' using errcode = 'check_violation';
    end if;
    v_parent_id := nullif(p_payload->>'parent_id', '')::uuid;
    if v_parent_id is not null then
      perform private.lifeboard_exige_tarefa(v_parent_id, v_owner, 'parent_id');
    end if;

    begin
      update public.tasks set parent_id = v_parent_id where id = v_id and owner = v_owner;
    exception
      when check_violation then
        raise exception 'Isso criaria um ciclo de hierarquia: a tarefa viraria mãe de si mesma.'
          using errcode = 'check_violation';
    end;
    return jsonb_build_object('ok', true);

  -- ═════════════════════════════════════════════════════════════ goal_set ══
  elsif p_op = 'goal_set' then
    v_id := nullif(p_payload->>'task_id', '')::uuid;
    perform private.lifeboard_exige_tarefa(v_id, v_owner, 'task_id');
    if not (p_payload ? 'is_goal') or jsonb_typeof(p_payload->'is_goal') <> 'boolean' then
      raise exception 'is_goal precisa ser verdadeiro ou falso.' using errcode = 'check_violation';
    end if;
    v_is_goal := (p_payload->>'is_goal')::boolean;

    update public.tasks set is_goal = v_is_goal where id = v_id and owner = v_owner;
    return jsonb_build_object('ok', true);

  -- ══════════════════════════════════════════════════════════ atomos_set ═══
  elsif p_op = 'atomos_set' then
    v_id := nullif(p_payload->>'task_id', '')::uuid;
    perform private.lifeboard_exige_tarefa(v_id, v_owner, 'task_id');
    if not (p_payload ? 'assimetria') then
      raise exception 'assimetria é obrigatória (objeto, ou null para limpar).' using errcode = 'check_violation';
    end if;
    v_assimetria := p_payload->'assimetria';
    if jsonb_typeof(v_assimetria) = 'null' then
      v_assimetria := null;
    elsif jsonb_typeof(v_assimetria) <> 'object' then
      raise exception 'assimetria precisa ser um objeto {opcionalidade, esforco, custo}.'
        using errcode = 'check_violation';
    end if;

    begin
      update public.tasks set assimetria = v_assimetria where id = v_id and owner = v_owner;
    exception
      when check_violation then
        raise exception
          'Átomos inválidos: opcionalidade precisa estar entre 1 e 3; esforço e custo precisam ser 1, 2, 3 ou 5.'
          using errcode = 'check_violation';
    end;
    return jsonb_build_object('ok', true);

  -- ═════════════════════════════════════════════════════ estimativa_set ════
  elsif p_op = 'estimativa_set' then
    v_id := nullif(p_payload->>'task_id', '')::uuid;
    perform private.lifeboard_exige_tarefa(v_id, v_owner, 'task_id');
    if not (p_payload ? 'estimativa_dias') then
      raise exception 'estimativa_dias é obrigatória (número > 0, ou null para limpar).'
        using errcode = 'check_violation';
    end if;
    v_estimativa := nullif(p_payload->>'estimativa_dias', '')::numeric;

    begin
      update public.tasks set estimativa_dias = v_estimativa where id = v_id and owner = v_owner;
    exception
      when check_violation then
        raise exception 'A duração (estimativa em dias) precisa ser maior que zero.'
          using errcode = 'check_violation';
    end;
    return jsonb_build_object('ok', true);

  -- ══════════════════════════════════════════════════════════ status_set ═══
  elsif p_op = 'status_set' then
    v_id := nullif(p_payload->>'task_id', '')::uuid;
    perform private.lifeboard_exige_tarefa(v_id, v_owner, 'task_id');
    v_status := p_payload->>'status';
    if v_status is null or v_status not in ('open', 'in_progress', 'blocked', 'done') then
      raise exception 'status precisa ser um de: open, in_progress, blocked, done.'
        using errcode = 'check_violation';
    end if;

    update public.tasks set status = v_status where id = v_id and owner = v_owner;
    return jsonb_build_object('ok', true);

  -- ══════════════════════════════════════════════════════════ aresta_add ═══
  elsif p_op = 'aresta_add' then
    v_origem := nullif(p_payload->>'origem', '')::uuid;
    v_destino := nullif(p_payload->>'destino', '')::uuid;
    perform private.lifeboard_exige_tarefa(v_origem, v_owner, 'origem');
    perform private.lifeboard_exige_tarefa(v_destino, v_owner, 'destino');
    if v_origem = v_destino then
      raise exception 'origem e destino não podem ser a mesma tarefa.' using errcode = 'check_violation';
    end if;
    v_tipo := p_payload->>'tipo';
    if v_tipo is null or v_tipo not in ('predecessor', 'correlacao', 'sinergia', 'obsolescencia') then
      raise exception 'tipo precisa ser um de: predecessor, correlacao, sinergia, obsolescencia.'
        using errcode = 'check_violation';
    end if;
    v_peso := coalesce(nullif(p_payload->>'peso', '')::numeric, 1);
    if v_peso < 0 or v_peso > 1 then
      raise exception 'peso precisa estar entre 0 e 1.' using errcode = 'check_violation';
    end if;
    v_nota := nullif(p_payload->>'nota', '');

    begin
      insert into public.task_edges (origem, destino, tipo, peso, nota, owner)
      values (v_origem, v_destino, v_tipo, v_peso, v_nota, v_owner)
      returning id into v_id;
    exception
      when unique_violation then
        raise exception 'Já existe uma aresta desse tipo entre essas duas tarefas.'
          using errcode = 'check_violation';
      when check_violation then
        raise exception 'Essa aresta criaria um ciclo de dependências (predecessor circular).'
          using errcode = 'check_violation';
    end;
    return jsonb_build_object('ok', true, 'id', v_id);

  -- ══════════════════════════════════════════════════════════ aresta_del ═══
  elsif p_op = 'aresta_del' then
    v_id := nullif(p_payload->>'id', '')::uuid;
    if v_id is null then
      raise exception 'id da aresta é obrigatório.' using errcode = 'check_violation';
    end if;
    delete from public.task_edges where id = v_id and owner = v_owner;
    if not found then
      raise exception 'Aresta não encontrada (ou não é sua): %', v_id using errcode = 'check_violation';
    end if;
    return jsonb_build_object('ok', true);

  else
    raise exception 'Operação desconhecida: %', coalesce(p_op, '<nula>') using errcode = 'check_violation';
  end if;
end;
$$;

revoke all on function public.lifeboard_mutate(text, text, jsonb) from public;
grant execute on function public.lifeboard_mutate(text, text, jsonb) to anon, authenticated;
