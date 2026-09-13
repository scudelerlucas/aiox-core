-- =============================================================================
-- OS-LIFEBOARD · Migration 0009 — P7: correções do crítico hostil (REPROVADO).
-- =============================================================================
-- Sobre 0007 (`0007_lifeboard_v3_fila_prompts.sql`). 0008 é de outro agente —
-- não tocado. Tudo ADITIVO: nenhuma tabela/coluna de 0007 é removida; a
-- correção troca comportamento de função/trigger e ACRESCENTA colunas/tabelas.
--
-- Achados fechados aqui (numeração do relatório do crítico):
--  1 CRÍTICO — sem reserva por item: 5 prompts Fable cabiam a 149,99/150 porque
--    nada somava o que JÁ estava na fila. Nasce `painel_custo_estimado`
--    (1 linha por complexidade, única fonte — lida pelo trigger E pelo
--    roteador em TS) + coluna `custo_estimado_usd` (o trigger SEMPRE a
--    recalcula de `NEW.complexidade`, então nenhum caller pode forjar o
--    valor) + `painel_fila_reservado()` somando `na_fila`+`pega`.
--  2 CRÍTICO — `pegar` ignorava o teto: `fila_prompts_pegar_interno` novo
--    devolve `{item: null, motivo}` quando `medido + reservado >= teto`.
--  3 CRÍTICO — custo negativo zerava o freio: `check` em `custo_usd` (0..500)
--    na coluna E repetido em `fila_prompts_fechar_interno`; `custo_estimado_usd
--    >= 0`.
--  4 CRÍTICO — autenticação do worker: a Routine NUNCA usa o segredo do
--    painel. `fila_prompts_pegar_interno`/`fila_prompts_fechar_interno` são
--    SECURITY DEFINER com `revoke all from public/anon/authenticated` — só
--    executam para quem já é dono/`postgres` (exatamente o papel do MCP
--    Supabase da própria conta do operador, sem segredo nenhum). `fechar_
--    interno` amarra chamador↔conta exigindo `estado='pega' and conta=
--    p_conta` (achado 15 é a mesma amarra).
--  5 ALTO — `painel_consumo_por_conta_dia` vazava para `anon` (a view corria
--    com o dono, ignorando RLS da tabela-base): `security_invoker = on` +
--    `revoke select … from anon, authenticated`; e `painel_fila_consumo_hoje`
--    (SECURITY DEFINER) não deveria ser chamável direto por anon/authenticated
--    — só pelas RPCs secret-gated que já rodam como dono.
--  6 ALTO — fronteira do dia em UTC: `painel_dia_operador()` (America/
--    Sao_Paulo) substitui `current_date`/`date()` cru na view, na função de
--    consumo, no trigger e no agrupamento de `concluido_em`.
--  7 ALTO — o proxy não via "hoje" de verdade: consumo exibido = medido
--    (view, agrupada por `atualizado_em`) + `custo_usd` de `concluida` hoje +
--    `custo_estimado_usd` de `pega` (trabalho em andamento) — e o card
--    (camada TS) passa a dizer "medido até <última sync>" em vez de só "hoje".
--  8 ALTO — roteador (SQL e TS) ignorava complexidade: o auto-routing de
--    `fila_prompts_enfileirar` agora filtra por `teto − medido − reservado ≥
--    custo_estimado_usd`, lendo a MESMA tabela `painel_custo_estimado` que o
--    TS espelha (`CUSTO_ESTIMADO_POR_COMPLEXIDADE` em `core/prompts/tipos.ts`).
--  9 ALTO — `modeloSugerido` decorativo no worker: resolvido do lado da
--    Routine (doc do hub), não neste arquivo — o contrato de dados
--    (`modelo_sugerido` por item) já existia e continua aqui inalterado.
-- 10 MÉDIO — erro cru do Postgres na UI: resolvido do lado do app
--    (`live-client.ts`), não neste arquivo — mas só o texto do
--    `check_violation` (nossas próprias mensagens em português) tem permissão
--    de atravessar; por isso TODA mensagem nova abaixo continua em português.
-- 11 MÉDIO — texto do prompt: decisão tomada do lado do app (mostrar 90
--    caracteres + expandir); a RPC `fila_prompts_listar` continua devolvendo
--    o prompt INTEIRO (o painel já está atrás do segredo + allowlist).
-- 13 MÉDIO — cartão "escolhida agora" mesmo sem espaço: resolvido em TS
--    (`escolherConta` ganha o parâmetro `reservados` e o cálculo de
--    headroom); aqui só nasce o dado que faltava (`reservadoUsd` no
--    `fila_prompts_listar`).
-- 14 MÉDIO — `criado_por`: resolvido do lado do app (`actions.ts` lê o e-mail
--    da sessão) — o contrato de coluna já existia.
-- 15 BAIXO — amarra chamador↔conta: ver item 4 (`fechar_interno`).
-- 16 BAIXO — trilho de progresso: resolvido em TS/Tailwind
--    (`conta-card.tsx`), sem SQL.
-- =============================================================================

-- ── 0 · painel_dia_operador — a fronteira do dia no fuso do operador ─────────
create or replace function public.painel_dia_operador(p_instante timestamptz default now())
returns date
language sql
stable
set search_path = public, pg_temp
as $$
  select (p_instante at time zone 'America/Sao_Paulo')::date;
$$;
comment on function public.painel_dia_operador(timestamptz) is
  'Achado ALTO #6 (crítico P7): "hoje" no fuso do operador (America/Sao_Paulo), nunca UTC cru — mesmo espírito de src/lib/fuso.ts no app.';

-- ── 1 · painel_custo_estimado — 1 fonte única para o custo por complexidade ──
create table if not exists public.painel_custo_estimado (
  complexidade text primary key check (complexidade in ('baixa','media','alta','maxima')),
  usd numeric not null check (usd >= 0),
  atualizado_em timestamptz not null default now()
);
comment on table public.painel_custo_estimado is
  'Achado CRÍTICO #1/#8: custo estimado (US$) por complexidade — 1 fonte, lida pelo trigger de teto (SQL) e espelhada em CUSTO_ESTIMADO_POR_COMPLEXIDADE (core/prompts/tipos.ts), mesmo padrão de MODELO_POR_COMPLEXIDADE × model-routing.md.';

insert into public.painel_custo_estimado (complexidade, usd) values
  ('baixa', 5), ('media', 15), ('alta', 50), ('maxima', 120)
on conflict (complexidade) do nothing;

alter table public.painel_custo_estimado enable row level security;
-- Sem policy nenhuma: só o dono/postgres lê (as RPCs SECURITY DEFINER abaixo
-- rodam como dono e enxergam a tabela sem depender de policy nem de grant).

-- ── 2 · painel_fila_prompts — colunas novas + freios de valor ────────────────
alter table public.painel_fila_prompts
  add column if not exists custo_estimado_usd numeric;

update public.painel_fila_prompts
  set custo_estimado_usd = coalesce(
    (select ce.usd from public.painel_custo_estimado ce where ce.complexidade = painel_fila_prompts.complexidade),
    15
  )
  where custo_estimado_usd is null;

alter table public.painel_fila_prompts
  alter column custo_estimado_usd set not null;

do $$ begin
  alter table public.painel_fila_prompts
    add constraint painel_fila_prompts_custo_estimado_check check (custo_estimado_usd >= 0);
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.painel_fila_prompts
    add constraint painel_fila_prompts_custo_usd_check
      check (custo_usd is null or (custo_usd >= 0 and custo_usd <= 500));
exception when duplicate_object then null;
end $$;
comment on column public.painel_fila_prompts.custo_estimado_usd is
  'Achado CRÍTICO #1: calculado SEMPRE pelo trigger a partir de complexidade (nunca aceito de fora) — a reserva de teto soma esta coluna para na_fila+pega.';
comment on column public.painel_fila_prompts.custo_usd is
  'Achado CRÍTICO #3: 0..500 — negativo não zera mais o freio (gasto_medido_hoje somava custo_usd sem chão nem teto).';

-- ── 3 · painel_fila_reservado — soma de reserva (na_fila + pega) ────────────
create or replace function public.painel_fila_reservado(p_conta text)
returns numeric
language sql
stable
set search_path = public, pg_temp
as $$
  select coalesce(sum(f.custo_estimado_usd), 0)
  from public.painel_fila_prompts f
  where f.conta = p_conta and f.estado in ('na_fila', 'pega');
$$;
comment on function public.painel_fila_reservado(text) is
  'Achado CRÍTICO #1/#2: soma do custo ESTIMADO de tudo que ainda vai gastar (na_fila) ou está gastando agora (pega) — a "reserva" que faltava no cálculo do teto.';
revoke all on function public.painel_fila_reservado(text) from public;

-- ── 4 · painel_fila_medido_ate — timestamp da última sincronização medida ────
create or replace function public.painel_fila_medido_ate(p_conta text)
returns timestamptz
language sql
stable
set search_path = public, pg_temp
as $$
  select max(s.atualizado_em)
  from public.painel_frentes_sessoes s
  where s.conta = p_conta
    and public.painel_dia_operador(coalesce(s.atualizado_em, s.criado_em, s.publicado_em)) = public.painel_dia_operador();
$$;
comment on function public.painel_fila_medido_ate(text) is
  'Achado ALTO #7: o card mostra "medido até <isto>" em vez de "hoje" sozinho — o proxy só atualiza na cadência da Routine, isto é o quão velho o número exibido pode estar.';
revoke all on function public.painel_fila_medido_ate(text) from public;

-- ── 5 · painel_consumo_por_conta_dia — fuso do operador + security_invoker ──
create or replace view public.painel_consumo_por_conta_dia as
select
  s.conta,
  public.painel_dia_operador(coalesce(s.atualizado_em, s.criado_em, s.publicado_em)) as dia,
  sum(coalesce(s.custo_usd, 0)) as custo_usd,
  count(*) as sessoes
from public.painel_frentes_sessoes s
where s.conta is not null
group by 1, 2;
comment on view public.painel_consumo_por_conta_dia is
  'T1 do mapa !4z 13/09, corrigida (achados ALTO #5 e #6): "dia" no fuso do operador (não UTC), e security_invoker=on para a view respeitar a MESMA RLS da tabela-base — antes, anon lia 60 linhas pela view enquanto a tabela devolvia 0.';

alter view public.painel_consumo_por_conta_dia set (security_invoker = on);
revoke select on public.painel_consumo_por_conta_dia from anon, authenticated;
-- A leitura pública continua existindo — só que agora pelas RPCs secret-gated
-- (`fila_prompts_listar`), que rodam SECURITY DEFINER (dono, RLS ignorada de
-- propósito, do mesmo jeito que `lifeboard_load` já fazia).

-- ── 6 · painel_fila_consumo_hoje — gasto MEDIDO (sem estimativa) ────────────
-- Acha o "gasto_medido_hoje" que o trigger e o `pegar_interno` usam no
-- cálculo do teto. Estimativa (na_fila/pega) NÃO entra aqui — ela é somada
-- separadamente por `painel_fila_reservado`, para nunca contar duas vezes o
-- mesmo item `pega` (uma vez como medido, outra como reservado).
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
  v_dia date := public.painel_dia_operador();
begin
  select coalesce(sum(c.custo_usd), 0) into v_view
    from public.painel_consumo_por_conta_dia c
    where c.conta = p_conta and c.dia = v_dia;

  select coalesce(sum(f.custo_usd), 0) into v_fila
    from public.painel_fila_prompts f
    where f.conta = p_conta
      and f.estado = 'concluida'
      and f.custo_usd is not null
      and public.painel_dia_operador(f.concluido_em) = v_dia;

  return coalesce(v_view, 0) + coalesce(v_fila, 0);
end;
$$;
comment on function public.painel_fila_consumo_hoje(text) is
  'Gasto MEDIDO do dia (fuso do operador, achado ALTO #6): sessões publicadas (view) + itens da fila fechados como concluída hoje. Estimativa de na_fila/pega NÃO entra aqui — ver painel_fila_reservado (achado ALTO #7: os dois juntos formam o número exibido no card).';
revoke all on function public.painel_fila_consumo_hoje(text) from public, anon, authenticated;
-- Achado ALTO #5: antes concedida a anon/authenticated — SECURITY DEFINER
-- chamável direto por qualquer um vazava o gasto real de todas as contas. As
-- RPCs secret-gated continuam funcionando (chamada função→função roda com o
-- privilégio do DONO da função chamadora, não precisa de grant).

-- ── 7 · trigger de recusa — agora com estimativa + reserva (CRÍTICO #1/#2) ──
create or replace function public.painel_fila_prompts_checar_teto()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_teto      numeric;
  v_gasto     numeric;
  v_reservado numeric;
  v_estimado  numeric;
begin
  select teto_usd into v_teto from public.painel_teto_diario where conta = new.conta;
  if v_teto is null then
    v_teto := 150; -- conta sem linha em painel_teto_diario (não deveria acontecer): teto da casa.
  end if;

  select usd into v_estimado from public.painel_custo_estimado where complexidade = new.complexidade;
  if v_estimado is null then
    -- painel_custo_estimado sem a linha (não deveria acontecer): mesma tabela
    -- de fallback que MODELO_POR_COMPLEXIDADE usa do lado do TS.
    v_estimado := case new.complexidade
      when 'baixa' then 5 when 'media' then 15 when 'alta' then 50 when 'maxima' then 120
      else 15 end;
  end if;
  -- Achado CRÍTICO #1: o valor SEMPRE vem daqui, nunca de fora — nenhum
  -- caller (nem a RPC de enfileirar) pode inserir um custo_estimado_usd
  -- diferente do que a tabela diz para esta complexidade.
  new.custo_estimado_usd := v_estimado;

  v_gasto := public.painel_fila_consumo_hoje(new.conta);
  v_reservado := public.painel_fila_reservado(new.conta); -- na_fila+pega EXISTENTES — new ainda não foi inserida.

  if v_gasto + v_reservado + v_estimado >= v_teto then
    raise exception
      'fila: conta % ficaria em US$ % hoje (medido US$ % + reservado US$ % + este item US$ %) — teto US$ %',
      new.conta, round(v_gasto + v_reservado + v_estimado, 2), round(v_gasto, 2),
      round(v_reservado, 2), round(v_estimado, 2), round(v_teto, 2)
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;
comment on function public.painel_fila_prompts_checar_teto() is
  'R6 do mapa !4z + achados CRÍTICOS #1/#2/#3 (13/09/2026, rodada de correção): recusa quando medido+reservado+este item >= teto — antes só olhava o medido, então a fila inteira podia ficar "quase no teto" sem nenhum item sozinho estourar.';

-- (trigger já existe de 0007 — `create or replace function` acima já é
-- suficiente; sem necessidade de recriar o `create trigger`.)

-- ── 8 · fila_prompts_enfileirar — roteamento automático por HEADROOM ────────
-- Mesmo contrato de 0007 (mesma assinatura, secret-gated, painel-only —
-- achado #4: continua sendo a ÚNICA porta de escrita usada pelo painel).
-- Muda só o CRITÉRIO do roteamento automático: antes "consumo < teto"
-- (achado ALTO #8 — ignorava complexidade); agora "headroom >= estimado",
-- lendo painel_custo_estimado — MESMA tabela que o TS espelha.
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
  v_estimado      numeric;
  v_melhor_conta  text;
  v_melhor_consumo numeric;
  v_melhor_folga  numeric;
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

  select usd into v_estimado from public.painel_custo_estimado where complexidade = v_complexidade;
  if v_estimado is null then v_estimado := 15; end if;

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
    -- para ela (mesma decisão de 0007).
    for rec in
      select
        t.conta as conta,
        t.teto_usd as teto,
        public.painel_fila_consumo_hoje(t.conta) as consumo,
        public.painel_fila_reservado(t.conta) as reservado
      from public.painel_teto_diario t
      order by (case when t.conta = 'lucasscudeler@gmail.com' then 0 else 1 end), t.conta
    loop
      -- Achado ALTO #8: headroom, não só "não bateu o teto" — uma conta a
      -- US$ 149 de US$ 150 não tem espaço para uma tarefa maxima (US$ 120),
      -- mesmo com consumo abaixo do teto.
      if (rec.teto - rec.consumo - rec.reservado) < v_estimado then
        continue;
      end if;
      if v_melhor_consumo is null or rec.consumo < v_melhor_consumo then
        v_melhor_consumo := rec.consumo;
        v_melhor_conta := rec.conta;
        v_melhor_folga := rec.teto - rec.consumo - rec.reservado;
      end if;
    end loop;

    if v_melhor_conta is null then
      raise exception 'fila: nenhuma conta tem US$ % livres para uma tarefa % (estimado US$ %)',
        round(v_estimado, 2), v_complexidade, round(v_estimado, 2)
        using errcode = 'check_violation';
    end if;
    v_conta := v_melhor_conta;
    v_motivo := format('roteamento automatico: menor consumo hoje (US$ %s), US$ %s livres',
      round(v_melhor_consumo, 2), round(v_melhor_folga, 2));
  else
    v_motivo := 'conta escolhida manualmente no formulario';
  end if;

  -- Pode levantar a exceção do trigger (achados CRÍTICOS #1/#2) quando
  -- `v_conta` veio manual e não tem headroom — propositalmente NÃO
  -- capturada aqui: quem chama recebe a mesma mensagem em português que o
  -- roteamento automático já respeitaria. `custo_estimado_usd` não é
  -- inserido explicitamente — o trigger SEMPRE o recalcula (achado #1).
  insert into public.painel_fila_prompts (conta, prompt, complexidade, modelo_sugerido, criado_por, task_id)
  values (v_conta, btrim(v_prompt), v_complexidade, v_modelo, v_criado_por, v_task_id)
  returning id into v_id;

  return jsonb_build_object(
    'ok', true, 'id', v_id, 'conta', v_conta, 'modelo_sugerido', v_modelo, 'motivo', v_motivo
  );
end;
$$;

-- ── 9 · worker interno — SEM segredo de app (DECISÃO, achado CRÍTICO #4) ────
-- A Routine de cada conta chama estas duas direto via `execute_sql` do MCP
-- Supabase da PRÓPRIA conta (papel `postgres`/dono) — nunca com
-- LIFEBOARD_LOAD_SECRET. `revoke all from public` cobre anon/authenticated
-- (nenhum GRANT é dado a eles); só dono/superusuário executa.

create or replace function public.fila_prompts_pegar_interno(p_conta text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_teto      numeric;
  v_gasto     numeric;
  v_reservado numeric;
  v_row       public.painel_fila_prompts%rowtype;
begin
  if p_conta is null
     or p_conta not in ('lucasscudeler@gmail.com','lsgpandora@gmail.com','almapetra.ltda@gmail.com')
  then
    raise exception 'conta precisa ser uma das 3 contas da casa.' using errcode = 'check_violation';
  end if;

  select teto_usd into v_teto from public.painel_teto_diario where conta = p_conta;
  if v_teto is null then v_teto := 150; end if;

  v_gasto := public.painel_fila_consumo_hoje(p_conta);
  v_reservado := public.painel_fila_reservado(p_conta);

  -- Achado CRÍTICO #2: `pegar` ignorava o teto — agora recusa ANTES de
  -- destravar um item, mesmo que ele já estivesse reservado no INSERT (o
  -- medido pode ter subido entretanto, por sessões fora da fila).
  if v_gasto + v_reservado >= v_teto then
    return jsonb_build_object(
      'ok', true, 'item', null,
      'motivo', format('teto atingido: medido US$ %s + reservado US$ %s >= teto US$ %s',
        round(v_gasto, 2), round(v_reservado, 2), round(v_teto, 2))
    );
  end if;

  select * into v_row
    from public.painel_fila_prompts
    where conta = p_conta and estado = 'na_fila'
    order by criado_em asc
    for update skip locked
    limit 1;

  if not found then
    return jsonb_build_object('ok', true, 'item', null, 'motivo', 'fila vazia para esta conta');
  end if;

  update public.painel_fila_prompts
    set estado = 'pega', pego_em = now()
    where id = v_row.id;

  return jsonb_build_object('ok', true, 'item', jsonb_build_object(
    'id', v_row.id, 'conta', v_row.conta, 'prompt', v_row.prompt,
    'complexidade', v_row.complexidade, 'modeloSugerido', v_row.modelo_sugerido,
    'criadoEm', v_row.criado_em, 'taskId', v_row.task_id
  ), 'motivo', null);
end;
$$;
comment on function public.fila_prompts_pegar_interno(text) is
  'Achados CRÍTICOS #2/#4: substitui fila_prompts_pegar (segredo do app). Chamada pela Routine via MCP Supabase da própria conta (papel postgres) — revoke all cobre anon/authenticated, nada de segredo.';
revoke all on function public.fila_prompts_pegar_interno(text) from public, anon, authenticated;

create or replace function public.fila_prompts_fechar_interno(
  p_id uuid, p_conta text, p_estado text, p_custo_usd numeric,
  p_sessao_url text, p_resultado text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_id is null then
    raise exception 'id é obrigatório.' using errcode = 'check_violation';
  end if;
  if p_conta is null
     or p_conta not in ('lucasscudeler@gmail.com','lsgpandora@gmail.com','almapetra.ltda@gmail.com')
  then
    raise exception 'conta precisa ser uma das 3 contas da casa.' using errcode = 'check_violation';
  end if;
  if p_estado is null or p_estado not in ('concluida','falhou') then
    raise exception 'estado de fechamento precisa ser concluida ou falhou.' using errcode = 'check_violation';
  end if;
  if p_custo_usd is null then
    raise exception 'custo_usd e obrigatorio ao fechar (use 0 quando nao houver custo).'
      using errcode = 'check_violation';
  end if;
  -- Achado CRÍTICO #3: negativo não passa mais (zerava o freio ao subtrair
  -- do gasto do dia); acima de 500 também não (chão de sanidade do plano).
  if p_custo_usd < 0 or p_custo_usd > 500 then
    raise exception 'custo_usd fora da faixa aceita (0 a 500): %', p_custo_usd
      using errcode = 'check_violation';
  end if;

  -- Achados #4/#15: a amarra chamador↔conta. Sem `conta = p_conta`, a
  -- Routine de UMA conta poderia fechar (e escrever custo/URL em) o item de
  -- OUTRA conta — bastaria saber o id.
  update public.painel_fila_prompts
    set estado = p_estado,
        custo_usd = p_custo_usd,
        sessao_url = coalesce(p_sessao_url, sessao_url),
        resultado = coalesce(p_resultado, resultado),
        concluido_em = now()
    where id = p_id and estado = 'pega' and conta = p_conta;

  if not found then
    raise exception
      'Item nao encontrado, nao esta em estado "pega", ou nao pertence a conta informada: %', p_id
      using errcode = 'check_violation';
  end if;

  return jsonb_build_object('ok', true);
end;
$$;
comment on function public.fila_prompts_fechar_interno(uuid, text, text, numeric, text, text) is
  'Achados CRÍTICOS #3/#4/#15: substitui fila_prompts_fechar (segredo do app). custo_usd 0..500; exige conta=p_conta (amarra chamador↔conta) além de estado=pega.';
revoke all on function public.fila_prompts_fechar_interno(uuid, text, text, numeric, text, text) from public, anon, authenticated;

-- Achado CRÍTICO #4: as RPCs antigas do worker (secret-gated) somem — o
-- worker passa a usar só as _interno acima, sem NENHUM segredo de app.
drop function if exists public.fila_prompts_pegar(text, text);
drop function if exists public.fila_prompts_fechar(text, uuid, text, numeric, text, text);

-- ── 10 · fila_prompts_cancelar — inalterada (mantida por completude) ───────
-- (0007 já a define corretamente: só cancela `na_fila`; sem mudança aqui.)

-- ── 11 · fila_prompts_listar — + custoEstimadoUsd/reservadoUsd/medidoAteEm ──
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
        'custoEstimadoUsd', f.custo_estimado_usd,
        'criadoEm', f.criado_em, 'pegoEm', f.pego_em, 'concluidoEm', f.concluido_em,
        'sessaoUrl', f.sessao_url, 'resultado', f.resultado, 'criadoPor', f.criado_por,
        'taskId', f.task_id
      ) order by f.criado_em desc)
      from public.painel_fila_prompts f
    ), '[]'::jsonb),
    'consumo', coalesce((
      select jsonb_agg(jsonb_build_object(
        'conta', t.conta, 'tetoUsd', t.teto_usd,
        'consumoHojeUsd', public.painel_fila_consumo_hoje(t.conta),
        'reservadoUsd', public.painel_fila_reservado(t.conta),
        'medidoAteEm', public.painel_fila_medido_ate(t.conta)
      ) order by t.conta)
      from public.painel_teto_diario t
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;
comment on function public.fila_prompts_listar(text) is
  'Achados ALTO #7/#8/MÉDIO #13: cada conta ganha reservadoUsd (na_fila+pega) e medidoAteEm (achado #7 — "medido até", não "hoje" sozinho); custoEstimadoUsd por item (achado #1).';

-- (grants de fila_prompts_enfileirar/cancelar/listar para anon/authenticated
-- já existem de 0007 e continuam valendo — são as RPCs secret-gated do
-- painel, não tocadas por este item.)
