-- =============================================================================
-- OS-LIFEBOARD · Migration 0012 — P7: RODADA 3 (desenho, não remendo).
-- =============================================================================
-- Sobre 0007 + 0009 + 0011. Tudo ADITIVO e RE-APLICÁVEL: `alter table … add
-- column if not exists`, `create or replace function`. Nenhuma tabela/coluna
-- é removida. As únicas remoções são ASSINATURAS ANTIGAS de função que foram
-- SUBSTITUÍDAS por versões de aridade diferente (`drop function if exists`
-- com a assinatura exata) — sem isso o Postgres devolveria "function is not
-- unique" no primeiro `select` do worker, e a versão velha (sem posse, sem
-- tentativa) continuaria chamável.
--
-- As 9 decisões de desenho desta rodada (D1–D9), na ordem em que aparecem:
--
--  D1 POSSE (fencing) + HEARTBEAT. O worker deixa de ser anônimo. Colunas
--     novas em `painel_fila_prompts`: `worker_id` (o id da sessão da Routine
--     que pegou), `heartbeat_em` (último sinal de vida), `tentativas` /
--     `max_tentativas`, `session_id` (a sessão FILHA criada pelo
--     `create_session`) e `motivo_falha`. `pegar_interno` passa a exigir
--     `p_worker_id`; `fechar_interno` só aceita de QUEM PEGOU.
--
--  D2 EXPIRAÇÃO COM FIM. 0011 devolvia para `na_fila` todo item `pega` há
--     mais de 6h, para sempre — um item que mata a sessão toda vez ficava em
--     loop infinito, gastando dinheiro a cada volta. Agora a régua é o
--     HEARTBEAT (45 min sem sinal, não 6h de relógio) e a volta tem fim:
--     `tentativas < max_tentativas` → volta para `na_fila`; senão → `falhou`
--     com `motivo_falha` e `custo_usd` = o ESTIMADO da complexidade (quem
--     sumiu provavelmente gastou — o conservador é contar, não perdoar).
--     Item devolvido NÃO pode ser re-pego pela mesma chamada que o devolveu.
--     Contagem: `tentativas` conta PEGADAS (só `pegar_interno` incrementa), e
--     a expiração compara o valor JÁ incrementado — por isso um item pego 3
--     vezes e morto na 3ª expiração diz, com verdade, "expirou 3 vezes".
--
--  D3 ELEGIBILIDADE POR ITEM, não reserva agregada. `painel_fila_reservado`
--     passa a somar SÓ o que está EM EXECUÇÃO (`pega` com heartbeat vivo) —
--     `na_fila` não reserva mais nada. A fila deixa de se auto-bloquear: o
--     que decide é se ESTE item cabe (`medido + em_execucao + estimado <=
--     teto`), item a item, pulando os que não cabem. A admissão
--     (`enfileirar` + trigger) só recusa o que NUNCA vai caber
--     (`estimado > teto`) ou conta inexistente — item que não cabe HOJE
--     entra na fila e espera espaço.
--
--  D5 DESEMPATE ÚNICO. O roteamento automático escolhe a conta com MAIOR
--     ESPAÇO LIVRE (`teto − medido − em_execucao − soma dos na_fila dela`);
--     em empate, a ordem é a de `CONTAS` no TS: lucasscudeler, lsgpandora,
--     almapetra. A regra mora em UM lugar só —
--     `packages/lifeboard/src/core/prompts/roteador.ts` — e o `case` abaixo
--     é o espelho declarado dela.
--
--  D6 CUSTO SEM DUPLA CONTAGEM. `fechar_interno` grava `session_id`;
--     `painel_fila_consumo_hoje` NÃO soma o item da fila cuja sessão já
--     aparece em `painel_frentes_sessoes` (mesma conta, mesmo dia do
--     operador) — a medição publicada prevalece, o item só vale enquanto a
--     sessão não foi publicada.
--
--  D7 ITEM `pega` NÃO É BECO SEM SAÍDA. `fila_prompts_cancelar` aceita
--     `na_fila` E `pega`; `fila_prompts_heartbeat_interno` devolve
--     `{ok:false, motivo:'cancelado'}` para o worker parar a sessão filha.
--
--  D8 IDEMPOTÊNCIA E PAGINAÇÃO. Segundo `fechar_interno` do MESMO worker
--     sobre item já fechado por ele → `{ok:true, ja_fechado:true}` (sem
--     erro); de outro worker → erro de posse. `fila_prompts_listar` ganha
--     `p_limite`/`p_antes_de` e trunca o prompt em 300 caracteres
--     (`prompt_tamanho` diz o tamanho real).
--
--  D4/D9 são de DOC e de TELA (laço do worker no doc do hub; textos em
--     `core/prompts/tipos.ts` + `conta-card.tsx`) — nada de SQL.
-- =============================================================================

-- ── 1 · colunas de posse, sinal de vida e tentativa (D1) ────────────────────
alter table public.painel_fila_prompts
  add column if not exists worker_id      text,
  add column if not exists heartbeat_em   timestamptz,
  add column if not exists tentativas     int,
  add column if not exists max_tentativas int,
  add column if not exists session_id     text,
  add column if not exists motivo_falha   text;

update public.painel_fila_prompts set tentativas = 0 where tentativas is null;
update public.painel_fila_prompts set max_tentativas = 3 where max_tentativas is null;

alter table public.painel_fila_prompts alter column tentativas set default 0;
alter table public.painel_fila_prompts alter column tentativas set not null;
alter table public.painel_fila_prompts alter column max_tentativas set default 3;
alter table public.painel_fila_prompts alter column max_tentativas set not null;

do $$ begin
  alter table public.painel_fila_prompts
    add constraint painel_fila_prompts_tentativas_check
      check (tentativas >= 0 and max_tentativas >= 1);
exception when duplicate_object then null;
end $$;

comment on column public.painel_fila_prompts.worker_id is
  'D1 (rodada 3): id da sessão da Routine que PEGOU este item (get_session sem argumento → session_id). Só ele fecha — fencing token, não identidade.';
comment on column public.painel_fila_prompts.heartbeat_em is
  'D1/D2 (rodada 3): último sinal de vida do worker. 45 min sem sinal = expirado (a régua deixou de ser "pego há 6h" — uma sessão longa e viva não pode ser roubada, uma sessão morta há 46 min não pode segurar orçamento).';
comment on column public.painel_fila_prompts.tentativas is
  'D2 (rodada 3): quantas vezes este item já foi PEGO. Ao chegar em max_tentativas sem fechamento, vira falhou — a volta para a fila tem fim.';
comment on column public.painel_fila_prompts.session_id is
  'D1/D6 (rodada 3): id da sessão FILHA criada pelo create_session. É a chave do dedupe contra painel_frentes_sessoes (a medição publicada prevalece sobre o custo informado no fechamento).';
comment on column public.painel_fila_prompts.motivo_falha is
  'D2 (rodada 3): por que o item virou falhou sem o worker dizer nada (ex.: "expirou 3 vezes sem fechamento").';

create index if not exists painel_fila_prompts_heartbeat_idx
  on public.painel_fila_prompts (conta, estado, heartbeat_em);
create index if not exists painel_fila_prompts_session_idx
  on public.painel_fila_prompts (session_id) where session_id is not null;

-- ── 2 · painel_fila_reservado — SÓ o que está em execução (D3) ──────────────
-- Antes somava `na_fila` + `pega`. Consequência medida pelo crítico: a fila
-- reservava contra si mesma — 3 itens `maxima` enfileirados (360) travavam
-- uma conta de teto 150 mesmo sem NADA estar rodando, e nenhum deles rodava
-- nunca. Reserva agora é só trabalho EM CURSO (pega com heartbeat vivo); o
-- que está `na_fila` é intenção, não gasto, e a elegibilidade passa a ser
-- decidida item a item na hora do pull.
create or replace function public.painel_fila_reservado(p_conta text)
returns numeric
language sql
stable
set search_path = public, pg_temp
as $$
  select coalesce(sum(f.custo_estimado_usd), 0)
  from public.painel_fila_prompts f
  where f.conta = p_conta
    and f.estado = 'pega'
    -- `coalesce(heartbeat_em, pego_em)`: um item pego por uma versao antiga da
    -- RPC (sem heartbeat) nao pode virar imortal — o `pego_em` serve de sinal
    -- inicial, e o proximo pull o expira normalmente.
    and coalesce(f.heartbeat_em, f.pego_em) >= now() - interval '45 minutes';
$$;
comment on function public.painel_fila_reservado(text) is
  'D3 (rodada 3): soma do ESTIMADO do que está EM EXECUÇÃO agora (pega com heartbeat vivo, < 45 min). na_fila NÃO entra — reserva agregada de fila travava a própria fila.';
revoke all on function public.painel_fila_reservado(text) from public, anon, authenticated;

-- ── 3 · painel_fila_na_fila — o que ESPERA (só para ESCOLHER a conta, D5) ───
create or replace function public.painel_fila_na_fila(p_conta text)
returns numeric
language sql
stable
set search_path = public, pg_temp
as $$
  select coalesce(sum(f.custo_estimado_usd), 0)
  from public.painel_fila_prompts f
  where f.conta = p_conta and f.estado = 'na_fila';
$$;
comment on function public.painel_fila_na_fila(text) is
  'D3/D5 (rodada 3): soma do estimado do que está na_fila. Usada SÓ para ESCOLHER a conta com mais espaço livre no roteamento automático — nunca para RECUSAR um item (item que não cabe hoje entra e espera).';
revoke all on function public.painel_fila_na_fila(text) from public, anon, authenticated;

-- ── 4 · painel_fila_consumo_hoje — dedupe por session_id (D6) ───────────────
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

  -- D6: o item da fila só conta enquanto a sessão dele NÃO foi publicada em
  -- painel_frentes_sessoes. Quando a Routine de publicar sessões já trouxe
  -- aquela sessão (mesma conta, mesmo dia do operador), o custo dela já está
  -- em `v_view` — somar o item de novo contaria o mesmo dinheiro duas vezes e
  -- fecharia o teto do dia por engano.
  select coalesce(sum(f.custo_usd), 0) into v_fila
    from public.painel_fila_prompts f
    where f.conta = p_conta
      and f.estado in ('concluida', 'falhou')
      and f.custo_usd is not null
      and public.painel_dia_operador(f.concluido_em) = v_dia
      and not exists (
        select 1
        from public.painel_frentes_sessoes s
        where f.session_id is not null
          and s.sessao_id = f.session_id
          and s.conta = f.conta
          and public.painel_dia_operador(coalesce(s.atualizado_em, s.criado_em, s.publicado_em)) = v_dia
      );

  return coalesce(v_view, 0) + coalesce(v_fila, 0);
end;
$$;
comment on function public.painel_fila_consumo_hoje(text) is
  'Gasto MEDIDO do dia (fuso do operador): sessões publicadas + itens da fila fechados hoje (concluída OU falhou) CUJA SESSÃO AINDA NÃO FOI PUBLICADA (D6, rodada 3 — a medição publicada prevalece; sem este NOT EXISTS o mesmo gasto contava duas vezes assim que a Routine publicasse a sessão filha).';
revoke all on function public.painel_fila_consumo_hoje(text) from public, anon, authenticated;

-- ── 5 · trigger de admissão — só recusa o que NUNCA cabe (D3) ───────────────
-- 0009/0011 recusavam por headroom do dia. Consequência: um prompt escrito às
-- 23h de um dia cheio era PERDIDO (o operador tinha que lembrar de reescrever
-- no dia seguinte), e a fila nunca acumulava trabalho para o dia seguinte —
-- exatamente o contrário do que uma fila serve. Agora a admissão só barra o
-- impossível; o teto continua sendo respeitado, mas no PULL (item a item), que
-- é onde o dinheiro é realmente gasto.
create or replace function public.painel_fila_prompts_checar_teto()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_teto     numeric;
  v_estimado numeric;
  v_rotulo   text;
begin
  select teto_usd into v_teto from public.painel_teto_diario where conta = new.conta;
  if v_teto is null then
    raise exception 'fila: a conta % nao existe no painel (painel_teto_diario).', new.conta
      using errcode = 'check_violation';
  end if;

  select usd into v_estimado from public.painel_custo_estimado where complexidade = new.complexidade;
  if v_estimado is null then
    v_estimado := case new.complexidade
      when 'baixa' then 5 when 'media' then 15 when 'alta' then 50 when 'maxima' then 120
      else 15 end;
  end if;
  -- O valor SEMPRE vem daqui, nunca de fora (achado CRÍTICO #1 da rodada 1
  -- continua valendo): nenhum caller pode forjar custo_estimado_usd.
  new.custo_estimado_usd := v_estimado;

  v_rotulo := case new.complexidade
    when 'baixa' then 'baixa' when 'media' then 'média'
    when 'alta' then 'alta' when 'maxima' then 'máxima' else new.complexidade end;

  -- D3: a ÚNICA recusa de admissão — o item nunca caberia, em nenhum dia.
  if v_estimado > v_teto then
    raise exception
      'fila: uma tarefa % custa cerca de US$ % e o teto diário desta conta é US$ % — nunca vai caber.',
      v_rotulo, round(v_estimado, 2), round(v_teto, 2)
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;
comment on function public.painel_fila_prompts_checar_teto() is
  'D3 (rodada 3): admissão recusa SÓ o impossível (estimado > teto da conta, ou conta inexistente). O teto do dia deixou de barrar a ENTRADA e passou a barrar o PULL (fila_prompts_pegar_interno, item a item) — item que não cabe hoje entra e roda quando houver espaço. Some também o lock FOR UPDATE de 0011: sem headroom agregado na admissão, não há TOCTOU a serializar.';

-- ── 6 · fila_prompts_enfileirar — roteamento por MAIOR ESPAÇO LIVRE (D5) ────
create or replace function public.fila_prompts_enfileirar(p_secret text, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_expected     text;
  v_prompt       text;
  v_complexidade text;
  v_modelo       text;
  v_conta        text;
  v_criado_por   text;
  v_task_id      uuid;
  v_id           uuid;
  v_estimado     numeric;
  v_espaco       numeric;
  v_melhor_conta text;
  v_melhor_espaco numeric;
  v_motivo       text;
  v_cabe_hoje    boolean;
  rec            record;
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
    -- D5 · ESPELHO DECLARADO de `escolherConta` em
    -- `packages/lifeboard/src/core/prompts/roteador.ts` (fonte única da
    -- regra — editar lá primeiro, depois este `case`): escolhe a conta com
    -- MAIOR espaço livre = teto − medido − em_execucao − soma dos na_fila
    -- dela; o `>` estrito somado à ordem explícita abaixo faz o empate cair
    -- sempre na primeira da lista `CONTAS` do TS (lucasscudeler, lsgpandora,
    -- almapetra). O "soma dos na_fila" entra SÓ aqui, para ESCOLHER — nunca
    -- para recusar (D3).
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
    v_cabe_hoje := v_melhor_espaco >= v_estimado;
    v_motivo := case when v_cabe_hoje
      then format('roteamento automatico: maior espaco livre hoje (US$ %s)', round(v_melhor_espaco, 2))
      else format('roteamento automatico: nenhuma conta tem US$ %s livres hoje; a mais folgada tem US$ %s — entra na fila e roda quando houver espaco',
                  round(v_estimado, 2), round(v_melhor_espaco, 2))
    end;
  else
    select (t.teto_usd
            - public.painel_fila_consumo_hoje(t.conta)
            - public.painel_fila_reservado(t.conta)
            - public.painel_fila_na_fila(t.conta))
      into v_espaco
      from public.painel_teto_diario t where t.conta = v_conta;
    v_cabe_hoje := coalesce(v_espaco, 0) >= v_estimado;
    v_motivo := case when v_cabe_hoje
      then 'conta escolhida manualmente no formulario'
      else format('conta escolhida manualmente no formulario; nao cabe hoje (US$ %s livres) — roda quando houver espaco',
                  round(coalesce(v_espaco, 0), 2))
    end;
  end if;

  -- O trigger pode recusar (D3: só `estimado > teto` ou conta inexistente) —
  -- propositalmente NÃO capturado aqui: a mensagem em português do trigger é
  -- exatamente a que o painel deve mostrar. `custo_estimado_usd` nunca é
  -- inserido explicitamente: o trigger SEMPRE o recalcula.
  insert into public.painel_fila_prompts (conta, prompt, complexidade, modelo_sugerido, criado_por, task_id)
  values (v_conta, btrim(v_prompt), v_complexidade, v_modelo, v_criado_por, v_task_id)
  returning id into v_id;

  return jsonb_build_object(
    'ok', true, 'id', v_id, 'conta', v_conta, 'modelo_sugerido', v_modelo,
    'motivo', v_motivo, 'cabe_hoje', v_cabe_hoje,
    'espaco_livre_usd', round(coalesce(v_espaco, v_melhor_espaco, 0), 2)
  );
end;
$$;
comment on function public.fila_prompts_enfileirar(text, jsonb) is
  'D3/D5 (rodada 3): admissão só barra o impossível; roteamento automático escolhe a conta com MAIOR espaço livre (teto − medido − em_execucao − na_fila), empate pela ordem de CONTAS no TS. Devolve cabe_hoje/espaco_livre_usd para a tela dizer "não cabe hoje; roda quando houver espaço".';

-- ── 7 · fila_prompts_pegar_interno — posse, expiração e elegibilidade ───────
-- Assinatura NOVA (p_conta, p_worker_id). A de 1 argumento é removida logo
-- abaixo: mantê-la deixaria o worker pegar item sem gravar posse nem
-- tentativa — exatamente o buraco que D1/D2 fecham.
drop function if exists public.fila_prompts_pegar_interno(text);

create or replace function public.fila_prompts_pegar_interno(p_conta text, p_worker_id text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_teto        numeric;
  v_medido      numeric;
  v_execucao    numeric;
  v_devolvidos  integer := 0;
  v_mortos      integer := 0;
  v_pulados     integer := 0;
  v_devolvidos_ids uuid[] := '{}'::uuid[];
  v_menor_nao_coube numeric;
  v_escolhido   uuid;
  v_row         public.painel_fila_prompts%rowtype;
  rec           record;
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

  -- Serializa dois pulls da MESMA conta (duas Routines, ou Run now + a
  -- agendada): sem isto os dois liam o mesmo `em_execucao` e os dois podiam
  -- liberar um item que, juntos, ultrapassa o teto. Contas diferentes nunca
  -- se bloqueiam (linhas diferentes de painel_teto_diario).
  perform 1 from public.painel_teto_diario where conta = p_conta for update;

  -- D2 · expiração com fim. 45 min SEM SINAL (não 6h desde o `pego_em`):
  -- uma sessão longa e viva continua dona do item; uma morta há 46 min
  -- devolve ou morre, conforme já tenha esgotado as tentativas.
  with alvo as (
    select f.id, f.tentativas, f.max_tentativas
    from public.painel_fila_prompts f
    where f.conta = p_conta
      and f.estado = 'pega'
      and coalesce(f.heartbeat_em, f.pego_em) < now() - interval '45 minutes'
  ),
  dev as (
    update public.painel_fila_prompts f
       set estado = 'na_fila', worker_id = null, pego_em = null, heartbeat_em = null
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
           -- conservador: quem sumiu provavelmente gastou. O estimado entra
           -- no consumo do dia (painel_fila_consumo_hoje soma `falhou`).
           custo_usd = least(f.custo_estimado_usd, 500),
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

  v_medido   := public.painel_fila_consumo_hoje(p_conta);
  v_execucao := public.painel_fila_reservado(p_conta);

  -- D3 · elegibilidade POR ITEM: o mais antigo que CABE, pulando os que não
  -- cabem (um Fable de US$120 não pode mais bloquear um Haiku de US$5 atrás
  -- dele). Item devolvido nesta mesma chamada fica de fora (`<> all`): o
  -- worker que acabou de perdê-lo não o pega de volta no mesmo fôlego.
  for rec in
    select f.id, f.custo_estimado_usd
    from public.painel_fila_prompts f
    where f.conta = p_conta
      and f.estado = 'na_fila'
      and f.id <> all (v_devolvidos_ids)
    order by f.criado_em asc
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
    return jsonb_build_object(
      'ok', true, 'item', null,
      'devolvidos', v_devolvidos, 'mortos', v_mortos, 'pulados', v_pulados,
      'motivo', case
        when v_menor_nao_coube is not null then
          format('nada cabe agora: o mais barato da fila custa US$ %s e so ha US$ %s livres (medido US$ %s + em execucao US$ %s de teto US$ %s)',
            round(v_menor_nao_coube, 2), round(v_teto - v_medido - v_execucao, 2),
            round(v_medido, 2), round(v_execucao, 2), round(v_teto, 2))
        else 'fila vazia para esta conta'
      end
    );
  end if;

  update public.painel_fila_prompts
     set estado = 'pega',
         worker_id = p_worker_id,
         pego_em = now(),
         heartbeat_em = now(),
         tentativas = tentativas + 1
   where id = v_escolhido
  returning * into v_row;

  return jsonb_build_object(
    'ok', true,
    'devolvidos', v_devolvidos, 'mortos', v_mortos, 'pulados', v_pulados,
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
  'D1/D2/D3 (rodada 3): grava posse (worker_id) e tentativa; expira por HEARTBEAT (45 min) com fim (volta enquanto tentativas < max_tentativas, depois falhou com custo estimado); escolhe o item mais antigo que CABE (medido + em_execucao + estimado <= teto), pulando os que não cabem. Devolve devolvidos/mortos/pulados. Sem segredo de app: SECURITY DEFINER + revoke all (MCP Supabase da própria conta).';
revoke all on function public.fila_prompts_pegar_interno(text, text) from public, anon, authenticated;

-- ── 8 · fila_prompts_heartbeat_interno — sinal de vida + cancelamento (D7) ──
create or replace function public.fila_prompts_heartbeat_interno(
  p_id uuid, p_conta text, p_worker_id text, p_session_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.painel_fila_prompts%rowtype;
begin
  if p_id is null or p_worker_id is null then
    raise exception 'id e worker_id sao obrigatorios.' using errcode = 'check_violation';
  end if;

  select * into v_row from public.painel_fila_prompts
    where id = p_id and conta = p_conta for update;

  if not found then
    return jsonb_build_object('ok', false, 'motivo', 'inexistente');
  end if;
  -- D7: o operador cancelou pela tela enquanto a sessão filha rodava. O
  -- worker lê isto ANTES de cada passo e interrompe a filha (interrupt_session).
  if v_row.estado = 'cancelada' then
    return jsonb_build_object('ok', false, 'motivo', 'cancelado');
  end if;
  if v_row.worker_id is distinct from p_worker_id then
    return jsonb_build_object('ok', false, 'motivo', 'outro worker');
  end if;
  if v_row.estado <> 'pega' then
    return jsonb_build_object('ok', false, 'motivo', format('item esta %s', v_row.estado));
  end if;

  update public.painel_fila_prompts
     set heartbeat_em = now(),
         session_id = coalesce(nullif(btrim(coalesce(p_session_id, '')), ''), session_id)
   where id = p_id
  returning * into v_row;

  return jsonb_build_object(
    'ok', true, 'motivo', null,
    'heartbeatEm', v_row.heartbeat_em, 'sessionId', v_row.session_id,
    'tentativas', v_row.tentativas, 'maxTentativas', v_row.max_tentativas
  );
end;
$$;
comment on function public.fila_prompts_heartbeat_interno(uuid, text, text, text) is
  'D1/D7 (rodada 3): renova heartbeat_em (e grava session_id quando vier). Nunca levanta exceção por estado — devolve {ok:false, motivo} para o worker decidir: "cancelado" = o operador cancelou, interrompa a sessão filha (interrupt_session).';
revoke all on function public.fila_prompts_heartbeat_interno(uuid, text, text, text) from public, anon, authenticated;

-- ── 9 · fila_prompts_fechar_interno — posse + idempotência (D1/D6/D8) ───────
drop function if exists public.fila_prompts_fechar_interno(uuid, text, text, numeric, text, text);

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
  v_row public.painel_fila_prompts%rowtype;
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

  select * into v_row from public.painel_fila_prompts
    where id = p_id and conta = p_conta for update;

  if not found then
    raise exception 'Item nao encontrado ou nao pertence a conta informada: %', p_id
      using errcode = 'check_violation';
  end if;

  -- Expirou e voltou para a fila enquanto o worker rodava: não é erro de
  -- posse (ninguém é dono), é um fato que o worker precisa saber.
  if v_row.estado = 'na_fila' and v_row.worker_id is null then
    raise exception 'Item voltou para a fila (45 min sem sinal) — nao pode ser fechado; ele sera pego de novo: %', p_id
      using errcode = 'check_violation';
  end if;

  -- D1 · fencing: só quem pegou fecha.
  if v_row.worker_id is distinct from p_worker_id then
    raise exception 'Item pertence a outro worker (%): %', coalesce(v_row.worker_id, 'nenhum'), p_id
      using errcode = 'check_violation';
  end if;

  -- D8 · idempotência: o MESMO worker refechando o que já fechou não é erro
  -- (a Routine pode repetir o passo 5f depois de um timeout de rede).
  if v_row.estado in ('concluida','falhou') then
    return jsonb_build_object('ok', true, 'ja_fechado', true, 'estado', v_row.estado);
  end if;

  if v_row.estado = 'cancelada' then
    raise exception 'Item foi cancelado pelo operador — nao pode ser fechado: %', p_id
      using errcode = 'check_violation';
  end if;

  update public.painel_fila_prompts
     set estado = p_estado,
         custo_usd = p_custo_usd,
         -- D6: a chave do dedupe contra painel_frentes_sessoes.
         session_id = coalesce(nullif(btrim(coalesce(p_session_id, '')), ''), session_id),
         sessao_url = coalesce(p_sessao_url, sessao_url),
         resultado = coalesce(p_resultado, resultado),
         heartbeat_em = null,
         concluido_em = now()
   where id = p_id;

  return jsonb_build_object('ok', true, 'ja_fechado', false, 'estado', p_estado);
end;
$$;
comment on function public.fila_prompts_fechar_interno(uuid, text, text, text, numeric, text, text, text) is
  'D1/D6/D8 (rodada 3): só o worker que PEGOU fecha (fencing por worker_id); segundo fechamento do mesmo worker devolve {ok:true, ja_fechado:true} em vez de erro; grava session_id (dedupe de custo contra painel_frentes_sessoes). p_sessao_url/p_resultado seguem opcionais, no fim, para o painel continuar mostrando link e resumo.';
revoke all on function public.fila_prompts_fechar_interno(uuid, text, text, text, numeric, text, text, text) from public, anon, authenticated;

-- ── 10 · fila_prompts_cancelar — aceita na_fila E pega (D7) ────────────────
create or replace function public.fila_prompts_cancelar(p_secret text, p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_expected text;
  v_antes    text;
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

  -- D7: `pega` também cancela. O item para de reservar orçamento na hora, e o
  -- worker descobre pelo heartbeat ({ok:false, motivo:'cancelado'}) que deve
  -- interromper a sessão filha. Antes, um item `pega` que travasse só saía
  -- pela expiração — o operador não tinha botão nenhum.
  update public.painel_fila_prompts
     set estado = 'cancelada',
         heartbeat_em = null,
         concluido_em = now(),
         motivo_falha = case when estado = 'pega'
           then 'cancelado pelo operador durante a execucao' else motivo_falha end
   where id = p_id and estado in ('na_fila', 'pega')
  returning estado into v_antes;

  if v_antes is null then
    raise exception 'Item nao encontrado ou ja fechado (concluida, falhou ou cancelada): %', p_id
      using errcode = 'check_violation';
  end if;

  return jsonb_build_object('ok', true);
end;
$$;
comment on function public.fila_prompts_cancelar(text, uuid) is
  'D7 (rodada 3): cancela item na_fila E pega (antes só na_fila — item pega era beco sem saída até expirar). Um item pega cancelado para de reservar orçamento imediatamente; o worker vê pelo heartbeat e interrompe a sessão filha.';

-- ── 11 · fila_prompts_listar — paginação + prompt truncado (D8) ─────────────
drop function if exists public.fila_prompts_listar(text);

create or replace function public.fila_prompts_listar(
  p_secret text, p_limite integer default 50, p_antes_de timestamptz default null
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

  v_limite := least(greatest(coalesce(p_limite, 50), 1), 200);

  -- D8: o prompt vai truncado em 300 caracteres (um prompt de 20.000 × 200
  -- itens virava um payload de 4 MB por render; o operador nunca lê 20.000
  -- caracteres numa célula de tabela). `promptTamanho` diz o tamanho real.
  with pagina as (
    select f.*
    from public.painel_fila_prompts f
    where (p_antes_de is null or f.criado_em < p_antes_de)
    order by f.criado_em desc
    limit v_limite + 1
  ),
  visivel as (
    select * from pagina order by criado_em desc limit v_limite
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
          'criadoEm', v.criado_em, 'pegoEm', v.pego_em, 'concluidoEm', v.concluido_em,
          'heartbeatEm', v.heartbeat_em, 'workerId', v.worker_id,
          'tentativas', v.tentativas, 'maxTentativas', v.max_tentativas,
          'sessionId', v.session_id, 'motivoFalha', v.motivo_falha,
          'sessaoUrl', v.sessao_url, 'resultado', v.resultado, 'criadoPor', v.criado_por,
          'taskId', v.task_id
        ) order by v.criado_em desc)
        from visivel v
      ), '[]'::jsonb),
      'consumo', coalesce((
        select jsonb_agg(jsonb_build_object(
          'conta', t.conta, 'tetoUsd', t.teto_usd,
          'consumoHojeUsd', public.painel_fila_consumo_hoje(t.conta),
          'reservadoUsd', public.painel_fila_reservado(t.conta),
          'naFilaUsd', public.painel_fila_na_fila(t.conta),
          'medidoAteEm', public.painel_fila_medido_ate(t.conta)
        ) order by case t.conta
          when 'lucasscudeler@gmail.com' then 1
          when 'lsgpandora@gmail.com'    then 2
          when 'almapetra.ltda@gmail.com' then 3
          else 9 end)
        from public.painel_teto_diario t
      ), '[]'::jsonb),
      'limite', v_limite,
      'temMais', (select count(*) from pagina) > v_limite
    )
  into v_result;

  return v_result;
end;
$$;
comment on function public.fila_prompts_listar(text, integer, timestamptz) is
  'D8 (rodada 3): pagina por criado_em desc (p_limite 1..200, default 50; p_antes_de opcional) e trunca o prompt em 300 caracteres (promptTamanho = tamanho real). Consumo por conta agora traz reservadoUsd (EM EXECUÇÃO) e naFilaUsd (esperando) separados — D3.';

revoke all on function public.fila_prompts_listar(text, integer, timestamptz) from public;
grant execute on function public.fila_prompts_listar(text, integer, timestamptz) to anon, authenticated;
revoke all on function public.fila_prompts_enfileirar(text, jsonb) from public;
grant execute on function public.fila_prompts_enfileirar(text, jsonb) to anon, authenticated;
revoke all on function public.fila_prompts_cancelar(text, uuid) from public;
grant execute on function public.fila_prompts_cancelar(text, uuid) to anon, authenticated;
