-- ════════════════════════════════════════════════════════════════════════════
-- 0027 · LIFEBOARD v3 · a ÚLTIMA PALAVRA da ordem, a PRECEDÊNCIA do dinheiro
--        e a QUARTA conta da casa
-- ════════════════════════════════════════════════════════════════════════════
--
-- POR QUE 0027 E NÃO 0026 (rodada 12). Produção aplicou, em 21/09/2026 12:32
-- UTC, uma migration `0026_lifeboard_v3_fila_quarta_conta_arborcactus` vinda de
-- uma branch irmã. Dois arquivos diferentes com o mesmo número quebram
-- qualquer reconciliação entre o repositório e o histórico do banco, então
-- este arquivo passa a ser o 0027. O conteúdo é o mesmo de antes MAIS as
-- correções da rodada 12 (§§5 a 8).
--
-- O QUE ACONTECEU (achado da rodada 11, conferido contra o histórico do banco).
-- As migrations 0022, 0023 e 0024 são VERSÕES ANTIGAS. Elas rodaram em
-- produção em 13/09/2026 — ANTES da 0019 (o livro-razão) — mas chegaram ao
-- repositório depois, recuperadas do histórico do banco, com números que as
-- põem no FIM da ordem de aplicação.
--
-- Em produção nada quebrou: lá a ordem REAL foi 0022/0023/0024 primeiro e
-- 0019/0025 depois, então a última palavra sempre foi a certa. Quem quebra é
-- quem segue o DEPLOY.md e aplica `0001` … `0025` em ordem num banco NOVO:
--
--   · `fila_prompts_pegar_interno`  — última definição: 0022. Sem o
--     lançamento no livro-razão do item que morre (D37), sem a recusa por
--     medição velha (D32c), sem a recusa de conta sem teto declarado, e com o
--     teto fantasma `v_teto := 150` de volta (BAIXO 4).
--   · `fila_prompts_fechar_interno` — última definição: 0023. **Fechar um
--     item não escreve no livro-razão**: o custo do item some do gasto do dia.
--   · `painel_fila_motivo_do_pull`  — a 0022/0024 RECRIARAM a sobrecarga de 13
--     argumentos que a 0016 tinha apagado de propósito. Com as duas vivas, a
--     chamada de 13 argumentos nomeados (é a que `supabase/tests/
--     fila_prompts.test.sql` faz, blocos T13/T29) fica ambígua entre as duas.
--
-- O QUE ESTA MIGRATION FAZ. Redeclara, como última palavra da ordem, a versão
-- CORRETA das duas funções do dinheiro — o texto da 0019, verbatim — e apaga
-- de novo a sobrecarga de 13 argumentos. Nenhum arquivo é renumerado: os nomes
-- de 0022/0023/0024 já estão gravados no histórico do banco.
--
-- O QUE FOI PRESERVADO DAS 0022/0023/0024: nada delas é melhoria que a 0019
-- não tenha.
--   · 0022 "motivo puro": a frase já é função pura desde a 0015, e a 0016 a
--     ampliou (defasagem + recusa por medição). A 0019 chama a versão ampliada.
--   · 0023 "fechar pelo último dono" (D26): a 0019 tem o MESMO ramo
--     `v_reabrir`, e ainda estorna a estimativa do dia da morte (D38), grava
--     `custo_origem`, checa a conta dona da sessão (D34a) e tirou o UUID cru
--     das recusas (BAIXO 1). A 0023 é a versão anterior a tudo isso.
--   · 0024 "motivo em texto literal": o `::text` que ela acrescenta JÁ EXISTE
--     na versão de 15 argumentos da 0016, linha a linha. A 0024 conserta a
--     cópia de 13 argumentos que não deveria existir.
--
-- Re-aplicável: tudo é `create or replace` / `drop … if exists` / `alter …`.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 0 · ALTO 2 (rodada 13) · O LIMITE POR ITEM DEIXA DE SER O TETO DO DIA ──
-- O limite `0 a 500` por item nasceu na 0009, quando o teto do dia era 150:
-- um item nunca chegava perto. A decisão de 14/09/2026 subiu o teto para 500 e
-- ninguém revisitou o limite por item — os dois números viraram o mesmo, e a
-- porta de FECHAMENTO passou a RECUSAR a medição real.
--
-- O crítico mediu o desfecho: item com estimativa de 120 que custou 620 de
-- verdade. `fila_prompts_fechar_interno(620)` levantava exceção, o item morria
-- em 45 min valendo a ESTIMATIVA (120) no livro, e o pull lia 380 de headroom
-- livres que não existiam. US$ 620 reais viravam US$ 120 no livro e abriam
-- US$ 380 de teto falso. Pelas palavras da §6 desta mesma migration: "num
-- teto, errar para baixo é buraco".
--
-- A REGRA, agora: a porta que REGISTRA o que já aconteceu aceita o número
-- real e o lança. Quem recusa é o PULL — ele não despacha item novo enquanto
-- o dia não couber (`custo_estimado_usd <= v_headroom`, com o headroom
-- descontando medido e execução). Recusar a MEDIÇÃO é o que fabrica o buraco;
-- recusar o DESPACHO é o que fecha a torneira. São coisas diferentes e agora
-- têm números diferentes.
--
-- O que sobra aqui é SANIDADE, não orçamento: um número que não se confunde
-- com teto nenhum e que existe só para barrar dedo escorregado e valor
-- absurdo (10^9 digitado na tela, unidade trocada). Ele é DERIVADO de um
-- lugar só — esta função — em vez de copiado em quatro pontos, que foi
-- exatamente como o 500 se espalhou.
create or replace function public.painel_custo_maximo_por_item()
returns numeric
language sql
immutable
set search_path = public, pg_temp
as $$
  select 100000::numeric;
$$;
comment on function public.painel_custo_maximo_por_item() is
  'ALTO 2 (rodada 13): teto de SANIDADE por item (US$ 100.000), não teto de orçamento. O teto do dia vive em painel_teto_diario e quem o aplica é o PULL (fila_prompts_pegar_interno); as portas que REGISTRAM custo já gasto (fila_prompts_fechar_interno, fila_prompts_ajustar_custo) aceitam o número real, porque recusar a medição não economiza dinheiro — apenas lança a estimativa no lugar dela e abre teto falso. Este número existe só para barrar valor absurdo (unidade trocada, dedo escorregado).';
revoke all on function public.painel_custo_maximo_por_item() from public, anon, authenticated;

-- E a COLUNA junto: `painel_fila_prompts.custo_usd` tinha o mesmo `<= 500` da
-- 0009 (linha 116). Sem mexer nela, a porta aceitaria o número real e o
-- `update` seguinte estouraria a check — a recusa só mudaria de lugar. O
-- limite passa a sair da MESMA função das portas: um lugar só, e o banco
-- recusa `drop function` enquanto a constraint depender dela.
alter table public.painel_fila_prompts drop constraint if exists painel_fila_prompts_custo_usd_check;
alter table public.painel_fila_prompts
  add constraint painel_fila_prompts_custo_usd_check
  check (custo_usd is null
         or (custo_usd >= 0 and custo_usd <= public.painel_custo_maximo_por_item()));
comment on column public.painel_fila_prompts.custo_usd is
  'ALTO 2 (rodada 13): 0..painel_custo_maximo_por_item() — faixa de SANIDADE, não o teto do dia. Era 0..500 desde a 0009, quando o teto diário era 150; em 14/09 o teto virou 500 e os dois números se confundiram, fazendo a porta de fechamento RECUSAR a medição real de uma sessão cara (o item morria valendo a estimativa e o dia abria teto falso). O freio do orçamento é o pull, que não despacha com o dia estourado; negativo continua proibido, que era o achado CRÍTICO #3 da 0009.';

-- ── 1 · fila_prompts_pegar_interno — o texto da 0019 §17, verbatim ─────────
-- D32c (recusa por medição velha antes de qualquer escrita) · BAIXO 4 (sem
-- teto declarado recusa, não inventa 150) · BAIXO 5 (headroom nunca negativo)
-- · D37 (o item que morre LANÇA a estimativa da casa no livro-razão).
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
     or p_conta not in ('lucasscudeler@gmail.com','lsgpandora@gmail.com','almapetra.ltda@gmail.com','arborcactus@gmail.com')
  then
    raise exception 'conta precisa ser uma das 4 contas da casa.' using errcode = 'check_violation';
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
     and f.custo_estimado_usd <= v_headroom
   order by f.criado_em, f.id
   limit 1
     for update skip locked;

  select
    count(*) filter (where f.custo_estimado_usd > v_headroom)::int,
    count(*) filter (where f.custo_estimado_usd <= v_headroom)::int,
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
$$;
comment on function public.fila_prompts_pegar_interno(text, text) is
  'D32b/D32c + BAIXO 4/5 (rodada 8) + D37 (rodada 9): o item que MORRE lança a estimativa da casa no livro-razão, no dia da morte. Mantém a recusa por medição velha antes de qualquer escrita, o headroom nunca negativo e a recusa sem teto declarado.';
revoke all on function public.fila_prompts_pegar_interno(text, text) from public, anon, authenticated;

-- ── 2 · fila_prompts_fechar_interno — o texto da 0019 §12, verbatim ────────
-- D37/D38: fechar LANÇA no livro-razão, hoje, sob a entidade canônica do item.
-- É a função que a 0023 tinha jogado para trás — e sem ela o custo de um item
-- fechado simplesmente não existe no gasto do dia.
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
     or p_conta not in ('lucasscudeler@gmail.com','lsgpandora@gmail.com','almapetra.ltda@gmail.com','arborcactus@gmail.com')
  then
    raise exception 'conta precisa ser uma das 4 contas da casa.' using errcode = 'check_violation';
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
$$;
comment on function public.fila_prompts_fechar_interno(uuid, text, text, text, numeric, text, text, text) is
  'D37/D38 (rodada 9): fechar LANÇA no livro-razão, no dia de hoje, sob a entidade canônica do item. O ramo reaberto estorna a estimativa do dia da morte e lança o número real HOJE — o dia da morte não é reescrito (ALTO 1). O ramo `cancelada` não move `concluido_em`: o item fechou quando foi cancelado (ALTO 2). Mantém D1/D8/D11/D12/D26/D34a e BAIXO 1.';
revoke all on function public.fila_prompts_fechar_interno(uuid, text, text, text, numeric, text, text, text) from public, anon, authenticated;

-- ── 3 · a sobrecarga de 13 argumentos do motivo sai de novo ────────────────
-- A 0016 apagou esta assinatura de propósito quando criou a de 15 argumentos
-- (com `p_defasagem_horas` e `p_exigir_medicao`, ambos com default). A 0022 e a
-- 0024 a recriaram. Com as duas vivas, uma chamada de 13 argumentos nomeados
-- casa com as duas — e é exatamente assim que `supabase/tests/
-- fila_prompts.test.sql` chama a função nos blocos T13 e T29.
-- Apagar a de 13 devolve a resolução para a de 15, que tem o MESMO texto para
-- esses casos (inclusive o `::text` que a 0024 foi acrescentar na cópia) mais
-- o ramo da defasagem. Nada no repositório chama a de 13 de propósito.
drop function if exists public.painel_fila_motivo_do_pull(
  integer, numeric, numeric, numeric, numeric, integer,
  integer, numeric, integer, integer, integer, numeric, integer);

-- ── 4 · M3 · o teto de 500 por conta vira migration (decisão de 14/09/2026) ─
-- Até aqui o número 500 só existia como PROSA no DEPLOY.md ("depois o
-- `alter … teto_usd set default 500`") — um passo manual que nenhum arquivo
-- confere e que some na primeira implantação feita com pressa. O schema
-- continuava com `default 150` (0007 §42) e a seed das três contas também.
--
-- A régua da casa `teto-de-gasto-diario` registrou a decisão do operador em
-- 14/09/2026: **500 por conta**. O motivo medido: nos 9 dias com dado em
-- `painel_consumo_por_conta_dia`, 9 de 9 ficaram acima de 150 (mediana ~2,6×
-- o teto; 12/09 deu US$ 2.513,29). Um teto que nenhum dia real respeita não é
-- freio — é um bloqueio total esperando a medição funcionar.
--
-- MÉDIO 5 (rodada 13): a régua dizia "500 por conta, nas TRÊS", e esta seed
-- semeia QUATRO (`arborcactus@gmail.com` já existia em produção com teto 500
-- desde a 0026 — ver §8). O orçamento despachável da casa é, portanto,
-- 4 × 500 = **US$ 2.000/dia**, não 1.500. O operador confirmou o número em
-- 22/09/2026 e a régua do hub foi atualizada no mesmo ato. Quem confere o
-- total daqui para a frente: o bloco T78 da suíte (soma a tabela no banco) e
-- `tests/unit/prompts-ultima-palavra-sql.test.ts` (soma a seed do arquivo) —
-- antes ninguém somava teto nenhum, e foi por isso que 1.500 virou 2.000 sem
-- uma linha de aviso.
--
-- O `update` só mexe em quem AINDA está no default antigo (150). Conta em que
-- o operador já escolheu outro número não é tocada — o valor do teto é decisão
-- dele, e esta migration só termina de aplicar a decisão que ele já tomou.
-- MÉDIO 3 (rodada 12): as DUAS travas de coluna que ainda listavam 3 contas.
-- Produção já as ampliou (migration irmã de 21/09); aqui a mesma ampliação
-- entra no repositório, para que um banco novo nasça igual ao vivo. Sem isto,
-- `arborcactus@gmail.com` não entra nem na tabela do teto nem na fila.
alter table public.painel_teto_diario drop constraint if exists painel_teto_diario_conta_check;
alter table public.painel_teto_diario add constraint painel_teto_diario_conta_check
  check (conta in ('lucasscudeler@gmail.com','lsgpandora@gmail.com','almapetra.ltda@gmail.com','arborcactus@gmail.com'));

alter table public.painel_fila_prompts drop constraint if exists painel_fila_prompts_conta_check;
alter table public.painel_fila_prompts add constraint painel_fila_prompts_conta_check
  check (conta in ('lucasscudeler@gmail.com','lsgpandora@gmail.com','almapetra.ltda@gmail.com','arborcactus@gmail.com'));

alter table public.painel_teto_diario alter column teto_usd set default 500;

update public.painel_teto_diario
   set teto_usd = 500
 where conta in ('lucasscudeler@gmail.com','lsgpandora@gmail.com','almapetra.ltda@gmail.com','arborcactus@gmail.com')
   and teto_usd = 150;

-- P1 do Codex (PR #42, 9ª rodada): a QUARTA conta nasce TRAVADA pela exigência
-- de medição recente. Com o default (`false`), a escolha automática via o
-- teto vazio de US$ 500 como o maior espaço da casa e mandava item para uma
-- conta que ainda não tem Routine configurada (o DEPLOY.md só instruía três)
-- — o item ficava na fila para sempre. Travada, ela não é autorizada até a
-- Routine dela publicar a primeira medição (menos de 12 h): aí destrava
-- sozinha, sem ninguém mexer nesta linha. Só quando a linha AINDA NÃO existe:
-- num banco onde ela já está, vale o que o operador decidiu. É o mesmo estado
-- que o fixture já mostra para ela (`exigeMedicaoRecente: true`). Vem ANTES da
-- semente das quatro, que então a pula pelo `on conflict`.
insert into public.painel_teto_diario (conta, teto_usd, exigir_medicao_recente)
select 'arborcactus@gmail.com', 500, true
 where not exists (select 1 from public.painel_teto_diario where conta = 'arborcactus@gmail.com');

insert into public.painel_teto_diario (conta, teto_usd) values
  ('lucasscudeler@gmail.com', 500),
  ('lsgpandora@gmail.com', 500),
  ('almapetra.ltda@gmail.com', 500),
  ('arborcactus@gmail.com', 500)
on conflict (conta) do nothing;

comment on column public.painel_teto_diario.teto_usd is
  'Teto diário de gasto por conta. 500 por decisão do operador em 14/09/2026 (regra da casa `teto-de-gasto-diario`), nas QUATRO contas — US$ 2.000/dia de orçamento despachável na casa inteira, confirmado pelo operador em 22/09/2026. Calibragem provisória, a reavaliar com 14 dias de dado real nas quatro contas. Antes: 150 × 3.';

-- ════════════════════════════════════════════════════════════════════════════
-- RODADA 12 · §5 a §8 — o dinheiro para de depender de quem escreve por último
-- ════════════════════════════════════════════════════════════════════════════
--
-- TRÊS ACHADOS, UMA CAUSA. `painel_caixa_lancar` gravava sempre: lia o líquido
-- da entidade, estornava e escrevia o número novo, sem olhar DE ONDE vinha o
-- número que já estava lá. Daí saíram, medidos contra um banco novo:
--
--  · CRÍTICO 1 — a ESTIMATIVA DA CASA apagava a MEDIÇÃO REAL. Item com sessão
--    vinculada que já publicou US$ 480 medidos; o worker morre; o pull seguinte
--    mata o item e lança a estimativa de US$ 50 sobre a mesma entidade. Livro:
--    +480 medido, −480 estorno, +50 estimativa. O dia passava a valer 50, o
--    headroom voltava para 450 e o pull despachava mais US$ 120 — US$ 600 reais
--    num teto de 500. O mesmo pela porta do operador (`fila_prompts_cancelar`).
--
--  · ALTO 1 — os MESMOS DOIS FATOS davam DOIS TOTAIS. Sessão publica 100 e o
--    item fecha com 20: na ordem (publica → fecha) o dia valia 20; na ordem
--    (fecha → publica) valia 100. O DEPLOY.md (D6/D10/D30) promete que "a
--    medição publicada prevalece"; quem prevalecia era a última escrita, e a
--    ordem depende do relógio de duas rotinas independentes.
--
--  · CRÍTICO 2 — TROCAR A SESSÃO VINCULADA contava o mesmo trabalho duas vezes.
--    `painel_caixa_lancar_item` só fundia a entidade órfã `item:<uuid>`. Quando
--    o item JÁ tinha sessão e passava a ter outra (`fila_prompts_ajustar_custo`
--    e `fila_prompts_fechar_interno` trocam com `coalesce(v_sess, session_id)`),
--    o dinheiro da sessão antiga ficava lá e ninguém o estornava: item morto
--    com estimativa 50 em `sess-ERRADA`, ajuste para 30 em `sess-CERTA` → o dia
--    fechava em 80, com a tela dizendo "o gasto de hoje já considera o número
--    real". É o modo de falha que o comentário da D39 declara morto.
--
-- A REGRA QUE ENTRA (D53 · PRECEDÊNCIA): todo lançamento carrega um POSTO, e
-- um lançamento de posto MENOR não derruba um de posto MAIOR — em qualquer
-- ordem de chegada. Os postos, de baixo para cima:
--
--     10  estimativa  — palpite da casa (item que morreu, item cancelado)
--     20  operador    — número que o operador digitou na tela
--     30  medido      — número que o WORKER relatou ao fechar o item
--     40  publicado   — número que a ROTINA da conta publicou para a sessão
--
-- Por que `publicado` acima de `medido`: é a promessa que o DEPLOY.md já fazia
-- por escrito ("a medição publicada prevalece", D6; "a medição publicada
-- SUBSTITUI a estimativa", D30) e nunca teve mecanismo. Com ela, ALTO 1 some
-- pela raiz — os dois sentidos dão 100 — sem depender de carimbo de tempo
-- nenhum (medir por `medido_em` não resolveria: para os dois lados o carimbo é,
-- na prática, a hora da escrita).
--
-- Posto IGUAL continua sendo "o mais novo manda": é assim que o operador
-- corrige a própria correção (120 → 3, MÉDIO 4 da rodada 9) e que uma sessão
-- republicada com número novo atualiza o dia.
--
-- Recusa NÃO é erro: `painel_caixa_lancar` devolve `movimentou=false` com
-- `recusado_por_precedencia=true` e diz qual posto está vigente. Quem chamou
-- segue o seu caminho — o item fecha, o cancelamento acontece — só o NÚMERO do
-- dia não regride.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 5 · D53 · o posto de cada lançamento ───────────────────────────────────
alter table public.painel_caixa_lancamentos
  add column if not exists precedencia smallint;

create or replace function public.painel_caixa_precedencia(p_origem text)
returns smallint
language sql
immutable
set search_path = public, pg_temp
as $$
  select case p_origem
    when 'estimativa' then 10::smallint
    when 'operador'   then 20::smallint
    when 'medido'     then 30::smallint
    else 10::smallint
  end;
$$;
comment on function public.painel_caixa_precedencia(text) is
  'D53 (rodada 12): o posto PADRÃO de uma origem — estimativa 10, operador 20, medido 30. A publicação da sessão (posto 40) é a única que pede o posto explicitamente, porque ela é `medido` com autoridade maior (DEPLOY.md D6/D30: "a medição publicada prevalece").';
revoke all on function public.painel_caixa_precedencia(text) from public, anon, authenticated;

-- As linhas que já existem recebem o posto da própria origem. Estorno herda o
-- posto do que ele anula (ele nunca é "o ativo", então o número só documenta).
--
-- P1 do Codex no PR #42 (23/09): este UPDATE era solto, e o livro é IMUTÁVEL
-- pelo gatilho `painel_caixa_lancamentos_imutavel` (0019) — qualquer UPDATE
-- dispara `check_violation`. No CI o livro está vazio, o UPDATE toca zero
-- linhas e o gatilho nunca dispara; em PRODUÇÃO, com lançamentos, a 0027
-- inteira abortava aqui (reproduzido: 0001…0025 + 1 lançamento → ERRO na
-- linha do UPDATE). Mesmo desvio da 0020 §4, pelos mesmos motivos: o gatilho
-- NÃO é desligado (o `disable trigger` falha com eventos pendentes e deixaria
-- o livro aberto se algo morresse no meio); só esta transação pula gatilhos
-- de usuário, e volta ao normal no fim ou no erro. A conferência logo abaixo
-- prova que nada ficou sem posto e que a trava continua de pé.
--
-- Duas passadas, não uma: numa passada única o estorno lia o posto do
-- original ANTES de ele ser preenchido (o UPDATE enxerga a foto de antes), e
-- todo estorno caía no 10 do coalesce, mesmo anulando uma medição 30.
do $$
declare
  v_postos   integer := 0;
  v_estornos integer := 0;
begin
  set local session_replication_role = replica;

  -- P1 do Codex (PR #42, 2ª rodada): medição PUBLICADA pela sessão tem
  -- posto 40, não 30. Sem isto, toda publicação que já está no livro virava
  -- 30 — o mesmo posto do fechamento do worker — e, como posto igual é "o
  -- mais novo manda", o próximo fechamento derrubava o número publicado.
  -- As linhas de publicação se reconhecem pela nota fixa que o gatilho
  -- `painel_frentes_sessoes_lancar` (0019) sempre gravou, e a abertura das
  -- SESSÕES (0019 §7, o primeiro insert) pela nota dela — as duas vêm de
  -- `painel_frentes_sessoes`, que é a publicação da rotina. A abertura dos
  -- ITENS (o segundo insert) também pode cair sob `sessao:<id>`, mas é o
  -- número que o item disse de si, com outra nota: fica no posto da origem.
  update public.painel_caixa_lancamentos l
     set precedencia = case
           when l.origem = 'medido'
            and l.nota in ('medição publicada pela sessão vinculada a um item da fila',
                           'medição publicada pela sessão',
                           'abertura da rodada 9 — mesmo dia que painel_consumo_por_conta_dia já atribuía')
             then 40::smallint
           else public.painel_caixa_precedencia(l.origem)
         end
   where l.precedencia is null
     and l.origem <> 'estorno';
  get diagnostics v_postos = row_count;

  update public.painel_caixa_lancamentos l
     set precedencia = coalesce(
           (select e.precedencia from public.painel_caixa_lancamentos e where e.id = l.estorna_id),
           public.painel_caixa_precedencia(l.origem))
   where l.precedencia is null
     and l.origem = 'estorno';
  get diagnostics v_estornos = row_count;

  set local session_replication_role = origin;
  raise notice '0027 §5: posto gravado em % lançamento(s) e % estorno(s)', v_postos, v_estornos;
exception when others then
  begin
    set local session_replication_role = origin;
  exception when others then
    null;
  end;
  raise;
end;
$$;

-- Conferência do desvio: nenhum lançamento sem posto, e a trava ATIVA.
do $$
begin
  if exists (select 1 from public.painel_caixa_lancamentos where precedencia is null) then
    raise exception '0027 §5: sobrou lançamento sem posto depois do preenchimento';
  end if;
  if not exists (
    select 1 from pg_trigger
     where tgrelid = 'public.painel_caixa_lancamentos'::regclass
       and tgname  = 'painel_caixa_lancamentos_imutavel'
       and tgenabled <> 'D'
  ) then
    raise exception '0027 §5: a trava de imutabilidade do livro não está ativa depois do preenchimento';
  end if;
end;
$$;

alter table public.painel_caixa_lancamentos
  alter column precedencia set default 10;

comment on column public.painel_caixa_lancamentos.precedencia is
  'D53 (rodada 12): 10 estimativa · 20 operador · 30 medido pelo worker · 40 medido publicado pela rotina da conta. Lançamento de posto MENOR não derruba um de posto MAIOR, em nenhuma ordem de chegada. Posto igual: o mais novo manda.';

-- ── 6 · D53 · painel_caixa_lancar ganha o posto e a trava ──────────────────
-- A assinatura de 9 argumentos SAI e a de 10 entra no lugar: com as duas
-- vivas, toda chamada de 9 argumentos ficaria ambígua (a de 10 tem default no
-- último). Nenhum chamador muda: todos passam 9 ou menos, posicionalmente.
drop function if exists public.painel_caixa_lancar(
  text, text, text, numeric, text, uuid, text, timestamptz, text);

create or replace function public.painel_caixa_lancar(
  p_entidade_tipo text,
  p_entidade_id   text,
  p_conta         text,
  p_alvo_usd      numeric,
  p_origem        text,
  p_item_id       uuid default null,
  p_sessao_id     text default null,
  p_medido_em     timestamptz default null,
  p_nota          text default null,
  p_precedencia   integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_liquido        numeric;
  v_conta          text;
  v_ultimo         uuid;
  v_item_atual     uuid;
  v_valor_atual    numeric;
  v_origem_atual   text;
  v_medido_atual   timestamptz;
  v_alvo           numeric;
  v_dia            date;
  v_estorno        uuid;
  v_novo           uuid;
  v_prec           smallint;
  v_prec_atual     smallint;
  v_hoje_ent       numeric;
  v_estornar       numeric;
  v_liquido_novo   numeric;
begin
  if p_entidade_tipo is null or p_entidade_id is null or btrim(p_entidade_id) = '' then
    raise exception 'painel_caixa_lancar: entidade é obrigatória.' using errcode = 'check_violation';
  end if;
  if p_origem is null or p_origem not in ('estimativa','medido','operador') then
    raise exception 'painel_caixa_lancar: origem precisa ser estimativa, medido ou operador (estorno é gravado por esta função, nunca pedido de fora).'
      using errcode = 'check_violation';
  end if;

  -- D40: "sem valor" e "valor zero" são a MESMA coisa — a ausência de medição.
  v_alvo := coalesce(p_alvo_usd, 0);

  -- D53 (rodada 12): o POSTO deste lançamento. Sem posto explícito vale o da
  -- origem; quem publica a sessão pede 40 (a autoridade que o DEPLOY.md já
  -- prometia em D6/D30) e a transferência de entidade pede 99.
  v_prec := coalesce(p_precedencia::smallint, public.painel_caixa_precedencia(p_origem));

  -- D42 (P1, CodeRabbit + Codex): SERIALIZA DE VERDADE. Antes daqui havia só o
  -- comentário dizendo que serializava. `painel_caixa_lancamentos_entidade` não
  -- é único (não pode ser: a entidade tem N linhas por construção) e
  -- `painel_caixa_abertura_unica` só vale para `abertura = true` — não há
  -- nenhuma linha para travar com `for update`. O lock consultivo de transação
  -- é a trava certa: vive até o fim da transação, não depende de linha
  -- existir, e duas entidades diferentes nunca se bloqueiam.
  perform pg_advisory_xact_lock(
    hashtextextended(p_entidade_tipo || ':' || p_entidade_id, 0));

  select coalesce(sum(l.valor_usd), 0)
    into v_liquido
    from public.painel_caixa_lancamentos l
   where l.entidade_tipo = p_entidade_tipo and l.entidade_id = p_entidade_id;

  -- D39: A CONTA É A DO PRIMEIRO LANÇAMENTO desta entidade, e estorno nenhum
  -- muda isso — por isso ela sai de uma leitura própria, pela ponta ANTIGA.
  select l.conta
    into v_conta
    from public.painel_caixa_lancamentos l
   where l.entidade_tipo = p_entidade_tipo and l.entidade_id = p_entidade_id
   order by l.criado_em asc, l.id asc
   limit 1;

  -- D47 (P2 do Codex, rodada 10): O LANÇAMENTO ATIVO, por DEFINIÇÃO e não por
  -- ordenação. Antes isto era `order by criado_em desc, id desc limit 1` — e
  -- numa correção o estorno e o lançamento novo entram na MESMA transação,
  -- com o mesmo `now()`. O desempate caía no uuid, que é aleatório em relação
  -- à ordem de inserção: a correção seguinte podia apontar `estorna_id` para o
  -- ESTORNO anterior em vez do valor vigente, quebrando a cadeia de auditoria
  -- que o extrato do livro expõe.
  -- Ativo = não é estorno, e ninguém o estornou. Por construção há no máximo
  -- um, e a leitura deixa de depender de relógio.
  select l.id, l.origem, l.medido_em,
         coalesce(l.precedencia, public.painel_caixa_precedencia(l.origem)),
         l.item_id, l.valor_usd
    into v_ultimo, v_origem_atual, v_medido_atual, v_prec_atual,
         v_item_atual, v_valor_atual
    from public.painel_caixa_lancamentos l
   where l.entidade_tipo = p_entidade_tipo and l.entidade_id = p_entidade_id
     and l.origem <> 'estorno'
     and not exists (
           select 1 from public.painel_caixa_lancamentos e where e.estorna_id = l.id)
   order by l.criado_em desc, l.id desc
   limit 1;

  -- D39 (ALTO 3): A CONTA É FIXADA NO LANÇAMENTO. O primeiro lançamento desta
  -- entidade decidiu de quem é o dinheiro; nenhuma publicação posterior
  -- remaneja.
  v_conta := coalesce(v_conta, p_conta);
  if v_conta is null then
    raise exception 'painel_caixa_lancar: conta é obrigatória no primeiro lançamento de uma entidade.'
      using errcode = 'check_violation';
  end if;

  -- D53 (rodada 12) · A TRAVA DE PRECEDÊNCIA — CRÍTICO 1 e ALTO 1.
  -- Um lançamento de posto MENOR não derruba o que está vigente. É o que
  -- impede a estimativa da casa (10) de apagar os US$ 480 que a sessão
  -- publicou (40), e o que faz a ordem de chegada entre a rotina que publica a
  -- sessão e o worker que fecha o item deixar de decidir o total do dia.
  -- Não é erro: quem chamou segue o seu caminho, só o NÚMERO não regride.
  if v_ultimo is not null and v_prec < v_prec_atual then
    return jsonb_build_object(
      'ok', true, 'movimentou', false, 'conta', v_conta,
      'liquido_usd', round(v_liquido, 2), 'dia', null,
      'recusado_por_precedencia', true,
      'origem_vigente', v_origem_atual,
      'precedencia_vigente', v_prec_atual,
      'origem', p_origem,
      'precedencia_pedida', v_prec,
      'alvo_recusado_usd', round(v_alvo, 2));
  end if;

  -- D43 (P1, Codex): valor igual NÃO é motivo suficiente para não gravar.
  -- Só há nada a fazer quando o valor E a proveniência já são os pedidos:
  --   · alvo zero e líquido zero — não existe medição de zero (D40), nada a
  --     atribuir, e gravar seria criar linha proibida (`valor_usd <> 0`);
  --   · ou a origem vigente é a mesma pedida, e quando ela é `medido` o
  --     `medido_em` já está carimbado.
  -- Fora disso, cai no caminho normal: estorno do líquido + lançamento novo,
  -- os dois no dia de HOJE. Com valor igual eles se anulam no total do dia — o
  -- dinheiro não se move, e a PROVENIÊNCIA passa a existir no livro.
  -- D50 (pós-merge, P1 do Codex): E O CARIMBO. `medido` com valor igual e
  -- origem igual só é não-lançamento quando o carimbo pedido NÃO é mais novo
  -- que o guardado. Vindo mais novo, cai no caminho normal: estorno + novo,
  -- os dois hoje, que se anulam no total do dia — o dinheiro não anda e o
  -- `medido_em` novo passa a existir. Sem `p_medido_em` explícito não há
  -- evidência de medição nova, e continua não-lançamento.
  -- P2 do Codex (PR #42, 14ª rodada): E O DONO. O `item_id` também é
  -- proveniência. A fusão de entidade pede que a sessão antiga fique com o que
  -- publicou, agora SEM o item (`p_item_id => null`) — e com valor e origem
  -- iguais isto era não-lançamento: o lançamento de A seguia com o `item_id`
  -- e a projeção do item somava A e B (T103). Trocar o dono grava estorno e
  -- relançamento, que se anulam no dia. Só quando o lançamento vigente vale o
  -- próprio alvo: com crédito de dias anteriores no líquido (D54) o par não se
  -- anularia, e ali o não-lançamento de antes continua valendo.
  if v_liquido = v_alvo
     and (
       v_alvo = 0
       or (v_origem_atual is not distinct from p_origem
           and (p_origem <> 'medido'
                or (v_medido_atual is not null
                    and (p_medido_em is null or p_medido_em <= v_medido_atual)))
           and (v_item_atual is not distinct from p_item_id
                or v_valor_atual is distinct from v_alvo))
     )
  then
    return jsonb_build_object(
      'ok', true, 'movimentou', false, 'conta', v_conta,
      'liquido_usd', round(v_liquido, 2), 'dia', null);
  end if;

  -- D37: o dia é SEMPRE o de hoje, no fuso do operador.
  v_dia := public.painel_dia_operador();

  -- ══ D54 (rodada 13) · CRÍTICO 1 — O ESTORNO NÃO TIRA DE HOJE MAIS DO QUE
  --    HOJE TEM. ESCOLHA DE DESENHO, e o porquê em uma linha: entre mexer no
  --    dia passado (a rodada 9 fechou isso de propósito) e deixar um crédito
  --    de um dia FECHADO virar teto de hoje, a casa escolhe NÃO DAR TETO —
  --    crédito sem dia onde caber simplesmente não vira teto.
  --
  -- O mecanismo. O estorno é limitado ao que ESTA entidade já pôs no dia de
  -- HOJE (mais o número novo). Consequências, todas medidas:
  --   · correção DENTRO do dia (o caso comum: estimativa de 120 lançada hoje,
  --     fechamento real de 3 hoje) — o estorno continua INTEIRO, o dia cai de
  --     120 para 3. Nada de crédito legítimo é jogado fora.
  --   · correção de um dia ANTERIOR (item morreu ontem e fecha hoje mais
  --     barato; rotina publica 400 ontem e recalcula 40 hoje) — o que ontem
  --     contou fica em ontem, e a contribuição de hoje é ZERO em vez de −117
  --     ou −360. O dia deixa de poder ficar negativo, e `headroom` deixa de
  --     nascer inflado (era 617 e 860 num teto de 500).
  -- O custo, dito em voz alta: o total HISTÓRICO da casa pode ficar ACIMA do
  -- gasto real, porque o dia fechado guarda um número que depois se provou
  -- menor. Num teto, errar para cima é freio; errar para baixo é buraco.
  select coalesce(sum(l.valor_usd), 0)
    into v_hoje_ent
    from public.painel_caixa_lancamentos l
   where l.entidade_tipo = p_entidade_tipo and l.entidade_id = p_entidade_id
     and l.dia = v_dia;

  v_estornar := v_liquido;
  if v_liquido > 0 then
    v_estornar := least(v_liquido, greatest(v_hoje_ent, 0) + v_alvo);
    -- P2 do Codex (PR #42, 8ª rodada): o estorno também não passa do valor
    -- do lançamento que ele REFERENCIA (`estorna_id = v_ultimo`). Com a D54 o
    -- líquido da entidade pode guardar crédito de dias anteriores, maior que
    -- o lançamento vigente: 100 anteontem, corrigido para 40 ontem (líquido
    -- 100, vigente 40), corrigido para 50 hoje gravava −50 apontando para os
    -- 40 — um livro imutável dizendo que anulou mais do que existia. Agora o
    -- estorno é −40 e o dia de hoje recebe +10, a diferença real entre o
    -- vigente e o número novo. O crédito antigo continua sem dia (D54).
    -- Bloco que prova: T98.
    if v_ultimo is not null then
      v_estornar := least(
        v_estornar,
        greatest((select l.valor_usd from public.painel_caixa_lancamentos l where l.id = v_ultimo), 0));
    end if;
  end if;
  v_liquido_novo := v_liquido - v_estornar + v_alvo;

  -- Crédito que não achou dia: nada a gravar hoje. Não é erro — é a recusa
  -- explícita de transformar em teto um dinheiro que já foi contado ontem.
  if v_estornar = 0 and v_alvo = 0 then
    return jsonb_build_object(
      'ok', true, 'movimentou', false, 'conta', v_conta,
      'liquido_usd', round(v_liquido, 2), 'dia', null,
      'credito_sem_dia', true,
      'credito_sem_dia_usd', round(v_liquido, 2));
  end if;

  -- D38: a correção é um ESTORNO DATADO do líquido anterior, seguido do
  -- lançamento novo.
  -- P2 do Codex (PR #42, 12ª rodada): o estorno HERDA o `item_id` do
  -- lançamento que ele anula. A fusão de entidade (`painel_caixa_lancar_item`)
  -- chama esta função com `p_item_id => null` para esvaziar a sessão antiga, e
  -- o estorno saía sem dono: a projeção por item somava o +50 da sessão A
  -- (pelo item_id) e o +30 da sessão B, mas não o −50 — o item valia 80 com o
  -- livro da conta dizendo 30, e a parcela estimada via duas entidades. Um
  -- estorno pertence a quem pertencia o que ele anula — INCLUSIVE quando o
  -- anulado não tinha dono (16ª rodada: a 1ª versão caía no `p_item_id` de
  -- quem chamou nesse caso, e o estorno da publicação PRÓPRIA da sessão B
  -- virava dinheiro do item que acabara de se vincular a ela). O `p_item_id`
  -- só vale quando não há lançamento anulado. Blocos: T102 e T105.
  if v_estornar <> 0 then
    insert into public.painel_caixa_lancamentos
      (dia, conta, valor_usd, origem, entidade_tipo, entidade_id, item_id, sessao_id, estorna_id, nota, precedencia)
    values
      (v_dia, v_conta, -v_estornar, 'estorno', p_entidade_tipo, p_entidade_id,
       case when v_ultimo is not null
            then (select l.item_id from public.painel_caixa_lancamentos l where l.id = v_ultimo)
            else p_item_id end,
       p_sessao_id, v_ultimo,
       coalesce(p_nota, 'estorno do líquido anterior desta entidade'),
       coalesce(v_prec_atual, v_prec))
    returning id into v_estorno;
  end if;

  if v_alvo <> 0 then
    insert into public.painel_caixa_lancamentos
      (dia, conta, valor_usd, origem, entidade_tipo, entidade_id, item_id, sessao_id, medido_em, nota, precedencia)
    values
      (v_dia, v_conta, v_alvo, p_origem, p_entidade_tipo, p_entidade_id,
       p_item_id, p_sessao_id,
       case when p_origem = 'medido' then coalesce(p_medido_em, now()) else null end,
       p_nota, v_prec)
    returning id into v_novo;
  end if;

  -- D54: `delta_usd` é o que ESTE lançamento moveu NO DIA DE HOJE — não a
  -- diferença contra o líquido da entidade, que pode estar em outro dia.
  return jsonb_build_object(
    'ok', true, 'movimentou', true, 'conta', v_conta, 'dia', v_dia,
    'liquido_anterior_usd', round(v_liquido, 2),
    'liquido_usd', round(v_liquido_novo, 2),
    'delta_usd', round(v_alvo - v_estornar, 2),
    'credito_sem_dia', v_estornar < v_liquido,
    'credito_sem_dia_usd', round(greatest(v_liquido - v_estornar, 0), 2),
    'origem_anterior', v_origem_atual, 'origem', p_origem,
    'recusado_por_precedencia', false,
    'precedencia_vigente', v_prec_atual, 'precedencia', v_prec,
    'estorno_id', v_estorno, 'lancamento_id', v_novo);
end;
$$;
comment on function public.painel_caixa_lancar(text, text, text, numeric, text, uuid, text, timestamptz, text, integer) is
  'D37/D38/D39/D40 + D42/D43/D47 + D50 + D53 (rodada 12): a única porta de escrita do caixa. D53: cada lançamento tem um POSTO (10 estimativa · 20 operador · 30 medido pelo worker · 40 publicado pela rotina da conta) e um lançamento de posto menor NÃO derruba um de posto maior — em nenhuma ordem de chegada. É o que impede a estimativa da casa de apagar a medição real (CRÍTICO 1) e o que faz os mesmos dois fatos darem o mesmo total nos dois sentidos (ALTO 1). Recusa devolve movimentou=false com recusado_por_precedencia=true, nunca exceção. D54 (rodada 13): o ESTORNO é limitado ao que a entidade já pôs no dia de HOJE — crédito que anula dinheiro de um dia FECHADO não vira teto de hoje, e por isso nenhum dia pode somar negativo.';
revoke all on function public.painel_caixa_lancar(text, text, text, numeric, text, uuid, text, timestamptz, text, integer) from public, anon, authenticated;

-- ── 7 · CRÍTICO 2 · a fusão de entidade deixa de ser só a órfã `item:` ─────
-- A versão da 0019 fundia UMA entidade: a órfã `item:<uuid>`. O caso que ela
-- não via é o que o crítico mediu: o item JÁ tinha sessão e passa a ter OUTRA.
-- `fila_prompts_ajustar_custo` e `fila_prompts_fechar_interno` trocam a sessão
-- com `session_id = coalesce(v_sess, session_id)` sem checar se já havia uma
-- diferente — e o dinheiro da antiga ficava lá, sem dono e sem estorno.
--
-- Agora a fusão olha o LIVRO, não um nome: toda entidade que guarda lançamento
-- DESTE item e não é a canônica é esvaziada. Com uma ressalva que é a própria
-- regra do livro: uma SESSÃO que publicou custo por si continua respondendo
-- pelo que ela publicou — o que sai de lá é só o que era do item. Esvaziar uma
-- sessão medida junto com o item subcontaria o dia, e num teto errar para
-- baixo é pior que errar para cima.
drop function if exists public.painel_caixa_lancar_item(uuid, numeric, text, timestamptz, text);

create or replace function public.painel_caixa_lancar_item(
  p_item        uuid,
  p_alvo_usd    numeric,
  p_origem      text,
  p_medido_em   timestamptz default null,
  p_nota        text default null,
  p_precedencia integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_f         record;
  v_ent_tipo  text;
  v_ent_id    text;
  v_antiga    record;
  v_liquido   numeric;
  v_alvo      numeric;
begin
  select f.id, f.conta, f.session_id into v_f
    from public.painel_fila_prompts f where f.id = p_item;
  if not found then
    raise exception 'painel_caixa_lancar_item: item % não existe.', p_item
      using errcode = 'check_violation';
  end if;

  -- D39: a entidade canônica é a sessão vinculada quando existe; senão o item.
  if v_f.session_id is not null then
    v_ent_tipo := 'sessao';
    v_ent_id   := v_f.session_id;
  else
    v_ent_tipo := 'item';
    v_ent_id   := p_item::text;
  end if;

  for v_antiga in
    select distinct l.entidade_tipo, l.entidade_id
      from public.painel_caixa_lancamentos l
     where l.item_id = p_item
       and not (l.entidade_tipo = v_ent_tipo and l.entidade_id = v_ent_id)
  loop
    select coalesce(sum(x.valor_usd), 0) into v_liquido
      from public.painel_caixa_lancamentos x
     where x.entidade_tipo = v_antiga.entidade_tipo
       and x.entidade_id = v_antiga.entidade_id;
    if v_liquido = 0 then
      continue;
    end if;

    -- P1 do Codex (PR #42, 3ª rodada): o que FICA com a sessão antiga é o que
    -- ela publicou e o LIVRO guardou (posto 40), não o valor de agora na
    -- tabela de origem. Publicação zerada ou apagada depois NÃO é medição (D40)
    -- — o gatilho de publicação preserva o último número de propósito —, mas
    -- esta fusão lia a origem, via 0 e estornava a medição inteira: reproduzido,
    -- sessão publicou 100, virou 0 na origem, o item fechou por outra sessão
    -- com 5 e o dia caiu de 100 para 5. Só na falta de publicação no livro a
    -- origem responde, como antes. Bloco que prova: T94.
    v_alvo := null;
    if v_antiga.entidade_tipo = 'sessao' then
      select l.valor_usd into v_alvo
        from public.painel_caixa_lancamentos l
       where l.entidade_tipo = 'sessao'
         and l.entidade_id = v_antiga.entidade_id
         and l.origem <> 'estorno'
         and l.precedencia >= 40
         and not exists (select 1 from public.painel_caixa_lancamentos e where e.estorna_id = l.id)
       order by l.criado_em desc, l.id desc
       limit 1;
      if v_alvo is null then
        select coalesce(s.custo_usd, 0) into v_alvo
          from public.painel_frentes_sessoes s where s.sessao_id = v_antiga.entidade_id;
      end if;
      v_alvo := coalesce(v_alvo, 0);
    else
      v_alvo := 0;
    end if;

    -- `p_item_id => null`: o que a sessão antiga guarda daqui em diante não é
    -- mais deste item. O ESTORNO do que era dele continua sendo dele — herda o
    -- `item_id` do lançamento anulado, em `painel_caixa_lancar` (T102).
    -- Posto: 40 quando o que fica é a medição publicada da própria sessão; 99
    -- quando é transferência pura (esvaziar não pode ser recusado por posto).
    perform public.painel_caixa_lancar(
      v_antiga.entidade_tipo, v_antiga.entidade_id, v_f.conta,
      v_alvo, 'medido', null,
      case when v_antiga.entidade_tipo = 'sessao' then v_antiga.entidade_id else null end,
      null,
      case when v_alvo > 0
           then 'o trabalho deste item mudou de entidade; esta sessão fica com o que ela mesma publicou'
           else 'fusão de entidade: o dinheiro deste item saiu daqui e foi para a entidade canônica dele'
      end,
      case when v_alvo > 0 then 40 else 99 end);
  end loop;

  return public.painel_caixa_lancar(
    v_ent_tipo, v_ent_id, v_f.conta, p_alvo_usd, p_origem,
    v_f.id, v_f.session_id, p_medido_em, p_nota, p_precedencia);
end;
$$;
comment on function public.painel_caixa_lancar_item(uuid, numeric, text, timestamptz, text, integer) is
  'D39 + CRÍTICO 2 (rodada 12): a porta de lançamento de um ITEM. Resolve a entidade canônica (a sessão vinculada quando existe) e ESVAZIA toda entidade que ainda guarde dinheiro deste item — não só a órfã `item:<uuid>` da 0019, mas também a sessão ANTERIOR quando o item passa a apontar para outra. Sessão que publicou custo por si fica com o que ela publicou; o resto vai a zero.';
revoke all on function public.painel_caixa_lancar_item(uuid, numeric, text, timestamptz, text, integer) from public, anon, authenticated;

-- ── 7a · a projeção por item lê o DONO GRAVADO em cada linha ────────────
-- P2 do Codex (PR #42, 15ª e 16ª rodadas). `painel_fila_itens_do_dia` (0019)
-- juntava por `item_id` MAIS um 2º ramo: linhas SEM dono da sessão que o item
-- tem AGORA. A 15ª rodada mostrou o item projetando −35 contra +5 da conta
-- depois de uma correção de ontem e uma troca de sessão; a 1ª resposta trocou
-- a régua inteira pela sessão vinculada agora — e a 16ª mostrou o custo: o
-- PASSADO mudava a cada troca de sessão (o item perdia o que A lançou ontem
-- com ele e herdava o que B lançou por conta própria).
-- A régua é o dono GRAVADO em cada linha (`item_id`). O livro é imutável,
-- então o dia de ontem nunca muda; e a conta de um dia fecha por construção:
-- o que os itens movem mais o que as linhas sem dono movem é o livro da conta.
-- O −35 da 15ª era isso, lido pela metade: o item cede a A os 40 que A
-- publicou (−40 do item, +40 de A sem dono) — o que faltava era o estorno
-- nunca trocar de dono (ver `painel_caixa_lancar`, T102 e T105).
create or replace function public.painel_fila_itens_do_dia(p_conta text, p_dia date)
returns table (id uuid, contribuicao numeric, e_estimativa boolean)
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select
    f.id,
    sum(l.valor_usd) as contribuicao,
    bool_or(l.origem = 'estimativa') as e_estimativa
  from public.painel_caixa_lancamentos l
  join public.painel_fila_prompts f
    on l.item_id = f.id
  where l.conta = p_conta and l.dia = p_dia
  group by f.id;
$$;
comment on function public.painel_fila_itens_do_dia(text, date) is
  'D41 (rodada 9) + P2 do Codex (PR #42, 15ª e 16ª rodadas): os itens que MOVERAM DINHEIRO naquele dia, pelo dono GRAVADO em cada linha do livro (item_id). Sem o ramo da 0019 que juntava linhas sem dono pela sessão vinculada AGORA: com ele, e com a régua de sessão vinculada que a 15ª rodada tentou, o passado mudava a cada troca de sessão. Itens + linhas sem dono = livro da conta, dia a dia (T105).';
revoke all on function public.painel_fila_itens_do_dia(text, date) from public, anon, authenticated;

-- ── 7b · a publicação da sessão pede o posto 40 ────────────────────────────
-- É a única chamada que declara posto: a rotina da conta é a autoridade sobre
-- o custo de uma sessão, e o DEPLOY.md (D6/D30) já dizia isso em prosa.
create or replace function public.painel_frentes_sessoes_lancar()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_item uuid;
begin
  if new.conta is null or new.sessao_id is null then
    return null;
  end if;
  -- D40 + D10/D30: sessão publicada SEM custo, ou com custo ZERO, não é
  -- medição — é a ausência dela. Ela não lança e, principalmente, NÃO ESTORNA
  -- o que o item já tinha lançado (21 das 215 sessões reais são assim).
  if new.custo_usd is null or new.custo_usd = 0 then
    return null;
  end if;

  select f.id into v_item from public.painel_fila_prompts f
    where f.session_id = new.sessao_id limit 1;

  if v_item is not null then
    perform public.painel_caixa_lancar_item(
      v_item, new.custo_usd, 'medido',
      coalesce(new.atualizado_em, new.criado_em, new.publicado_em, now()),
      'medição publicada pela sessão vinculada a um item da fila',
      40);
  else
    perform public.painel_caixa_lancar(
      'sessao', new.sessao_id, new.conta,
      new.custo_usd, 'medido',
      null, new.sessao_id,
      coalesce(new.atualizado_em, new.criado_em, new.publicado_em, now()),
      'medição publicada pela sessão',
      40);
  end if;

  return null;
end;
$$;
comment on function public.painel_frentes_sessoes_lancar() is
  'D37/D39 + D53 (rodada 12): toda publicação de custo de sessão entra no livro-razão NO INSTANTE em que acontece, sob a entidade canônica `sessao:<id>`, na conta do primeiro lançamento dela e com POSTO 40 — o mais alto. É por isso que a estimativa da casa não a apaga e que a ordem entre esta rotina e o fechamento do item deixou de decidir o total do dia.';
-- BAIXO 4 (rodada 13): função de GATILHO também perde o execute público. O
-- Postgres já recusa chamada direta a função que retorna `trigger`, então isto
-- não fecha buraco — fecha a EXCEÇÃO ao padrão, que é o que uma varredura de
-- permissão procura. As outras quatro estão na 0028 §3, porque nascem em
-- migrations anteriores a esta.
revoke all on function public.painel_frentes_sessoes_lancar() from public, anon, authenticated;

drop trigger if exists painel_frentes_sessoes_lancar_caixa on public.painel_frentes_sessoes;
create trigger painel_frentes_sessoes_lancar_caixa
  after insert or update of custo_usd, conta, atualizado_em on public.painel_frentes_sessoes
  for each row execute function public.painel_frentes_sessoes_lancar();

-- ── 8 · MÉDIO 3 · a QUARTA conta entra na fila ─────────────────────────────
-- Medido em produção em 21/09/2026: `painel_teto_diario` tem QUATRO contas —
-- `arborcactus@gmail.com` entre elas, com teto 500 —, e nenhuma das funções da
-- fila a citava. A conta tinha orçamento e não podia receber um item sequer.
-- A migration irmã que a criou (0026 em produção) só inseriu a linha do teto.
-- Aqui a lista cresce nas funções que a cravam: `fila_prompts_pegar_interno` e
-- `fila_prompts_fechar_interno` (§§1 e 2 acima) e `fila_prompts_enfileirar`,
-- redeclarada abaixo a partir do texto da 0025 com dois pontos mudados: a
-- lista de contas aceitas e a ordem de desempate (a 4ª entra como 4ª, na mesma
-- ordem de `CONTAS` do TS).
-- `fila_prompts_listar` não é redeclarada de propósito: ela lê `painel_teto_
-- diario` inteiro e o `else 9` do desempate já põe a conta nova por último —
-- a 4ª posição — sem citar e-mail nenhum.

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
     and v_conta not in ('lucasscudeler@gmail.com','lsgpandora@gmail.com','almapetra.ltda@gmail.com','arborcactus@gmail.com')
  then
    raise exception 'conta precisa ser uma das 4 contas da casa.' using errcode = 'check_violation';
  end if;

  -- D42: os números, na ORDEM DE `CONTAS` do TS (é ela que desempata).
  select jsonb_agg(linha order by ordem)
    into v_consumos
    from (
      select
        case t.conta
          when 'lucasscudeler@gmail.com' then 1
          when 'lsgpandora@gmail.com'    then 2
          when 'almapetra.ltda@gmail.com' then 3
          when 'arborcactus@gmail.com'   then 4
          else 9 end as ordem,
        jsonb_build_object(
          'conta', t.conta,
          'teto_usd', t.teto_usd,
          'medido_usd', public.painel_fila_consumo_hoje(t.conta),
          'em_execucao_usd', public.painel_fila_reservado(t.conta),
          'na_fila_usd', public.painel_fila_na_fila(t.conta),
          'defasagem_horas', public.painel_fila_defasagem_horas(t.conta),
          'exige_medicao_recente', coalesce(t.exigir_medicao_recente, false)
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
    'todas_recusadas', coalesce((v_escolha->>'todas_recusadas')::boolean, false)
  );
end;
$$;
comment on function public.fila_prompts_enfileirar(text, jsonb) is
  'D14/D29 + D42 (rodada 9) + D46 (rodada 10) + D51 (pós-merge): a escolha de conta saiu do laço e virou painel_fila_escolher_conta — a MESMA regra de escolherConta no TS. D46: a escolha MANUAL passou a consultar painel_fila_recusaria_por_medicao. D51: quando é a medição velha que recusa, o código é manual_medicao_velha e não manual_nao_cabe_hoje — a frase deste último fala de espaço livre e explicava falta de dinheiro onde o problema é medição. Nenhuma frase: quem escreve em português é o TS.';
revoke all on function public.fila_prompts_enfileirar(text, jsonb) from public;
grant execute on function public.fila_prompts_enfileirar(text, jsonb) to anon, authenticated;

-- ── 9 · a frase do pull para de anunciar um lançamento que não houve ───────
-- Consequência direta de §6: com a estimativa recusada por posto, `mortos_usd`
-- passa a ser zero — e a frase de antes escrevia "lançou US$ 0,00 no dia".
-- O texto da 0016, verbatim, mais dois ramos para esse caso. O TS
-- (`core/prompts/tipos.ts`) recebe a MESMA frase, e a paridade das duas é
-- provada por `tests/unit/prompts-motivo-do-pull.test.ts`.
create or replace function public.painel_fila_motivo_do_pull(
  p_mortos integer, p_mortos_usd numeric,
  p_custo_escolhido numeric, p_headroom numeric,
  p_menor_disponivel numeric, p_elegiveis integer,
  p_em_espera integer, p_menor_espera numeric, p_espera_min integer,
  p_devolvidos integer, p_travados integer,
  p_estimativa_usd numeric, p_estimativa_itens integer,
  p_defasagem_horas numeric default null,
  p_exigir_medicao boolean default false
)
returns text
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v text[] := '{}'::text[];
begin
  -- D32c: a RECUSA é a frase inteira. Não adianta listar o que caberia num
  -- saldo que a casa acabou de declarar velho demais para autorizar gasto.
  if coalesce(p_exigir_medicao, false)
     and (p_defasagem_horas is null or p_defasagem_horas > 12) then
    if p_defasagem_horas is null then
      return 'não autorizo contra saldo nenhum: esta conta exige medição recente e nunca teve gasto medido';
    end if;
    return format('não autorizo contra saldo de %s h atrás: esta conta exige medição recente',
      round(p_defasagem_horas)::integer);
  end if;

  -- D32b: a defasagem vem PRIMEIRO — ela qualifica todos os números seguintes.
  -- Medido: 37 h de atraso e a tela dizia "US$ 150,00 livres" sem ressalva.
  -- Conta que NUNCA mediu nada não ganha oração aqui de propósito: os números
  -- do pull dela são todos zero e a oração seria um prefixo permanente em toda
  -- frase. Quem diz isso é o CARD ("sem medição nenhuma"), e quem trava é
  -- exigir_medicao_recente.
  if p_defasagem_horas is not null and p_defasagem_horas > 12 then
    v := v || format('atenção: o gasto medido desta conta é de %s h atrás',
      round(p_defasagem_horas)::integer);
  end if;

  -- A ordem é a ordem: defasagem · mortos · escolhido/nada cabe · em espera ·
  -- devolvidos · travados · parcela estimada. Nenhum ramo cala outro.
  -- CRÍTICO 1 (rodada 12): `p_mortos_usd` é o que o LIVRO aceitou, não o que a
  -- casa tentou. Quando a medição real da sessão já estava lançada, a
  -- estimativa é recusada por posto (D53) e o dia não anda — e a frase diz
  -- isso, em vez de anunciar um lançamento de US$ 0,00 que não houve.
  if p_mortos = 1 and coalesce(p_mortos_usd, 0) = 0 then
    v := v || '1 item morreu sem fechar neste disparo e não mudou o gasto do dia: o número real dele já estava medido'::text;
  elsif p_mortos > 1 and coalesce(p_mortos_usd, 0) = 0 then
    v := v || format('%s itens morreram sem fechar neste disparo e não mudaram o gasto do dia: os números reais deles já estavam medidos', p_mortos);
  elsif p_mortos = 1 then
    v := v || format('1 item morreu sem fechar neste disparo e lançou %s no dia',
      public.painel_usd_br(p_mortos_usd));
  elsif p_mortos > 1 then
    v := v || format('%s itens morreram sem fechar neste disparo e lançaram %s no dia',
      p_mortos, public.painel_usd_br(p_mortos_usd));
  end if;

  if p_custo_escolhido is not null then
    v := v || format('peguei o item mais antigo que cabe: %s de %s livres',
      public.painel_usd_br(p_custo_escolhido), public.painel_usd_br(p_headroom));
  elsif p_menor_disponivel is not null and coalesce(p_elegiveis, 0) = 0 then
    -- Só é honesto dizer "nada cabe" quando NADA cabe: com um elegível travado
    -- por outra transação (B5), quem conta a verdade é a frase de travados.
    -- D13/BAIXO 1: headroom negativo nunca vira número na tela nem no relatório.
    v := v || format('nada cabe agora: o mais barato disponível custa %s e %s',
      public.painel_usd_br(p_menor_disponivel),
      case when p_headroom > 0 then 'há ' || public.painel_usd_br(p_headroom) || ' livres'
           else 'não há espaço livre agora' end);
  end if;

  if p_em_espera = 1 then
    v := v || format('1 item de %s volta em %s min',
      public.painel_usd_br(p_menor_espera), p_espera_min);
  elsif p_em_espera > 1 then
    v := v || format('%s itens de %s voltam em %s min',
      p_em_espera, public.painel_usd_br(p_menor_espera), p_espera_min);
  end if;

  if p_devolvidos = 1 then
    -- `::text` obrigatório: `text[] || 'literal'` sem tipo faz o Postgres ler
    -- o literal como ARRAY ("malformed array literal") e o pull inteiro morre
    -- com exatamente 1 devolvido. Achado do bloco T13 deste arquivo.
    v := v || '1 item voltou para a fila e aguarda nova tentativa'::text;
  elsif p_devolvidos > 1 then
    v := v || format('%s itens voltaram para a fila e aguardam nova tentativa', p_devolvidos);
  end if;

  if p_travados = 1 then
    v := v || '1 item elegível está em uso por outra operação; tente no próximo disparo'::text;
  elsif p_travados > 1 then
    v := v || format('%s itens elegíveis estão em uso por outra operação; tente no próximo disparo', p_travados);
  end if;

  -- D20 (rodada 4): a parcela estimada é dita em voz alta — BAIXO 7 (rodada 7):
  -- exceto quando ela é EXATAMENTE o dinheiro que a oração dos mortos deste
  -- disparo já nomeou. Duas orações para o mesmo dinheiro só engordam a frase
  -- (o crítico mediu 331 caracteres, com a repetição dentro).
  if coalesce(p_estimativa_usd, 0) > 0
     and not (coalesce(p_mortos, 0) > 0
              and coalesce(p_mortos, 0) = coalesce(p_estimativa_itens, -1)
              and coalesce(p_mortos_usd, 0) = coalesce(p_estimativa_usd, -1)) then
    v := v || format('%s do consumo de hoje são estimativa de %s',
      public.painel_usd_br(p_estimativa_usd),
      case when p_estimativa_itens = 1 then '1 item que morreu sem fechar'
           else p_estimativa_itens || ' itens que morreram sem fechar' end);
  end if;

  if array_length(v, 1) is null then
    return 'fila vazia para esta conta';
  end if;
  return array_to_string(v, '; ');
end;
$$;
comment on function public.painel_fila_motivo_do_pull(integer, numeric, numeric, numeric, numeric, integer, integer, numeric, integer, integer, integer, numeric, integer, numeric, boolean) is
  'D32b/D32c + CRÍTICO 1 (rodada 12): a frase do pull, função pura. Quando um item morre e a estimativa dele é recusada por posto (a medição real já estava lançada), a frase diz que o dia NÃO mudou, em vez de anunciar um lançamento de US$ 0,00.';
revoke all on function public.painel_fila_motivo_do_pull(integer, numeric, numeric, numeric, numeric, integer, integer, numeric, integer, integer, integer, numeric, integer, numeric, boolean) from public, anon, authenticated;

-- ── 10 · as duas portas do operador contam a verdade do livro ──────────────
-- `fila_prompts_cancelar` anunciava o lançamento da estimativa mesmo quando o
-- livro a recusava por posto; `fila_prompts_ajustar_custo` deixaria passar uma
-- correção que o livro recusaria, devolvendo ok=true sobre um dia parado. As
-- duas agora olham o que o livro ACEITOU. O resto do texto é o da 0019.
create or replace function public.fila_prompts_cancelar(p_secret text, p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_expected text;
  v_row      public.painel_fila_prompts%rowtype;
  v_codigo   text;
  v_lancado  numeric := 0;
  v_caixa    jsonb;
begin
  select valor into v_expected from private.lifeboard_config where chave = 'load_secret';
  if v_expected is null then
    raise exception
      'fila_prompts_cancelar: segredo não configurado — inserir a chave load_secret em private.lifeboard_config (ver DEPLOY.md)'
      using errcode = 'config_file_error';
  end if;
  if p_secret is null or p_secret <> v_expected then
    raise exception 'fila_prompts_cancelar: acesso negado' using errcode = 'insufficient_privilege';
  end if;
  if p_id is null then
    raise exception 'Item não identificado.' using errcode = 'check_violation';
  end if;

  select * into v_row from public.painel_fila_prompts where id = p_id for update;

  if not found or v_row.estado not in ('na_fila','pega') then
    raise exception 'Este item não está mais na fila — ele já foi concluído, falhou ou foi cancelado.'
      using errcode = 'check_violation';
  end if;

  v_codigo := case
    when v_row.estado = 'pega' then 'cancelado_em_execucao'
    when v_row.tentativas > 0 then 'cancelado_apos_devolucao'
    else 'cancelado_nunca_pego'
  end;

  -- D12: cancelada que JÁ TEVE DONO gastou dinheiro. Esta é a cláusula que a
  -- mutação M23 apaga — e o bloco T45 fica vermelho quando ela some.
  if v_codigo <> 'cancelado_nunca_pego' and v_row.custo_usd is null then
    v_lancado := least(v_row.custo_estimado_usd, public.painel_custo_maximo_por_item());
  end if;

  update public.painel_fila_prompts
     set estado = 'cancelada',
         heartbeat_em = null,
         disponivel_em = null,
         concluido_em = now(),
         ultimo_worker_id = coalesce(worker_id, ultimo_worker_id),
         custo_usd = case when v_lancado > 0 then v_lancado else custo_usd end,
         custo_e_estimativa = case when v_lancado > 0 then true else custo_e_estimativa end,
         custo_origem = case when v_lancado > 0 then 'estimativa' else custo_origem end,
         motivo_falha = case v_codigo
           when 'cancelado_em_execucao' then 'cancelado pelo operador durante a execução'
           when 'cancelado_apos_devolucao' then format('cancelado pelo operador depois de %s tentativa(s)', v_row.tentativas)
           else motivo_falha end
   where id = p_id
  returning * into v_row;

  if v_lancado > 0 then
    v_caixa := public.painel_caixa_lancar_item(
      v_row.id, v_lancado, 'estimativa', null,
      'estimativa da casa: item cancelado depois de já ter rodado');
    -- CRÍTICO 1 (rodada 12): se a sessão vinculada já publicou o número real,
    -- a estimativa é recusada por posto (D53) e o dia NÃO muda. O relatório
    -- diz o que o livro aceitou — antes ele anunciava um lançamento que não
    -- aconteceu, e era por essa porta que US$ 300 medidos viravam US$ 50.
    if not coalesce((v_caixa->>'movimentou')::boolean, false) then
      v_lancado := 0;
    end if;
  end if;

  return jsonb_build_object(
    'ok', true,
    'motivo_codigo', v_codigo,
    'tentativas', v_row.tentativas,
    'custo_lancado_usd', round(v_lancado, 2),
    'recusado_por_precedencia', coalesce((v_caixa->>'recusado_por_precedencia')::boolean, false),
    'caixa', v_caixa
  );
end;
$$;
comment on function public.fila_prompts_cancelar(text, uuid) is
  'D12 + D37 + CRÍTICO 1 (rodada 12): cancelar item que JÁ RODOU lança o custo ESTIMADO no livro-razão com posto 10; se a sessão vinculada já publicou o número real, o livro recusa e `custo_lancado_usd` volta ZERO — o relatório passa a dizer o que aconteceu, não o que se tentou.';
revoke all on function public.fila_prompts_cancelar(text, uuid) from public;
grant execute on function public.fila_prompts_cancelar(text, uuid) to anon, authenticated;
create or replace function public.fila_prompts_ajustar_custo(
  p_secret text, p_id uuid, p_custo_usd numeric, p_session_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_expected text;
  v_row      public.painel_fila_prompts%rowtype;
  v_sess     text;
  v_outro    uuid;
  v_dona     text;
  v_caixa    jsonb;
  v_antes    text;
  v_era_zero boolean;
  v_posto_livro smallint;
begin
  select valor into v_expected from private.lifeboard_config where chave = 'load_secret';
  if v_expected is null then
    raise exception
      'fila_prompts_ajustar_custo: segredo não configurado — inserir a chave load_secret em private.lifeboard_config (ver DEPLOY.md)'
      using errcode = 'config_file_error';
  end if;
  if p_secret is null or p_secret <> v_expected then
    raise exception 'fila_prompts_ajustar_custo: acesso negado' using errcode = 'insufficient_privilege';
  end if;
  if p_id is null then
    raise exception 'Item não identificado.' using errcode = 'check_violation';
  end if;
  -- ALTO 2 (rodada 13): o operador corrige com o número REAL, mesmo acima do
  -- teto do dia. A faixa aqui é de sanidade (§0).
  if p_custo_usd is null or p_custo_usd < 0 or p_custo_usd > public.painel_custo_maximo_por_item() then
    raise exception 'O custo precisa ser um número entre 0 e %.', public.painel_custo_maximo_por_item()
      using errcode = 'check_violation';
  end if;

  v_sess := nullif(btrim(coalesce(p_session_id, '')), '');

  select * into v_row from public.painel_fila_prompts where id = p_id for update;

  if not found then
    raise exception 'Item não encontrado na fila.' using errcode = 'check_violation';
  end if;
  if v_row.estado not in ('falhou','cancelada') then
    raise exception 'Só dá para ajustar o custo de item que falhou ou foi cancelado (este está %).',
      public.painel_fila_estado_br(v_row.estado)
      using errcode = 'check_violation';
  end if;
  if v_row.concluido_em is null
     or public.painel_dia_operador(v_row.concluido_em) <> public.painel_dia_operador() then
    raise exception 'Só dá para ajustar o custo de item fechado hoje.' using errcode = 'check_violation';
  end if;
  -- MÉDIO 4 (rodada 8) mantida: a guarda olha a ORIGEM, não o VALOR.
  if v_row.custo_origem = 'medido' and coalesce(v_row.custo_usd, 0) <> 0 then
    raise exception 'Este custo foi medido pela sessão — não dá para corrigi-lo aqui.'
      using errcode = 'check_violation';
  end if;
  if v_sess is not null then
    select f.id into v_outro from public.painel_fila_prompts f
      where f.session_id = v_sess and f.id <> p_id limit 1;
    if v_outro is not null then
      raise exception 'Esta sessão já está vinculada a outro item da fila.' using errcode = 'check_violation';
    end if;
    v_dona := public.painel_sessao_dona(v_sess);
    if v_dona is not null and v_dona <> v_row.conta then
      raise exception 'Esta sessão é da conta % — não dá para vinculá-la a um item da conta %.',
        v_dona, v_row.conta using errcode = 'check_violation';
    end if;
  end if;

  -- CRÍTICO 1 (rodada 12): a MESMA guarda, olhando o LIVRO. Vem DEPOIS das
  -- checagens da sessão proposta (outro item, outra conta), para que essas
  -- recusas continuem dizendo o motivo delas. A coluna
  -- `custo_origem` do item pode dizer `estimativa` (a casa lançou quando ele
  -- morreu) enquanto a entidade dele já guarda a medição publicada pela
  -- sessão. Sem esta linha a correção do operador (posto 20) seria recusada
  -- por posto lá dentro e a tela responderia "custo ajustado" sobre um dia
  -- que não se mexeu — o no-op silencioso que a rodada 9 matou por outro
  -- caminho. Aqui ele vira recusa com motivo.
  --
  -- P2 do Codex (PR #42, 2ª rodada): a guarda confere as DUAS entidades — a
  -- que o item tem hoje e a que ele VAI TER se o operador propôs uma sessão.
  -- Olhando só a atual, uma sessão proposta já publicada (posto 40) passava,
  -- o item era gravado com o custo do operador e o livro recusava o
  -- lançamento por posto — com `ok: true` e a tela dizendo "custo ajustado".
  -- Olhando só a proposta, trocar de sessão virava a porta para sair de uma
  -- entidade já medida. Vale o posto mais alto das duas, e o posto lido é o
  -- do LANÇAMENTO ativo (`l.precedencia`): publicação é 40, não 30.
  select max(coalesce(l.precedencia, public.painel_caixa_precedencia(l.origem)))
    into v_posto_livro
    from public.painel_caixa_lancamentos l
   where (l.entidade_tipo, l.entidade_id) in (
           (case when v_row.session_id is not null then 'sessao' else 'item' end,
            coalesce(v_row.session_id, v_row.id::text)),
           (case when coalesce(v_sess, v_row.session_id) is not null then 'sessao' else 'item' end,
            coalesce(v_sess, v_row.session_id, v_row.id::text)))
     and l.origem <> 'estorno'
     and not exists (select 1 from public.painel_caixa_lancamentos e where e.estorna_id = l.id);
  if public.painel_caixa_precedencia('operador') < coalesce(v_posto_livro, 0) then
    raise exception 'Este custo já foi medido pela sessão — não dá para corrigi-lo aqui.'
      using errcode = 'check_violation';
  end if;

  -- A origem de ANTES da correção (o `returning` abaixo já traz 'operador').
  v_antes    := v_row.custo_origem;
  v_era_zero := (v_row.custo_origem = 'medido' and coalesce(v_row.custo_usd, 0) = 0);

  update public.painel_fila_prompts
     set custo_usd = p_custo_usd,
         custo_e_estimativa = false,
         custo_origem = 'operador',
         session_id = coalesce(v_sess, session_id),
         custo_ajustado_em = now()
   where id = p_id
  returning * into v_row;

  -- MÉDIO 4 (rodada 9): A CORREÇÃO DEIXA DE SER NO-OP. Medido pelo crítico:
  -- `ajuste 120->3 devolveu ok=true custo=3.00 dia=30` — a RPC confirmava, a
  -- tela ficava verde e o número que governa o teto não se mexia, porque o dia
  -- era derivado da SESSÃO e o item vinculado contribuía zero. Agora a
  -- correção é um lançamento: estorno do líquido da entidade + o valor novo.
  v_caixa := public.painel_caixa_lancar_item(
    v_row.id, p_custo_usd, 'operador', null,
    'correção do operador pela tela');

  -- Cinto de segurança da mesma correção: se, por qualquer caminho que a
  -- guarda acima não previu, o livro RECUSOU o valor do operador, a RPC não
  -- confirma sucesso — a exceção desfaz também o UPDATE do item.
  if coalesce((v_caixa->>'recusado_por_precedencia')::boolean, false) then
    raise exception 'Este custo já foi medido pela sessão — não dá para corrigi-lo aqui.'
      using errcode = 'check_violation';
  end if;

  return jsonb_build_object(
    'ok', true, 'custo_usd', round(p_custo_usd, 2),
    'session_id', coalesce(v_sess, v_row.session_id),
    'origem_anterior', v_antes,
    'era_medido_zero', v_era_zero,
    'consumo_do_dia_usd', round(public.painel_fila_consumo_hoje(v_row.conta), 2),
    'caixa', v_caixa
  );
end;
$$;
comment on function public.fila_prompts_ajustar_custo(text, uuid, numeric, text) is
  'D20/D26 + MÉDIO 4 + CRÍTICO 1 (rodada 12): a correção do operador grava no livro (estorno + lançamento novo). A trava agora olha os DOIS lugares — a coluna `custo_origem` do item e a origem do lançamento ATIVO da entidade dele —, porque a coluna pode dizer `estimativa` enquanto o livro já guarda a medição publicada pela sessão.';
revoke all on function public.fila_prompts_ajustar_custo(text, uuid, numeric, text) from public;
grant execute on function public.fila_prompts_ajustar_custo(text, uuid, numeric, text) to anon, authenticated;
