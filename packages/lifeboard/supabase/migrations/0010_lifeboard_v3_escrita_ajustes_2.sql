-- =============================================================================
-- OS-LIFEBOARD · Migration 0010 — v3: rodada 2 do crítico hostil sobre
-- `lifeboard_mutate` (P6). Sobre 0008 (mesmo dono, mesma função) — 0009 é de
-- outro agente (P7, fila de prompts) e não é tocada aqui. Tudo ADITIVO:
-- CHECKs novos/apertados + `create or replace function`, nenhuma linha some.
-- =============================================================================
-- Achados corrigidos (numeração do relatório do crítico, rodada 2):
--   #2  (ALTO)  `tasks.title` e `task_notes.autor` sem teto de tamanho —
--       um título de 3 MB e um autor de 1 MB eram aceitos ponta a ponta (TS
--       e banco). CHECKs novos (`length(title) <= 500`,
--       `autor is null or length(autor) <= 120`) + `subtarefa_add`/`nota_add`
--       validam em português ANTES do insert (mesma disciplina do resto da
--       função: nunca reimplementar sozinho, sempre checar antes de gastar a
--       chamada). Constantes espelhadas em `src/core/prioritize/tipos-v3.ts`
--       (`TITULO_MAXIMO`, `AUTOR_MAXIMO`) — importadas por
--       `src/app/tarefa/actions.ts`; o SQL não importa TS, então o número
--       500/120 é o contrato, repetido aqui com referência ao arquivo TS.
--   #6  (MÉDIO/BAIXO) `p_op` desconhecido era ecoado por inteiro na mensagem
--       (`raise exception 'Operação desconhecida: %', p_op`) — um payload
--       com `p_op` de 4051 caracteres chegava inteiro na tela porque o
--       `errcode` (`check_violation`/23514) é um dos que `live-client.ts`
--       deixa passar. Mensagem fixa agora; o valor recebido só vai para
--       `raise log` (log do servidor Postgres, nunca para o cliente).
--  #10  (BAIXO) duas réguas de duração mínima: `subtarefa_add` só exigia
--       `> 0` (aceitava 0,1); `estimativa_set`, via o CHECK da coluna
--       (`tasks_estimativa_dias_check`, migration 0004), também só exigia
--       `> 0` — nenhuma das duas portas aplicava os 0,25 dias que o app (TS)
--       já pedia num dos dois casos. O CHECK da coluna aperta para
--       `>= 0.25`; `subtarefa_add` ganha a mesma validação em português
--       ANTES do insert (assim como já fazia `estimativa_set`, que herda o
--       CHECK apertado automaticamente). Mesmo valor de
--       `DURACAO_MINIMA_DIAS` (tipos-v3.ts).
-- =============================================================================

-- ── 1 · CHECKs novos/apertados: title, autor e o piso de estimativa_dias ────
alter table public.tasks drop constraint if exists tasks_titulo_tamanho;
alter table public.tasks
  add constraint tasks_titulo_tamanho check (length(title) <= 500);

comment on constraint tasks_titulo_tamanho on public.tasks is
  'Achado ALTO #2 (rodada 2, 13/09): sem teto, um título de 3 MB era aceito. Mesmo TITULO_MAXIMO de tipos-v3.ts.';

alter table public.task_notes drop constraint if exists task_notes_autor_tamanho;
alter table public.task_notes
  add constraint task_notes_autor_tamanho check (autor is null or length(autor) <= 120);

comment on constraint task_notes_autor_tamanho on public.task_notes is
  'Achado ALTO #2 (rodada 2, 13/09): sem teto, um autor de 1 MB era aceito. Mesmo AUTOR_MAXIMO de tipos-v3.ts.';

-- Aperta o piso de 0 para 0,25 dia — nome do constraint confirmado ao vivo
-- (`tasks_estimativa_dias_check`, criado inline pela migration 0004).
alter table public.tasks drop constraint if exists tasks_estimativa_dias_check;
alter table public.tasks
  add constraint tasks_estimativa_dias_check
    check (estimativa_dias is null or estimativa_dias >= 0.25);

comment on constraint tasks_estimativa_dias_check on public.tasks is
  'Achado BAIXO #10 (rodada 2, 13/09): piso subiu de "> 0" para ">= 0.25" — mesma DURACAO_MINIMA_DIAS de tipos-v3.ts, uma só régua para subtarefa_add e estimativa_set.';

-- ── 2 · `lifeboard_mutate`: os 3 ajustes acima, corpo herdado de 0008 ───────
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
    -- [ALTO #2, rodada 2] mesmo teto de `task_notes_autor_tamanho` acima —
    -- pego aqui em português, antes de gastar a chamada de rede/insert.
    if v_autor is not null and length(v_autor) > 120 then
      raise exception 'O nome do autor não pode passar de 120 caracteres.' using errcode = 'check_violation';
    end if;

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
    -- [ALTO #2, rodada 2] mesmo teto de `tasks_titulo_tamanho` acima.
    if length(v_title) > 500 then
      raise exception 'O título não pode passar de 500 caracteres.' using errcode = 'check_violation';
    end if;
    begin
      v_estimativa := nullif(p_payload->>'estimativa_dias', '')::numeric;
    exception
      when invalid_text_representation or numeric_value_out_of_range then
        raise exception 'A duração (estimativa em dias) precisa ser um número válido.' using errcode = 'check_violation';
    end;
    -- [BAIXO #10, rodada 2] piso subiu de "> 0" para ">= 0.25" — mesma régua
    -- que `tasks_estimativa_dias_check` agora exige (uma só lei, checada
    -- aqui em português ANTES do insert, e de novo pelo CHECK como backstop).
    if v_estimativa is not null and v_estimativa < 0.25 then
      raise exception 'A duração (estimativa em dias) precisa ser um número de pelo menos 0,25 dia.' using errcode = 'check_violation';
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
    -- [BAIXO #10, rodada 2] mesma régua de `subtarefa_add` acima — checada
    -- aqui também (não só pelo CHECK) para dar a mensagem em português.
    if v_estimativa is not null and v_estimativa < 0.25 then
      raise exception 'A duração (estimativa em dias) precisa ser um número de pelo menos 0,25 dia.' using errcode = 'check_violation';
    end if;
    if v_estimativa is not null and v_estimativa > 9999.99 then
      raise exception 'A duração não pode passar de 9999.99 dias.' using errcode = 'check_violation';
    end if;

    begin
      update public.tasks set estimativa_dias = v_estimativa where id = v_id and owner = v_owner;
    exception
      when check_violation then
        raise exception 'A duração (estimativa em dias) precisa ser de pelo menos 0,25 dia.'
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
    -- [MÉDIO/BAIXO #6, rodada 2] antes, `p_op` era ecoado por inteiro na
    -- mensagem — um payload com `p_op` de 4051 caracteres chegava inteiro na
    -- tela (o `errcode` é `check_violation`/23514, um dos que `live-client.ts`
    -- deixa atravessar). Mensagem fixa agora; o valor recebido só vai para
    -- `raise log` (log do servidor Postgres — nunca alcança o PostgREST nem o cliente).
    raise log 'lifeboard_mutate: p_op desconhecido recebido: %', coalesce(p_op, '<nulo>');
    raise exception 'Operação desconhecida.' using errcode = 'check_violation';
  end if;
end;
$$;

revoke all on function public.lifeboard_mutate(text, text, jsonb) from public;
grant execute on function public.lifeboard_mutate(text, text, jsonb) to anon, authenticated;
