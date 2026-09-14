-- =============================================================================
-- OS-LIFEBOARD · Migration 0008 — v3: ajustes de segurança/robustez em
-- `lifeboard_mutate` (P6), pós-reprovação do crítico hostil de 13/09/2026.
-- =============================================================================
-- Não mexe em nada do P7 (`0007_lifeboard_v3_fila_prompts.sql`) — outra peça,
-- construída em paralelo, mesmo segredo. Tudo ADITIVO onde possível
-- (CHECKs novos, funções recriadas via CREATE OR REPLACE); nenhuma linha
-- existente se apaga.
--
-- Achados corrigidos (numeração do relatório do crítico):
--   #2  (ALTO)  erro cru do Postgres, em inglês, ecoando o valor do atacante
--       ("invalid input syntax for type uuid: …") — todo cast de p_payload
--       (`::uuid`/`::numeric`/`::boolean`) passa a rodar dentro de um
--       `begin … exception … end` que traduz para português SEM ecoar o valor.
--   #3  (ALTO)  duração sem teto superior — `estimativa_dias` é numeric(6,2);
--       acima de 9999.99 vira "numeric field overflow" cru. Checado em
--       português ANTES do insert/update, nos dois branches que gravam duração.
--   #5  (ALTO)  sem teto de tamanho — `assimetria` aceitava 2 MB de chaves
--       extras; `task_notes.texto`/`task_edges.nota` sem limite. CHECKs novos
--       + `atomos_set` passa a gravar só as 3 chaves conhecidas (descarta o
--       resto, nunca ecoa erro sobre elas).
--   #14 (MÉDIO) mensagem cita nome de coluna do banco ("task_id", "parent_id",
--       "origem"/"destino") — rótulos humanizados nas chamadas de
--       `lifeboard_exige_tarefa` (e a própria função ganha concordância de
--       gênero, já que todo rótulo agora é "a tarefa …"); branch de segredo
--       ausente vira uma frase que diz o que fazer, sem detalhe técnico.
--   #16 (BAIXO) `search_path` de `lifeboard_mutate`/`lifeboard_load` incluía
--       `public` à toa (os corpos já qualificam `public.` em tudo) — reduzido
--       a `private, pg_temp`.
--   #17 (BAIXO) `opcionalidade` aceitava fração (`between 1 and 3`) — CHECK
--       muda para `in (1,2,3)`, mesma régua do `atomosDeclaradosValidos` (TS).
--   #18 (BAIXO) mensagem de ciclo de hierarquia dizia "mãe de si mesma", que
--       é o caso de 1 nível só — corrigido para "ancestral de si mesma"
--       (cobre A→B→A e cadeias mais longas).
-- =============================================================================

-- ── 1 · CHECKs novos: domínio de opcionalidade (inteiro) e tetos de tamanho ──
alter table public.tasks drop constraint if exists tasks_assimetria_dominio;
alter table public.tasks
  add constraint tasks_assimetria_dominio check (
    assimetria is null or (
      jsonb_typeof(assimetria) = 'object'
      and jsonb_typeof(assimetria->'opcionalidade') = 'number'
      and jsonb_typeof(assimetria->'esforco') = 'number'
      and jsonb_typeof(assimetria->'custo') = 'number'
      and (assimetria->>'opcionalidade')::numeric in (1, 2, 3)
      and (assimetria->>'esforco')::numeric in (1, 2, 3, 5)
      and (assimetria->>'custo')::numeric in (1, 2, 3, 5)
    )
  );

comment on constraint tasks_assimetria_dominio on public.tasks is
  'opcionalidade agora é INTEIRO 1|2|3 (era between 1 and 3, aceitava 1.5) — mesma régua de atomosDeclaradosValidos (tipos-v3.ts). Achado #17, 13/09.';

alter table public.tasks drop constraint if exists tasks_assimetria_tamanho;
alter table public.tasks
  add constraint tasks_assimetria_tamanho check (assimetria is null or pg_column_size(assimetria) < 2048);

comment on constraint tasks_assimetria_tamanho on public.tasks is
  'Teto de bytes do JSON — sem isto, um payload com chaves extras gigantes (achado #5, 13/09) gravava 2 MB num objeto de 3 números.';

alter table public.task_notes drop constraint if exists task_notes_texto_tamanho;
alter table public.task_notes
  add constraint task_notes_texto_tamanho check (length(texto) <= 10000);

alter table public.task_edges drop constraint if exists task_edges_nota_tamanho;
alter table public.task_edges
  add constraint task_edges_nota_tamanho check (nota is null or length(nota) <= 2000);

-- ── 2 · guarda de posse — rótulos humanizados, sem ecoar o id ────────────────
create or replace function private.lifeboard_exige_tarefa(p_id uuid, p_owner uuid, p_rotulo text)
returns void
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if p_id is null then
    raise exception '% é obrigatória.', p_rotulo using errcode = 'check_violation';
  end if;
  if not exists (select 1 from public.tasks where id = p_id and owner = p_owner) then
    raise exception '% não existe (ou não é sua).', p_rotulo using errcode = 'check_violation';
  end if;
end;
$$;

comment on function private.lifeboard_exige_tarefa(uuid, uuid, text) is
  'Achado #14 (13/09): rótulo passa a ser sempre "a tarefa …" (concordância feminina) e a mensagem não ecoa mais o uuid recebido.';

-- ── 3 · a RPC de escrita, com os 5 ajustes acima ─────────────────────────────
create or replace function public.lifeboard_mutate(p_secret text, p_op text, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = private, pg_temp
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
    -- Achado #14: nada de detalhe técnico na mensagem — quem decide o que
    -- logar server-side é `mutateLifeboard` (live-client.ts), que já captura
    -- o corpo inteiro da resposta antes de mostrar só esta frase ao operador.
    raise exception 'O painel não está configurado — avise o Lucas.' using errcode = 'config_file_error';
  end if;
  if p_secret is null or p_secret <> v_expected then
    raise exception 'lifeboard_mutate: acesso negado' using errcode = 'insufficient_privilege';
  end if;

  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'payload precisa ser um objeto JSON.' using errcode = 'check_violation';
  end if;

  -- ═══════════════════════════════════════════════════════════ nota_add ════
  if p_op = 'nota_add' then
    begin
      v_id := nullif(p_payload->>'task_id', '')::uuid;
    exception
      when invalid_text_representation then
        raise exception 'A tarefa indicada não é um identificador válido.' using errcode = 'check_violation';
    end;
    perform private.lifeboard_exige_tarefa(v_id, v_owner, 'A tarefa');
    v_texto := p_payload->>'texto';
    if v_texto is null or length(btrim(v_texto)) = 0 then
      raise exception 'O texto da nota não pode ficar vazio.' using errcode = 'check_violation';
    end if;
    if length(v_texto) > 10000 then
      raise exception 'A nota não pode passar de 10000 caracteres.' using errcode = 'check_violation';
    end if;
    v_autor := nullif(p_payload->>'autor', '');

    insert into public.task_notes (task_id, texto, autor, owner)
    values (v_id, v_texto, v_autor, v_owner)
    returning id into v_id;

    return jsonb_build_object('ok', true, 'id', v_id);

  -- ═══════════════════════════════════════════════════════════ nota_del ════
  elsif p_op = 'nota_del' then
    begin
      v_id := nullif(p_payload->>'id', '')::uuid;
    exception
      when invalid_text_representation then
        raise exception 'O identificador da nota não é válido.' using errcode = 'check_violation';
    end;
    if v_id is null then
      raise exception 'id da nota é obrigatório.' using errcode = 'check_violation';
    end if;
    delete from public.task_notes where id = v_id and owner = v_owner;
    if not found then
      raise exception 'Nota não encontrada (ou não é sua).' using errcode = 'check_violation';
    end if;
    return jsonb_build_object('ok', true);

  -- ═════════════════════════════════════════════════════ subtarefa_add ═════
  elsif p_op = 'subtarefa_add' then
    begin
      v_parent_id := nullif(p_payload->>'parent_id', '')::uuid;
    exception
      when invalid_text_representation then
        raise exception 'A tarefa mãe indicada não é um identificador válido.' using errcode = 'check_violation';
    end;
    perform private.lifeboard_exige_tarefa(v_parent_id, v_owner, 'A tarefa mãe');
    v_title := p_payload->>'title';
    if v_title is null or length(btrim(v_title)) = 0 then
      raise exception 'O título da subtarefa não pode ficar vazio.' using errcode = 'check_violation';
    end if;
    begin
      v_estimativa := nullif(p_payload->>'estimativa_dias', '')::numeric;
    exception
      when invalid_text_representation or numeric_value_out_of_range then
        raise exception 'A duração (estimativa em dias) precisa ser um número válido.' using errcode = 'check_violation';
    end;
    if v_estimativa is not null and v_estimativa <= 0 then
      raise exception 'A duração (estimativa em dias) precisa ser maior que zero.' using errcode = 'check_violation';
    end if;
    if v_estimativa is not null and v_estimativa > 9999.99 then
      raise exception 'A duração não pode passar de 9999.99 dias.' using errcode = 'check_violation';
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
    begin
      v_id := nullif(p_payload->>'task_id', '')::uuid;
    exception
      when invalid_text_representation then
        raise exception 'A tarefa indicada não é um identificador válido.' using errcode = 'check_violation';
    end;
    perform private.lifeboard_exige_tarefa(v_id, v_owner, 'A tarefa');
    if not (p_payload ? 'parent_id') then
      raise exception 'A tarefa mãe é obrigatória (ou deixe em branco para "nenhuma").' using errcode = 'check_violation';
    end if;
    begin
      v_parent_id := nullif(p_payload->>'parent_id', '')::uuid;
    exception
      when invalid_text_representation then
        raise exception 'A tarefa mãe indicada não é um identificador válido.' using errcode = 'check_violation';
    end;
    if v_parent_id is not null then
      perform private.lifeboard_exige_tarefa(v_parent_id, v_owner, 'A tarefa mãe');
    end if;

    begin
      update public.tasks set parent_id = v_parent_id where id = v_id and owner = v_owner;
    exception
      when check_violation then
        raise exception 'Isso criaria um ciclo de hierarquia: a tarefa viraria ancestral de si mesma.'
          using errcode = 'check_violation';
    end;
    return jsonb_build_object('ok', true);

  -- ═════════════════════════════════════════════════════════════ goal_set ══
  elsif p_op = 'goal_set' then
    begin
      v_id := nullif(p_payload->>'task_id', '')::uuid;
    exception
      when invalid_text_representation then
        raise exception 'A tarefa indicada não é um identificador válido.' using errcode = 'check_violation';
    end;
    perform private.lifeboard_exige_tarefa(v_id, v_owner, 'A tarefa');
    if not (p_payload ? 'is_goal') or jsonb_typeof(p_payload->'is_goal') <> 'boolean' then
      raise exception 'A meta precisa ser verdadeira ou falsa.' using errcode = 'check_violation';
    end if;
    begin
      v_is_goal := (p_payload->>'is_goal')::boolean;
    exception
      when invalid_text_representation then
        raise exception 'A meta precisa ser verdadeira ou falsa.' using errcode = 'check_violation';
    end;

    update public.tasks set is_goal = v_is_goal where id = v_id and owner = v_owner;
    return jsonb_build_object('ok', true);

  -- ══════════════════════════════════════════════════════════ atomos_set ═══
  elsif p_op = 'atomos_set' then
    begin
      v_id := nullif(p_payload->>'task_id', '')::uuid;
    exception
      when invalid_text_representation then
        raise exception 'A tarefa indicada não é um identificador válido.' using errcode = 'check_violation';
    end;
    perform private.lifeboard_exige_tarefa(v_id, v_owner, 'A tarefa');
    if not (p_payload ? 'assimetria') then
      raise exception 'assimetria é obrigatória (objeto, ou null para limpar).' using errcode = 'check_violation';
    end if;
    v_assimetria := p_payload->'assimetria';
    if jsonb_typeof(v_assimetria) = 'null' then
      v_assimetria := null;
    elsif jsonb_typeof(v_assimetria) <> 'object' then
      raise exception 'assimetria precisa ser um objeto {opcionalidade, esforco, custo}.'
        using errcode = 'check_violation';
    else
      -- Achado #5 (13/09): descarta qualquer chave que não seja uma destas
      -- 3 ANTES de gravar — é o que impede um payload com chaves extras
      -- gigantes de chegar perto do teto de tamanho (CHECK acima é o
      -- backstop; isto é a defesa de verdade).
      v_assimetria := jsonb_build_object(
        'opcionalidade', v_assimetria->'opcionalidade',
        'esforco', v_assimetria->'esforco',
        'custo', v_assimetria->'custo'
      );
    end if;

    begin
      update public.tasks set assimetria = v_assimetria where id = v_id and owner = v_owner;
    exception
      when check_violation or invalid_text_representation or numeric_value_out_of_range or datatype_mismatch then
        raise exception
          'Átomos inválidos: opcionalidade precisa ser 1, 2 ou 3; esforço e custo precisam ser 1, 2, 3 ou 5.'
          using errcode = 'check_violation';
    end;
    return jsonb_build_object('ok', true);

  -- ═════════════════════════════════════════════════════ estimativa_set ════
  elsif p_op = 'estimativa_set' then
    begin
      v_id := nullif(p_payload->>'task_id', '')::uuid;
    exception
      when invalid_text_representation then
        raise exception 'A tarefa indicada não é um identificador válido.' using errcode = 'check_violation';
    end;
    perform private.lifeboard_exige_tarefa(v_id, v_owner, 'A tarefa');
    if not (p_payload ? 'estimativa_dias') then
      raise exception 'estimativa_dias é obrigatória (número > 0, ou null para limpar).'
        using errcode = 'check_violation';
    end if;
    begin
      v_estimativa := nullif(p_payload->>'estimativa_dias', '')::numeric;
    exception
      when invalid_text_representation or numeric_value_out_of_range then
        raise exception 'A duração (estimativa em dias) precisa ser um número válido.' using errcode = 'check_violation';
    end;
    if v_estimativa is not null and v_estimativa > 9999.99 then
      raise exception 'A duração não pode passar de 9999.99 dias.' using errcode = 'check_violation';
    end if;

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
    begin
      v_id := nullif(p_payload->>'task_id', '')::uuid;
    exception
      when invalid_text_representation then
        raise exception 'A tarefa indicada não é um identificador válido.' using errcode = 'check_violation';
    end;
    perform private.lifeboard_exige_tarefa(v_id, v_owner, 'A tarefa');
    v_status := p_payload->>'status';
    if v_status is null or v_status not in ('open', 'in_progress', 'blocked', 'done') then
      raise exception 'status precisa ser um de: open, in_progress, blocked, done.'
        using errcode = 'check_violation';
    end if;

    update public.tasks set status = v_status where id = v_id and owner = v_owner;
    return jsonb_build_object('ok', true);

  -- ══════════════════════════════════════════════════════════ aresta_add ═══
  elsif p_op = 'aresta_add' then
    begin
      v_origem := nullif(p_payload->>'origem', '')::uuid;
    exception
      when invalid_text_representation then
        raise exception 'A tarefa de origem indicada não é um identificador válido.' using errcode = 'check_violation';
    end;
    begin
      v_destino := nullif(p_payload->>'destino', '')::uuid;
    exception
      when invalid_text_representation then
        raise exception 'A tarefa de destino indicada não é um identificador válido.' using errcode = 'check_violation';
    end;
    perform private.lifeboard_exige_tarefa(v_origem, v_owner, 'A tarefa de origem');
    perform private.lifeboard_exige_tarefa(v_destino, v_owner, 'A tarefa de destino');
    if v_origem = v_destino then
      raise exception 'A tarefa de origem e a tarefa de destino não podem ser a mesma.' using errcode = 'check_violation';
    end if;
    v_tipo := p_payload->>'tipo';
    if v_tipo is null or v_tipo not in ('predecessor', 'correlacao', 'sinergia', 'obsolescencia') then
      raise exception 'O tipo de relação precisa ser um de: predecessor, correlacao, sinergia, obsolescencia.'
        using errcode = 'check_violation';
    end if;
    begin
      v_peso := coalesce(nullif(p_payload->>'peso', '')::numeric, 1);
    exception
      when invalid_text_representation or numeric_value_out_of_range then
        raise exception 'O desconto precisa ser um número válido entre 0 e 1.' using errcode = 'check_violation';
    end;
    if v_peso < 0 or v_peso > 1 then
      raise exception 'O desconto precisa estar entre 0 e 1.' using errcode = 'check_violation';
    end if;
    v_nota := nullif(p_payload->>'nota', '');
    if v_nota is not null and length(v_nota) > 2000 then
      raise exception 'A nota da relação não pode passar de 2000 caracteres.' using errcode = 'check_violation';
    end if;

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
    begin
      v_id := nullif(p_payload->>'id', '')::uuid;
    exception
      when invalid_text_representation then
        raise exception 'O identificador da aresta não é válido.' using errcode = 'check_violation';
    end;
    if v_id is null then
      raise exception 'id da aresta é obrigatório.' using errcode = 'check_violation';
    end if;
    delete from public.task_edges where id = v_id and owner = v_owner;
    if not found then
      raise exception 'Aresta não encontrada (ou não é sua).' using errcode = 'check_violation';
    end if;
    return jsonb_build_object('ok', true);

  else
    raise exception 'Operação desconhecida: %', coalesce(p_op, '<nula>') using errcode = 'check_violation';
  end if;
end;
$$;

revoke all on function public.lifeboard_mutate(text, text, jsonb) from public;
grant execute on function public.lifeboard_mutate(text, text, jsonb) to anon, authenticated;

-- ── 4 · lifeboard_load: MESMO corpo da 0005, só o search_path muda (achado #16) ──
create or replace function public.lifeboard_load(p_secret text)
returns jsonb
language plpgsql
security definer
set search_path = private, pg_temp
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
