-- ════════════════════════════════════════════════════════════════════════════
-- 0028 · LIFEBOARD v3 · o crédito sem dia não vira teto, e a TELA sabe o que o
--        BANCO sabe
-- ════════════════════════════════════════════════════════════════════════════
--
-- POR QUE ESTA MIGRATION EXISTE, e não uma edição da 0027. A 0027 ainda NÃO
-- foi para produção (conferido por leitura de `supabase_migrations.schema_
-- migrations` em 21/09/2026: a última linha é `0026_lifeboard_v3_fila_quarta_
-- conta_arborcactus`), e por isso a correção do CRÍTICO 1 que mexe no CORPO de
-- funções que a 0027 já redeclara — `painel_caixa_lancar` e
-- `fila_prompts_pegar_interno` — foi feita DENTRO da 0027. Redeclará-las aqui
-- deixaria no caminho de aplicação uma versão sabidamente furada da mesma
-- função, que é exatamente a confusão que o cabeçalho da 0027 existe para
-- desfazer.
--
-- Esta migration carrega só o que a 0027 NÃO declara:
--   §1 · o piso do número que governa o teto (a segunda parede de D54, e a
--        única que protege o dado que produção JÁ tem);
--   §2 · `fila_prompts_listar` passa a mandar, por item, o que o LIVRO sabe
--        (MÉDIO 3: a tela decidia pela coluna do item, o banco decide pelo
--        lançamento vivo da entidade — e as duas divergem desde a D53);
--   §3 · BAIXO 4 · o `revoke` das quatro funções-gatilho que nascem em
--        migrations anteriores à 0027.
--
-- Re-aplicável: tudo é `create or replace`.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1 · D54 · o gasto de um dia, para efeito de TETO, nunca é negativo ──────
-- `painel_caixa_do_dia` continua CRU de propósito: ele é a leitura de
-- auditoria, a soma literal do livro, e é por ele que se enxerga um dia
-- estranho. Quem ganha o piso é a função que o TETO consulta.
--
-- Com a D54 (0027 §6) nenhum dia NOVO consegue somar negativo: o estorno não
-- tira de hoje mais do que hoje tem. Este piso é a parede que vale para o
-- dado que JÁ EXISTE — produção rodou da 0019 à 0026 com o estorno inteiro, e
-- qualquer dia que já tenha ficado negativo lá continuaria abrindo teto na
-- primeira leitura depois do deploy. Piso não conserta o livro; impede que um
-- livro torto vire dinheiro.
create or replace function public.painel_fila_consumo_do_dia(p_conta text, p_dia date)
returns numeric
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  -- D41: uma definição só — a soma dos lançamentos daquele dia.
  -- D54 (rodada 13): e ela nunca é negativa. Um dia com soma negativa é
  -- crédito de um dia fechado tentando virar teto de hoje; ele não vira.
  select greatest(public.painel_caixa_do_dia(p_conta, p_dia), 0);
$$;
comment on function public.painel_fila_consumo_do_dia(text, date) is
  'D41 (rodada 9) + D54 (rodada 13): gasto de um dia = soma dos lançamentos daquele dia (painel_caixa_do_dia), com PISO ZERO. O piso é a segunda parede do CRÍTICO 1: a primeira é o estorno limitado ao que a entidade pôs no dia (0027 §6), que impede o negativo de nascer; esta protege o dado anterior à correção, em que ele já pode existir. A leitura CRUA continua em painel_caixa_do_dia, para auditoria.';
revoke all on function public.painel_fila_consumo_do_dia(text, date) from public, anon, authenticated;

-- ── 2 · MÉDIO 3 · cada item leva consigo o que o LIVRO diz dele ────────────
-- A CAUSA, uma só para os três sintomas medidos pelo crítico: a tela raciocina
-- sobre a coluna `custo_origem` do ITEM e o banco raciocina sobre a origem do
-- LANÇAMENTO ATIVO da ENTIDADE dele. Desde a D53 (posto) as duas divergem — o
-- item pode dizer `estimativa` (a casa lançou quando ele morreu) enquanto a
-- sessão vinculada já publicou US$ 300 medidos. Dali saíam:
--   · o botão "ajustar custo" aparecendo para um item que `fila_prompts_
--     ajustar_custo` recusa ("Este custo já foi medido pela sessão");
--   · o aviso do cancelamento prometendo "US$ 50,00 entram no gasto de hoje …
--     dá para ajustar na linha depois" quando entram US$ 0,00 e não dá;
--   · a célula imprimindo "US$ 50,00 · estimativa da casa" para um item cuja
--     contribuição real ao dia é 300.
-- A raiz se fecha mandando o que o livro sabe JUNTO com o item. A tela deixa de
-- deduzir: ela lê.
--
-- Três campos, os mesmos que o banco usa para decidir:
--   `livroOrigem`       — a origem do lançamento ATIVO da entidade canônica;
--   `livroPrecedencia`  — o POSTO dele (10/20/30/40), a régua literal da D53;
--   `livroLiquidoUsd`   — quanto essa entidade pesa no livro hoje.
-- `null` nos três = entidade sem lançamento vivo (o caso comum de item que
-- nunca custou nada), e a tela degrada para a dedução de antes.
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
      (select coalesce(sum(x.valor_usd), 0)
         from public.painel_caixa_lancamentos x
        where x.entidade_tipo = case when v.session_id is not null then 'sessao' else 'item' end
          and x.entidade_id   = case when v.session_id is not null then v.session_id else v.id::text end
      ) as livro_liquido
    from visivel v
    left join lateral (
      select l.origem, l.precedencia
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
          'historico', (
            select jsonb_build_object(
              'dias', h.dias, 'minUsd', h.min_usd,
              'maxUsd', h.max_usd, 'medianaUsd', h.mediana_usd)
            from public.painel_fila_historico_medido(t.conta) h
          )
        -- MÉDIO 3 (rodada 12) mantido: a 4ª conta é citada, não herdada pelo
        -- `else 9`. Esta migration é agora a ÚLTIMA palavra sobre o desempate,
        -- e `tests/unit/prompts-espelho-sql.test.ts` exige que a última
        -- palavra cite todas as contas de `CONTAS`.
        ) order by case t.conta
          when 'lucasscudeler@gmail.com'  then 1
          when 'lsgpandora@gmail.com'     then 2
          when 'almapetra.ltda@gmail.com' then 3
          when 'arborcactus@gmail.com'    then 4
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
  'D15/D32a/D32d/D35 + MÉDIO 4 (rodada 8) + MÉDIO 3 (rodada 13): além de custoOrigem (a coluna do ITEM), cada linha traz livroOrigem, livroPrecedencia e livroLiquidoUsd — a origem, o POSTO e o líquido do lançamento ATIVO da entidade canônica do item. É o que o banco consulta para aceitar ou recusar um ajuste; sem isso a tela oferecia botão que a RPC recusa e prometia dinheiro que não entra.';
revoke all on function public.fila_prompts_listar(text, integer, timestamptz, uuid) from public;
grant execute on function public.fila_prompts_listar(text, integer, timestamptz, uuid) to anon, authenticated;

-- ── 3 · BAIXO 4 · as funções-gatilho também perdem o execute público ───────
-- Não é buraco explorável: o Postgres recusa chamada direta a função que
-- retorna `trigger`. É a única EXCEÇÃO ao padrão de todas as outras funções
-- destas migrations, e uma exceção sem motivo é o que uma varredura de
-- permissão encontra e alguém tem de ir investigar. `painel_frentes_sessoes_
-- lancar()` recebe o seu na 0027 §7b, onde ela nasce.
revoke all on function public.painel_caixa_imutavel() from public, anon, authenticated;
revoke all on function public.painel_caixa_barreira_de_teste() from public, anon, authenticated;
revoke all on function public.painel_fila_prompts_checar_teto() from public, anon, authenticated;
revoke all on function public.lifeboard_touch_updated_at() from public, anon, authenticated;
