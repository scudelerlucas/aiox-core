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
  -- BAIXO 8 (rodada 8): o bloco começa limpando a conta de prova. Até a rodada
  -- 7, T26/T27/T28 só eram determinísticos porque `lsgpandora@gmail.com` tinha
  -- ZERO sessões reais — uma das 3 contas de PRODUÇÃO. No dia em que ela
  -- publicar, `round(defasagem) = 37` quebra e o vermelho não será um defeito,
  -- será ruído. Como todo bloco termina em `raise` (rollback), o apagamento
  -- não persiste: ele só tira a produção de dentro da prova.
  delete from public.painel_frentes_sessoes where conta = 'lsgpandora@gmail.com';
  delete from public.painel_fila_prompts where conta = 'lsgpandora@gmail.com';
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
  -- BAIXO 8 (rodada 8): o bloco começa limpando a conta de prova. Até a rodada
  -- 7, T26/T27/T28 só eram determinísticos porque `lsgpandora@gmail.com` tinha
  -- ZERO sessões reais — uma das 3 contas de PRODUÇÃO. No dia em que ela
  -- publicar, `round(defasagem) = 37` quebra e o vermelho não será um defeito,
  -- será ruído. Como todo bloco termina em `raise` (rollback), o apagamento
  -- não persiste: ele só tira a produção de dentro da prova.
  delete from public.painel_frentes_sessoes where conta = 'lsgpandora@gmail.com';
  delete from public.painel_fila_prompts where conta = 'lsgpandora@gmail.com';
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
  -- BAIXO 8 (rodada 8): o bloco começa limpando a conta de prova. Até a rodada
  -- 7, T26/T27/T28 só eram determinísticos porque `lsgpandora@gmail.com` tinha
  -- ZERO sessões reais — uma das 3 contas de PRODUÇÃO. No dia em que ela
  -- publicar, `round(defasagem) = 37` quebra e o vermelho não será um defeito,
  -- será ruído. Como todo bloco termina em `raise` (rollback), o apagamento
  -- não persiste: ele só tira a produção de dentro da prova.
  delete from public.painel_frentes_sessoes where conta = 'lsgpandora@gmail.com';
  delete from public.painel_fila_prompts where conta = 'lsgpandora@gmail.com';
  insert into public.painel_fila_prompts (conta, prompt, complexidade, modelo_sugerido)
  values (v_conta, 'T03 fechado ontem', 'maxima', 'Fable') returning id into v_id;

  -- `pego_em` é de ANTEONTEM de propósito (rodada 7): assim este bloco também
  -- cai quando alguém troca a régua do dia de `concluido_em` para `pego_em` —
  -- D25 deixa de ter um único guardião (T01) e passa a ter dois, por caminhos
  -- diferentes (headroom de hoje × leitura do dia anterior). Os números
  -- afirmados são os mesmos de sempre: hoje 0, ontem 42.
  update public.painel_fila_prompts
     set estado = 'concluida', worker_id = 'w-T03', ultimo_worker_id = 'w-T03',
         pego_em      = (public.painel_dia_operador() - 2)::timestamp at time zone 'America/Sao_Paulo' + interval '20 hours',
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
  -- BAIXO 8 (rodada 8): o bloco começa limpando a conta de prova. Até a rodada
  -- 7, T26/T27/T28 só eram determinísticos porque `lsgpandora@gmail.com` tinha
  -- ZERO sessões reais — uma das 3 contas de PRODUÇÃO. No dia em que ela
  -- publicar, `round(defasagem) = 37` quebra e o vermelho não será um defeito,
  -- será ruído. Como todo bloco termina em `raise` (rollback), o apagamento
  -- não persiste: ele só tira a produção de dentro da prova.
  delete from public.painel_frentes_sessoes where conta = 'lsgpandora@gmail.com';
  delete from public.painel_fila_prompts where conta = 'lsgpandora@gmail.com';
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
  -- BAIXO 8 (rodada 8): o bloco começa limpando a conta de prova. Até a rodada
  -- 7, T26/T27/T28 só eram determinísticos porque `lsgpandora@gmail.com` tinha
  -- ZERO sessões reais — uma das 3 contas de PRODUÇÃO. No dia em que ela
  -- publicar, `round(defasagem) = 37` quebra e o vermelho não será um defeito,
  -- será ruído. Como todo bloco termina em `raise` (rollback), o apagamento
  -- não persiste: ele só tira a produção de dentro da prova.
  delete from public.painel_frentes_sessoes where conta = 'lsgpandora@gmail.com';
  delete from public.painel_fila_prompts where conta = 'lsgpandora@gmail.com';
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
  -- BAIXO 8 (rodada 8): o bloco começa limpando a conta de prova. Até a rodada
  -- 7, T26/T27/T28 só eram determinísticos porque `lsgpandora@gmail.com` tinha
  -- ZERO sessões reais — uma das 3 contas de PRODUÇÃO. No dia em que ela
  -- publicar, `round(defasagem) = 37` quebra e o vermelho não será um defeito,
  -- será ruído. Como todo bloco termina em `raise` (rollback), o apagamento
  -- não persiste: ele só tira a produção de dentro da prova.
  delete from public.painel_frentes_sessoes where conta = 'lsgpandora@gmail.com';
  delete from public.painel_fila_prompts where conta = 'lsgpandora@gmail.com';
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
  -- BAIXO 8 (rodada 8): o bloco começa limpando a conta de prova. Até a rodada
  -- 7, T26/T27/T28 só eram determinísticos porque `lsgpandora@gmail.com` tinha
  -- ZERO sessões reais — uma das 3 contas de PRODUÇÃO. No dia em que ela
  -- publicar, `round(defasagem) = 37` quebra e o vermelho não será um defeito,
  -- será ruído. Como todo bloco termina em `raise` (rollback), o apagamento
  -- não persiste: ele só tira a produção de dentro da prova.
  delete from public.painel_frentes_sessoes where conta = 'lsgpandora@gmail.com';
  delete from public.painel_fila_prompts where conta = 'lsgpandora@gmail.com';
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
  -- BAIXO 8 (rodada 8): o bloco começa limpando a conta de prova. Até a rodada
  -- 7, T26/T27/T28 só eram determinísticos porque `lsgpandora@gmail.com` tinha
  -- ZERO sessões reais — uma das 3 contas de PRODUÇÃO. No dia em que ela
  -- publicar, `round(defasagem) = 37` quebra e o vermelho não será um defeito,
  -- será ruído. Como todo bloco termina em `raise` (rollback), o apagamento
  -- não persiste: ele só tira a produção de dentro da prova.
  delete from public.painel_frentes_sessoes where conta = 'lsgpandora@gmail.com';
  delete from public.painel_fila_prompts where conta = 'lsgpandora@gmail.com';
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
  -- BAIXO 8 (rodada 8): o bloco começa limpando a conta de prova. Até a rodada
  -- 7, T26/T27/T28 só eram determinísticos porque `lsgpandora@gmail.com` tinha
  -- ZERO sessões reais — uma das 3 contas de PRODUÇÃO. No dia em que ela
  -- publicar, `round(defasagem) = 37` quebra e o vermelho não será um defeito,
  -- será ruído. Como todo bloco termina em `raise` (rollback), o apagamento
  -- não persiste: ele só tira a produção de dentro da prova.
  delete from public.painel_frentes_sessoes where conta = 'lsgpandora@gmail.com';
  delete from public.painel_fila_prompts where conta = 'lsgpandora@gmail.com';
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
  -- BAIXO 8 (rodada 8): o bloco começa limpando a conta de prova. Até a rodada
  -- 7, T26/T27/T28 só eram determinísticos porque `lsgpandora@gmail.com` tinha
  -- ZERO sessões reais — uma das 3 contas de PRODUÇÃO. No dia em que ela
  -- publicar, `round(defasagem) = 37` quebra e o vermelho não será um defeito,
  -- será ruído. Como todo bloco termina em `raise` (rollback), o apagamento
  -- não persiste: ele só tira a produção de dentro da prova.
  delete from public.painel_frentes_sessoes where conta = 'lsgpandora@gmail.com';
  delete from public.painel_fila_prompts where conta = 'lsgpandora@gmail.com';
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
  -- BAIXO 8 (rodada 8): o bloco começa limpando a conta de prova. Até a rodada
  -- 7, T26/T27/T28 só eram determinísticos porque `lsgpandora@gmail.com` tinha
  -- ZERO sessões reais — uma das 3 contas de PRODUÇÃO. No dia em que ela
  -- publicar, `round(defasagem) = 37` quebra e o vermelho não será um defeito,
  -- será ruído. Como todo bloco termina em `raise` (rollback), o apagamento
  -- não persiste: ele só tira a produção de dentro da prova.
  delete from public.painel_frentes_sessoes where conta = 'lsgpandora@gmail.com';
  delete from public.painel_fila_prompts where conta = 'lsgpandora@gmail.com';
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

  -- BAIXO 7 (rodada 7): a oração da parcela estimada ACUMULADA some quando ela
  -- nomeia o MESMO dinheiro que a oração dos mortos DESTE disparo já nomeou —
  -- aqui, os mesmos US$ 120,00 do mesmo item. Duas orações, um dinheiro só: a
  -- segunda saía de graça e engordava a frase (o crítico mediu 331 caracteres).
  if v_motivo = '1 item morreu sem fechar neste disparo e lançou US$ 120,00 no dia; '
                || 'nada cabe agora: o mais barato disponível custa US$ 120,00 e não há espaço livre agora'
     and length(v_motivo) < 200
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
  -- BAIXO 8 (rodada 8): o bloco começa limpando a conta de prova. Até a rodada
  -- 7, T26/T27/T28 só eram determinísticos porque `lsgpandora@gmail.com` tinha
  -- ZERO sessões reais — uma das 3 contas de PRODUÇÃO. No dia em que ela
  -- publicar, `round(defasagem) = 37` quebra e o vermelho não será um defeito,
  -- será ruído. Como todo bloco termina em `raise` (rollback), o apagamento
  -- não persiste: ele só tira a produção de dentro da prova.
  delete from public.painel_frentes_sessoes where conta = 'lsgpandora@gmail.com';
  delete from public.painel_fila_prompts where conta = 'lsgpandora@gmail.com';
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
  -- BAIXO 8 (rodada 8): o bloco começa limpando a conta de prova. Até a rodada
  -- 7, T26/T27/T28 só eram determinísticos porque `lsgpandora@gmail.com` tinha
  -- ZERO sessões reais — uma das 3 contas de PRODUÇÃO. No dia em que ela
  -- publicar, `round(defasagem) = 37` quebra e o vermelho não será um defeito,
  -- será ruído. Como todo bloco termina em `raise` (rollback), o apagamento
  -- não persiste: ele só tira a produção de dentro da prova.
  delete from public.painel_frentes_sessoes where conta = 'lsgpandora@gmail.com';
  delete from public.painel_fila_prompts where conta = 'lsgpandora@gmail.com';
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
  -- BAIXO 8 (rodada 8): o bloco começa limpando a conta de prova. Até a rodada
  -- 7, T26/T27/T28 só eram determinísticos porque `lsgpandora@gmail.com` tinha
  -- ZERO sessões reais — uma das 3 contas de PRODUÇÃO. No dia em que ela
  -- publicar, `round(defasagem) = 37` quebra e o vermelho não será um defeito,
  -- será ruído. Como todo bloco termina em `raise` (rollback), o apagamento
  -- não persiste: ele só tira a produção de dentro da prova.
  delete from public.painel_frentes_sessoes where conta = 'lsgpandora@gmail.com';
  delete from public.painel_fila_prompts where conta = 'lsgpandora@gmail.com';
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
  -- BAIXO 8 (rodada 8): o bloco começa limpando a conta de prova. Até a rodada
  -- 7, T26/T27/T28 só eram determinísticos porque `lsgpandora@gmail.com` tinha
  -- ZERO sessões reais — uma das 3 contas de PRODUÇÃO. No dia em que ela
  -- publicar, `round(defasagem) = 37` quebra e o vermelho não será um defeito,
  -- será ruído. Como todo bloco termina em `raise` (rollback), o apagamento
  -- não persiste: ele só tira a produção de dentro da prova.
  delete from public.painel_frentes_sessoes where conta = 'lsgpandora@gmail.com';
  delete from public.painel_fila_prompts where conta = 'lsgpandora@gmail.com';
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
  -- BAIXO 8 (rodada 8): o bloco começa limpando a conta de prova. Até a rodada
  -- 7, T26/T27/T28 só eram determinísticos porque `lsgpandora@gmail.com` tinha
  -- ZERO sessões reais — uma das 3 contas de PRODUÇÃO. No dia em que ela
  -- publicar, `round(defasagem) = 37` quebra e o vermelho não será um defeito,
  -- será ruído. Como todo bloco termina em `raise` (rollback), o apagamento
  -- não persiste: ele só tira a produção de dentro da prova.
  delete from public.painel_frentes_sessoes where conta = 'lsgpandora@gmail.com';
  delete from public.painel_fila_prompts where conta = 'lsgpandora@gmail.com';
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
  -- BAIXO 8 (rodada 8): o bloco começa limpando a conta de prova. Até a rodada
  -- 7, T26/T27/T28 só eram determinísticos porque `lsgpandora@gmail.com` tinha
  -- ZERO sessões reais — uma das 3 contas de PRODUÇÃO. No dia em que ela
  -- publicar, `round(defasagem) = 37` quebra e o vermelho não será um defeito,
  -- será ruído. Como todo bloco termina em `raise` (rollback), o apagamento
  -- não persiste: ele só tira a produção de dentro da prova.
  delete from public.painel_frentes_sessoes where conta = 'lsgpandora@gmail.com';
  delete from public.painel_fila_prompts where conta = 'lsgpandora@gmail.com';
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
  -- BAIXO 8 (rodada 8): o bloco começa limpando a conta de prova. Até a rodada
  -- 7, T26/T27/T28 só eram determinísticos porque `lsgpandora@gmail.com` tinha
  -- ZERO sessões reais — uma das 3 contas de PRODUÇÃO. No dia em que ela
  -- publicar, `round(defasagem) = 37` quebra e o vermelho não será um defeito,
  -- será ruído. Como todo bloco termina em `raise` (rollback), o apagamento
  -- não persiste: ele só tira a produção de dentro da prova.
  delete from public.painel_frentes_sessoes where conta = 'lsgpandora@gmail.com';
  delete from public.painel_fila_prompts where conta = 'lsgpandora@gmail.com';
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
  -- BAIXO 8 (rodada 8): o bloco começa limpando a conta de prova. Até a rodada
  -- 7, T26/T27/T28 só eram determinísticos porque `lsgpandora@gmail.com` tinha
  -- ZERO sessões reais — uma das 3 contas de PRODUÇÃO. No dia em que ela
  -- publicar, `round(defasagem) = 37` quebra e o vermelho não será um defeito,
  -- será ruído. Como todo bloco termina em `raise` (rollback), o apagamento
  -- não persiste: ele só tira a produção de dentro da prova.
  delete from public.painel_frentes_sessoes where conta = 'lsgpandora@gmail.com';
  delete from public.painel_fila_prompts where conta = 'lsgpandora@gmail.com';
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
  -- BAIXO 8 (rodada 8): o bloco começa limpando a conta de prova. Até a rodada
  -- 7, T26/T27/T28 só eram determinísticos porque `lsgpandora@gmail.com` tinha
  -- ZERO sessões reais — uma das 3 contas de PRODUÇÃO. No dia em que ela
  -- publicar, `round(defasagem) = 37` quebra e o vermelho não será um defeito,
  -- será ruído. Como todo bloco termina em `raise` (rollback), o apagamento
  -- não persiste: ele só tira a produção de dentro da prova.
  delete from public.painel_frentes_sessoes where conta = 'lsgpandora@gmail.com';
  delete from public.painel_fila_prompts where conta = 'lsgpandora@gmail.com';
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

-- ═════════════════════════════════════════════════════════════════════════════
-- RODADA 7 — D31 (o dinheiro cobrado UMA vez), D32 (o teto que para de mentir),
-- MÉDIO 4 (o medido zero), BAIXO 9 (o enum traduzido) e os SEGUNDOS BLOCOS.
--
-- POR QUE OS "SEGUNDOS BLOCOS" (achado de ARQUITETURA do crítico da rodada 6):
--   cada decisão estava sustentada por UM ÚNICO bloco. Apagar T05 reabria o
--   roubo de item morto sem nenhum outro vermelho; apagar T08 devolvia a
--   estimativa-piso. As decisões que guardam DINHEIRO e POSSE passam a ter um
--   segundo bloco POR OUTRO CAMINHO — não uma cópia do primeiro:
--     · POSSE   : T05 (a recusa) + T23 (o dinheiro que a recusa NÃO moveu);
--     · DINHEIRO: T08 (painel_fila_consumo_hoje) + T24 (a RPC secret-gated,
--                 que devolve também a CONTAGEM de itens que contribuem);
--     · D31     : T21/T22 (os dois sentidos da virada, por
--                 painel_fila_consumo_do_dia) + T25 (a contribuição item a
--                 item, direto em painel_fila_itens_do_dia).
-- ═════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- T21 · D31 — O CASO-TÍTULO: o mesmo dinheiro cobrado DUAS vezes na virada
-- Medido pelo crítico com as RPCs reais (enfileirar → pegar → heartbeat com
-- FILHA_ID → sessão publicada em 12/09 com 80 → fechar em 13/09 com 80 e o
-- MESMO FILHA_ID):
--   TRABALHO REAL = US$ 80,00 -> dia 12 cobra 80 ; dia 13 cobra 80,0000 ;
--   TOTAL COBRADO 160,0000
-- Esperado: 80 no TOTAL.
-- RODADA 8 (D33) — este bloco é também a prova do DEFEITO ESPELHADO. Aqui a
-- sessão foi medida ONTEM e o item só fechou HOJE: se a correção do ALTO 1
-- fosse "o dia do item, sempre", os 80 sairiam de ontem (dia já encerrado) e
-- entrariam em hoje — exatamente o mesmo crime, na direção oposta. Por isso o
-- dia de cobrança é `least(dia do item, dia da medição)`: um dia encerrado
-- nunca devolve dinheiro. No caminho NORMAL (item fecha antes de a sessão ser
-- publicada) os dois casos coincidem — é o que T30 prova.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_conta text := 'lsgpandora@gmail.com';
  v_id uuid;
  v_hoje numeric;
  v_ontem numeric;
  v_total numeric;
begin
  -- BAIXO 8 (rodada 8): o bloco começa limpando a conta de prova. Até a rodada
  -- 7, T26/T27/T28 só eram determinísticos porque `lsgpandora@gmail.com` tinha
  -- ZERO sessões reais — uma das 3 contas de PRODUÇÃO. No dia em que ela
  -- publicar, `round(defasagem) = 37` quebra e o vermelho não será um defeito,
  -- será ruído. Como todo bloco termina em `raise` (rollback), o apagamento
  -- não persiste: ele só tira a produção de dentro da prova.
  delete from public.painel_frentes_sessoes where conta = 'lsgpandora@gmail.com';
  delete from public.painel_fila_prompts where conta = 'lsgpandora@gmail.com';
  insert into public.painel_fila_prompts (conta, prompt, complexidade, modelo_sugerido)
  values (v_conta, 'T21 virada com sessao vinculada', 'maxima', 'Fable') returning id into v_id;

  -- o item fechou HOJE, com o mesmo número que a sessão publicou ONTEM
  update public.painel_fila_prompts
     set estado = 'concluida', worker_id = 'w-T21', ultimo_worker_id = 'w-T21',
         session_id = 'sess-T21', tentativas = 1,
         custo_usd = 80, custo_e_estimativa = false,
         pego_em = (public.painel_dia_operador() - 1)::timestamp at time zone 'America/Sao_Paulo'
                   + interval '23 hours',
         concluido_em = now()
   where id = v_id;

  insert into public.painel_frentes_sessoes
    (sessao_id, conta, titulo, estado, branches, repos, criado_em, atualizado_em, custo_usd, publicado_em)
  values ('sess-T21', v_conta, 'T21', 'ativa', '{}', '{}',
          (public.painel_dia_operador() - 1)::timestamp at time zone 'America/Sao_Paulo' + interval '12 hours',
          (public.painel_dia_operador() - 1)::timestamp at time zone 'America/Sao_Paulo' + interval '12 hours',
          80,
          (public.painel_dia_operador() - 1)::timestamp at time zone 'America/Sao_Paulo' + interval '12 hours');

  v_hoje  := public.painel_fila_consumo_do_dia(v_conta, public.painel_dia_operador());
  v_ontem := public.painel_fila_consumo_do_dia(v_conta, public.painel_dia_operador() - 1);
  v_total := v_hoje + v_ontem;

  if v_hoje = 0 and v_ontem = 80 and v_total = 80 then
    raise exception 'RESULTADO: ok — T21 D31 trabalho de US$ 80,00 cobra 80 no total: hoje=% ontem=% TOTAL=%',
      v_hoje, v_ontem, v_total;
  end if;
  raise exception 'FALHA: T21 D31 esperado hoje=0 ontem=80 TOTAL=80 obteve hoje=% ontem=% TOTAL=%',
    v_hoje, v_ontem, v_total;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- T22 · D31/D33 — O SENTIDO INVERSO (o crítico mediu 160 nos DOIS)
-- Item fechado 23h59 do dia anterior; a sessão só é atualizada 00h05 do dia
-- seguinte. Rodada 7: 80 no dia do item + 80 no dia da sessão = 160 (corrigido
-- para 80 no total, mas no dia da SESSÃO).
-- RODADA 8 · ESTE BLOCO MUDOU DE VEREDITO, e a mudança É a correção do ALTO 1:
-- o dia que paga é o do FECHAMENTO do item (ontem), não o da publicação (hoje).
-- Com a régua da rodada 7, ontem — um dia encerrado — era reescrito para 0 e o
-- teto de HOJE passava a pagar trabalho de ontem. Esperado agora: ontem = 80,
-- hoje = 0, total 80.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_conta text := 'lsgpandora@gmail.com';
  v_id uuid;
  v_hoje numeric;
  v_ontem numeric;
  v_total numeric;
begin
  -- BAIXO 8 (rodada 8): o bloco começa limpando a conta de prova. Até a rodada
  -- 7, T26/T27/T28 só eram determinísticos porque `lsgpandora@gmail.com` tinha
  -- ZERO sessões reais — uma das 3 contas de PRODUÇÃO. No dia em que ela
  -- publicar, `round(defasagem) = 37` quebra e o vermelho não será um defeito,
  -- será ruído. Como todo bloco termina em `raise` (rollback), o apagamento
  -- não persiste: ele só tira a produção de dentro da prova.
  delete from public.painel_frentes_sessoes where conta = 'lsgpandora@gmail.com';
  delete from public.painel_fila_prompts where conta = 'lsgpandora@gmail.com';
  insert into public.painel_fila_prompts (conta, prompt, complexidade, modelo_sugerido)
  values (v_conta, 'T22 virada inversa', 'maxima', 'Fable') returning id into v_id;

  update public.painel_fila_prompts
     set estado = 'concluida', worker_id = 'w-T22', ultimo_worker_id = 'w-T22',
         session_id = 'sess-T22', tentativas = 1,
         custo_usd = 80, custo_e_estimativa = false,
         pego_em      = (public.painel_dia_operador() - 1)::timestamp at time zone 'America/Sao_Paulo' + interval '22 hours',
         concluido_em = (public.painel_dia_operador() - 1)::timestamp at time zone 'America/Sao_Paulo' + interval '23 hours 59 minutes'
   where id = v_id;

  insert into public.painel_frentes_sessoes
    (sessao_id, conta, titulo, estado, branches, repos, criado_em, atualizado_em, custo_usd, publicado_em)
  values ('sess-T22', v_conta, 'T22', 'ativa', '{}', '{}',
          (public.painel_dia_operador())::timestamp at time zone 'America/Sao_Paulo' + interval '5 minutes',
          (public.painel_dia_operador())::timestamp at time zone 'America/Sao_Paulo' + interval '5 minutes',
          80,
          (public.painel_dia_operador())::timestamp at time zone 'America/Sao_Paulo' + interval '5 minutes');

  v_hoje  := public.painel_fila_consumo_do_dia(v_conta, public.painel_dia_operador());
  v_ontem := public.painel_fila_consumo_do_dia(v_conta, public.painel_dia_operador() - 1);
  v_total := v_hoje + v_ontem;

  if v_hoje = 0 and v_ontem = 80 and v_total = 80 then
    raise exception 'RESULTADO: ok — T22 D33 o dia que paga é o do FECHAMENTO: hoje=% ontem=% TOTAL=%',
      v_hoje, v_ontem, v_total;
  end if;
  raise exception 'FALHA: T22 D33 esperado hoje=0 ontem=80 TOTAL=80 obteve hoje=% ontem=% TOTAL=%',
    v_hoje, v_ontem, v_total;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- T23 · D26 POSSE, SEGUNDO CAMINHO — a recusa do intruso não move DINHEIRO
-- T05 prova que o intruso ouve "não". Este prova a consequência que interessa:
-- depois do "não", o número do dia continua o da casa. Apagar a guarda de
-- `ultimo_worker_id` derruba OS DOIS, por caminhos diferentes (mensagem × saldo).
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_conta text := 'lsgpandora@gmail.com';
  v_id uuid;
  v_consumo numeric;
  v_custo numeric;
  v_estimativa boolean;
  v_erro text := '(nenhum erro)';
begin
  -- BAIXO 8 (rodada 8): o bloco começa limpando a conta de prova. Até a rodada
  -- 7, T26/T27/T28 só eram determinísticos porque `lsgpandora@gmail.com` tinha
  -- ZERO sessões reais — uma das 3 contas de PRODUÇÃO. No dia em que ela
  -- publicar, `round(defasagem) = 37` quebra e o vermelho não será um defeito,
  -- será ruído. Como todo bloco termina em `raise` (rollback), o apagamento
  -- não persiste: ele só tira a produção de dentro da prova.
  delete from public.painel_frentes_sessoes where conta = 'lsgpandora@gmail.com';
  delete from public.painel_fila_prompts where conta = 'lsgpandora@gmail.com';
  insert into public.painel_fila_prompts (conta, prompt, complexidade, modelo_sugerido)
  values (v_conta, 'T23 intruso nao move dinheiro', 'maxima', 'Fable') returning id into v_id;

  update public.painel_fila_prompts
     set estado = 'falhou', worker_id = null, ultimo_worker_id = 'w-T23-dono',
         tentativas = 3, custo_usd = 120, custo_e_estimativa = true,
         motivo_falha = 'expirou 3 vezes sem fechamento',
         pego_em = now() - interval '3 hours', concluido_em = now()
   where id = v_id;

  begin
    perform public.fila_prompts_fechar_interno(
      p_id => v_id, p_conta => v_conta, p_worker_id => 'w-T23-intruso',
      p_estado => 'falhou', p_custo_usd => 3, p_session_id => 'sess-T23');
  exception when others then
    v_erro := SQLERRM;
  end;

  select custo_usd, custo_e_estimativa into v_custo, v_estimativa
    from public.painel_fila_prompts where id = v_id;
  v_consumo := public.painel_fila_consumo_hoje(v_conta);

  if v_erro like 'Item pertence a outro worker%'
     and v_custo = 120 and v_estimativa = true and v_consumo = 120 then
    raise exception 'RESULTADO: ok — T23 D26 o intruso não move o dinheiro: erro="%" custo=% consumo=%',
      v_erro, v_custo, v_consumo;
  end if;
  raise exception 'FALHA: T23 D26 esperado recusa + custo=120 + consumo=120; obteve erro="%" custo=% estimativa=% consumo=%',
    v_erro, v_custo, v_estimativa, v_consumo;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- T24 · D30/D31 DINHEIRO, SEGUNDO CAMINHO — pela RPC, com a CONTAGEM de itens
-- T08 olha `painel_fila_consumo_hoje`. Este olha a porta secret-gated
-- `fila_prompts_consumo_do_dia`.
-- RODADA 8 · MÉDIO 3 — ESTE BLOCO ESTAVA PROVANDO O DEFEITO. Ele afirmava
-- `itens = 0` como CORRETO num dia com 1 item fechado, porque a RPC contava só
-- `contribuicao > 0` — e depois de D31 todo item com sessão vinculada e custo
-- publicado (o caminho que a Routine percorre TODA vez) contribui zero. O
-- relatório do dia dizia `{"itens": 0, "consumo_usd": 30.00}` e o teste dizia
-- "ok". Agora: `itens` conta o que a fila RODOU (1) e
-- `itens_com_contribuicao` continua dizendo quantos pagaram do próprio bolso (0).
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_conta text := 'lsgpandora@gmail.com';
  v_id uuid;
  v_rpc jsonb;
  v_linha jsonb;
begin
  -- BAIXO 8 (rodada 8): o bloco começa limpando a conta de prova. Até a rodada
  -- 7, T26/T27/T28 só eram determinísticos porque `lsgpandora@gmail.com` tinha
  -- ZERO sessões reais — uma das 3 contas de PRODUÇÃO. No dia em que ela
  -- publicar, `round(defasagem) = 37` quebra e o vermelho não será um defeito,
  -- será ruído. Como todo bloco termina em `raise` (rollback), o apagamento
  -- não persiste: ele só tira a produção de dentro da prova.
  delete from public.painel_frentes_sessoes where conta = 'lsgpandora@gmail.com';
  delete from public.painel_fila_prompts where conta = 'lsgpandora@gmail.com';
  insert into public.painel_fila_prompts (conta, prompt, complexidade, modelo_sugerido)
  values (v_conta, 'T24 rpc conta os itens', 'maxima', 'Fable') returning id into v_id;

  update public.painel_fila_prompts
     set estado = 'falhou', worker_id = null, ultimo_worker_id = 'w-T24',
         tentativas = 3, custo_usd = 120, custo_e_estimativa = true,
         session_id = 'sess-T24',
         pego_em = now() - interval '3 hours', concluido_em = now()
   where id = v_id;

  insert into public.painel_frentes_sessoes
    (sessao_id, conta, titulo, estado, branches, repos, criado_em, atualizado_em, custo_usd, publicado_em)
  values ('sess-T24', v_conta, 'T24', 'ativa', '{}', '{}', now(), now(), 30, now());

  v_rpc := public.fila_prompts_consumo_do_dia(
             (select valor from private.lifeboard_config where chave = 'load_secret'),
             public.painel_dia_operador());
  select l into v_linha from jsonb_array_elements(v_rpc->'contas') as l where l->>'conta' = v_conta;

  if (v_linha->>'consumo_usd')::numeric = 30
     and (v_linha->>'itens')::int = 1
     and (v_linha->>'itens_com_contribuicao')::int = 0 then
    raise exception 'RESULTADO: ok — T24 MÉDIO 3 a sessão paga (30) e o item APARECE na contagem: linha=%', v_linha;
  end if;
  raise exception 'FALHA: T24 esperado consumo_usd=30, itens=1 e itens_com_contribuicao=0; obteve %', v_linha;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- T25 · D31, SEGUNDO CAMINHO — a contribuição ITEM A ITEM, nos dois dias
-- T21/T22 somam o dia. Este abre a caixa: `painel_fila_itens_do_dia` devolve a
-- contribuição de CADA item. Com o filtro de dia de volta no `left join
-- lateral`, a contribuição do item no dia dele volta a ser 80 e este bloco cai
-- junto com T21 — dois vermelhos, não um.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_conta text := 'lsgpandora@gmail.com';
  v_id uuid;
  v_contrib_hoje numeric;
  v_linhas_ontem int;
  v_total numeric;
begin
  -- BAIXO 8 (rodada 8): o bloco começa limpando a conta de prova. Até a rodada
  -- 7, T26/T27/T28 só eram determinísticos porque `lsgpandora@gmail.com` tinha
  -- ZERO sessões reais — uma das 3 contas de PRODUÇÃO. No dia em que ela
  -- publicar, `round(defasagem) = 37` quebra e o vermelho não será um defeito,
  -- será ruído. Como todo bloco termina em `raise` (rollback), o apagamento
  -- não persiste: ele só tira a produção de dentro da prova.
  delete from public.painel_frentes_sessoes where conta = 'lsgpandora@gmail.com';
  delete from public.painel_fila_prompts where conta = 'lsgpandora@gmail.com';
  insert into public.painel_fila_prompts (conta, prompt, complexidade, modelo_sugerido)
  values (v_conta, 'T25 contribuicao item a item', 'maxima', 'Fable') returning id into v_id;

  update public.painel_fila_prompts
     set estado = 'concluida', worker_id = 'w-T25', ultimo_worker_id = 'w-T25',
         session_id = 'sess-T25', tentativas = 1,
         custo_usd = 80, custo_e_estimativa = false,
         pego_em = now() - interval '2 hours', concluido_em = now()
   where id = v_id;

  insert into public.painel_frentes_sessoes
    (sessao_id, conta, titulo, estado, branches, repos, criado_em, atualizado_em, custo_usd, publicado_em)
  values ('sess-T25', v_conta, 'T25', 'ativa', '{}', '{}',
          (public.painel_dia_operador() - 1)::timestamp at time zone 'America/Sao_Paulo' + interval '10 hours',
          (public.painel_dia_operador() - 1)::timestamp at time zone 'America/Sao_Paulo' + interval '10 hours',
          80,
          (public.painel_dia_operador() - 1)::timestamp at time zone 'America/Sao_Paulo' + interval '10 hours');

  select d.contribuicao into v_contrib_hoje
    from public.painel_fila_itens_do_dia(v_conta, public.painel_dia_operador()) d
   where d.id = v_id;
  select count(*)::int into v_linhas_ontem
    from public.painel_fila_itens_do_dia(v_conta, public.painel_dia_operador() - 1) d;
  v_total := public.painel_fila_consumo_do_dia(v_conta, public.painel_dia_operador())
           + public.painel_fila_consumo_do_dia(v_conta, public.painel_dia_operador() - 1);

  if v_contrib_hoje = 0 and v_linhas_ontem = 0 and v_total = 80 then
    raise exception 'RESULTADO: ok — T25 D31 o item contribui 0 em todo dia: contribuicao_hoje=% linhas_ontem=% TOTAL=%',
      v_contrib_hoje, v_linhas_ontem, v_total;
  end if;
  raise exception 'FALHA: T25 D31 esperado contribuicao=0 linhas_ontem=0 TOTAL=80; obteve %/%/%',
    v_contrib_hoje, v_linhas_ontem, v_total;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- T26 · D32a/D32b — A DEFASAGEM É MEDIDA E ENTRA NA FRASE
-- Medido pelo crítico: a última sessão sincronizada era de 12/09 12:37 UTC
-- (~37 h antes) e o motivo do pull não dizia uma palavra sobre isso.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_conta text := 'lsgpandora@gmail.com';
  v_defasagem numeric;
  v_com text;
  v_sem text;
begin
  -- BAIXO 8 (rodada 8): o bloco começa limpando a conta de prova. Até a rodada
  -- 7, T26/T27/T28 só eram determinísticos porque `lsgpandora@gmail.com` tinha
  -- ZERO sessões reais — uma das 3 contas de PRODUÇÃO. No dia em que ela
  -- publicar, `round(defasagem) = 37` quebra e o vermelho não será um defeito,
  -- será ruído. Como todo bloco termina em `raise` (rollback), o apagamento
  -- não persiste: ele só tira a produção de dentro da prova.
  delete from public.painel_frentes_sessoes where conta = 'lsgpandora@gmail.com';
  delete from public.painel_fila_prompts where conta = 'lsgpandora@gmail.com';
  insert into public.painel_frentes_sessoes
    (sessao_id, conta, titulo, estado, branches, repos, criado_em, atualizado_em, custo_usd, publicado_em)
  values ('sess-T26', v_conta, 'T26', 'ativa', '{}', '{}',
          now() - interval '37 hours', now() - interval '37 hours', 12, now() - interval '37 hours');

  v_defasagem := public.painel_fila_defasagem_horas(v_conta);

  v_com := public.painel_fila_motivo_do_pull(
    p_mortos => 0, p_mortos_usd => 0, p_custo_escolhido => 5, p_headroom => 10,
    p_menor_disponivel => null, p_elegiveis => 1, p_em_espera => 0, p_menor_espera => null,
    p_espera_min => null, p_devolvidos => 0, p_travados => 0,
    p_estimativa_usd => 0, p_estimativa_itens => 0,
    p_defasagem_horas => 37, p_exigir_medicao => false);

  -- 11,9 h ainda não passou de 12: a frase fica igual à de sempre.
  v_sem := public.painel_fila_motivo_do_pull(
    p_mortos => 0, p_mortos_usd => 0, p_custo_escolhido => 5, p_headroom => 10,
    p_menor_disponivel => null, p_elegiveis => 1, p_em_espera => 0, p_menor_espera => null,
    p_espera_min => null, p_devolvidos => 0, p_travados => 0,
    p_estimativa_usd => 0, p_estimativa_itens => 0,
    p_defasagem_horas => 11.9, p_exigir_medicao => false);

  if round(v_defasagem) = 37
     and v_com = 'atenção: o gasto medido desta conta é de 37 h atrás; '
                 || 'peguei o item mais antigo que cabe: US$ 5,00 de US$ 10,00 livres'
     and v_sem = 'peguei o item mais antigo que cabe: US$ 5,00 de US$ 10,00 livres' then
    raise exception 'RESULTADO: ok — T26 D32a/b defasagem medida e dita: horas=% com="%" sem="%"',
      v_defasagem, v_com, v_sem;
  end if;
  raise exception 'FALHA: T26 D32a/b — horas=% com="%" sem="%"', v_defasagem, v_com, v_sem;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- T27 · D32c — `exigir_medicao_recente` RECUSA o pull (e o default não muda nada)
-- O valor do teto é decisão do OPERADOR; esta coluna é a trava que ele pode
-- ligar. Default `false` — e o mesmo cenário com `false` continua pegando o item.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_conta text := 'lsgpandora@gmail.com';
  v_id uuid;
  v_recusa jsonb;
  v_livre jsonb;
begin
  -- BAIXO 8 (rodada 8): o bloco começa limpando a conta de prova. Até a rodada
  -- 7, T26/T27/T28 só eram determinísticos porque `lsgpandora@gmail.com` tinha
  -- ZERO sessões reais — uma das 3 contas de PRODUÇÃO. No dia em que ela
  -- publicar, `round(defasagem) = 37` quebra e o vermelho não será um defeito,
  -- será ruído. Como todo bloco termina em `raise` (rollback), o apagamento
  -- não persiste: ele só tira a produção de dentro da prova.
  delete from public.painel_frentes_sessoes where conta = 'lsgpandora@gmail.com';
  delete from public.painel_fila_prompts where conta = 'lsgpandora@gmail.com';
  insert into public.painel_frentes_sessoes
    (sessao_id, conta, titulo, estado, branches, repos, criado_em, atualizado_em, custo_usd, publicado_em)
  values ('sess-T27', v_conta, 'T27', 'ativa', '{}', '{}',
          now() - interval '37 hours', now() - interval '37 hours', 0, now() - interval '37 hours');

  insert into public.painel_fila_prompts (conta, prompt, complexidade, modelo_sugerido)
  values (v_conta, 'T27 item barato', 'baixa', 'Haiku') returning id into v_id;

  update public.painel_teto_diario set exigir_medicao_recente = true where conta = v_conta;
  v_recusa := public.fila_prompts_pegar_interno(v_conta, 'w-T27-a');

  update public.painel_teto_diario set exigir_medicao_recente = false where conta = v_conta;
  v_livre := public.fila_prompts_pegar_interno(v_conta, 'w-T27-b');

  if v_recusa->'item' = 'null'::jsonb
     and (v_recusa->>'recusado_por_medicao')::boolean
     and v_recusa->>'motivo' = 'não autorizo contra saldo de 37 h atrás: esta conta exige medição recente'
     and (v_livre->'item'->>'id')::uuid = v_id
     and (v_livre->>'recusado_por_medicao')::boolean = false then
    raise exception 'RESULTADO: ok — T27 D32c recusa com trava e pega sem ela: recusa="%" pegou=%',
      v_recusa->>'motivo', v_livre->'item'->>'id';
  end if;
  raise exception 'FALHA: T27 D32c — recusa=% livre=%', v_recusa, v_livre;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- T28 · D32d — A REALIDADE MEDIDA AO LADO DO TETO
-- Medido pelo crítico na conta real: 9 de 9 dias com dado ACIMA do teto de
-- US$ 150 (mediana ~2,6×, máximo 16,8× — 12/09 deu US$ 2.513,29 em 12 sessões).
-- Este bloco prova o instrumento, com números plantados e conhecidos.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_conta text := 'lsgpandora@gmail.com';
  v_dias int;
  v_min numeric;
  v_max numeric;
  v_mediana numeric;
  i int;
begin
  -- BAIXO 8 (rodada 8): o bloco começa limpando a conta de prova. Até a rodada
  -- 7, T26/T27/T28 só eram determinísticos porque `lsgpandora@gmail.com` tinha
  -- ZERO sessões reais — uma das 3 contas de PRODUÇÃO. No dia em que ela
  -- publicar, `round(defasagem) = 37` quebra e o vermelho não será um defeito,
  -- será ruído. Como todo bloco termina em `raise` (rollback), o apagamento
  -- não persiste: ele só tira a produção de dentro da prova.
  delete from public.painel_frentes_sessoes where conta = 'lsgpandora@gmail.com';
  delete from public.painel_fila_prompts where conta = 'lsgpandora@gmail.com';
  for i in 1..3 loop
    insert into public.painel_frentes_sessoes
      (sessao_id, conta, titulo, estado, branches, repos, criado_em, atualizado_em, custo_usd, publicado_em)
    values ('sess-T28-' || i, v_conta, 'T28', 'ativa', '{}', '{}',
            (public.painel_dia_operador() - i)::timestamp at time zone 'America/Sao_Paulo' + interval '9 hours',
            (public.painel_dia_operador() - i)::timestamp at time zone 'America/Sao_Paulo' + interval '9 hours',
            case i when 1 then 10 when 2 then 20 else 300 end,
            (public.painel_dia_operador() - i)::timestamp at time zone 'America/Sao_Paulo' + interval '9 hours');
  end loop;

  select h.dias, h.min_usd, h.max_usd, h.mediana_usd
    into v_dias, v_min, v_max, v_mediana
    from public.painel_fila_historico_medido(v_conta) h;

  if v_dias = 3 and v_min = 10 and v_max = 300 and v_mediana = 20 then
    raise exception 'RESULTADO: ok — T28 D32d histórico medido: dias=% min=% max=% mediana=%',
      v_dias, v_min, v_max, v_mediana;
  end if;
  raise exception 'FALHA: T28 D32d esperado dias=3 min=10 max=300 mediana=20; obteve %/%/%/%',
    v_dias, v_min, v_max, v_mediana;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- T29 · MÉDIO 4 + BAIXO 9 — o medido ZERO é ajustável; o medido de verdade não
-- Zero não é medição: é a ausência dela com cara de número (a sessão fechou sem
-- conseguir ler o usage). Sem esta porta o item fica cravado em US$ 0,00 para
-- sempre. E nenhuma recusa volta a escrever "pega" na cara do operador.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_conta text := 'lsgpandora@gmail.com';
  v_zero uuid;
  v_medido uuid;
  v_voando uuid;
  v_segredo text := (select valor from private.lifeboard_config where chave = 'load_secret');
  v_ok jsonb;
  v_erro_medido text := '(nenhum erro)';
  v_erro_estado text := '(nenhum erro)';
  v_custo numeric;
begin
  -- BAIXO 8 (rodada 8): o bloco começa limpando a conta de prova. Até a rodada
  -- 7, T26/T27/T28 só eram determinísticos porque `lsgpandora@gmail.com` tinha
  -- ZERO sessões reais — uma das 3 contas de PRODUÇÃO. No dia em que ela
  -- publicar, `round(defasagem) = 37` quebra e o vermelho não será um defeito,
  -- será ruído. Como todo bloco termina em `raise` (rollback), o apagamento
  -- não persiste: ele só tira a produção de dentro da prova.
  delete from public.painel_frentes_sessoes where conta = 'lsgpandora@gmail.com';
  delete from public.painel_fila_prompts where conta = 'lsgpandora@gmail.com';
  insert into public.painel_fila_prompts (conta, prompt, complexidade, modelo_sugerido)
  values (v_conta, 'T29 medido zero', 'maxima', 'Fable') returning id into v_zero;
  insert into public.painel_fila_prompts (conta, prompt, complexidade, modelo_sugerido)
  values (v_conta, 'T29 medido de verdade', 'maxima', 'Fable') returning id into v_medido;
  insert into public.painel_fila_prompts (conta, prompt, complexidade, modelo_sugerido)
  values (v_conta, 'T29 em execucao', 'maxima', 'Fable') returning id into v_voando;

  update public.painel_fila_prompts
     set estado = 'falhou', worker_id = null, ultimo_worker_id = 'w-T29', tentativas = 3,
         custo_usd = 0, custo_e_estimativa = false, custo_origem = 'medido', concluido_em = now()
   where id = v_zero;
  update public.painel_fila_prompts
     set estado = 'falhou', worker_id = null, ultimo_worker_id = 'w-T29', tentativas = 3,
         custo_usd = 95, custo_e_estimativa = false, custo_origem = 'medido', concluido_em = now()
   where id = v_medido;
  update public.painel_fila_prompts
     set estado = 'pega', worker_id = 'w-T29', ultimo_worker_id = 'w-T29',
         tentativas = 1, pego_em = now(), heartbeat_em = now()
   where id = v_voando;

  v_ok := public.fila_prompts_ajustar_custo(v_segredo, v_zero, 42, null);
  select custo_usd into v_custo from public.painel_fila_prompts where id = v_zero;

  begin
    perform public.fila_prompts_ajustar_custo(v_segredo, v_medido, 42, null);
  exception when others then v_erro_medido := SQLERRM;
  end;

  begin
    perform public.fila_prompts_ajustar_custo(v_segredo, v_voando, 42, null);
  exception when others then v_erro_estado := SQLERRM;
  end;

  if (v_ok->>'ok')::boolean and (v_ok->>'era_medido_zero')::boolean and v_custo = 42
     -- RODADA 8 (MÉDIO 4): a recusa mudou de texto porque mudou de RÉGUA —
     -- ela olha `custo_origem = 'medido'`, não mais `custo_e_estimativa` + o
     -- valor. O veredito do caso continua o mesmo: medido > 0 não se reescreve.
     and v_erro_medido = 'Este custo foi medido pela sessão — não dá para corrigi-lo aqui.'
     and v_erro_estado = 'Só dá para ajustar o custo de item que falhou ou foi cancelado (este está em execução).'
     and v_erro_estado not like '%pega%' then
    raise exception 'RESULTADO: ok — T29 medido zero ajustado para %, medido recusado ("%"), estado em português ("%")',
      v_custo, v_erro_medido, v_erro_estado;
  end if;
  raise exception 'FALHA: T29 — ok=% custo=% erro_medido="%" erro_estado="%"',
    v_ok, v_custo, v_erro_medido, v_erro_estado;
end $$;

-- ═════════════════════════════════════════════════════════════════════════════
-- RODADA 8 — os blocos novos. Cada ALTO e cada MÉDIO desta rodada tem ao menos
-- um bloco que fica VERMELHO quando a correção é desfeita (a tabela de mutações
-- está no relatório da rodada). Todo bloco começa apagando a conta de prova
-- (BAIXO 8) e termina em `raise` — nada persiste, passe ou falhe.
-- ═════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- T30 · D33 (ALTO 1) — O CENÁRIO S1: UM DIA ENCERRADO NÃO É REESCRITO
-- O caminho REAL, medido pelo crítico: o item fecha ONTEM com US$ 80 e ontem
-- lê 80. A sessão vinculada só é publicada HOJE (a última medição da conta em
-- produção tinha 39 h de atraso). Com a régua da rodada 7 — a sessão cobra no
-- dia da PUBLICAÇÃO — ontem virava 0 e os 80 migravam para hoje: um dia
-- encerrado reescrito, e o teto de hoje consumido por trabalho de ontem.
-- Esperado: ontem = 80 ANTES e DEPOIS da publicação; hoje = 0 nas duas vezes.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_conta text := 'lsgpandora@gmail.com';
  v_id uuid;
  v_ontem_antes numeric;
  v_ontem_depois numeric;
  v_hoje numeric;
begin
  delete from public.painel_frentes_sessoes where conta = v_conta;
  delete from public.painel_fila_prompts where conta = v_conta;

  insert into public.painel_fila_prompts (conta, prompt, complexidade, modelo_sugerido)
  values (v_conta, 'T30 fechou ontem, sessao publica hoje', 'maxima', 'Fable') returning id into v_id;

  -- o item fechou ONTEM, ao meio-dia, com o número medido pela filha
  update public.painel_fila_prompts
     set estado = 'concluida', worker_id = 'w-T30', ultimo_worker_id = 'w-T30',
         session_id = 'sess-T30', tentativas = 1,
         custo_usd = 80, custo_e_estimativa = false, custo_origem = 'medido',
         pego_em      = (public.painel_dia_operador() - 1)::timestamp at time zone 'America/Sao_Paulo' + interval '10 hours',
         concluido_em = (public.painel_dia_operador() - 1)::timestamp at time zone 'America/Sao_Paulo' + interval '12 hours'
   where id = v_id;

  v_ontem_antes := public.painel_fila_consumo_do_dia(v_conta, public.painel_dia_operador() - 1);

  -- ... e só AGORA a Routine publica a sessão daquele trabalho (39 h depois)
  insert into public.painel_frentes_sessoes
    (sessao_id, conta, titulo, estado, branches, repos, criado_em, atualizado_em, custo_usd, publicado_em)
  values ('sess-T30', v_conta, 'T30', 'ativa', '{}', '{}', now(), now(), 80, now());

  v_ontem_depois := public.painel_fila_consumo_do_dia(v_conta, public.painel_dia_operador() - 1);
  v_hoje         := public.painel_fila_consumo_do_dia(v_conta, public.painel_dia_operador());

  if v_ontem_antes = 80 and v_ontem_depois = 80 and v_hoje = 0 then
    raise exception 'RESULTADO: ok — T30 D33 ontem continua 80 depois da publicação de hoje: antes=% depois=% hoje=%',
      v_ontem_antes, v_ontem_depois, v_hoje;
  end if;
  raise exception 'FALHA: T30 D33 esperado ontem 80 ANTES e DEPOIS e hoje 0; obteve antes=% depois=% hoje=%',
    v_ontem_antes, v_ontem_depois, v_hoje;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- T31 · D34a (ALTO 2) — SESSÃO DE OUTRA CONTA É RECUSADA NAS TRÊS PORTAS
-- `fila_prompts_heartbeat_interno` (0013) aceitava QUALQUER `p_session_id`, sem
-- validar nada. Vincular a um item da conta B uma sessão da conta A fazia o
-- mesmo trabalho existir nas duas contas. As três portas que vinculam sessão a
-- item — heartbeat, fechar e ajustar_custo — passam a recusar, dizendo de quem
-- é a sessão. Sessão ainda NÃO publicada continua passando (é o caso normal:
-- a filha acabou de nascer).
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_conta   text := 'lsgpandora@gmail.com';
  v_outra   text := 'lucasscudeler@gmail.com';
  v_id      uuid;
  v_id2     uuid;
  v_id3     uuid;
  v_segredo text := (select valor from private.lifeboard_config where chave = 'load_secret');
  v_hb      text := '(nenhum erro)';
  v_fe      text := '(nenhum erro)';
  v_aj      text := '(nenhum erro)';
  v_nova    jsonb;
begin
  delete from public.painel_frentes_sessoes where conta = v_conta;
  delete from public.painel_fila_prompts where conta = v_conta;
  delete from public.painel_frentes_sessoes where sessao_id in ('sess-T31-alheia');

  insert into public.painel_frentes_sessoes
    (sessao_id, conta, titulo, estado, branches, repos, criado_em, atualizado_em, custo_usd, publicado_em)
  values ('sess-T31-alheia', v_outra, 'T31', 'ativa', '{}', '{}', now(), now(), 80, now());

  insert into public.painel_fila_prompts (conta, prompt, complexidade, modelo_sugerido)
  values (v_conta, 'T31 heartbeat', 'baixa', 'Haiku') returning id into v_id;
  insert into public.painel_fila_prompts (conta, prompt, complexidade, modelo_sugerido)
  values (v_conta, 'T31 fechar', 'baixa', 'Haiku') returning id into v_id2;
  insert into public.painel_fila_prompts (conta, prompt, complexidade, modelo_sugerido)
  values (v_conta, 'T31 ajustar', 'baixa', 'Haiku') returning id into v_id3;

  update public.painel_fila_prompts
     set estado = 'pega', worker_id = 'w-T31', ultimo_worker_id = 'w-T31',
         tentativas = 1, pego_em = now(), heartbeat_em = now()
   where id in (v_id, v_id2);
  update public.painel_fila_prompts
     set estado = 'falhou', worker_id = null, ultimo_worker_id = 'w-T31', tentativas = 3,
         custo_usd = 5, custo_e_estimativa = true, custo_origem = 'estimativa',
         concluido_em = now()
   where id = v_id3;

  begin
    perform public.fila_prompts_heartbeat_interno(v_id, v_conta, 'w-T31', 'sess-T31-alheia');
  exception when others then v_hb := SQLERRM;
  end;
  begin
    perform public.fila_prompts_fechar_interno(
      p_id => v_id2, p_conta => v_conta, p_worker_id => 'w-T31',
      p_estado => 'concluida', p_custo_usd => 4, p_session_id => 'sess-T31-alheia');
  exception when others then v_fe := SQLERRM;
  end;
  begin
    perform public.fila_prompts_ajustar_custo(v_segredo, v_id3, 4, 'sess-T31-alheia');
  exception when others then v_aj := SQLERRM;
  end;

  -- E a sessão que AINDA NÃO FOI PUBLICADA (a filha recém-nascida) passa.
  v_nova := public.fila_prompts_heartbeat_interno(v_id, v_conta, 'w-T31', 'sess-T31-propria');

  if v_hb = 'Esta sessão é da conta ' || v_outra || ' — não dá para vinculá-la a um item da conta ' || v_conta || '.'
     and v_fe = v_hb and v_aj = v_hb
     and (v_nova->>'ok')::boolean and v_nova->>'sessionId' = 'sess-T31-propria' then
    raise exception 'RESULTADO: ok — T31 D34a as três portas recusam a sessão alheia e a própria passa: "%"', v_hb;
  end if;
  raise exception 'FALHA: T31 D34a — heartbeat="%" fechar="%" ajustar="%" nova=%', v_hb, v_fe, v_aj, v_nova;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- T32 · D34b (ALTO 2) — A DEDUP CASA POR SESSÃO, SEM OLHAR CONTA
-- `0016:185` (`and s.conta = f.conta`) fazia o item NÃO deduplicar quando a
-- sessão vinculada era de outra conta: a conta A cobrava 80 pela sessão e a
-- conta B cobrava 80 pelo item — 160 por 80 de trabalho real. T31 fecha a
-- porta para frente; ESTE bloco prova que a linha ruim que já existe no banco
-- deixa de cobrar duas vezes.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_conta   text := 'lsgpandora@gmail.com';
  v_outra   text := 'lucasscudeler@gmail.com';
  v_id      uuid;
  v_contrib numeric;
  v_no_b    numeric;
  v_dia     date := public.painel_dia_operador();
begin
  delete from public.painel_frentes_sessoes where conta = v_conta;
  delete from public.painel_fila_prompts where conta = v_conta;
  delete from public.painel_frentes_sessoes where sessao_id = 'sess-T32-alheia';

  insert into public.painel_frentes_sessoes
    (sessao_id, conta, titulo, estado, branches, repos, criado_em, atualizado_em, custo_usd, publicado_em)
  values ('sess-T32-alheia', v_outra, 'T32', 'ativa', '{}', '{}', now(), now(), 80, now());

  -- a linha RUIM: item da conta B apontando para a sessão da conta A
  insert into public.painel_fila_prompts (conta, prompt, complexidade, modelo_sugerido)
  values (v_conta, 'T32 vinculo entre contas', 'maxima', 'Fable') returning id into v_id;
  update public.painel_fila_prompts
     set estado = 'concluida', worker_id = 'w-T32', ultimo_worker_id = 'w-T32',
         session_id = 'sess-T32-alheia', tentativas = 1,
         custo_usd = 80, custo_e_estimativa = false, custo_origem = 'medido',
         pego_em = now() - interval '2 hours', concluido_em = now()
   where id = v_id;

  select d.contribuicao into v_contrib
    from public.painel_fila_itens_do_dia(v_conta, v_dia) d where d.id = v_id;
  v_no_b := public.painel_fila_consumo_do_dia(v_conta, v_dia);

  if v_contrib = 0 and v_no_b = 0 then
    raise exception 'RESULTADO: ok — T32 D34b o item da outra conta contribui 0 (a sessão paga por si): contribuicao=% conta_B=%',
      v_contrib, v_no_b;
  end if;
  raise exception 'FALHA: T32 D34b esperado contribuicao=0 e conta_B=0 (o mesmo trabalho em duas contas); obteve %/%',
    v_contrib, v_no_b;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- T33 · D35 (ALTO 3) — A TRAVA NÃO É DESARMADA POR QUEM NÃO MEDIU NADA
-- `painel_fila_medido_ate` fazia `max(...)` SEM filtrar `custo_usd is not
-- null` — respondia "última LINHA", não "última MEDIÇÃO". 21 das 215 sessões
-- reais são linhas sem custo. Medido: uma sessão sem custo de 5 min atrás
-- mascarava a medição real de 40 h, `defasagem` caía para 0,1 e a trava de
-- D32c AUTORIZAVA gasto novo.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_conta text := 'lsgpandora@gmail.com';
  v_id uuid;
  v_defasagem numeric;
  v_pull jsonb;
begin
  delete from public.painel_frentes_sessoes where conta = v_conta;
  delete from public.painel_fila_prompts where conta = v_conta;

  -- a MEDIÇÃO de verdade: 40 h atrás
  insert into public.painel_frentes_sessoes
    (sessao_id, conta, titulo, estado, branches, repos, criado_em, atualizado_em, custo_usd, publicado_em)
  values ('sess-T33-medida', v_conta, 'T33', 'ativa', '{}', '{}',
          now() - interval '40 hours', now() - interval '40 hours', 12, now() - interval '40 hours');
  -- e a LINHA sem custo, de 5 min atrás — a que mascarava tudo
  insert into public.painel_frentes_sessoes
    (sessao_id, conta, titulo, estado, branches, repos, criado_em, atualizado_em, custo_usd, publicado_em)
  values ('sess-T33-muda', v_conta, 'T33', 'ativa', '{}', '{}',
          now() - interval '5 minutes', now() - interval '5 minutes', null, now() - interval '5 minutes');

  insert into public.painel_fila_prompts (conta, prompt, complexidade, modelo_sugerido)
  values (v_conta, 'T33 item barato', 'baixa', 'Haiku') returning id into v_id;

  v_defasagem := public.painel_fila_defasagem_horas(v_conta);

  update public.painel_teto_diario set exigir_medicao_recente = true where conta = v_conta;
  v_pull := public.fila_prompts_pegar_interno(v_conta, 'w-T33');

  if round(v_defasagem) = 40
     and v_pull->'item' = 'null'::jsonb
     and (v_pull->>'recusado_por_medicao')::boolean then
    raise exception 'RESULTADO: ok — T33 D35 a linha sem custo não conta como medição: defasagem=% recusa="%"',
      v_defasagem, v_pull->>'motivo';
  end if;
  raise exception 'FALHA: T33 D35 esperado defasagem=40 e pull recusado; obteve defasagem=% pull=%',
    v_defasagem, v_pull;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- T34 · MÉDIO 4 — O OPERADOR CORRIGE O PRÓPRIO ERRO DE DIGITAÇÃO
-- Medido: 120 (estimativa) → ajustado para 3 → SEGUNDO ajuste para 30 recusado
-- com "este foi medido", culpando uma sessão que nunca reportou nada. Porta de
-- mão única sobre o número que governa o teto, com uma porta dos fundos
-- acidental: ajustar para exatamente 0 devolvia a possibilidade, porque a
-- guarda olhava o VALOR. Agora ela olha a ORIGEM.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_conta   text := 'lsgpandora@gmail.com';
  v_id      uuid;
  v_medido  uuid;
  v_segredo text := (select valor from private.lifeboard_config where chave = 'load_secret');
  v_um   jsonb;
  v_dois jsonb;
  v_zero jsonb;
  v_tres jsonb;
  v_erro text := '(nenhum erro)';
  v_origem text;
begin
  delete from public.painel_frentes_sessoes where conta = v_conta;
  delete from public.painel_fila_prompts where conta = v_conta;

  insert into public.painel_fila_prompts (conta, prompt, complexidade, modelo_sugerido)
  values (v_conta, 'T34 digitado pelo operador', 'maxima', 'Fable') returning id into v_id;
  insert into public.painel_fila_prompts (conta, prompt, complexidade, modelo_sugerido)
  values (v_conta, 'T34 medido pela sessao', 'maxima', 'Fable') returning id into v_medido;

  update public.painel_fila_prompts
     set estado = 'falhou', worker_id = null, ultimo_worker_id = 'w-T34', tentativas = 3,
         custo_usd = 120, custo_e_estimativa = true, custo_origem = 'estimativa',
         motivo_falha = 'expirou 3 vezes sem fechamento', concluido_em = now()
   where id = v_id;
  update public.painel_fila_prompts
     set estado = 'falhou', worker_id = null, ultimo_worker_id = 'w-T34', tentativas = 3,
         custo_usd = 95, custo_e_estimativa = false, custo_origem = 'medido',
         concluido_em = now()
   where id = v_medido;

  v_um   := public.fila_prompts_ajustar_custo(v_segredo, v_id, 3, null);    -- 120 -> 3
  v_dois := public.fila_prompts_ajustar_custo(v_segredo, v_id, 30, null);   -- 3 -> 30 (era RECUSADO)
  v_zero := public.fila_prompts_ajustar_custo(v_segredo, v_id, 0, null);    -- 30 -> 0
  v_tres := public.fila_prompts_ajustar_custo(v_segredo, v_id, 7, null);    -- 0 -> 7
  select custo_origem into v_origem from public.painel_fila_prompts where id = v_id;

  begin
    perform public.fila_prompts_ajustar_custo(v_segredo, v_medido, 42, null);
  exception when others then v_erro := SQLERRM;
  end;

  if (v_um->>'ok')::boolean
     and (v_dois->>'custo_usd')::numeric = 30
     and (v_dois->>'origem_anterior') = 'operador'
     and (v_zero->>'custo_usd')::numeric = 0
     and (v_tres->>'custo_usd')::numeric = 7
     and v_origem = 'operador'
     and v_erro = 'Este custo foi medido pela sessão — não dá para corrigi-lo aqui.' then
    raise exception 'RESULTADO: ok — T34 MÉDIO 4 o operador corrige quantas vezes precisar (120→3→30→0→7) e o medido continua travado: "%"', v_erro;
  end if;
  raise exception 'FALHA: T34 MÉDIO 4 — um=% dois=% zero=% tres=% origem=% erro="%"',
    v_um, v_dois, v_zero, v_tres, v_origem, v_erro;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- T35 · BAIXO 4 + BAIXO 5 — SEM TETO DECLARADO NÃO SE INVENTA NÚMERO, E
-- `headroom_usd` NUNCA SAI NEGATIVO
-- `0016:368` tinha `if v_teto is null then v_teto := 150; end if;` — um número
-- inventado no meio do caminho do dinheiro, e justamente o número que o
-- operador já tinha trocado por 500. E o ramo de recusa por medição devolvia
-- `headroom_usd` sem clamp, contra a régua de que número negativo não aparece
-- nem na tela nem no relatório.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_conta text := 'lsgpandora@gmail.com';
  v_id uuid;
  v_erro text := '(nenhum erro)';
  v_pull jsonb;
begin
  delete from public.painel_frentes_sessoes where conta = v_conta;
  delete from public.painel_fila_prompts where conta = v_conta;

  -- (a) headroom NEGATIVO no ramo da recusa por medição. O gasto de HOJE vem
  -- de um item fechado hoje (US$ 30); a MEDIÇÃO da conta é de 37 h atrás, que
  -- é o que arma a trava. Teto 10 contra 30 gastos = headroom −20.
  insert into public.painel_frentes_sessoes
    (sessao_id, conta, titulo, estado, branches, repos, criado_em, atualizado_em, custo_usd, publicado_em)
  values ('sess-T35', v_conta, 'T35', 'ativa', '{}', '{}',
          now() - interval '37 hours', now() - interval '37 hours', 0, now() - interval '37 hours');
  insert into public.painel_fila_prompts (conta, prompt, complexidade, modelo_sugerido)
  values (v_conta, 'T35 gasto de hoje', 'baixa', 'Haiku') returning id into v_id;
  update public.painel_fila_prompts
     set estado = 'falhou', worker_id = null, ultimo_worker_id = 'w-T35', tentativas = 3,
         custo_usd = 30, custo_e_estimativa = true, custo_origem = 'estimativa',
         concluido_em = now()
   where id = v_id;
  insert into public.painel_fila_prompts (conta, prompt, complexidade, modelo_sugerido)
  values (v_conta, 'T35 item na fila', 'baixa', 'Haiku');

  update public.painel_teto_diario
     set teto_usd = 10, exigir_medicao_recente = true where conta = v_conta;
  v_pull := public.fila_prompts_pegar_interno(v_conta, 'w-T35-a');

  -- (b) SEM teto declarado: a RPC recusa em vez de inventar 150.
  update public.painel_teto_diario set exigir_medicao_recente = false where conta = v_conta;
  delete from public.painel_fila_prompts where conta = v_conta;
  delete from public.painel_teto_diario where conta = v_conta;
  begin
    perform public.fila_prompts_pegar_interno(v_conta, 'w-T35-b');
  exception when others then v_erro := SQLERRM;
  end;

  if (v_pull->>'recusado_por_medicao')::boolean
     and (v_pull->>'headroom_usd')::numeric = 0
     and v_pull->>'headroom_usd' not like '%-%'
     and v_erro like 'A conta % não tem teto diário declarado no painel%'
     and v_erro not like '%150%' then
    raise exception 'RESULTADO: ok — T35 headroom clampado em % e sem teto a RPC recusa: "%"',
      v_pull->>'headroom_usd', v_erro;
  end if;
  raise exception 'FALHA: T35 — headroom=% erro="%"', v_pull->>'headroom_usd', v_erro;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- T36 · BAIXO 1 — A RECUSA DE FENCING NOMEIA QUEM PEGOU, SEM UUID CRU
-- `0015:636` dizia "Item pertence a outro worker (nenhum): <uuid cru>" — e
-- dizia NINGUÉM justamente no caso em que há um dono conhecido (o item morto
-- guarda `ultimo_worker_id`), cuspindo o id técnico num texto que o operador lê.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_conta text := 'lsgpandora@gmail.com';
  v_id uuid;
  v_erro text := '(nenhum erro)';
begin
  delete from public.painel_frentes_sessoes where conta = v_conta;
  delete from public.painel_fila_prompts where conta = v_conta;

  insert into public.painel_fila_prompts (conta, prompt, complexidade, modelo_sugerido)
  values (v_conta, 'T36 fencing', 'maxima', 'Fable') returning id into v_id;

  -- item morto: sem dono VIVO, mas com dono conhecido em ultimo_worker_id
  update public.painel_fila_prompts
     set estado = 'falhou', worker_id = null, ultimo_worker_id = 'w-T36-dono',
         tentativas = 3, custo_usd = 120, custo_e_estimativa = false, custo_origem = 'medido',
         concluido_em = now()
   where id = v_id;

  begin
    perform public.fila_prompts_fechar_interno(
      p_id => v_id, p_conta => v_conta, p_worker_id => 'w-T36-intruso',
      p_estado => 'falhou', p_custo_usd => 3);
  exception when others then v_erro := SQLERRM;
  end;

  if v_erro = 'Item pertence a outro worker (w-T36-dono).'
     and v_erro not like '%' || v_id::text || '%'
     and v_erro not like '%nenhum%' then
    raise exception 'RESULTADO: ok — T36 BAIXO 1 a recusa nomeia o dono e não cospe UUID: "%"', v_erro;
  end if;
  raise exception 'FALHA: T36 BAIXO 1 — obteve "%"', v_erro;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- T37 · D34a, SEGUNDO CAMINHO — A RECUSA NÃO DEIXA RASTRO
-- T31 prova que as três portas dizem "não". Este prova a consequência que
-- interessa: depois do "não", o VÍNCULO não existe — e é o vínculo que faz o
-- mesmo dinheiro passar a existir em duas contas. Apagar a guarda derruba os
-- dois blocos, por caminhos diferentes (a mensagem × o estado gravado).
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_conta text := 'lsgpandora@gmail.com';
  v_outra text := 'lucasscudeler@gmail.com';
  v_id uuid;
  v_sess_depois text;
  v_estado text;
  v_erro text := '(nenhum erro)';
begin
  delete from public.painel_frentes_sessoes where conta = v_conta;
  delete from public.painel_fila_prompts where conta = v_conta;
  delete from public.painel_frentes_sessoes where sessao_id = 'sess-T37-alheia';

  insert into public.painel_frentes_sessoes
    (sessao_id, conta, titulo, estado, branches, repos, criado_em, atualizado_em, custo_usd, publicado_em)
  values ('sess-T37-alheia', v_outra, 'T37', 'ativa', '{}', '{}', now(), now(), 80, now());

  insert into public.painel_fila_prompts (conta, prompt, complexidade, modelo_sugerido)
  values (v_conta, 'T37 vinculo recusado', 'baixa', 'Haiku') returning id into v_id;
  update public.painel_fila_prompts
     set estado = 'pega', worker_id = 'w-T37', ultimo_worker_id = 'w-T37',
         tentativas = 1, pego_em = now(), heartbeat_em = now()
   where id = v_id;

  begin
    perform public.fila_prompts_heartbeat_interno(v_id, v_conta, 'w-T37', 'sess-T37-alheia');
  exception when others then v_erro := SQLERRM;
  end;

  select session_id, estado into v_sess_depois, v_estado
    from public.painel_fila_prompts where id = v_id;

  if v_erro like 'Esta sessão é da conta %'
     and v_sess_depois is null
     and v_estado = 'pega' then
    raise exception 'RESULTADO: ok — T37 D34a a recusa não cria o vínculo: session_id=% estado=% erro="%"',
      coalesce(v_sess_depois, '(nulo)'), v_estado, v_erro;
  end if;
  raise exception 'FALHA: T37 D34a — session_id=% estado=% erro="%"',
    coalesce(v_sess_depois, '(nulo)'), v_estado, v_erro;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- T38 · D34b, SEGUNDO CAMINHO — A SOMA DAS DUAS CONTAS É 80
-- T32 abre a caixa (a contribuição do item). Este fecha a conta: o TOTAL
-- cobrado pelas DUAS contas por um trabalho de US$ 80,00. Com `and s.conta =
-- f.conta` de volta no lateral, a conta A cobra 80 pela sessão e a conta B
-- cobra 80 pelo item — o 160 que o crítico mediu.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_b text := 'lsgpandora@gmail.com';
  v_a text := 'lucasscudeler@gmail.com';
  v_id uuid;
  v_dia date := public.painel_dia_operador();
  v_na_a numeric;
  v_na_b numeric;
  v_total numeric;
begin
  delete from public.painel_frentes_sessoes where conta in (v_a, v_b);
  delete from public.painel_fila_prompts where conta in (v_a, v_b);

  insert into public.painel_frentes_sessoes
    (sessao_id, conta, titulo, estado, branches, repos, criado_em, atualizado_em, custo_usd, publicado_em)
  values ('sess-T38-alheia', v_a, 'T38', 'ativa', '{}', '{}', now(), now(), 80, now());

  insert into public.painel_fila_prompts (conta, prompt, complexidade, modelo_sugerido)
  values (v_b, 'T38 mesmo trabalho, duas contas', 'maxima', 'Fable') returning id into v_id;
  update public.painel_fila_prompts
     set estado = 'concluida', worker_id = 'w-T38', ultimo_worker_id = 'w-T38',
         session_id = 'sess-T38-alheia', tentativas = 1,
         custo_usd = 80, custo_e_estimativa = false, custo_origem = 'medido',
         pego_em = now() - interval '2 hours', concluido_em = now()
   where id = v_id;

  v_na_a := public.painel_fila_consumo_do_dia(v_a, v_dia);
  v_na_b := public.painel_fila_consumo_do_dia(v_b, v_dia);
  v_total := v_na_a + v_na_b;

  if v_na_a = 80 and v_na_b = 0 and v_total = 80 then
    raise exception 'RESULTADO: ok — T38 D34b US$ 80,00 de trabalho cobram 80 no TOTAL das duas contas: A=% B=% TOTAL=%',
      v_na_a, v_na_b, v_total;
  end if;
  raise exception 'FALHA: T38 D34b esperado A=80 B=0 TOTAL=80 (o mesmo dinheiro em duas contas); obteve A=% B=% TOTAL=%',
    v_na_a, v_na_b, v_total;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- T39 · D35, SEGUNDO CAMINHO — O QUE A TELA RECEBE
-- T33 olha a trava do pull. Este olha a porta que o CARD lê
-- (`fila_prompts_listar` → consumo[].medidoAteEm/defasagemHoras): com uma
-- medição de 40 h e uma linha SEM custo de 5 min, o card tem de receber as
-- 40 h. Sem o filtro de custo, ele recebia 0,1 h e imprimia "medido até há 5
-- min" sobre um saldo de quase dois dias.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_conta text := 'lsgpandora@gmail.com';
  v_medida timestamptz := now() - interval '40 hours';
  v_rpc jsonb;
  v_linha jsonb;
  v_medido_ate timestamptz;
  v_defasagem numeric;
begin
  delete from public.painel_frentes_sessoes where conta = v_conta;
  delete from public.painel_fila_prompts where conta = v_conta;

  insert into public.painel_frentes_sessoes
    (sessao_id, conta, titulo, estado, branches, repos, criado_em, atualizado_em, custo_usd, publicado_em)
  values ('sess-T39-medida', v_conta, 'T39', 'ativa', '{}', '{}', v_medida, v_medida, 12, v_medida);
  insert into public.painel_frentes_sessoes
    (sessao_id, conta, titulo, estado, branches, repos, criado_em, atualizado_em, custo_usd, publicado_em)
  values ('sess-T39-muda', v_conta, 'T39', 'ativa', '{}', '{}',
          now() - interval '5 minutes', now() - interval '5 minutes', null, now() - interval '5 minutes');

  v_rpc := public.fila_prompts_listar(
             (select valor from private.lifeboard_config where chave = 'load_secret'), 1);
  select l into v_linha from jsonb_array_elements(v_rpc->'consumo') as l where l->>'conta' = v_conta;
  v_medido_ate := (v_linha->>'medidoAteEm')::timestamptz;
  v_defasagem  := (v_linha->>'defasagemHoras')::numeric;

  if abs(extract(epoch from (v_medido_ate - v_medida))) < 2
     and round(v_defasagem) = 40 then
    raise exception 'RESULTADO: ok — T39 D35 a tela recebe a MEDIÇÃO (40 h), não a linha muda de 5 min: medidoAteEm=% defasagem=%',
      v_medido_ate, v_defasagem;
  end if;
  raise exception 'FALHA: T39 D35 esperado medidoAteEm = a sessão medida de 40 h e defasagem 40; obteve medidoAteEm=% defasagem=%',
    v_medido_ate, v_defasagem;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- T40 · MÉDIO 3, SEGUNDO CAMINHO — DOIS ITENS, UM PAGO PELA SESSÃO
-- T24 tem 1 item. Este tem 2 — um com sessão vinculada e custo publicado (paga
-- a sessão, contribuição 0) e um sem sessão (paga do próprio bolso). `itens`
-- conta 2 (a fila RODOU dois) e `itens_com_contribuicao` conta 1. Com a régua
-- antiga, `itens` respondia 1 e metade do dia sumia do relatório.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_conta text := 'lsgpandora@gmail.com';
  v_com uuid;
  v_sem uuid;
  v_rpc jsonb;
  v_linha jsonb;
begin
  delete from public.painel_frentes_sessoes where conta = v_conta;
  delete from public.painel_fila_prompts where conta = v_conta;

  insert into public.painel_fila_prompts (conta, prompt, complexidade, modelo_sugerido)
  values (v_conta, 'T40 item com sessao', 'maxima', 'Fable') returning id into v_com;
  insert into public.painel_fila_prompts (conta, prompt, complexidade, modelo_sugerido)
  values (v_conta, 'T40 item sem sessao', 'maxima', 'Fable') returning id into v_sem;

  update public.painel_fila_prompts
     set estado = 'concluida', worker_id = 'w-T40', ultimo_worker_id = 'w-T40',
         session_id = 'sess-T40', tentativas = 1,
         custo_usd = 80, custo_e_estimativa = false, custo_origem = 'medido',
         pego_em = now() - interval '2 hours', concluido_em = now()
   where id = v_com;
  update public.painel_fila_prompts
     set estado = 'falhou', worker_id = null, ultimo_worker_id = 'w-T40', tentativas = 3,
         custo_usd = 20, custo_e_estimativa = true, custo_origem = 'estimativa',
         concluido_em = now()
   where id = v_sem;

  insert into public.painel_frentes_sessoes
    (sessao_id, conta, titulo, estado, branches, repos, criado_em, atualizado_em, custo_usd, publicado_em)
  values ('sess-T40', v_conta, 'T40', 'ativa', '{}', '{}', now(), now(), 80, now());

  v_rpc := public.fila_prompts_consumo_do_dia(
             (select valor from private.lifeboard_config where chave = 'load_secret'),
             public.painel_dia_operador());
  select l into v_linha from jsonb_array_elements(v_rpc->'contas') as l where l->>'conta' = v_conta;

  if (v_linha->>'itens')::int = 2
     and (v_linha->>'itens_com_contribuicao')::int = 1
     and (v_linha->>'consumo_usd')::numeric = 100 then
    raise exception 'RESULTADO: ok — T40 MÉDIO 3 a fila rodou 2 itens e 1 pagou do próprio bolso: linha=%', v_linha;
  end if;
  raise exception 'FALHA: T40 esperado itens=2, itens_com_contribuicao=1, consumo=100; obteve %', v_linha;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- T41 · MÉDIO 4, SEGUNDO CAMINHO — PELO CANCELAR, COM A ORIGEM GRAVADA
-- T34 entra pelo item que MORREU (expiração). Este entra pela outra porta que
-- lança dinheiro da casa — `fila_prompts_cancelar` de um item em execução —, e
-- olha a COLUNA (`custo_origem`), não a mensagem: `estimativa` quando a casa
-- lança, `operador` depois do primeiro ajuste, e o segundo ajuste passa.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_conta text := 'lsgpandora@gmail.com';
  v_id uuid;
  v_segredo text := (select valor from private.lifeboard_config where chave = 'load_secret');
  v_cancel jsonb;
  v_um jsonb;
  v_dois jsonb;
  v_origem_1 text;
  v_origem_2 text;
begin
  delete from public.painel_frentes_sessoes where conta = v_conta;
  delete from public.painel_fila_prompts where conta = v_conta;

  insert into public.painel_fila_prompts (conta, prompt, complexidade, modelo_sugerido)
  values (v_conta, 'T41 cancelado em execucao', 'maxima', 'Fable') returning id into v_id;
  update public.painel_fila_prompts
     set estado = 'pega', worker_id = 'w-T41', ultimo_worker_id = 'w-T41',
         tentativas = 1, pego_em = now() - interval '10 minutes', heartbeat_em = now()
   where id = v_id;

  v_cancel := public.fila_prompts_cancelar(v_segredo, v_id);
  select custo_origem into v_origem_1 from public.painel_fila_prompts where id = v_id;
  v_um   := public.fila_prompts_ajustar_custo(v_segredo, v_id, 9, null);
  select custo_origem into v_origem_2 from public.painel_fila_prompts where id = v_id;
  v_dois := public.fila_prompts_ajustar_custo(v_segredo, v_id, 4, null);

  if (v_cancel->>'custo_lancado_usd')::numeric = 120
     and v_origem_1 = 'estimativa'
     and v_origem_2 = 'operador'
     and (v_um->>'custo_usd')::numeric = 9
     and (v_dois->>'custo_usd')::numeric = 4 then
    raise exception 'RESULTADO: ok — T41 MÉDIO 4 a casa lança (estimativa), o operador corrige duas vezes (9 e 4) e a origem vira operador: %/%',
      v_origem_1, v_origem_2;
  end if;
  raise exception 'FALHA: T41 — cancel=% origem1=% origem2=% um=% dois=%',
    v_cancel, v_origem_1, v_origem_2, v_um, v_dois;
end $$;
