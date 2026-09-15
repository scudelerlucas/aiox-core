-- ════════════════════════════════════════════════════════════════════════════
-- 0020 · LIFEBOARD v3 · P7 rodada 10 — os quatro P1 do livro-razão
-- ════════════════════════════════════════════════════════════════════════════
--
-- A 0019 foi revisada por dois revisores independentes (CodeRabbit e Codex),
-- cada um com contexto limpo. Os dois acharam, separados, o MESMO defeito no
-- mesmo bloco: `painel_caixa_lancar` lê o líquido da entidade sem trancar nada.
-- Convergência de dois revisores independentes no mesmo ponto é o sinal mais
-- forte que existe — e o defeito é justamente aquele que a peça P7 inteira
-- existe para matar: dinheiro cobrado duas vezes.
--
-- Esta migration NÃO reescreve a 0019. A 0019 já rodou no banco de produção;
-- história que já aconteceu não se edita. Aqui os corpos são REDECLARADOS por
-- `create or replace`, e a única linha de dado tocada é a reparação de
-- proveniência da §4 — explicada lá, e só nas linhas de ABERTURA.
--
-- Os quatro:
--
--  D42 (P1, os DOIS revisores) · `painel_caixa_lancar` serializa por entidade.
--      O comentário da 0019 dizia "Serializa dois lançamentos da mesma
--      entidade" — e não havia lock nenhum. Sob o READ COMMITTED padrão do
--      Postgres, duas transações leem o mesmo `v_liquido`, as duas lançam o
--      valor inteiro, e o livro dobra. O gatilho de imutabilidade NÃO impede
--      isso: ele recusa update e delete, e estes são dois inserts legítimos.
--      O caminho real: `painel_frentes_sessoes_lancar` (gatilho, sem lock de
--      item) cruzando com `fila_prompts_fechar_interno` no mesmo item.
--
--  D43 (P1, Codex) · proveniência muda mesmo com o valor igual.
--      `if v_liquido = v_alvo then return` saía sem gravar nada. Um item
--      cancelado lança ESTIMATIVA de US$ 80 na entidade da sessão; o worker
--      volta e relata MEDIDO US$ 80 — mesmo número. O item dizia "medido", e o
--      livro continuava sem `medido_em`, então `painel_fila_medido_ate` lia a
--      conta como NUNCA MEDIDA. Com `exigir_medicao_recente` ligada, isso
--      barra todo pull futuro daquela conta.
--
--  D44 (P1, Codex) · a parcela ESTIMADA desconta os estornos.
--      `painel_fila_estimativa_usd` filtrava `origem = 'estimativa'` e ponto.
--      O estorno tem `origem = 'estorno'`, então uma estimativa corrigida no
--      mesmo dia continuava contando inteira: o total da conta já estava certo
--      e a parcela "disso, US$ X é estimativa" mentia.
--
--  D45 (P1, Codex) · a abertura preserva quem disse o número.
--      A §7 da 0019 rotulava `case when custo_e_estimativa then 'estimativa'
--      else 'medido' end`, ignorando a coluna `custo_origem` que a 0018 criou
--      justamente para separar `operador` de `medido`. Todo item cujo custo o
--      OPERADOR digitou virou medição falsa, com `medido_em = concluido_em` —
--      e de novo solta a trava de medição recente que deveria estar armada.
--
-- Re-aplicável: todos os blocos são `create or replace` ou idempotentes.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1 · D42 + D43 · painel_caixa_lancar ─────────────────────────────────────
-- Mudam DUAS coisas em relação à 0019, e nada mais:
--   (a) um `pg_advisory_xact_lock` por entidade ANTES da primeira leitura;
--   (b) a saída-curta passa a exigir que a PROVENIÊNCIA também já bata.
create or replace function public.painel_caixa_lancar(
  p_entidade_tipo text,
  p_entidade_id   text,
  p_conta         text,
  p_alvo_usd      numeric,
  p_origem        text,
  p_item_id       uuid default null,
  p_sessao_id     text default null,
  p_medido_em     timestamptz default null,
  p_nota          text default null
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
  v_origem_atual   text;
  v_medido_atual   timestamptz;
  v_alvo           numeric;
  v_dia            date;
  v_estorno        uuid;
  v_novo           uuid;
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

  -- A proveniência VIGENTE sai da mesma leitura da conta (D43).
  select l.conta, l.id, l.origem, l.medido_em
    into v_conta, v_ultimo, v_origem_atual, v_medido_atual
    from public.painel_caixa_lancamentos l
   where l.entidade_tipo = p_entidade_tipo and l.entidade_id = p_entidade_id
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

  -- D43 (P1, Codex): valor igual NÃO é motivo suficiente para não gravar.
  -- Só há nada a fazer quando o valor E a proveniência já são os pedidos:
  --   · alvo zero e líquido zero — não existe medição de zero (D40), nada a
  --     atribuir, e gravar seria criar linha proibida (`valor_usd <> 0`);
  --   · ou a origem vigente é a mesma pedida, e quando ela é `medido` o
  --     `medido_em` já está carimbado.
  -- Fora disso, cai no caminho normal: estorno do líquido + lançamento novo,
  -- os dois no dia de HOJE. Com valor igual eles se anulam no total do dia — o
  -- dinheiro não se move, e a PROVENIÊNCIA passa a existir no livro.
  if v_liquido = v_alvo
     and (
       v_alvo = 0
       or (v_origem_atual is not distinct from p_origem
           and (p_origem <> 'medido' or v_medido_atual is not null))
     )
  then
    return jsonb_build_object(
      'ok', true, 'movimentou', false, 'conta', v_conta,
      'liquido_usd', round(v_liquido, 2), 'dia', null);
  end if;

  -- D37: o dia é SEMPRE o de hoje, no fuso do operador.
  v_dia := public.painel_dia_operador();

  -- D38: a correção é um ESTORNO DATADO do líquido anterior, seguido do
  -- lançamento novo.
  if v_liquido <> 0 then
    insert into public.painel_caixa_lancamentos
      (dia, conta, valor_usd, origem, entidade_tipo, entidade_id, item_id, sessao_id, estorna_id, nota)
    values
      (v_dia, v_conta, -v_liquido, 'estorno', p_entidade_tipo, p_entidade_id,
       p_item_id, p_sessao_id, v_ultimo,
       coalesce(p_nota, 'estorno do líquido anterior desta entidade'))
    returning id into v_estorno;
  end if;

  if v_alvo <> 0 then
    insert into public.painel_caixa_lancamentos
      (dia, conta, valor_usd, origem, entidade_tipo, entidade_id, item_id, sessao_id, medido_em, nota)
    values
      (v_dia, v_conta, v_alvo, p_origem, p_entidade_tipo, p_entidade_id,
       p_item_id, p_sessao_id,
       case when p_origem = 'medido' then coalesce(p_medido_em, now()) else null end,
       p_nota)
    returning id into v_novo;
  end if;

  return jsonb_build_object(
    'ok', true, 'movimentou', true, 'conta', v_conta, 'dia', v_dia,
    'liquido_anterior_usd', round(v_liquido, 2),
    'liquido_usd', round(v_alvo, 2),
    'delta_usd', round(v_alvo - v_liquido, 2),
    'origem_anterior', v_origem_atual, 'origem', p_origem,
    'estorno_id', v_estorno, 'lancamento_id', v_novo);
end;
$$;
comment on function public.painel_caixa_lancar(text, text, text, numeric, text, uuid, text, timestamptz, text) is
  'D37/D38/D39/D40 (rodada 9) + D42/D43 (rodada 10): a única porta de escrita do caixa. D42: serializa por entidade com pg_advisory_xact_lock ANTES de ler o líquido — sem ele, duas transações liam o mesmo líquido e as duas lançavam o valor inteiro (achado P1 convergente de CodeRabbit e Codex). D43: valor igual só é não-lançamento quando a PROVENIÊNCIA também já bate; medir US$ 80 sobre uma estimativa de US$ 80 agora grava o medido_em que a trava de medição recente lê.';
revoke all on function public.painel_caixa_lancar(text, text, text, numeric, text, uuid, text, timestamptz, text) from public, anon, authenticated;

-- ── 2 · D44 · a parcela ESTIMADA desconta os estornos ───────────────────────
-- Uma estimativa corrigida no mesmo dia deixa três linhas na entidade: a
-- `estimativa` original (+120), o `estorno` (-120) e o lançamento novo
-- (`medido`/`operador`). Filtrar só por `origem = 'estimativa'` via a primeira
-- e ignora a segunda — a parcela estimada seguia dizendo 120 num dia em que
-- nada mais era estimativa.
create or replace function public.painel_fila_estimativa_usd(p_conta text)
returns numeric
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select coalesce(sum(l.valor_usd), 0)
  from public.painel_caixa_lancamentos l
  where l.conta = p_conta
    and l.dia = public.painel_dia_operador()
    and (
      l.origem = 'estimativa'
      -- D44: o estorno de uma estimativa é parte da conta da estimativa.
      -- [Achado MAIOR, CodeRabbit] só quando o estorno é do MESMO dia da
      -- estimativa original: sem a.dia = l.dia, uma estimativa de ONTEM
      -- corrigida HOJE conta o estorno (-valor) sozinho, e a parcela ainda
      -- estimada de hoje fica NEGATIVA — a estimativa de ontem nunca esteve
      -- no total de hoje (l.dia = hoje já a exclui), só o estorno dela está.
      or (l.origem = 'estorno' and exists (
            select 1 from public.painel_caixa_lancamentos a
            where a.id = l.estorna_id and a.origem = 'estimativa' and a.dia = l.dia))
    );
$$;
comment on function public.painel_fila_estimativa_usd(text) is
  'D20 (rodada 4) + D41 (rodada 9) + D44 (rodada 10, corrigido rodada 11): quanto do consumo de HOJE ainda é ESTIMATIVA da casa. Soma as linhas de origem estimativa E os estornos, do MESMO dia, que apagam uma estimativa — sem a segunda metade, uma estimativa corrigida no mesmo dia continuava contando inteira; sem a checagem de dia, uma estimativa de dia anterior corrigida hoje deixava a parcela negativa (achado do CodeRabbit).';
revoke all on function public.painel_fila_estimativa_usd(text) from public, anon, authenticated;

-- O "N itens" segue a mesma lei: entidade cuja parcela estimada do dia zerou
-- (porque o número real chegou) não é mais um item estimado.
create or replace function public.painel_fila_estimativa_itens(p_conta text)
returns integer
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  with parcela as (
    select coalesce(l.item_id::text, l.entidade_id) as chave,
           sum(l.valor_usd) as usd
    from public.painel_caixa_lancamentos l
    where l.conta = p_conta
      and l.dia = public.painel_dia_operador()
      and (
        l.origem = 'estimativa'
        or (l.origem = 'estorno' and exists (
              select 1 from public.painel_caixa_lancamentos a
              where a.id = l.estorna_id and a.origem = 'estimativa' and a.dia = l.dia))
      )
    group by 1
  )
  select count(*)::int from parcela where usd <> 0;
$$;
comment on function public.painel_fila_estimativa_itens(text) is
  'D20 (rodada 4) + D41 (rodada 9) + D44 (rodada 10): quantas entidades ainda formam a parcela estimada de hoje. Conta só as que sobram com saldo estimado diferente de zero — a que já recebeu o número real sai da conta junto com o seu valor.';
revoke all on function public.painel_fila_estimativa_itens(text) from public, anon, authenticated;

-- ── 3 · D45 · a abertura preserva quem disse o número (bancos NOVOS) ────────
-- Para instalações que ainda não abriram o livro, a §7 da 0019 foi corrigida
-- no próprio arquivo (o insert é `on conflict do nothing`, então re-aplicar num
-- banco já aberto é no-op e a correção só alcança quem abrir daqui para a
-- frente). Bancos JÁ abertos são reparados na §4 abaixo.

-- ── 4 · D45 · reparo da proveniência nas linhas de ABERTURA ─────────────────
-- ATENÇÃO, e por isso este bloco é o único da migration que toca dado:
--
-- O livro é imutável por gatilho — `painel_caixa_lancamentos_imutavel` recusa
-- UPDATE e DELETE, e é isso que faz o passado parar de se mexer. Aqui ele é
-- desligado por um instante. A justificativa, por extenso:
--
--   · as linhas de `abertura = true` NÃO são fatos de negócio: são o saldo
--     inicial que a própria 0019 escreveu ao migrar o histórico;
--   · o defeito é um RÓTULO ERRADO escrito por uma migration com bug, não uma
--     correção de valor que o negócio pediu;
--   · `valor_usd` e `dia` NÃO são tocados — nenhum total de nenhum dia muda;
--   · o caminho normal (estornar + relançar) seria ERRADO aqui: jogaria linhas
--     novas no dia de HOJE para consertar um rótulo, mexendo no caixa de hoje
--     por causa de um bug de migração.
--
-- Um item cujo custo o OPERADOR digitou não é uma medição. Rotulado `medido`
-- com `medido_em` preenchido, ele solta a trava `exigir_medicao_recente` de
-- uma conta que nunca teve sessão medida — o oposto do que a trava existe para
-- fazer.
-- COMO o gatilho é contornado, e por que NÃO com `alter table ... disable
-- trigger`: a primeira versão deste bloco fazia exatamente isso e **abortava
-- sempre**, com `cannot ALTER TABLE because it has pending trigger events` — o
-- próprio UPDATE enfileira os eventos da FK auto-referente `estorna_id`, e o
-- Postgres recusa ALTER TABLE na mesma transação. Pior: o bloco abortava em
-- SILÊNCIO (o erro não parava o script) e a conferência da §5 seguia dizendo
-- "ok", porque só olhava se o gatilho estava de pé. Medido num Postgres 16
-- local: reparo nunca aplicado, migration relatando sucesso.
--
-- `session_replication_role = replica` desliga os gatilhos de usuário só nesta
-- transação, sem tocar na definição da tabela — e a §5 abaixo agora CONFERE
-- que o reparo aconteceu, em vez de confiar que aconteceu.
do $$
declare
  v_reparadas integer := 0;
begin
  if to_regclass('public.painel_caixa_lancamentos') is null then
    raise notice '0020 §4: livro-razão ainda não existe; nada a reparar.';
    return;
  end if;

  set local session_replication_role = replica;

  update public.painel_caixa_lancamentos l
     set origem    = 'operador',
         medido_em = null,
         nota      = coalesce(l.nota, '') ||
                     ' · 0020/D45: proveniência reparada — o custo foi digitado pelo operador, não medido por sessão.'
    from public.painel_fila_prompts f
   where l.abertura                      -- SÓ o saldo de abertura
     and l.origem      = 'medido'        -- que a 0019 rotulou como medição
     and l.item_id     = f.id
     and f.custo_origem = 'operador';    -- e que o operador tinha digitado

  get diagnostics v_reparadas = row_count;

  set local session_replication_role = origin;

  raise notice '0020 §4 (D45): % linha(s) de abertura com proveniência reparada.', v_reparadas;
exception
  when others then
    -- Os gatilhos NUNCA ficam desligados por causa de um erro aqui.
    begin
      set local session_replication_role = origin;
    exception when others then null;
    end;
    raise;
end;
$$;

-- ── 5 · CONFERÊNCIA: nenhum dia mudou de valor ──────────────────────────────
-- A §4 promete não mexer em dinheiro. Aqui isso é VERIFICADO, não prometido:
-- nenhuma linha de abertura pode ter valor nulo ou dia nulo, e o gatilho de
-- imutabilidade tem de estar de pé ao fim da migration.
do $$
declare
  v_quebradas integer;
  v_gatilho   boolean;
  v_pendentes integer;
begin
  select count(*) into v_quebradas
    from public.painel_caixa_lancamentos
   where abertura and (valor_usd is null or dia is null);
  if v_quebradas > 0 then
    raise exception '0020 §5: % linha(s) de abertura sem valor ou sem dia — a §4 saiu do lugar.', v_quebradas;
  end if;

  -- A conferência que FALTAVA. A primeira versão da §4 abortava em silêncio e
  -- esta §5 dizia "ok" mesmo assim, porque só olhava o gatilho. Agora ela mede
  -- o RESULTADO: nenhuma linha de abertura pode continuar rotulada como
  -- medição tendo sido digitada pelo operador. Se a §4 não rodar, isto aborta.
  select count(*) into v_pendentes
    from public.painel_caixa_lancamentos l
    join public.painel_fila_prompts f on f.id = l.item_id
   where l.abertura and l.origem = 'medido' and f.custo_origem = 'operador';
  if v_pendentes > 0 then
    raise exception '0020 §5: % linha(s) de abertura seguem rotuladas como medição com custo digitado pelo operador — o reparo da §4 NÃO foi aplicado.', v_pendentes;
  end if;

  select tgenabled <> 'D' into v_gatilho
    from pg_trigger
   where tgname = 'painel_caixa_lancamentos_imutavel'
     and tgrelid = 'public.painel_caixa_lancamentos'::regclass;
  if v_gatilho is distinct from true then
    raise exception '0020 §5: o gatilho de imutabilidade do livro NÃO está ativo ao fim da migration.';
  end if;

  raise notice '0020 §5: conferência ok — nenhum dia mudou de valor, gatilho de imutabilidade ativo.';
end;
$$;
