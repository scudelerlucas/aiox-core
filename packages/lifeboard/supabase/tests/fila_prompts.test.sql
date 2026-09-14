-- =============================================================================
-- OS-LIFEBOARD · P7 — TESTE COMPORTAMENTAL DA FILA (banco vivo, sem persistir)
-- =============================================================================
-- POR QUE ESTE ARQUIVO EXISTE (MÉDIO 2, crítico da rodada 5):
--   "o teste de D21 é de ORTOGRAFIA, não de comportamento". Ele mediu:
--   aplicando a mutação `and f.custo_estimado_usd <= v_headroom + 100000` na
--   migration — o pull passa a IGNORAR o teto do dia inteiro — os 775 testes
--   do vitest passavam, todos. A suíte de TS lê o `.sql` do disco e compara
--   REGEX; ela não distingue um pull que respeita o teto de um que estoura o
--   orçamento, desde que a grafia das quatro linhas seja mantida.
--
-- A guarda COMPORTAMENTAL é ESTE arquivo, não o vitest. O vitest guarda o
-- CONTRATO MÍNIMO (as funções citadas aqui existem na migration —
-- `tests/unit/prompts-espelho-sql.test.ts`); o comportamento se prova contra
-- um Postgres de verdade, aqui.
--
-- COMO RODAR
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=0 -f supabase/tests/fila_prompts.test.sql
--   (ver DEPLOY.md § "Teste da fila de prompts")
--
-- COMO LER O RESULTADO
--   Cada bloco é um `do $$ … $$;` que TERMINA em `raise exception`:
--     · `RESULTADO: ok — <caso>`   → passou (e a transação do bloco some);
--     · `FALHA: <caso> esperado X obteve Y` → não passou.
--   O `raise` é o mecanismo de ROLLBACK: nenhum bloco deixa linha no banco,
--   passe ou falhe. Por isso `ON_ERROR_STOP=0` — cada bloco aborta sozinho e
--   o arquivo continua. Nunca rodar com ON_ERROR_STOP=1: o primeiro "ok"
--   pararia a suíte.
--
-- CONTA DE PROVA: `lsgpandora@gmail.com` (medida limpa em 13/09/2026 — consumo
-- de hoje 0, consumo de ontem 0, reservado 0). Todo bloco mexe no teto dela e
-- o `raise` devolve o teto junto com o resto.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- T01 · D25 — VIRADA DO DIA: quem fecha hoje paga hoje
-- O caso exato do crítico (ALTO 1): item pego 23h50 de ontem, fechado hoje com
-- US$ 42 MEDIDOS. Com D24 (dia de `pego_em`) o consumo de hoje ficava 0 e o
-- headroom voltava inteiro (30 → 150). Esperado agora: consumo 42, headroom 108.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_conta text := 'lsgpandora@gmail.com';
  v_id uuid;
  v_consumo numeric;
  v_headroom numeric;
  v_ontem numeric;
begin
  insert into public.painel_fila_prompts (conta, prompt, complexidade, modelo_sugerido)
  values (v_conta, 'T01 virada do dia', 'maxima', 'Fable') returning id into v_id;

  update public.painel_fila_prompts
     set estado = 'concluida', worker_id = 'w-T01', ultimo_worker_id = 'w-T01',
         pego_em = (public.painel_dia_operador() - 1)::timestamp at time zone 'America/Sao_Paulo'
                   + interval '23 hours 50 minutes',
         concluido_em = now(),
         custo_usd = 42, custo_e_estimativa = false, tentativas = 1
   where id = v_id;

  v_consumo  := public.painel_fila_consumo_hoje(v_conta);
  v_ontem    := public.painel_fila_consumo_do_dia(v_conta, public.painel_dia_operador() - 1);
  v_headroom := 150 - v_consumo - public.painel_fila_reservado(v_conta);

  if v_consumo = 42 and v_headroom = 108 and v_ontem = 0 then
    raise exception 'RESULTADO: ok — T01 D25 virada do dia: consumo hoje=% headroom=% consumo ontem=%',
      v_consumo, v_headroom, v_ontem;
  end if;
  raise exception 'FALHA: T01 D25 virada do dia esperado consumo=42 headroom=108 ontem=0 obteve consumo=% headroom=% ontem=%',
    v_consumo, v_headroom, v_ontem;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- T02 · D25 — O ITEM EM VOO É RESERVA DO DIA CORRENTE, SEMPRE
-- A outra metade da regra: item pego ontem 23h50 e AINDA rodando (heartbeat de
-- agora) pesa no headroom de HOJE, independentemente de `pego_em`.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_conta text := 'lsgpandora@gmail.com';
  v_id uuid;
  v_reservado numeric;
  v_headroom numeric;
begin
  insert into public.painel_fila_prompts (conta, prompt, complexidade, modelo_sugerido)
  values (v_conta, 'T02 em voo na virada', 'maxima', 'Fable') returning id into v_id;

  update public.painel_fila_prompts
     set estado = 'pega', worker_id = 'w-T02', ultimo_worker_id = 'w-T02',
         pego_em = (public.painel_dia_operador() - 1)::timestamp at time zone 'America/Sao_Paulo'
                   + interval '23 hours 50 minutes',
         heartbeat_em = now(), tentativas = 1
   where id = v_id;

  v_reservado := public.painel_fila_reservado(v_conta);
  v_headroom  := 150 - public.painel_fila_consumo_hoje(v_conta) - v_reservado;

  if v_reservado = 120 and v_headroom = 30 then
    raise exception 'RESULTADO: ok — T02 D25 item em voo reserva o dia corrente: reservado=% headroom=%',
      v_reservado, v_headroom;
  end if;
  raise exception 'FALHA: T02 D25 em voo esperado reservado=120 headroom=30 obteve reservado=% headroom=%',
    v_reservado, v_headroom;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- T03 · D25 — QUALQUER DIA É LEGÍVEL (o buraco do ALTO 1)
-- Item fechado ONTEM com US$ 42: hoje = 0 (certo), ontem = 42 (legível). Antes
-- desta rodada nenhuma função sabia abrir um dia que não fosse hoje.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_conta text := 'lsgpandora@gmail.com';
  v_id uuid;
  v_hoje numeric;
  v_ontem numeric;
  v_rpc jsonb;
begin
  insert into public.painel_fila_prompts (conta, prompt, complexidade, modelo_sugerido)
  values (v_conta, 'T03 fechado ontem', 'maxima', 'Fable') returning id into v_id;

  update public.painel_fila_prompts
     set estado = 'concluida', worker_id = 'w-T03', ultimo_worker_id = 'w-T03',
         pego_em      = (public.painel_dia_operador() - 1)::timestamp at time zone 'America/Sao_Paulo' + interval '20 hours',
         concluido_em = (public.painel_dia_operador() - 1)::timestamp at time zone 'America/Sao_Paulo' + interval '21 hours',
         custo_usd = 42, custo_e_estimativa = false, tentativas = 1
   where id = v_id;

  v_hoje  := public.painel_fila_consumo_hoje(v_conta);
  v_ontem := public.painel_fila_consumo_do_dia(v_conta, public.painel_dia_operador() - 1);
  v_rpc   := public.fila_prompts_consumo_do_dia(
               (select valor from private.lifeboard_config where chave = 'load_secret'),
               public.painel_dia_operador() - 1);

  if v_hoje = 0 and v_ontem = 42 and (v_rpc->>'dia')::date = public.painel_dia_operador() - 1 then
    raise exception 'RESULTADO: ok — T03 D25 dia anterior legível: hoje=% ontem=% rpc_dia=%',
      v_hoje, v_ontem, v_rpc->>'dia';
  end if;
  raise exception 'FALHA: T03 D25 esperado hoje=0 ontem=42 obteve hoje=% ontem=% rpc=%',
    v_hoje, v_ontem, v_rpc;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- T04 · D26 — O DONO DO ITEM MORTO FECHA COM O NÚMERO REAL
-- O caso exato do crítico (ALTO 2): item morto com estimativa de US$ 120; o
-- worker que rodou volta com US$ 80. Antes: `ERROR: Item pertence a outro
-- worker (nenhum)` e o dia ficava em 120 (ou 200, com a sessão publicada).
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_conta text := 'lsgpandora@gmail.com';
  v_id uuid;
  v_r jsonb;
  v_consumo numeric;
  v_estimativa boolean;
begin
  insert into public.painel_fila_prompts (conta, prompt, complexidade, modelo_sugerido)
  values (v_conta, 'T04 dono do morto', 'maxima', 'Fable') returning id into v_id;

  -- o retrato que o pull deixa ao matar o item (3ª tentativa, 2h sem sinal)
  update public.painel_fila_prompts
     set estado = 'falhou', worker_id = null, ultimo_worker_id = 'w-T04',
         heartbeat_em = null, tentativas = 3,
         motivo_falha = 'expirou 3 vezes sem fechamento',
         custo_usd = 120, custo_e_estimativa = true,
         pego_em = now() - interval '3 hours', concluido_em = now()
   where id = v_id;

  v_r := public.fila_prompts_fechar_interno(
           p_id => v_id, p_conta => v_conta, p_worker_id => 'w-T04',
           p_estado => 'falhou', p_custo_usd => 80, p_session_id => 'sess-T04');

  select custo_e_estimativa into v_estimativa from public.painel_fila_prompts where id = v_id;
  v_consumo := public.painel_fila_consumo_hoje(v_conta);

  if (v_r->>'ok')::boolean and (v_r->>'reaberto_e_fechado')::boolean
     and v_consumo = 80 and v_estimativa = false then
    raise exception 'RESULTADO: ok — T04 D26 dono do morto fecha com 80: retorno=% consumo=% e_estimativa=%',
      v_r, v_consumo, v_estimativa;
  end if;
  raise exception 'FALHA: T04 D26 esperado reaberto_e_fechado=true consumo=80 e_estimativa=false obteve retorno=% consumo=% e_estimativa=%',
    v_r, v_consumo, v_estimativa;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- T05 · D26 — OUTRO WORKER CONTINUA RECUSADO
-- A porta aberta em T04 é só para o ÚLTIMO DONO. Qualquer outro worker bate no
-- fencing, como antes.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_conta text := 'lsgpandora@gmail.com';
  v_id uuid;
  v_erro text := '(nenhum erro)';
begin
  insert into public.painel_fila_prompts (conta, prompt, complexidade, modelo_sugerido)
  values (v_conta, 'T05 outro worker', 'maxima', 'Fable') returning id into v_id;

  update public.painel_fila_prompts
     set estado = 'falhou', worker_id = null, ultimo_worker_id = 'w-T05-dono',
         tentativas = 3, custo_usd = 120, custo_e_estimativa = true,
         pego_em = now() - interval '3 hours', concluido_em = now()
   where id = v_id;

  begin
    perform public.fila_prompts_fechar_interno(
      p_id => v_id, p_conta => v_conta, p_worker_id => 'w-T05-INTRUSO',
      p_estado => 'concluida', p_custo_usd => 1);
  exception when check_violation then
    v_erro := sqlerrm;
  end;

  if v_erro like 'Item pertence a outro worker%' then
    raise exception 'RESULTADO: ok — T05 D26 intruso recusado: %', v_erro;
  end if;
  raise exception 'FALHA: T05 D26 esperado recusa de fencing, obteve: %', v_erro;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- T06 · D26 — IDEMPOTÊNCIA: a segunda chamada do dono não reescreve nada
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_conta text := 'lsgpandora@gmail.com';
  v_id uuid;
  v_um jsonb;
  v_dois jsonb;
  v_custo numeric;
begin
  insert into public.painel_fila_prompts (conta, prompt, complexidade, modelo_sugerido)
  values (v_conta, 'T06 idempotente', 'maxima', 'Fable') returning id into v_id;

  update public.painel_fila_prompts
     set estado = 'falhou', worker_id = null, ultimo_worker_id = 'w-T06',
         tentativas = 3, custo_usd = 120, custo_e_estimativa = true,
         pego_em = now() - interval '3 hours', concluido_em = now()
   where id = v_id;

  v_um   := public.fila_prompts_fechar_interno(v_id, v_conta, 'w-T06', 'falhou', 80);
  v_dois := public.fila_prompts_fechar_interno(v_id, v_conta, 'w-T06', 'falhou', 7);
  select custo_usd into v_custo from public.painel_fila_prompts where id = v_id;

  if (v_um->>'reaberto_e_fechado')::boolean
     and (v_dois->>'ja_fechado')::boolean
     and not (v_dois->>'reaberto_e_fechado')::boolean
     and v_custo = 80 then
    raise exception 'RESULTADO: ok — T06 D26 idempotente: 1a=% 2a=% custo final=%', v_um, v_dois, v_custo;
  end if;
  raise exception 'FALHA: T06 D26 esperado 1a reaberto, 2a ja_fechado e custo 80; obteve 1a=% 2a=% custo=%',
    v_um, v_dois, v_custo;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- T07 · D26 — `ajustar_custo` vincula a sessão (a porta pela TELA)
-- Sem o vínculo, o dia soma a estimativa do item MAIS o custo real da sessão.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_conta text := 'lsgpandora@gmail.com';
  v_id uuid;
  v_r jsonb;
  v_sess text;
begin
  insert into public.painel_fila_prompts (conta, prompt, complexidade, modelo_sugerido)
  values (v_conta, 'T07 ajuste com sessao', 'maxima', 'Fable') returning id into v_id;

  update public.painel_fila_prompts
     set estado = 'falhou', worker_id = null, ultimo_worker_id = 'w-T07',
         tentativas = 3, custo_usd = 120, custo_e_estimativa = true,
         pego_em = now() - interval '3 hours', concluido_em = now()
   where id = v_id;

  v_r := public.fila_prompts_ajustar_custo(
           (select valor from private.lifeboard_config where chave = 'load_secret'),
           v_id, 30, 'sess-T07');
  select session_id into v_sess from public.painel_fila_prompts where id = v_id;

  if (v_r->>'ok')::boolean and v_sess = 'sess-T07' and (v_r->>'custo_usd')::numeric = 30 then
    raise exception 'RESULTADO: ok — T07 D26 ajuste vincula sessão: retorno=% session_id=%', v_r, v_sess;
  end if;
  raise exception 'FALHA: T07 D26 esperado session_id=sess-T07 custo=30, obteve retorno=% session_id=%', v_r, v_sess;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- T08 · D30 — A MEDIÇÃO PUBLICADA SUBSTITUI A ESTIMATIVA (o caso do MÉDIO 6)
-- Item morto com estimativa de 120 + sessão vinculada que publicou 30 hoje.
-- Antes (`greatest(120 − 30, 0)`): consumo 120 — a estimativa virava PISO.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_conta text := 'lsgpandora@gmail.com';
  v_id uuid;
  v_consumo numeric;
begin
  insert into public.painel_fila_prompts (conta, prompt, complexidade, modelo_sugerido)
  values (v_conta, 'T08 estimativa x medicao', 'maxima', 'Fable') returning id into v_id;

  update public.painel_fila_prompts
     set estado = 'falhou', worker_id = null, ultimo_worker_id = 'w-T08',
         tentativas = 3, custo_usd = 120, custo_e_estimativa = true,
         session_id = 'sess-T08',
         pego_em = now() - interval '3 hours', concluido_em = now()
   where id = v_id;

  insert into public.painel_frentes_sessoes
    (sessao_id, conta, titulo, estado, branches, repos, criado_em, atualizado_em, custo_usd, publicado_em)
  values ('sess-T08', v_conta, 'T08', 'ativa', '{}', '{}', now(), now(), 30, now());

  v_consumo := public.painel_fila_consumo_hoje(v_conta);

  if v_consumo = 30 then
    raise exception 'RESULTADO: ok — T08 D30 sessão de 30 sobre item de 120: consumo=%', v_consumo;
  end if;
  raise exception 'FALHA: T08 D30 esperado consumo=30 (a sessão paga por si), obteve %', v_consumo;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- T09 · D30 — o outro sentido: sessão de 100 sobre item de 42
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_conta text := 'lsgpandora@gmail.com';
  v_id uuid;
  v_consumo numeric;
begin
  insert into public.painel_fila_prompts (conta, prompt, complexidade, modelo_sugerido)
  values (v_conta, 'T09 sessao maior', 'maxima', 'Fable') returning id into v_id;

  update public.painel_fila_prompts
     set estado = 'concluida', worker_id = 'w-T09', ultimo_worker_id = 'w-T09',
         tentativas = 1, custo_usd = 42, custo_e_estimativa = false,
         session_id = 'sess-T09', pego_em = now() - interval '1 hour', concluido_em = now()
   where id = v_id;

  insert into public.painel_frentes_sessoes
    (sessao_id, conta, titulo, estado, branches, repos, criado_em, atualizado_em, custo_usd, publicado_em)
  values ('sess-T09', v_conta, 'T09', 'ativa', '{}', '{}', now(), now(), 100, now());

  v_consumo := public.painel_fila_consumo_hoje(v_conta);

  if v_consumo = 100 then
    raise exception 'RESULTADO: ok — T09 D30 sessão de 100 sobre item de 42: consumo=%', v_consumo;
  end if;
  raise exception 'FALHA: T09 D30 esperado consumo=100, obteve %', v_consumo;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- T10 · D10 preservada — sessão publicada SEM custo não abate nada
-- 21 das 215 sessões reais têm `custo_usd` nulo; se elas zerassem o item, o
-- custo medido pelo worker sumiria.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_conta text := 'lsgpandora@gmail.com';
  v_id uuid;
  v_consumo numeric;
begin
  insert into public.painel_fila_prompts (conta, prompt, complexidade, modelo_sugerido)
  values (v_conta, 'T10 sessao sem custo', 'maxima', 'Fable') returning id into v_id;

  update public.painel_fila_prompts
     set estado = 'concluida', worker_id = 'w-T10', ultimo_worker_id = 'w-T10',
         tentativas = 1, custo_usd = 42, custo_e_estimativa = false,
         session_id = 'sess-T10', pego_em = now() - interval '1 hour', concluido_em = now()
   where id = v_id;

  insert into public.painel_frentes_sessoes
    (sessao_id, conta, titulo, estado, branches, repos, criado_em, atualizado_em, custo_usd, publicado_em)
  values ('sess-T10', v_conta, 'T10', 'ativa', '{}', '{}', now(), now(), null, now());

  v_consumo := public.painel_fila_consumo_hoje(v_conta);

  if v_consumo = 42 then
    raise exception 'RESULTADO: ok — T10 D10 sessão sem custo não abate: consumo=%', v_consumo;
  end if;
  raise exception 'FALHA: T10 D10 esperado consumo=42, obteve %', v_consumo;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- T11 · D27 — MOTIVO ADITIVO: 1 morto + 1 que não cabe
-- O caso do MÉDIO 1: o `case` de ramo único parava na primeira frase e calava a
-- morte. Agora as duas aparecem, na ordem, coladas por "; ".
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_conta text := 'lsgpandora@gmail.com';
  v_morto uuid;
  v_caro uuid;
  v_r jsonb;
  v_motivo text;
begin
  insert into public.painel_fila_prompts (conta, prompt, complexidade, modelo_sugerido)
  values (v_conta, 'T11 vai morrer', 'maxima', 'Fable') returning id into v_morto;
  insert into public.painel_fila_prompts (conta, prompt, complexidade, modelo_sugerido)
  values (v_conta, 'T11 nao cabe', 'maxima', 'Fable') returning id into v_caro;

  -- item mudo há 3 h na ÚLTIMA tentativa: o pull o mata e lança US$ 120,00
  update public.painel_fila_prompts
     set estado = 'pega', worker_id = 'w-T11', ultimo_worker_id = 'w-T11',
         tentativas = 3, pego_em = now() - interval '3 hours', heartbeat_em = now() - interval '3 hours'
   where id = v_morto;

  update public.painel_teto_diario set teto_usd = 10 where conta = v_conta;

  v_r := public.fila_prompts_pegar_interno(v_conta, 'w-T11-novo');
  v_motivo := v_r->>'motivo';

  if v_motivo = '1 item morreu sem fechar neste disparo e lançou US$ 120,00 no dia; '
                || 'nada cabe agora: o mais barato disponível custa US$ 120,00 e não há espaço livre agora; '
                || 'US$ 120,00 do consumo de hoje são estimativa de 1 item que morreu sem fechar'
     and (v_r->>'mortos')::int = 1 and (v_r->>'mortos_usd')::numeric = 120 then
    raise exception 'RESULTADO: ok — T11 D27 morte + nada cabe no MESMO motivo: %', v_motivo;
  end if;
  raise exception 'FALHA: T11 D27 motivo aditivo — obteve: % (json=%)', v_motivo, v_r;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- T12 · D27 — MOTIVO ADITIVO: 3 baixas em backoff + 5 máximas disponíveis
-- O outro caso do MÉDIO 1: a frase dizia "o mais barato da fila custa US$
-- 120.00" com três itens de US$ 5,00 em backoff. Agora a fila em espera tem
-- frase própria, e os dois "menores" saem como números separados.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_conta text := 'lsgpandora@gmail.com';
  v_r jsonb;
  v_motivo text;
  i int;
begin
  for i in 1..5 loop
    insert into public.painel_fila_prompts (conta, prompt, complexidade, modelo_sugerido)
    values (v_conta, 'T12 cara ' || i, 'maxima', 'Fable');
  end loop;
  for i in 1..3 loop
    insert into public.painel_fila_prompts (conta, prompt, complexidade, modelo_sugerido)
    values (v_conta, 'T12 barata ' || i, 'baixa', 'Haiku');
  end loop;
  update public.painel_fila_prompts
     set disponivel_em = now() + interval '12 minutes', tentativas = 1
   where conta = v_conta and complexidade = 'baixa';

  update public.painel_teto_diario set teto_usd = 10 where conta = v_conta;

  v_r := public.fila_prompts_pegar_interno(v_conta, 'w-T12');
  v_motivo := v_r->>'motivo';

  if v_motivo = 'nada cabe agora: o mais barato disponível custa US$ 120,00 e há US$ 10,00 livres; '
                || '3 itens de US$ 5,00 voltam em 12 min'
     and (v_r->>'menor_custo_fila')::numeric = 5
     and (v_r->>'menor_custo_elegivel_agora')::numeric = 120
     and (v_r->>'pulados')::int = 5
     and (v_r->>'em_espera')::int = 3 then
    raise exception 'RESULTADO: ok — T12 D27 backoff dito em voz alta: motivo=% menor_fila=% menor_agora=%',
      v_motivo, v_r->>'menor_custo_fila', v_r->>'menor_custo_elegivel_agora';
  end if;
  raise exception 'FALHA: T12 D27 — obteve motivo=% json=%', v_motivo, v_r;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- T13 · B5 — ITEM TRAVADO NÃO É "FILA VAZIA" (ramo puro)
-- Este ramo só nasce com DUAS transações simultâneas (`for update skip locked`
-- só pula o que OUTRA transação travou), e uma conexão só não produz isso — o
-- projeto não tem dblink nem pg_background, e `pegar_interno` é revogada para
-- anon/authenticated, então nem por PostgREST dá. Por isso a FRASE mora numa
-- função PURA (`painel_fila_motivo_do_pull`) e é aqui que ela se prova.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_um text;
  v_varios text;
  v_dev text;
begin
  v_um := public.painel_fila_motivo_do_pull(
    p_mortos => 0, p_mortos_usd => 0, p_custo_escolhido => null, p_headroom => 50,
    p_menor_disponivel => 5, p_elegiveis => 1, p_em_espera => 0, p_menor_espera => null,
    p_espera_min => null, p_devolvidos => 0, p_travados => 1,
    p_estimativa_usd => 0, p_estimativa_itens => 0);
  v_varios := public.painel_fila_motivo_do_pull(
    p_mortos => 0, p_mortos_usd => 0, p_custo_escolhido => null, p_headroom => 50,
    p_menor_disponivel => 5, p_elegiveis => 2, p_em_espera => 0, p_menor_espera => null,
    p_espera_min => null, p_devolvidos => 0, p_travados => 2,
    p_estimativa_usd => 0, p_estimativa_itens => 0);
  -- Este terceiro caso ACHOU UM DEFEITO REAL na primeira corrida: `text[] ||
  -- 'literal'` sem `::text` faz o Postgres ler o literal como array
  -- ("malformed array literal") — o pull inteiro morria com exatamente 1
  -- devolvido ou 1 travado. Um teste de regex sobre o .sql jamais veria isso.
  v_dev := public.painel_fila_motivo_do_pull(
    p_mortos => 0, p_mortos_usd => 0, p_custo_escolhido => null, p_headroom => 50,
    p_menor_disponivel => null, p_elegiveis => 0, p_em_espera => 1, p_menor_espera => 5,
    p_espera_min => 15, p_devolvidos => 1, p_travados => 0,
    p_estimativa_usd => 0, p_estimativa_itens => 0);

  if v_um = '1 item elegível está em uso por outra operação; tente no próximo disparo'
     and v_varios = '2 itens elegíveis estão em uso por outra operação; tente no próximo disparo'
     and v_dev = '1 item de US$ 5,00 volta em 15 min; 1 item voltou para a fila e aguarda nova tentativa' then
    raise exception 'RESULTADO: ok — T13 B5 travado tem frase própria: "%" / "%" / devolvido="%"',
      v_um, v_varios, v_dev;
  end if;
  raise exception 'FALHA: T13 B5 — obteve "%" / "%" / "%"', v_um, v_varios, v_dev;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- T14 · BAIXO 1 — HEADROOM NEGATIVO NUNCA VIRA NÚMERO
-- Medido pelo crítico: "…e so ha US$ -3.00 livres". Este texto ia LITERAL para
-- o relatório diário da Routine ao operador.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_motivo text;
begin
  v_motivo := public.painel_fila_motivo_do_pull(
    p_mortos => 0, p_mortos_usd => 0, p_custo_escolhido => null, p_headroom => -3,
    p_menor_disponivel => 120, p_elegiveis => 0, p_em_espera => 0, p_menor_espera => null,
    p_espera_min => null, p_devolvidos => 0, p_travados => 0,
    p_estimativa_usd => 0, p_estimativa_itens => 0);

  if v_motivo = 'nada cabe agora: o mais barato disponível custa US$ 120,00 e não há espaço livre agora'
     and v_motivo not like '%-%' then
    raise exception 'RESULTADO: ok — T14 BAIXO 1 sem número negativo: %', v_motivo;
  end if;
  raise exception 'FALHA: T14 BAIXO 1 — obteve: %', v_motivo;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- T15 · D21 — O ELEGÍVEL DA POSIÇÃO 137 DE 200 SAI (elegibilidade no `where`)
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_conta text := 'lsgpandora@gmail.com';
  v_r jsonb;
  v_barato uuid;
  i int;
begin
  for i in 1..200 loop
    if i = 137 then
      insert into public.painel_fila_prompts (conta, prompt, complexidade, modelo_sugerido, criado_em)
      values (v_conta, 'T15 barato', 'baixa', 'Haiku', now() - interval '1 hour' + (i * interval '1 second'))
      returning id into v_barato;
    else
      insert into public.painel_fila_prompts (conta, prompt, complexidade, modelo_sugerido, criado_em)
      values (v_conta, 'T15 caro ' || i, 'maxima', 'Fable', now() - interval '1 hour' + (i * interval '1 second'));
    end if;
  end loop;

  update public.painel_teto_diario set teto_usd = 10 where conta = v_conta;
  v_r := public.fila_prompts_pegar_interno(v_conta, 'w-T15');

  if (v_r->'item'->>'id')::uuid = v_barato
     and (v_r->>'pulados')::int = 199
     and (v_r->>'travados')::int = 0
     and v_r->>'motivo' = 'peguei o item mais antigo que cabe: US$ 5,00 de US$ 10,00 livres' then
    raise exception 'RESULTADO: ok — T15 D21 elegível da posição 137 saiu: pulados=% motivo=%',
      v_r->>'pulados', v_r->>'motivo';
  end if;
  raise exception 'FALHA: T15 D21 — esperado o item de US$ 5 da posição 137; obteve %', v_r;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- T16 · D21/M2 — O TETO DO DIA BARRA O PULL  ← O TESTE QUE A MUTAÇÃO QUEBRA
-- Esta é a asserção que o crítico procurou e não achou: com 200 itens de US$
-- 120 e US$ 10 de headroom, o pull NÃO pode trazer item nenhum. A mutação
-- `custo_estimado_usd <= v_headroom + 100000` (775/775 testes de vitest
-- passavam com ela) faz este bloco devolver FALHA.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_conta text := 'lsgpandora@gmail.com';
  v_r jsonb;
  i int;
begin
  for i in 1..200 loop
    insert into public.painel_fila_prompts (conta, prompt, complexidade, modelo_sugerido, criado_em)
    values (v_conta, 'T16 caro ' || i, 'maxima', 'Fable', now() - interval '1 hour' + (i * interval '1 second'));
  end loop;

  update public.painel_teto_diario set teto_usd = 10 where conta = v_conta;
  v_r := public.fila_prompts_pegar_interno(v_conta, 'w-T16');

  if v_r->'item' = 'null'::jsonb
     and (v_r->>'pulados')::int = 200
     and (v_r->>'headroom_usd')::numeric = 10
     and v_r->>'motivo' = 'nada cabe agora: o mais barato disponível custa US$ 120,00 e há US$ 10,00 livres' then
    raise exception 'RESULTADO: ok — T16 o teto do dia barra o pull: item=null pulados=% headroom=%',
      v_r->>'pulados', v_r->>'headroom_usd';
  end if;
  raise exception 'FALHA: T16 o pull IGNOROU o teto do dia — trouxe %', v_r;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- T17 · MÉDIO 3/D25 — `ajustar_custo` recusa item de OUTRO dia
-- As duas réguas (dia do item × dia do ajuste) passam a ser a mesma; o botão
-- que "promete e não move nada" deixa de existir no banco.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_conta text := 'lsgpandora@gmail.com';
  v_id uuid;
  v_erro text := '(nenhum erro)';
begin
  insert into public.painel_fila_prompts (conta, prompt, complexidade, modelo_sugerido)
  values (v_conta, 'T17 fechado ontem', 'maxima', 'Fable') returning id into v_id;

  update public.painel_fila_prompts
     set estado = 'falhou', worker_id = null, ultimo_worker_id = 'w-T17', tentativas = 3,
         custo_usd = 120, custo_e_estimativa = true,
         pego_em      = (public.painel_dia_operador() - 1)::timestamp at time zone 'America/Sao_Paulo' + interval '20 hours',
         concluido_em = (public.painel_dia_operador() - 1)::timestamp at time zone 'America/Sao_Paulo' + interval '21 hours'
   where id = v_id;

  begin
    perform public.fila_prompts_ajustar_custo(
      (select valor from private.lifeboard_config where chave = 'load_secret'), v_id, 5);
  exception when check_violation then
    v_erro := sqlerrm;
  end;

  if v_erro = 'Só dá para ajustar o custo de item fechado hoje.' then
    raise exception 'RESULTADO: ok — T17 D25 ajuste de outro dia recusado: %', v_erro;
  end if;
  raise exception 'FALHA: T17 D25 esperada a recusa "Só dá para ajustar o custo de item fechado hoje.", obteve: %', v_erro;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- T18 · B2 — a recusa que chega à TELA não cospe UUID
-- `23514` é o único SQLSTATE cujo texto atravessa até o operador.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_erro_cancelar text := '(nenhum erro)';
  v_erro_ajustar  text := '(nenhum erro)';
  v_fantasma uuid := '00000000-0000-0000-0000-0000000000ff';
  v_segredo text := (select valor from private.lifeboard_config where chave = 'load_secret');
begin
  begin
    perform public.fila_prompts_cancelar(v_segredo, v_fantasma);
  exception when check_violation then v_erro_cancelar := sqlerrm;
  end;
  begin
    perform public.fila_prompts_ajustar_custo(v_segredo, v_fantasma, 5);
  exception when check_violation then v_erro_ajustar := sqlerrm;
  end;

  if v_erro_cancelar not like '%' || v_fantasma::text || '%'
     and v_erro_ajustar not like '%' || v_fantasma::text || '%'
     and v_erro_cancelar like '%já foi concluído%'
     and v_erro_ajustar = 'Item não encontrado na fila.' then
    raise exception 'RESULTADO: ok — T18 B2 recusa sem UUID: cancelar="%" ajustar="%"',
      v_erro_cancelar, v_erro_ajustar;
  end if;
  raise exception 'FALHA: T18 B2 — cancelar="%" ajustar="%"', v_erro_cancelar, v_erro_ajustar;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- T19 · PRIVILÉGIOS — nenhuma função `_interno` é executável por anon/authenticated
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_vazadas text;
begin
  -- Funções de TRIGGER ficam de fora: elas não são chamáveis como RPC (o
  -- Postgres recusa "may only be called as trigger") e o privilégio delas é
  -- verificado no CREATE TRIGGER, não a cada disparo.
  select string_agg(p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')', ', ')
    into v_vazadas
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.prorettype <> 'trigger'::regtype
     and (p.proname like '%\_interno' or p.proname like 'painel\_fila\_%' or p.proname = 'painel_usd_br')
     and (has_function_privilege('anon', p.oid, 'execute')
          or has_function_privilege('authenticated', p.oid, 'execute'));

  if v_vazadas is null then
    raise exception 'RESULTADO: ok — T19 privilégios: nenhuma função interna da fila é executável por anon/authenticated';
  end if;
  raise exception 'FALHA: T19 privilégios — executáveis por anon/authenticated: %', v_vazadas;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- T20 · D27 — "fila vazia" só quando ela está vazia
-- O nome de cada caso continua sendo o nome DAQUELE caso: sem nenhum fato
-- não-zero, a frase é uma só.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_conta text := 'lsgpandora@gmail.com';
  v_r jsonb;
begin
  delete from public.painel_fila_prompts where conta = v_conta;
  v_r := public.fila_prompts_pegar_interno(v_conta, 'w-T20');

  if v_r->>'motivo' = 'fila vazia para esta conta'
     and v_r->'item' = 'null'::jsonb
     and (v_r->>'travados')::int = 0
     and v_r->'menor_custo_fila' = 'null'::jsonb then
    raise exception 'RESULTADO: ok — T20 D27 fila vazia: motivo=% menor_custo_fila=%',
      v_r->>'motivo', v_r->'menor_custo_fila';
  end if;
  raise exception 'FALHA: T20 D27 fila vazia — obteve %', v_r;
end $$;
