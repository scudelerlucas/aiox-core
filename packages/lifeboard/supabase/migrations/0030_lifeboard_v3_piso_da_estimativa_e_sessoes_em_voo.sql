-- ════════════════════════════════════════════════════════════════════════════
-- 0030 · LIFEBOARD v3 · O PISO DA ESTIMATIVA e o TETO DE SESSÕES EM VOO
-- ════════════════════════════════════════════════════════════════════════════
--
-- Rodada 15. UM achado, CRÍTICO, do coordenador, sobre a árvore já corrigida da
-- rodada 14 e SEM derrubar nenhuma das três paredes que ela levantou.
--
-- ── O ACHADO ────────────────────────────────────────────────────────────────
-- As três paredes da 0029 (`painel_custo_estimado.usd > 0`,
-- `painel_fila_prompts.custo_estimado_usd > 0`, `and v_headroom > 0`) fecharam
-- o NÚMERO que o crítico da rodada 14 usou — zero — e deixaram a CLASSE
-- aberta. Medido pelo coordenador, com um `update` de UMA linha que as três
-- paredes novas aceitam de bom grado:
--
--     update public.painel_custo_estimado set usd = 0.0001 where complexidade = 'baixa';
--
--     a parede aceitou a estimativa de 0.0001
--       dia medido..........: 499      teto: 500
--       DESPACHADOS.........: 40       em voo: 40
--       RESERVA total.......: 0.0040
--       headroom anunciado..: 1.00
--
-- Quarenta sessões de Claude em voo na mesma conta, com US$ 1,00 de espaço no
-- dia. Ele parou em 40 porque foi quantos itens enfileirou: a US$ 0,0001 por
-- item, UM DÓLAR de espaço admite DEZ MIL sessões simultâneas. É o dano do
-- CRÍTICO 5 inteiro, de volta, por um caminho que nenhuma das paredes novas
-- vê — porque todas as três perguntam "é diferente de zero?", e a propriedade
-- que o dinheiro precisa é "é grande o bastante para reservar algo".
--
-- É a QUINTA forma recorrente desta base: **a parede confere o caso, não a
-- classe.** A guarda foi escrita contra o valor exato que a sabotagem usou
-- (zero, 500, 5000, `type="number"`), e um vizinho do mesmo tipo passa.
--
-- ── AS DUAS PROPRIEDADES, QUE SÃO DIFERENTES ───────────────────────────────
-- O achado tem duas metades, e elas não se substituem:
--
--   1. O DANO é de CONTAGEM, não de soma. O que fere a casa não é a reserva
--      somar pouco; é QUANTAS sessões caras rodam ao mesmo tempo na mesma
--      conta. Uma sessão real da casa custa da ordem de US$ 200 (medido em
--      12/09/2026: US$ 2.513,29 em 12 sessões) e o teto é US$ 500 por conta —
--      duas sessões medianas já comem o dia inteiro. Quarenta em voo não é um
--      erro de arredondamento; é o teto não existir.
--   2. A MENTIRA é do PAINEL. `headroom = teto − medido − reserva` estava
--      aritmeticamente correto e factualmente falso: anunciava US$ 1,00 de
--      espaço com 40 sessões gastando dinheiro naquele instante. O painel
--      nunca deve anunciar espaço livre sem dizer quantas sessões estão em voo
--      e qual é o limite.
--
-- ── AS PAREDES QUE ENTRAM (quatro, e nenhuma sozinha basta) ────────────────
--   · §2 PISO DE VALOR na tabela de estimativas
--     (`painel_custo_estimado.usd >= painel_custo_minimo_por_item()`) — fecha
--     a classe: nenhuma estimativa vale menos que 1% do teto do dia;
--   · §3 PISO DE VALOR na coluna do ITEM
--     (`painel_fila_prompts.custo_estimado_usd >= …`) — a parede de baixo,
--     para que um `update` direto não refaça o buraco por baixo da tabela;
--   · §6 TETO DE SESSÕES EM VOO por conta, no pull — fecha o DANO
--     independentemente do valor da estimativa, que é a única parede que o
--     dinheiro realmente pede;
--   · §7 o pull passa a DIZER quantas sessões estão em voo e qual é o limite —
--     fecha a mentira do painel.
--
-- E as guardas de circunvenção, que reprovam quando o número é CONTORNADO e
-- não quando ele muda:
--   · §4 gatilho em `painel_teto_diario`: subir o teto sem subir o piso é
--       recusado, em português, na hora da escrita — era o jeito mais barato
--       de desfazer o piso sem tocar no piso;
--   · §5 a migration ABORTA se o piso ficou decorativo diante dos tetos já
--       declarados, ou se o teto de sessões em voo ficou decorativo diante do
--       piso (K itens no piso têm de caber no teto — se não couberem, a parede
--       de valor morde primeiro e a de contagem é enfeite).
--
-- Re-aplicável: tudo é `create or replace` / `drop … if exists` / `alter …`.
-- Aditiva: 0027, 0028 e 0029 não são reescritas.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1 · OS TRÊS NÚMEROS, cada um numa fonte só, com o porquê escrito ───────
--
-- (1a) A RAZÃO. É o único número da derivação do piso, e ele responde a
-- pergunta que o achado obriga a fazer: "quantos itens simultâneos o teto de
-- UM DIA pode admitir só pelo VALOR?". A cem, a reserva por item já deixou de
-- ser freio — ninguém supervisiona cem sessões de Claude, e o painel anuncia
-- espaço que não existe. Não é o limite de concorrência (esse é 1c): é o ponto
-- em que a parede de VALOR para de ser aritmética e passa a ser enfeite.
create or replace function public.painel_fila_itens_simultaneos_maximos_por_valor()
returns integer
language sql
immutable
set search_path = public, pg_temp
as $$
  select 100;
$$;
comment on function public.painel_fila_itens_simultaneos_maximos_por_valor() is
  'CRÍTICO (rodada 15): o único número da derivação do piso — quantos itens simultâneos o teto de um dia pode admitir SÓ PELO VALOR antes de a reserva por item deixar de ser freio. Cem. Não é o limite de concorrência (painel_fila_maximo_em_voo_por_conta): é o ponto em que a parede de valor vira enfeite. O piso (painel_custo_minimo_por_item) é teto/este número, e §5 desta migration aborta a migration se os dois deixarem de casar.';
revoke all on function public.painel_fila_itens_simultaneos_maximos_por_valor() from public, anon, authenticated;

-- (1b) O PISO DE VALOR por item — irmã de `painel_custo_maximo_por_item()`.
-- US$ 5,00 = 500 / 100: um por cento do teto que o próprio esquema declara
-- como default de `painel_teto_diario.teto_usd` (0027 §4). Abaixo de 1%, a
-- reserva de um item é aritmeticamente indistinguível de reserva NENHUMA — foi
-- o que o coordenador mediu com 0,0001 (reserva de US$ 0,0040 para 40 sessões
-- em voo).
--
-- O QUE ESTE NÚMERO NÃO É: não é "o mínimo que uma sessão da Anthropic pode
-- custar" (uma chamada de Haiku custa centavos). É o piso abaixo do qual o
-- FREIO DE VALOR deixa de frear. Um item mais barato que isso não é recusado
-- por ser barato: ele é recusado por não caber no mecanismo que protege o
-- teto, e o que a casa faz com tarefa assim é agrupá-la, não despachá-la uma a
-- uma contra um freio que não a sente.
--
-- E ele NÃO recusa nada que a casa declara hoje: a complexidade mais barata do
-- painel é `baixa` = US$ 5,00 — o piso EXATO. Ninguém perde um dia de tarefas
-- baratas; o que se perde é a possibilidade de COMPRAR CONCORRÊNCIA baixando a
-- estimativa.
--
-- `immutable` de propósito, como `painel_custo_maximo_por_item()`: é o que
-- permite usá-la em CHECK constraint (§§2-3), e o banco passa a recusar
-- `drop function` enquanto as constraints dependerem dela.
create or replace function public.painel_custo_minimo_por_item()
returns numeric
language sql
immutable
set search_path = public, pg_temp
as $$
  select 5::numeric;
$$;
comment on function public.painel_custo_minimo_por_item() is
  'CRÍTICO (rodada 15): PISO de valor por item (US$ 5,00) — irmã de painel_custo_maximo_por_item(). É 1% do teto que o esquema declara como default de painel_teto_diario.teto_usd (500 ÷ painel_fila_itens_simultaneos_maximos_por_valor()). Abaixo de 1% a reserva de um item é indistinguível de reserva nenhuma: medido pelo coordenador, estimativa de US$ 0,0001 despachou 40 sessões em voo com US$ 1,00 de espaço no dia e reserva total de US$ 0,0040 — e US$ 1 admitiria dez mil. Não é o custo mínimo de uma chamada de LLM; é o piso abaixo do qual o freio de valor não frea. Igual à complexidade mais barata do painel (baixa = 5), então nada que a casa declara hoje é recusado.';
revoke all on function public.painel_custo_minimo_por_item() from public, anon, authenticated;

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

-- ── 2 · PRIMEIRA PAREDE · o piso na tabela de estimativas ──────────────────
-- A migration ABORTA se o banco já tiver estimativa abaixo do piso: ajustar o
-- número em silêncio esconderia exatamente o estado que este achado descreve.
-- Mesma régua da 0029 §3 — o que muda é a pergunta, que deixa de ser "é zero?"
-- e passa a ser "é grande o bastante para reservar algo?".
do $$
declare v_ruins text;
begin
  select string_agg(complexidade || '=' || usd::text, ', ')
    into v_ruins from public.painel_custo_estimado
   where usd < public.painel_custo_minimo_por_item();
  if v_ruins is not null then
    raise exception
      '0030 §2: painel_custo_estimado tem estimativa abaixo do piso de US$ % (%) — estimativa abaixo do piso desliga o teto da conta por CONTAGEM: a US$ 0,0001 por item, US$ 1,00 de espaço admite dez mil sessões simultâneas (medido: 40 em voo, reserva total de US$ 0,0040). Corrija o valor para o custo real da complexidade antes de aplicar esta migration.',
      public.painel_custo_minimo_por_item(), v_ruins using errcode = 'check_violation';
  end if;
end $$;

alter table public.painel_custo_estimado drop constraint if exists painel_custo_estimado_usd_check;
alter table public.painel_custo_estimado add constraint painel_custo_estimado_usd_check
  check (usd >= public.painel_custo_minimo_por_item());
comment on column public.painel_custo_estimado.usd is
  'CRÍTICO (rodada 15): pelo menos painel_custo_minimo_por_item() (US$ 5,00 = 1% do teto). Era `>= 0` na 0009 e `> 0` na 0029 — e `> 0` fecha o NÚMERO zero deixando a CLASSE aberta: com 0,0001 o coordenador despachou 40 sessões em voo contra US$ 1,00 de espaço, reserva total de US$ 0,0040, e US$ 1,00 admitiria dez mil. A pergunta da parede deixou de ser "é diferente de zero?" e passou a ser "é grande o bastante para reservar algo?".';

-- ── 3 · SEGUNDA PAREDE · o piso na coluna do ITEM ──────────────────────────
do $$
declare v_quantos int;
begin
  select count(*) into v_quantos from public.painel_fila_prompts
   where custo_estimado_usd < public.painel_custo_minimo_por_item();
  if v_quantos > 0 then
    raise exception
      '0030 §3: % item(ns) da fila com custo_estimado_usd abaixo do piso de US$ % — item abaixo do piso reserva quase nada e o teto da conta deixa de limitar quantas sessões rodam juntas. Recalcule a estimativa (o gatilho a deriva de painel_custo_estimado) antes de aplicar esta migration.',
      v_quantos, public.painel_custo_minimo_por_item() using errcode = 'check_violation';
  end if;
end $$;

alter table public.painel_fila_prompts drop constraint if exists painel_fila_prompts_custo_estimado_check;
alter table public.painel_fila_prompts add constraint painel_fila_prompts_custo_estimado_check
  check (custo_estimado_usd >= public.painel_custo_minimo_por_item());
comment on column public.painel_fila_prompts.custo_estimado_usd is
  'CRÍTICO (rodada 15): pelo menos painel_custo_minimo_por_item(). Calculado SEMPRE pelo gatilho a partir da complexidade (painel_custo_estimado) — esta check é a parede de baixo, para que um `update` direto na coluna não refaça o buraco por baixo da tabela de estimativas. A reserva de teto (painel_fila_reservado) soma esta coluna: estimativa de centavo = despacho que quase não consome headroom, e foi assim que 40 sessões couberam em US$ 1,00.';

-- ── 4 · GUARDA DE CIRCUNVENÇÃO · subir o teto sem subir o piso é recusado ──
-- Esta é a guarda que importa, porque o caminho mais barato para desfazer o
-- piso não é mexer no piso: é subir o TETO e deixar o piso onde está. Com o
-- piso em 1% do teto, dobrar o teto divide o piso pela metade em termos
-- relativos — e a mesma conta volta a admitir o dobro de sessões simultâneas
-- só pelo valor. A recusa chega no momento da escrita, em português, e nomeia
-- o conserto.
--
-- Ela NUNCA baixa teto nenhum e não recusa BAIXAR o teto: recusa só subir além
-- do que o piso sustenta. Subir o teto de verdade continua sendo uma decisão
-- do operador — ela passa a exigir que o piso suba no MESMO ato, numa
-- migration, que é onde o "porquê" fica escrito.
create or replace function public.painel_teto_diario_piso_sustenta()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_piso   numeric := public.painel_custo_minimo_por_item();
  v_razao  integer := public.painel_fila_itens_simultaneos_maximos_por_valor();
  v_limite numeric := v_piso * v_razao;
begin
  if new.teto_usd is not null and new.teto_usd > v_limite then
    raise exception
      'painel_teto_diario: um teto de US$ % exige piso de estimativa de pelo menos US$ % (hoje o piso é US$ %, e ele vale 1/% do teto). Com este teto e este piso, a conta admitiria % itens simultâneos só pelo valor — o freio de valor deixaria de frear. Suba painel_custo_minimo_por_item() na MESMA migration que sobe o teto.',
      round(new.teto_usd, 2), round(new.teto_usd / v_razao, 4), round(v_piso, 2), v_razao,
      floor(new.teto_usd / v_piso)
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
comment on function public.painel_teto_diario_piso_sustenta() is
  'CRÍTICO (rodada 15): a guarda de CIRCUNVENÇÃO do piso. O caminho mais barato para desfazer painel_custo_minimo_por_item() não é mexer nele — é subir o teto e deixá-lo onde está, porque o piso vale 1/painel_fila_itens_simultaneos_maximos_por_valor() do teto. Ela recusa SUBIR o teto além do que o piso sustenta, nunca baixa teto nenhum, e nomeia o conserto (subir o piso na mesma migration).';
revoke all on function public.painel_teto_diario_piso_sustenta() from public, anon, authenticated;

drop trigger if exists painel_teto_diario_piso_sustenta on public.painel_teto_diario;
create trigger painel_teto_diario_piso_sustenta
  before insert or update of teto_usd on public.painel_teto_diario
  for each row execute function public.painel_teto_diario_piso_sustenta();

-- ── 5 · GUARDA DE CIRCUNVENÇÃO · nenhum dos dois números fica decorativo ───
-- Dois invariantes, medidos contra o que o BANCO declara, não contra números
-- copiados aqui:
--   (a) o piso sustenta todos os tetos já declarados — se um teto foi subido
--       antes desta migration existir, ela aborta em vez de aplicar um piso
--       que aquele teto já contorna;
--   (b) o teto de sessões em voo morde ANTES de a parede de valor ficar sem
--       sentido: K itens no PISO têm de caber no menor teto declarado. Se não
--       couberem, a parede de valor morde primeiro e a de contagem é enfeite.
do $$
declare
  v_piso    numeric := public.painel_custo_minimo_por_item();
  v_razao   integer := public.painel_fila_itens_simultaneos_maximos_por_valor();
  v_k       integer := public.painel_fila_maximo_em_voo_por_conta();
  v_maior   numeric;
  v_menor   numeric;
  v_fora    text;
begin
  select max(teto_usd), min(teto_usd) into v_maior, v_menor from public.painel_teto_diario;

  if v_piso <= 0 or v_razao < 1 or v_k < 1 then
    raise exception
      '0030 §5: piso=%, razão=% e teto de sessões em voo=% — nenhum dos três admite valor não-positivo: um piso de zero é a ausência de piso, e um limite de zero sessões em voo trava a fila inteira.',
      v_piso, v_razao, v_k using errcode = 'check_violation';
  end if;

  if v_maior is not null and v_maior > v_piso * v_razao then
    select string_agg(conta || '=' || teto_usd::text, ', ')
      into v_fora from public.painel_teto_diario where teto_usd > v_piso * v_razao;
    raise exception
      '0030 §5(a): o piso de US$ % não sustenta os tetos já declarados (%) — com eles a conta admitiria mais de % itens simultâneos só pelo valor. Suba painel_custo_minimo_por_item() para pelo menos US$ % NESTA migration; baixar o teto não é opção (decisão do operador de 14/09/2026).',
      -- `::text` cru, sem `round`: um piso de US$ 0,0001 aparecia como "US$ 0.00"
      -- na própria mensagem que o denuncia.
      v_piso::text, v_fora, v_razao, round(v_maior / v_razao, 4)
      using errcode = 'check_violation';
  end if;

  if v_menor is not null and v_k * v_piso > v_menor then
    raise exception
      '0030 §5(b): % sessões em voo no piso de US$ % somam US$ %, que não cabe no menor teto declarado (US$ %) — a parede de VALOR morderia primeiro e painel_fila_maximo_em_voo_por_conta() seria enfeite. Baixe o limite de sessões em voo ou reveja o piso.',
      v_k, v_piso::text, round(v_k * v_piso, 4), round(v_menor, 2)
      using errcode = 'check_violation';
  end if;

  raise notice '0030 §5: piso US$ % × razão % = teto máximo sustentado US$ % (maior teto declarado: %) · % sessões em voo no piso somam US$ % (menor teto declarado: %).',
    round(v_piso, 2), v_razao, round(v_piso * v_razao, 2), coalesce(round(v_maior, 2), 0),
    v_k, round(v_k * v_piso, 2), coalesce(round(v_menor, 2), 0);
end $$;

-- ── 6 · painel_fila_reservado — a janela passa a sair da fonte única ───────
-- Corpo da 0018 §13, com `interval '45 minutes'` trocado por
-- `public.painel_fila_janela_em_voo()`. Nenhum comportamento muda: a
-- re-declaração existe para que a janela tenha UM lugar, agora que ela ganhou
-- um segundo leitor (`painel_fila_em_voo`).
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
    and coalesce(f.heartbeat_em, f.pego_em) >= now() - public.painel_fila_janela_em_voo();
$$;
comment on function public.painel_fila_reservado(text) is
  'D3 (rodada 3) + BAIXO 6 (rodada 8) + fonte única da janela (rodada 15): soma do ESTIMADO do que está EM EXECUÇÃO agora (pega com heartbeat vivo, dentro de painel_fila_janela_em_voo). na_fila NÃO entra — reserva agregada de fila travava a própria fila. A janela saiu do literal `45 minutes` para a função, porque painel_fila_em_voo passou a ser o segundo leitor dela.';
revoke all on function public.painel_fila_reservado(text) from public, anon, authenticated;

-- ── 7 · A FRASE do pull ganha a oração das SESSÕES EM VOO ─────────────────
-- A mentira do painel era esta: `headroom = teto − medido − reserva` estava
-- aritmeticamente correto e factualmente falso — anunciava US$ 1,00 de espaço
-- com 40 sessões gastando dinheiro naquele instante. A partir daqui o número
-- de sessões em voo e o limite andam JUNTO do headroom, na frase e no JSON.
--
-- `drop function` explícito antes do `create`: acrescentar dois parâmetros COM
-- DEFAULT criaria uma SEGUNDA função de mesmo nome, e toda chamada que omite
-- os novos parâmetros (as seis da suíte, mais o pull) passaria a ser AMBÍGUA.
-- O texto é o da 0027 §9, verbatim, mais uma oração.
drop function if exists public.painel_fila_motivo_do_pull(
  integer, numeric, numeric, numeric, numeric, integer, integer, numeric,
  integer, integer, integer, numeric, integer, numeric, boolean);

create or replace function public.painel_fila_motivo_do_pull(
  p_mortos integer, p_mortos_usd numeric,
  p_custo_escolhido numeric, p_headroom numeric,
  p_menor_disponivel numeric, p_elegiveis integer,
  p_em_espera integer, p_menor_espera numeric, p_espera_min integer,
  p_devolvidos integer, p_travados integer,
  p_estimativa_usd numeric, p_estimativa_itens integer,
  p_defasagem_horas numeric default null,
  p_exigir_medicao boolean default false,
  p_em_voo integer default 0,
  p_limite_em_voo integer default null,
  p_abaixo_do_piso integer default 0
)
returns text
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v text[] := '{}'::text[];
  -- CRÍTICO (rodada 15): a conta está cheia de sessões, não sem dinheiro.
  v_no_limite boolean := p_limite_em_voo is not null and p_limite_em_voo > 0
                         and coalesce(p_em_voo, 0) >= p_limite_em_voo;
  v_piso numeric := public.painel_custo_minimo_por_item();
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
  if p_defasagem_horas is not null and p_defasagem_horas > 12 then
    v := v || format('atenção: o gasto medido desta conta é de %s h atrás',
      round(p_defasagem_horas)::integer);
  end if;

  -- CRÍTICO 1 (rodada 12): `p_mortos_usd` é o que o LIVRO aceitou.
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

  -- CRÍTICO (rodada 15): a oração das SESSÕES EM VOO. Vem antes da oração do
  -- item porque, quando ela aparece, ela é a RAZÃO de nada ter sido pego — e
  -- sem ela o pull dizia só "US$ X livres" sobre uma conta com N sessões
  -- gastando dinheiro naquele instante. Quando o limite não foi alcançado, a
  -- oração não existe (o default `p_limite_em_voo => null` mantém toda frase
  -- anterior a esta migration idêntica, letra por letra).
  if v_no_limite then
    if coalesce(p_em_voo, 0) = 1 then
      v := v || format('1 sessão desta conta está em voo (limite %s): não despacho outra até ela fechar',
        p_limite_em_voo);
    else
      v := v || format('%s sessões desta conta estão em voo (limite %s): não despacho outra até uma delas fechar',
        p_em_voo, p_limite_em_voo);
    end if;
  end if;

  -- CRÍTICO (rodada 15): O ITEM ABAIXO DO PISO TEM FRASE PRÓPRIA.
  -- Sem ela o pull dizia "nada cabe agora: o mais barato disponível custa
  -- US$ 0,01 e há US$ 500,00 livres" — autocontraditório, porque US$ 0,01 cabe
  -- em US$ 500,00. O não é do PISO, não do preço, e quem tem de ouvir isso é
  -- quem pode consertar: o operador que declarou a estimativa.
  if coalesce(p_abaixo_do_piso, 0) = 1 then
    v := v || format('1 item da fila está com estimativa abaixo do piso de %s e não entra em despacho: corrija a estimativa da complexidade dele',
      public.painel_usd_br(v_piso));
  elsif coalesce(p_abaixo_do_piso, 0) > 1 then
    v := v || format('%s itens da fila estão com estimativa abaixo do piso de %s e não entram em despacho: corrija a estimativa da complexidade deles',
      p_abaixo_do_piso, public.painel_usd_br(v_piso));
  end if;

  if p_custo_escolhido is not null then
    v := v || format('peguei o item mais antigo que cabe: %s de %s livres',
      public.painel_usd_br(p_custo_escolhido), public.painel_usd_br(p_headroom));
  elsif p_menor_disponivel is not null and coalesce(p_elegiveis, 0) = 0
        and not v_no_limite then
    -- CRÍTICO (rodada 15): `not v_no_limite`. Sem ele a frase saía
    -- autocontraditória — "nada cabe agora: o mais barato disponível custa
    -- US$ 5,00 e há US$ 480,00 livres" — porque com a conta no limite de
    -- sessões `p_elegiveis` é zero por CONTAGEM, não por preço. Quem explica
    -- o não é a oração das sessões em voo, logo acima.
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
    v := v || '1 item voltou para a fila e aguarda nova tentativa'::text;
  elsif p_devolvidos > 1 then
    v := v || format('%s itens voltaram para a fila e aguardam nova tentativa', p_devolvidos);
  end if;

  if p_travados = 1 then
    v := v || '1 item elegível está em uso por outra operação; tente no próximo disparo'::text;
  elsif p_travados > 1 then
    v := v || format('%s itens elegíveis estão em uso por outra operação; tente no próximo disparo', p_travados);
  end if;

  -- D20 + BAIXO 7 (rodada 7).
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
comment on function public.painel_fila_motivo_do_pull(integer, numeric, numeric, numeric, numeric, integer, integer, numeric, integer, integer, integer, numeric, integer, numeric, boolean, integer, integer, integer) is
  'D32b/D32c + CRÍTICO 1 (rodada 12) + CRÍTICO rodada 15: a frase do pull, função pura. Ganhou a oração das SESSÕES EM VOO, que fecha a mentira do painel — o headroom anunciava US$ 1,00 de espaço com 40 sessões gastando dinheiro naquele instante, e estava aritmeticamente correto. Com p_limite_em_voo => null (o default) toda frase anterior a esta migration sai idêntica, letra por letra.';
revoke all on function public.painel_fila_motivo_do_pull(integer, numeric, numeric, numeric, numeric, integer, integer, numeric, integer, integer, integer, numeric, integer, numeric, boolean, integer, integer, integer) from public, anon, authenticated;

-- ── 8 · fila_prompts_pegar_interno — TERCEIRA e QUARTA paredes ────────────
-- Texto da 0029 §6, com QUATRO pontos mudados e nada mais:
--   (i)   a janela de expiração sai de `painel_fila_janela_em_voo()`;
--   (ii)  a elegibilidade exige `custo_estimado_usd >= painel_custo_minimo_
--         por_item()` — a terceira parede do PISO, a que vale mesmo num banco
--         antigo ou com as checks derrubadas por `update` direto;
--   (iii) o TETO DE SESSÕES EM VOO: alcançado o limite, o pull não escolhe
--         NADA, custe o item o que custar e sobre o dia o espaço que sobrar.
--         É a única parede que fecha o dano independentemente do valor da
--         estimativa — e o dano deste achado é de contagem;
--   (iv)  o JSON e a frase passam a dizer `em_voo` e `limite_em_voo`.
-- Honestidade da frase: quando é o limite de sessões que barra, `v_travados`
-- NÃO é preenchido. Sem esse cuidado o pull diria "N itens elegíveis estão em
-- uso por outra operação" — que é falso: eles não estão travados por
-- transação nenhuma, a conta é que está cheia.
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
  -- CRÍTICO (rodada 15)
  v_piso            numeric := public.painel_custo_minimo_por_item();
  v_limite_em_voo   integer := public.painel_fila_maximo_em_voo_por_conta();
  v_em_voo          integer := 0;
  v_no_limite       boolean := false;
  v_abaixo_do_piso  integer := 0;
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
    v_em_voo   := public.painel_fila_em_voo(p_conta);
    return jsonb_build_object(
      'ok', true, 'item', null,
      'devolvidos', 0, 'mortos', 0, 'pulados', 0, 'travados', 0,
      'mortos_usd', 0,
      'em_espera', public.painel_fila_em_espera(p_conta),
      'headroom_usd', round(greatest(v_teto - v_medido - v_execucao, 0), 2),
      'em_voo', v_em_voo, 'limite_em_voo', v_limite_em_voo,
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
        p_defasagem_horas => v_defasagem, p_exigir_medicao => true,
        p_em_voo => v_em_voo, p_limite_em_voo => v_limite_em_voo)
    );
  end if;

  -- D2 + D19 + D26, inalterados (a janela agora sai da fonte única).
  with alvo as (
    select f.id, f.tentativas, f.max_tentativas
    from public.painel_fila_prompts f
    where f.conta = p_conta
      and f.estado = 'pega'
      and coalesce(f.heartbeat_em, f.pego_em) < now() - public.painel_fila_janela_em_voo()
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

  -- D37 (rodada 9) + CRÍTICO 1 (rodada 12): `v_mortos_usd` é o que o livro
  -- ACEITOU, não o que a casa tentou lançar.
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

  -- CRÍTICO 1 (rodada 13) · o número que DESPACHA nunca lê gasto negativo.
  v_medido       := greatest(public.painel_fila_consumo_hoje(p_conta), 0);
  v_execucao     := public.painel_fila_reservado(p_conta);
  v_headroom     := v_teto - v_medido - v_execucao;
  v_em_espera    := public.painel_fila_em_espera(p_conta);
  v_estimativa   := public.painel_fila_estimativa_usd(p_conta);
  v_estimativa_n := public.painel_fila_estimativa_itens(p_conta);

  -- CRÍTICO (rodada 15) · A QUARTA PAREDE: o TETO DE SESSÕES EM VOO.
  -- Contado DEPOIS do laço de devolução/morte, para que sessão expirada não
  -- ocupe vaga. Alcançado o limite, nada é escolhido — e esta é a única parede
  -- que fecha o dano sem depender de quanto a estimativa diz que o item custa.
  v_em_voo     := public.painel_fila_em_voo(p_conta);
  v_no_limite  := v_em_voo >= v_limite_em_voo;

  if not v_no_limite then
    select f.id into v_escolhido
      from public.painel_fila_prompts f
     where f.conta = p_conta
       and f.estado = 'na_fila'
       and f.id <> all (v_devolvidos_ids)
       and (f.disponivel_em is null or f.disponivel_em <= now())
       -- CRÍTICO 5 (rodada 14) · dia sem espaço não despacha nada.
       and v_headroom > 0
       and f.custo_estimado_usd <= v_headroom
       -- CRÍTICO (rodada 15) · A TERCEIRA PAREDE DO PISO. `> 0` fechava o
       -- número zero e deixava a classe aberta: com 0,0001 o coordenador
       -- despachou 40 itens contra US$ 1,00 de espaço, reserva de US$ 0,0040.
       -- Item que não reserva nada real não sai, mesmo que as duas checks de
       -- baixo tenham caído (banco antigo, `update` direto).
       and f.custo_estimado_usd >= v_piso
     order by f.criado_em, f.id
     limit 1
       for update skip locked;
  end if;

  -- Os contadores contam o MESMO mundo da condição acima: item abaixo do piso
  -- e conta no limite de sessões entram em `pulados`, nunca em `elegiveis` —
  -- senão o painel diz "há N elegíveis" sobre um pull que não despacha nenhum.
  -- `v_menor_agora` só olha item que PASSA DO PISO: é ele que a frase "nada
  -- cabe agora: o mais barato custa X" nomeia, e item abaixo do piso não é
  -- barato demais para o dia — é inválido para o mecanismo. Quem fala dele é a
  -- oração própria, contada em `v_abaixo_do_piso`.
  select
    count(*) filter (
      where v_no_limite
         or v_headroom <= 0
         or f.custo_estimado_usd > v_headroom
         or f.custo_estimado_usd < v_piso)::int,
    count(*) filter (
      where not v_no_limite
        and v_headroom > 0
        and f.custo_estimado_usd <= v_headroom
        and f.custo_estimado_usd >= v_piso)::int,
    min(f.custo_estimado_usd) filter (where f.custo_estimado_usd >= v_piso),
    count(*) filter (where f.custo_estimado_usd < v_piso)::int
    into v_pulados, v_elegiveis, v_menor_agora, v_abaixo_do_piso
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

  -- B5: "travado" é item elegível que OUTRA transação está segurando. Conta no
  -- limite de sessões não trava item nenhum — dizer que trava seria mentira.
  -- `not v_no_limite` aqui é CINTO E SUSPENSÓRIO, e eu medi que é: tirá-lo não
  -- muda nada hoje, porque o contador acima já zera `v_elegiveis` quando a
  -- conta está no limite. Fica porque as duas linhas podem divergir amanhã (a
  -- de cima é contagem para o painel, esta é honestidade da frase), e porque
  -- foi por uma frase mentirosa — "N itens elegíveis estão em uso por outra
  -- operação" sobre itens que ninguém segurava — que este ramo existe.
  if v_escolhido is null and v_elegiveis > 0 and not v_no_limite then
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
    p_exigir_medicao   => false,
    p_em_voo           => v_em_voo,
    p_limite_em_voo    => v_limite_em_voo,
    p_abaixo_do_piso   => v_abaixo_do_piso
  );

  if v_escolhido is null then
    return jsonb_build_object(
      'ok', true, 'item', null,
      'devolvidos', v_devolvidos, 'mortos', v_mortos, 'pulados', v_pulados,
      'travados', v_travados,
      'mortos_usd', round(v_mortos_usd, 2),
      'em_espera', v_em_espera,
      'headroom_usd', round(greatest(v_headroom, 0), 2),
      'em_voo', v_em_voo, 'limite_em_voo', v_limite_em_voo,
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
    -- `+ 1`: o item deste disparo acabou de entrar em voo. O painel nunca
    -- anuncia espaço livre sem dizer quantas sessões estão gastando agora.
    'em_voo', v_em_voo + 1, 'limite_em_voo', v_limite_em_voo,
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
  'CRÍTICO 5 + ALTO 6 (rodada 14) + CRÍTICO (rodada 15): mantém as três paredes da 0029 e ganha duas — a elegibilidade exige custo_estimado_usd >= painel_custo_minimo_por_item() (o `> 0` da 0029 fechava o número zero e deixava a classe aberta: com 0,0001 foram 40 itens despachados contra US$ 1,00 de espaço) e a conta não despacha além de painel_fila_maximo_em_voo_por_conta() sessões em voo, que é a parede que fecha o dano sem depender do valor da estimativa. O JSON e a frase passam a dizer em_voo e limite_em_voo: o headroom sozinho anunciava US$ 1,00 livres com 40 sessões gastando dinheiro. Mantém D32b/D32c, BAIXO 4/5, D37 e a trava de serialização por conta (T81).';
revoke all on function public.fila_prompts_pegar_interno(text, text) from public, anon, authenticated;

-- ── 9 · a porta de ADMISSÃO recusa em português, não por constraint crua ──
-- Texto da 0018 §14, verbatim, mais UMA recusa. Num banco em que a check da §2
-- caiu (ou que tem estimativa antiga abaixo do piso), o `insert` já morria —
-- mas morria com `painel_fila_prompts_custo_estimado_check`, que é grafia de
-- constraint na cara de quem chama. A regra da casa é erro em português no
-- campo; a constraint fica como parede de baixo, não como mensagem.
create or replace function public.painel_fila_prompts_checar_teto()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_teto     numeric;
  v_estimado numeric;
  v_rotulo   text;
  v_piso     numeric := public.painel_custo_minimo_por_item();
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

  -- D3: a recusa de admissão por CIMA — o item nunca caberia, em nenhum dia.
  if v_estimado > v_teto then
    raise exception
      'fila: uma tarefa % custa cerca de US$ % e o teto diário desta conta é US$ % — nunca vai caber.',
      v_rotulo, round(v_estimado, 2), round(v_teto, 2)
      using errcode = 'check_violation';
  end if;

  -- CRÍTICO (rodada 15): a recusa de admissão por BAIXO. Estimativa abaixo do
  -- piso não reserva nada real: a conta passaria a admitir sessões simultâneas
  -- sem limite de valor (medido: 40 em voo com US$ 1,00 de espaço no dia).
  if v_estimado < v_piso then
    raise exception
      'fila: a estimativa de uma tarefa % está em US$ %, abaixo do piso de US$ % — uma estimativa dessas quase não ocupa o teto do dia, e a conta passaria a aceitar sessões simultâneas sem freio de valor. Corrija painel_custo_estimado para o custo real desta complexidade.',
      v_rotulo, round(v_estimado, 4), round(v_piso, 2)
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;
comment on function public.painel_fila_prompts_checar_teto() is
  'D3 + BAIXO 6 (rodada 8) + CRÍTICO (rodada 15): deriva custo_estimado_usd da complexidade (nunca de fora) e recusa admissão nos DOIS extremos — acima do teto do dia (nunca caberia) e abaixo de painel_custo_minimo_por_item() (não reserva nada real). A recusa por baixo existe para que a mensagem seja português no campo: a check da coluna continua sendo a parede, não o texto.';

-- ── 10 · a ÚLTIMA cópia da janela de 45 min sai da fonte única ────────────
-- Varredura desta rodada: depois das §§1d/6/8, a janela de "em voo" ficou em
-- UM lugar para quem DECIDE (o pull, `painel_fila_reservado`,
-- `painel_fila_em_voo`) e continuava escrita à mão em quem AVISA:
-- `fila_prompts_heartbeat_interno` devolve `expira_em` para a Routine, e esse
-- número é o relógio que ela mostra ao operador. Copiada, ela silenciosamente
-- mente no dia em que a janela mudar — que é o modo de falha do ALTO 6 da
-- rodada 14, só que na direção do aviso em vez da decisão.
-- Texto da 0018 §?, verbatim, com UMA expressão trocada.
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
    'expira_em', v_row.heartbeat_em + public.painel_fila_janela_em_voo(),
    'sessionId', v_row.session_id,
    'tentativas', v_row.tentativas, 'maxTentativas', v_row.max_tentativas
  );
end;
$$;
comment on function public.fila_prompts_heartbeat_interno(uuid, text, text, text) is
  'D11/D7/D18/D34a + fonte única da janela (rodada 15): o `expira_em` que a Routine mostra sai de painel_fila_janela_em_voo(), não de um `interval ''45 minutes''` copiado — era a última cópia da janela depois que as três funções que DECIDEM passaram a ler a fonte única. Bloco T91 confere que o relógio anunciado é a janela de verdade.';
revoke all on function public.fila_prompts_heartbeat_interno(uuid, text, text, text) from public, anon, authenticated;

-- ── P2 do Codex (PR #42, 4ª rodada) · o histórico do card também tem piso ──
-- A D54 preserva, como dado legado, os dias FECHADOS que ficaram negativos
-- antes dela (crédito que anulava dinheiro de outro dia). Hoje já nunca é
-- mostrado negativo, mas o min/máx/mediana que o card imprime ao lado do teto
-- lia `painel_consumo_por_conta_dia` cru: um dia legado de −30 virava "gasto
-- mínimo −US$ 30" e puxava a mediana para baixo — a régua com que o operador
-- escolhe o teto. O piso vale no número de PRODUTO; `painel_caixa_do_dia` e a
-- própria visão continuam crus, para auditoria. Bloco que prova: T95.
create or replace function public.painel_fila_historico_medido(
  p_conta text, p_dias integer default 10
)
returns table (dias integer, min_usd numeric, max_usd numeric, mediana_usd numeric)
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  with ultimos as (
    select greatest(c.custo_usd, 0) as custo_usd
    from public.painel_consumo_por_conta_dia c
    where c.conta = p_conta
      and c.dia < public.painel_dia_operador()
    order by c.dia desc
    limit greatest(coalesce(p_dias, 10), 1)
  )
  select
    count(*)::integer,
    round(min(u.custo_usd), 2),
    round(max(u.custo_usd), 2),
    round((percentile_cont(0.5) within group (order by u.custo_usd))::numeric, 2)
  from ultimos u;
$$;
comment on function public.painel_fila_historico_medido(text, integer) is
  'D32d (rodada 7) + piso (PR #42): min, máx e mediana do gasto MEDIDO dos últimos N dias com dado (hoje fora, porque hoje é parcial), cada dia com piso zero — dia legado negativo (anterior à D54) conta como zero no número que o card imprime. A auditoria crua continua em painel_caixa_do_dia. Uma linha sempre; com dias = 0 os três números são NULL.';
revoke all on function public.painel_fila_historico_medido(text, integer) from public, anon, authenticated;

-- ── P2 do Codex (PR #42, 4ª rodada) · o ROTEAMENTO conhece o limite de voo ──
-- A quarta parede (o limite de sessões em voo por conta) só agia no PULL,
-- depois de a conta já ter sido escolhida. A escolha automática olhava só
-- dinheiro: a conta com quatro itens de US$ 5 em voo e o maior espaço livre
-- ganhava o item novo — que então ficava parado atrás do limite enquanto
-- outra conta tinha vaga, e o cartão dela levava o selo "escolhida agora".
-- Agora, dentro da disputa (autorizadas, ou todas quando nenhuma é), as
-- contas COM VAGA vêm primeiro; só quando nenhuma tem vaga a disputa volta a
-- ser entre todas, e a resposta diz isso (`todas_sem_vaga`). `cabe_hoje`
-- continua sendo DINHEIRO: vaga libera em minutos, o dia não. Os campos
-- `em_voo` e `limite_em_voo` são opcionais — sem eles, a escolha é a de antes.
-- Espelho: `escolherConta` (src/core/prompts/roteador.ts); casos no T42.
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
  v_limite_voo      integer;
  v_sem_vaga        boolean;
  v_com_vaga        integer := 0;
  v_so_com_vaga     boolean;
begin
  if p_consumos is null or jsonb_typeof(p_consumos) <> 'array' or jsonb_array_length(p_consumos) = 0 then
    return jsonb_build_object(
      'conta', null, 'cabe_hoje', false, 'espaco_livre_usd', 0, 'headroom_usd', 0,
      'todas_recusadas', false, 'todas_sem_vaga', false, 'empatados', 0,
      'nunca_cabe', false, 'maior_teto_usd', null);
  end if;

  for rec in select * from jsonb_array_elements(p_consumos) loop
    v_teto := (rec->>'teto_usd')::numeric;
    if v_maior_teto is null or v_teto > v_maior_teto then v_maior_teto := v_teto; end if;
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
      'todas_recusadas', false, 'todas_sem_vaga', false, 'empatados', 0,
      'nunca_cabe', true, 'maior_teto_usd', round(v_maior_teto, 2));
  end if;

  v_todas_recusadas := (v_autorizadas = 0);
  v_fase := case when v_todas_recusadas then 2 else 1 end;

  -- Quantas contas DA DISPUTA têm vaga agora.
  for rec in select * from jsonb_array_elements(p_consumos) loop
    v_teto := (rec->>'teto_usd')::numeric;
    if v_teto < p_estimado then continue; end if;
    v_exige := coalesce((rec->>'exige_medicao_recente')::boolean, false);
    v_defasagem := nullif(rec->>'defasagem_horas', '')::numeric;
    v_recusaria := v_exige and (v_defasagem is null or v_defasagem > v_limite_defasagem);
    if v_fase = 1 and v_recusaria then continue; end if;
    v_limite_voo := nullif(rec->>'limite_em_voo', '')::integer;
    v_sem_vaga := v_limite_voo is not null and v_limite_voo > 0
                  and coalesce(nullif(rec->>'em_voo', '')::integer, 0) >= v_limite_voo;
    if not v_sem_vaga then v_com_vaga := v_com_vaga + 1; end if;
  end loop;
  v_so_com_vaga := v_com_vaga > 0;

  for rec in select * from jsonb_array_elements(p_consumos) loop
    v_conta := rec->>'conta';
    v_teto := (rec->>'teto_usd')::numeric;
    if v_teto < p_estimado then continue; end if;
    v_exige := coalesce((rec->>'exige_medicao_recente')::boolean, false);
    v_defasagem := nullif(rec->>'defasagem_horas', '')::numeric;
    v_recusaria := v_exige and (v_defasagem is null or v_defasagem > v_limite_defasagem);
    if v_fase = 1 and v_recusaria then continue; end if;
    v_limite_voo := nullif(rec->>'limite_em_voo', '')::integer;
    v_sem_vaga := v_limite_voo is not null and v_limite_voo > 0
                  and coalesce(nullif(rec->>'em_voo', '')::integer, 0) >= v_limite_voo;
    if v_so_com_vaga and v_sem_vaga then continue; end if;

    v_headroom := v_teto
                - coalesce((rec->>'medido_usd')::numeric, 0)
                - coalesce((rec->>'em_execucao_usd')::numeric, 0);
    v_espaco := v_headroom - coalesce((rec->>'na_fila_usd')::numeric, 0);

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
    'todas_sem_vaga', not v_so_com_vaga,
    'empatados', v_empatados,
    'nunca_cabe', false,
    'maior_teto_usd', round(v_maior_teto, 2));
end;
$$;
comment on function public.painel_fila_escolher_conta(jsonb, numeric) is
  'D42 (rodada 9) + limite de voo (PR #42): a regra de roteamento como FUNÇÃO PURA — espelho de escolherConta (src/core/prompts/roteador.ts), provado caso a caso pelo bloco T42 e por tests/unit/prompts-paridade-chooser.test.ts sobre o MESMO literal. Dentro da disputa, conta com VAGA de sessão em voo vem antes de conta no limite; sem nenhuma com vaga, a disputa é entre todas e todas_sem_vaga=true. cabe_hoje segue sendo dinheiro.';
revoke all on function public.painel_fila_escolher_conta(jsonb, numeric) from public, anon, authenticated;
