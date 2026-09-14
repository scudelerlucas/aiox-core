-- =============================================================================
-- OS-LIFEBOARD · Migration 0019 — P7: RODADA 9. O caixa vira LIVRO-RAZÃO.
-- O dia deixa de ser DERIVADO a cada leitura e passa a ser LANÇADO, uma vez.
-- =============================================================================
-- Sobre 0007 + 0009 + 0011 + 0012 + 0013 + 0014 + 0015 + 0016 + 0018. Tudo
-- `create table if not exists` / `create or replace` / `create index if not
-- exists` — RE-APLICÁVEL. Nenhuma remoção de função, tabela, coluna ou índice.
--
-- NADA NESTE ARQUIVO MEXE NO VALOR DO TETO. `public.painel_teto_diario` está
-- em 500 nas três contas por decisão do operador (14/09/2026): não há `update
-- ... set teto_usd`, não há `alter column teto_usd set default`, não há
-- `insert into painel_teto_diario`, e o número 150 não aparece em lugar nenhum
-- do caminho do dinheiro.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- O DIAGNÓSTICO DO CRÍTICO DA RODADA 8, EM UMA FRASE
--   "o caixa recalcula o dia a cada leitura, então o passado muda."
--
-- Os quatro ALTO eram quatro sintomas do MESMO defeito estrutural: o valor de
-- um dia era uma EXPRESSÃO sobre linhas vivas (`painel_frentes_sessoes` ×
-- `painel_fila_prompts`), avaliada de novo a cada `select`. Qualquer coluna
-- que mudasse — `concluido_em`, `atualizado_em`, `conta`, `session_id` —
-- reescrevia dias já encerrados e já relatados. Remendar cada caminho de
-- escrita seria correr atrás de um número que continua sendo derivado.
--
-- ESTA RODADA TROCA O MODELO. O dia passa a ser um FATO GRAVADO:
--
--   D37  LIVRO-RAZÃO IMUTÁVEL (`public.painel_caixa_lancamentos`).
--        Cada lançamento é (dia de competência, conta, valor, origem,
--        entidade). O `dia` é carimbado NO INSTANTE DO LANÇAMENTO e nunca mais
--        é recalculado. Um `before update or delete` proíbe editar e apagar —
--        o banco RECUSA, não é promessa de disciplina.
--        Consumo de um dia = soma dos lançamentos daquele dia. Nada mais.
--
--   D38  CORREÇÃO É ESTORNO DATADO, NUNCA EDIÇÃO. Mudou o número de uma
--        entidade? `painel_caixa_lancar` grava DUAS linhas novas, as duas
--        datadas de HOJE: o estorno do líquido anterior e o lançamento do
--        valor novo. O dia antigo fica exatamente como foi relatado.
--
--   D39  A ENTIDADE É CANÔNICA, E A CONTA É DELA (ALTO 3). A entidade de um
--        item COM sessão vinculada é a SESSÃO (`sessao:<id>`); sem sessão, é o
--        próprio item (`item:<uuid>`). Item e sessão nunca são duas entidades
--        para o mesmo trabalho — é isso que torna a cobrança em dobro
--        impossível, sem depender de `left join lateral` nenhum. E a CONTA é
--        fixada no PRIMEIRO lançamento da entidade: uma sessão publicada
--        depois, sob outra conta, não remaneja dinheiro já lançado.
--
--   D40  ZERO É NÃO-LANÇAMENTO (ALTO 4). `check (valor_usd <> 0)`: "sem valor"
--        e "valor zero" são a mesma coisa — a ausência de medição. Uma sessão
--        que fechou sem ler o usage não pode desarmar a trava de medição
--        recente, porque ela não deixa lançamento nenhum para desarmar.
--
--   D41  UMA DEFINIÇÃO SÓ DE "QUANTO A CONTA GASTOU NO DIA X" (MÉDIO 3 da
--        rodada 8, e MÉDIO 3 desta). `painel_consumo_por_conta_dia`,
--        `painel_fila_consumo_do_dia`, `painel_fila_historico_medido` e
--        `painel_fila_itens_do_dia` passam TODAS a ler o livro-razão. Antes,
--        `painel_fila_historico_medido` lia só as sessões e o dia de US$ 120
--        de um item simplesmente não existia para a régua com que o operador
--        escolhe o teto.
--
--   D42  O CHOOSER É UMA FUNÇÃO PURA, ESPELHO PROVÁVEL DO TS (MÉDIO 1).
--        `painel_fila_escolher_conta(jsonb, numeric)` recebe os números e
--        devolve a escolha — a MESMA regra de `escolherConta` em
--        `src/core/prompts/roteador.ts`, incluindo a recusa por medição velha
--        (`exigir_medicao_recente`) que o laço de `fila_prompts_enfileirar`
--        ignorava, e o descarte de conta cujo TETO não comporta o item (que o
--        TS resolvia com `max(tetos)` e o trigger com o teto da conta
--        escolhida). A paridade é provada caso a caso: o bloco T42 de
--        `supabase/tests/fila_prompts.test.sql` carrega uma tabela de casos em
--        JSON e `tests/unit/prompts-paridade-chooser.test.ts` LÊ o mesmo
--        literal do disco e roda o TS sobre ele.
--
--   D43  BARREIRA DE TESTE (BAIXO 5 da rodada 8, marcado "perigoso"). A
--        segurança da suíte SQL dependia de TODO bloco terminar em `raise` —
--        e T38 apaga 194 sessões reais de `lucasscudeler@gmail.com` dentro do
--        bloco. Agora, com `lifeboard.teste = on` na sessão do psql, um
--        `constraint trigger deferrable initially deferred` sobre as quatro
--        tabelas de dinheiro dispara NO COMMIT e aborta: um bloco que esqueça
--        o `raise` não consegue mais persistir nada. É mecanismo, não
--        disciplina.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- MIGRAÇÃO DOS DADOS EXISTENTES (decisão fixa do operador)
--   As 215 sessões e os itens existentes viram LANÇAMENTOS DE ABERTURA, cada
--   um na data que a leitura ANTERIOR já lhe atribuía. A conferência do §8
--   compara, dia a dia e conta a conta, a fórmula velha (escrita inline, para
--   continuar valendo mesmo depois de as funções serem trocadas) com a soma do
--   livro-razão, e ABORTA A MIGRATION se um único dia mudar de valor.
-- =============================================================================

-- ── 1 · o livro-razão ───────────────────────────────────────────────────────
create table if not exists public.painel_caixa_lancamentos (
  id            uuid primary key default gen_random_uuid(),
  -- D37: a DATA DE COMPETÊNCIA. Carimbada no instante do lançamento, nunca
  -- recalculada. É esta coluna, e só ela, que responde "de que dia é este
  -- dinheiro?".
  dia           date not null,
  conta         text not null,
  -- D40: zero é NÃO-LANÇAMENTO. A ausência de medição não vira linha.
  valor_usd     numeric not null check (valor_usd <> 0),
  origem        text not null check (origem in ('estimativa','medido','operador','estorno')),
  -- Marca as linhas do §7: os 215 registros de sessão e os itens que já
  -- existiam, abertos na data que a leitura anterior já lhes atribuía. É a
  -- chave de idempotência da migration — re-aplicar não duplica dinheiro.
  abertura      boolean not null default false,
  entidade_tipo text not null check (entidade_tipo in ('item','sessao')),
  entidade_id   text not null,
  -- Redundantes de propósito: o livro precisa ser legível sem join.
  item_id       uuid,
  sessao_id     text,
  -- Quando este lançamento REPRESENTA UMA MEDIÇÃO, o instante em que ela foi
  -- feita. É daqui que sai `painel_fila_medido_ate` — e por isso um custo zero
  -- (que não vira lançamento) não tem como desarmar a trava.
  medido_em     timestamptz,
  estorna_id    uuid references public.painel_caixa_lancamentos(id),
  nota          text,
  criado_em     timestamptz not null default now()
);

comment on table public.painel_caixa_lancamentos is
  'D37 (rodada 9): o livro-razão do caixa. Lançamentos IMUTÁVEIS de (dia de competência, conta, valor, origem, entidade). O consumo de um dia é a soma dos lançamentos daquele dia — nenhuma leitura deriva o dia de coluna viva nenhuma. Correção nunca edita: cria estorno datado (D38). Nasceu porque o caixa recalculava o dia a cada leitura e o passado mudava — os 4 ALTO da rodada 8 eram o mesmo defeito.';
comment on column public.painel_caixa_lancamentos.dia is
  'D37: a data de competência, carimbada no instante do lançamento. Nunca recalculada, nunca editada.';
comment on column public.painel_caixa_lancamentos.entidade_id is
  'D39: a entidade CANÔNICA do trabalho — a sessão quando existe vínculo (`sessao`), senão o item (`item`). Item e sessão nunca são duas entidades para o mesmo dinheiro.';
comment on column public.painel_caixa_lancamentos.conta is
  'D39 (ALTO 3): fixada no PRIMEIRO lançamento da entidade e não remanejada depois. Sessão publicada mais tarde sob outra conta não leva embora dinheiro já lançado.';
comment on column public.painel_caixa_lancamentos.medido_em is
  'D40 (ALTO 4): o instante da MEDIÇÃO que este lançamento representa (null quando não é medição). `painel_fila_medido_ate` lê daqui; custo zero não vira lançamento e portanto não desarma a trava de medição recente.';

create index if not exists painel_caixa_lancamentos_conta_dia
  on public.painel_caixa_lancamentos (conta, dia);
create index if not exists painel_caixa_lancamentos_entidade
  on public.painel_caixa_lancamentos (entidade_tipo, entidade_id);
create index if not exists painel_caixa_lancamentos_medido
  on public.painel_caixa_lancamentos (conta, medido_em);
create index if not exists painel_caixa_lancamentos_item
  on public.painel_caixa_lancamentos (item_id) where item_id is not null;
-- A abertura de cada entidade acontece UMA vez: re-aplicar a migration não
-- duplica dinheiro nenhum.
create unique index if not exists painel_caixa_abertura_unica
  on public.painel_caixa_lancamentos (entidade_tipo, entidade_id) where abertura;

alter table public.painel_caixa_lancamentos enable row level security;
revoke all on table public.painel_caixa_lancamentos from public, anon, authenticated;

-- ── 2 · a imutabilidade é do BANCO, não da disciplina (D37) ─────────────────
create or replace function public.painel_caixa_imutavel()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  raise exception 'O livro-razão do caixa é imutável: lançamento não se edita nem se apaga. Para corrigir um número, grave um ESTORNO datado (fila_prompts_ajustar_custo, ou painel_caixa_lancar com o valor novo).'
    using errcode = 'check_violation';
end;
$$;
comment on function public.painel_caixa_imutavel() is
  'D37 (rodada 9): recusa UPDATE e DELETE em painel_caixa_lancamentos. Sem esta trava, "o passado não muda" seria uma promessa; com ela, é uma propriedade do banco.';

drop trigger if exists painel_caixa_lancamentos_imutavel on public.painel_caixa_lancamentos;
create trigger painel_caixa_lancamentos_imutavel
  before update or delete on public.painel_caixa_lancamentos
  for each row execute function public.painel_caixa_imutavel();

-- ── 3 · D43 · a barreira de teste (BAIXO 5 da rodada 8, "perigoso") ─────────
-- `constraint trigger ... deferrable initially deferred` dispara NO COMMIT.
-- Com `lifeboard.teste = on` (a suíte SQL arma isso UMA vez, no topo do
-- arquivo, para a sessão inteira do psql), qualquer transação que tenha tocado
-- uma das quatro tabelas de dinheiro ABORTA ao tentar commitar. Um bloco que
-- esqueça o `raise` final não persiste nada — nem os 194 `delete` de sessões
-- reais de T38. Em produção o parâmetro não existe e nada acontece.
create or replace function public.painel_caixa_barreira_de_teste()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if coalesce(current_setting('lifeboard.teste', true), 'off') = 'on' then
    raise exception 'BARREIRA DE TESTE: este bloco escreveu em dado real e não terminou em `raise` — a transação foi revertida no commit. Todo bloco da suíte tem de terminar em `raise exception ''RESULTADO: ok — …''`.'
      using errcode = 'check_violation';
  end if;
  return null;
end;
$$;
comment on function public.painel_caixa_barreira_de_teste() is
  'D43 (rodada 9): gatilho de restrição DIFERIDO — dispara no COMMIT. Com lifeboard.teste=on, aborta qualquer transação que tenha escrito nas tabelas de dinheiro. É o que torna IMPOSSÍVEL um bloco da suíte SQL persistir escrita em dado real por esquecer o `raise` (T38 apaga 194 sessões reais dentro do bloco).';

drop trigger if exists painel_fila_prompts_barreira_teste on public.painel_fila_prompts;
create constraint trigger painel_fila_prompts_barreira_teste
  after insert or update or delete on public.painel_fila_prompts
  deferrable initially deferred
  for each row execute function public.painel_caixa_barreira_de_teste();

drop trigger if exists painel_frentes_sessoes_barreira_teste on public.painel_frentes_sessoes;
create constraint trigger painel_frentes_sessoes_barreira_teste
  after insert or update or delete on public.painel_frentes_sessoes
  deferrable initially deferred
  for each row execute function public.painel_caixa_barreira_de_teste();

drop trigger if exists painel_teto_diario_barreira_teste on public.painel_teto_diario;
create constraint trigger painel_teto_diario_barreira_teste
  after insert or update or delete on public.painel_teto_diario
  deferrable initially deferred
  for each row execute function public.painel_caixa_barreira_de_teste();

drop trigger if exists painel_caixa_lancamentos_barreira_teste on public.painel_caixa_lancamentos;
create constraint trigger painel_caixa_lancamentos_barreira_teste
  after insert or update or delete on public.painel_caixa_lancamentos
  deferrable initially deferred
  for each row execute function public.painel_caixa_barreira_de_teste();

-- ── 4 · a entidade canônica de um item (D39) ────────────────────────────────
create or replace function public.painel_caixa_entidade_do_item(p_item uuid)
returns text
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  -- D39: item COM sessão vinculada e a sessão são A MESMA entidade. É por isso
  -- que "o mesmo dinheiro em duas contas" (ALTO 2 da rodada 8) deixou de ser
  -- um caso a defender: não há duas entidades para defender uma da outra.
  select case
    when f.session_id is not null then 'sessao:' || f.session_id
    else 'item:' || f.id::text
  end
  from public.painel_fila_prompts f
  where f.id = p_item;
$$;
comment on function public.painel_caixa_entidade_do_item(uuid) is
  'D39 (rodada 9): a chave canônica do trabalho de um item — a sessão vinculada quando existe, senão o próprio item. Uma entidade, um dinheiro.';
revoke all on function public.painel_caixa_entidade_do_item(uuid) from public, anon, authenticated;

-- ── 5 · painel_caixa_lancar — a ÚNICA porta de escrita do caixa (D37/D38) ───
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
  v_liquido   numeric;
  v_conta     text;
  v_ultimo    uuid;
  v_alvo      numeric;
  v_dia       date;
  v_estorno   uuid;
  v_novo      uuid;
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

  -- Serializa dois lançamentos da mesma entidade.
  select coalesce(sum(l.valor_usd), 0)
    into v_liquido
    from public.painel_caixa_lancamentos l
   where l.entidade_tipo = p_entidade_tipo and l.entidade_id = p_entidade_id;

  select l.conta, l.id
    into v_conta, v_ultimo
    from public.painel_caixa_lancamentos l
   where l.entidade_tipo = p_entidade_tipo and l.entidade_id = p_entidade_id
   order by l.criado_em desc, l.id desc
   limit 1;

  -- D39 (ALTO 3): A CONTA É FIXADA NO LANÇAMENTO. O primeiro lançamento desta
  -- entidade decidiu de quem é o dinheiro; nenhuma publicação posterior
  -- remaneja. Antes, a guarda de conta só agia quando a sessão JÁ estava
  -- publicada — e o caminho real é a sessão nascer depois, quando a guarda já
  -- passou. Aqui não há guarda a driblar: não existe o remanejo.
  v_conta := coalesce(v_conta, p_conta);
  if v_conta is null then
    raise exception 'painel_caixa_lancar: conta é obrigatória no primeiro lançamento de uma entidade.'
      using errcode = 'check_violation';
  end if;

  if v_liquido = v_alvo then
    return jsonb_build_object(
      'ok', true, 'movimentou', false, 'conta', v_conta,
      'liquido_usd', round(v_liquido, 2), 'dia', null);
  end if;

  -- D37: o dia é SEMPRE o de hoje, no fuso do operador. Nenhum lançamento novo
  -- cai num dia passado — é isto que torna "dinheiro entra num dia encerrado há
  -- cinco dias" (ALTO 2 da rodada 8) estruturalmente impossível.
  v_dia := public.painel_dia_operador();

  -- D38: a correção é um ESTORNO DATADO do líquido anterior, seguido do
  -- lançamento novo. O dia antigo continua valendo exatamente o que foi
  -- relatado; a diferença aparece no dia em que a correção aconteceu.
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
    'estorno_id', v_estorno, 'lancamento_id', v_novo);
end;
$$;
comment on function public.painel_caixa_lancar(text, text, text, numeric, text, uuid, text, timestamptz, text) is
  'D37/D38/D39/D40 (rodada 9): a única porta de escrita do caixa. Leva a entidade ao VALOR ALVO gravando linhas novas — estorno datado do líquido anterior + lançamento do novo —, sempre no dia de HOJE. A conta é a do primeiro lançamento da entidade (ALTO 3: não se remaneja). Alvo zero é não-lançamento (ALTO 4). Dia passado nunca recebe linha nova (ALTO 2).';
revoke all on function public.painel_caixa_lancar(text, text, text, numeric, text, uuid, text, timestamptz, text) from public, anon, authenticated;

-- ── 6 · painel_caixa_do_dia — a leitura, e ela é uma soma ───────────────────
create or replace function public.painel_caixa_do_dia(p_conta text, p_dia date)
returns numeric
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select coalesce(sum(l.valor_usd), 0)
  from public.painel_caixa_lancamentos l
  where l.conta = p_conta and l.dia = p_dia;
$$;
comment on function public.painel_caixa_do_dia(text, date) is
  'D37 (rodada 9): o consumo de um dia é a SOMA DOS LANÇAMENTOS daquele dia, e nada mais. Nenhuma coluna viva entra nesta conta — é por isso que o passado parou de se mexer.';
revoke all on function public.painel_caixa_do_dia(text, date) from public, anon, authenticated;

-- ── 6b · painel_caixa_lancar_item — a porta dos ITENS, com FUSÃO de entidade ─
-- Um item pode lançar ANTES de ter sessão vinculada (morreu sem fechar) e
-- ganhar a sessão DEPOIS (o último dono volta e fecha com o número real). Se a
-- entidade fosse recalculada a cada lançamento, o dinheiro do item ficaria numa
-- entidade órfã (`item:<uuid>`) e o novo entraria noutra (`sessao:<id>`) — duas
-- entidades para o MESMO trabalho, exatamente o defeito que D39 existe para
-- matar. Esta função faz a FUSÃO: zera a órfã com um estorno datado e lança na
-- canônica. É por aqui que fechar, cancelar, ajustar e a morte no pull passam.
create or replace function public.painel_caixa_lancar_item(
  p_item      uuid,
  p_alvo_usd  numeric,
  p_origem    text,
  p_medido_em timestamptz default null,
  p_nota      text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_f        record;
  v_ent_tipo text;
  v_ent_id   text;
  v_orfa     numeric;
begin
  select f.id, f.conta, f.session_id into v_f
    from public.painel_fila_prompts f where f.id = p_item;
  if not found then
    raise exception 'painel_caixa_lancar_item: item % não existe.', p_item
      using errcode = 'check_violation';
  end if;

  if v_f.session_id is not null then
    v_ent_tipo := 'sessao';
    v_ent_id   := v_f.session_id;
    select coalesce(sum(l.valor_usd), 0) into v_orfa
      from public.painel_caixa_lancamentos l
     where l.entidade_tipo = 'item' and l.entidade_id = p_item::text;
    if v_orfa <> 0 then
      perform public.painel_caixa_lancar(
        'item', p_item::text, v_f.conta, 0, 'estimativa', p_item, v_f.session_id, null,
        'fusão de entidade: o trabalho passou a ter sessão vinculada e o dinheiro vai para ela');
    end if;
  else
    v_ent_tipo := 'item';
    v_ent_id   := p_item::text;
  end if;

  return public.painel_caixa_lancar(
    v_ent_tipo, v_ent_id, v_f.conta, p_alvo_usd, p_origem,
    v_f.id, v_f.session_id, p_medido_em, p_nota);
end;
$$;
comment on function public.painel_caixa_lancar_item(uuid, numeric, text, timestamptz, text) is
  'D39 (rodada 9): a porta de lançamento de um ITEM. Resolve a entidade canônica (a sessão vinculada quando existe) e FUNDE a entidade órfã quando o item já tinha lançado antes de ganhar sessão — estorno datado da órfã, lançamento na canônica. Sem esta fusão, "item morre sem fechar e o dono volta com o número real" criaria duas entidades para o mesmo trabalho.';
revoke all on function public.painel_caixa_lancar_item(uuid, numeric, text, timestamptz, text) from public, anon, authenticated;

-- ── 7 · ABERTURA — os 215 registros e os itens viram lançamentos ────────────
-- Cada um na data que a leitura ANTERIOR já lhe atribuía. A entidade segue a
-- regra canônica de D39 desde a abertura: item com sessão vinculada abre sob
-- `sessao:<id>`, para que a publicação posterior daquela sessão encontre a
-- MESMA entidade (e não uma segunda).
insert into public.painel_caixa_lancamentos
  (dia, conta, valor_usd, origem, abertura, entidade_tipo, entidade_id, item_id, sessao_id, medido_em, nota)
select
  public.painel_sessao_dia_de_cobranca(
    s.sessao_id, coalesce(s.atualizado_em, s.criado_em, s.publicado_em)),
  s.conta,
  s.custo_usd,
  'medido',
  true,
  'sessao',
  s.sessao_id,
  (select f.id from public.painel_fila_prompts f where f.session_id = s.sessao_id limit 1),
  s.sessao_id,
  coalesce(s.atualizado_em, s.criado_em, s.publicado_em),
  'abertura da rodada 9 — mesmo dia que painel_consumo_por_conta_dia já atribuía'
from public.painel_frentes_sessoes s
where s.conta is not null
  and s.custo_usd is not null
  and s.custo_usd <> 0
  and coalesce(s.atualizado_em, s.criado_em, s.publicado_em) is not null
on conflict (entidade_tipo, entidade_id) where abertura do nothing;

insert into public.painel_caixa_lancamentos
  (dia, conta, valor_usd, origem, abertura, entidade_tipo, entidade_id, item_id, sessao_id, medido_em, nota)
select
  public.painel_dia_operador(f.concluido_em),
  f.conta,
  f.custo_usd,
  -- D45 (rodada 10, P1 do Codex): a 0018 criou `custo_origem` justamente para
  -- separar `operador` de `medido`, e esta abertura ignorava a coluna —
  -- rotulava como MEDIÇÃO todo custo que o operador tinha digitado à mão, com
  -- `medido_em` preenchido. Isso solta a trava `exigir_medicao_recente` de uma
  -- conta que nunca teve sessão medida. Quem já abriu o livro é reparado pela
  -- §4 da 0020; daqui para a frente nasce certo.
  case
    when f.custo_origem = 'operador' then 'operador'
    when f.custo_e_estimativa then 'estimativa'
    else 'medido'
  end,
  true,
  case when f.session_id is not null then 'sessao' else 'item' end,
  coalesce(f.session_id, f.id::text),
  f.id,
  f.session_id,
  case
    when f.custo_origem = 'operador' or f.custo_e_estimativa then null
    else f.concluido_em
  end,
  'abertura da rodada 9 — mesmo dia que painel_fila_itens_do_dia já atribuía'
from public.painel_fila_prompts f
left join lateral (
  select s.custo_usd
  from public.painel_frentes_sessoes s
  where f.session_id is not null and s.sessao_id = f.session_id
  order by s.custo_usd desc nulls last
  limit 1
) ses on true
where f.custo_usd is not null
  and f.custo_usd <> 0
  and f.concluido_em is not null
  -- a dedup de D31/0018: item cuja sessão já publicou custo contribuía ZERO —
  -- o dinheiro dele já entrou pela abertura da sessão, acima.
  and ses.custo_usd is null
  and (
    f.estado in ('concluida', 'falhou')
    or (f.estado = 'cancelada' and (f.worker_id is not null or f.ultimo_worker_id is not null or f.tentativas > 0))
  )
on conflict (entidade_tipo, entidade_id) where abertura do nothing;

-- ── 8 · CONFERÊNCIA: nenhum dia já reportado mudou de valor ─────────────────
-- A fórmula ANTIGA está escrita INLINE aqui (não por chamada de função), para
-- continuar valendo mesmo depois de §9 trocar as funções — e para que
-- re-aplicar esta migration continue conferindo contra a régua velha, não
-- contra ela mesma. Um único dia divergente ABORTA a migration.
do $$
declare
  v_divergentes integer;
  v_amostra     text;
  v_corrigidos  integer;
begin
  -- D48 (rodada 10, P2 do Codex): esta conferência só vale na ABERTURA INICIAL.
  -- Ela compara a fórmula ANTIGA com o livro, e depois da primeira correção os
  -- dois divergem POR CONSTRUÇÃO — é o ponto do livro-razão: corrigir um item
  -- de 120 para 3 mantém 120 no dia antigo e lança -117 hoje, enquanto a
  -- fórmula velha recalcula 3 no dia antigo. Sem esta guarda, re-aplicar esta
  -- migration ABORTA num banco que já processou correções, embora o arquivo se
  -- declare re-aplicável — e re-aplicar é exatamente o que se faz num deploy
  -- repetido.
  select count(*) into v_corrigidos
    from public.painel_caixa_lancamentos where not abertura;
  if v_corrigidos > 0 then
    raise notice '0019 §8: livro já em uso (% lançamentos além da abertura) — conferência da abertura pulada, como deve ser.', v_corrigidos;
    return;
  end if;
  with velha as (
    select s.conta,
           public.painel_sessao_dia_de_cobranca(
             s.sessao_id, coalesce(s.atualizado_em, s.criado_em, s.publicado_em)) as dia,
           sum(coalesce(s.custo_usd, 0)) as usd
      from public.painel_frentes_sessoes s
     where s.conta is not null
     group by 1, 2
    union all
    select f.conta,
           public.painel_dia_operador(f.concluido_em) as dia,
           sum(case when ses.custo_usd is null then f.custo_usd else 0 end) as usd
      from public.painel_fila_prompts f
      left join lateral (
        select s.custo_usd
        from public.painel_frentes_sessoes s
        where f.session_id is not null and s.sessao_id = f.session_id
        order by s.custo_usd desc nulls last
        limit 1
      ) ses on true
     where f.custo_usd is not null
       and f.concluido_em is not null
       and (
         f.estado in ('concluida', 'falhou')
         or (f.estado = 'cancelada' and (f.worker_id is not null or f.ultimo_worker_id is not null or f.tentativas > 0))
       )
     group by 1, 2
  ),
  antes as (
    select conta, dia, round(sum(usd), 4) as usd from velha group by 1, 2
  ),
  depois as (
    select conta, dia, round(sum(valor_usd), 4) as usd
      from public.painel_caixa_lancamentos group by 1, 2
  ),
  cotejo as (
    select coalesce(a.conta, d.conta) as conta,
           coalesce(a.dia, d.dia)     as dia,
           coalesce(a.usd, 0)         as antes,
           coalesce(d.usd, 0)         as depois
      from antes a full outer join depois d on a.conta = d.conta and a.dia = d.dia
  )
  select count(*),
         string_agg(format('%s %s: antes=%s depois=%s', conta, dia, antes, depois), ' | ')
    into v_divergentes, v_amostra
    from cotejo where antes <> depois;

  if v_divergentes > 0 then
    raise exception 'ABERTURA DO LIVRO-RAZÃO RECUSADA: % dia(s) mudariam de valor — %',
      v_divergentes, left(coalesce(v_amostra, ''), 900)
      using errcode = 'check_violation';
  end if;
end $$;

-- ── 9 · AS LEITURAS PASSAM A SER UMA SÓ (D41) ──────────────────────────────
-- `painel_consumo_por_conta_dia` era uma VIEW sobre `painel_frentes_sessoes`,
-- com o dia recalculado por `painel_sessao_dia_de_cobranca` a cada `select`.
-- Era ela o mecanismo do ALTO 1 e do ALTO 2. Agora ela é uma leitura do livro.
create or replace view public.painel_consumo_por_conta_dia as
select
  l.conta,
  l.dia,
  sum(l.valor_usd)                                    as custo_usd,
  count(distinct l.sessao_id) filter (where l.sessao_id is not null) as sessoes,
  count(distinct l.item_id)   filter (where l.item_id   is not null) as itens,
  count(*)                                            as lancamentos
from public.painel_caixa_lancamentos l
group by 1, 2;
comment on view public.painel_consumo_por_conta_dia is
  'D41 (rodada 9): o consumo por conta e dia SAI DO LIVRO-RAZÃO. Antes era uma expressão sobre painel_frentes_sessoes reavaliada a cada leitura — e por isso publicar uma sessão hoje reescrevia um dia encerrado ontem (ALTO 1) ou há cinco dias (ALTO 2). Mantém o fuso do operador (o dia foi carimbado por painel_dia_operador no lançamento) e o security_invoker=on.';

alter view public.painel_consumo_por_conta_dia set (security_invoker = on);
revoke select on public.painel_consumo_por_conta_dia from anon, authenticated;

create or replace function public.painel_fila_consumo_do_dia(p_conta text, p_dia date)
returns numeric
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  -- D41: UMA definição. Era `sessões do dia + contribuição dos itens do dia`,
  -- duas somas derivadas que discordavam de `painel_fila_historico_medido`
  -- (que só olhava as sessões). Agora as duas leem a mesma linha do livro.
  select public.painel_caixa_do_dia(p_conta, p_dia);
$$;
comment on function public.painel_fila_consumo_do_dia(text, date) is
  'D41 (rodada 9): gasto de um dia qualquer = soma dos lançamentos daquele dia (painel_caixa_do_dia). MÉDIO 3 da rodada 9: havia DUAS respostas para "quanto a conta gastou na terça?" — esta função somava sessões + itens, e painel_fila_historico_medido lia só as sessões, de modo que um dia de US$ 120 vindo de item não existia para a régua com que o operador escolhe o teto.';
revoke all on function public.painel_fila_consumo_do_dia(text, date) from public, anon, authenticated;

-- `painel_fila_itens_do_dia` deixa de recalcular a contribuição: ela LÊ o que
-- foi lançado. O `left join lateral` da dedup morreu com o modelo que o
-- exigia — a dedup agora é a identidade da entidade (D39).
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
    on  l.item_id = f.id
     or (l.item_id is null and l.sessao_id is not null and f.session_id = l.sessao_id)
  where l.conta = p_conta and l.dia = p_dia
  group by f.id;
$$;
comment on function public.painel_fila_itens_do_dia(text, date) is
  'D41 (rodada 9): os itens que MOVERAM DINHEIRO naquele dia, com a contribuição LIDA do livro-razão (pode ser negativa no dia de um estorno — é assim que uma correção aparece). Substitui a versão que recalculava a contribuição por `left join lateral`: a dedup deixou de ser uma comparação e virou a identidade da entidade (D39).';
revoke all on function public.painel_fila_itens_do_dia(text, date) from public, anon, authenticated;

-- D40 (ALTO 4): "medido até" é o instante do último LANÇAMENTO DE MEDIÇÃO. Uma
-- sessão que fechou sem ler o usage não deixa lançamento (valor zero é
-- não-lançamento) e portanto não tem como desarmar a trava. Antes, o filtro
-- era `custo_usd is not null` — e zero passava, contradizendo a própria 0018,
-- que declara "medido igual a ZERO é a sessão que fechou sem ler o usage".
create or replace function public.painel_fila_medido_ate(p_conta text)
returns timestamptz
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select max(l.medido_em)
  from public.painel_caixa_lancamentos l
  where l.conta = p_conta and l.medido_em is not null;
$$;
comment on function public.painel_fila_medido_ate(text) is
  'D40 (rodada 9, ALTO 4): o instante da última MEDIÇÃO lançada nesta conta. Zero não é medição — e agora isso é estrutural, não um filtro: valor zero não vira lançamento (check valor_usd <> 0), logo não tem medido_em para entrar no max. NULL significa uma coisa só: esta conta nunca teve medição lançada.';
revoke all on function public.painel_fila_medido_ate(text) from public, anon, authenticated;

-- ── 10 · fila_prompts_consumo_do_dia — MÉDIO 5: ninguém some do relatório ───
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
        'conta', c.conta,
        -- MÉDIO 5 (rodada 9): era `from public.painel_teto_diario t` — conta
        -- sem teto declarado SUMIA INTEIRA do relatório, com o gasto dela
        -- dentro. Medido: `gasto real=120 | linha desta conta=(SUMIU)`. Agora a
        -- lista é a UNIÃO (contas com teto ∪ contas com lançamento no dia) e a
        -- ausência de teto é DITA, nunca silenciada.
        'teto_usd', case when c.teto_usd is null then null else round(c.teto_usd, 2) end,
        'sem_teto_declarado', (c.teto_usd is null),
        'consumo_usd', round(public.painel_fila_consumo_do_dia(c.conta, v_dia), 2),
        'itens', (select count(*) from public.painel_fila_itens_do_dia(c.conta, v_dia) d),
        'itens_com_contribuicao',
          (select count(*) from public.painel_fila_itens_do_dia(c.conta, v_dia) d where d.contribuicao > 0)
      ) as linha
      from (
        select t.conta, t.teto_usd from public.painel_teto_diario t
        union
        select l.conta, (select t2.teto_usd from public.painel_teto_diario t2 where t2.conta = l.conta)
          from public.painel_caixa_lancamentos l where l.dia = v_dia
      ) c
    ) s;

  return jsonb_build_object('ok', true, 'dia', v_dia, 'contas', coalesce(v_linhas, '[]'::jsonb));
end;
$$;
comment on function public.fila_prompts_consumo_do_dia(text, date) is
  'D41 + MÉDIO 5 (rodada 9): o relatório lista as contas com teto UNIDAS às contas que tiveram lançamento no dia — conta sem teto não some mais do relatório levando o gasto junto; ela aparece com sem_teto_declarado=true. `itens` conta os itens que moveram dinheiro no dia; `itens_com_contribuicao`, os que moveram dinheiro PARA CIMA (num dia de estorno a contribuição é negativa, e a diferença entre os dois números é justamente isso).';
revoke all on function public.fila_prompts_consumo_do_dia(text, date) from public;
grant execute on function public.fila_prompts_consumo_do_dia(text, date) to anon, authenticated;

-- ── 11 · o gatilho das sessões — a medição entra no livro ao ser publicada ──
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

  -- D39: a entidade é a SESSÃO. Se um item já lançou por ela, este lançamento
  -- encontra a MESMA entidade — e a conta dele, que é a do primeiro
  -- lançamento. É aqui que o ALTO 3 morre: publicar a sessão sob outra conta
  -- não move dinheiro de conta nenhuma, porque a conta não é reconsultada.
  if v_item is not null then
    perform public.painel_caixa_lancar_item(
      v_item, new.custo_usd, 'medido',
      coalesce(new.atualizado_em, new.criado_em, new.publicado_em, now()),
      'medição publicada pela sessão vinculada a um item da fila');
  else
    perform public.painel_caixa_lancar(
      'sessao', new.sessao_id, new.conta,
      new.custo_usd, 'medido',
      null, new.sessao_id,
      coalesce(new.atualizado_em, new.criado_em, new.publicado_em, now()),
      'medição publicada pela sessão');
  end if;

  return null;
end;
$$;
comment on function public.painel_frentes_sessoes_lancar() is
  'D37/D39 (rodada 9): toda publicação de custo de sessão entra no livro-razão NO INSTANTE em que acontece, sob a entidade canônica `sessao:<id>` e na conta do primeiro lançamento dela. Uma republicação com valor diferente gera estorno + lançamento novo, datados de hoje — o dia antigo não se mexe.';

drop trigger if exists painel_frentes_sessoes_lancar_caixa on public.painel_frentes_sessoes;
create trigger painel_frentes_sessoes_lancar_caixa
  after insert or update of custo_usd, conta, atualizado_em on public.painel_frentes_sessoes
  for each row execute function public.painel_frentes_sessoes_lancar();

-- ── 12 · fila_prompts_fechar_interno — o fechamento LANÇA (D37/D38) ─────────
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

    -- D38: a estimativa lançada no dia da morte é ESTORNADA HOJE e o número
    -- real é lançado HOJE. Ontem continua valendo o que foi relatado.
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

-- ── 13 · fila_prompts_cancelar — o lançamento da casa entra no livro ────────
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
  end if;

  return jsonb_build_object(
    'ok', true,
    'motivo_codigo', v_codigo,
    'tentativas', v_row.tentativas,
    'custo_lancado_usd', round(v_lancado, 2),
    'caixa', v_caixa
  );
end;
$$;
comment on function public.fila_prompts_cancelar(text, uuid) is
  'D12 (rodada 4) + D37 (rodada 9): cancelar item que JÁ RODOU lança o custo ESTIMADO no livro-razão, no dia de hoje, com origem `estimativa` (é a casa que lança — e por isso o operador pode corrigir). Item que nunca foi pego não lança nada.';
revoke all on function public.fila_prompts_cancelar(text, uuid) from public;
grant execute on function public.fila_prompts_cancelar(text, uuid) to anon, authenticated;

-- ── 14 · fila_prompts_ajustar_custo — a correção do operador MOVE o dia ─────
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
  'D20/D26 + MÉDIO 4 (rodada 9): a correção do operador GRAVA NO LIVRO (estorno + lançamento novo) e o consumo do dia muda junto — antes ela era no-op sempre que havia sessão vinculada: a RPC devolvia ok=true, a tela ficava verde e o número que governa o teto não se mexia. A trava continua olhando `custo_origem`, e o dia continua sendo o de `concluido_em`.';
revoke all on function public.fila_prompts_ajustar_custo(text, uuid, numeric, text) from public;
grant execute on function public.fila_prompts_ajustar_custo(text, uuid, numeric, text) to anon, authenticated;

-- ── 15 · D42 · o CHOOSER, função pura — espelho provável de escolherConta ───
-- MÉDIO 1 (rodada 9): `fila_prompts_enfileirar` se autodeclarava "ESPELHO
-- DECLARADO de escolherConta" e divergia em DOIS pontos medidos pelo crítico:
--   (a) não filtrava `exigir_medicao_recente` — o `<select name="conta">` manda
--       "" no modo automático, então quem decide é o SQL, e ele escolhia uma
--       conta cujo pull recusa 100% dos disparos;
--   (b) o TS descartava o item por `max(tetos)` enquanto o trigger comparava
--       com o teto da conta ESCOLHIDA (BAIXO 4) — só não divergia porque os
--       três tetos são iguais.
-- A regra sai do laço e vira ESTA função pura. Ela recebe os números e devolve
-- a escolha; `fila_prompts_enfileirar` só junta os números. O bloco T42 roda
-- uma tabela de casos por aqui e `tests/unit/prompts-paridade-chooser.test.ts`
-- roda o TS sobre O MESMO literal, lido do disco.
create or replace function public.painel_fila_escolher_conta(
  p_consumos jsonb, p_estimado numeric
)
returns jsonb
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_limite_defasagem constant numeric := 12;  -- espelho de LIMITE_DEFASAGEM_HORAS
  rec               jsonb;
  v_conta           text;
  v_teto            numeric;
  v_espaco          numeric;
  v_headroom        numeric;
  v_defasagem       numeric;
  v_exige           boolean;
  v_recusaria       boolean;
  v_cabe_no_teto    boolean;
  v_maior_teto      numeric := null;
  v_autorizadas     integer := 0;
  v_candidatas      integer := 0;
  v_melhor          text := null;
  v_melhor_espaco   numeric := null;
  v_melhor_headroom numeric := null;
  v_empatados       integer := 0;
  v_todas_recusadas boolean := false;
  v_fase            integer;
begin
  if p_consumos is null or jsonb_typeof(p_consumos) <> 'array' or jsonb_array_length(p_consumos) = 0 then
    return jsonb_build_object(
      'conta', null, 'cabe_hoje', false, 'espaco_livre_usd', 0, 'headroom_usd', 0,
      'todas_recusadas', false, 'empatados', 0, 'nunca_cabe', false, 'maior_teto_usd', null);
  end if;

  for rec in select * from jsonb_array_elements(p_consumos) loop
    v_teto := (rec->>'teto_usd')::numeric;
    if v_maior_teto is null or v_teto > v_maior_teto then v_maior_teto := v_teto; end if;
    -- BAIXO 4: conta cujo TETO não comporta o item não é candidata — é
    -- exatamente o que o trigger de admissão recusa, item a item.
    if v_teto >= p_estimado then
      v_candidatas := v_candidatas + 1;
      v_exige := coalesce((rec->>'exige_medicao_recente')::boolean, false);
      v_defasagem := nullif(rec->>'defasagem_horas', '')::numeric;
      if v_exige and (v_defasagem is null or v_defasagem > v_limite_defasagem) then
        null;  -- o banco recusaria esta conta agora (D36)
      else
        v_autorizadas := v_autorizadas + 1;
      end if;
    end if;
  end loop;

  if v_candidatas = 0 then
    return jsonb_build_object(
      'conta', null, 'cabe_hoje', false, 'espaco_livre_usd', 0, 'headroom_usd', 0,
      'todas_recusadas', false, 'empatados', 0, 'nunca_cabe', true,
      'maior_teto_usd', round(v_maior_teto, 2));
  end if;

  v_todas_recusadas := (v_autorizadas = 0);
  -- Fase 1: só as autorizadas. Se nenhuma o for, a disputa volta a ser entre
  -- todas as candidatas (o item entra na fila e roda quando a medição voltar),
  -- exatamente como `escolherConta` faz.
  v_fase := case when v_todas_recusadas then 2 else 1 end;

  for rec in select * from jsonb_array_elements(p_consumos) loop
    v_conta := rec->>'conta';
    v_teto := (rec->>'teto_usd')::numeric;
    if v_teto < p_estimado then continue; end if;
    v_exige := coalesce((rec->>'exige_medicao_recente')::boolean, false);
    v_defasagem := nullif(rec->>'defasagem_horas', '')::numeric;
    v_recusaria := v_exige and (v_defasagem is null or v_defasagem > v_limite_defasagem);
    if v_fase = 1 and v_recusaria then continue; end if;

    v_headroom := v_teto
                - coalesce((rec->>'medido_usd')::numeric, 0)
                - coalesce((rec->>'em_execucao_usd')::numeric, 0);
    v_espaco := v_headroom - coalesce((rec->>'na_fila_usd')::numeric, 0);

    -- `>` estrito: o empate cai sempre no primeiro da ordem recebida, que é a
    -- ordem de `CONTAS` no TS. A ordem é do CHAMADOR, não desta função.
    if v_melhor is null or v_espaco > v_melhor_espaco then
      v_melhor := v_conta;
      v_melhor_espaco := v_espaco;
      v_melhor_headroom := v_headroom;
      v_empatados := 1;
    elsif v_espaco = v_melhor_espaco then
      v_empatados := v_empatados + 1;
    end if;
  end loop;

  v_cabe_no_teto := (not v_todas_recusadas) and p_estimado <= v_melhor_espaco;

  return jsonb_build_object(
    'conta', v_melhor,
    'cabe_hoje', v_cabe_no_teto,
    'espaco_livre_usd', round(v_melhor_espaco, 2),
    'headroom_usd', round(v_melhor_headroom, 2),
    'todas_recusadas', v_todas_recusadas,
    'empatados', v_empatados,
    'nunca_cabe', false,
    'maior_teto_usd', round(v_maior_teto, 2));
end;
$$;
comment on function public.painel_fila_escolher_conta(jsonb, numeric) is
  'D42 (rodada 9, MÉDIO 1): a regra de roteamento como FUNÇÃO PURA — espelho de escolherConta (src/core/prompts/roteador.ts), provado caso a caso pelo bloco T42 do teste SQL e por tests/unit/prompts-paridade-chooser.test.ts, que lê o MESMO literal de casos. Inclui as duas divergências que o crítico mediu: a recusa por medição velha (exigir_medicao_recente) e o descarte de conta cujo teto não comporta o item.';
revoke all on function public.painel_fila_escolher_conta(jsonb, numeric) from public, anon, authenticated;

-- ── 16 · fila_prompts_enfileirar — junta os números e chama o chooser ───────
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
     and v_conta not in ('lucasscudeler@gmail.com','lsgpandora@gmail.com','almapetra.ltda@gmail.com')
  then
    raise exception 'conta precisa ser uma das 3 contas da casa.' using errcode = 'check_violation';
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
  v_cabe_hoje := case
    when nullif(p_payload->>'conta','') is null then (v_escolha->>'cabe_hoje')::boolean
    else v_estimado <= v_espaco
  end;

  select count(*)::int into v_itens_frente
    from public.painel_fila_prompts f
    where f.conta = v_conta and f.estado = 'na_fila';

  v_codigo := case
    when nullif(p_payload->>'conta','') is null then
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
    'itens_na_frente', v_itens_frente,
    'todas_recusadas', coalesce((v_escolha->>'todas_recusadas')::boolean, false)
  );
end;
$$;
comment on function public.fila_prompts_enfileirar(text, jsonb) is
  'D14/D29 + D42 (rodada 9): a escolha de conta saiu do laço e virou painel_fila_escolher_conta(jsonb, numeric) — a MESMA regra de escolherConta no TS, incluindo a recusa por medição velha (que este laço ignorava enquanto o roteador do app filtrava) e o descarte de conta cujo teto não comporta o item. Nenhuma frase: quem escreve em português é o TS.';
revoke all on function public.fila_prompts_enfileirar(text, jsonb) from public;
grant execute on function public.fila_prompts_enfileirar(text, jsonb) to anon, authenticated;

-- ── 17 · fila_prompts_pegar_interno — o item que MORRE lança no livro ───────
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
    v_medido   := public.painel_fila_consumo_hoje(p_conta);
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
           custo_usd = least(f.custo_estimado_usd, 500),
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
  if v_mortos > 0 then
    for v_morto in
      select f.id, f.conta, f.session_id, f.custo_usd
        from public.painel_fila_prompts f
       where f.id = any (v_mortos_ids)
    loop
      perform public.painel_caixa_lancar_item(
        v_morto.id, v_morto.custo_usd, 'estimativa', null,
        'estimativa da casa: item morreu sem fechar');
    end loop;
  end if;

  v_medido       := public.painel_fila_consumo_hoje(p_conta);
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

-- ── 18 · a parcela ESTIMADA também sai do livro (D41) ──────────────────────
-- Ela lia `painel_fila_itens_do_dia(...) where e_estimativa` — uma derivação a
-- mais sobre a mesma pergunta. No livro a resposta é direta: quanto do dia
-- entrou com origem `estimativa` (a casa lançou, ninguém mediu).
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
    and l.origem = 'estimativa';
$$;
comment on function public.painel_fila_estimativa_usd(text) is
  'D20 (rodada 4) + D41 (rodada 9): quanto do consumo de HOJE entrou como ESTIMATIVA da casa, lido do livro-razão (origem = estimativa). Quando o número real chega, o estorno correspondente entra no dia da correção e esta parcela cai sozinha.';
revoke all on function public.painel_fila_estimativa_usd(text) from public, anon, authenticated;

create or replace function public.painel_fila_estimativa_itens(p_conta text)
returns integer
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select count(distinct coalesce(l.item_id::text, l.entidade_id))::int
  from public.painel_caixa_lancamentos l
  where l.conta = p_conta
    and l.dia = public.painel_dia_operador()
    and l.origem = 'estimativa';
$$;
comment on function public.painel_fila_estimativa_itens(text) is
  'D20 (rodada 4) + D41 (rodada 9): quantas entidades formam a parcela estimada de hoje — o "N" de "US$ X do consumo são estimativa de N itens que morreram sem fechar".';
revoke all on function public.painel_fila_estimativa_itens(text) from public, anon, authenticated;

-- `fila_prompts_listar` e `painel_fila_consumo_hoje` continuam com o corpo da
-- 0018/0015: as duas já delegam para `painel_fila_consumo_do_dia` e para
-- `painel_fila_medido_ate`, que agora leem o livro-razão. Nada a re-declarar.

-- ── 19 · fila_prompts_extrato_do_dia — o livro é LEGÍVEL pelo operador ──────
create or replace function public.fila_prompts_extrato_do_dia(
  p_secret text, p_conta text, p_dia date default null
)
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
      'fila_prompts_extrato_do_dia: segredo não configurado — inserir a chave load_secret em private.lifeboard_config (ver DEPLOY.md)'
      using errcode = 'config_file_error';
  end if;
  if p_secret is null or p_secret <> v_expected then
    raise exception 'fila_prompts_extrato_do_dia: acesso negado' using errcode = 'insufficient_privilege';
  end if;

  v_dia := coalesce(p_dia, public.painel_dia_operador());

  select jsonb_agg(jsonb_build_object(
      'id', l.id, 'valorUsd', round(l.valor_usd, 2), 'origem', l.origem,
      'entidade', l.entidade_tipo || ':' || l.entidade_id,
      'itemId', l.item_id, 'sessaoId', l.sessao_id,
      'estornaId', l.estorna_id, 'nota', l.nota, 'criadoEm', l.criado_em
    ) order by l.criado_em, l.id)
    into v_linhas
    from public.painel_caixa_lancamentos l
   where l.conta = p_conta and l.dia = v_dia;

  return jsonb_build_object(
    'ok', true, 'conta', p_conta, 'dia', v_dia,
    'total_usd', round(public.painel_caixa_do_dia(p_conta, v_dia), 2),
    'lancamentos', coalesce(v_linhas, '[]'::jsonb));
end;
$$;
comment on function public.fila_prompts_extrato_do_dia(text, text, date) is
  'D37 (rodada 9): o extrato de um dia, lançamento a lançamento, com a origem e o estorno de cada um. Um número de caixa que ninguém consegue abrir é um número em que ninguém pode confiar — e era exatamente por não haver extrato que os quatro ALTO da rodada 8 passaram despercebidos entre rodadas.';
revoke all on function public.fila_prompts_extrato_do_dia(text, text, date) from public;
grant execute on function public.fila_prompts_extrato_do_dia(text, text, date) to anon, authenticated;
