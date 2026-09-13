-- =============================================================================
-- OS-LIFEBOARD · Migration 0013 — P7: RODADA 4, a contabilidade do gasto.
-- =============================================================================
-- Sobre 0007 + 0009 + 0011 + 0012. Tudo ADITIVO e RE-APLICÁVEL (`add column if
-- not exists`, `create or replace function`, `create index if not exists`,
-- `add constraint` dentro de bloco que engole `duplicate_object`). As únicas
-- remoções são ASSINATURAS de função substituídas por versões de aridade
-- diferente (`drop function if exists` com a assinatura exata) — sem isso o
-- Postgres devolve "function is not unique" na primeira chamada.
--
-- PRINCÍPIO DA RODADA (o crítico reprovou 14 achados, todos a mesma frase: "a
-- contabilidade erra para baixo e cala"): **o gasto do dia nunca diminui por
-- dado externo não validado; toda ambiguidade conta para cima e aparece na
-- tela.** Onde antes um dado ausente zerava o custo (sessão publicada sem
-- `custo_usd`, item cancelado no meio, item morto por estimativa), agora ele
-- mantém o maior dos dois números e MARCA a parcela que é estimativa.
--
-- As decisões desta rodada (D10–D20), na ordem em que aparecem:
--
--  D10 SUBTRAÇÃO, NÃO EXCLUSÃO. 0012 tirava o item do consumo pela MERA
--      EXISTÊNCIA de uma linha em `painel_frentes_sessoes` com o mesmo
--      `session_id` — e 21 das 215 sessões reais têm `custo_usd` NULO. Publicar
--      a sessão filha sem custo APAGAVA o custo medido pelo worker. Agora o
--      item contribui `greatest(custo_usd − coalesce(custo da sessão, 0), 0)`:
--      sem sessão publicada, o custo inteiro; com sessão publicada mais barata,
--      a diferença; com sessão publicada mais cara, zero (ela já cobre tudo).
--      Nunca soma duas vezes, nunca desce.
--
--  D11 `session_id` É CHAVE. Índice único parcial + recusa explícita de
--      `p_session_id = p_worker_id` ("é o id da sessão FILHA, não o da
--      Routine") e de um `session_id` já vinculado a outro item. Sem isso,
--      dois itens com o mesmo id de sessão dividiam (e perdiam) o mesmo
--      abatimento de D10.
--
--  D12 CANCELAR NÃO É PERDOAR. Cancelar um item `pega` grava `custo_usd` = o
--      ESTIMADO (conservador: quem estava rodando gastou) quando ainda não há
--      custo; `painel_fila_consumo_hoje` passa a somar `cancelada` que já teve
--      dono; e `fechar_interno` sobre `cancelada`, DO DONO, é aceito e só
--      troca `custo_usd`/`session_id` (o estado continua `cancelada`) — é o
--      caminho pelo qual a medição real substitui a estimativa.
--
--  D13 UMA RÉGUA SÓ. `headroom = teto − medido − em_execucao` decide admissão,
--      pull e tela. "Espaço livre com fila" (`headroom − na_fila`) serve só
--      para ESCOLHER a conta e para a previsão ("N itens na frente somam US$
--      X"). `cabe_hoje` = `estimado <= headroom`. A tela nunca mostra número
--      negativo (clamp em 0 + "sem espaço livre agora").
--
--  D14 O SQL NÃO ESCREVE FRASE. `fila_prompts_enfileirar` devolve
--      `motivo_codigo` + números; quem monta a frase (com acento, rótulo de
--      conta e vírgula decimal) é o TS — antes, o sucesso em modo live ia cru
--      para a tela ("roteamento automatico: maior espaco livre hoje (US$
--      150.00)").
--
--  D15 PAGINAÇÃO KEYSET DE VERDADE. `fila_prompts_listar(p_secret, p_limite,
--      p_antes_de, p_antes_id)` ordena por `(criado_em desc, id desc)` e
--      pagina por `(criado_em, id) < (p_antes_de, p_antes_id)`. `p_antes_de`
--      existia desde 0012 e NUNCA era usado pela tela (que só aumentava o
--      limite, morrendo no teto de 200).
--
--  D19 BACKOFF. Coluna `disponivel_em`: item devolvido por expiração só volta
--      a ser elegível depois de `15 min × tentativas`. O pull ignora quem
--      ainda está de castigo e NOMEIA quantos são.
--
--  D20 ESTIMATIVA MARCADA. Item morto sem fechar continua contando o estimado
--      (nunca perdoar), mas agora a parcela é rastreada (`custo_e_estimativa`)
--      e dita em voz alta no pull e na tela; e o operador tem porta de saída:
--      `fila_prompts_ajustar_custo` (secret-gated, só `falhou`/`cancelada` do
--      dia) grava o número real e apaga a marca (`custo_ajustado_em`).
--
--  #11 MENSAGENS QUE NÃO MENTEM. `cancelar` distingue "nunca foi pego" de
--      "voltou para a fila"; o pull que devolveu item e não pegou nada diz
--      "1 item devolvido para a fila, aguardando nova tentativa" em vez de
--      "fila vazia".
--  #12 `order by criado_em, id` — desempate explícito no pull e na listagem.
--  #14 `check (estado <> 'pega' or pego_em is not null)` — um `pega` com
--      `pego_em` nulo era imortal (nenhuma expiração o alcançava).
--
--  D16/D17/D18 são de TS e de DOC (fixture-store, teste-espelho que lê este
--  arquivo do disco, cadência de heartbeat no doc do worker) — o único SQL
--  correspondente é `expira_em` no retorno do heartbeat (D18), abaixo.
-- =============================================================================

-- ── 1 · colunas novas: backoff, marca de estimativa e ajuste do operador ────
alter table public.painel_fila_prompts
  add column if not exists disponivel_em      timestamptz,
  add column if not exists custo_e_estimativa boolean,
  add column if not exists custo_ajustado_em  timestamptz;

update public.painel_fila_prompts set custo_e_estimativa = false where custo_e_estimativa is null;
alter table public.painel_fila_prompts alter column custo_e_estimativa set default false;
alter table public.painel_fila_prompts alter column custo_e_estimativa set not null;

comment on column public.painel_fila_prompts.disponivel_em is
  'D19 (rodada 4): item devolvido por expiração só volta a ser elegível depois de 15 min × tentativas. O pull ignora quem tem disponivel_em no futuro e diz quantos são.';
comment on column public.painel_fila_prompts.custo_e_estimativa is
  'D20 (rodada 4): true quando o custo_usd NÃO foi medido por ninguém — foi lançado pela casa (item que morreu sem fechar, item cancelado em execução). A tela e o motivo do pull marcam esta parcela; fechar_interno e ajustar_custo a apagam ao gravar número medido.';
comment on column public.painel_fila_prompts.custo_ajustado_em is
  'D20 (rodada 4): quando o operador corrigiu o custo pela tela (fila_prompts_ajustar_custo). Registro de que aquele número deixou de ser estimativa da casa.';

create index if not exists painel_fila_prompts_disponivel_idx
  on public.painel_fila_prompts (conta, estado, disponivel_em);
create index if not exists painel_fila_prompts_ordem_idx
  on public.painel_fila_prompts (criado_em desc, id desc);

-- D11: `session_id` é CHAVE, não texto livre. Índice único parcial —
-- `session_id` nulo continua livre (item que nunca rodou).
drop index if exists public.painel_fila_prompts_session_idx; -- não-único, mesmo predicado
create unique index if not exists painel_fila_prompts_session_unico
  on public.painel_fila_prompts (session_id) where session_id is not null;

-- #14: um `pega` com `pego_em` nulo nunca expirava (`coalesce(heartbeat_em,
-- pego_em) < now() - 45 min` é falso quando os dois são nulos) — item imortal,
-- reservando orçamento para sempre. `not valid` + `validate` para não travar a
-- tabela nem falhar em linha histórica que já esteja fora do padrão.
do $$ begin
  alter table public.painel_fila_prompts
    add constraint painel_fila_prompts_pega_tem_pego_em
      check (estado <> 'pega' or pego_em is not null) not valid;
exception when duplicate_object then null;
end $$;
do $$ begin
  alter table public.painel_fila_prompts validate constraint painel_fila_prompts_pega_tem_pego_em;
exception when others then
  raise notice 'painel_fila_prompts_pega_tem_pego_em nao validada: %', sqlerrm;
end $$;

-- ── 2 · painel_fila_itens_do_dia — a contribuição de CADA item (D10/D12/D20) ─
-- Uma fonte só para "quanto este item ainda pesa no dia", usada pelo consumo,
-- pela parcela de estimativa e pela contagem de itens estimados. A subtração
-- (e não a exclusão) é o coração da rodada.
create or replace function public.painel_fila_itens_do_dia(p_conta text)
returns table (id uuid, contribuicao numeric, e_estimativa boolean)
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select
    f.id,
    -- D10: sem sessão publicada -> o custo inteiro. Com sessão publicada ->
    -- só o que o painel AINDA não viu (nunca negativo, nunca zerado por uma
    -- linha de sessão sem custo: `coalesce(s.custo_usd, 0)`).
    case
      when ses.custo_usd is null then f.custo_usd
      else greatest(f.custo_usd - ses.custo_usd, 0)
    end as contribuicao,
    f.custo_e_estimativa
  from public.painel_fila_prompts f
  left join lateral (
    select coalesce(s.custo_usd, 0) as custo_usd
    from public.painel_frentes_sessoes s
    where f.session_id is not null
      and s.sessao_id = f.session_id
      and s.conta = f.conta
      and public.painel_dia_operador(coalesce(s.atualizado_em, s.criado_em, s.publicado_em))
          = public.painel_dia_operador()
    order by coalesce(s.custo_usd, 0) desc
    limit 1
  ) ses on true
  where f.conta = p_conta
    and f.custo_usd is not null
    and f.concluido_em is not null
    and public.painel_dia_operador(f.concluido_em) = public.painel_dia_operador()
    and (
      f.estado in ('concluida', 'falhou')
      -- D12: cancelada que JÁ TEVE DONO gastou dinheiro (worker_id continua
      -- gravado no cancelamento). `tentativas > 0` cobre o item que foi pego,
      -- expirou (worker_id volta a null) e só depois foi cancelado — conta
      -- para cima, que é a regra desta rodada.
      or (f.estado = 'cancelada' and (f.worker_id is not null or f.tentativas > 0))
    );
$$;
comment on function public.painel_fila_itens_do_dia(text) is
  'D10/D12/D20 (rodada 4): contribuição de cada item da fila ao gasto do dia — greatest(custo_usd − custo da sessão publicada, 0), nunca a EXCLUSÃO do item (21 das 215 sessões reais têm custo_usd nulo; excluir apagava o custo medido pelo worker). Inclui cancelada que já teve dono. e_estimativa marca a parcela que ninguém mediu.';
revoke all on function public.painel_fila_itens_do_dia(text) from public, anon, authenticated;

-- ── 3 · painel_fila_consumo_hoje — soma das contribuições (D10) ─────────────
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
  v_dia  date := public.painel_dia_operador();
begin
  select coalesce(sum(c.custo_usd), 0) into v_view
    from public.painel_consumo_por_conta_dia c
    where c.conta = p_conta and c.dia = v_dia;

  select coalesce(sum(d.contribuicao), 0) into v_fila
    from public.painel_fila_itens_do_dia(p_conta) d;

  return coalesce(v_view, 0) + coalesce(v_fila, 0);
end;
$$;
comment on function public.painel_fila_consumo_hoje(text) is
  'Gasto MEDIDO do dia (fuso do operador): sessões publicadas + a contribuição de cada item da fila (D10 — subtração, não exclusão). Publicar a sessão filha SEM custo não abaixa mais o total; publicar COM custo maior faz o item contribuir zero.';
revoke all on function public.painel_fila_consumo_hoje(text) from public, anon, authenticated;

-- ── 4 · parcela de estimativa e itens em espera (D20/D19) ───────────────────
create or replace function public.painel_fila_estimativa_usd(p_conta text)
returns numeric
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select coalesce(sum(d.contribuicao), 0)
  from public.painel_fila_itens_do_dia(p_conta) d
  where d.e_estimativa;
$$;
comment on function public.painel_fila_estimativa_usd(text) is
  'D20 (rodada 4): quanto do consumo de hoje é ESTIMATIVA da casa (item que morreu sem fechar, item cancelado em execução) — a parcela que a tela e o motivo do pull precisam dizer em voz alta.';
revoke all on function public.painel_fila_estimativa_usd(text) from public, anon, authenticated;

create or replace function public.painel_fila_estimativa_itens(p_conta text)
returns integer
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select count(*)::int
  from public.painel_fila_itens_do_dia(p_conta) d
  where d.e_estimativa and d.contribuicao > 0;
$$;
comment on function public.painel_fila_estimativa_itens(text) is
  'D20 (rodada 4): quantos itens compõem a parcela estimada de hoje (o "N" de "US$ X do consumo são estimativa de N itens que morreram sem fechar").';
revoke all on function public.painel_fila_estimativa_itens(text) from public, anon, authenticated;

create or replace function public.painel_fila_em_espera(p_conta text)
returns integer
language sql
stable
set search_path = public, pg_temp
as $$
  select count(*)::int
  from public.painel_fila_prompts f
  where f.conta = p_conta
    and f.estado = 'na_fila'
    and f.disponivel_em is not null
    and f.disponivel_em > now();
$$;
comment on function public.painel_fila_em_espera(text) is
  'D19 (rodada 4): quantos itens estão em espera de nova tentativa (backoff de 15 min × tentativas depois de uma expiração) — o pull os ignora e os nomeia no motivo.';
revoke all on function public.painel_fila_em_espera(text) from public, anon, authenticated;

-- ── 5 · fila_prompts_enfileirar — código de motivo + números (D13/D14) ──────
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
    -- D5 (rodada 3, mantida) · ESPELHO DECLARADO de `escolherConta` em
    -- `packages/lifeboard/src/core/prompts/roteador.ts`: a conta com MAIOR
    -- espaço livre (teto − medido − em_execucao − na_fila), empate pela ordem
    -- de `CONTAS` no TS. O `na_fila` entra SÓ aqui, para ESCOLHER.
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

  -- D13 · UMA RÉGUA: `headroom` decide `cabe_hoje` (o mesmo número que o pull
  -- compara). `espaco_livre` (headroom − na_fila) é previsão, nunca veredito.
  select
    t.teto_usd - public.painel_fila_consumo_hoje(t.conta) - public.painel_fila_reservado(t.conta),
    public.painel_fila_na_fila(t.conta)
    into v_headroom, v_na_fila
    from public.painel_teto_diario t where t.conta = v_conta;

  v_headroom := coalesce(v_headroom, 0);
  v_na_fila := coalesce(v_na_fila, 0);
  v_espaco := v_headroom - v_na_fila;
  v_cabe_hoje := v_estimado <= v_headroom;

  select count(*)::int into v_itens_frente
    from public.painel_fila_prompts f
    where f.conta = v_conta and f.estado = 'na_fila';

  -- D14 · o SQL não escreve frase: devolve o CÓDIGO e os números; a frase (com
  -- acento, rótulo da conta e vírgula decimal) nasce em `src/app/prompts/
  -- actions.ts`, no mesmo formatador que já trata a recusa.
  v_codigo := case
    when p_payload->>'conta' is null or nullif(p_payload->>'conta','') is null then
      case when v_cabe_hoje then 'auto_maior_espaco' else 'auto_nao_cabe_hoje' end
    else
      case when v_cabe_hoje then 'manual_cabe' else 'manual_nao_cabe_hoje' end
  end;

  -- O trigger pode recusar (D3: só `estimado > teto` ou conta inexistente) —
  -- propositalmente NÃO capturado: a mensagem em português dele é a que o
  -- painel mostra. `custo_estimado_usd` nunca vem de fora.
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
  'D13/D14 (rodada 4): devolve motivo_codigo (auto_maior_espaco | auto_nao_cabe_hoje | manual_cabe | manual_nao_cabe_hoje) e os números crus — headroom_usd (a régua: teto − medido − em_execucao), espaco_livre_usd (headroom − na_fila, só previsão), custo_estimado_usd, na_fila_usd, itens_na_frente. cabe_hoje = estimado <= headroom. Nenhuma frase: quem escreve em português é o TS.';

-- ── 6 · fila_prompts_pegar_interno — backoff, desempate e parcela (D19/#11/#12) ─
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
  v_estimativa      numeric;
  v_estimativa_n    integer;
  v_devolvidos      integer := 0;
  v_mortos          integer := 0;
  v_pulados         integer := 0;
  v_em_espera       integer := 0;
  v_devolvidos_ids  uuid[] := '{}'::uuid[];
  v_menor_nao_coube numeric;
  v_escolhido       uuid;
  v_row             public.painel_fila_prompts%rowtype;
  v_motivo          text;
  rec               record;
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
  perform 1 from public.painel_teto_diario where conta = p_conta for update;

  -- D2 (rodada 3) + D19 (rodada 4): expira por 45 min SEM SINAL; quem volta
  -- para a fila cumpre backoff de 15 min × tentativas antes de ser elegível de
  -- novo (antes, o item que matava a sessão voltava na hora e queimava o teto
  -- do dia em três voltas seguidas).
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
           disponivel_em = now() + (interval '15 minutes' * greatest(f.tentativas, 1))
      from alvo a
     where f.id = a.id and a.tentativas < a.max_tentativas
    returning f.id
  ),
  mor as (
    update public.painel_fila_prompts f
       set estado = 'falhou',
           worker_id = null,
           heartbeat_em = null,
           motivo_falha = format('expirou %s vezes sem fechamento', f.tentativas),
           -- Conservador: quem sumiu provavelmente gastou. D20: a parcela fica
           -- MARCADA como estimativa, para a tela poder dizer isso.
           custo_usd = least(f.custo_estimado_usd, 500),
           custo_e_estimativa = true,
           concluido_em = now()
      from alvo a
     where f.id = a.id and a.tentativas >= a.max_tentativas
    returning f.id
  )
  select
    coalesce((select array_agg(d.id) from dev d), '{}'::uuid[]),
    (select count(*) from dev),
    (select count(*) from mor)
  into v_devolvidos_ids, v_devolvidos, v_mortos;

  select teto_usd into v_teto from public.painel_teto_diario where conta = p_conta;
  if v_teto is null then v_teto := 150; end if;

  v_medido     := public.painel_fila_consumo_hoje(p_conta);
  v_execucao   := public.painel_fila_reservado(p_conta);
  v_em_espera  := public.painel_fila_em_espera(p_conta);
  v_estimativa := public.painel_fila_estimativa_usd(p_conta);
  v_estimativa_n := public.painel_fila_estimativa_itens(p_conta);

  -- D3 (rodada 3): elegibilidade POR ITEM — o mais antigo que CABE, pulando os
  -- que não cabem. #12: desempate explícito por `id` (dois itens criados no
  -- mesmo microssegundo tinham ordem indefinida entre uma chamada e outra).
  -- D19: quem está de castigo não é candidato.
  for rec in
    select f.id, f.custo_estimado_usd
    from public.painel_fila_prompts f
    where f.conta = p_conta
      and f.estado = 'na_fila'
      and f.id <> all (v_devolvidos_ids)
      and (f.disponivel_em is null or f.disponivel_em <= now())
    order by f.criado_em asc, f.id asc
    limit 50
    for update skip locked
  loop
    if v_medido + v_execucao + rec.custo_estimado_usd <= v_teto then
      v_escolhido := rec.id;
      exit;
    end if;
    v_pulados := v_pulados + 1;
    if v_menor_nao_coube is null or rec.custo_estimado_usd < v_menor_nao_coube then
      v_menor_nao_coube := rec.custo_estimado_usd;
    end if;
  end loop;

  if v_escolhido is null then
    -- #11: cada caso tem o seu nome. "Fila vazia" só quando ela está vazia
    -- mesmo — devolver um item e dizer "fila vazia" era a mentira medida.
    v_motivo := case
      when v_menor_nao_coube is not null then
        format('nada cabe agora: o mais barato da fila custa US$ %s e so ha US$ %s livres (medido US$ %s + em execucao US$ %s de teto US$ %s)',
          round(v_menor_nao_coube, 2), round(v_teto - v_medido - v_execucao, 2),
          round(v_medido, 2), round(v_execucao, 2), round(v_teto, 2))
      when v_devolvidos > 0 then
        format('%s item(ns) devolvido(s) para a fila, aguardando nova tentativa', v_devolvidos)
      when v_em_espera > 0 then
        format('%s item(ns) em espera de nova tentativa', v_em_espera)
      else 'fila vazia para esta conta'
    end;
    -- D20: a parcela estimada é dita em voz alta, sempre que existir.
    if v_estimativa > 0 then
      v_motivo := v_motivo || format(' · US$ %s do consumo sao estimativa de %s item(ns) que morreram sem fechar',
        round(v_estimativa, 2), v_estimativa_n);
    end if;

    return jsonb_build_object(
      'ok', true, 'item', null,
      'devolvidos', v_devolvidos, 'mortos', v_mortos, 'pulados', v_pulados,
      'em_espera', v_em_espera,
      'estimativa_usd', round(v_estimativa, 2), 'estimativa_itens', v_estimativa_n,
      'motivo', v_motivo
    );
  end if;

  update public.painel_fila_prompts
     set estado = 'pega',
         worker_id = p_worker_id,
         pego_em = now(),
         heartbeat_em = now(),
         disponivel_em = null,
         tentativas = tentativas + 1
   where id = v_escolhido
  returning * into v_row;

  return jsonb_build_object(
    'ok', true,
    'devolvidos', v_devolvidos, 'mortos', v_mortos, 'pulados', v_pulados,
    'em_espera', v_em_espera,
    'estimativa_usd', round(v_estimativa, 2), 'estimativa_itens', v_estimativa_n,
    'motivo', null,
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
  'D19/#11/#12 (rodada 4): backoff de 15 min × tentativas para quem volta por expiração (disponivel_em), desempate explícito por (criado_em, id), motivo que distingue "devolvido aguardando nova tentativa" de "fila vazia", e a parcela de estimativa (D20) nomeada no retorno.';
revoke all on function public.fila_prompts_pegar_interno(text, text) from public, anon, authenticated;

-- ── 7 · fila_prompts_heartbeat_interno — session_id é chave + expira_em ─────
create or replace function public.fila_prompts_heartbeat_interno(
  p_id uuid, p_conta text, p_worker_id text, p_session_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row   public.painel_fila_prompts%rowtype;
  v_sess  text;
  v_outro uuid;
begin
  if p_id is null or p_worker_id is null then
    raise exception 'id e worker_id sao obrigatorios.' using errcode = 'check_violation';
  end if;

  v_sess := nullif(btrim(coalesce(p_session_id, '')), '');
  -- D11: o erro que o doc entregava em bandeja (dois ids no mesmo bloco).
  if v_sess is not null and v_sess = btrim(p_worker_id) then
    raise exception 'session_id é o id da sessão FILHA, não o da Routine' using errcode = 'check_violation';
  end if;

  select * into v_row from public.painel_fila_prompts
    where id = p_id and conta = p_conta for update;

  if not found then
    return jsonb_build_object('ok', false, 'motivo', 'inexistente');
  end if;
  -- D7 (rodada 3): o operador cancelou pela tela enquanto a filha rodava.
  if v_row.estado = 'cancelada' then
    return jsonb_build_object('ok', false, 'motivo', 'cancelado');
  end if;
  if v_row.worker_id is distinct from p_worker_id then
    return jsonb_build_object('ok', false, 'motivo', 'outro worker');
  end if;
  if v_row.estado <> 'pega' then
    return jsonb_build_object('ok', false, 'motivo', format('item esta %s', v_row.estado));
  end if;

  if v_sess is not null then
    select f.id into v_outro from public.painel_fila_prompts f
      where f.session_id = v_sess and f.id <> p_id limit 1;
    if v_outro is not null then
      raise exception 'sessão já vinculada ao item %', v_outro using errcode = 'check_violation';
    end if;
  end if;

  update public.painel_fila_prompts
     set heartbeat_em = now(),
         session_id = coalesce(v_sess, session_id)
   where id = p_id
  returning * into v_row;

  return jsonb_build_object(
    'ok', true, 'motivo', null,
    'heartbeatEm', v_row.heartbeat_em,
    -- D18: a Routine precisa VER o relógio, não decorá-lo.
    'expira_em', v_row.heartbeat_em + interval '45 minutes',
    'sessionId', v_row.session_id,
    'tentativas', v_row.tentativas, 'maxTentativas', v_row.max_tentativas
  );
end;
$$;
comment on function public.fila_prompts_heartbeat_interno(uuid, text, text, text) is
  'D11/D18 (rodada 4): recusa p_session_id = p_worker_id ("session_id é o id da sessão FILHA, não o da Routine") e session_id já vinculado a outro item; devolve expira_em (heartbeat + 45 min) para a Routine ver quanto tempo lhe resta.';
revoke all on function public.fila_prompts_heartbeat_interno(uuid, text, text, text) from public, anon, authenticated;

-- ── 8 · fila_prompts_fechar_interno — chave, cancelada e marca (D11/D12/D20) ─
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
  v_row   public.painel_fila_prompts%rowtype;
  v_sess  text;
  v_outro uuid;
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
    raise exception 'custo_usd e obrigatorio ao fechar (use 0 quando nao houver custo).'
      using errcode = 'check_violation';
  end if;
  if p_custo_usd < 0 or p_custo_usd > 500 then
    raise exception 'custo_usd fora da faixa aceita (0 a 500): %', p_custo_usd
      using errcode = 'check_violation';
  end if;

  v_sess := nullif(btrim(coalesce(p_session_id, '')), '');
  -- D11: os dois ids vinham do mesmo bloco do doc; confundi-los fazia o
  -- abatimento de D10 procurar uma sessão que nunca seria publicada.
  if v_sess is not null and v_sess = btrim(p_worker_id) then
    raise exception 'session_id é o id da sessão FILHA, não o da Routine' using errcode = 'check_violation';
  end if;

  select * into v_row from public.painel_fila_prompts
    where id = p_id and conta = p_conta for update;

  if not found then
    raise exception 'Item nao encontrado ou nao pertence a conta informada: %', p_id
      using errcode = 'check_violation';
  end if;

  if v_row.estado = 'na_fila' and v_row.worker_id is null then
    raise exception 'Item voltou para a fila (45 min sem sinal) — nao pode ser fechado; ele sera pego de novo: %', p_id
      using errcode = 'check_violation';
  end if;

  -- D1 · fencing: só quem pegou fecha.
  if v_row.worker_id is distinct from p_worker_id then
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

  -- D8 (rodada 3) · idempotência.
  if v_row.estado in ('concluida','falhou') then
    return jsonb_build_object('ok', true, 'ja_fechado', true, 'estado', v_row.estado);
  end if;

  -- D12 (rodada 4): item cancelado pelo operador durante a execução gastou
  -- dinheiro e o cancelamento lançou o ESTIMADO. Quando o worker volta com o
  -- número medido, ele SUBSTITUI a estimativa — o estado continua `cancelada`
  -- (a decisão do operador não é revogada por uma chamada de worker).
  if v_row.estado = 'cancelada' then
    update public.painel_fila_prompts
       set custo_usd = p_custo_usd,
           custo_e_estimativa = false,
           session_id = coalesce(v_sess, session_id),
           sessao_url = coalesce(p_sessao_url, sessao_url),
           resultado = coalesce(p_resultado, resultado),
           concluido_em = coalesce(concluido_em, now())
     where id = p_id;
    return jsonb_build_object('ok', true, 'ja_fechado', false, 'estado', 'cancelada');
  end if;

  update public.painel_fila_prompts
     set estado = p_estado,
         custo_usd = p_custo_usd,
         -- D20: número medido por gente apaga a marca de estimativa.
         custo_e_estimativa = false,
         session_id = coalesce(v_sess, session_id),
         sessao_url = coalesce(p_sessao_url, sessao_url),
         resultado = coalesce(p_resultado, resultado),
         heartbeat_em = null,
         disponivel_em = null,
         concluido_em = now()
   where id = p_id;

  return jsonb_build_object('ok', true, 'ja_fechado', false, 'estado', p_estado);
end;
$$;
comment on function public.fila_prompts_fechar_interno(uuid, text, text, text, numeric, text, text, text) is
  'D11/D12/D20 (rodada 4): recusa session_id = worker_id e session_id já vinculado a outro item; aceita fechamento sobre item CANCELADO do próprio dono (troca só custo_usd/session_id, estado continua cancelada) para a medição real substituir a estimativa; apaga a marca custo_e_estimativa ao gravar número medido.';
revoke all on function public.fila_prompts_fechar_interno(uuid, text, text, text, numeric, text, text, text) from public, anon, authenticated;

-- ── 9 · fila_prompts_cancelar — lança o estimado e distingue os casos (D12/#11) ─
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
      'fila_prompts_cancelar: segredo nao configurado — inserir a chave load_secret em private.lifeboard_config (ver DEPLOY.md)'
      using errcode = 'config_file_error';
  end if;
  if p_secret is null or p_secret <> v_expected then
    raise exception 'fila_prompts_cancelar: acesso negado' using errcode = 'insufficient_privilege';
  end if;
  if p_id is null then
    raise exception 'id é obrigatório.' using errcode = 'check_violation';
  end if;

  select * into v_row from public.painel_fila_prompts where id = p_id for update;

  if not found or v_row.estado not in ('na_fila','pega') then
    raise exception 'Item nao encontrado ou ja fechado (concluida, falhou ou cancelada): %', p_id
      using errcode = 'check_violation';
  end if;

  -- #11: três histórias diferentes, três códigos diferentes.
  --  · nunca foi pego  -> ninguém gastou nada; cancelar é de graça.
  --  · voltou para a fila (já foi pego antes) -> alguém gastou e ninguém mediu.
  --  · em execução agora -> D12: lança o ESTIMADO, conservador.
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
         custo_usd = case when v_lancado > 0 then v_lancado else custo_usd end,
         custo_e_estimativa = case when v_lancado > 0 then true else custo_e_estimativa end,
         motivo_falha = case v_codigo
           when 'cancelado_em_execucao' then 'cancelado pelo operador durante a execucao'
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
  'D12/#11 (rodada 4): cancelar item que JÁ RODOU lança o custo ESTIMADO (marcado como estimativa) em vez de zerar o gasto do dia; devolve motivo_codigo distinguindo cancelado_nunca_pego × cancelado_apos_devolucao × cancelado_em_execucao, para a tela dizer a verdade de cada caso.';

-- ── 10 · fila_prompts_ajustar_custo — a porta de saída do operador (D20) ────
create or replace function public.fila_prompts_ajustar_custo(
  p_secret text, p_id uuid, p_custo_usd numeric
)
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
      'fila_prompts_ajustar_custo: segredo nao configurado — inserir a chave load_secret em private.lifeboard_config (ver DEPLOY.md)'
      using errcode = 'config_file_error';
  end if;
  if p_secret is null or p_secret <> v_expected then
    raise exception 'fila_prompts_ajustar_custo: acesso negado' using errcode = 'insufficient_privilege';
  end if;
  if p_id is null then
    raise exception 'id é obrigatório.' using errcode = 'check_violation';
  end if;
  if p_custo_usd is null or p_custo_usd < 0 or p_custo_usd > 500 then
    raise exception 'O custo precisa ser um número entre 0 e 500.' using errcode = 'check_violation';
  end if;

  select * into v_row from public.painel_fila_prompts where id = p_id for update;

  if not found then
    raise exception 'Item nao encontrado: %', p_id using errcode = 'check_violation';
  end if;
  -- Só o que a casa estimou pode ser corrigido, e só no dia — corrigir o
  -- passado reescreveria um teto que já foi respeitado (ou estourado).
  if v_row.estado not in ('falhou','cancelada') then
    raise exception 'Só dá para ajustar o custo de item que falhou ou foi cancelado (este está %s).', v_row.estado
      using errcode = 'check_violation';
  end if;
  if v_row.concluido_em is null
     or public.painel_dia_operador(v_row.concluido_em) <> public.painel_dia_operador() then
    raise exception 'Só dá para ajustar o custo de item fechado hoje.' using errcode = 'check_violation';
  end if;

  update public.painel_fila_prompts
     set custo_usd = p_custo_usd,
         custo_e_estimativa = false,
         custo_ajustado_em = now()
   where id = p_id;

  return jsonb_build_object('ok', true, 'custo_usd', round(p_custo_usd, 2));
end;
$$;
comment on function public.fila_prompts_ajustar_custo(text, uuid, numeric) is
  'D20 (rodada 4): o operador corrige, pela tela, o custo de um item falhou/cancelada FECHADO HOJE cujo número era estimativa da casa. Grava custo_ajustado_em e apaga a marca de estimativa. Secret-gated, como as demais RPCs do painel.';

-- ── 11 · fila_prompts_listar — keyset de verdade (D15) + números da tela ────
drop function if exists public.fila_prompts_listar(text, integer, timestamptz);

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
      'fila_prompts_listar: segredo nao configurado — inserir a chave load_secret em private.lifeboard_config (ver DEPLOY.md)'
      using errcode = 'config_file_error';
  end if;
  if p_secret is null or p_secret <> v_expected then
    raise exception 'fila_prompts_listar: acesso negado' using errcode = 'insufficient_privilege';
  end if;

  -- O limite é de PÁGINA (1..200). Não há mais teto de total: a tela avança
  -- por cursor, e 205 itens saem em 5 páginas de 50 (D15) — antes, "mostrar
  -- mais" só engordava o limite e morria em 200.
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
          'medidoAteEm', public.painel_fila_medido_ate(t.conta)
        ) order by case t.conta
          when 'lucasscudeler@gmail.com' then 1
          when 'lsgpandora@gmail.com'    then 2
          when 'almapetra.ltda@gmail.com' then 3
          else 9 end)
        from public.painel_teto_diario t
      ), '[]'::jsonb),
      'limite', v_limite,
      'temMais', (select count(*) from pagina) > v_limite,
      -- D15: o cursor do ÚLTIMO item desta página — é o que a tela guarda em
      -- `?antes=<iso>&antesId=<uuid>`.
      'proximoAntesDe', (select v.criado_em from visivel v order by v.criado_em asc, v.id asc limit 1),
      'proximoAntesId', (select v.id from visivel v order by v.criado_em asc, v.id asc limit 1)
    )
  into v_result;

  return v_result;
end;
$$;
comment on function public.fila_prompts_listar(text, integer, timestamptz, uuid) is
  'D15 (rodada 4): paginação keyset real — ordena por (criado_em desc, id desc) e corta por (criado_em, id) < (p_antes_de, p_antes_id); devolve proximoAntesDe/proximoAntesId, o cursor que a tela põe na URL. Consumo por conta ganha estimativaUsd/estimativaItens (D20) e emEspera (D19).';

-- ── 12 · privilégios (mesma disciplina das rodadas anteriores) ──────────────
revoke all on function public.fila_prompts_listar(text, integer, timestamptz, uuid) from public;
grant execute on function public.fila_prompts_listar(text, integer, timestamptz, uuid) to anon, authenticated;
revoke all on function public.fila_prompts_enfileirar(text, jsonb) from public;
grant execute on function public.fila_prompts_enfileirar(text, jsonb) to anon, authenticated;
revoke all on function public.fila_prompts_cancelar(text, uuid) from public;
grant execute on function public.fila_prompts_cancelar(text, uuid) to anon, authenticated;
revoke all on function public.fila_prompts_ajustar_custo(text, uuid, numeric) from public;
grant execute on function public.fila_prompts_ajustar_custo(text, uuid, numeric) to anon, authenticated;
