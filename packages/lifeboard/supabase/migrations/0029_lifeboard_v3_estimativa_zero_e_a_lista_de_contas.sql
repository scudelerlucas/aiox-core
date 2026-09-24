-- ════════════════════════════════════════════════════════════════════════════
-- 0029 · LIFEBOARD v3 · ESTIMATIVA ZERO NÃO É ESTIMATIVA, e a LISTA DE CONTAS
--        passa a ter UMA fonte só
-- ════════════════════════════════════════════════════════════════════════════
--
-- Rodada 14. Dois achados do crítico hostil, os dois no DESPACHO, os dois
-- mordendo SEM que ninguém mexa numa linha de código do repositório.
--
-- ── CRÍTICO 5 · estimativa ZERO desligava o teto ────────────────────────────
-- `painel_custo_estimado` é, pelo `DEPLOY.md`, "1 fonte para o custo estimado"
-- — uma tabela feita para o operador ajustar. A check da 0009 era
-- `check (usd >= 0)`, e ZERO é exatamente o número que alguém escreve para
-- "Haiku é de graça". Com uma complexidade em zero, três coisas acontecem ao
-- mesmo tempo:
--   1. `f.custo_estimado_usd <= v_headroom` vira `0 <= qualquer coisa ≥ 0` —
--      o item é sempre elegível, inclusive num dia sem espaço nenhum;
--   2. `painel_fila_reservado` soma `custo_estimado_usd` dos itens `pega` —
--      soma ZERO, então despachar NÃO consome headroom;
--   3. o gatilho de admissão só recusa `estimado > teto` — `0 > 500` é falso.
-- Medido pelo crítico num banco novo: SEIS sessões de Claude em voo na mesma
-- conta, reserva de US$ 0, e o painel anunciando US$ 499 livres. Cada uma
-- podia fechar em até o teto de sanidade. O teto por conta — que é a razão de
-- existir da peça — deixava de existir para aquela complexidade.
-- `grep painel_custo_estimado` na suíte de comportamento: ZERO ocorrências.
--
-- AS TRÊS PAREDES QUE ENTRAM (nenhuma sozinha basta):
--   · §3 `painel_custo_estimado.usd > 0` — estimativa zero não é estimativa,
--     é a ausência dela (a mesma régua de D40 para medição);
--   · §4 `painel_fila_prompts.custo_estimado_usd > 0` — a coluna do ITEM
--     também, para que um `update` direto não refaça o buraco por baixo da
--     tabela de estimativas;
--   · §6 `and v_headroom > 0` na condição do pull — dia sem espaço não
--     despacha NADA, custe o item o que ele disser que custa.
--
-- ── ALTO 6 · a lista das quatro contas estava escrita à mão em 5 lugares ────
-- `fila_prompts_pegar_interno` (0027:144), `fila_prompts_fechar_interno`
-- (0027:420), `fila_prompts_enfileirar` (0027:1234) e as DUAS constraints de
-- coluna (0027:640 e 0027:644) — cinco cópias do mesmo contrato, mais a ordem
-- de desempate como sexta. O crítico tirou `arborcactus@gmail.com` de UMA
-- delas (a 420, o FECHAMENTO) e os cinco portões ficaram verdes: o worker
-- gastou US$ 430, o fechamento foi recusado, o livro do dia ficou em ZERO e o
-- item morreu carregando a estimativa da casa (120) — US$ 310 de teto falso,
-- por conta, por item. É o mesmo buraco que a §0 desta série existe para
-- fechar, e é a razão pela qual o T68 ("A QUARTA CONTA RECEBE ITEM") não
-- pegou nada: ele exercita enfileirar e pegar, e para aí.
--
-- §1 cria `public.painel_contas_da_casa()` e §§2, 6, 7 e 8 a consomem. Daqui
-- para a frente conta nova (ou conta que sai) é UMA linha, e o banco recusa
-- `drop function` enquanto as constraints dependerem dela.
--
-- ── BAIXO 8 · o teto de SANIDADE agora cabe na coluna ──────────────────────
-- `painel_custo_maximo_por_item()` devolvia 100.000 e nada o amarrava a nada:
-- o crítico subiu para 1.000.000 com os cinco portões verdes, e a faixa passou
-- a aceitar número que `custo_usd numeric(10,4)` (máximo 999.999,9999) não
-- guarda — o fechamento devolvia `numeric field overflow`, erro cru de
-- Postgres em inglês, na cara de quem chama. §5 mede a precisão REAL da coluna
-- no catálogo e ABORTA a migration se a faixa de sanidade não couber nela.
--
-- Re-aplicável: tudo é `create or replace` / `drop … if exists` / `alter …`.
-- Aditiva: 0027 e 0028 não são reescritas.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1 · painel_contas_da_casa() — UMA fonte para as contas da casa ─────────
-- `immutable` de propósito: é o que permite usá-la em CHECK constraint (§2),
-- do mesmo jeito que `painel_custo_maximo_por_item()` já é usada na check de
-- `custo_usd`. A ORDEM do array é a ordem de desempate (a mesma de `CONTAS`
-- em `src/core/prompts/tipos.ts`), então `array_position` substitui também a
-- sexta cópia da lista — o `case … when … then N … else 9`.
create or replace function public.painel_contas_da_casa()
returns text[]
language sql
immutable
set search_path = public, pg_temp
as $$
  select array[
    'lucasscudeler@gmail.com',
    'lsgpandora@gmail.com',
    'almapetra.ltda@gmail.com',
    'arborcactus@gmail.com'
  ]::text[];
$$;
comment on function public.painel_contas_da_casa() is
  'ALTO 6 (rodada 14): as contas da casa, UMA vez. Antes a mesma lista estava escrita à mão em cinco lugares (as três portas da fila e as duas check constraints de coluna) mais a ordem de desempate; tirar a 4ª conta de UMA delas — a do FECHAMENTO — passou pelos cinco portões e transformou US$ 430 reais em US$ 0 no livro, com o item morrendo pela estimativa da casa (US$ 310 de teto falso). A ORDEM do array é a ordem de desempate do chooser, igual a CONTAS em src/core/prompts/tipos.ts.';
revoke all on function public.painel_contas_da_casa() from public, anon, authenticated;

-- ── 2 · as duas constraints de coluna passam a ler a fonte única ───────────
alter table public.painel_teto_diario drop constraint if exists painel_teto_diario_conta_check;
alter table public.painel_teto_diario add constraint painel_teto_diario_conta_check
  check (conta = any (public.painel_contas_da_casa()));

alter table public.painel_fila_prompts drop constraint if exists painel_fila_prompts_conta_check;
alter table public.painel_fila_prompts add constraint painel_fila_prompts_conta_check
  check (conta = any (public.painel_contas_da_casa()));

-- ── 3 · CRÍTICO 5 · primeira parede: estimativa ZERO não é estimativa ──────
-- A migration ABORTA se o banco já tiver estimativa ≤ 0: ajustar o número em
-- silêncio esconderia exatamente o estado que este achado descreve.
do $$
declare v_ruins text;
begin
  select string_agg(complexidade || '=' || usd::text, ', ')
    into v_ruins from public.painel_custo_estimado where usd <= 0;
  if v_ruins is not null then
    raise exception
      '0029 §3: painel_custo_estimado tem estimativa zerada ou negativa (%) — estimativa zero desliga o teto da conta (o pull despacha sem consumir headroom). Corrija o valor para o custo real da complexidade antes de aplicar esta migration.',
      v_ruins using errcode = 'check_violation';
  end if;
end $$;

alter table public.painel_custo_estimado drop constraint if exists painel_custo_estimado_usd_check;
alter table public.painel_custo_estimado add constraint painel_custo_estimado_usd_check
  check (usd > 0);
comment on column public.painel_custo_estimado.usd is
  'CRÍTICO 5 (rodada 14): ESTRITAMENTE maior que zero. Era `>= 0` desde a 0009. Zero é o número que um operador escreve para "este modelo é de graça", e com ele o teto da conta deixa de existir para aquela complexidade: o item é sempre elegível (0 <= qualquer headroom), painel_fila_reservado soma zero (despachar não consome espaço) e o gatilho de admissão não recusa (0 > teto é falso). Medido: 6 sessões em voo na mesma conta, reserva US$ 0, headroom anunciando US$ 499.';

-- ── 4 · CRÍTICO 5 · segunda parede: a coluna do ITEM também ───────────────
do $$
declare v_quantos int;
begin
  select count(*) into v_quantos from public.painel_fila_prompts where custo_estimado_usd <= 0;
  if v_quantos > 0 then
    raise exception
      '0029 §4: % item(ns) da fila com custo_estimado_usd zerado ou negativo — item de estimativa zero atravessa dia sem espaço e não reserva nada. Recalcule a estimativa (o gatilho a deriva de painel_custo_estimado) antes de aplicar esta migration.',
      v_quantos using errcode = 'check_violation';
  end if;
end $$;

alter table public.painel_fila_prompts drop constraint if exists painel_fila_prompts_custo_estimado_check;
alter table public.painel_fila_prompts add constraint painel_fila_prompts_custo_estimado_check
  check (custo_estimado_usd > 0);
comment on column public.painel_fila_prompts.custo_estimado_usd is
  'CRÍTICO 5 (rodada 14): ESTRITAMENTE maior que zero (era `>= 0`, 0009). Calculado SEMPRE pelo gatilho a partir da complexidade, lendo painel_custo_estimado — esta check é a parede de baixo, para que um `update` direto na coluna não refaça o buraco por baixo da tabela de estimativas. A reserva de teto (painel_fila_reservado) soma esta coluna: estimativa zero = despacho que não consome headroom nenhum.';

-- ── 5 · BAIXO 8 · a faixa de SANIDADE tem de caber na coluna ──────────────
-- `painel_custo_maximo_por_item()` é o número que as portas de registro
-- aceitam. Se ele passar do que `painel_fila_prompts.custo_usd` guarda, a
-- recusa em português da casa é substituída por `numeric field overflow` do
-- Postgres — e o teste T77 só afirmava `> 500`, então 1.000.000 passava.
-- A capacidade sai do CATÁLOGO, não de um número copiado aqui.
do $$
declare
  v_precisao int;
  v_escala   int;
  v_cabe     numeric;
  v_sanidade numeric;
begin
  select numeric_precision, numeric_scale
    into v_precisao, v_escala
    from information_schema.columns
   where table_schema = 'public'
     and table_name = 'painel_fila_prompts'
     and column_name = 'custo_usd';

  if v_precisao is null or v_escala is null then
    raise exception
      '0029 §5: não consegui ler a precisão de painel_fila_prompts.custo_usd no catálogo — sem ela não há como amarrar a faixa de sanidade à coluna.'
      using errcode = 'check_violation';
  end if;

  v_cabe     := power(10::numeric, v_precisao - v_escala) - power(10::numeric, -v_escala);
  v_sanidade := public.painel_custo_maximo_por_item();

  if v_sanidade > v_cabe then
    raise exception
      '0029 §5: a faixa de sanidade por item (%) passou do que painel_fila_prompts.custo_usd numeric(%,%) guarda (máximo %) — fechar um item com o número aceito devolveria "numeric field overflow" cru em vez da recusa em português. Baixe painel_custo_maximo_por_item() ou aumente a precisão da coluna NA MESMA migration.',
      v_sanidade, v_precisao, v_escala, v_cabe using errcode = 'check_violation';
  end if;

  raise notice '0029 §5: faixa de sanidade % cabe em numeric(%,%) (máximo %).',
    v_sanidade, v_precisao, v_escala, v_cabe;
end $$;

-- ── 6 · fila_prompts_pegar_interno — fonte única de contas + headroom > 0 ──
-- Texto da 0027 §1, com DOIS pontos mudados: a lista de contas passa a sair de
-- `painel_contas_da_casa()` e a condição de elegibilidade ganha a parede
-- `v_headroom > 0`. Tudo o mais (D32c, BAIXO 4/5, D37, a trava de
-- serialização por conta) é o mesmo texto, verbatim.
create or replace function public.fila_prompts_pegar_interno(p_conta text, p_worker_id text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_teto            numeric;
  v_medido          numeric;
  v_execucao        numeric;
  v_headroom        numeric;
  v_estimativa      numeric;
  v_estimativa_n    integer;
  v_devolvidos      integer := 0;
  v_mortos          integer := 0;
  v_mortos_usd      numeric := 0;
  v_pulados         integer := 0;
  v_em_espera       integer := 0;
  v_devolvidos_ids  uuid[] := '{}'::uuid[];
  v_mortos_ids      uuid[] := '{}'::uuid[];
  v_menor_fila      numeric;
  v_menor_agora     numeric;
  v_menor_espera    numeric;
  v_espera_min      integer;
  v_custo_escolhido numeric;
  v_elegiveis       integer := 0;
  v_travados        integer := 0;
  v_escolhido       uuid;
  v_row             public.painel_fila_prompts%rowtype;
  v_motivo          text;
  v_defasagem       numeric;
  v_exigir          boolean := false;
  v_morto           record;
  v_caixa_morte     jsonb;
begin
  if p_conta is null
     or not (p_conta = any (public.painel_contas_da_casa()))
  then
    raise exception 'conta precisa ser uma das % contas da casa: %',
      coalesce(array_length(public.painel_contas_da_casa(), 1), 0),
      array_to_string(public.painel_contas_da_casa(), ', ')
      using errcode = 'check_violation';
  end if;
  if p_worker_id is null or length(btrim(p_worker_id)) = 0 then
    raise exception 'worker_id é obrigatório (use o id desta sessão: get_session sem argumento → session_id).'
      using errcode = 'check_violation';
  end if;

  perform 1 from public.painel_teto_diario where conta = p_conta for update;

  select teto_usd, coalesce(exigir_medicao_recente, false)
    into v_teto, v_exigir
    from public.painel_teto_diario where conta = p_conta;
  -- BAIXO 4 (rodada 8): sem teto DECLARADO não se inventa teto.
  if v_teto is null then
    raise exception 'A conta % não tem teto diário declarado no painel — declare o teto em painel_teto_diario antes de pegar item.',
      p_conta using errcode = 'check_violation';
  end if;

  v_defasagem := public.painel_fila_defasagem_horas(p_conta);

  -- D32c (rodada 7): a recusa vem ANTES de qualquer escrita.
  if v_exigir and (v_defasagem is null or v_defasagem > 12) then
    v_medido   := greatest(public.painel_fila_consumo_hoje(p_conta), 0);
    v_execucao := public.painel_fila_reservado(p_conta);
    return jsonb_build_object(
      'ok', true, 'item', null,
      'devolvidos', 0, 'mortos', 0, 'pulados', 0, 'travados', 0,
      'mortos_usd', 0,
      'em_espera', public.painel_fila_em_espera(p_conta),
      'headroom_usd', round(greatest(v_teto - v_medido - v_execucao, 0), 2),
      'menor_custo_fila', null, 'menor_custo_elegivel_agora', null,
      'estimativa_usd', round(public.painel_fila_estimativa_usd(p_conta), 2),
      'estimativa_itens', public.painel_fila_estimativa_itens(p_conta),
      'recusado_por_medicao', true,
      'defasagem_horas', v_defasagem,
      'motivo', public.painel_fila_motivo_do_pull(
        p_mortos => 0, p_mortos_usd => 0,
        p_custo_escolhido => null, p_headroom => 0,
        p_menor_disponivel => null, p_elegiveis => 0,
        p_em_espera => 0, p_menor_espera => null, p_espera_min => null,
        p_devolvidos => 0, p_travados => 0,
        p_estimativa_usd => 0, p_estimativa_itens => 0,
        p_defasagem_horas => v_defasagem, p_exigir_medicao => true)
    );
  end if;

  -- D2 + D19 + D26, inalterados.
  with alvo as (
    select f.id, f.tentativas, f.max_tentativas
    from public.painel_fila_prompts f
    where f.conta = p_conta
      and f.estado = 'pega'
      and coalesce(f.heartbeat_em, f.pego_em) < now() - interval '45 minutes'
  ),
  dev as (
    update public.painel_fila_prompts f
       set estado = 'na_fila', worker_id = null, pego_em = null, heartbeat_em = null,
           ultimo_worker_id = coalesce(f.worker_id, f.ultimo_worker_id),
           disponivel_em = now() + (interval '15 minutes' * greatest(f.tentativas, 1))
      from alvo a
     where f.id = a.id and a.tentativas < a.max_tentativas
    returning f.id
  ),
  mor as (
    update public.painel_fila_prompts f
       set estado = 'falhou',
           ultimo_worker_id = coalesce(f.worker_id, f.ultimo_worker_id),
           worker_id = null,
           heartbeat_em = null,
           motivo_falha = format('expirou %s vezes sem fechamento', f.tentativas),
           custo_usd = least(f.custo_estimado_usd, public.painel_custo_maximo_por_item()),
           custo_e_estimativa = true,
           custo_origem = 'estimativa',
           concluido_em = now()
      from alvo a
     where f.id = a.id and a.tentativas >= a.max_tentativas
    returning f.id, f.conta, f.session_id, f.custo_usd
  )
  select
    coalesce((select array_agg(d.id) from dev d), '{}'::uuid[]),
    (select count(*) from dev),
    (select count(*) from mor),
    coalesce((select sum(m.custo_usd) from mor m), 0),
    coalesce((select array_agg(m.id) from mor m), '{}'::uuid[])
  into v_devolvidos_ids, v_devolvidos, v_mortos, v_mortos_usd, v_mortos_ids;

  -- D37 (rodada 9): a estimativa do item que MORREU entra no livro-razão, no
  -- dia em que ele morreu. Quando o último dono voltar com o número real, o
  -- fechamento estorna ESTE lançamento e grava o novo — no dia de LÁ, não
  -- reescrevendo o dia de cá (ALTO 1).
  --
  -- CRÍTICO 1 (rodada 12): a estimativa NÃO derruba medição (posto 10 contra
  -- 30/40, §6). Quando ela é recusada, o dia não se mexe — e a FRASE do pull
  -- também não pode dizer que lançou. `v_mortos_usd` passa a ser o que o livro
  -- ACEITOU, não o que a casa tentou: era essa a linha que escrevia "lançou
  -- US$ 50,00 no dia" sobre um dia que continuou valendo 480.
  if v_mortos > 0 then
    v_mortos_usd := 0;
    for v_morto in
      select f.id, f.conta, f.session_id, f.custo_usd
        from public.painel_fila_prompts f
       where f.id = any (v_mortos_ids)
    loop
      v_caixa_morte := public.painel_caixa_lancar_item(
        v_morto.id, v_morto.custo_usd, 'estimativa', null,
        'estimativa da casa: item morreu sem fechar');
      if coalesce((v_caixa_morte->>'movimentou')::boolean, false) then
        v_mortos_usd := v_mortos_usd + coalesce((v_caixa_morte->>'delta_usd')::numeric, 0);
      end if;
    end loop;
    v_mortos_usd := greatest(v_mortos_usd, 0);
  end if;

  -- CRÍTICO 1 (rodada 13) · SEGUNDA PAREDE. A primeira é D54, no livro: nenhum
  -- dia soma negativo porque nenhum estorno tira de hoje mais do que hoje tem.
  -- Esta linha é a que vale mesmo se um dia negativo chegar por outro caminho
  -- (dado antigo, escrita fora da porta): o número que DESPACHA nunca lê gasto
  -- negativo. Antes, `greatest(...)` existia só nos campos RELATADOS — a
  -- condição `f.custo_estimado_usd <= v_headroom` usava o valor cru, e um dia
  -- de −360 devolvia 860 de espaço num teto de 500.
  v_medido       := greatest(public.painel_fila_consumo_hoje(p_conta), 0);
  v_execucao     := public.painel_fila_reservado(p_conta);
  v_headroom     := v_teto - v_medido - v_execucao;
  v_em_espera    := public.painel_fila_em_espera(p_conta);
  v_estimativa   := public.painel_fila_estimativa_usd(p_conta);
  v_estimativa_n := public.painel_fila_estimativa_itens(p_conta);

  select f.id into v_escolhido
    from public.painel_fila_prompts f
   where f.conta = p_conta
     and f.estado = 'na_fila'
     and f.id <> all (v_devolvidos_ids)
     and (f.disponivel_em is null or f.disponivel_em <= now())
     -- CRÍTICO 5 (rodada 14) · A SEGUNDA PAREDE DA ESTIMATIVA ZERO.
     -- `custo_estimado_usd <= v_headroom` sozinho deixa `0 <= 0` passar: um
     -- item de custo declarado ZERO atravessava um dia SEM espaço nenhum, e
     -- `painel_fila_reservado` somava zero, então despachar não consumia
     -- headroom. Medido pelo crítico: 6 sessões em voo, reserva US$ 0,
     -- headroom anunciando US$ 499. Dia sem espaço não despacha nada.
     and v_headroom > 0
     and f.custo_estimado_usd <= v_headroom
   order by f.criado_em, f.id
   limit 1
     for update skip locked;

  select
    count(*) filter (where v_headroom <= 0 or f.custo_estimado_usd > v_headroom)::int,
    count(*) filter (where v_headroom > 0 and f.custo_estimado_usd <= v_headroom)::int,
    min(f.custo_estimado_usd)
    into v_pulados, v_elegiveis, v_menor_agora
    from public.painel_fila_prompts f
   where f.conta = p_conta
     and f.estado = 'na_fila'
     and f.id <> all (v_devolvidos_ids)
     and (f.disponivel_em is null or f.disponivel_em <= now());

  select min(f.custo_estimado_usd)
    into v_menor_fila
    from public.painel_fila_prompts f
   where f.conta = p_conta and f.estado = 'na_fila';

  select
    min(f.custo_estimado_usd),
    greatest(1, ceil(extract(epoch from (min(f.disponivel_em) - now())) / 60.0))::int
    into v_menor_espera, v_espera_min
    from public.painel_fila_prompts f
   where f.conta = p_conta
     and f.estado = 'na_fila'
     and f.disponivel_em is not null
     and f.disponivel_em > now();

  if v_escolhido is null and v_elegiveis > 0 then
    v_travados := v_elegiveis;
  end if;

  if v_escolhido is not null then
    select f.custo_estimado_usd into v_custo_escolhido
      from public.painel_fila_prompts f where f.id = v_escolhido;
  end if;

  v_motivo := public.painel_fila_motivo_do_pull(
    p_mortos           => v_mortos,
    p_mortos_usd       => v_mortos_usd,
    p_custo_escolhido  => v_custo_escolhido,
    p_headroom         => v_headroom,
    p_menor_disponivel => v_menor_agora,
    p_elegiveis        => v_elegiveis,
    p_em_espera        => v_em_espera,
    p_menor_espera     => v_menor_espera,
    p_espera_min       => v_espera_min,
    p_devolvidos       => v_devolvidos,
    p_travados         => v_travados,
    p_estimativa_usd   => v_estimativa,
    p_estimativa_itens => v_estimativa_n,
    p_defasagem_horas  => v_defasagem,
    p_exigir_medicao   => false
  );

  if v_escolhido is null then
    return jsonb_build_object(
      'ok', true, 'item', null,
      'devolvidos', v_devolvidos, 'mortos', v_mortos, 'pulados', v_pulados,
      'travados', v_travados,
      'mortos_usd', round(v_mortos_usd, 2),
      'em_espera', v_em_espera,
      'headroom_usd', round(greatest(v_headroom, 0), 2),
      'menor_custo_fila', round(v_menor_fila, 2),
      'menor_custo_elegivel_agora', round(v_menor_agora, 2),
      'estimativa_usd', round(v_estimativa, 2), 'estimativa_itens', v_estimativa_n,
      'recusado_por_medicao', false,
      'defasagem_horas', v_defasagem,
      'motivo', v_motivo
    );
  end if;

  update public.painel_fila_prompts
     set estado = 'pega',
         worker_id = p_worker_id,
         ultimo_worker_id = p_worker_id,
         pego_em = now(),
         heartbeat_em = now(),
         disponivel_em = null,
         tentativas = tentativas + 1
   where id = v_escolhido
  returning * into v_row;

  return jsonb_build_object(
    'ok', true,
    'devolvidos', v_devolvidos, 'mortos', v_mortos, 'pulados', v_pulados,
    'travados', v_travados,
    'mortos_usd', round(v_mortos_usd, 2),
    'em_espera', v_em_espera,
    'headroom_usd', round(greatest(v_headroom, 0), 2),
    'menor_custo_fila', round(v_menor_fila, 2),
    'menor_custo_elegivel_agora', round(v_menor_agora, 2),
    'estimativa_usd', round(v_estimativa, 2), 'estimativa_itens', v_estimativa_n,
    'recusado_por_medicao', false,
    'defasagem_horas', v_defasagem,
    'motivo', v_motivo,
    'item', jsonb_build_object(
      'id', v_row.id, 'conta', v_row.conta, 'prompt', v_row.prompt,
      'complexidade', v_row.complexidade, 'modeloSugerido', v_row.modelo_sugerido,
      'criadoEm', v_row.criado_em, 'taskId', v_row.task_id,
      'workerId', v_row.worker_id, 'tentativas', v_row.tentativas,
      'maxTentativas', v_row.max_tentativas,
      'custoEstimadoUsd', v_row.custo_estimado_usd
    )
  );
end;
$$;comment on function public.fila_prompts_pegar_interno(text, text) is
  'CRÍTICO 5 + ALTO 6 (rodada 14): a lista de contas vem de painel_contas_da_casa() (era a 1ª de cinco cópias à mão) e a elegibilidade exige v_headroom > 0 — sem ela, item de estimativa ZERO atravessava um dia sem espaço nenhum (0 <= 0 é verdade) e não reservava nada. Mantém D32b/D32c, BAIXO 4/5, D37 e a trava de serialização por conta (for update em painel_teto_diario), que agora tem bloco próprio na suíte (T81).';
revoke all on function public.fila_prompts_pegar_interno(text, text) from public, anon, authenticated;

-- ── 7 · fila_prompts_fechar_interno — fonte única de contas ────────────────
-- É A PORTA DO ACHADO ALTO 6: a que REGISTRA o dinheiro, a que tinha cópia
-- própria da lista, e a única das três que nenhum bloco exercitava com a 4ª
-- conta. Texto da 0027 §2, com a lista trocada pela fonte única.
create or replace function public.fila_prompts_fechar_interno(
  p_id uuid, p_conta text, p_worker_id text, p_estado text,
  p_custo_usd numeric, p_session_id text default null,
  p_sessao_url text default null, p_resultado text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row         public.painel_fila_prompts%rowtype;
  v_sess        text;
  v_outro       uuid;
  v_dona        text;
  v_ultimo_dono boolean;
  v_reabrir     boolean;
  v_caixa       jsonb;
begin
  if p_id is null then
    raise exception 'id é obrigatório.' using errcode = 'check_violation';
  end if;
  if p_conta is null
     or not (p_conta = any (public.painel_contas_da_casa()))
  then
    raise exception 'conta precisa ser uma das % contas da casa: %',
      coalesce(array_length(public.painel_contas_da_casa(), 1), 0),
      array_to_string(public.painel_contas_da_casa(), ', ')
      using errcode = 'check_violation';
  end if;
  if p_worker_id is null or length(btrim(p_worker_id)) = 0 then
    raise exception 'worker_id é obrigatório (o mesmo usado no fila_prompts_pegar_interno).'
      using errcode = 'check_violation';
  end if;
  if p_estado is null or p_estado not in ('concluida','falhou') then
    raise exception 'estado de fechamento precisa ser concluida ou falhou.' using errcode = 'check_violation';
  end if;
  if p_custo_usd is null then
    raise exception 'custo_usd é obrigatório ao fechar (use 0 quando não houver custo).'
      using errcode = 'check_violation';
  end if;
  -- ALTO 2 (rodada 13): a faixa é de SANIDADE (ver §0), não o teto do dia. Uma
  -- sessão que custou mais que o teto PRECISA poder ser relatada: o buraco
  -- não se fecha recusando a medição, se fecha no pull, que não despacha nada
  -- novo enquanto o dia não couber.
  if p_custo_usd < 0 or p_custo_usd > public.painel_custo_maximo_por_item() then
    raise exception 'custo_usd fora da faixa de sanidade (0 a %): % — este limite não é o teto do dia; quem barra despacho é o pull',
      public.painel_custo_maximo_por_item(), p_custo_usd
      using errcode = 'check_violation';
  end if;

  v_sess := nullif(btrim(coalesce(p_session_id, '')), '');
  if v_sess is not null and v_sess = btrim(p_worker_id) then
    raise exception 'session_id é o id da sessão FILHA, não o da Routine' using errcode = 'check_violation';
  end if;

  select * into v_row from public.painel_fila_prompts
    where id = p_id and conta = p_conta for update;

  if not found then
    raise exception 'Item não encontrado ou não pertence à conta informada.'
      using errcode = 'check_violation';
  end if;

  -- D26 (rodada 6): a morte tira a posse VIVA para liberar a fila, não para
  -- proibir o único ator com o número honesto de entregá-lo.
  v_ultimo_dono := (
    v_row.worker_id is null
    and v_row.ultimo_worker_id is not null
    and v_row.ultimo_worker_id = btrim(p_worker_id)
  );
  v_reabrir := (v_row.estado = 'falhou' and v_ultimo_dono and v_row.custo_e_estimativa);

  if v_row.estado = 'na_fila' and v_row.worker_id is null then
    raise exception 'Item voltou para a fila (45 min sem sinal) — não pode ser fechado; ele será pego de novo.'
      using errcode = 'check_violation';
  end if;

  -- D1 · fencing: só quem pegou fecha (ou, por D26, quem tinha pegado).
  -- BAIXO 1 (rodada 8): a recusa nomeia quem PEGOU, sem cuspir UUID.
  if not v_ultimo_dono and v_row.worker_id is distinct from p_worker_id then
    raise exception 'Item pertence a outro worker (%).',
      coalesce(v_row.worker_id, v_row.ultimo_worker_id, 'ninguém pegou este item')
      using errcode = 'check_violation';
  end if;

  if v_sess is not null then
    select f.id into v_outro from public.painel_fila_prompts f
      where f.session_id = v_sess and f.id <> p_id limit 1;
    if v_outro is not null then
      raise exception 'sessão já vinculada ao item %', v_outro using errcode = 'check_violation';
    end if;
    -- D34a (rodada 8) mantida: a porta continua fechada para o caso em que a
    -- sessão JÁ está publicada. O caminho real — a sessão nascer depois — não
    -- depende mais desta guarda para nada: a conta do dinheiro é a do
    -- lançamento (D39), e ela não se remaneja.
    v_dona := public.painel_sessao_dona(v_sess);
    if v_dona is not null and v_dona <> v_row.conta then
      raise exception 'Esta sessão é da conta % — não dá para vinculá-la a um item da conta %.',
        v_dona, v_row.conta using errcode = 'check_violation';
    end if;
  end if;

  if v_reabrir then
    -- D26 + ALTO 1 (rodada 9): `concluido_em = now()` NÃO move mais dinheiro —
    -- o dia do dinheiro é o do lançamento, e o lançamento de ontem fica onde
    -- está. O que `concluido_em` governa é UMA coisa: a janela em que o
    -- operador ainda pode corrigir o número pela tela
    -- (`fila_prompts_ajustar_custo`, "só item fechado hoje"). Este item acabou
    -- de ser fechado AGORA, com o número real — e é hoje que ele é corrigível.
    update public.painel_fila_prompts
       set estado = p_estado,
           custo_usd = p_custo_usd,
           custo_e_estimativa = false,
           custo_origem = 'medido',
           session_id = coalesce(v_sess, session_id),
           sessao_url = coalesce(p_sessao_url, sessao_url),
           resultado = coalesce(p_resultado, resultado),
           motivo_falha = case when p_estado = 'falhou' then motivo_falha else null end,
           heartbeat_em = null,
           disponivel_em = null,
           concluido_em = now()
     where id = p_id
    returning * into v_row;

    -- D38 + D54 (rodada 13): o número real é lançado HOJE, e o estorno da
    -- estimativa é limitado ao que ela pôs em HOJE. Quando a morte foi ontem,
    -- ontem continua valendo o que foi relatado e hoje fica em zero — nunca
    -- negativo, nunca virando teto (era hoje = −117 com estimativa 120 e real 3).
    v_caixa := public.painel_caixa_lancar_item(
      v_row.id, p_custo_usd, 'medido', now(),
      'fechamento pelo último dono de item que tinha morrido sem fechar');

    return jsonb_build_object(
      'ok', true, 'ja_fechado', false, 'reaberto_e_fechado', true, 'estado', p_estado,
      'caixa', v_caixa
    );
  end if;

  -- D8 (rodada 3) · idempotência: a segunda chamada não lança nada.
  if v_row.estado in ('concluida','falhou') then
    return jsonb_build_object(
      'ok', true, 'ja_fechado', true, 'reaberto_e_fechado', false, 'estado', v_row.estado
    );
  end if;

  -- D12 (rodada 4): item cancelado pelo operador durante a execução — a
  -- medição real SUBSTITUI a estimativa, o estado continua `cancelada`.
  if v_row.estado = 'cancelada' then
    -- ALTO 2 (rodada 9): `concluido_em` NÃO anda. O item fechou quando foi
    -- cancelado; esta chamada só troca o NÚMERO. Mover `concluido_em` para
    -- agora reabriria a janela de escrita da tela sobre um item encerrado em
    -- outro dia — e era isso que fazia dinheiro entrar num dia encerrado.
    update public.painel_fila_prompts
       set custo_usd = p_custo_usd,
           custo_e_estimativa = false,
           custo_origem = 'medido',
           session_id = coalesce(v_sess, session_id),
           sessao_url = coalesce(p_sessao_url, sessao_url),
           resultado = coalesce(p_resultado, resultado),
           concluido_em = coalesce(concluido_em, now())
     where id = p_id
    returning * into v_row;

    v_caixa := public.painel_caixa_lancar_item(
      v_row.id, p_custo_usd, 'medido', now(),
      'medição real sobre item cancelado durante a execução');

    return jsonb_build_object(
      'ok', true, 'ja_fechado', false, 'reaberto_e_fechado', false, 'estado', 'cancelada',
      'caixa', v_caixa
    );
  end if;

  update public.painel_fila_prompts
     set estado = p_estado,
         custo_usd = p_custo_usd,
         custo_e_estimativa = false,
         custo_origem = 'medido',
         session_id = coalesce(v_sess, session_id),
         sessao_url = coalesce(p_sessao_url, sessao_url),
         resultado = coalesce(p_resultado, resultado),
         heartbeat_em = null,
         disponivel_em = null,
         concluido_em = now()
   where id = p_id
  returning * into v_row;

  v_caixa := public.painel_caixa_lancar_item(
    v_row.id, p_custo_usd, 'medido', now(),
    'fechamento normal');

  return jsonb_build_object(
    'ok', true, 'ja_fechado', false, 'reaberto_e_fechado', false, 'estado', p_estado,
    'caixa', v_caixa
  );
end;
$$;comment on function public.fila_prompts_fechar_interno(uuid, text, text, text, numeric, text, text, text) is
  'ALTO 6 (rodada 14): a lista de contas vem de painel_contas_da_casa(). Era a cópia que o crítico sabotou com uma vírgula a menos: o worker gastou US$ 430, o fechamento recusou "conta precisa ser uma das 3 contas da casa", o livro do dia ficou em ZERO e o item morreu valendo a estimativa (120) — US$ 310 de teto falso, com os cinco portões verdes. Quem cobre agora: T83 (a 4ª conta atravessa TODAS as portas, o fechamento inclusive) e T82 (a fonte única × painel_teto_diario, nos dois sentidos).';
revoke all on function public.fila_prompts_fechar_interno(uuid, text, text, text, numeric, text, text, text) from public, anon, authenticated;

-- ── 7b · o LIMITE DE SESSÕES EM VOO — nasce aqui, antes do primeiro uso ─────
-- Estas três funções eram da 0030 (rodada 15). Vieram para cá porque a
-- escolha de conta (§8) e a listagem (§10) desta migration passaram a
-- chamá-las (P2 do Codex no PR #42: o roteamento conhece o limite de voo), e
-- uma função chamada tem de existir no instante em que a migration que a
-- chama termina — o runner aplica cada arquivo num `psql` próprio (P1 do
-- Codex, 6ª rodada). Texto e comentários são os da 0030, sem mudança.

-- (1c) O TETO DE SESSÕES EM VOO por conta — a parede que corresponde ao DANO.
-- QUATRO. É exatamente o que um teto de US$ 500 paga na complexidade mais cara
-- que a casa declara (`maxima` = US$ 120): `floor(500/120) = 4`. Ou seja: esta
-- parede não tira NADA que a parede de valor já permitia a preço cheio — ela
-- tira só a possibilidade de comprar concorrência declarando a estimativa
-- barata, que é o dano inteiro deste achado.
--
-- É REGRA NOVA DE PRODUTO, e é declarada como tal: o número não se deriva de
-- mais nada, mora aqui e só aqui. A guarda que o protege não é "ele nunca
-- muda" — o operador pode mudá-lo — é "ele nunca fica decorativo": §5 aborta a
-- migration se K itens no PISO já não couberem no menor teto declarado,
-- porque aí a parede de valor morderia primeiro e esta seria enfeite.
create or replace function public.painel_fila_maximo_em_voo_por_conta()
returns integer
language sql
immutable
set search_path = public, pg_temp
as $$
  select 4;
$$;
comment on function public.painel_fila_maximo_em_voo_por_conta() is
  'CRÍTICO (rodada 15): quantas sessões a MESMA conta pode ter em voo ao mesmo tempo — QUATRO. O dano do achado é de CONTAGEM, não de soma: a US$ 0,0001 por item, US$ 1 de espaço admite dez mil sessões simultâneas, e uma sessão real da casa custa da ordem de US$ 200 (12/09/2026: US$ 2.513,29 em 12 sessões). Quatro é o que um teto de US$ 500 paga na complexidade mais cara declarada (maxima = 120), então esta parede não tira nada que a de valor já permitia a preço cheio: tira só a compra de concorrência por estimativa barata. Regra de produto, número declarado; §5 da 0030 aborta se ele ficar decorativo diante do piso.';
revoke all on function public.painel_fila_maximo_em_voo_por_conta() from public, anon, authenticated;

-- (1d) A JANELA DE "EM VOO", que já existia escrita à mão em três lugares
-- (o laço de expiração do pull, `painel_fila_reservado` e agora a contagem).
-- Mesma disciplina do ALTO 6 da rodada 14: a lista estava em cinco lugares e
-- tirar a 4ª conta de UM deles passou pelos cinco portões. Aqui a janela passa
-- a sair de uma fonte só ANTES de ganhar o quarto consumidor.
create or replace function public.painel_fila_janela_em_voo()
returns interval
language sql
immutable
set search_path = public, pg_temp
as $$
  select interval '45 minutes';
$$;
comment on function public.painel_fila_janela_em_voo() is
  'D3 + BAIXO 6 (rodada 8), agora com fonte única (rodada 15): a janela em que um item pego ainda conta como EM EXECUÇÃO — 45 minutos de heartbeat. Estava escrita à mão no laço de expiração do pull, em painel_fila_reservado e ia ganhar uma terceira cópia na contagem de sessões em voo; é a mesma classe de defeito do ALTO 6 (a lista de contas em cinco lugares).';
revoke all on function public.painel_fila_janela_em_voo() from public, anon, authenticated;

-- (1e) A CONTAGEM de sessões em voo — uma definição só, a MESMA de
-- `painel_fila_reservado` (item `pega` com heartbeat vivo). O pull a usa para
-- decidir e o painel a usa para contar a verdade ao lado do headroom.
create or replace function public.painel_fila_em_voo(p_conta text)
returns integer
language sql
stable
set search_path = public, pg_temp
as $$
  select count(*)::integer
  from public.painel_fila_prompts f
  where f.conta = p_conta
    and f.estado = 'pega'
    and coalesce(f.heartbeat_em, f.pego_em) >= now() - public.painel_fila_janela_em_voo();
$$;
comment on function public.painel_fila_em_voo(text) is
  'CRÍTICO (rodada 15): quantas sessões desta conta estão EM VOO agora — mesma definição de painel_fila_reservado (estado pega com heartbeat dentro de painel_fila_janela_em_voo), para que o número que o pull usa para decidir e o número que o painel mostra sejam o mesmo. O headroom anunciado sem esta contagem ao lado era a mentira do painel: US$ 1,00 livres com 40 sessões gastando dinheiro naquele instante.';
revoke all on function public.painel_fila_em_voo(text) from public, anon, authenticated;

-- ── 8 · fila_prompts_enfileirar — fonte única de contas E de ordem ─────────
-- Texto da 0027 §8, com a lista de contas e a ORDEM DE DESEMPATE (que era a
-- sexta cópia, `case … when … then N … else 9`) saindo as duas de
-- `painel_contas_da_casa()` via `array_position`. Conta fora da lista continua
-- indo para o fim do desempate: `array_position` devolve NULL e `order by`
-- ordena NULL por último.
create or replace function public.fila_prompts_enfileirar(p_secret text, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_expected       text;
  v_prompt         text;
  v_complexidade   text;
  v_modelo         text;
  v_conta          text;
  v_criado_por     text;
  v_task_id        uuid;
  v_id             uuid;
  v_estimado       numeric;
  v_headroom       numeric;
  v_espaco         numeric;
  v_na_fila        numeric;
  v_itens_frente   integer;
  v_codigo         text;
  v_cabe_hoje      boolean;
  v_consumos       jsonb;
  v_escolha        jsonb;
begin
  select valor into v_expected from private.lifeboard_config where chave = 'load_secret';
  if v_expected is null then
    raise exception
      'fila_prompts_enfileirar: segredo não configurado — inserir a chave load_secret em private.lifeboard_config (ver DEPLOY.md)'
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
    raise exception 'O prompt não pode ficar vazio.' using errcode = 'check_violation';
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
    when 'baixa' then 'Haiku' when 'media' then 'Sonnet'
    when 'alta' then 'Opus'  when 'maxima' then 'Fable' end;

  select usd into v_estimado from public.painel_custo_estimado where complexidade = v_complexidade;
  if v_estimado is null then v_estimado := 15; end if;

  v_criado_por := nullif(p_payload->>'criado_por', '');
  v_task_id := nullif(p_payload->>'task_id', '')::uuid;

  v_conta := nullif(p_payload->>'conta', '');
  if v_conta is not null
     and not (v_conta = any (public.painel_contas_da_casa()))
  then
    raise exception 'conta precisa ser uma das % contas da casa: %',
      coalesce(array_length(public.painel_contas_da_casa(), 1), 0),
      array_to_string(public.painel_contas_da_casa(), ', ')
      using errcode = 'check_violation';
  end if;

  -- D42: os números, na ORDEM DE `CONTAS` do TS (é ela que desempata).
  select jsonb_agg(linha order by ordem)
    into v_consumos
    from (
      select
        -- ALTO 6 (rodada 14): a ORDEM sai da mesma fonte da MEMBRESIA. Era uma
        -- quinta cópia da lista escrita à mão, com `else 9` para o resto.
        array_position(public.painel_contas_da_casa(), t.conta) as ordem,
        jsonb_build_object(
          'conta', t.conta,
          'teto_usd', t.teto_usd,
          'medido_usd', public.painel_fila_consumo_hoje(t.conta),
          'em_execucao_usd', public.painel_fila_reservado(t.conta),
          'na_fila_usd', public.painel_fila_na_fila(t.conta),
          'defasagem_horas', public.painel_fila_defasagem_horas(t.conta),
          'exige_medicao_recente', coalesce(t.exigir_medicao_recente, false),
          -- P2 do Codex (PR #42): o limite de voo entra na ESCOLHA, não só no
          -- pull. As duas funções nascem na 0030 (esta RPC só as chama em
          -- tempo de execução; as duas migrations se aplicam juntas).
          'em_voo', public.painel_fila_em_voo(t.conta),
          'limite_em_voo', public.painel_fila_maximo_em_voo_por_conta()
        ) as linha
      from public.painel_teto_diario t
    ) s;

  v_escolha := public.painel_fila_escolher_conta(coalesce(v_consumos, '[]'::jsonb), v_estimado);

  if v_conta is null then
    if (v_escolha->>'nunca_cabe')::boolean then
      raise exception
        'fila: uma tarefa % custa cerca de US$ % e nenhuma conta tem teto que a comporte (o maior é US$ %) — nunca vai caber.',
        v_complexidade, round(v_estimado, 2), v_escolha->>'maior_teto_usd'
        using errcode = 'check_violation';
    end if;
    if v_escolha->>'conta' is null then
      raise exception 'fila: nenhuma conta configurada em painel_teto_diario.'
        using errcode = 'check_violation';
    end if;
    v_conta := v_escolha->>'conta';
  end if;

  select
    t.teto_usd - public.painel_fila_consumo_hoje(t.conta) - public.painel_fila_reservado(t.conta),
    public.painel_fila_na_fila(t.conta)
    into v_headroom, v_na_fila
    from public.painel_teto_diario t where t.conta = v_conta;

  v_headroom := coalesce(v_headroom, 0);
  v_na_fila := coalesce(v_na_fila, 0);
  v_espaco := v_headroom - v_na_fila;
  -- D29 + D42: quando a conta veio do chooser, o veredito é o DELE (ele já
  -- conta a recusa por medição velha). Escolha manual usa a mesma aritmética.
  -- [P2 do Codex, rodada 10] A ESCOLHA MANUAL TAMBÉM PASSA PELA TRAVA DE
  -- MEDIÇÃO. A conta vinda do chooser já carregava a recusa por medição velha
  -- no `cabe_hoje` dele; a manual decidia só por espaço livre. Resultado: o
  -- enfileiramento respondia `manual_cabe` para uma conta que
  -- `fila_prompts_pegar_interno` iria RECUSAR categoricamente — e o cliente,
  -- que já checa a régua nova, dizia o contrário na mesma tela.
  v_cabe_hoje := case
    when nullif(p_payload->>'conta','') is null then (v_escolha->>'cabe_hoje')::boolean
    when public.painel_fila_recusaria_por_medicao(v_conta) then false
    else v_estimado <= v_espaco
  end;

  select count(*)::int into v_itens_frente
    from public.painel_fila_prompts f
    where f.conta = v_conta and f.estado = 'na_fila';

  v_codigo := case
    when nullif(p_payload->>'conta','') is null then
      case when v_cabe_hoje then 'auto_maior_espaco' else 'auto_nao_cabe_hoje' end
    else
      -- D51 (pós-merge, CodeRabbit): a recusa por MEDIÇÃO VELHA tem código
      -- próprio. `manual_nao_cabe_hoje` fala de espaço livre em português, e
      -- a tela explicava falta de dinheiro onde o problema é medição.
      case
        when v_cabe_hoje then 'manual_cabe'
        when public.painel_fila_recusaria_por_medicao(v_conta) then 'manual_medicao_velha'
        else 'manual_nao_cabe_hoje'
      end
  end;

  insert into public.painel_fila_prompts (conta, prompt, complexidade, modelo_sugerido, criado_por, task_id)
  values (v_conta, btrim(v_prompt), v_complexidade, v_modelo, v_criado_por, v_task_id)
  returning id into v_id;

  return jsonb_build_object(
    'ok', true, 'id', v_id, 'conta', v_conta, 'modelo_sugerido', v_modelo,
    'complexidade', v_complexidade,
    'motivo_codigo', v_codigo,
    'cabe_hoje', v_cabe_hoje,
    'headroom_usd', round(v_headroom, 2),
    'espaco_livre_usd', round(v_espaco, 2),
    'custo_estimado_usd', round(v_estimado, 2),
    'na_fila_usd', round(v_na_fila, 2),
    'itens_na_frente', v_itens_frente,
    'todas_recusadas', coalesce((v_escolha->>'todas_recusadas')::boolean, false),
    -- P2 do Codex (PR #42, 6ª rodada): só vale no roteamento automático — na
    -- escolha manual não houve disputa. O cliente troca o código da frase
    -- quando é maior que zero (mesmo padrão de `todas_recusadas`).
    'puladas_sem_vaga', case when nullif(p_payload->>'conta','') is null
                             then coalesce((v_escolha->>'puladas_sem_vaga')::integer, 0) else 0 end
  );
end;
$$;comment on function public.fila_prompts_enfileirar(text, jsonb) is
  'ALTO 6 (rodada 14): a lista de contas E a ordem de desempate vêm de painel_contas_da_casa() — eram a 3ª e a 6ª cópia da mesma lista escrita à mão. Todo o resto é o texto da 0027 §8.';
revoke all on function public.fila_prompts_enfileirar(text, jsonb) from public;
grant execute on function public.fila_prompts_enfileirar(text, jsonb) to anon, authenticated;

-- ── 9 · ALTO 1 · o esquema `private` também perde o execute público ────────
-- A varredura do T73 passa a partir do ESQUEMA, não de prefixo de nome, e
-- passa a incluir `private`. Lá dentro há duas funções que nasceram com
-- EXECUTE para PUBLIC (o default de `create function`). Elas não são
-- alcançáveis hoje — `private` não concede USAGE a anon/authenticated/public,
-- e o bloco T85 mede isso —, mas exceção com premissa é exceção que envelhece
-- mal: o `revoke` custa duas linhas e tira as duas da lista. As duas só são
-- chamadas de dentro de `lifeboard_mutate`, que é SECURITY DEFINER e roda como
-- dono, então o dono continua podendo chamá-las.
revoke all on function private.lifeboard_fonte_manual(uuid) from public, anon, authenticated;
revoke all on function private.lifeboard_exige_tarefa(uuid, uuid, text) from public, anon, authenticated;

-- ── 10 · fila_prompts_listar — a última cópia da lista (a ORDEM) ───────────
-- O bloco T82 varre `pg_proc.prosrc` e acusa qualquer função viva que crave
-- e-mail de conta no corpo. Ele apontou esta: `fila_prompts_listar` não checa
-- MEMBRESIA (ela lê `painel_teto_diario` inteiro), mas cravava a lista no
-- desempate. Texto da 0028 §2, com a ordem saindo da fonte única.
create or replace function public.fila_prompts_listar(
  p_secret text, p_limite integer default 50,
  p_antes_de timestamptz default null, p_antes_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_expected text;
  v_limite   integer;
  v_result   jsonb;
begin
  select valor into v_expected from private.lifeboard_config where chave = 'load_secret';
  if v_expected is null then
    raise exception
      'fila_prompts_listar: segredo não configurado — inserir a chave load_secret em private.lifeboard_config (ver DEPLOY.md)'
      using errcode = 'config_file_error';
  end if;
  if p_secret is null or p_secret <> v_expected then
    raise exception 'fila_prompts_listar: acesso negado' using errcode = 'insufficient_privilege';
  end if;

  v_limite := least(greatest(coalesce(p_limite, 50), 1), 200);

  with pagina as (
    select f.*
    from public.painel_fila_prompts f
    where p_antes_de is null
       or (f.criado_em, f.id) < (p_antes_de, coalesce(p_antes_id, '00000000-0000-0000-0000-000000000000'::uuid))
    order by f.criado_em desc, f.id desc
    limit v_limite + 1
  ),
  visivel as (
    select * from pagina order by criado_em desc, id desc limit v_limite
  ),
  -- A entidade canônica de cada item visível (D39: a sessão vinculada quando
  -- existe; senão o próprio item) e, dela, o lançamento ATIVO — não é estorno e
  -- ninguém o estornou, a MESMA definição que `painel_caixa_lancar` usa (D47).
  livro as (
    select
      v.id as item_id,
      a.origem       as livro_origem,
      coalesce(a.precedencia, public.painel_caixa_precedencia(a.origem)) as livro_precedencia,
      -- O VALOR do lançamento ativo, não a soma de todos os dias da entidade
      -- (CodeRabbit Major + Codex P2 no PR #42, 23/09). Desde a D54 os dois
      -- divergem quando a correção atravessa a virada do dia: estimativa de
      -- 120 ONTEM, medição real de 3 HOJE → o estorno fica limitado ao que a
      -- entidade pôs hoje (3), a soma da entidade continua 120, e a célula
      -- imprimia "US$ 120 · medido pela sessão (a casa estimava US$ 3)" — a
      -- medição e a estimativa trocadas. A 0028 §2 tem a mesma expressão
      -- antiga; esta função é a última palavra. Bloco que prova: T92.
      a.valor_usd as livro_liquido
    from visivel v
    left join lateral (
      select l.origem, l.precedencia, l.valor_usd
        from public.painel_caixa_lancamentos l
       where l.entidade_tipo = case when v.session_id is not null then 'sessao' else 'item' end
         and l.entidade_id   = case when v.session_id is not null then v.session_id else v.id::text end
         and l.origem <> 'estorno'
         and not exists (
               select 1 from public.painel_caixa_lancamentos e where e.estorna_id = l.id)
       order by l.criado_em desc, l.id desc
       limit 1
    ) a on true
  )
  select
    jsonb_build_object(
      'fila', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', v.id, 'conta', v.conta,
          'prompt', left(v.prompt, 300),
          'promptTamanho', length(v.prompt),
          'complexidade', v.complexidade,
          'modeloSugerido', v.modelo_sugerido, 'estado', v.estado, 'custoUsd', v.custo_usd,
          'custoEstimadoUsd', v.custo_estimado_usd,
          'custoEEstimativa', v.custo_e_estimativa,
          -- MÉDIO 4 (rodada 8): a tela precisa saber de ONDE veio o número
          -- para decidir se oferece o ajuste — e `custo_e_estimativa` sozinho
          -- não distingue "medido pela sessão" de "digitado pelo operador".
          'custoOrigem', v.custo_origem,
          -- MÉDIO 3 (rodada 13): e precisa saber o que o LIVRO diz, porque é o
          -- livro que o banco consulta para aceitar ou recusar.
          'livroOrigem', b.livro_origem,
          'livroPrecedencia', b.livro_precedencia,
          'livroLiquidoUsd', b.livro_liquido,
          'custoAjustadoEm', v.custo_ajustado_em,
          'criadoEm', v.criado_em, 'pegoEm', v.pego_em, 'concluidoEm', v.concluido_em,
          'disponivelEm', v.disponivel_em,
          'heartbeatEm', v.heartbeat_em, 'workerId', v.worker_id,
          'tentativas', v.tentativas, 'maxTentativas', v.max_tentativas,
          'sessionId', v.session_id, 'motivoFalha', v.motivo_falha,
          'sessaoUrl', v.sessao_url, 'resultado', v.resultado, 'criadoPor', v.criado_por,
          'taskId', v.task_id
        ) order by v.criado_em desc, v.id desc)
        from visivel v
        left join livro b on b.item_id = v.id
      ), '[]'::jsonb),
      'consumo', coalesce((
        select jsonb_agg(jsonb_build_object(
          'conta', t.conta, 'tetoUsd', t.teto_usd,
          'consumoHojeUsd', public.painel_fila_consumo_hoje(t.conta),
          'reservadoUsd', public.painel_fila_reservado(t.conta),
          'naFilaUsd', public.painel_fila_na_fila(t.conta),
          'estimativaUsd', public.painel_fila_estimativa_usd(t.conta),
          'estimativaItens', public.painel_fila_estimativa_itens(t.conta),
          'emEspera', public.painel_fila_em_espera(t.conta),
          'medidoAteEm', public.painel_fila_medido_ate(t.conta),
          'defasagemHoras', public.painel_fila_defasagem_horas(t.conta),
          'exigeMedicaoRecente', coalesce(t.exigir_medicao_recente, false),
          -- P2 do Codex (PR #42): o mesmo par que a escolha usa, para o
          -- roteador da tela não pôr o selo "escolhida agora" numa conta que
          -- está no limite de sessões em voo.
          'emVoo', public.painel_fila_em_voo(t.conta),
          'limiteEmVoo', public.painel_fila_maximo_em_voo_por_conta(),
          'historico', (
            select jsonb_build_object(
              'dias', h.dias, 'minUsd', h.min_usd,
              'maxUsd', h.max_usd, 'medianaUsd', h.mediana_usd)
            from public.painel_fila_historico_medido(t.conta) h
          )
        -- ALTO 6 (rodada 14): a ordem sai de `painel_contas_da_casa()`, a MESMA
        -- fonte da membresia. Era a última cópia da lista escrita à mão dentro
        -- de uma função viva, e o bloco T82 a acusou por nome. Conta fora da
        -- lista continua indo para o fim: `array_position` devolve NULL e
        -- `order by` ordena NULL por último, que é o que o `else 9` fazia.
        ) order by array_position(public.painel_contas_da_casa(), t.conta))
        from public.painel_teto_diario t
      ), '[]'::jsonb),
      'limite', v_limite,
      'temMais', (select count(*) from pagina) > v_limite,
      'proximoAntesDe', (select v.criado_em from visivel v order by v.criado_em asc, v.id asc limit 1),
      'proximoAntesId', (select v.id from visivel v order by v.criado_em asc, v.id asc limit 1)
    )
  into v_result;

  return v_result;
end;
$$;
comment on function public.fila_prompts_listar(text, integer, timestamptz, uuid) is
  'ALTO 6 (rodada 14): a ordem de desempate vem de painel_contas_da_casa() (era a última cópia da lista de contas escrita à mão dentro de função viva; o bloco T82 varre pg_proc.prosrc e a acusa por nome). Todo o resto é o texto da 0028 §2: além de custoOrigem (a coluna do ITEM), cada linha traz livroOrigem, livroPrecedencia e livroLiquidoUsd — a origem, o POSTO e o líquido do lançamento ATIVO da entidade canônica do item.';
revoke all on function public.fila_prompts_listar(text, integer, timestamptz, uuid) from public;
grant execute on function public.fila_prompts_listar(text, integer, timestamptz, uuid) to anon, authenticated;
