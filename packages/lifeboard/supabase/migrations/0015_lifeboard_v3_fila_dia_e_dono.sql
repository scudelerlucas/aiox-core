-- =============================================================================
-- OS-LIFEBOARD · Migration 0015 — P7: RODADA 6, o dia que reconhece paga e o
-- dono do item morto entrega o número.
-- =============================================================================
-- Sobre 0007 + 0009 + 0011 + 0012 + 0013 + 0014. Tudo ADITIVO e RE-APLICÁVEL
-- (`add column if not exists`, `create or replace function`). A ÚNICA remoção
-- é a assinatura de 3 argumentos de `fila_prompts_ajustar_custo`, substituída
-- pela de 4 (o 4º com `default null`): manter as duas tornaria a chamada de 3
-- argumentos AMBÍGUA para o PostgREST ("function is not unique"), e uma RPC
-- ambígua é uma RPC morta. Mesma disciplina que 0013 já usou.
--
-- O crítico hostil da rodada 5 reprovou com 2 ALTO + 6 MÉDIO + 5 BAIXO. As
-- decisões desta rodada (D25–D30), todas com medição do lado do banco:
--
--  D25 O DIA QUE RECONHECE PAGA (revoga a D24 da rodada 5). D24 atribuía o
--      item ao dia de `pego_em`. Medido pelo crítico: item pego 12/09 23h50 e
--      fechado hoje com US$ 42 MEDIDOS deixava o consumo de hoje em 0 e
--      devolvia o headroom inteiro (30 → 150) — o dinheiro ia para um dia que
--      nenhuma função sabia abrir. Agora:
--        · item FECHADO (`concluida`/`falhou`/`cancelada`) conta no dia de
--          `concluido_em` — o dia em que a casa RECONHECE o gasto;
--        · item `pega` em voo conta como RESERVA do dia CORRENTE, sempre,
--          independentemente de `pego_em` (`painel_fila_reservado`, que nunca
--          teve filtro de dia — é a metade da regra que já estava certa);
--        · e QUALQUER dia passa a ser consultável: `painel_fila_itens_do_dia
--          (conta, dia)` e `painel_fila_consumo_do_dia(conta, dia)`, com as
--          versões sem parâmetro chamando `painel_dia_operador()`. A leitura
--          de fora vem pela RPC secret-gated `fila_prompts_consumo_do_dia`.
--      `fila_prompts_ajustar_custo` já exigia `concluido_em` = hoje: as duas
--      réguas, que divergiam (MÉDIO 3), passam a ser a MESMA.
--
--  D26 A MORTE NÃO APAGA A POSSE. `mor` zerava `worker_id`; a guarda de
--      fencing de `fila_prompts_fechar_interno` vinha ANTES da de idempotência;
--      resultado medido: o único ator com o número honesto (o worker que
--      rodou) era recusado com "Item pertence a outro worker (nenhum)", e sem
--      `session_id` vinculado o dia somava estimativa (120) + custo real da
--      sessão (80) = 200. Agora existe `ultimo_worker_id`: o fechamento de um
--      item `falhou` por morte, feito pelo ÚLTIMO DONO, é aceito e devolve
--      `reaberto_e_fechado: true` — grava o custo medido, apaga a marca de
--      estimativa, vincula a sessão e carimba `concluido_em = now()` (por D25,
--      o dinheiro cai no dia que o reconheceu). Outro worker continua recusado.
--      `fila_prompts_ajustar_custo` ganha `p_session_id` pelo mesmo motivo: a
--      tela também precisa poder criar o vínculo que evita a soma dupla.
--
--  D27 O `motivo` VIRA ADITIVO. Era um `case` de ramo único: a primeira frase
--      verdadeira calava todas as outras. Medido: 3 itens de US$ 5 em backoff
--      + 5 de US$ 120 disponíveis => "o mais barato da fila custa US$ 120.00"
--      (falso); 1 morto + 1 que não cabe => a morte não era mencionada. Agora
--      todo fato não-zero vira uma frase, concatenadas por "; ", nesta ordem:
--      mortos · escolhido/nada cabe · em espera · devolvidos · travados. Os
--      números saem separados e crus (`menor_custo_fila`, que inclui o
--      backoff, e `menor_custo_elegivel_agora`, que não). Formatação: vírgula
--      decimal (`painel_usd_br`), acentos, e headroom negativo vira "não há
--      espaço livre agora" — nunca um número negativo.
--
--  B5  ITEM TRAVADO NÃO É "FILA VAZIA". O `select … for update skip locked`
--      pula a linha travada por outra transação; a contagem de `pulados` (que
--      não trava nada) só olha quem NÃO cabe. Um item que cabe e está travado
--      sumia das duas contas e o pull dizia "fila vazia para esta conta" com a
--      fila cheia. Agora a contagem de elegíveis SEM lock entra no motivo.
--
--  D29 UMA RÉGUA NO ROTEAMENTO (espelho de `src/core/prompts/roteador.ts`).
--      `fila_prompts_enfileirar` escolhia a conta pelo ESPAÇO LIVRE (headroom
--      − fila parada) e decidia `cabe_hoje` pelo HEADROOM. Duas réguas: a
--      frase dizia "nenhuma conta tem US$ 50 livres" com uma conta de US$ 150
--      de headroom e US$ 140 na fila. Agora `cabe_hoje := estimado <= espaco`
--      — a mesma régua que escolhe é a que fala. (Supersede a metade "headroom
--      decide cabe_hoje" de D13; a outra metade de D13 — nunca mostrar número
--      negativo — continua valendo e ganhou reforço em D27.)
--
--  D30 MEDIÇÃO PUBLICADA SUBSTITUI A ESTIMATIVA. Era `greatest(custo_item −
--      custo_sessao, 0)`: quando o real era MENOR que a estimativa, a
--      subtração garantia que a conta fosse cobrada pela estimativa (item
--      morto de 120 + sessão publicada de 30 => 120). Agora, item com sessão
--      vinculada que publicou custo NAQUELE DIA contribui ZERO — a sessão
--      responde por si, na view `painel_consumo_por_conta_dia`. Sessão
--      publicada SEM custo (21 das 215 reais) continua não abatendo nada: o
--      `left join lateral` exige `custo_usd is not null`, e sem linha o item
--      contribui inteiro (D10 preservada).
--
--  B2  MENSAGEM SEM UUID E COM ACENTO nas RPCs que a TELA chama
--      (`fila_prompts_cancelar`, `fila_prompts_ajustar_custo`): o `23514` é o
--      único SQLSTATE cujo texto atravessa até o operador, e ele chegava como
--      "Item nao encontrado: 937a3479-f3b3-…".
-- =============================================================================

-- ── 1 · painel_usd_br — dinheiro em português, dentro do banco ──────────────
-- BAIXO 1 (rodada 5): o `motivo` do pull ia literal para o relatório diário da
-- Routine com ponto decimal ("US$ 120.00"), sem acento e, quando o teto estava
-- estourado, com número negativo. Todo dinheiro que o SQL escreve passa aqui.
create or replace function public.painel_usd_br(p_valor numeric)
returns text
language sql
immutable
set search_path = pg_temp
as $$
  select 'US$ ' || replace(to_char(round(coalesce(p_valor, 0), 2), 'FM999999990.00'), '.', ',');
$$;
comment on function public.painel_usd_br(numeric) is
  'BAIXO 1 (rodada 5 do crítico): dinheiro em português no próprio SQL — "US$ 120,00", nunca "US$ 120.00". Usada por toda frase que o banco escreve (o motivo do pull vai literal para o relatório da Routine).';
revoke all on function public.painel_usd_br(numeric) from public, anon, authenticated;

-- ── 2 · ultimo_worker_id — a posse que a morte não apaga (D26) ──────────────
alter table public.painel_fila_prompts
  add column if not exists ultimo_worker_id text;
comment on column public.painel_fila_prompts.ultimo_worker_id is
  'D26 (rodada 6): quem pegou o item por último. `worker_id` é a POSSE VIVA (zerada na devolução e na morte, porque é ela que libera o item); esta coluna é a MEMÓRIA da posse, e é por ela que o dono de um item morto consegue voltar com o custo medido.';

-- ── 3 · painel_fila_itens_do_dia — o dia que RECONHECE paga (D25 + D30) ─────
create or replace function public.painel_fila_itens_do_dia(p_conta text, p_dia date)
returns table (id uuid, contribuicao numeric, e_estimativa boolean)
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select
    f.id,
    -- D30 (rodada 6): a sessão vinculada que publicou custo NAQUELE DIA
    -- responde por si na view; o item contribui ZERO. Sem linha de sessão com
    -- custo (inclusive a sessão publicada SEM custo — 21 das 215 reais), o
    -- item contribui inteiro. Era `greatest(custo − sessao, 0)`, que fazia a
    -- estimativa virar PISO quando o real era menor.
    case when ses.custo_usd is null then f.custo_usd else 0 end as contribuicao,
    f.custo_e_estimativa
  from public.painel_fila_prompts f
  left join lateral (
    select s.custo_usd
    from public.painel_frentes_sessoes s
    where f.session_id is not null
      and s.sessao_id = f.session_id
      and s.conta = f.conta
      and s.custo_usd is not null
      and public.painel_dia_operador(coalesce(s.atualizado_em, s.criado_em, s.publicado_em)) = p_dia
    order by s.custo_usd desc
    limit 1
  ) ses on true
  where f.conta = p_conta
    and f.custo_usd is not null
    and f.concluido_em is not null
    -- D25 (rodada 6, revoga D24): o dia é o do FECHAMENTO. D24 usava
    -- `coalesce(pego_em, criado_em)` e arquivava o dinheiro num dia que
    -- ninguém sabia abrir — medido: US$ 42 reais somem, headroom 30 → 150.
    and public.painel_dia_operador(f.concluido_em) = p_dia
    and (
      f.estado in ('concluida', 'falhou')
      -- D12 (rodada 4, mantida): cancelada que JÁ TEVE DONO gastou dinheiro.
      or (f.estado = 'cancelada' and (f.worker_id is not null or f.ultimo_worker_id is not null or f.tentativas > 0))
    );
$$;
comment on function public.painel_fila_itens_do_dia(text, date) is
  'D25 (rodada 6): a contribuição de cada item da fila ao gasto de UM DIA QUALQUER — atribuída pelo dia de concluido_em (o dia que reconhece paga). D30: item com sessão vinculada que publicou custo naquele dia contribui ZERO (a sessão responde por si); sem sessão com custo, contribui inteiro.';
revoke all on function public.painel_fila_itens_do_dia(text, date) from public, anon, authenticated;

create or replace function public.painel_fila_itens_do_dia(p_conta text)
returns table (id uuid, contribuicao numeric, e_estimativa boolean)
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select d.id, d.contribuicao, d.e_estimativa
  from public.painel_fila_itens_do_dia(p_conta, public.painel_dia_operador()) d;
$$;
comment on function public.painel_fila_itens_do_dia(text) is
  'D25 (rodada 6): atalho de hoje para painel_fila_itens_do_dia(conta, dia). A aridade de 1 argumento continua existindo para não quebrar 0013/0014.';
revoke all on function public.painel_fila_itens_do_dia(text) from public, anon, authenticated;

-- ── 4 · consumo de um dia qualquer (D25) ────────────────────────────────────
create or replace function public.painel_fila_consumo_do_dia(p_conta text, p_dia date)
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
    where c.conta = p_conta and c.dia = p_dia;

  select coalesce(sum(d.contribuicao), 0) into v_fila
    from public.painel_fila_itens_do_dia(p_conta, p_dia) d;

  return coalesce(v_view, 0) + coalesce(v_fila, 0);
end;
$$;
comment on function public.painel_fila_consumo_do_dia(text, date) is
  'D25 (rodada 6): gasto MEDIDO de um dia qualquer (sessões publicadas naquele dia + contribuição dos itens fechados naquele dia). Antes desta função, nenhum dia além de hoje era legível — e por isso o dinheiro da virada do dia sumia.';
revoke all on function public.painel_fila_consumo_do_dia(text, date) from public, anon, authenticated;

create or replace function public.painel_fila_consumo_hoje(p_conta text)
returns numeric
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select public.painel_fila_consumo_do_dia(p_conta, public.painel_dia_operador());
$$;
comment on function public.painel_fila_consumo_hoje(text) is
  'D25 (rodada 6): atalho de hoje para painel_fila_consumo_do_dia. O dia do item é o do FECHAMENTO (concluido_em); o item em voo pesa por painel_fila_reservado, que é do dia corrente sempre.';
revoke all on function public.painel_fila_consumo_hoje(text) from public, anon, authenticated;

-- ── 5 · a leitura de qualquer dia, pela porta com segredo (D25) ─────────────
create or replace function public.fila_prompts_consumo_do_dia(p_secret text, p_dia date default null)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_expected text;
  v_dia      date;
  v_linhas   jsonb;
begin
  select valor into v_expected from private.lifeboard_config where chave = 'load_secret';
  if v_expected is null then
    raise exception
      'fila_prompts_consumo_do_dia: segredo não configurado — inserir a chave load_secret em private.lifeboard_config (ver DEPLOY.md)'
      using errcode = 'config_file_error';
  end if;
  if p_secret is null or p_secret <> v_expected then
    raise exception 'fila_prompts_consumo_do_dia: acesso negado' using errcode = 'insufficient_privilege';
  end if;

  v_dia := coalesce(p_dia, public.painel_dia_operador());

  select jsonb_agg(linha order by linha->>'conta')
    into v_linhas
    from (
      select jsonb_build_object(
        'conta', t.conta,
        'teto_usd', round(t.teto_usd, 2),
        'consumo_usd', round(public.painel_fila_consumo_do_dia(t.conta, v_dia), 2),
        'itens', (select count(*) from public.painel_fila_itens_do_dia(t.conta, v_dia) d where d.contribuicao > 0)
      ) as linha
      from public.painel_teto_diario t
    ) s;

  return jsonb_build_object('ok', true, 'dia', v_dia, 'contas', coalesce(v_linhas, '[]'::jsonb));
end;
$$;
comment on function public.fila_prompts_consumo_do_dia(text, date) is
  'D25 (rodada 6): a porta de leitura de QUALQUER dia (default: hoje). Existe porque a regra "o dia que reconhece paga" só vale se o dia anterior continuar legível — sem isto, a régua seria só um jeito elegante de perder a cobrança.';
revoke all on function public.fila_prompts_consumo_do_dia(text, date) from public;
grant execute on function public.fila_prompts_consumo_do_dia(text, date) to anon, authenticated;

-- ── 6 · painel_fila_motivo_do_pull — a frase mora numa função PURA (D27) ────
-- MÉDIO 2 (rodada 5): "o teste de D21 é de ortografia". A frase do pull era
-- montada dentro de `fila_prompts_pegar_interno`, e provar cada ramo exigia
-- montar o estado inteiro da fila no banco — inclusive ramos que uma única
-- conexão não consegue produzir (item travado por OUTRA transação, B5). Agora
-- a frase é uma função PURA: `supabase/tests/fila_prompts.test.sql` chama cada
-- ramo direto, com números, e `src/core/prompts/tipos.ts` (montarMotivoDoPull)
-- é o espelho TS, texto a texto.
create or replace function public.painel_fila_motivo_do_pull(
  p_mortos integer, p_mortos_usd numeric,
  p_custo_escolhido numeric, p_headroom numeric,
  p_menor_disponivel numeric, p_elegiveis integer,
  p_em_espera integer, p_menor_espera numeric, p_espera_min integer,
  p_devolvidos integer, p_travados integer,
  p_estimativa_usd numeric, p_estimativa_itens integer
)
returns text
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v text[] := '{}'::text[];
begin
  -- A ordem é a ordem: mortos · escolhido/nada cabe · em espera · devolvidos ·
  -- travados · parcela estimada. Nenhum ramo cala outro (era um `case`).
  if p_mortos = 1 then
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

  -- D20 (rodada 4, mantida): a parcela estimada é dita em voz alta, sempre.
  if coalesce(p_estimativa_usd, 0) > 0 then
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
comment on function public.painel_fila_motivo_do_pull(integer, numeric, numeric, numeric, numeric, integer, integer, numeric, integer, integer, integer, numeric, integer) is
  'D27 (rodada 6): a frase ADITIVA do pull, numa função PURA — mortos; escolhido ou nada cabe; em espera; devolvidos; travados; parcela estimada, coladas por "; ". Testada ramo a ramo em supabase/tests/fila_prompts.test.sql e espelhada texto a texto por montarMotivoDoPull (src/core/prompts/tipos.ts).';
revoke all on function public.painel_fila_motivo_do_pull(integer, numeric, numeric, numeric, numeric, integer, integer, numeric, integer, integer, integer, numeric, integer) from public, anon, authenticated;

-- ── 7 · fila_prompts_pegar_interno — motivo ADITIVO + travados (D27/B5) ─────
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
begin
  if p_conta is null
     or p_conta not in ('lucasscudeler@gmail.com','lsgpandora@gmail.com','almapetra.ltda@gmail.com')
  then
    raise exception 'conta precisa ser uma das 3 contas da casa.' using errcode = 'check_violation';
  end if;
  if p_worker_id is null or length(btrim(p_worker_id)) = 0 then
    raise exception 'worker_id é obrigatório (use o id desta sessão: get_session sem argumento → session_id).'
      using errcode = 'check_violation';
  end if;

  -- Serializa dois pulls da MESMA conta (contas diferentes nunca se bloqueiam).
  -- É por DESENHO: há 1 Routine por conta. O `skip locked` da linha do item
  -- protege contra `cancelar`/`fechar`/`ajustar` concorrentes, nunca contra
  -- outro worker da mesma conta — esse nem chega aqui.
  perform 1 from public.painel_teto_diario where conta = p_conta for update;

  -- D2 (rodada 3) + D19 (rodada 4): expira por 45 min SEM SINAL; quem volta
  -- cumpre backoff de 15 min × tentativas. D26 (rodada 6): `mor` guarda a
  -- posse em `ultimo_worker_id` antes de zerar `worker_id`.
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
           custo_usd = least(f.custo_estimado_usd, 500),
           custo_e_estimativa = true,
           concluido_em = now()
      from alvo a
     where f.id = a.id and a.tentativas >= a.max_tentativas
    returning f.id, f.custo_usd
  )
  select
    coalesce((select array_agg(d.id) from dev d), '{}'::uuid[]),
    (select count(*) from dev),
    (select count(*) from mor),
    coalesce((select sum(m.custo_usd) from mor m), 0)
  into v_devolvidos_ids, v_devolvidos, v_mortos, v_mortos_usd;

  select teto_usd into v_teto from public.painel_teto_diario where conta = p_conta;
  if v_teto is null then v_teto := 150; end if;

  v_medido       := public.painel_fila_consumo_hoje(p_conta);
  v_execucao     := public.painel_fila_reservado(p_conta);
  v_headroom     := v_teto - v_medido - v_execucao;
  v_em_espera    := public.painel_fila_em_espera(p_conta);
  v_estimativa   := public.painel_fila_estimativa_usd(p_conta);
  v_estimativa_n := public.painel_fila_estimativa_itens(p_conta);

  -- D21 (rodada 5, mantida): a elegibilidade é do `where`, não de um laço.
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

  -- Os que NÃO cabem (fila inteira, sem janela) e — B5 (rodada 6) — quantos
  -- CABEM sem tentar travar nada: se o escolhido é null e este número é > 0,
  -- o item elegível existe e está em uso por outra transação. Antes, esse
  -- caso caía em "fila vazia para esta conta" com a fila cheia.
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

  -- D27: o menor custo da fila INTEIRA (inclusive quem está de castigo) é um
  -- número separado — a frase que só olhava os disponíveis dizia "o mais
  -- barato da fila custa US$ 120,00" com três itens de US$ 5,00 em backoff.
  select min(f.custo_estimado_usd)
    into v_menor_fila
    from public.painel_fila_prompts f
   where f.conta = p_conta and f.estado = 'na_fila';

  -- Quem está de castigo: o mais barato e quando o primeiro deles volta.
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

  -- D27: a frase inteira vem da função PURA — um lugar só, testável ramo a
  -- ramo sem montar a fila (e sem precisar de duas conexões para o travado).
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
    p_estimativa_itens => v_estimativa_n
  );

  if v_escolhido is null then
    return jsonb_build_object(
      'ok', true, 'item', null,
      'devolvidos', v_devolvidos, 'mortos', v_mortos, 'pulados', v_pulados,
      'travados', v_travados,
      'mortos_usd', round(v_mortos_usd, 2),
      'em_espera', v_em_espera, 'headroom_usd', round(v_headroom, 2),
      'menor_custo_fila', round(v_menor_fila, 2),
      'menor_custo_elegivel_agora', round(v_menor_agora, 2),
      'estimativa_usd', round(v_estimativa, 2), 'estimativa_itens', v_estimativa_n,
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
    'em_espera', v_em_espera, 'headroom_usd', round(v_headroom, 2),
    'menor_custo_fila', round(v_menor_fila, 2),
    'menor_custo_elegivel_agora', round(v_menor_agora, 2),
    'estimativa_usd', round(v_estimativa, 2), 'estimativa_itens', v_estimativa_n,
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
  'D27/B5 (rodada 6): o motivo é ADITIVO — mortos; escolhido ou nada cabe; em espera (com o menor custo em backoff e quando ele volta); devolvidos; travados — concatenados por "; ", em português, com vírgula decimal e sem número negativo. menor_custo_fila (inclui backoff) e menor_custo_elegivel_agora saem como campos numéricos. Mantém D21 (elegibilidade no where) e D2/D19/D20; D26 grava ultimo_worker_id.';
revoke all on function public.fila_prompts_pegar_interno(text, text) from public, anon, authenticated;

-- ── 8 · fila_prompts_fechar_interno — o dono do item morto fecha (D26) ──────
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
  v_ultimo_dono boolean;
  v_reabrir     boolean;
begin
  if p_id is null then
    raise exception 'id é obrigatório.' using errcode = 'check_violation';
  end if;
  if p_conta is null
     or p_conta not in ('lucasscudeler@gmail.com','lsgpandora@gmail.com','almapetra.ltda@gmail.com')
  then
    raise exception 'conta precisa ser uma das 3 contas da casa.' using errcode = 'check_violation';
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
  if p_custo_usd < 0 or p_custo_usd > 500 then
    raise exception 'custo_usd fora da faixa aceita (0 a 500): %', p_custo_usd
      using errcode = 'check_violation';
  end if;

  v_sess := nullif(btrim(coalesce(p_session_id, '')), '');
  if v_sess is not null and v_sess = btrim(p_worker_id) then
    raise exception 'session_id é o id da sessão FILHA, não o da Routine' using errcode = 'check_violation';
  end if;

  select * into v_row from public.painel_fila_prompts
    where id = p_id and conta = p_conta for update;

  if not found then
    raise exception 'Item não encontrado ou não pertence à conta informada: %', p_id
      using errcode = 'check_violation';
  end if;

  -- D26 (rodada 6): a morte tira a posse VIVA para liberar a fila, não para
  -- proibir o único ator com o número honesto de entregá-lo. `v_ultimo_dono`
  -- é quem PEGOU o item e já não o tem; ele atravessa o fencing (e por isso a
  -- SEGUNDA chamada dele cai na idempotência de D8, em vez de bater num
  -- "Item pertence a outro worker (nenhum)" — medido no bloco T06).
  -- `v_reabrir` é o subconjunto que ainda vale reescrever: item morto cujo
  -- custo é ESTIMATIVA da casa.
  v_ultimo_dono := (
    v_row.worker_id is null
    and v_row.ultimo_worker_id is not null
    and v_row.ultimo_worker_id = btrim(p_worker_id)
  );
  v_reabrir := (v_row.estado = 'falhou' and v_ultimo_dono and v_row.custo_e_estimativa);

  if v_row.estado = 'na_fila' and v_row.worker_id is null then
    raise exception 'Item voltou para a fila (45 min sem sinal) — não pode ser fechado; ele será pego de novo: %', p_id
      using errcode = 'check_violation';
  end if;

  -- D1 · fencing: só quem pegou fecha (ou, por D26, quem tinha pegado).
  if not v_ultimo_dono and v_row.worker_id is distinct from p_worker_id then
    raise exception 'Item pertence a outro worker (%): %', coalesce(v_row.worker_id, 'nenhum'), p_id
      using errcode = 'check_violation';
  end if;

  if v_sess is not null then
    select f.id into v_outro from public.painel_fila_prompts f
      where f.session_id = v_sess and f.id <> p_id limit 1;
    if v_outro is not null then
      raise exception 'sessão já vinculada ao item %', v_outro using errcode = 'check_violation';
    end if;
  end if;

  if v_reabrir then
    update public.painel_fila_prompts
       set estado = p_estado,
           custo_usd = p_custo_usd,
           custo_e_estimativa = false,
           session_id = coalesce(v_sess, session_id),
           sessao_url = coalesce(p_sessao_url, sessao_url),
           resultado = coalesce(p_resultado, resultado),
           motivo_falha = case when p_estado = 'falhou' then motivo_falha else null end,
           heartbeat_em = null,
           disponivel_em = null,
           -- D25: o dinheiro entra no dia que o RECONHECE.
           concluido_em = now()
     where id = p_id;
    return jsonb_build_object(
      'ok', true, 'ja_fechado', false, 'reaberto_e_fechado', true, 'estado', p_estado
    );
  end if;

  -- D8 (rodada 3) · idempotência.
  if v_row.estado in ('concluida','falhou') then
    return jsonb_build_object(
      'ok', true, 'ja_fechado', true, 'reaberto_e_fechado', false, 'estado', v_row.estado
    );
  end if;

  -- D12 (rodada 4): item cancelado pelo operador durante a execução — a
  -- medição real SUBSTITUI a estimativa, o estado continua `cancelada`.
  if v_row.estado = 'cancelada' then
    update public.painel_fila_prompts
       set custo_usd = p_custo_usd,
           custo_e_estimativa = false,
           session_id = coalesce(v_sess, session_id),
           sessao_url = coalesce(p_sessao_url, sessao_url),
           resultado = coalesce(p_resultado, resultado),
           concluido_em = coalesce(concluido_em, now())
     where id = p_id;
    return jsonb_build_object(
      'ok', true, 'ja_fechado', false, 'reaberto_e_fechado', false, 'estado', 'cancelada'
    );
  end if;

  update public.painel_fila_prompts
     set estado = p_estado,
         custo_usd = p_custo_usd,
         custo_e_estimativa = false,
         session_id = coalesce(v_sess, session_id),
         sessao_url = coalesce(p_sessao_url, sessao_url),
         resultado = coalesce(p_resultado, resultado),
         heartbeat_em = null,
         disponivel_em = null,
         concluido_em = now()
   where id = p_id;

  return jsonb_build_object(
    'ok', true, 'ja_fechado', false, 'reaberto_e_fechado', false, 'estado', p_estado
  );
end;
$$;
comment on function public.fila_prompts_fechar_interno(uuid, text, text, text, numeric, text, text, text) is
  'D26 (rodada 6): o ÚLTIMO dono de um item morto (falhou, sem dono vivo, custo = estimativa da casa) fecha idempotentemente com o número medido — grava custo, apaga a marca de estimativa, vincula a sessão, carimba concluido_em = now() (D25) e devolve reaberto_e_fechado: true. Outro worker continua recusado pelo fencing. Mantém D8/D11/D12/D20.';
revoke all on function public.fila_prompts_fechar_interno(uuid, text, text, text, numeric, text, text, text) from public, anon, authenticated;

-- ── 9 · fila_prompts_cancelar — mensagem sem UUID, com acento (B2) ──────────
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

  -- B2 (rodada 5 do crítico): o 23514 é o único SQLSTATE cujo texto atravessa
  -- até a tela. Ele chegava como "Item nao encontrado ou ja fechado
  -- (concluida, falhou ou cancelada): 937a3479-f3b3-…" — sem acento e com id
  -- técnico na cara do operador.
  if not found or v_row.estado not in ('na_fila','pega') then
    raise exception 'Este item não está mais na fila — ele já foi concluído, falhou ou foi cancelado.'
      using errcode = 'check_violation';
  end if;

  v_codigo := case
    when v_row.estado = 'pega' then 'cancelado_em_execucao'
    when v_row.tentativas > 0 then 'cancelado_apos_devolucao'
    else 'cancelado_nunca_pego'
  end;

  if v_codigo <> 'cancelado_nunca_pego' and v_row.custo_usd is null then
    v_lancado := least(v_row.custo_estimado_usd, 500);
  end if;

  update public.painel_fila_prompts
     set estado = 'cancelada',
         heartbeat_em = null,
         disponivel_em = null,
         concluido_em = now(),
         ultimo_worker_id = coalesce(worker_id, ultimo_worker_id),
         custo_usd = case when v_lancado > 0 then v_lancado else custo_usd end,
         custo_e_estimativa = case when v_lancado > 0 then true else custo_e_estimativa end,
         motivo_falha = case v_codigo
           when 'cancelado_em_execucao' then 'cancelado pelo operador durante a execução'
           when 'cancelado_apos_devolucao' then format('cancelado pelo operador depois de %s tentativa(s)', v_row.tentativas)
           else motivo_falha end
   where id = p_id;

  return jsonb_build_object(
    'ok', true,
    'motivo_codigo', v_codigo,
    'tentativas', v_row.tentativas,
    'custo_lancado_usd', round(v_lancado, 2)
  );
end;
$$;
comment on function public.fila_prompts_cancelar(text, uuid) is
  'D12/#11 (rodada 4) + B2 (rodada 6): cancelar item que JÁ RODOU lança o custo ESTIMADO e devolve motivo_codigo; a recusa não cospe mais UUID na tela ("Este item não está mais na fila — ele já foi concluído, falhou ou foi cancelado."). D25: concluido_em = now(), e é esse dia que paga.';
revoke all on function public.fila_prompts_cancelar(text, uuid) from public;
grant execute on function public.fila_prompts_cancelar(text, uuid) to anon, authenticated;

-- ── 10 · fila_prompts_ajustar_custo — vincula a sessão (D26) + B2 ────────────
-- A aridade de 3 sai para a de 4 (o 4º com default) não ficar AMBÍGUA: com as
-- duas vivas, `rpc/fila_prompts_ajustar_custo` com 3 argumentos devolveria
-- "function is not unique" e a tela pararia de salvar.
drop function if exists public.fila_prompts_ajustar_custo(text, uuid, numeric);

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
  if p_custo_usd is null or p_custo_usd < 0 or p_custo_usd > 500 then
    raise exception 'O custo precisa ser um número entre 0 e 500.' using errcode = 'check_violation';
  end if;

  v_sess := nullif(btrim(coalesce(p_session_id, '')), '');

  select * into v_row from public.painel_fila_prompts where id = p_id for update;

  if not found then
    raise exception 'Item não encontrado na fila.' using errcode = 'check_violation';
  end if;
  if v_row.estado not in ('falhou','cancelada') then
    raise exception 'Só dá para ajustar o custo de item que falhou ou foi cancelado (este está %).', v_row.estado
      using errcode = 'check_violation';
  end if;
  -- D25: a MESMA régua de painel_fila_itens_do_dia — o dia do fechamento.
  if v_row.concluido_em is null
     or public.painel_dia_operador(v_row.concluido_em) <> public.painel_dia_operador() then
    raise exception 'Só dá para ajustar o custo de item fechado hoje.' using errcode = 'check_violation';
  end if;
  if not v_row.custo_e_estimativa then
    raise exception 'Só custo estimado pela casa pode ser ajustado; este foi medido.'
      using errcode = 'check_violation';
  end if;

  -- D26: o vínculo de sessão também se cria por aqui. Sem ele, a casa soma a
  -- estimativa do item MAIS o custo real da sessão que rodou (medido: 200 num
  -- trabalho de 80). Mesma trava de chave única do fechar/heartbeat.
  if v_sess is not null then
    select f.id into v_outro from public.painel_fila_prompts f
      where f.session_id = v_sess and f.id <> p_id limit 1;
    if v_outro is not null then
      raise exception 'Esta sessão já está vinculada a outro item da fila.' using errcode = 'check_violation';
    end if;
  end if;

  update public.painel_fila_prompts
     set custo_usd = p_custo_usd,
         custo_e_estimativa = false,
         session_id = coalesce(v_sess, session_id),
         custo_ajustado_em = now()
   where id = p_id;

  return jsonb_build_object(
    'ok', true, 'custo_usd', round(p_custo_usd, 2),
    'session_id', coalesce(v_sess, v_row.session_id)
  );
end;
$$;
comment on function public.fila_prompts_ajustar_custo(text, uuid, numeric, text) is
  'D20 + #3/#7 (rodada 5) + D26/B2 (rodada 6): ganha p_session_id para vincular a sessão que rodou (sem o vínculo, o dia soma estimativa + custo real); a recusa não cospe UUID; a régua do dia é concluido_em, a MESMA de painel_fila_itens_do_dia.';
revoke all on function public.fila_prompts_ajustar_custo(text, uuid, numeric, text) from public;
grant execute on function public.fila_prompts_ajustar_custo(text, uuid, numeric, text) to anon, authenticated;

-- ── 11 · fila_prompts_enfileirar — UMA RÉGUA no roteamento (D29) ────────────
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
  v_melhor_conta   text;
  v_melhor_espaco  numeric;
  v_codigo         text;
  v_cabe_hoje      boolean;
  rec              record;
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
     and v_conta not in ('lucasscudeler@gmail.com','lsgpandora@gmail.com','almapetra.ltda@gmail.com')
  then
    raise exception 'conta precisa ser uma das 3 contas da casa.' using errcode = 'check_violation';
  end if;

  if v_conta is null then
    -- D5 (rodada 3) · ESPELHO DECLARADO de `escolherConta` em
    -- `packages/lifeboard/src/core/prompts/roteador.ts`: a conta com MAIOR
    -- espaço livre (teto − medido − em_execucao − na_fila), empate pela ordem
    -- de `CONTAS` no TS.
    for rec in
      select
        t.conta    as conta,
        t.teto_usd as teto,
        public.painel_fila_consumo_hoje(t.conta) as medido,
        public.painel_fila_reservado(t.conta)    as em_execucao,
        public.painel_fila_na_fila(t.conta)      as esperando
      from public.painel_teto_diario t
      order by case t.conta
        when 'lucasscudeler@gmail.com' then 1
        when 'lsgpandora@gmail.com'    then 2
        when 'almapetra.ltda@gmail.com' then 3
        else 9 end
    loop
      v_espaco := rec.teto - rec.medido - rec.em_execucao - rec.esperando;
      if v_melhor_conta is null or v_espaco > v_melhor_espaco then
        v_melhor_conta := rec.conta;
        v_melhor_espaco := v_espaco;
      end if;
    end loop;

    if v_melhor_conta is null then
      raise exception 'fila: nenhuma conta configurada em painel_teto_diario.'
        using errcode = 'check_violation';
    end if;
    v_conta := v_melhor_conta;
  end if;

  select
    t.teto_usd - public.painel_fila_consumo_hoje(t.conta) - public.painel_fila_reservado(t.conta),
    public.painel_fila_na_fila(t.conta)
    into v_headroom, v_na_fila
    from public.painel_teto_diario t where t.conta = v_conta;

  v_headroom := coalesce(v_headroom, 0);
  v_na_fila := coalesce(v_na_fila, 0);
  v_espaco := v_headroom - v_na_fila;
  -- D29 (rodada 6): UMA RÉGUA. A conta é escolhida pelo ESPAÇO LIVRE (headroom
  -- − fila parada) e é o MESMO número que decide `cabe_hoje` — antes o
  -- veredito era do headroom e a escolha do espaço, e a frase resultante dizia
  -- "nenhuma conta tem US$ 50 livres" com uma conta de US$ 150 de headroom.
  v_cabe_hoje := v_estimado <= v_espaco;

  select count(*)::int into v_itens_frente
    from public.painel_fila_prompts f
    where f.conta = v_conta and f.estado = 'na_fila';

  v_codigo := case
    when p_payload->>'conta' is null or nullif(p_payload->>'conta','') is null then
      case when v_cabe_hoje then 'auto_maior_espaco' else 'auto_nao_cabe_hoje' end
    else
      case when v_cabe_hoje then 'manual_cabe' else 'manual_nao_cabe_hoje' end
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
    'itens_na_frente', v_itens_frente
  );
end;
$$;
comment on function public.fila_prompts_enfileirar(text, jsonb) is
  'D13/D14 (rodada 4) + D29 (rodada 6): devolve motivo_codigo e os números crus. UMA RÉGUA: cabe_hoje = estimado <= espaco_livre (headroom − na_fila), a MESMA que escolhe a conta — espelho de escolherConta em src/core/prompts/roteador.ts. Nenhuma frase: quem escreve em português é o TS.';
revoke all on function public.fila_prompts_enfileirar(text, jsonb) from public;
grant execute on function public.fila_prompts_enfileirar(text, jsonb) to anon, authenticated;
