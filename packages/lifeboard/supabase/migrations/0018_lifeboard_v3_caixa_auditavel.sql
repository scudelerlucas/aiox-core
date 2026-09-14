-- =============================================================================
-- OS-LIFEBOARD · Migration 0018 — P7: RODADA 8. O caixa é AUDITÁVEL: o dia de
-- cobrança é imutável, o dinheiro é de UMA conta só, e a trava de medição só
-- se desarma com medição de verdade.
-- =============================================================================
-- Sobre 0007 + 0009 + 0011 + 0012 + 0013 + 0014 + 0015 + 0016. Tudo
-- `create or replace` / `add column if not exists` / `create or replace view`
-- — RE-APLICÁVEL. Nenhuma remoção de função, tabela, coluna ou índice.
--
-- NADA NESTE ARQUIVO MEXE NO VALOR DO TETO. `public.painel_teto_diario` está
-- em 500 nas três contas por decisão do operador (14/09/2026). Não há `update
-- ... set teto_usd`, não há `alter column teto_usd set default`, e o número
-- 150 — que ainda vivia como fallback escondido em 0016:368 — SAI daqui
-- (BAIXO 4). Sem teto declarado não se inventa número: recusa-se.
--
-- O crítico hostil da rodada 7 reprovou com 3 ALTO + 6 MÉDIO + 8 BAIXO. As
-- decisões de banco desta rodada:
--
--  D33 O DIA DE COBRANÇA É O DIA EM QUE O ITEM FECHOU (ALTO 1).
--      Medido: item fecha ontem com US$ 80 → ontem lê 80. A sessão vinculada
--      é publicada HOJE (caminho REAL: a última medição da conta tinha 39 h
--      de atraso) → `painel_consumo_por_conta_dia` cobrava a sessão no dia da
--      PUBLICAÇÃO, o item passava a contribuir zero (D31) e o resultado era
--      **ontem vira 0 e os 80 migram para hoje**. Um dia encerrado reescrito,
--      e o teto de hoje consumido por trabalho de ontem.
--      AGORA: quando a sessão está vinculada a um item JÁ FECHADO, o custo
--      dela é lançado no dia de `concluido_em` DO ITEM. Sem item vinculado (ou
--      com item ainda em voo), a sessão usa o próprio dia. A dedup de D31
--      continua igual — o item contribui zero e quem paga é a sessão; o que
--      muda é só a DATA, e ela para de andar.
--      A ressalva serve à MESMA exigência de imutabilidade, não a afrouxa:
--      `least(dia_do_item, dia_da_sessão)` — um lançamento que já entrou num
--      dia ANTERIOR não é retirado dele quando o item fecha depois. Sem isso,
--      corrigir o ALTO 1 criaria o defeito espelhado (sessão medida hoje, item
--      fechado amanhã → hoje perderia o dinheiro). No caminho normal (o item
--      fecha ANTES de a sessão ser publicada) `least` É o dia do item.
--      Prova: T21/T22/T25 (reescritos) + T30 (o cenário S1, ponta a ponta).
--
--  D34 O MESMO DINHEIRO NUNCA É DE DUAS CONTAS (ALTO 2). Duas correções, as
--      duas obrigatórias:
--      (a) `heartbeat`, `fechar` e `ajustar_custo` RECUSAM um `p_session_id`
--          que pertença a outra conta, dizendo em português de quem é. Antes,
--          `fila_prompts_heartbeat_interno` aceitava qualquer string.
--      (b) a dedup passa a casar por IDENTIDADE DA SESSÃO, sem olhar conta
--          (`and s.conta = f.conta` sai do `left join lateral`). Era ele que
--          deixava a conta A cobrar 80 e a conta B cobrar 80 pelo mesmo
--          trabalho — 160 para 80 de trabalho real. (a) fecha a porta para
--          frente; (b) desarma a linha ruim que já existe.
--      Prova: T31 (a recusa, nas três RPCs) e T32 (a dedup entre contas).
--
--  D35 `painel_fila_medido_ate` RESPONDE "ÚLTIMA MEDIÇÃO", NÃO "ÚLTIMA LINHA"
--      (ALTO 3). 21 das 215 sessões reais são linhas SEM custo. Medido: uma
--      sessão sem custo de 5 min atrás mascarava uma medição real de 40 h,
--      `defasagem` caía para 0,1 e a trava de D32c AUTORIZAVA gasto novo — a
--      trava era desarmada por uma sessão que não mediu nada. Agora só entra
--      no `max` a sessão com `custo_usd is not null`; o nome, o comentário e o
--      doc do hub passam a dizer a mesma coisa que o código. Prova: T33.
--
--  MÉDIO 3 · `fila_prompts_consumo_do_dia` contava `itens` só quando
--      `contribuicao > 0` — ou seja, depois de D31, todo item com sessão
--      vinculada e custo publicado (exatamente o que a Routine faz) sumia da
--      contagem: `{"itens": 0, "consumo_usd": 30.00}` num dia com 1 item
--      fechado. `itens` passa a contar os itens que a fila RODOU naquele dia,
--      com contribuição ou sem. T24 afirmava o zero como correto — ele
--      provava o defeito e foi reescrito.
--
--  MÉDIO 4 · A ORIGEM DO NÚMERO PASSA A SER GUARDADA (`custo_origem`).
--      Medido: 120 (estimativa) → ajustado para 3 → segundo ajuste para 30
--      RECUSADO com "este foi medido", culpando uma sessão que nunca reportou
--      nada — o número tinha sido digitado pelo operador. Porta de mão única
--      sobre o número que governa o teto, e com uma porta dos fundos
--      acidental: ajustar para exatamente 0 devolvia a possibilidade, porque a
--      guarda olhava o VALOR. Agora ela olha a ORIGEM: `estimativa` (a casa),
--      `medido` (a sessão) ou `operador` (a tela). Valor de origem `operador`
--      continua corrigível enquanto o dia está aberto; só `medido` trava — e a
--      única exceção continua sendo o modo de falha conhecido, `medido` igual
--      a ZERO (a sessão fechou sem ler o usage). O zero deixou de ser chave.
--
--  BAIXO 1 · a recusa de fencing dizia "Item pertence a outro worker
--      (nenhum): <uuid cru>". Passa a nomear quem PEGOU (`ultimo_worker_id`) e
--      não cospe UUID.
--  BAIXO 4 · `if v_teto is null then v_teto := 150; end if;` — apagado.
--  BAIXO 5 · `headroom_usd` sai clampado em 0 em TODOS os ramos do pull.
--  BAIXO 6 · `heartbeat_interno`, `painel_fila_reservado` e
--      `painel_fila_prompts_checar_teto` estavam em produção sem os
--      comentários do `.sql` do repo. Re-declaradas aqui para o repositório
--      voltar a ser a fonte (`md5(prosrc)` do banco = o texto deste arquivo).
--  BAIXO 7 · `and s.custo_usd is not null` no `left join lateral` é linha
--      MORTA (`sessao_id` é único: 215 linhas, 215 distintas — medido). Sai, e
--      o comentário passa a apontar a linha que faz o trabalho: o `case when
--      ses.custo_usd is null then f.custo_usd else 0 end`. O `nulls last` no
--      `order by` deixa a equivalência explícita, sem depender da unicidade.
-- =============================================================================

-- ── 1 · painel_fila_medido_ate — ÚLTIMA MEDIÇÃO, não última linha (D35) ─────
-- ALTO 3 da rodada 7. `max(coalesce(atualizado_em, criado_em, publicado_em))`
-- sem filtro de custo responde "quando esta conta escreveu alguma linha pela
-- última vez" — e 21 das 215 sessões reais são linhas sem custo. O nome da
-- função, a coluna que ela alimenta na tela (`medidoAteEm`) e a trava que
-- depende dela (`exigir_medicao_recente`) falam todos de MEDIÇÃO.
create or replace function public.painel_fila_medido_ate(p_conta text)
returns timestamptz
language sql
stable
set search_path = public, pg_temp
as $$
  select max(coalesce(s.atualizado_em, s.criado_em, s.publicado_em))
  from public.painel_frentes_sessoes s
  where s.conta = p_conta
    -- D35 (rodada 8): SÓ sessão que reportou custo conta como medição. Sem
    -- esta linha, uma sessão sem custo de 5 min atrás mascarava uma medição
    -- real de 40 h e a trava de D32c liberava gasto novo.
    and s.custo_usd is not null
    and coalesce(s.atualizado_em, s.criado_em, s.publicado_em) is not null;
$$;
comment on function public.painel_fila_medido_ate(text) is
  'D32a (rodada 7) + D35 (rodada 8): o instante da última MEDIÇÃO desta conta — só sessões com custo_usd não nulo entram. Antes respondia "última LINHA": 21 das 215 sessões reais não têm custo, e uma delas de 5 min atrás mascarava uma medição de 40 h, desarmando exigir_medicao_recente. NULL significa uma coisa só: esta conta nunca teve sessão MEDIDA.';
revoke all on function public.painel_fila_medido_ate(text) from public, anon, authenticated;

-- ── 2 · painel_fila_defasagem_horas — o comentário conta a mesma história ───
create or replace function public.painel_fila_defasagem_horas(p_conta text)
returns numeric
language sql
stable
set search_path = public, pg_temp
as $$
  select case
    when public.painel_fila_medido_ate(p_conta) is null then null
    else round(extract(epoch from (now() - public.painel_fila_medido_ate(p_conta))) / 3600.0, 1)
  end;
$$;
comment on function public.painel_fila_defasagem_horas(text) is
  'D32a (rodada 7) + D35 (rodada 8): horas desde a última MEDIÇÃO desta conta (sessão com custo), não desde a última linha escrita; NULL quando nunca houve medição. Medido em 13/09: a conta com 215 sessões estava 37 h atrás e a tela mostrava o saldo como se fosse de agora; medido em 14/09: uma linha sem custo de 5 min atrás fazia a mesma conta declarar 0,1 h.';
revoke all on function public.painel_fila_defasagem_horas(text) from public, anon, authenticated;

-- ── 3 · painel_sessao_dona — de quem é esta sessão (D34a) ───────────────────
-- `security definer` porque as RPCs que a chamam precisam enxergar a tabela
-- inteira de sessões, e não só as linhas visíveis ao chamador.
create or replace function public.painel_sessao_dona(p_sessao_id text)
returns text
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select s.conta
  from public.painel_frentes_sessoes s
  where p_sessao_id is not null and s.sessao_id = p_sessao_id
  limit 1;
$$;
comment on function public.painel_sessao_dona(text) is
  'D34a (rodada 8): a conta dona de uma sessão publicada, ou NULL quando a sessão ainda não foi publicada (o caso normal no heartbeat — a filha acabou de nascer). É o que heartbeat/fechar/ajustar consultam antes de vincular sessão a item: sessão de OUTRA conta é recusada, dizendo de quem ela é.';
revoke all on function public.painel_sessao_dona(text) from public, anon, authenticated;

-- ── 4 · painel_sessao_dia_de_cobranca — o dia que NÃO anda (D33) ────────────
create or replace function public.painel_sessao_dia_de_cobranca(
  p_sessao_id text, p_instante timestamptz
)
returns date
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  -- `least` ignora NULL: sem item vinculado FECHADO, o dia é o da própria
  -- sessão (o comportamento de sempre). Com item fechado, vale o dia DELE —
  -- e, no caminho patológico em que a sessão já foi medida num dia ANTERIOR
  -- ao fechamento, vale o dia da medição, porque dia encerrado não devolve
  -- dinheiro. No caminho normal (item fecha, sessão é publicada depois) os
  -- dois casos coincidem: o dia do item.
  select least(
    (select public.painel_dia_operador(f.concluido_em)
       from public.painel_fila_prompts f
      where p_sessao_id is not null
        and f.session_id = p_sessao_id
        and f.concluido_em is not null
      order by f.concluido_em
      limit 1),
    public.painel_dia_operador(p_instante)
  );
$$;
comment on function public.painel_sessao_dia_de_cobranca(text, timestamptz) is
  'D33 (rodada 8): o dia em que o custo de uma sessão é lançado — o dia de concluido_em do item vinculado; na ausência dele, o dia da própria sessão. Corrige o ALTO 1 da rodada 7: a sessão era cobrada no dia da PUBLICAÇÃO, e publicar hoje uma sessão de um item fechado ontem zerava ontem e jogava o dinheiro em hoje.';
revoke all on function public.painel_sessao_dia_de_cobranca(text, timestamptz) from public, anon, authenticated;

-- ── 5 · painel_consumo_por_conta_dia — a view passa a usar o dia de cobrança ─
create or replace view public.painel_consumo_por_conta_dia as
select
  s.conta,
  public.painel_sessao_dia_de_cobranca(
    s.sessao_id, coalesce(s.atualizado_em, s.criado_em, s.publicado_em)) as dia,
  sum(coalesce(s.custo_usd, 0)) as custo_usd,
  count(*) as sessoes
from public.painel_frentes_sessoes s
where s.conta is not null
group by 1, 2;
comment on view public.painel_consumo_por_conta_dia is
  'D33 (rodada 8): "dia" deixou de ser o dia da PUBLICAÇÃO e passou a ser o dia de COBRANÇA (painel_sessao_dia_de_cobranca) — o dia em que o item vinculado fechou. Mantém o fuso do operador (ALTO #5/#6 da rodada 2) e o security_invoker=on. Sem isto, publicar hoje uma sessão de ontem reescrevia um dia encerrado: ontem ia a 0 e o teto de hoje pagava trabalho de ontem.';

alter view public.painel_consumo_por_conta_dia set (security_invoker = on);
revoke select on public.painel_consumo_por_conta_dia from anon, authenticated;

-- ── 6 · painel_fila_itens_do_dia — dedup por SESSÃO, sem olhar conta (D34b) ─
create or replace function public.painel_fila_itens_do_dia(p_conta text, p_dia date)
returns table (id uuid, contribuicao numeric, e_estimativa boolean)
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select
    f.id,
    -- ESTA é a linha que faz a dedup de D31/D30 (BAIXO 7 da rodada 7 apontava
    -- o comentário para a linha errada): item com sessão vinculada que
    -- publicou CUSTO contribui ZERO — quem paga é a sessão, no dia de
    -- cobrança dela (D33, que agora é o dia deste mesmo item). Sessão
    -- publicada SEM custo não abate nada: `ses.custo_usd` volta nulo e o item
    -- contribui inteiro (21 das 215 sessões reais são assim).
    case when ses.custo_usd is null then f.custo_usd else 0 end as contribuicao,
    f.custo_e_estimativa
  from public.painel_fila_prompts f
  left join lateral (
    select s.custo_usd
    from public.painel_frentes_sessoes s
    where f.session_id is not null
      and s.sessao_id = f.session_id
    -- D34b (rodada 8): `and s.conta = f.conta` SAIU. Com ele, item de uma
    -- conta vinculado a sessão de outra NÃO deduplicava: a conta A cobrava 80
    -- pela sessão e a conta B cobrava 80 pelo item — 160 por 80 de trabalho.
    -- A identidade da sessão é a chave; a conta não faz parte dela.
    -- `nulls last` deixa explícito o que a unicidade de sessao_id já garante
    -- (215 linhas, 215 distintas): a linha `and s.custo_usd is not null` que
    -- estava aqui era MORTA, e saiu com ela.
    order by s.custo_usd desc nulls last
    limit 1
  ) ses on true
  where f.conta = p_conta
    and f.custo_usd is not null
    and f.concluido_em is not null
    -- D25 (rodada 6, mantida): o dia é o do FECHAMENTO.
    and public.painel_dia_operador(f.concluido_em) = p_dia
    and (
      f.estado in ('concluida', 'falhou')
      -- D12 (rodada 4, mantida): cancelada que JÁ TEVE DONO gastou dinheiro.
      or (f.estado = 'cancelada' and (f.worker_id is not null or f.ultimo_worker_id is not null or f.tentativas > 0))
    );
$$;
comment on function public.painel_fila_itens_do_dia(text, date) is
  'D31 (rodada 7) + D34b/BAIXO 7 (rodada 8): a dedup casa por IDENTIDADE DA SESSÃO, sem comparar conta — era a comparação de conta que deixava o mesmo trabalho ser cobrado em duas contas. Item com sessão vinculada que publicou custo contribui ZERO em todo dia; a sessão paga por si, no dia de cobrança dela (D33). Mantém D25, D30 e D12.';
revoke all on function public.painel_fila_itens_do_dia(text, date) from public, anon, authenticated;

-- ── 7 · fila_prompts_consumo_do_dia — `itens` volta a contar (MÉDIO 3) ──────
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
        -- MÉDIO 3 (rodada 8): era `where d.contribuicao > 0`. Depois de D31,
        -- todo item com sessão vinculada e custo publicado — o caminho que a
        -- Routine percorre TODA vez — contribui zero e sumia da contagem:
        -- o relatório do dia dizia `{"itens": 0, "consumo_usd": 30.00}` num
        -- dia com 1 item fechado. `itens` conta o que a fila RODOU no dia.
        'itens', (select count(*) from public.painel_fila_itens_do_dia(t.conta, v_dia) d),
        -- E a parcela que a sessão pagou continua legível, separada:
        'itens_com_contribuicao',
          (select count(*) from public.painel_fila_itens_do_dia(t.conta, v_dia) d where d.contribuicao > 0)
      ) as linha
      from public.painel_teto_diario t
    ) s;

  return jsonb_build_object('ok', true, 'dia', v_dia, 'contas', coalesce(v_linhas, '[]'::jsonb));
end;
$$;
comment on function public.fila_prompts_consumo_do_dia(text, date) is
  'D25 (rodada 6) + MÉDIO 3 (rodada 8): `itens` conta os itens que a fila rodou naquele dia, com contribuição ou sem — antes contava só `contribuicao > 0` e o caminho normal da Routine (item com sessão vinculada e custo publicado) desaparecia do relatório. `itens_com_contribuicao` continua dizendo quantos deles pagaram pelo próprio bolso.';
revoke all on function public.fila_prompts_consumo_do_dia(text, date) from public;
grant execute on function public.fila_prompts_consumo_do_dia(text, date) to anon, authenticated;

-- ── 8 · custo_origem — de ONDE veio o número (MÉDIO 4) ──────────────────────
alter table public.painel_fila_prompts
  add column if not exists custo_origem text not null default 'estimativa';

-- Backfill re-aplicável: só toca a linha que ainda está no default. Quem já
-- foi classificado (`medido`/`operador`) não é reclassificado numa segunda
-- aplicação da migration.
update public.painel_fila_prompts
   set custo_origem = case
     when custo_ajustado_em is not null then 'operador'
     when custo_e_estimativa           then 'estimativa'
     when custo_usd is not null        then 'medido'
     else 'estimativa'
   end
 where custo_origem = 'estimativa';

alter table public.painel_fila_prompts drop constraint if exists painel_fila_prompts_custo_origem_chk;
alter table public.painel_fila_prompts add constraint painel_fila_prompts_custo_origem_chk
  check (custo_origem in ('estimativa', 'medido', 'operador'));

comment on column public.painel_fila_prompts.custo_origem is
  'MÉDIO 4 (rodada 8): quem pôs este número. `estimativa` = a casa lançou (item morreu sem fechar, ou cancelamento de item que já rodou); `medido` = a sessão reportou; `operador` = o Lucas digitou pela tela. A guarda de `fila_prompts_ajustar_custo` passa a olhar ESTA coluna e não o VALOR — antes, um número digitado pelo operador virava intocável na segunda correção ("este foi medido", sobre uma sessão que nunca reportou nada), e ajustar para exatamente 0 era uma porta dos fundos que devolvia a possibilidade.';

-- ── 9 · fila_prompts_ajustar_custo — a origem manda (MÉDIO 4 + D34a) ────────
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
    -- BAIXO 9 (rodada 7): o enum não chega à tela. Era "(este está pega)".
    raise exception 'Só dá para ajustar o custo de item que falhou ou foi cancelado (este está %).',
      public.painel_fila_estado_br(v_row.estado)
      using errcode = 'check_violation';
  end if;
  -- D25: a MESMA régua de painel_fila_itens_do_dia — o dia do fechamento.
  if v_row.concluido_em is null
     or public.painel_dia_operador(v_row.concluido_em) <> public.painel_dia_operador() then
    raise exception 'Só dá para ajustar o custo de item fechado hoje.' using errcode = 'check_violation';
  end if;
  -- MÉDIO 4 (rodada 8): a guarda olha a ORIGEM, não o VALOR. Só o número que
  -- uma SESSÃO mediu fica travado; o que o operador digitou continua sendo
  -- dele enquanto o dia está aberto (era porta de mão única sobre o número que
  -- governa o teto). A única exceção continua sendo o modo de falha conhecido:
  -- medido IGUAL A ZERO é a sessão que fechou sem conseguir ler o usage. E com
  -- a guarda na origem, ajustar para zero deixou de ser uma chave: um valor de
  -- origem `operador` já era corrigível com qualquer número.
  if v_row.custo_origem = 'medido' and coalesce(v_row.custo_usd, 0) <> 0 then
    raise exception 'Este custo foi medido pela sessão — não dá para corrigi-lo aqui.'
      using errcode = 'check_violation';
  end if;

  -- D26: o vínculo de sessão também se cria por aqui. Sem ele, a casa soma a
  -- estimativa do item MAIS o custo real da sessão que rodou.
  if v_sess is not null then
    select f.id into v_outro from public.painel_fila_prompts f
      where f.session_id = v_sess and f.id <> p_id limit 1;
    if v_outro is not null then
      raise exception 'Esta sessão já está vinculada a outro item da fila.' using errcode = 'check_violation';
    end if;
    -- D34a (rodada 8): sessão de OUTRA conta não vincula. Era por aqui (e pelo
    -- heartbeat) que o mesmo dinheiro passava a existir em duas contas.
    v_dona := public.painel_sessao_dona(v_sess);
    if v_dona is not null and v_dona <> v_row.conta then
      raise exception 'Esta sessão é da conta % — não dá para vinculá-la a um item da conta %.',
        v_dona, v_row.conta using errcode = 'check_violation';
    end if;
  end if;

  update public.painel_fila_prompts
     set custo_usd = p_custo_usd,
         custo_e_estimativa = false,
         custo_origem = 'operador',
         session_id = coalesce(v_sess, session_id),
         custo_ajustado_em = now()
   where id = p_id;

  return jsonb_build_object(
    'ok', true, 'custo_usd', round(p_custo_usd, 2),
    'session_id', coalesce(v_sess, v_row.session_id),
    'origem_anterior', v_row.custo_origem,
    'era_medido_zero', (v_row.custo_origem = 'medido')
  );
end;
$$;
comment on function public.fila_prompts_ajustar_custo(text, uuid, numeric, text) is
  'D20 + D26 (rodada 6) + MÉDIO 4/D34a (rodada 8): a trava do ajuste olha `custo_origem`, não o valor — `operador` continua corrigível enquanto o dia está aberto, `medido` trava (exceto o medido igual a ZERO, que é a sessão que fechou sem ler o usage), e ajustar para 0 deixou de ser porta dos fundos. Sessão de outra conta é recusada dizendo de quem ela é. Régua do dia: concluido_em, a MESMA de painel_fila_itens_do_dia.';
revoke all on function public.fila_prompts_ajustar_custo(text, uuid, numeric, text) from public;
grant execute on function public.fila_prompts_ajustar_custo(text, uuid, numeric, text) to anon, authenticated;

-- ── 10 · fila_prompts_heartbeat_interno — a conta da sessão (D34a + BAIXO 6) ─
-- BAIXO 6: o corpo em produção estava sem os comentários deste arquivo. A
-- re-declaração aqui devolve o repositório à condição de fonte.
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
  v_dona  text;
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
    -- D34a (rodada 8) · A PORTA QUE ESTAVA ABERTA. Esta RPC aceitava QUALQUER
    -- `p_session_id`, sem validar nada: vincular a um item da conta B uma
    -- sessão da conta A fazia o mesmo trabalho ser cobrado nas duas (a sessão
    -- na conta dela, o item na conta dele). Sessão ainda não publicada
    -- (`v_dona` nulo) é o caso normal — a filha acabou de nascer — e passa.
    v_dona := public.painel_sessao_dona(v_sess);
    if v_dona is not null and v_dona <> v_row.conta then
      raise exception 'Esta sessão é da conta % — não dá para vinculá-la a um item da conta %.',
        v_dona, v_row.conta using errcode = 'check_violation';
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
  'D11/D18 (rodada 4) + D34a/BAIXO 6 (rodada 8): recusa p_session_id igual ao worker, session_id já vinculado a outro item e — novo — sessão que pertence a OUTRA conta, dizendo de quem ela é. Devolve expira_em (heartbeat + 45 min). O corpo em produção estava sem os comentários do repositório; esta re-declaração reconcilia os dois.';
revoke all on function public.fila_prompts_heartbeat_interno(uuid, text, text, text) from public, anon, authenticated;

-- ── 11 · fila_prompts_fechar_interno — origem, conta da sessão e BAIXO 1 ────
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
  -- BAIXO 1 (rodada 8): a mensagem dizia "Item pertence a outro worker
  -- (nenhum): <uuid cru>" — nomeava NINGUÉM justamente no caso em que há um
  -- dono conhecido (o item morto guarda `ultimo_worker_id`), e cuspia o UUID
  -- do item num relatório que o operador lê. Agora nomeia quem PEGOU.
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
    -- D34a (rodada 8): a mesma guarda do heartbeat, na outra porta.
    v_dona := public.painel_sessao_dona(v_sess);
    if v_dona is not null and v_dona <> v_row.conta then
      raise exception 'Esta sessão é da conta % — não dá para vinculá-la a um item da conta %.',
        v_dona, v_row.conta using errcode = 'check_violation';
    end if;
  end if;

  if v_reabrir then
    update public.painel_fila_prompts
       set estado = p_estado,
           custo_usd = p_custo_usd,
           custo_e_estimativa = false,
           -- MÉDIO 4: quem fecha é a SESSÃO; a origem passa a dizer isso.
           custo_origem = 'medido',
           session_id = coalesce(v_sess, session_id),
           sessao_url = coalesce(p_sessao_url, sessao_url),
           resultado = coalesce(p_resultado, resultado),
           motivo_falha = case when p_estado = 'falhou' then motivo_falha else null end,
           heartbeat_em = null,
           disponivel_em = null,
           -- D25/D33: o dinheiro entra no dia que o RECONHECE, e a sessão
           -- vinculada passa a ser cobrada NESTE dia, não no da publicação.
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
           custo_origem = 'medido',
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
         custo_origem = 'medido',
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
  'D26 (rodada 6) + MÉDIO 4/D34a/BAIXO 1 (rodada 8): o fechamento grava custo_origem = medido (é a sessão quem mediu), recusa sessão de outra conta, e a recusa de fencing nomeia quem PEGOU (ultimo_worker_id) sem cuspir UUID. Mantém D8/D11/D12/D20/D25.';
revoke all on function public.fila_prompts_fechar_interno(uuid, text, text, text, numeric, text, text, text) from public, anon, authenticated;

-- ── 12 · fila_prompts_cancelar — o lançamento da casa é `estimativa` ────────
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
  -- até a tela — e ele chegava com o id técnico na cara do operador.
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
         -- MÉDIO 4: quem lançou este número foi A CASA, não uma sessão — e é
         -- por isso que o operador pode corrigi-lo quantas vezes precisar.
         custo_origem = case when v_lancado > 0 then 'estimativa' else custo_origem end,
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
  'D12/#11 (rodada 4) + B2 (rodada 6) + MÉDIO 4 (rodada 8): cancelar item que JÁ RODOU lança o custo ESTIMADO, marcado com custo_origem = estimativa (é a casa que lança — e por isso o operador pode corrigir). A recusa não cospe UUID. D25: concluido_em = now(), e é esse dia que paga.';
revoke all on function public.fila_prompts_cancelar(text, uuid) from public;
grant execute on function public.fila_prompts_cancelar(text, uuid) to anon, authenticated;

-- ── 13 · painel_fila_reservado — reconciliação com o repo (BAIXO 6) ─────────
-- Corpo idêntico ao de 0012; em produção ele estava SEM estes comentários.
-- Nada de comportamento muda aqui: a re-declaração existe para o `.sql` do
-- repositório voltar a ser a fonte do que roda.
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
  'D3 (rodada 3) + BAIXO 6 (rodada 8): soma do ESTIMADO do que está EM EXECUÇÃO agora (pega com heartbeat vivo, < 45 min). na_fila NÃO entra — reserva agregada de fila travava a própria fila. Re-declarada nesta migration porque o corpo em produção divergia do repositório (só comentários).';
revoke all on function public.painel_fila_reservado(text) from public, anon, authenticated;

-- ── 14 · painel_fila_prompts_checar_teto — reconciliação (BAIXO 6) ──────────
-- Corpo idêntico ao de 0012 (mesma admissão, mesma recusa); produção estava
-- sem os comentários. Nenhuma linha aqui lê, escreve ou inventa VALOR de teto:
-- ela só compara o estimado com o teto DECLARADO pelo operador.
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
  'D3 (rodada 3) + BAIXO 6 (rodada 8): admissão recusa SÓ o impossível (estimado > teto DECLARADO da conta, ou conta inexistente no painel). O teto do dia barra o PULL, não a ENTRADA. Re-declarada nesta migration porque o corpo em produção divergia do repositório (só comentários); nenhuma linha dela muda o valor do teto.';

-- ── 15 · fila_prompts_pegar_interno — sem 150 fantasma, sem negativo ───────
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
  v_defasagem       numeric;
  v_exigir          boolean := false;
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

  select teto_usd, coalesce(exigir_medicao_recente, false)
    into v_teto, v_exigir
    from public.painel_teto_diario where conta = p_conta;
  -- BAIXO 4 (rodada 8): aqui havia `if v_teto is null then v_teto := 150; end
  -- if;`. Um número inventado no meio do caminho do dinheiro — e justamente o
  -- número que o operador já tinha trocado por 500. Sem teto DECLARADO não se
  -- inventa teto: recusa-se, e o erro diz o que fazer.
  if v_teto is null then
    raise exception 'A conta % não tem teto diário declarado no painel — declare o teto em painel_teto_diario antes de pegar item.',
      p_conta using errcode = 'check_violation';
  end if;

  v_defasagem := public.painel_fila_defasagem_horas(p_conta);

  -- D32c (rodada 7): a recusa vem ANTES de qualquer escrita.
  if v_exigir and (v_defasagem is null or v_defasagem > 12) then
    v_medido   := public.painel_fila_consumo_hoje(p_conta);
    v_execucao := public.painel_fila_reservado(p_conta);
    return jsonb_build_object(
      'ok', true, 'item', null,
      'devolvidos', 0, 'mortos', 0, 'pulados', 0, 'travados', 0,
      'mortos_usd', 0,
      'em_espera', public.painel_fila_em_espera(p_conta),
      -- BAIXO 5 (rodada 8): este ramo saía SEM clamp. "headroom_usd: -3.00"
      -- ia literal para o relatório diário da Routine, contra a régua de que
      -- número negativo não aparece nem na tela nem no relatório (D13).
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
           -- MÉDIO 4: este número é da CASA. O operador corrige quantas vezes
           -- precisar enquanto o dia está aberto.
           custo_origem = 'estimativa',
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

  -- A FRASE recebe o headroom CRU (ela tem a própria régua de clamp, provada
  -- no bloco T14); o CAMPO numérico do JSON é que nunca sai negativo.
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
  'D32b/D32c (rodada 7) + BAIXO 4/BAIXO 5 (rodada 8): sem teto DECLARADO a RPC recusa em vez de inventar 150, e headroom_usd nunca sai negativo em ramo nenhum. Mantém D27/B5 (motivo aditivo), D21 (elegibilidade no where), D2/D19/D20, D26 (ultimo_worker_id) e a recusa por medição velha antes de qualquer escrita.';
revoke all on function public.fila_prompts_pegar_interno(text, text) from public, anon, authenticated;

-- ── 16 · fila_prompts_listar — a tela recebe a ORIGEM do custo (MÉDIO 4) ────
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
          -- D32a (rodada 7) + D35 (rodada 8): a última MEDIÇÃO (sessão com
          -- custo) de qualquer dia, e quão velha ela é.
          'medidoAteEm', public.painel_fila_medido_ate(t.conta),
          'defasagemHoras', public.painel_fila_defasagem_horas(t.conta),
          'exigeMedicaoRecente', coalesce(t.exigir_medicao_recente, false),
          -- D32d: a realidade medida ao lado do teto — leitura, nada muda.
          'historico', (
            select jsonb_build_object(
              'dias', h.dias, 'minUsd', h.min_usd,
              'maxUsd', h.max_usd, 'medianaUsd', h.mediana_usd)
            from public.painel_fila_historico_medido(t.conta) h
          )
        ) order by case t.conta
          when 'lucasscudeler@gmail.com' then 1
          when 'lsgpandora@gmail.com'    then 2
          when 'almapetra.ltda@gmail.com' then 3
          else 9 end)
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
  'D15 (rodada 4) + D32a/D32d (rodada 7) + MÉDIO 4/D35 (rodada 8): cada item traz custoOrigem (estimativa | medido | operador) e cada linha de consumo traz medidoAteEm da última MEDIÇÃO (não da última linha), defasagemHoras, exigeMedicaoRecente e o histórico medido.';
revoke all on function public.fila_prompts_listar(text, integer, timestamptz, uuid) from public;
grant execute on function public.fila_prompts_listar(text, integer, timestamptz, uuid) to anon, authenticated;
