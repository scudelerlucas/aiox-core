-- =============================================================================
-- OS-LIFEBOARD · Migration 0007 — P7: fila PULL de prompts entre as 3 contas.
-- =============================================================================
-- Origem: `Lucas-Contexto-Geral/docs/ops/LIFEBOARD-V3-4z-atomos-e-gargalo-2026-09-13.md`
-- linhas R1, R2, R6, G1, G2, G6, transferências T1/T2, §8 item 6.
--
-- Pedido do operador: "poder promptar soluções pelo painel na conta que tem
-- mais tokens disponíveis para a complexidade da tarefa". O mapa !4z já
-- decidiu a arquitetura (não redesenhada aqui):
--   R1 — cota restante NÃO é mensurável (nenhuma API expõe). Roteia-se pelo
--        INVERSO medido: consumo do dia por conta (`painel_frentes_sessoes.
--        custo_usd` agrupado por `conta`) — proxy declarado, não a cota real.
--   R2 — um painel numa conta NÃO consegue abrir sessão em outra conta. Por
--        isso o modelo é PULL: esta tabela é a fila; a Routine diária de CADA
--        conta (já existe, ver docs/ops/PROMPT-ROUTINE-publicar-sessoes-
--        outras-contas-2026-09-12.md) chama `fila_prompts_pegar` e pega só o
--        que é dela. Latência = cadência da Routine, nunca push direto.
--   R6 — a fila vira acelerador de gasto sem freio: RECUSA no banco (trigger
--        BEFORE INSERT), nunca num hook (hooks não disparam em sessão remota —
--        achado 11/09, `docs/audit/ACHADO-hooks-nao-disparam-em-sessao-
--        remota-2026-09-11.md`).
--   G6 — cada item da fila grava `custo_usd` ao fechar, mesmo instrumento que
--        mede "vigilância custa mais que o trabalho" (regra
--        `check-in-automatico-de-pr`).
--
-- Tudo ADITIVO: nenhuma tabela/coluna existente muda; nada se apaga por este
-- arquivo. RLS de leitura reusa a MESMA allowlist de `painel_frentes_*`
-- (tabela `painel_frentes_leitores` + função `painel_frentes_leitor_
-- autorizado()`), aplicada uma vez no mesmo projeto Supabase pela migration
-- do hub (`Lucas-Contexto-Geral/supabase/migrations/
-- 20260912a_painel_frentes_tres_contas.sql`) — este arquivo NÃO a redefine,
-- só a consome (dependência declarada, não duplicada). Escrita: só pelas RPCs
-- SECURITY DEFINER abaixo, protegidas pelo MESMO segredo de `lifeboard_load`/
-- `lifeboard_mutate` (`private.lifeboard_config.chave = 'load_secret'`) — nada
-- de segredo novo, nada de tabela de config nova.
-- =============================================================================

-- ── 1 · painel_teto_diario — o teto que a fila recusa quando ultrapassado ────
create table if not exists public.painel_teto_diario (
  conta text primary key
    check (conta in ('lucasscudeler@gmail.com','lsgpandora@gmail.com','almapetra.ltda@gmail.com')),
  teto_usd numeric not null default 150 check (teto_usd > 0),
  atualizado_em timestamptz not null default now()
);
comment on table public.painel_teto_diario is
  'Teto diário de gasto por conta (regra da casa `teto-de-gasto-diario`, US$150/dia). A fila de prompts recusa item novo quando o consumo do dia da conta já bateu este valor.';

insert into public.painel_teto_diario (conta, teto_usd) values
  ('lucasscudeler@gmail.com', 150),
  ('lsgpandora@gmail.com', 150),
  ('almapetra.ltda@gmail.com', 150)
on conflict (conta) do nothing;

-- ── 2 · painel_fila_prompts — a fila PULL ────────────────────────────────────
create table if not exists public.painel_fila_prompts (
  id               uuid primary key default gen_random_uuid(),
  conta            text not null
    check (conta in ('lucasscudeler@gmail.com','lsgpandora@gmail.com','almapetra.ltda@gmail.com')),
  prompt           text not null check (length(btrim(prompt)) between 1 and 20000),
  complexidade     text not null check (complexidade in ('baixa','media','alta','maxima')),
  modelo_sugerido  text not null check (modelo_sugerido in ('Haiku','Sonnet','Opus','Fable')),
  estado           text not null default 'na_fila'
    check (estado in ('na_fila','pega','concluida','falhou','cancelada')),
  custo_usd        numeric(10,4),
  criado_em        timestamptz not null default now(),
  pego_em          timestamptz,
  concluido_em     timestamptz,
  sessao_url       text,
  resultado        text,
  criado_por       text,
  task_id          uuid references public.tasks(id) on delete set null
);
comment on table public.painel_fila_prompts is
  'Fila PULL de prompts para as 3 contas do Claude Code (R2/T2 do mapa !4z 13/09). O painel escreve aqui; a Routine diária de cada conta lê só o que é dela (fila_prompts_pegar) e fecha com o custo real (fila_prompts_fechar). Nunca um push direto entre contas.';

create index if not exists painel_fila_prompts_conta_estado_idx
  on public.painel_fila_prompts (conta, estado, criado_em);
create index if not exists painel_fila_prompts_estado_criado_idx
  on public.painel_fila_prompts (estado, criado_em desc);

-- ── 3 · painel_consumo_por_conta_dia — o proxy medido (T1) ───────────────────
-- Agrupa por `atualizado_em` (quando a sessão mexeu pela última vez), não por
-- `publicado_em` (a Routine reescreve `publicado_em = now()` em TODA sessão a
-- cada disparo diário — agrupar por ela faria o consumo de meses aparecer
-- inteiro "hoje" e recontar a cada corrida da Routine).
create or replace view public.painel_consumo_por_conta_dia as
select
  s.conta,
  date(coalesce(s.atualizado_em, s.criado_em, s.publicado_em)) as dia,
  sum(coalesce(s.custo_usd, 0)) as custo_usd,
  count(*) as sessoes
from public.painel_frentes_sessoes s
where s.conta is not null
group by 1, 2;
comment on view public.painel_consumo_por_conta_dia is
  'T1 do mapa !4z 13/09: "não sei quanto sobra" vira "sei quanto gastei hoje por conta". Proxy declarado (custo_usd de sessão inteira no dia da última atualização) — não é a cota real (que nenhuma API expõe).';

-- ── 4 · consumo de hoje (view + itens concluídos na fila) ────────────────────
-- SECURITY DEFINER: a view acima lê `painel_frentes_sessoes` (RLS por
-- allowlist) — sem isto, uma chamada de fora da allowlist (ex.: a RPC de
-- listar, chamada com o segredo mas sem sessão de leitor) veria 0 e o gate
-- de teto ficaria cego. Mesma disciplina de `lifeboard_load`.
create or replace function public.painel_fila_consumo_hoje(p_conta text)
returns numeric
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
declare
  v_view numeric;
  v_fila numeric;
begin
  select coalesce(sum(c.custo_usd), 0) into v_view
    from public.painel_consumo_por_conta_dia c
    where c.conta = p_conta and c.dia = current_date;

  select coalesce(sum(f.custo_usd), 0) into v_fila
    from public.painel_fila_prompts f
    where f.conta = p_conta
      and f.estado = 'concluida'
      and f.custo_usd is not null
      and date(f.concluido_em) = current_date;

  return coalesce(v_view, 0) + coalesce(v_fila, 0);
end;
$$;
comment on function public.painel_fila_consumo_hoje(text) is
  'Consumo do dia (proxy) de uma conta: soma de `painel_consumo_por_conta_dia` (sessões publicadas) + itens da fila fechados como concluída hoje (o custo de um prompt disparado pela fila só entra em painel_frentes_sessoes no PRÓXIMO ciclo da Routine — sem esta soma, o teto ficaria um dia atrasado).';

revoke all on function public.painel_fila_consumo_hoje(text) from public;
grant execute on function public.painel_fila_consumo_hoje(text) to anon, authenticated;

-- ── 5 · trigger de recusa — R6, enforcement no banco, nunca em hook ──────────
create or replace function public.painel_fila_prompts_checar_teto()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_teto numeric;
  v_gasto numeric;
begin
  select teto_usd into v_teto from public.painel_teto_diario where conta = new.conta;
  if v_teto is null then
    v_teto := 150; -- conta sem linha em painel_teto_diario (não deveria acontecer): teto da casa.
  end if;

  v_gasto := public.painel_fila_consumo_hoje(new.conta);

  if v_gasto >= v_teto then
    raise exception 'fila: conta % ja gastou US$ % hoje (teto US$ %)',
      new.conta, round(v_gasto, 2), round(v_teto, 2)
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;
comment on function public.painel_fila_prompts_checar_teto() is
  'R6 do mapa !4z 13/09: recusa INSERT quando o consumo do dia da conta >= teto. Enforcement no banco (não em hook — hooks não disparam em sessão remota, achado 11/09).';

drop trigger if exists trg_painel_fila_prompts_teto on public.painel_fila_prompts;
create trigger trg_painel_fila_prompts_teto
  before insert on public.painel_fila_prompts
  for each row execute function public.painel_fila_prompts_checar_teto();

-- ── 6 · RLS — mesma allowlist de leitura de painel_frentes_* ─────────────────
alter table public.painel_fila_prompts enable row level security;
alter table public.painel_teto_diario enable row level security;

drop policy if exists painel_fila_prompts_leitura on public.painel_fila_prompts;
create policy painel_fila_prompts_leitura on public.painel_fila_prompts
  for select to authenticated using (public.painel_frentes_leitor_autorizado());

drop policy if exists painel_teto_diario_leitura on public.painel_teto_diario;
create policy painel_teto_diario_leitura on public.painel_teto_diario
  for select to authenticated using (public.painel_frentes_leitor_autorizado());
-- Escrita: nenhuma policy de insert/update/delete para anon/authenticated —
-- só as RPCs SECURITY DEFINER abaixo (dono = quem aplicou a migration,
-- bypassa RLS por ser dono da tabela, mesma disciplina de lifeboard_mutate)
-- e service_role (Routines/Action, se algum dia precisarem gravar direto).

-- ── 7 · RPCs — o mesmo segredo de lifeboard_load/lifeboard_mutate ───────────

-- fila_prompts_enfileirar — cria o item; escolhe a conta quando não vem no
-- payload (menor consumo hoje entre as que não bateram o teto; empate →
-- lucasscudeler@gmail.com, a conta-sede do painel — DECISÃO onde o pedido do
-- operador era ambíguo: "esta conta" não tem sentido único porque o painel
-- não roda "dentro" de nenhuma das 3 contas).
create or replace function public.fila_prompts_enfileirar(p_secret text, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_expected      text;
  v_prompt        text;
  v_complexidade  text;
  v_modelo        text;
  v_conta         text;
  v_criado_por    text;
  v_task_id       uuid;
  v_id            uuid;
  v_melhor_conta  text;
  v_melhor_consumo numeric;
  v_motivo        text;
  rec             record;
begin
  select valor into v_expected from private.lifeboard_config where chave = 'load_secret';
  if v_expected is null then
    raise exception
      'fila_prompts_enfileirar: segredo nao configurado — inserir a chave load_secret em private.lifeboard_config (ver DEPLOY.md)'
      using errcode = 'config_file_error';
  end if;
  if p_secret is null or p_secret <> v_expected then
    raise exception 'fila_prompts_enfileirar: acesso negado' using errcode = 'insufficient_privilege';
  end if;

  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'payload precisa ser um objeto JSON.' using errcode = 'check_violation';
  end if;

  v_prompt := p_payload->>'prompt';
  if v_prompt is null or length(btrim(v_prompt)) = 0 then
    raise exception 'O prompt nao pode ficar vazio.' using errcode = 'check_violation';
  end if;
  if length(btrim(v_prompt)) > 20000 then
    raise exception 'O prompt passou de 20000 caracteres.' using errcode = 'check_violation';
  end if;

  v_complexidade := p_payload->>'complexidade';
  if v_complexidade is null or v_complexidade not in ('baixa','media','alta','maxima') then
    raise exception 'complexidade precisa ser uma de: baixa, media, alta, maxima.'
      using errcode = 'check_violation';
  end if;
  v_modelo := case v_complexidade
    when 'baixa' then 'Haiku'
    when 'media' then 'Sonnet'
    when 'alta' then 'Opus'
    when 'maxima' then 'Fable'
  end;

  v_criado_por := nullif(p_payload->>'criado_por', '');
  v_task_id := nullif(p_payload->>'task_id', '')::uuid;

  v_conta := nullif(p_payload->>'conta', '');
  if v_conta is not null
     and v_conta not in ('lucasscudeler@gmail.com','lsgpandora@gmail.com','almapetra.ltda@gmail.com')
  then
    raise exception 'conta precisa ser uma das 3 contas da casa.' using errcode = 'check_violation';
  end if;

  if v_conta is null then
    v_melhor_conta := null;
    v_melhor_consumo := null;
    -- lucasscudeler@gmail.com primeiro na ordem: em empate de consumo, o
    -- `<` estrito abaixo nunca substitui o primeiro candidato — desempate
    -- para ela (decisão declarada acima).
    for rec in
      select t.conta as conta, t.teto_usd as teto, public.painel_fila_consumo_hoje(t.conta) as consumo
      from public.painel_teto_diario t
      order by (case when t.conta = 'lucasscudeler@gmail.com' then 0 else 1 end), t.conta
    loop
      if rec.consumo >= rec.teto then
        continue;
      end if;
      if v_melhor_consumo is null or rec.consumo < v_melhor_consumo then
        v_melhor_consumo := rec.consumo;
        v_melhor_conta := rec.conta;
      end if;
    end loop;

    if v_melhor_conta is null then
      raise exception 'fila: as 3 contas ja bateram o teto diario hoje' using errcode = 'check_violation';
    end if;
    v_conta := v_melhor_conta;
    v_motivo := format('roteamento automatico: menor consumo hoje (US$ %s)', round(v_melhor_consumo, 2));
  else
    v_motivo := 'conta escolhida manualmente no formulario';
  end if;

  -- Pode levantar a exceção do trigger (R6) quando `v_conta` veio manual e já
  -- bateu o teto — propositalmente NÃO capturada aqui: quem chama recebe a
  -- mesma mensagem em português que o roteamento automático já respeitaria.
  insert into public.painel_fila_prompts (conta, prompt, complexidade, modelo_sugerido, criado_por, task_id)
  values (v_conta, btrim(v_prompt), v_complexidade, v_modelo, v_criado_por, v_task_id)
  returning id into v_id;

  return jsonb_build_object(
    'ok', true, 'id', v_id, 'conta', v_conta, 'modelo_sugerido', v_modelo, 'motivo', v_motivo
  );
end;
$$;

-- fila_prompts_pegar — a Routine de cada conta chama isto; pega o mais antigo
-- 'na_fila' DAQUELA conta, atomicamente (FOR UPDATE SKIP LOCKED).
create or replace function public.fila_prompts_pegar(p_secret text, p_conta text)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_expected text;
  v_row      public.painel_fila_prompts%rowtype;
begin
  select valor into v_expected from private.lifeboard_config where chave = 'load_secret';
  if v_expected is null then
    raise exception
      'fila_prompts_pegar: segredo nao configurado — inserir a chave load_secret em private.lifeboard_config (ver DEPLOY.md)'
      using errcode = 'config_file_error';
  end if;
  if p_secret is null or p_secret <> v_expected then
    raise exception 'fila_prompts_pegar: acesso negado' using errcode = 'insufficient_privilege';
  end if;
  if p_conta is null
     or p_conta not in ('lucasscudeler@gmail.com','lsgpandora@gmail.com','almapetra.ltda@gmail.com')
  then
    raise exception 'conta precisa ser uma das 3 contas da casa.' using errcode = 'check_violation';
  end if;

  select * into v_row
    from public.painel_fila_prompts
    where conta = p_conta and estado = 'na_fila'
    order by criado_em asc
    for update skip locked
    limit 1;

  if not found then
    return jsonb_build_object('ok', true, 'item', null);
  end if;

  update public.painel_fila_prompts
    set estado = 'pega', pego_em = now()
    where id = v_row.id;

  return jsonb_build_object('ok', true, 'item', jsonb_build_object(
    'id', v_row.id, 'conta', v_row.conta, 'prompt', v_row.prompt,
    'complexidade', v_row.complexidade, 'modeloSugerido', v_row.modelo_sugerido,
    'criadoEm', v_row.criado_em, 'taskId', v_row.task_id
  ));
end;
$$;

-- fila_prompts_fechar — a Routine chama isto ao terminar (sucesso ou falha),
-- com o custo real (do Stop hook / medição da própria sessão) e a URL dela.
create or replace function public.fila_prompts_fechar(
  p_secret text, p_id uuid, p_estado text, p_custo_usd numeric,
  p_sessao_url text, p_resultado text
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_expected text;
begin
  select valor into v_expected from private.lifeboard_config where chave = 'load_secret';
  if v_expected is null then
    raise exception
      'fila_prompts_fechar: segredo nao configurado — inserir a chave load_secret em private.lifeboard_config (ver DEPLOY.md)'
      using errcode = 'config_file_error';
  end if;
  if p_secret is null or p_secret <> v_expected then
    raise exception 'fila_prompts_fechar: acesso negado' using errcode = 'insufficient_privilege';
  end if;
  if p_id is null then
    raise exception 'id é obrigatório.' using errcode = 'check_violation';
  end if;
  if p_estado is null or p_estado not in ('concluida','falhou') then
    raise exception 'estado de fechamento precisa ser concluida ou falhou.' using errcode = 'check_violation';
  end if;

  update public.painel_fila_prompts
    set estado = p_estado,
        custo_usd = p_custo_usd,
        sessao_url = coalesce(p_sessao_url, sessao_url),
        resultado = coalesce(p_resultado, resultado),
        concluido_em = now()
    where id = p_id and estado = 'pega';

  if not found then
    raise exception 'Item nao encontrado ou nao esta em estado "pega": %', p_id
      using errcode = 'check_violation';
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

-- fila_prompts_cancelar — só cancela item ainda 'na_fila' (a UI mostra o
-- botão só nesse estado; a guarda aqui é a mesma régua, não confia só na UI).
create or replace function public.fila_prompts_cancelar(p_secret text, p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_expected text;
begin
  select valor into v_expected from private.lifeboard_config where chave = 'load_secret';
  if v_expected is null then
    raise exception
      'fila_prompts_cancelar: segredo nao configurado — inserir a chave load_secret em private.lifeboard_config (ver DEPLOY.md)'
      using errcode = 'config_file_error';
  end if;
  if p_secret is null or p_secret <> v_expected then
    raise exception 'fila_prompts_cancelar: acesso negado' using errcode = 'insufficient_privilege';
  end if;
  if p_id is null then
    raise exception 'id é obrigatório.' using errcode = 'check_violation';
  end if;

  update public.painel_fila_prompts set estado = 'cancelada'
    where id = p_id and estado = 'na_fila';

  if not found then
    raise exception 'Item nao encontrado ou nao esta mais na fila (ja foi pego, fechado ou cancelado): %', p_id
      using errcode = 'check_violation';
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

-- fila_prompts_listar — o painel lê a fila inteira + o consumo/teto das 3
-- contas numa chamada só (mesmo padrão de lifeboard_load: 1 RPC, 1 round-trip).
create or replace function public.fila_prompts_listar(p_secret text)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_expected text;
  v_result   jsonb;
begin
  select valor into v_expected from private.lifeboard_config where chave = 'load_secret';
  if v_expected is null then
    raise exception
      'fila_prompts_listar: segredo nao configurado — inserir a chave load_secret em private.lifeboard_config (ver DEPLOY.md)'
      using errcode = 'config_file_error';
  end if;
  if p_secret is null or p_secret <> v_expected then
    raise exception 'fila_prompts_listar: acesso negado' using errcode = 'insufficient_privilege';
  end if;

  select jsonb_build_object(
    'fila', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', f.id, 'conta', f.conta, 'prompt', f.prompt, 'complexidade', f.complexidade,
        'modeloSugerido', f.modelo_sugerido, 'estado', f.estado, 'custoUsd', f.custo_usd,
        'criadoEm', f.criado_em, 'pegoEm', f.pego_em, 'concluidoEm', f.concluido_em,
        'sessaoUrl', f.sessao_url, 'resultado', f.resultado, 'criadoPor', f.criado_por,
        'taskId', f.task_id
      ) order by f.criado_em desc)
      from public.painel_fila_prompts f
    ), '[]'::jsonb),
    'consumo', coalesce((
      select jsonb_agg(jsonb_build_object(
        'conta', t.conta, 'tetoUsd', t.teto_usd,
        'consumoHojeUsd', public.painel_fila_consumo_hoje(t.conta)
      ) order by t.conta)
      from public.painel_teto_diario t
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.fila_prompts_enfileirar(text, jsonb) from public;
grant execute on function public.fila_prompts_enfileirar(text, jsonb) to anon, authenticated;
revoke all on function public.fila_prompts_pegar(text, text) from public;
grant execute on function public.fila_prompts_pegar(text, text) to anon, authenticated;
revoke all on function public.fila_prompts_fechar(text, uuid, text, numeric, text, text) from public;
grant execute on function public.fila_prompts_fechar(text, uuid, text, numeric, text, text) to anon, authenticated;
revoke all on function public.fila_prompts_cancelar(text, uuid) from public;
grant execute on function public.fila_prompts_cancelar(text, uuid) to anon, authenticated;
revoke all on function public.fila_prompts_listar(text) from public;
grant execute on function public.fila_prompts_listar(text) to anon, authenticated;
