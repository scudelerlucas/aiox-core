-- =============================================================================
-- OS-LIFEBOARD · Migration 0011 — P7: correções da RODADA 2 do crítico hostil.
-- =============================================================================
-- Sobre 0009 (`0009_lifeboard_v3_fila_ajustes.sql`). 0010 é de outro agente —
-- não tocado. Tudo ADITIVO: `create or replace function` sobre as MESMAS
-- funções de 0007/0009 — nenhuma tabela/coluna é removida ou recriada.
--
-- Achados fechados aqui (numeração do relatório da RODADA 2, 13/09/2026):
--  1 ALTO — fronteira do teto inconsistente entre TS e SQL: o TS
--    (`roteador.ts` → `escolherConta`/`contaTemEspacoPara`, e o fixture-store)
--    sempre aceitou em EMPATE (`headroom >= custo`, ou seja,
--    `medido+reservado+estimado <= teto`) — e o laço de roteamento automático
--    de `fila_prompts_enfileirar` (SQL) também já usava esse critério
--    (`headroom < estimado` → fora). Só o TRIGGER (`painel_fila_prompts_
--    checar_teto`) recusava no empate (`>= teto`) — uma conta a EXATAMENTE
--    US$150,00 de teto era "aceita" pela tela e pelo roteador automático, e
--    recusada pelo trigger na hora de gravar. Regra ÚNICA agora nos dois
--    lados: aceita sse `medido+reservado+estimado <= teto` — recusa só
--    quando ULTRAPASSA (`>`), nunca no empate. `fila_prompts_pegar_interno`
--    ganha a mesma correção por consistência (ela decide se um item JÁ
--    reservado pode virar `pega`; o mesmo "sse <= teto" vale para liberar).
--  2 ALTO — item `falhou` não custava nada: `painel_fila_consumo_hoje` somava
--    só `estado = 'concluida'` — um item que gastou US$40 de verdade e foi
--    fechado como `falhou` (create_session recusou o modelo, a sessão caiu
--    no meio) saía de graça do teto do dia, e a Routine seguinte podia gastar
--    os mesmos US$40 outra vez. Agora soma `estado in ('concluida', 'falhou')`
--    — `custo_usd` é sempre o valor REAL informado por `fechar_interno`,
--    nunca o estimado, então contar `falhou` não infla nada: só para de
--    fingir que o dinheiro não foi gasto.
--  4 MÉDIO — TOCTOU no trigger: sem lock, dois INSERTs concorrentes na MESMA
--    conta liam `medido`/`reservado` ANTES de qualquer um commitar — os dois
--    podiam calcular headroom suficiente isoladamente e os dois passavam,
--    juntos ultrapassando o teto. Primeira linha do corpo do trigger agora é
--    `perform 1 from painel_teto_diario where conta = new.conta for update`:
--    lock exclusivo na linha do teto DESTA conta — o segundo INSERT da MESMA
--    conta espera o primeiro commitar (e o reservado dele ficar visível)
--    antes de calcular o próprio headroom. Duas contas diferentes nunca se
--    bloqueiam (linhas diferentes de `painel_teto_diario`).
--  5 MÉDIO — item `pega` preso reserva orçamento para sempre: uma sessão que
--    trava, uma Routine que cai no meio do 5d/5e nunca chama `fechar_interno`
--    — o item fica `pega` indefinidamente, reservando o custo estimado dele
--    para sempre (e nenhuma Routine futura da mesma conta consegue pegar
--    nada novo se isso empurrar o headroom pra zero). `fila_prompts_pegar_
--    interno` agora devolve para `na_fila` (`pego_em = null`) qualquer item
--    `pega` há mais de 6 horas ANTES de calcular headroom ou pegar o próximo
--    — o próprio pull seguinte pode pegá-lo de novo — e devolve a CONTAGEM no
--    json (`devolvidos`). `painel_fila_reservado` já não soma um `pega` mais
--    velho que 6h (dupla proteção: entre um pull e outro da Routine, quem lê
--    o painel também vê o headroom real, não um preso por um item morto).
--  8 BAIXO — `revoke all from public` não fecha `anon`/`authenticated`: este
--    projeto Supabase tem `alter default privileges ... grant execute on
--    functions to anon, authenticated` (padrão do projeto, mesmo motivo de
--    `painel_fila_consumo_hoje` já nascer com essa disciplina em 0009) — uma
--    função nova recebe EXECUTE para essas duas roles na hora de criar, e
--    "revoke all from public" não desfaz isso (PUBLIC é um pseudo-papel, não
--    engloba grants explícitos a anon/authenticated). Duas funções ficaram
--    para trás: `painel_fila_reservado` e `painel_fila_medido_ate` só tinham
--    `revoke ... from public`. Ambas ganham `revoke all ... from public,
--    anon, authenticated`, igualando o padrão que `painel_fila_consumo_hoje`
--    já seguia.
--  9/3/10 — resolvidos FORA deste arquivo (não são achados de banco):
--    #9 em `src/app/prompts/actions.ts` (mapeia e-mail → rótulo da conta
--    antes de mostrar a recusa ao operador); #3/#10 no worker doc do hub
--    (`Lucas-Contexto-Geral/docs/ops/PROMPT-ROUTINE-publicar-sessoes-
--    outras-contas-2026-09-12.md`, vírgula faltando no passo 5f + nota sobre
--    modelo recusado pelo create_session).
-- =============================================================================

-- ── 1 · painel_fila_consumo_hoje — falhou também conta (achado ALTO #2) ─────
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
      and f.estado in ('concluida', 'falhou')
      and f.custo_usd is not null
      and public.painel_dia_operador(f.concluido_em) = v_dia;

  return coalesce(v_view, 0) + coalesce(v_fila, 0);
end;
$$;
comment on function public.painel_fila_consumo_hoje(text) is
  'Gasto MEDIDO do dia (fuso do operador): sessões publicadas (view) + itens da fila fechados hoje como concluída OU falhou (achado ALTO #2, rodada 2: um item falhou ainda gastou o custo_usd real — só não contá-lo deixava a Routine seguinte gastar de novo o mesmo dinheiro). Estimativa de na_fila/pega não entra aqui — ver painel_fila_reservado.';
revoke all on function public.painel_fila_consumo_hoje(text) from public, anon, authenticated;

-- ── 2 · painel_fila_reservado — ignora pega > 6h + revoke fechado (#5 + #8) ──
create or replace function public.painel_fila_reservado(p_conta text)
returns numeric
language sql
stable
set search_path = public, pg_temp
as $$
  select coalesce(sum(f.custo_estimado_usd), 0)
  from public.painel_fila_prompts f
  where f.conta = p_conta
    and (
      f.estado = 'na_fila'
      or (f.estado = 'pega' and f.pego_em >= now() - interval '6 hours')
    );
$$;
comment on function public.painel_fila_reservado(text) is
  'Achados CRÍTICO #1/#2 (rodada 1) + MÉDIO #5 (rodada 2): soma do estimado de na_fila + pega RECENTE (<6h) — pega mais velho que isso não reserva mais (pegar_interno já o devolveu, ou vai devolver no próximo pull daquela conta).';
revoke all on function public.painel_fila_reservado(text) from public, anon, authenticated;

-- ── 3 · painel_fila_medido_ate — só o revoke fechava (achado BAIXO #8) ──────
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
  'Achado ALTO #7 (rodada 1): o card mostra "medido até <isto>" em vez de "hoje" sozinho.';
revoke all on function public.painel_fila_medido_ate(text) from public, anon, authenticated;

-- ── 4 · trigger de recusa — boundary alinhado (>) + lock TOCTOU (#1 + #4) ───
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
  -- Achado MÉDIO #4 (rodada 2, TOCTOU): lock exclusivo na linha do teto desta
  -- conta ANTES de ler qualquer número — serializa dois INSERTs concorrentes
  -- da MESMA conta (linhas de contas diferentes nunca se bloqueiam entre si).
  -- Sem isto, dois prompts inseridos ao mesmo tempo liam o MESMO "reservado"
  -- (nenhum via o do outro, nenhum tinha commitado ainda) e os dois passavam
  -- a validação isoladamente, juntos ultrapassando o teto — com o lock, o
  -- segundo espera o primeiro terminar (commit ou rollback) e só então lê o
  -- reservado já atualizado por ele.
  perform 1 from public.painel_teto_diario where conta = new.conta for update;

  select teto_usd into v_teto from public.painel_teto_diario where conta = new.conta;
  if v_teto is null then
    v_teto := 150; -- conta sem linha em painel_teto_diario (não deveria acontecer): teto da casa.
  end if;

  select usd into v_estimado from public.painel_custo_estimado where complexidade = new.complexidade;
  if v_estimado is null then
    v_estimado := case new.complexidade
      when 'baixa' then 5 when 'media' then 15 when 'alta' then 50 when 'maxima' then 120
      else 15 end;
  end if;
  new.custo_estimado_usd := v_estimado;

  v_gasto := public.painel_fila_consumo_hoje(new.conta);
  v_reservado := public.painel_fila_reservado(new.conta); -- na_fila+pega EXISTENTES — new ainda não foi inserida.

  -- Achado ALTO #1 (rodada 2): recusa só quando ULTRAPASSA o teto (`>`), não
  -- mais no empate (`>=`) — o TS (roteador.ts, contaTemEspacoPara, fixture)
  -- sempre aceitou em empate (`headroom >= custo`); o trigger recusava
  -- exatamente esse mesmo caso. Regra única dos dois lados agora: aceita sse
  -- medido+reservado+estimado <= teto.
  if v_gasto + v_reservado + v_estimado > v_teto then
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
  'Achado ALTO #1 (rodada 2): recusa só ao ULTRAPASSAR o teto (>), alinhado com o TS (headroom >= custo). Achado MÉDIO #4 (rodada 2): lock FOR UPDATE em painel_teto_diario serializa inserts concorrentes da mesma conta (TOCTOU) — duas contas diferentes não se bloqueiam.';

-- ── 5 · fila_prompts_pegar_interno — devolve pega>6h + boundary alinhado ────
create or replace function public.fila_prompts_pegar_interno(p_conta text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_teto       numeric;
  v_gasto      numeric;
  v_reservado  numeric;
  v_row        public.painel_fila_prompts%rowtype;
  v_devolvidos integer;
begin
  if p_conta is null
     or p_conta not in ('lucasscudeler@gmail.com','lsgpandora@gmail.com','almapetra.ltda@gmail.com')
  then
    raise exception 'conta precisa ser uma das 3 contas da casa.' using errcode = 'check_violation';
  end if;

  -- Achado MÉDIO #5 (rodada 2): item `pega` há mais de 6h (sessão travada,
  -- Routine que caiu antes de chamar fechar_interno) reservava orçamento
  -- para sempre. Devolve para `na_fila` (pego_em = null) ANTES de calcular
  -- headroom/pegar o próximo — o pull seguinte (deste OU do próximo disparo
  -- da Routine) pode pegá-lo de novo. Contagem devolvida em `devolvidos`.
  with devolvidos as (
    update public.painel_fila_prompts
      set estado = 'na_fila', pego_em = null
      where conta = p_conta and estado = 'pega' and pego_em < now() - interval '6 hours'
      returning 1
  )
  select count(*) into v_devolvidos from devolvidos;

  select teto_usd into v_teto from public.painel_teto_diario where conta = p_conta;
  if v_teto is null then v_teto := 150; end if;

  v_gasto := public.painel_fila_consumo_hoje(p_conta);
  v_reservado := public.painel_fila_reservado(p_conta);

  -- Achado ALTO #1 (rodada 2, consistência): mesma fronteira do trigger —
  -- só recusa liberar quando o já reservado/medido ULTRAPASSA o teto (`>`).
  if v_gasto + v_reservado > v_teto then
    return jsonb_build_object(
      'ok', true, 'item', null, 'devolvidos', v_devolvidos,
      'motivo', format('teto atingido: medido US$ %s + reservado US$ %s > teto US$ %s',
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
    return jsonb_build_object('ok', true, 'item', null, 'devolvidos', v_devolvidos, 'motivo', 'fila vazia para esta conta');
  end if;

  update public.painel_fila_prompts
    set estado = 'pega', pego_em = now()
    where id = v_row.id;

  return jsonb_build_object('ok', true, 'devolvidos', v_devolvidos, 'item', jsonb_build_object(
    'id', v_row.id, 'conta', v_row.conta, 'prompt', v_row.prompt,
    'complexidade', v_row.complexidade, 'modeloSugerido', v_row.modelo_sugerido,
    'criadoEm', v_row.criado_em, 'taskId', v_row.task_id
  ), 'motivo', null);
end;
$$;
comment on function public.fila_prompts_pegar_interno(text) is
  'Achado MÉDIO #5 (rodada 2): devolve para na_fila qualquer pega > 6h ANTES de calcular headroom — "devolvidos" conta quantos (0 no caso comum). Achado ALTO #1 (rodada 2): boundary alinhado (> teto, não >=). Mantém achados CRÍTICOS #2/#4 da rodada 1 (recusa por teto; sem segredo de app — SECURITY DEFINER com revoke all).';
revoke all on function public.fila_prompts_pegar_interno(text) from public, anon, authenticated;

-- (fila_prompts_enfileirar e o laço de roteamento automático NÃO mudam neste
-- arquivo: o laço já filtrava por `headroom < estimado` — accept sse
-- `headroom >= estimado` — que É a mesma fronteira do achado ALTO #1; e ele
-- lê `painel_fila_reservado`, que já herda a correção #5 automaticamente por
-- ser uma chamada de função, não um valor inline.)
