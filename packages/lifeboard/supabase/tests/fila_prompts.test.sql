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
--
-- RODADA 9 · COMO O DINHEIRO ENTRA NUM BLOCO. O caixa virou LIVRO-RAZÃO
-- (`public.painel_caixa_lancamentos`, migration 0019): o consumo de um dia é a
-- soma dos LANÇAMENTOS daquele dia, e nenhuma leitura deriva nada de coluna
-- viva. Logo, um `update painel_fila_prompts set custo_usd = 42` NÃO move mais
-- dinheiro nenhum — e é exatamente esse o ponto. Os blocos passam a semear de
-- duas formas, e só duas:
--   (a) dinheiro de HOJE, pela porta real: `painel_caixa_lancar_item(...)`;
--   (b) dinheiro de um dia PASSADO: `insert into painel_caixa_lancamentos`
--       direto, porque NENHUMA função escreve em dia passado — é isso que
--       torna o ALTO 2 da rodada 8 impossível, e o seed tem de dizer isso em
--       voz alta em vez de fingir que existe uma porta.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- D43 · A BARREIRA DE TESTE, ARMADA PARA A SESSÃO INTEIRA DO psql
-- BAIXO 5 da rodada 8, marcado "perigoso" pelo crítico: a segurança desta
-- suíte dependia de TODO bloco terminar em `raise` — e T38 apaga 194 sessões
-- REAIS de `lucasscudeler@gmail.com` dentro do bloco. Um `raise` esquecido num
-- bloco novo comitava esse apagamento.
-- Esta linha arma, para a sessão inteira (`is_local = false`), os `constraint
-- trigger ... deferrable initially deferred` que a 0019 pôs nas quatro tabelas
-- de dinheiro. Eles disparam NO COMMIT: qualquer transação desta sessão que
-- tenha escrito em `painel_fila_prompts`, `painel_frentes_sessoes`,
-- `painel_teto_diario` ou `painel_caixa_lancamentos` ABORTA ao commitar.
-- Nenhum bloco deste arquivo consegue persistir escrita — nem se esquecer o
-- `raise`. É mecanismo, não disciplina; e não há como um bloco escapar dele,
-- porque quem arma é o ARQUIVO, não o bloco.
-- ─────────────────────────────────────────────────────────────────────────────
select set_config('lifeboard.teste', 'on', false) as barreira_de_teste;

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
  v_teto numeric;
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
  -- (a) o dinheiro de HOJE entra pela porta real do livro-razão.
  perform public.painel_caixa_lancar_item(v_id, 42, 'medido', now(), 'semente T01');

  -- BAIXO 2 (rodada 9): o teto sai de `painel_teto_diario`, não de um `150`
  -- literal. Este bloco usava 150 como CONSTANTE ARITMÉTICA — o número que o
  -- operador trocou por 500 em 14/09 — e por isso continuava verde sobre um
  -- teto que não existe mais em lugar nenhum.
  select teto_usd into v_teto from public.painel_teto_diario where conta = v_conta;
  v_consumo  := public.painel_fila_consumo_hoje(v_conta);
  v_ontem    := public.painel_fila_consumo_do_dia(v_conta, public.painel_dia_operador() - 1);
  v_headroom := v_teto - v_consumo - public.painel_fila_reservado(v_conta);

  if v_consumo = 42 and v_headroom = v_teto - 42 and v_ontem = 0 then
    raise exception 'RESULTADO: ok — T01 D25 virada do dia: teto=% consumo hoje=% headroom=% consumo ontem=%',
      v_teto, v_consumo, v_headroom, v_ontem;
  end if;
  raise exception 'FALHA: T01 D25 virada do dia esperado consumo=42 headroom=teto-42 ontem=0 obteve teto=% consumo=% headroom=% ontem=%',
    v_teto, v_consumo, v_headroom, v_ontem;
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
  v_teto numeric;
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

  -- BAIXO 2 (rodada 9): o teto vem do painel, não do literal 150.
  select teto_usd into v_teto from public.painel_teto_diario where conta = v_conta;
  v_reservado := public.painel_fila_reservado(v_conta);
  v_headroom  := v_teto - public.painel_fila_consumo_hoje(v_conta) - v_reservado;

  if v_reservado = 120 and v_headroom = v_teto - 120 then
    raise exception 'RESULTADO: ok — T02 D25 item em voo reserva o dia corrente: teto=% reservado=% headroom=%',
      v_teto, v_reservado, v_headroom;
  end if;
  raise exception 'FALHA: T02 D25 em voo esperado reservado=120 headroom=teto-120 obteve teto=% reservado=% headroom=%',
    v_teto, v_reservado, v_headroom;
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
  -- (b) dinheiro de um dia PASSADO só entra por insert direto: nenhuma função
  -- do caixa escreve em dia encerrado (é o que mata o ALTO 2 da rodada 8).
  insert into public.painel_caixa_lancamentos
    (dia, conta, valor_usd, origem, entidade_tipo, entidade_id, item_id, medido_em, nota)
  values (public.painel_dia_operador() - 1, v_conta, 42, 'medido', 'item', v_id::text, v_id,
          now() - interval '1 day', 'semente T03: o item fechou ONTEM');

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
  -- a estimativa da casa, lançada no dia da morte (hoje, neste bloco)
  perform public.painel_caixa_lancar_item(v_id, 120, 'estimativa', null, 'semente T04');

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

  perform public.painel_caixa_lancar_item(v_id, 120, 'estimativa', null, 'semente T06');

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
  values (v_conta, 'T07 ajuste com sessao', 'maxima', 'Fable') returning id into v_id;

  update public.painel_fila_prompts
     set estado = 'falhou', worker_id = null, ultimo_worker_id = 'w-T07',
         tentativas = 3, custo_usd = 120, custo_e_estimativa = true,
         pego_em = now() - interval '3 hours', concluido_em = now()
   where id = v_id;

  perform public.painel_caixa_lancar_item(v_id, 120, 'estimativa', null, 'semente T07');

  v_r := public.fila_prompts_ajustar_custo(
           (select valor from private.lifeboard_config where chave = 'load_secret'),
           v_id, 30, 'sess-T07');
  select session_id into v_sess from public.painel_fila_prompts where id = v_id;
  v_consumo := public.painel_fila_consumo_hoje(v_conta);

  -- MÉDIO 4 (rodada 9): o ajuste tinha de MOVER O NÚMERO DO DIA, e não movia.
  -- Aqui ele estorna os 120 da casa e lança os 30 do operador — o consumo do
  -- dia cai junto, que é a coisa inteira.
  if (v_r->>'ok')::boolean and v_sess = 'sess-T07' and (v_r->>'custo_usd')::numeric = 30
     and v_consumo = 30 then
    raise exception 'RESULTADO: ok — T07 D26 ajuste vincula sessão E move o dia: retorno=% session_id=% consumo=%',
      v_r, v_sess, v_consumo;
  end if;
  raise exception 'FALHA: T07 D26 esperado session_id=sess-T07 custo=30 consumo=30, obteve retorno=% session_id=% consumo=%',
    v_r, v_sess, v_consumo;
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
  perform public.painel_caixa_lancar_item(v_id, 120, 'estimativa', null, 'semente T08');

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
  perform public.painel_caixa_lancar_item(v_id, 42, 'medido', now(), 'semente T09');

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
  perform public.painel_caixa_lancar_item(v_id, 42, 'medido', now(), 'semente T10');

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
  insert into public.painel_caixa_lancamentos
    (dia, conta, valor_usd, origem, entidade_tipo, entidade_id, item_id, nota)
  values (public.painel_dia_operador() - 1, v_conta, 120, 'estimativa', 'item', v_id::text, v_id,
          'semente T17: a casa lançou ONTEM');

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
-- MÉDIO 4 (rodada 14): ESTE BLOCO APROVAVA POR AUSÊNCIA. Ele era
-- `if v_vazadas is null then ok`, e `string_agg` de conjunto VAZIO é NULL —
-- ou seja, "nada vazou" e "nada foi medido" davam a mesma resposta. O crítico
-- mediu o par: pôs um vazamento REAL (`grant execute on function
-- fila_prompts_pegar_interno to anon`) e deslocou os padrões de nome com uma
-- renomeação, que é o que qualquer refatoração produz. Saída literal, na mesma
-- execução: `RESULTADO: ok — T19 … nenhuma função interna é executável por
-- anon` ao lado de `FALHA: T73 … [fila_prompts_pegar_interno]`. O T19 afirmou,
-- em voz alta, o oposto do que estava acontecendo. A rodada 13 pôs piso no T73
-- e deixou o gêmeo exatamente como estava.
-- O QUE ENTRA: duas âncoras, porque uma só não cobre as duas formas de o
-- universo sumir.
--   · PISO NUMÉRICO (`v_varridas >= 18`) — contado ANTES do filtro de
--     privilégio: se os padrões de nome pararem de casar com o esquema, o
--     bloco fica vermelho mesmo sem vazamento nenhum;
--   · ÂNCORA NOMINAL — as portas `_interno` do dinheiro têm de estar DENTRO
--     do conjunto varrido, por nome. Renomeá-las para fora dos padrões
--     (`lb_fila_pegar`) baixa o piso E derruba a âncora.
-- MUTAÇÃO QUE DEIXA ESTE BLOCO VERMELHO: dar execute a anon/authenticated em
-- qualquer `_interno` ou `painel_fila_%` · deslocar os padrões de nome ·
-- renomear uma das portas do dinheiro.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_vazadas text;
  v_varridas int;
  v_piso_varridas int := 18;
  -- as portas que NUNCA podem ser chamadas de fora: se uma delas sair do
  -- conjunto varrido, é porque o recorte por nome deixou de valer
  v_ancoras text[] := array[
    'fila_prompts_pegar_interno', 'fila_prompts_fechar_interno',
    'fila_prompts_heartbeat_interno', 'painel_fila_reservado',
    'painel_fila_consumo_hoje'];
  v_faltando text := '';
  v_nome text;
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
  -- O CONJUNTO VARRIDO, contado ANTES de olhar privilégio nenhum:
  select count(*)
    into v_varridas
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.prorettype <> 'trigger'::regtype
     and (p.proname like '%\_interno' or p.proname like 'painel\_fila\_%' or p.proname = 'painel_usd_br');

  foreach v_nome in array v_ancoras loop
    if not exists (
      select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public'
         and p.proname = v_nome
         and p.prorettype <> 'trigger'::regtype
         and (p.proname like '%\_interno' or p.proname like 'painel\_fila\_%' or p.proname = 'painel_usd_br'))
    then
      v_faltando := v_faltando || v_nome || ' ';
    end if;
  end loop;

  select string_agg(p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')', ', ')
    into v_vazadas
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.prorettype <> 'trigger'::regtype
     and (p.proname like '%\_interno' or p.proname like 'painel\_fila\_%' or p.proname = 'painel_usd_br')
     and (has_function_privilege('anon', p.oid, 'execute')
          or has_function_privilege('authenticated', p.oid, 'execute'));

  if v_vazadas is null and v_varridas >= v_piso_varridas and v_faltando = '' then
    raise exception 'RESULTADO: ok — T19 privilégios: % funções internas da fila varridas (piso %), âncoras todas presentes, nenhuma executável por anon/authenticated',
      v_varridas, v_piso_varridas;
  end if;
  raise exception 'FALHA: T19 privilégios — varridas=% (piso %) · âncoras FORA do conjunto varrido: [%] · executáveis por anon/authenticated: %',
    v_varridas, v_piso_varridas, v_faltando, coalesce(v_vazadas, 'nenhuma');
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

  -- a sessão MEDIU ONTEM: o lançamento dela é de ontem (semente (b)) ...
  insert into public.painel_caixa_lancamentos
    (dia, conta, valor_usd, origem, entidade_tipo, entidade_id, item_id, sessao_id, medido_em, nota)
  values (public.painel_dia_operador() - 1, v_conta, 80, 'medido', 'sessao', 'sess-T21', v_id, 'sess-T21',
          (public.painel_dia_operador() - 1)::timestamp at time zone 'America/Sao_Paulo' + interval '12 hours',
          'semente T21: a sessão mediu ONTEM');
  insert into public.painel_frentes_sessoes
    (sessao_id, conta, titulo, estado, branches, repos, criado_em, atualizado_em, custo_usd, publicado_em)
  values ('sess-T21', v_conta, 'T21', 'ativa', '{}', '{}',
          (public.painel_dia_operador() - 1)::timestamp at time zone 'America/Sao_Paulo' + interval '12 hours',
          (public.painel_dia_operador() - 1)::timestamp at time zone 'America/Sao_Paulo' + interval '12 hours',
          80,
          (public.painel_dia_operador() - 1)::timestamp at time zone 'America/Sao_Paulo' + interval '12 hours');
  -- ... e o item, fechando HOJE com o MESMO número, não move nada: uma
  -- entidade, um dinheiro (D39). Antes, era aqui que nascia o 160.
  perform public.painel_caixa_lancar_item(v_id, 80, 'medido', now(), 'T21: o item fecha hoje com o mesmo 80');

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

  -- o item fechou ONTEM às 23h59: o lançamento é de ontem.
  insert into public.painel_caixa_lancamentos
    (dia, conta, valor_usd, origem, entidade_tipo, entidade_id, item_id, sessao_id, medido_em, nota)
  values (public.painel_dia_operador() - 1, v_conta, 80, 'medido', 'sessao', 'sess-T22', v_id, 'sess-T22',
          (public.painel_dia_operador() - 1)::timestamp at time zone 'America/Sao_Paulo' + interval '23 hours 59 minutes',
          'semente T22: o item fechou ONTEM 23h59');
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
  perform public.painel_caixa_lancar_item(v_id, 120, 'estimativa', null, 'semente T23');

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
-- T24 · MÉDIO 3 + ALTO 1, SEGUNDO CAMINHO — A RPC SECRET-GATED, NOS DOIS DIAS
-- T08 olha `painel_fila_consumo_hoje`. Este olha a porta que o operador lê de
-- verdade, `fila_prompts_consumo_do_dia` — e olha DOIS dias, porque é ali que
-- o ALTO 1 aparecia: o item morreu ONTEM às 23h30 lançando US$ 120, ontem foi
-- RELATADO valendo 120, e hoje o último dono voltou com o número real (US$ 80).
-- Com o caixa derivado, ontem virava 0. Com o livro-razão, ontem continua 120
-- para sempre e a correção aparece HOJE, no dia em que ela aconteceu.
--
-- RODADA 13 · D54 · ESTE BLOCO MUDOU DE NÚMERO. Ele exigia `hoje = −40` — o
-- estorno inteiro de 120 mais os 80 novos. Era a própria entrada do CRÍTICO 1:
-- um dia NEGATIVO é teto extra (o crítico mediu headroom 617 num teto de 500 e
-- o despacho de mais um item de 120). Agora o estorno é limitado ao que a
-- entidade pôs em HOJE — que é zero, porque ela lançou ONTEM —, e a
-- contribuição de hoje é 0. Ontem continua 120: a decisão da rodada 9 ("o dia
-- da morte não é reescrito") segue de pé, intacta.
-- E é aqui que `itens` e `itens_com_contribuicao` deixam de ser o mesmo
-- número: hoje o item mexeu no caixa (itens = 1) mas não pagou nada
-- (itens_com_contribuicao = 0).
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_conta text := 'lsgpandora@gmail.com';
  v_id uuid;
  v_rpc_ontem jsonb;
  v_rpc_hoje jsonb;
  v_ontem jsonb;
  v_hoje jsonb;
  v_fechou jsonb;
begin
  delete from public.painel_frentes_sessoes where conta = v_conta;
  delete from public.painel_fila_prompts where conta = v_conta;
  insert into public.painel_fila_prompts (conta, prompt, complexidade, modelo_sugerido)
  values (v_conta, 'T24 morreu ontem, fechou hoje', 'maxima', 'Fable') returning id into v_id;

  update public.painel_fila_prompts
     set estado = 'falhou', worker_id = null, ultimo_worker_id = 'w-T24',
         tentativas = 3, custo_usd = 120, custo_e_estimativa = true, custo_origem = 'estimativa',
         motivo_falha = 'expirou 3 vezes sem fechamento',
         pego_em      = (public.painel_dia_operador() - 1)::timestamp at time zone 'America/Sao_Paulo' + interval '21 hours',
         concluido_em = (public.painel_dia_operador() - 1)::timestamp at time zone 'America/Sao_Paulo' + interval '23 hours 30 minutes'
   where id = v_id;
  insert into public.painel_caixa_lancamentos
    (dia, conta, valor_usd, origem, entidade_tipo, entidade_id, item_id, nota)
  values (public.painel_dia_operador() - 1, v_conta, 120, 'estimativa', 'item', v_id::text, v_id,
          'semente T24: a casa lançou ONTEM, às 23h30');

  -- hoje o último dono volta com o número real — o caminho previsto por T04
  v_fechou := public.fila_prompts_fechar_interno(
                p_id => v_id, p_conta => v_conta, p_worker_id => 'w-T24',
                p_estado => 'falhou', p_custo_usd => 80);

  v_rpc_ontem := public.fila_prompts_consumo_do_dia(
                   (select valor from private.lifeboard_config where chave = 'load_secret'),
                   public.painel_dia_operador() - 1);
  v_rpc_hoje  := public.fila_prompts_consumo_do_dia(
                   (select valor from private.lifeboard_config where chave = 'load_secret'),
                   public.painel_dia_operador());
  select l into v_ontem from jsonb_array_elements(v_rpc_ontem->'contas') as l where l->>'conta' = v_conta;
  select l into v_hoje  from jsonb_array_elements(v_rpc_hoje->'contas')  as l where l->>'conta' = v_conta;

  if (v_fechou->>'reaberto_e_fechado')::boolean
     and (v_ontem->>'consumo_usd')::numeric = 120
     and (v_ontem->>'itens')::int = 1
     and (v_ontem->>'itens_com_contribuicao')::int = 1
     and (v_hoje->>'consumo_usd')::numeric = 0
     and (v_hoje->>'itens')::int = 1
     and (v_hoje->>'itens_com_contribuicao')::int = 0
     and (v_fechou->'caixa'->>'credito_sem_dia')::boolean
     and (v_fechou->'caixa'->>'credito_sem_dia_usd')::numeric = 40 then
    raise exception 'RESULTADO: ok — T24 ontem continua 120 e hoje fica em 0 (o crédito de US$ % ficou sem dia, não virou teto): ontem=% hoje=%',
      v_fechou->'caixa'->>'credito_sem_dia_usd', v_ontem, v_hoje;
  end if;
  raise exception 'FALHA: T24 esperado ontem consumo=120/itens=1/com_contrib=1 e hoje consumo=0/itens=1/com_contrib=0 com credito_sem_dia=40; obteve ontem=% hoje=% fechou=%',
    v_ontem, v_hoje, v_fechou;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- T25 · D31/D41, SEGUNDO CAMINHO — a contribuição ITEM A ITEM, nos dois dias
-- T21/T22 somam o dia. Este abre a caixa: `painel_fila_itens_do_dia` devolve a
-- contribuição de CADA item — e na rodada 9 ela deixou de ser recalculada por
-- `left join lateral` e passou a ser LIDA do livro-razão. O trabalho de US$ 80
-- tem UMA linha, no dia em que foi medido; hoje o item não move nada.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_conta text := 'lsgpandora@gmail.com';
  v_id uuid;
  v_contrib_hoje numeric;
  v_contrib_ontem numeric;
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

  insert into public.painel_caixa_lancamentos
    (dia, conta, valor_usd, origem, entidade_tipo, entidade_id, item_id, sessao_id, medido_em, nota)
  values (public.painel_dia_operador() - 1, v_conta, 80, 'medido', 'sessao', 'sess-T25', v_id, 'sess-T25',
          (public.painel_dia_operador() - 1)::timestamp at time zone 'America/Sao_Paulo' + interval '10 hours',
          'semente T25: a sessão mediu ONTEM');
  insert into public.painel_frentes_sessoes
    (sessao_id, conta, titulo, estado, branches, repos, criado_em, atualizado_em, custo_usd, publicado_em)
  values ('sess-T25', v_conta, 'T25', 'ativa', '{}', '{}',
          (public.painel_dia_operador() - 1)::timestamp at time zone 'America/Sao_Paulo' + interval '10 hours',
          (public.painel_dia_operador() - 1)::timestamp at time zone 'America/Sao_Paulo' + interval '10 hours',
          80,
          (public.painel_dia_operador() - 1)::timestamp at time zone 'America/Sao_Paulo' + interval '10 hours');

  perform public.painel_caixa_lancar_item(v_id, 80, 'medido', now(), 'T25: o item fecha hoje com o mesmo 80');

  select coalesce(sum(d.contribuicao), 0) into v_contrib_hoje
    from public.painel_fila_itens_do_dia(v_conta, public.painel_dia_operador()) d
   where d.id = v_id;
  select coalesce(sum(d.contribuicao), 0)::numeric into v_contrib_ontem
    from public.painel_fila_itens_do_dia(v_conta, public.painel_dia_operador() - 1) d
   where d.id = v_id;
  select count(*)::int into v_linhas_ontem
    from public.painel_fila_itens_do_dia(v_conta, public.painel_dia_operador() - 1) d;
  v_total := public.painel_fila_consumo_do_dia(v_conta, public.painel_dia_operador())
           + public.painel_fila_consumo_do_dia(v_conta, public.painel_dia_operador() - 1);

  if v_contrib_hoje = 0 and v_linhas_ontem = 1 and v_contrib_ontem = 80 and v_total = 80 then
    raise exception 'RESULTADO: ok — T25 D41 o trabalho tem UMA linha, no dia em que foi medido: hoje=% ontem=% (linhas=%) TOTAL=%',
      v_contrib_hoje, v_contrib_ontem, v_linhas_ontem, v_total;
  end if;
  raise exception 'FALHA: T25 D41 esperado hoje=0 ontem=80 linhas_ontem=1 TOTAL=80; obteve %/%/%/%',
    v_contrib_hoje, v_contrib_ontem, v_linhas_ontem, v_total;
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
  -- D40 (rodada 9): o custo aqui É 12, não 0. Zero deixou de ser medição em
  -- qualquer lugar do sistema — uma sessão de custo zero não lança e não tem
  -- como armar nem desarmar a trava. Este bloco quer uma MEDIÇÃO VELHA, e uma
  -- medição velha tem valor.
  values ('sess-T27', v_conta, 'T27', 'ativa', '{}', '{}',
          now() - interval '37 hours', now() - interval '37 hours', 12, now() - interval '37 hours');

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
  -- D41 (rodada 9): o histórico passou a ler o LIVRO-RAZÃO — a mesma fonte de
  -- `painel_fila_consumo_do_dia`. Era aqui o MÉDIO 3 desta rodada: o histórico
  -- lia só `painel_frentes_sessoes` e um dia de US$ 120 vindo de ITEM não
  -- existia para a régua com que o operador escolhe o teto. Semear pelo livro
  -- é semear pela única definição que existe agora.
  for i in 1..3 loop
    insert into public.painel_caixa_lancamentos
      (dia, conta, valor_usd, origem, entidade_tipo, entidade_id, sessao_id, medido_em, nota)
    values ((public.painel_dia_operador() - i), v_conta,
            case i when 1 then 10 when 2 then 20 else 300 end,
            'medido', 'sessao', 'sess-T28-' || i, 'sess-T28-' || i,
            (public.painel_dia_operador() - i)::timestamp at time zone 'America/Sao_Paulo' + interval '9 hours',
            'semente T28');
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

  perform public.painel_caixa_lancar_item(v_medido, 95, 'medido', now(), 'semente T29');

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

  if (v_ok->>'ok')::boolean and (v_ok->>'era_medido_zero')::boolean
     and (v_ok->>'origem_anterior') = 'medido'
     and (v_ok->>'consumo_do_dia_usd')::numeric = 95 + 42
     and v_custo = 42
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
  insert into public.painel_caixa_lancamentos
    (dia, conta, valor_usd, origem, entidade_tipo, entidade_id, item_id, sessao_id, medido_em, nota)
  values (public.painel_dia_operador() - 1, v_conta, 80, 'medido', 'sessao', 'sess-T30', v_id, 'sess-T30',
          (public.painel_dia_operador() - 1)::timestamp at time zone 'America/Sao_Paulo' + interval '12 hours',
          'semente T30: o item fechou ONTEM ao meio-dia');

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
--
-- VARREDURA DE GENERALIZAÇÃO (rodada 14) · PISO. O veredito era
-- `v_contrib = 0 and v_no_b = 0`, duas ausências e nenhum fato positivo: se
-- `painel_fila_itens_do_dia` devolvesse conjunto VAZIO, `coalesce(sum, 0)`
-- daria 0, o consumo daria 0 e o bloco aprovaria sem ter medido o item que ele
-- semeia. É a mesma forma do MÉDIO 7 (T59/T55). Entra o piso: o item tem de
-- APARECER no relatório do dia e a conta A tem de estar cobrando os 80 — só
-- então "a conta B contribui 0" significa dedup, e não silêncio.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_conta   text := 'lsgpandora@gmail.com';
  v_outra   text := 'lucasscudeler@gmail.com';
  v_id      uuid;
  v_contrib numeric;
  v_no_b    numeric;
  v_linhas  integer;
  v_na_a    numeric;
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

  -- o item da conta B fecha com o MESMO 80 que a sessão da conta A já lançou:
  -- uma entidade, um dinheiro. Nada de novo entra.
  perform public.painel_caixa_lancar_item(v_id, 80, 'medido', now(), 'T32: o item da conta B fecha com 80');

  select coalesce(sum(d.contribuicao), 0) into v_contrib
    from public.painel_fila_itens_do_dia(v_conta, v_dia) d where d.id = v_id;
  v_no_b := public.painel_fila_consumo_do_dia(v_conta, v_dia);
  v_na_a := public.painel_fila_consumo_do_dia(v_outra, v_dia);

  -- o PISO, antes do veredito: a linha ruim EXISTE (item da conta B, fechado
  -- com 80, apontando para a sessão da conta A) e a conta A está cobrando os
  -- 80 de verdade. Medido: o item dedupado SAI do relatório do dia da conta B
  -- — é essa a dedup —, então o piso não pode ser "aparece no relatório"; é a
  -- semente e o lado que PAGA. Sem os dois, `contribuicao = 0` e
  -- `conta_B = 0` são duas ausências e o bloco aprovaria sem ter reproduzido
  -- nada (a mesma forma do MÉDIO 7, T59/T55).
  select count(*) into v_linhas
    from public.painel_fila_prompts
   where id = v_id and custo_usd = 80 and session_id = 'sess-T32-alheia'
     and estado = 'concluida';
  if v_linhas <> 1 then
    raise exception 'FALHA: T32 D34b a linha ruim não foi semeada (% item(ns) da conta B fechado com 80 e vinculado a sess-T32-alheia) — sem ela, "contribuição 0" é silêncio, não dedup',
      v_linhas;
  end if;
  if v_na_a <> 80 then
    raise exception 'FALHA: T32 D34b a conta A não está cobrando os 80 da sessão (obteve %) — o trabalho tem de estar cobrado UMA vez, não ZERO vezes',
      v_na_a;
  end if;

  if v_contrib = 0 and v_no_b = 0 then
    raise exception 'RESULTADO: ok — T32 D34b a linha ruim existe (item da conta B com 80 na sessão alheia), a conta A cobra os US$ % e a conta B contribui 0 (a sessão paga por si): contribuicao=% conta_B=%',
      v_na_a, v_contrib, v_no_b;
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

  perform public.painel_caixa_lancar_item(v_id, 120, 'estimativa', null, 'semente T34');
  perform public.painel_caixa_lancar_item(v_medido, 95, 'medido', now(), 'semente T34 medido');

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
     -- MÉDIO 4 (rodada 9): cada correção MOVE o número do dia. 120 → 3 → 30 →
     -- 0 → 7, e o dia termina em 7 + os 95 do item medido ao lado.
     and (v_tres->>'consumo_do_dia_usd')::numeric = 7 + 95
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
  perform public.painel_caixa_lancar_item(v_id, 30, 'estimativa', null, 'semente T35');
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
  v_base_a numeric;
  v_base_b numeric;
begin
  delete from public.painel_frentes_sessoes where conta in (v_a, v_b);
  delete from public.painel_fila_prompts where conta in (v_a, v_b);

  -- RODADA 9: o livro-razão é IMUTÁVEL — os `delete` acima não apagam
  -- lançamento nenhum, e a conta A é uma conta de PRODUÇÃO com 194 deles. A
  -- medida passa a ser um DELTA sobre a linha de base, que é o único jeito
  -- honesto de medir dentro de um livro que não se apaga.
  v_base_a := public.painel_fila_consumo_do_dia(v_a, v_dia);
  v_base_b := public.painel_fila_consumo_do_dia(v_b, v_dia);

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

  perform public.painel_caixa_lancar_item(v_id, 80, 'medido', now(), 'T38: o item da conta B fecha com 80');

  v_na_a := public.painel_fila_consumo_do_dia(v_a, v_dia) - v_base_a;
  v_na_b := public.painel_fila_consumo_do_dia(v_b, v_dia) - v_base_b;
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
-- T40 · MÉDIO 3, TERCEIRO CAMINHO — `itens` × `itens_com_contribuicao` COM DOIS
-- ITENS NO MESMO DIA. T24 tem 1 item e olha dois dias; este tem 2 itens num dia
-- só. O item A fechou com sessão vinculada e o dinheiro dele ficou (80). O item
-- B morreu com estimativa de 20 e o OPERADOR corrigiu para 0 — ele mexeu no
-- caixa duas vezes (+20 e −20) e terminou o dia pagando nada. `itens` conta 2
-- (os dois moveram o caixa hoje) e `itens_com_contribuicao` conta 1 (só o A
-- terminou o dia no positivo). A mutação que faz `itens` contar só
-- `contribuicao > 0` responde 1 aqui e derruba o bloco.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_conta text := 'lsgpandora@gmail.com';
  v_a uuid;
  v_b uuid;
  v_rpc jsonb;
  v_linha jsonb;
  v_segredo text := (select valor from private.lifeboard_config where chave = 'load_secret');
begin
  delete from public.painel_frentes_sessoes where conta = v_conta;
  delete from public.painel_fila_prompts where conta = v_conta;

  insert into public.painel_fila_prompts (conta, prompt, complexidade, modelo_sugerido)
  values (v_conta, 'T40 item com sessao', 'maxima', 'Fable') returning id into v_a;
  insert into public.painel_fila_prompts (conta, prompt, complexidade, modelo_sugerido)
  values (v_conta, 'T40 item corrigido para zero', 'maxima', 'Fable') returning id into v_b;

  update public.painel_fila_prompts
     set estado = 'concluida', worker_id = 'w-T40', ultimo_worker_id = 'w-T40',
         session_id = 'sess-T40', tentativas = 1,
         custo_usd = 80, custo_e_estimativa = false, custo_origem = 'medido',
         pego_em = now() - interval '2 hours', concluido_em = now()
   where id = v_a;
  perform public.painel_caixa_lancar_item(v_a, 80, 'medido', now(), 'semente T40 A');

  update public.painel_fila_prompts
     set estado = 'falhou', worker_id = null, ultimo_worker_id = 'w-T40', tentativas = 3,
         custo_usd = 20, custo_e_estimativa = true, custo_origem = 'estimativa',
         concluido_em = now()
   where id = v_b;
  perform public.painel_caixa_lancar_item(v_b, 20, 'estimativa', null, 'semente T40 B');
  -- o operador diz que aquele item não gastou nada: estorno de 20, nada novo.
  perform public.fila_prompts_ajustar_custo(v_segredo, v_b, 0, null);

  insert into public.painel_frentes_sessoes
    (sessao_id, conta, titulo, estado, branches, repos, criado_em, atualizado_em, custo_usd, publicado_em)
  values ('sess-T40', v_conta, 'T40', 'ativa', '{}', '{}', now(), now(), 80, now());

  v_rpc := public.fila_prompts_consumo_do_dia(v_segredo, public.painel_dia_operador());
  select l into v_linha from jsonb_array_elements(v_rpc->'contas') as l where l->>'conta' = v_conta;

  if (v_linha->>'itens')::int = 2
     and (v_linha->>'itens_com_contribuicao')::int = 1
     and (v_linha->>'consumo_usd')::numeric = 80 then
    raise exception 'RESULTADO: ok — T40 MÉDIO 3 dois itens mexeram no caixa e um pagou: linha=%', v_linha;
  end if;
  raise exception 'FALHA: T40 esperado itens=2, itens_com_contribuicao=1, consumo=80; obteve %', v_linha;
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
     and (v_dois->>'consumo_do_dia_usd')::numeric = 4
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

-- ═════════════════════════════════════════════════════════════════════════════
-- RODADA 9 — O LIVRO-RAZÃO. Os blocos abaixo guardam as regiões do caixa que
-- a rodada 8 deixou sem guarda nenhuma: as quatro mutações que passavam limpas
-- (M14, M19, M21, M23) ficam VERMELHAS aqui, uma a uma, e cada ALTO ganha o
-- bloco que mede o número novo pelo caminho real.
-- ═════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- T42 · MÉDIO 1 — PARIDADE DO CHOOSER: o SQL escolhe a MESMA conta que o TS
-- O laço de `fila_prompts_enfileirar` se autodeclarava "ESPELHO DECLARADO de
-- escolherConta" e divergia em dois pontos medidos pelo crítico: não filtrava
-- `exigir_medicao_recente` (e o `<select name="conta">` manda "" no modo
-- automático, logo QUEM DECIDE É O SQL) e testava "nunca cabe" contra o MAIOR
-- teto em vez do teto de cada conta. O teste que deveria pegar isso conferia o
-- número 12.
-- A tabela de casos abaixo é a FONTE ÚNICA da paridade:
-- `tests/unit/prompts-paridade-chooser.test.ts` lê ESTE literal do disco e roda
-- `escolherConta()` sobre os MESMOS casos. Mexer em um dos lados — ou na
-- própria tabela — pinta o outro de vermelho.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  -- PARIDADE-CHOOSER-CASOS · fonte única (lida também pelo vitest)
  v_casos jsonb := $casos$[
    {
      "nome": "maior espaco livre ganha",
      "complexidade": "alta", "estimado_usd": 50,
      "contas": [
        {"conta":"lucasscudeler@gmail.com","teto_usd":500,"medido_usd":400,"em_execucao_usd":0,"na_fila_usd":0,"defasagem_horas":1,"exige_medicao_recente":false},
        {"conta":"lsgpandora@gmail.com","teto_usd":500,"medido_usd":100,"em_execucao_usd":0,"na_fila_usd":0,"defasagem_horas":1,"exige_medicao_recente":false},
        {"conta":"almapetra.ltda@gmail.com","teto_usd":500,"medido_usd":300,"em_execucao_usd":0,"na_fila_usd":0,"defasagem_horas":1,"exige_medicao_recente":false},
        {"conta":"arborcactus@gmail.com","teto_usd":500,"medido_usd":500,"em_execucao_usd":0,"na_fila_usd":0,"defasagem_horas":null,"exige_medicao_recente":true}
      ],
      "esperado": {"conta":"lsgpandora@gmail.com","cabe_hoje":true,"todas_recusadas":false,"nunca_cabe":false,"espaco_livre_usd":400}
    },
    {
      "nome": "empate cai na ordem da casa",
      "complexidade": "alta", "estimado_usd": 50,
      "contas": [
        {"conta":"lucasscudeler@gmail.com","teto_usd":500,"medido_usd":100,"em_execucao_usd":0,"na_fila_usd":0,"defasagem_horas":1,"exige_medicao_recente":false},
        {"conta":"lsgpandora@gmail.com","teto_usd":500,"medido_usd":100,"em_execucao_usd":0,"na_fila_usd":0,"defasagem_horas":1,"exige_medicao_recente":false},
        {"conta":"almapetra.ltda@gmail.com","teto_usd":500,"medido_usd":300,"em_execucao_usd":0,"na_fila_usd":0,"defasagem_horas":1,"exige_medicao_recente":false},
        {"conta":"arborcactus@gmail.com","teto_usd":500,"medido_usd":500,"em_execucao_usd":0,"na_fila_usd":0,"defasagem_horas":null,"exige_medicao_recente":true}
      ],
      "esperado": {"conta":"lucasscudeler@gmail.com","cabe_hoje":true,"todas_recusadas":false,"nunca_cabe":false,"espaco_livre_usd":400}
    },
    {
      "nome": "a fila parada desconta antes de escolher",
      "complexidade": "alta", "estimado_usd": 50,
      "contas": [
        {"conta":"lucasscudeler@gmail.com","teto_usd":500,"medido_usd":100,"em_execucao_usd":0,"na_fila_usd":390,"defasagem_horas":1,"exige_medicao_recente":false},
        {"conta":"lsgpandora@gmail.com","teto_usd":500,"medido_usd":300,"em_execucao_usd":0,"na_fila_usd":0,"defasagem_horas":1,"exige_medicao_recente":false},
        {"conta":"almapetra.ltda@gmail.com","teto_usd":500,"medido_usd":490,"em_execucao_usd":0,"na_fila_usd":0,"defasagem_horas":1,"exige_medicao_recente":false},
        {"conta":"arborcactus@gmail.com","teto_usd":500,"medido_usd":500,"em_execucao_usd":0,"na_fila_usd":0,"defasagem_horas":null,"exige_medicao_recente":true}
      ],
      "esperado": {"conta":"lsgpandora@gmail.com","cabe_hoje":true,"todas_recusadas":false,"nunca_cabe":false,"espaco_livre_usd":200}
    },
    {
      "nome": "MEDIO 1: conta que exige medicao e nunca mediu sai da disputa",
      "complexidade": "alta", "estimado_usd": 50,
      "contas": [
        {"conta":"lucasscudeler@gmail.com","teto_usd":500,"medido_usd":400,"em_execucao_usd":0,"na_fila_usd":0,"defasagem_horas":1,"exige_medicao_recente":false},
        {"conta":"lsgpandora@gmail.com","teto_usd":500,"medido_usd":0,"em_execucao_usd":0,"na_fila_usd":0,"defasagem_horas":null,"exige_medicao_recente":true},
        {"conta":"almapetra.ltda@gmail.com","teto_usd":500,"medido_usd":300,"em_execucao_usd":0,"na_fila_usd":0,"defasagem_horas":2,"exige_medicao_recente":false},
        {"conta":"arborcactus@gmail.com","teto_usd":500,"medido_usd":500,"em_execucao_usd":0,"na_fila_usd":0,"defasagem_horas":null,"exige_medicao_recente":true}
      ],
      "esperado": {"conta":"almapetra.ltda@gmail.com","cabe_hoje":true,"todas_recusadas":false,"nunca_cabe":false,"espaco_livre_usd":200}
    },
    {
      "nome": "medicao velha com a trava ligada tambem sai",
      "complexidade": "alta", "estimado_usd": 50,
      "contas": [
        {"conta":"lucasscudeler@gmail.com","teto_usd":500,"medido_usd":0,"em_execucao_usd":0,"na_fila_usd":0,"defasagem_horas":37,"exige_medicao_recente":true},
        {"conta":"lsgpandora@gmail.com","teto_usd":500,"medido_usd":400,"em_execucao_usd":0,"na_fila_usd":0,"defasagem_horas":1,"exige_medicao_recente":false},
        {"conta":"almapetra.ltda@gmail.com","teto_usd":500,"medido_usd":450,"em_execucao_usd":0,"na_fila_usd":0,"defasagem_horas":1,"exige_medicao_recente":false},
        {"conta":"arborcactus@gmail.com","teto_usd":500,"medido_usd":500,"em_execucao_usd":0,"na_fila_usd":0,"defasagem_horas":null,"exige_medicao_recente":true}
      ],
      "esperado": {"conta":"lsgpandora@gmail.com","cabe_hoje":true,"todas_recusadas":false,"nunca_cabe":false,"espaco_livre_usd":100}
    },
    {
      "nome": "medicao recente com a trava ligada continua na disputa",
      "complexidade": "alta", "estimado_usd": 50,
      "contas": [
        {"conta":"lucasscudeler@gmail.com","teto_usd":500,"medido_usd":0,"em_execucao_usd":0,"na_fila_usd":0,"defasagem_horas":3,"exige_medicao_recente":true},
        {"conta":"lsgpandora@gmail.com","teto_usd":500,"medido_usd":400,"em_execucao_usd":0,"na_fila_usd":0,"defasagem_horas":1,"exige_medicao_recente":false},
        {"conta":"almapetra.ltda@gmail.com","teto_usd":500,"medido_usd":450,"em_execucao_usd":0,"na_fila_usd":0,"defasagem_horas":1,"exige_medicao_recente":false},
        {"conta":"arborcactus@gmail.com","teto_usd":500,"medido_usd":500,"em_execucao_usd":0,"na_fila_usd":0,"defasagem_horas":null,"exige_medicao_recente":true}
      ],
      "esperado": {"conta":"lucasscudeler@gmail.com","cabe_hoje":true,"todas_recusadas":false,"nunca_cabe":false,"espaco_livre_usd":500}
    },
    {
      "nome": "todas recusadas: escolhe a mais folgada e NAO cabe hoje",
      "complexidade": "alta", "estimado_usd": 50,
      "contas": [
        {"conta":"lucasscudeler@gmail.com","teto_usd":500,"medido_usd":400,"em_execucao_usd":0,"na_fila_usd":0,"defasagem_horas":37,"exige_medicao_recente":true},
        {"conta":"lsgpandora@gmail.com","teto_usd":500,"medido_usd":100,"em_execucao_usd":0,"na_fila_usd":0,"defasagem_horas":null,"exige_medicao_recente":true},
        {"conta":"almapetra.ltda@gmail.com","teto_usd":500,"medido_usd":300,"em_execucao_usd":0,"na_fila_usd":0,"defasagem_horas":40,"exige_medicao_recente":true},
        {"conta":"arborcactus@gmail.com","teto_usd":500,"medido_usd":500,"em_execucao_usd":0,"na_fila_usd":0,"defasagem_horas":null,"exige_medicao_recente":true}
      ],
      "esperado": {"conta":"lsgpandora@gmail.com","cabe_hoje":false,"todas_recusadas":true,"nunca_cabe":false,"espaco_livre_usd":400}
    },
    {
      "nome": "BAIXO 4: conta cujo TETO nao comporta o item sai da disputa",
      "complexidade": "alta", "estimado_usd": 50,
      "contas": [
        {"conta":"lucasscudeler@gmail.com","teto_usd":30,"medido_usd":0,"em_execucao_usd":0,"na_fila_usd":0,"defasagem_horas":1,"exige_medicao_recente":false},
        {"conta":"lsgpandora@gmail.com","teto_usd":500,"medido_usd":480,"em_execucao_usd":0,"na_fila_usd":0,"defasagem_horas":1,"exige_medicao_recente":false},
        {"conta":"almapetra.ltda@gmail.com","teto_usd":500,"medido_usd":490,"em_execucao_usd":0,"na_fila_usd":0,"defasagem_horas":1,"exige_medicao_recente":false},
        {"conta":"arborcactus@gmail.com","teto_usd":500,"medido_usd":500,"em_execucao_usd":0,"na_fila_usd":0,"defasagem_horas":null,"exige_medicao_recente":true}
      ],
      "esperado": {"conta":"lsgpandora@gmail.com","cabe_hoje":false,"todas_recusadas":false,"nunca_cabe":false,"espaco_livre_usd":20}
    },
    {
      "nome": "nunca cabe: nenhum teto comporta o item",
      "complexidade": "alta", "estimado_usd": 50,
      "contas": [
        {"conta":"lucasscudeler@gmail.com","teto_usd":30,"medido_usd":0,"em_execucao_usd":0,"na_fila_usd":0,"defasagem_horas":1,"exige_medicao_recente":false},
        {"conta":"lsgpandora@gmail.com","teto_usd":40,"medido_usd":0,"em_execucao_usd":0,"na_fila_usd":0,"defasagem_horas":1,"exige_medicao_recente":false},
        {"conta":"almapetra.ltda@gmail.com","teto_usd":10,"medido_usd":0,"em_execucao_usd":0,"na_fila_usd":0,"defasagem_horas":1,"exige_medicao_recente":false},
        {"conta":"arborcactus@gmail.com","teto_usd":20,"medido_usd":0,"em_execucao_usd":0,"na_fila_usd":0,"defasagem_horas":null,"exige_medicao_recente":true}
      ],
      "esperado": {"conta":null,"cabe_hoje":false,"todas_recusadas":false,"nunca_cabe":true,"espaco_livre_usd":0}
    },
    {
      "nome": "nao cabe hoje, mas escolhe a mais folgada (o item entra na fila)",
      "complexidade": "maxima", "estimado_usd": 120,
      "contas": [
        {"conta":"lucasscudeler@gmail.com","teto_usd":500,"medido_usd":490,"em_execucao_usd":0,"na_fila_usd":0,"defasagem_horas":1,"exige_medicao_recente":false},
        {"conta":"lsgpandora@gmail.com","teto_usd":500,"medido_usd":495,"em_execucao_usd":0,"na_fila_usd":0,"defasagem_horas":1,"exige_medicao_recente":false},
        {"conta":"almapetra.ltda@gmail.com","teto_usd":500,"medido_usd":499,"em_execucao_usd":0,"na_fila_usd":0,"defasagem_horas":1,"exige_medicao_recente":false},
        {"conta":"arborcactus@gmail.com","teto_usd":500,"medido_usd":500,"em_execucao_usd":0,"na_fila_usd":0,"defasagem_horas":null,"exige_medicao_recente":true}
      ],
      "esperado": {"conta":"lucasscudeler@gmail.com","cabe_hoje":false,"todas_recusadas":false,"nunca_cabe":false,"espaco_livre_usd":10}
    },
    {
      "nome": "MEDIO 3: a quarta conta (arborcactus) esta na disputa e pode ganhar",
      "complexidade": "alta", "estimado_usd": 50,
      "contas": [
        {"conta":"lucasscudeler@gmail.com","teto_usd":500,"medido_usd":400,"em_execucao_usd":0,"na_fila_usd":0,"defasagem_horas":1,"exige_medicao_recente":false},
        {"conta":"lsgpandora@gmail.com","teto_usd":500,"medido_usd":300,"em_execucao_usd":0,"na_fila_usd":0,"defasagem_horas":1,"exige_medicao_recente":false},
        {"conta":"almapetra.ltda@gmail.com","teto_usd":500,"medido_usd":200,"em_execucao_usd":0,"na_fila_usd":0,"defasagem_horas":1,"exige_medicao_recente":false},
        {"conta":"arborcactus@gmail.com","teto_usd":500,"medido_usd":100,"em_execucao_usd":0,"na_fila_usd":0,"defasagem_horas":1,"exige_medicao_recente":false}
      ],
      "esperado": {"conta":"arborcactus@gmail.com","cabe_hoje":true,"todas_recusadas":false,"nunca_cabe":false,"espaco_livre_usd":400}
    },
    {
      "nome": "LIMITE DE VOO: a mais folgada esta no limite de sessoes, a proxima com vaga ganha",
      "complexidade": "alta", "estimado_usd": 50,
      "contas": [
        {"conta":"lucasscudeler@gmail.com","teto_usd":500,"medido_usd":0,"em_execucao_usd":20,"na_fila_usd":0,"defasagem_horas":1,"exige_medicao_recente":false,"em_voo":4,"limite_em_voo":4},
        {"conta":"lsgpandora@gmail.com","teto_usd":500,"medido_usd":300,"em_execucao_usd":0,"na_fila_usd":0,"defasagem_horas":1,"exige_medicao_recente":false,"em_voo":1,"limite_em_voo":4},
        {"conta":"almapetra.ltda@gmail.com","teto_usd":500,"medido_usd":400,"em_execucao_usd":0,"na_fila_usd":0,"defasagem_horas":1,"exige_medicao_recente":false,"em_voo":0,"limite_em_voo":4},
        {"conta":"arborcactus@gmail.com","teto_usd":500,"medido_usd":450,"em_execucao_usd":0,"na_fila_usd":0,"defasagem_horas":1,"exige_medicao_recente":false,"em_voo":0,"limite_em_voo":4}
      ],
      "esperado": {"conta":"lsgpandora@gmail.com","cabe_hoje":true,"todas_recusadas":false,"nunca_cabe":false,"espaco_livre_usd":200,"todas_sem_vaga":false}
    },
    {
      "nome": "LIMITE DE VOO: todas no limite, a disputa volta a ser entre todas e diz isso",
      "complexidade": "alta", "estimado_usd": 50,
      "contas": [
        {"conta":"lucasscudeler@gmail.com","teto_usd":500,"medido_usd":0,"em_execucao_usd":20,"na_fila_usd":0,"defasagem_horas":1,"exige_medicao_recente":false,"em_voo":4,"limite_em_voo":4},
        {"conta":"lsgpandora@gmail.com","teto_usd":500,"medido_usd":300,"em_execucao_usd":20,"na_fila_usd":0,"defasagem_horas":1,"exige_medicao_recente":false,"em_voo":4,"limite_em_voo":4},
        {"conta":"almapetra.ltda@gmail.com","teto_usd":500,"medido_usd":400,"em_execucao_usd":20,"na_fila_usd":0,"defasagem_horas":1,"exige_medicao_recente":false,"em_voo":4,"limite_em_voo":4},
        {"conta":"arborcactus@gmail.com","teto_usd":500,"medido_usd":450,"em_execucao_usd":20,"na_fila_usd":0,"defasagem_horas":1,"exige_medicao_recente":false,"em_voo":4,"limite_em_voo":4}
      ],
      "esperado": {"conta":"lucasscudeler@gmail.com","cabe_hoje":true,"todas_recusadas":false,"nunca_cabe":false,"espaco_livre_usd":480,"todas_sem_vaga":true}
    }
  ]$casos$;
  v_caso jsonb;
  v_obtido jsonb;
  v_esp jsonb;
  v_falhas text := '';
  v_n int := 0;
begin
  for v_caso in select * from jsonb_array_elements(v_casos) loop
    v_n := v_n + 1;
    v_esp := v_caso->'esperado';
    v_obtido := public.painel_fila_escolher_conta(
                  v_caso->'contas', (v_caso->>'estimado_usd')::numeric);
    if coalesce(v_obtido->>'conta','(null)') is distinct from coalesce(v_esp->>'conta','(null)')
       or (v_obtido->>'cabe_hoje')::boolean is distinct from (v_esp->>'cabe_hoje')::boolean
       or (v_obtido->>'todas_recusadas')::boolean is distinct from (v_esp->>'todas_recusadas')::boolean
       or (v_obtido->>'nunca_cabe')::boolean is distinct from (v_esp->>'nunca_cabe')::boolean
       or (v_obtido->>'espaco_livre_usd')::numeric is distinct from (v_esp->>'espaco_livre_usd')::numeric
       or (v_esp ? 'todas_sem_vaga'
           and (v_obtido->>'todas_sem_vaga')::boolean is distinct from (v_esp->>'todas_sem_vaga')::boolean)
    then
      v_falhas := v_falhas || format(' | %s: esperado=%s obtido=%s', v_caso->>'nome', v_esp, v_obtido);
    end if;
  end loop;

  -- VARREDURA DE GENERALIZAÇÃO (rodada 14) · PISO. `v_falhas = ''` sozinho é
  -- verdade também quando a tabela de casos está VAZIA: o bloco imprimiria
  -- "0 de 0 casos" e reportaria ok. O número de casos passa a ser condição do
  -- veredito, não enfeite da frase.
  if v_falhas = '' and v_n >= 10 then
    raise exception 'RESULTADO: ok — T42 MÉDIO 1 o chooser SQL bate com a tabela de paridade em % de % casos (piso 10)', v_n, v_n;
  end if;
  raise exception 'FALHA: T42 MÉDIO 1 paridade do chooser — casos rodados=% (piso 10)%', v_n, v_falhas;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- T43 · ALTO 1 (M14) — O DIA DA MORTE NÃO É REESCRITO PELO CAMINHO DO ITEM
-- Medição do crítico na rodada 8: `ontem_antes=120.0000 ontem_depois=0
-- hoje=80.0000 reaberto=true`. O item morre às 23h30 de ontem lançando US$ 120;
-- ontem fecha valendo 120 e é RELATADO; hoje o último dono volta com o número
-- real (o caminho previsto e testado por T04) e `concluido_em = now()` levava o
-- dinheiro inteiro para hoje.
-- Agora: ontem fica em 120 para sempre; a correção aparece HOJE, no dia em que
-- ela aconteceu; e `concluido_em` do item é HOJE, porque foi hoje que ele foi
-- de fato fechado — é isso que a mutação M14 ("item reaberto mantém o dia em
-- que morreu") quebra.
--
-- RODADA 13 · D54 · ESTE BLOCO MUDOU DE NÚMERO, pela mesma razão que T24: ele
-- exigia `hoje = −40` e era isso que dava teto extra. O estorno agora é
-- limitado ao que a entidade pôs em HOJE (zero), e este bloco passa a medir a
-- coisa que importa: o headroom do pull DEPOIS da correção não pode ter
-- crescido. Com o defeito ele ia a 540 num teto de 500.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_conta text := 'lsgpandora@gmail.com';
  v_id uuid;
  v_ontem_antes numeric;
  v_ontem_depois numeric;
  v_hoje numeric;
  v_r jsonb;
  v_dia_fechamento date;
  v_headroom numeric;
begin
  delete from public.painel_frentes_sessoes where conta = v_conta;
  delete from public.painel_fila_prompts where conta = v_conta;
  update public.painel_teto_diario set teto_usd = 500 where conta = v_conta;
  insert into public.painel_fila_prompts (conta, prompt, complexidade, modelo_sugerido)
  values (v_conta, 'T43 morreu 23h30 de ontem', 'maxima', 'Fable') returning id into v_id;

  update public.painel_fila_prompts
     set estado = 'falhou', worker_id = null, ultimo_worker_id = 'w-T43', tentativas = 3,
         custo_usd = 120, custo_e_estimativa = true, custo_origem = 'estimativa',
         motivo_falha = 'expirou 3 vezes sem fechamento',
         pego_em      = (public.painel_dia_operador() - 1)::timestamp at time zone 'America/Sao_Paulo' + interval '21 hours',
         concluido_em = (public.painel_dia_operador() - 1)::timestamp at time zone 'America/Sao_Paulo' + interval '23 hours 30 minutes'
   where id = v_id;
  insert into public.painel_caixa_lancamentos
    (dia, conta, valor_usd, origem, entidade_tipo, entidade_id, item_id, nota)
  values (public.painel_dia_operador() - 1, v_conta, 120, 'estimativa', 'item', v_id::text, v_id,
          'semente T43: a casa lançou no dia da morte');

  v_ontem_antes := public.painel_fila_consumo_do_dia(v_conta, public.painel_dia_operador() - 1);

  v_r := public.fila_prompts_fechar_interno(
           p_id => v_id, p_conta => v_conta, p_worker_id => 'w-T43',
           p_estado => 'falhou', p_custo_usd => 80);

  v_ontem_depois := public.painel_fila_consumo_do_dia(v_conta, public.painel_dia_operador() - 1);
  v_hoje := public.painel_fila_consumo_hoje(v_conta);
  select public.painel_dia_operador(concluido_em) into v_dia_fechamento
    from public.painel_fila_prompts where id = v_id;
  -- D54: a régua do CRÍTICO 1 — o espaço do dia depois da correção.
  v_headroom := (public.fila_prompts_pegar_interno(v_conta, 'w-T43-headroom')->>'headroom_usd')::numeric;

  if (v_r->>'reaberto_e_fechado')::boolean
     and v_ontem_antes = 120 and v_ontem_depois = 120
     and v_hoje = 0
     and v_headroom = 500
     and v_dia_fechamento = public.painel_dia_operador() then
    raise exception 'RESULTADO: ok — T43 ALTO 1 ontem_antes=% ontem_depois=% hoje=% headroom=% (nenhum teto nasceu do crédito) e o item consta fechado em %',
      v_ontem_antes, v_ontem_depois, v_hoje, v_headroom, v_dia_fechamento;
  end if;
  raise exception 'FALHA: T43 ALTO 1 esperado ontem 120 ANTES e DEPOIS, hoje 0, headroom 500 e fechamento hoje; obteve antes=% depois=% hoje=% headroom=% fechado_em=% r=%',
    v_ontem_antes, v_ontem_depois, v_hoje, v_headroom, v_dia_fechamento, v_r;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- T44 · ALTO 2 (M19) — DINHEIRO NÃO ENTRA NUM DIA ENCERRADO, E A JANELA DE
-- ESCRITA DA TELA NÃO REABRE
-- Medição do crítico: `dia-5: 120.0000 -> 200.0000 -> 200 | hoje=0`. O ramo
-- `cancelada` de `fechar` fazia `concluido_em = coalesce(concluido_em, now())` e
-- `painel_sessao_dia_de_cobranca` protegia só contra TIRAR de um dia anterior,
-- nunca contra PÔR — o gasto de hoje era cobrado de um dia já relatado, duas
-- vezes.
-- RODADA 13 · D54 · ESTE BLOCO MUDOU DE NÚMERO (mesma razão de T24/T43): ele
-- exigia `hoje = −40`. Agora o estorno não tira de hoje mais do que hoje tem —
-- e hoje não tem nada desta entidade —, então hoje fica em 0. Tudo o mais que
-- o bloco guarda continua igual: ontem 120, `concluido_em` em ONTEM, e a tela
-- recusando o ajuste.
--
-- Agora: o item foi cancelado ONTEM e é ONTEM que ele fechou. A medição real de
-- hoje entra como estorno + lançamento de HOJE, e `concluido_em` NÃO ANDA — por
-- isso `ajustar_custo` continua recusando ("só item fechado hoje"). A mutação
-- M19 ("o dia passa a ser o do fechamento") move `concluido_em` para hoje,
-- reabre a porta de escrita sobre um item encerrado em outro dia, e este bloco
-- fica vermelho.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_conta text := 'lsgpandora@gmail.com';
  v_id uuid;
  v_ontem_antes numeric;
  v_ontem_depois numeric;
  v_hoje numeric;
  v_r jsonb;
  v_dia_fechamento date;
  v_erro text := '(nenhum erro)';
begin
  delete from public.painel_frentes_sessoes where conta = v_conta;
  delete from public.painel_fila_prompts where conta = v_conta;
  insert into public.painel_fila_prompts (conta, prompt, complexidade, modelo_sugerido)
  values (v_conta, 'T44 cancelado ontem', 'maxima', 'Fable') returning id into v_id;

  update public.painel_fila_prompts
     set estado = 'cancelada', worker_id = 'w-T44', ultimo_worker_id = 'w-T44', tentativas = 1,
         custo_usd = 120, custo_e_estimativa = true, custo_origem = 'estimativa',
         motivo_falha = 'cancelado pelo operador durante a execução',
         pego_em      = (public.painel_dia_operador() - 1)::timestamp at time zone 'America/Sao_Paulo' + interval '20 hours',
         concluido_em = (public.painel_dia_operador() - 1)::timestamp at time zone 'America/Sao_Paulo' + interval '21 hours'
   where id = v_id;
  insert into public.painel_caixa_lancamentos
    (dia, conta, valor_usd, origem, entidade_tipo, entidade_id, item_id, nota)
  values (public.painel_dia_operador() - 1, v_conta, 120, 'estimativa', 'item', v_id::text, v_id,
          'semente T44: a casa lançou no dia do cancelamento');

  v_ontem_antes := public.painel_fila_consumo_do_dia(v_conta, public.painel_dia_operador() - 1);

  -- a sessão que estava rodando volta HOJE com o número real
  v_r := public.fila_prompts_fechar_interno(
           p_id => v_id, p_conta => v_conta, p_worker_id => 'w-T44',
           p_estado => 'concluida', p_custo_usd => 80);

  v_ontem_depois := public.painel_fila_consumo_do_dia(v_conta, public.painel_dia_operador() - 1);
  v_hoje := public.painel_fila_consumo_hoje(v_conta);
  select public.painel_dia_operador(concluido_em) into v_dia_fechamento
    from public.painel_fila_prompts where id = v_id;

  begin
    perform public.fila_prompts_ajustar_custo(
      (select valor from private.lifeboard_config where chave = 'load_secret'), v_id, 5);
  exception when check_violation then v_erro := sqlerrm;
  end;

  if v_r->>'estado' = 'cancelada'
     and v_ontem_antes = 120 and v_ontem_depois = 120
     and v_hoje = 0
     and v_dia_fechamento = public.painel_dia_operador() - 1
     and v_erro = 'Só dá para ajustar o custo de item fechado hoje.' then
    raise exception 'RESULTADO: ok — T44 ALTO 2 o dia-1 continua 120 (antes=% depois=%), a correção cai hoje sem negativar o dia (%) e a tela continua fechada: "%"',
      v_ontem_antes, v_ontem_depois, v_hoje, v_erro;
  end if;
  raise exception 'FALHA: T44 ALTO 2 esperado ontem 120/120, hoje 0, fechado_em=ontem e recusa do ajuste; obteve antes=% depois=% hoje=% fechado_em=% erro="%" r=%',
    v_ontem_antes, v_ontem_depois, v_hoje, v_dia_fechamento, v_erro, v_r;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- T45 · D12 (M23) — "CANCELADA QUE JÁ TEVE DONO GASTOU DINHEIRO"
-- A mutação M23 apaga a cláusula inteira de `fila_prompts_cancelar` e, na
-- rodada 8, US$ 120 por dia sumiam de TODO dia sem que um único bloco
-- percebesse. Aqui ela tem guarda: o item que voltou para a fila depois de uma
-- tentativa lança o estimado ao ser cancelado; o item que NUNCA foi pego não
-- lança nada — e os dois vereditos aparecem no mesmo bloco, porque é a
-- diferença entre eles que a cláusula produz.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_conta text := 'lsgpandora@gmail.com';
  v_rodou uuid;
  v_virgem uuid;
  v_segredo text := (select valor from private.lifeboard_config where chave = 'load_secret');
  v_c1 jsonb;
  v_c2 jsonb;
  v_depois_1 numeric;
  v_depois_2 numeric;
  v_origem text;
begin
  delete from public.painel_frentes_sessoes where conta = v_conta;
  delete from public.painel_fila_prompts where conta = v_conta;

  insert into public.painel_fila_prompts (conta, prompt, complexidade, modelo_sugerido)
  values (v_conta, 'T45 ja rodou e voltou', 'maxima', 'Fable') returning id into v_rodou;
  insert into public.painel_fila_prompts (conta, prompt, complexidade, modelo_sugerido)
  values (v_conta, 'T45 nunca foi pego', 'maxima', 'Fable') returning id into v_virgem;

  update public.painel_fila_prompts
     set estado = 'na_fila', worker_id = null, ultimo_worker_id = 'w-T45',
         tentativas = 1, disponivel_em = now() + interval '15 minutes'
   where id = v_rodou;

  v_c1 := public.fila_prompts_cancelar(v_segredo, v_rodou);
  v_depois_1 := public.painel_fila_consumo_hoje(v_conta);
  select custo_origem into v_origem from public.painel_fila_prompts where id = v_rodou;

  v_c2 := public.fila_prompts_cancelar(v_segredo, v_virgem);
  v_depois_2 := public.painel_fila_consumo_hoje(v_conta);

  if (v_c1->>'motivo_codigo') = 'cancelado_apos_devolucao'
     and (v_c1->>'custo_lancado_usd')::numeric = 120
     and v_depois_1 = 120
     and v_origem = 'estimativa'
     and (v_c2->>'motivo_codigo') = 'cancelado_nunca_pego'
     and (v_c2->>'custo_lancado_usd')::numeric = 0
     and v_depois_2 = 120 then
    raise exception 'RESULTADO: ok — T45 D12 quem já rodou lança 120 (dia=%) e quem nunca foi pego lança 0 (dia continua %)',
      v_depois_1, v_depois_2;
  end if;
  raise exception 'FALHA: T45 D12 esperado 120 lançados e 0 lançados; obteve c1=% dia1=% origem=% c2=% dia2=%',
    v_c1, v_depois_1, v_origem, v_c2, v_depois_2;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- T46 · ALTO 3 — A CONTA É FIXADA NO LANÇAMENTO, E NÃO SE REMANEJA
-- Medição do crítico: `heartbeat_ok=true fechou=true | A(nao rodou nada)=80
-- B(rodou o item)=0`. A guarda de conta só agia quando `painel_sessao_dona`
-- devolvia não-nulo — e o CAMINHO REAL é a sessão ainda não existir no
-- heartbeat (a filha acabou de nascer) e ser publicada depois, sob outra conta.
-- Ninguém revalidava, e o dinheiro migrava inteiro para a conta que não rodou
-- nada. T31/T37 só exercitavam a sessão JÁ publicada.
-- Agora não há guarda a driblar: a conta é a do PRIMEIRO lançamento da entidade.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_b text := 'lsgpandora@gmail.com';
  v_a text := 'lucasscudeler@gmail.com';
  v_id uuid;
  v_dia date := public.painel_dia_operador();
  v_base_a numeric;
  v_base_b numeric;
  v_hb jsonb;
  v_fe jsonb;
  v_na_a numeric;
  v_na_b numeric;
begin
  delete from public.painel_frentes_sessoes where conta in (v_a, v_b);
  delete from public.painel_fila_prompts where conta in (v_a, v_b);
  v_base_a := public.painel_fila_consumo_do_dia(v_a, v_dia);
  v_base_b := public.painel_fila_consumo_do_dia(v_b, v_dia);

  insert into public.painel_fila_prompts (conta, prompt, complexidade, modelo_sugerido)
  values (v_b, 'T46 item da conta B', 'maxima', 'Fable') returning id into v_id;
  update public.painel_fila_prompts
     set estado = 'pega', worker_id = 'w-T46', ultimo_worker_id = 'w-T46',
         tentativas = 1, pego_em = now(), heartbeat_em = now()
   where id = v_id;

  -- o caminho REAL: no heartbeat a sessão AINDA NÃO EXISTE, e a guarda passa
  v_hb := public.fila_prompts_heartbeat_interno(v_id, v_b, 'w-T46', 'sess-T46');
  v_fe := public.fila_prompts_fechar_interno(
            p_id => v_id, p_conta => v_b, p_worker_id => 'w-T46',
            p_estado => 'concluida', p_custo_usd => 80, p_session_id => 'sess-T46');

  -- ... e só AGORA a sessão é publicada — sob a conta A, que não rodou nada
  insert into public.painel_frentes_sessoes
    (sessao_id, conta, titulo, estado, branches, repos, criado_em, atualizado_em, custo_usd, publicado_em)
  values ('sess-T46', v_a, 'T46', 'ativa', '{}', '{}', now(), now(), 80, now());

  v_na_a := public.painel_fila_consumo_do_dia(v_a, v_dia) - v_base_a;
  v_na_b := public.painel_fila_consumo_do_dia(v_b, v_dia) - v_base_b;

  if (v_hb->>'ok')::boolean and (v_fe->>'ok')::boolean
     and v_na_a = 0 and v_na_b = 80 then
    raise exception 'RESULTADO: ok — T46 ALTO 3 heartbeat_ok=% fechou=% | A(nao rodou nada)=% B(rodou o item)=%',
      v_hb->>'ok', v_fe->>'ok', v_na_a, v_na_b;
  end if;
  raise exception 'FALHA: T46 ALTO 3 esperado A=0 B=80; obteve A=% B=% hb=% fe=%', v_na_a, v_na_b, v_hb, v_fe;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- T47 · ALTO 4 (M21) — "SEM VALOR" E "VALOR ZERO" SÃO O MESMO NÃO-LANÇAMENTO
-- Medição do crítico: `defasagem=0.1 recusado=false pegou_item=t` com a medição
-- real de 40 h na tabela. `and s.custo_usd is not null` deixava o ZERO passar —
-- contradizendo a própria 0018, que declara "medido igual a ZERO é a sessão que
-- fechou sem ler o usage".
-- Agora zero não vira lançamento (`check valor_usd <> 0`), logo não tem
-- `medido_em` para entrar no `max` e não tem como desarmar a trava. E a mesma
-- regra vale para o item: fechar com custo 0 não cria linha nenhuma — é isso
-- que a mutação M21 ("item fechado sem custo passa a entrar") quebra.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_conta text := 'lsgpandora@gmail.com';
  v_barato uuid;
  v_zerado uuid;
  v_defasagem numeric;
  v_pull jsonb;
  v_itens int;
  v_consumo numeric;
begin
  delete from public.painel_frentes_sessoes where conta = v_conta;
  delete from public.painel_fila_prompts where conta = v_conta;

  -- a MEDIÇÃO de verdade: 40 h atrás
  insert into public.painel_frentes_sessoes
    (sessao_id, conta, titulo, estado, branches, repos, criado_em, atualizado_em, custo_usd, publicado_em)
  values ('sess-T47-medida', v_conta, 'T47', 'ativa', '{}', '{}',
          now() - interval '40 hours', now() - interval '40 hours', 12, now() - interval '40 hours');
  -- e a sessão que fechou sem ler o usage, de 5 min atrás, com ZERO
  insert into public.painel_frentes_sessoes
    (sessao_id, conta, titulo, estado, branches, repos, criado_em, atualizado_em, custo_usd, publicado_em)
  values ('sess-T47-zero', v_conta, 'T47', 'ativa', '{}', '{}',
          now() - interval '5 minutes', now() - interval '5 minutes', 0, now() - interval '5 minutes');

  -- um item fechado HOJE com custo ZERO: também não vira linha
  insert into public.painel_fila_prompts (conta, prompt, complexidade, modelo_sugerido)
  values (v_conta, 'T47 fechado com zero', 'baixa', 'Haiku') returning id into v_zerado;
  update public.painel_fila_prompts
     set estado = 'pega', worker_id = 'w-T47', ultimo_worker_id = 'w-T47',
         tentativas = 1, pego_em = now(), heartbeat_em = now()
   where id = v_zerado;
  perform public.fila_prompts_fechar_interno(
    p_id => v_zerado, p_conta => v_conta, p_worker_id => 'w-T47',
    p_estado => 'concluida', p_custo_usd => 0);

  insert into public.painel_fila_prompts (conta, prompt, complexidade, modelo_sugerido)
  values (v_conta, 'T47 item barato na fila', 'baixa', 'Haiku') returning id into v_barato;

  v_defasagem := public.painel_fila_defasagem_horas(v_conta);
  select count(*)::int into v_itens
    from public.painel_fila_itens_do_dia(v_conta, public.painel_dia_operador()) d;
  v_consumo := public.painel_fila_consumo_hoje(v_conta);

  update public.painel_teto_diario set exigir_medicao_recente = true where conta = v_conta;
  v_pull := public.fila_prompts_pegar_interno(v_conta, 'w-T47-pull');

  if round(v_defasagem) = 40
     and v_itens = 0
     and v_consumo = 12
     and v_pull->'item' = 'null'::jsonb
     and (v_pull->>'recusado_por_medicao')::boolean then
    raise exception 'RESULTADO: ok — T47 ALTO 4 defasagem=% recusado=% pegou_item=% | zero não virou linha (itens do dia=%)',
      v_defasagem, v_pull->>'recusado_por_medicao', (v_pull->'item' <> 'null'::jsonb), v_itens;
  end if;
  raise exception 'FALHA: T47 ALTO 4 esperado defasagem=40, itens=0, consumo=12 e pull recusado; obteve defasagem=% itens=% consumo=% pull=%',
    v_defasagem, v_itens, v_consumo, v_pull;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- T48 · D37 — O LIVRO É IMUTÁVEL, E QUEM RECUSA É O BANCO
-- "O passado não muda" só vale se não houver caminho para mudá-lo. UPDATE e
-- DELETE em `painel_caixa_lancamentos` são recusados por gatilho — não por
-- convenção, não por revisão de código.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_conta text := 'lsgpandora@gmail.com';
  v_id uuid;
  v_lanc uuid;
  v_upd text := '(nenhum erro)';
  v_del text := '(nenhum erro)';
begin
  delete from public.painel_frentes_sessoes where conta = v_conta;
  delete from public.painel_fila_prompts where conta = v_conta;
  insert into public.painel_fila_prompts (conta, prompt, complexidade, modelo_sugerido)
  values (v_conta, 'T48 imutabilidade', 'baixa', 'Haiku') returning id into v_id;
  perform public.painel_caixa_lancar_item(v_id, 5, 'estimativa', null, 'semente T48');
  select l.id into v_lanc from public.painel_caixa_lancamentos l where l.item_id = v_id limit 1;

  begin
    update public.painel_caixa_lancamentos set valor_usd = 999 where id = v_lanc;
  exception when others then v_upd := sqlerrm;
  end;
  begin
    delete from public.painel_caixa_lancamentos where id = v_lanc;
  exception when others then v_del := sqlerrm;
  end;

  if v_upd like 'O livro-razão do caixa é imutável%'
     and v_del like 'O livro-razão do caixa é imutável%' then
    raise exception 'RESULTADO: ok — T48 D37 o banco recusa UPDATE e DELETE no livro: "%"', left(v_upd, 80);
  end if;
  raise exception 'FALHA: T48 D37 — update="%" delete="%"', v_upd, v_del;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- T49 · MÉDIO 5 — CONTA SEM TETO NÃO SOME DO RELATÓRIO LEVANDO O GASTO JUNTO
-- Medição do crítico: `gasto real=120 | linha desta conta=(SUMIU)`. O relatório
-- saía `from public.painel_teto_diario t` — conta sem teto declarado
-- desaparecia inteira, com o dinheiro dela dentro, e T35 usa exatamente esse
-- estado como legítimo. Agora a lista é a UNIÃO (contas com teto ∪ contas com
-- lançamento no dia) e a ausência de teto é DITA.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_conta text := 'lsgpandora@gmail.com';
  v_id uuid;
  v_rpc jsonb;
  v_linha jsonb;
begin
  delete from public.painel_frentes_sessoes where conta = v_conta;
  delete from public.painel_fila_prompts where conta = v_conta;

  insert into public.painel_fila_prompts (conta, prompt, complexidade, modelo_sugerido)
  values (v_conta, 'T49 gasto sem teto', 'maxima', 'Fable') returning id into v_id;
  update public.painel_fila_prompts
     set estado = 'falhou', worker_id = null, ultimo_worker_id = 'w-T49', tentativas = 3,
         custo_usd = 120, custo_e_estimativa = true, custo_origem = 'estimativa',
         concluido_em = now()
   where id = v_id;
  perform public.painel_caixa_lancar_item(v_id, 120, 'estimativa', null, 'semente T49');

  -- e o operador tira o teto desta conta do painel
  delete from public.painel_teto_diario where conta = v_conta;

  v_rpc := public.fila_prompts_consumo_do_dia(
             (select valor from private.lifeboard_config where chave = 'load_secret'),
             public.painel_dia_operador());
  select l into v_linha from jsonb_array_elements(v_rpc->'contas') as l where l->>'conta' = v_conta;

  if v_linha is not null
     and (v_linha->>'consumo_usd')::numeric = 120
     and (v_linha->>'sem_teto_declarado')::boolean
     and v_linha->'teto_usd' = 'null'::jsonb then
    raise exception 'RESULTADO: ok — T49 MÉDIO 5 gasto real=120 | linha desta conta=%', v_linha;
  end if;
  raise exception 'FALHA: T49 MÉDIO 5 a conta sumiu (ou veio errada) do relatório: linha=% rpc=%', v_linha, v_rpc;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- T50 · MÉDIO 3 — UMA DEFINIÇÃO SÓ DE "QUANTO A CONTA GASTOU NA TERÇA?"
-- `painel_fila_historico_medido` lia SÓ as sessões; `painel_fila_consumo_do_dia`
-- somava sessões + itens. O dia de US$ 120 vindo de um ITEM não existia para a
-- régua com que o operador escolhe o teto. As duas passaram a ler o livro, e
-- este bloco pergunta o mesmo dia para as duas.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_conta text := 'lsgpandora@gmail.com';
  v_id uuid;
  v_dia date := public.painel_dia_operador() - 1;
  v_por_dia numeric;
  v_max numeric;
  v_dias int;
begin
  delete from public.painel_frentes_sessoes where conta = v_conta;
  delete from public.painel_fila_prompts where conta = v_conta;
  insert into public.painel_fila_prompts (conta, prompt, complexidade, modelo_sugerido)
  values (v_conta, 'T50 dia de item puro', 'maxima', 'Fable') returning id into v_id;

  -- um dia cujo gasto veio 100% de ITEM, sem sessão nenhuma
  insert into public.painel_caixa_lancamentos
    (dia, conta, valor_usd, origem, entidade_tipo, entidade_id, item_id, nota)
  values (v_dia, v_conta, 120, 'estimativa', 'item', v_id::text, v_id,
          'semente T50: o dia inteiro veio de um item que morreu sem fechar');

  v_por_dia := public.painel_fila_consumo_do_dia(v_conta, v_dia);
  select h.dias, h.max_usd into v_dias, v_max
    from public.painel_fila_historico_medido(v_conta) h;

  if v_por_dia = 120 and v_dias = 1 and v_max = 120 then
    raise exception 'RESULTADO: ok — T50 MÉDIO 3 as duas réguas dizem o mesmo: consumo_do_dia=% histórico(dias=%, max=%)',
      v_por_dia, v_dias, v_max;
  end if;
  raise exception 'FALHA: T50 MÉDIO 3 esperado 120 nas duas; obteve consumo_do_dia=% historico dias=% max=%',
    v_por_dia, v_dias, v_max;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- T51 · D43 — A BARREIRA DE TESTE ESTÁ ARMADA E É DIFERIDA
-- BAIXO 5 (rodada 8), marcado "perigoso": a segurança desta suíte dependia de
-- TODO bloco terminar em `raise`, e T38 apaga 194 sessões reais dentro do
-- bloco. Este bloco confere o MECANISMO: o parâmetro de sessão está ligado (o
-- arquivo o armou, não o bloco) e as quatro tabelas de dinheiro têm gatilho de
-- restrição DIFERIDO, que só dispara no COMMIT — é isso que torna impossível um
-- bloco esquecido persistir escrita.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_flag text := coalesce(current_setting('lifeboard.teste', true), '(desarmada)');
  v_tabelas text;
  v_n int;
begin
  select count(*)::int, string_agg(c.relname, ', ' order by c.relname)
    into v_n, v_tabelas
    from pg_trigger t join pg_class c on c.oid = t.tgrelid
   where t.tgname like '%barreira_teste'
     and t.tgconstraint <> 0
     and t.tgdeferrable and t.tginitdeferred;

  if v_flag = 'on' and v_n = 4 then
    raise exception 'RESULTADO: ok — T51 D43 barreira armada (lifeboard.teste=%) sobre % tabelas diferidas: %',
      v_flag, v_n, v_tabelas;
  end if;
  raise exception 'FALHA: T51 D43 barreira=% tabelas com gatilho diferido=% (%)', v_flag, v_n, coalesce(v_tabelas, '(nenhuma)');
end $$;

-- ═════════════════════════════════════════════════════════════════════════════
-- RODADA 10 · T52–T55 — os quatro P1 que esta suíte NÃO via
-- ═════════════════════════════════════════════════════════════════════════════
-- Medido em 14/09: com a 0019 defeituosa reposta no lugar da 0020, esta suíte
-- passava 51/51. Ela é a guarda COMPORTAMENTAL do banco e era CEGA para os
-- quatro P1 que CodeRabbit e Codex acharam — inclusive para o livro-razão
-- dobrando dinheiro sob concorrência. Os quatro blocos abaixo fecham isso.
-- ═════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- T52 · D42 — painel_caixa_lancar TOMA a trava da entidade
-- O P1 que os dois revisores acharam separados: o comentário da 0019 dizia
-- "serializa dois lançamentos da mesma entidade" e não havia lock nenhum; duas
-- transações liam o mesmo líquido e as duas lançavam o valor inteiro (medido
-- fora desta suíte, com duas conexões: US$ 200 em 2 linhas em vez de 100 em 1).
-- Concorrência real precisa de duas conexões, e esta suíte roda numa só. O que
-- se prova aqui é o MECANISMO, e de forma comportamental, não por ortografia:
-- depois da chamada, a transação tem de estar SEGURANDO um advisory lock a
-- mais. Tirar a linha do lock da função derruba este bloco.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_conta text := 'lsgpandora@gmail.com';
  v_ent   text := 'T52-entidade-de-prova';
  v_antes integer;
  v_depois integer;
begin
  delete from public.painel_frentes_sessoes where conta = v_conta;
  delete from public.painel_fila_prompts where conta = v_conta;

  select count(*) into v_antes
    from pg_locks where locktype = 'advisory' and pid = pg_backend_pid();

  perform public.painel_caixa_lancar('item', v_ent, v_conta, 100, 'medido');

  select count(*) into v_depois
    from pg_locks where locktype = 'advisory' and pid = pg_backend_pid();

  if v_depois = v_antes + 1 then
    raise exception 'RESULTADO: ok — T52 D42 a entidade é travada antes da leitura do líquido (advisory locks % -> %)',
      v_antes, v_depois;
  end if;
  raise exception 'FALHA: T52 D42 painel_caixa_lancar NÃO tomou a trava da entidade: advisory locks antes=% depois=% (esperado depois=antes+1)',
    v_antes, v_depois;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- T53 · D43 — medir o MESMO valor que a estimativa ainda grava a medição
-- Item cancelado lança ESTIMATIVA de 80 na entidade; o worker volta e relata
-- MEDIDO 80 — mesmo número. A 0019 saía pela porta curta (`v_liquido = v_alvo`)
-- sem gravar nada, então `medido_em` nunca existia e a conta lia como NUNCA
-- MEDIDA. Com `exigir_medicao_recente` ligada, isso barra todo pull futuro.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_conta text := 'lsgpandora@gmail.com';
  v_ent   text := 'T53-entidade-de-prova';
  v_medidos integer;
  v_liquido numeric;
begin
  delete from public.painel_frentes_sessoes where conta = v_conta;
  delete from public.painel_fila_prompts where conta = v_conta;

  perform public.painel_caixa_lancar('item', v_ent, v_conta, 80, 'estimativa');
  perform public.painel_caixa_lancar('item', v_ent, v_conta, 80, 'medido', null, null, now());

  select count(*) into v_medidos
    from public.painel_caixa_lancamentos
   where entidade_id = v_ent and origem = 'medido' and medido_em is not null;
  select coalesce(sum(valor_usd), 0) into v_liquido
    from public.painel_caixa_lancamentos where entidade_id = v_ent;

  if v_medidos = 1 and v_liquido = 80 then
    raise exception 'RESULTADO: ok — T53 D43 medição de mesmo valor grava proveniência: linhas medidas=% líquido=%',
      v_medidos, v_liquido;
  end if;
  raise exception 'FALHA: T53 D43 esperado 1 linha medida com medido_em e líquido 80, obteve medidas=% líquido=%',
    v_medidos, v_liquido;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- T54 · D44 — a parcela ESTIMADA desconta os estornos
-- Estimativa de 120 corrigida para 50 medidos deixa três linhas: +120
-- estimativa, -120 estorno, +50 medido. Filtrar só `origem = 'estimativa'`
-- ignorava a segunda, e o cartão dizia "US$ 120 disso é estimativa" num dia
-- cujo total é 50.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_conta text := 'lsgpandora@gmail.com';
  v_ent   text := 'T54-entidade-de-prova';
  v_estimada numeric;
  v_itens integer;
  v_total numeric;
begin
  delete from public.painel_frentes_sessoes where conta = v_conta;
  delete from public.painel_fila_prompts where conta = v_conta;

  perform public.painel_caixa_lancar('item', v_ent, v_conta, 120, 'estimativa');
  perform public.painel_caixa_lancar('item', v_ent, v_conta, 50, 'medido', null, null, now());

  v_estimada := public.painel_fila_estimativa_usd(v_conta);
  v_itens    := public.painel_fila_estimativa_itens(v_conta);
  v_total    := public.painel_caixa_do_dia(v_conta, public.painel_dia_operador());

  if v_estimada = 0 and v_itens = 0 and v_total = 50 then
    raise exception 'RESULTADO: ok — T54 D44 estimativa corrigida sai da parcela: estimada=% itens=% total do dia=%',
      v_estimada, v_itens, v_total;
  end if;
  raise exception 'FALHA: T54 D44 esperado estimada=0 itens=0 total=50, obteve estimada=% itens=% total=%',
    v_estimada, v_itens, v_total;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- T55 · D45 — o que o OPERADOR digitou não é medição
-- A abertura da 0019 rotulava `medido` (com `medido_em`) todo custo digitado à
-- mão, e isso SOLTA a trava de medição recente de uma conta que nunca teve
-- sessão medida. A regra, na porta: origem `operador` não carimba `medido_em`,
-- e `painel_fila_medido_ate` não a conta como medição.
--
-- HONESTIDADE SOBRE O QUE ESTE BLOCO NÃO PROVA. Medido: ele passa TAMBÉM com a
-- 0019 defeituosa reposta — ao contrário de T52/T53/T54, que caem. Não é um
-- descuido: o defeito do D45 morava na QUERY DE ABERTURA da migration, não em
-- `painel_caixa_lancar`, e query de migration não é chamável daqui. O que este
-- bloco guarda é a INVARIANTE (origem operador nunca vira medição pela porta),
-- que é o que impede o defeito de voltar por um caminho novo.
-- A guarda de regressão da abertura em si é a §5 da 0020, que aborta a
-- migration se sobrar linha de abertura rotulada `medido` com `custo_origem =
-- 'operador'` — e essa foi provada por mutação (neutralizando o UPDATE da §4,
-- a §5 aborta).
--
-- MÉDIO 7 (rodada 14), a MESMA FORMA DO T59: ele aprovava com
-- `v_medido_em is null and v_medido_ate is null` sobre uma linha que ele
-- ESPERAVA que a porta tivesse gravado. Se `painel_caixa_lancar` parasse de
-- gravar, o `select … into` não acharia nada, `v_medido_em` ficaria nulo e o
-- bloco aprovaria — "não virou medição" e "não lançou nada" eram a mesma
-- resposta. Entra o PISO: a linha tem de EXISTIR, com o valor e a origem que
-- a porta recebeu, e só então a ausência de `medido_em` significa alguma
-- coisa. Sem isto, este bloco também era aprovação por ausência.
-- MUTAÇÃO QUE DEIXA ESTE BLOCO VERMELHO: `painel_caixa_lancar` parar de
-- gravar (piso) · gravar com origem `medido` em vez de `operador` (piso) ·
-- carimbar `medido_em` no lançamento do operador (a invariante original).
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_conta text := 'lsgpandora@gmail.com';
  v_ent   text := 'T55-entidade-de-prova';
  v_medido_em timestamptz;
  v_medido_ate timestamptz;
  v_linhas int;
  v_valor numeric;
  v_origem text;
begin
  delete from public.painel_frentes_sessoes where conta = v_conta;
  delete from public.painel_fila_prompts where conta = v_conta;
  delete from public.painel_caixa_lancamentos where conta = v_conta;

  perform public.painel_caixa_lancar('item', v_ent, v_conta, 42, 'operador', null, null, now());

  -- O PISO: a porta LANÇOU? (conjunto vazio aprovava o bloco antes disto)
  select count(*), max(valor_usd), max(origem)
    into v_linhas, v_valor, v_origem
    from public.painel_caixa_lancamentos where entidade_id = v_ent;

  if v_linhas = 0 then
    raise exception 'FALHA: T55 D45 painel_caixa_lancar NÃO gravou nada para a entidade % — sem lançamento não há o que medir, e "não virou medição" não pode ser a mesma resposta que "não lançou".',
      v_ent;
  end if;
  if v_valor <> 42 or v_origem <> 'operador' then
    raise exception 'FALHA: T55 D45 a porta gravou outro fato: valor=% origem=% (esperado 42 / operador) — o resto do bloco estaria medindo a linha errada',
      v_valor, v_origem;
  end if;

  select medido_em into v_medido_em
    from public.painel_caixa_lancamentos where entidade_id = v_ent;
  v_medido_ate := public.painel_fila_medido_ate(v_conta);

  if v_medido_em is null and v_medido_ate is null then
    raise exception 'RESULTADO: ok — T55 D45 a porta lançou % linha(s) com valor=% origem=% e o custo digitado pelo operador NÃO virou medição: medido_em=% medido_ate=%',
      v_linhas, v_valor, v_origem,
      coalesce(v_medido_em::text, 'null'), coalesce(v_medido_ate::text, 'null');
  end if;
  raise exception 'FALHA: T55 D45 o custo do operador virou medição: medido_em=% medido_ate=% (esperado os dois nulos)',
    coalesce(v_medido_em::text, 'null'), coalesce(v_medido_ate::text, 'null');
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- T56 · D46 — a escolha MANUAL de conta também passa pela trava de medição
-- O chooser já carregava a recusa por medição velha dentro do `cabe_hoje`
-- dele; a manual decidia só por espaço livre, e o enfileiramento respondia
-- `manual_cabe` para uma conta que `fila_prompts_pegar_interno` iria RECUSAR.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_conta text := 'lsgpandora@gmail.com';
  v_r jsonb;
  v_recusaria boolean;
  v_cabe boolean;
begin
  delete from public.painel_frentes_sessoes where conta = v_conta;
  delete from public.painel_fila_prompts where conta = v_conta;
  update public.painel_teto_diario set exigir_medicao_recente = true where conta = v_conta;

  v_recusaria := public.painel_fila_recusaria_por_medicao(v_conta);
  v_r := public.fila_prompts_enfileirar(
    (select valor from private.lifeboard_config where chave = 'load_secret'),
    jsonb_build_object('prompt', 'T56 D46', 'complexidade', 'baixa', 'conta', v_conta));
  v_cabe := (v_r->>'cabe_hoje')::boolean;

  -- A conta de prova é limpa acima, então ela não tem medição: a trava MORDE.
  if v_recusaria and v_cabe is not true then
    raise exception 'RESULTADO: ok — T56 D46 escolha manual respeita a trava de medição: recusaria=% cabe_hoje=%',
      v_recusaria, coalesce(v_cabe::text, 'null');
  end if;
  raise exception 'FALHA: T56 D46 a manual prometeu o que o pull recusaria: recusaria=% cabe_hoje=%',
    v_recusaria, coalesce(v_cabe::text, 'null');
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- T57 · D47 — o estorno aponta para o lançamento ATIVO, nunca para outro
-- estorno. Estorno e lançamento novo nascem na MESMA transação, com o mesmo
-- `now()`; o desempate por uuid é aleatório em relação à ordem de inserção, e
-- a correção seguinte podia encadear no estorno anterior.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_conta text := 'lsgpandora@gmail.com';
  v_ent   text := 'T57-entidade-de-prova';
  v_maus  integer;
  v_estornos integer;
begin
  delete from public.painel_frentes_sessoes where conta = v_conta;
  delete from public.painel_fila_prompts where conta = v_conta;

  -- Três correções seguidas: duas cadeias de estorno para conferir.
  -- [rodada 12] A ordem das origens subiu de posto (estimativa 10 → operador
  -- 20 → medido 30). Antes a terceira era `operador` DEPOIS de `medido`, e com
  -- a trava de precedência (D53) ela passa a ser recusada — o bloco mediria a
  -- recusa, não a cadeia de estorno que é o assunto dele. O que T57 prova
  -- continua sendo o mesmo: dois estornos, nenhum encadeado noutro estorno.
  perform public.painel_caixa_lancar('item', v_ent, v_conta, 120, 'estimativa');
  perform public.painel_caixa_lancar('item', v_ent, v_conta, 30, 'operador');
  perform public.painel_caixa_lancar('item', v_ent, v_conta, 80, 'medido', null, null, now());

  select count(*) filter (where alvo.origem = 'estorno'), count(*)
    into v_maus, v_estornos
    from public.painel_caixa_lancamentos e
    join public.painel_caixa_lancamentos alvo on alvo.id = e.estorna_id
   where e.entidade_id = v_ent;

  if v_maus = 0 and v_estornos = 2 then
    raise exception 'RESULTADO: ok — T57 D47 cadeia de auditoria íntegra: % estorno(s), nenhum encadeado em estorno',
      v_estornos;
  end if;
  raise exception 'FALHA: T57 D47 % de % estorno(s) apontam para outro estorno — a cadeia do extrato quebrou',
    v_maus, v_estornos;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- T58 · D44b — a parcela estimada não fica NEGATIVA quando a estimativa
-- corrigida é de um dia anterior
--
-- [Achado MAIOR, CodeRabbit, rodada 11] T54 só prova o caso do MESMO dia
-- (estimativa e correção na mesma chamada, logo mesmo `dia`). A checagem
-- original do EXISTS (`a.id = l.estorna_id and a.origem = 'estimativa'`) não
-- olhava o dia de `a`: uma estimativa de ONTEM corrigida HOJE soma o estorno
-- de hoje (-valor) sozinho — a estimativa original nunca esteve no total de
-- HOJE (o filtro `l.dia = hoje` já a exclui), só o estorno dela está — e a
-- parcela ainda estimada de hoje ficava negativa, o que não tem sentido de
-- negócio (não existe "estimativa negativa").
--
-- Este bloco insere a estimativa DIRETO no livro, datada de ONTEM (mesmo
-- padrão da abertura/§4 da 0020: inserir é permitido, só update/delete são
-- recusados pelo gatilho de imutabilidade), e corrige HOJE via
-- painel_caixa_lancar — reproduzindo exatamente o caminho que uma estimativa
-- aberta um dia e medida no seguinte percorre em produção.
-- ─────────────────────────────────────────────────────────────────────────────
-- VARREDURA DE GENERALIZAÇÃO (rodada 14) · PISO. O veredito era
-- `v_estimada = 0 and v_itens = 0` — duas ausências, nenhum fato positivo. Com
-- a semente falhando em silêncio (ou com `painel_caixa_lancar` parando de
-- gravar) os dois números também dariam 0 e o bloco aprovaria sem ter
-- reproduzido nada. Entra o piso: as linhas do livro têm de existir (a
-- estimativa de ontem, o estorno e a medição de hoje) e o líquido da entidade
-- tem de ser 30 — só então "a parcela estimada de hoje é 0" quer dizer algo.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_conta text := 'lsgpandora@gmail.com';
  v_ent   text := 'T58-entidade-de-prova';
  v_estimada numeric;
  v_itens integer;
  v_linhas integer;
  v_liquido numeric;
begin
  delete from public.painel_frentes_sessoes where conta = v_conta;
  delete from public.painel_fila_prompts where conta = v_conta;
  delete from public.painel_caixa_lancamentos where entidade_id = v_ent;

  insert into public.painel_caixa_lancamentos
    (dia, conta, valor_usd, origem, entidade_tipo, entidade_id, nota)
  values
    (public.painel_dia_operador() - 1, v_conta, 80, 'estimativa', 'item', v_ent,
     'T58: estimativa de ONTEM, inserida direto para simular abertura de dia anterior');

  perform public.painel_caixa_lancar('item', v_ent, v_conta, 30, 'medido', null, null, now());

  -- o PISO, antes do veredito: a semente e a correção estão no livro, com os
  -- três fatos que este bloco existe para reproduzir. Medido num Postgres 16:
  -- [ontem +80 estimativa] [hoje −30 estorno] [hoje +30 medido].
  select count(*) into v_linhas
    from public.painel_caixa_lancamentos where entidade_id = v_ent;
  select coalesce(sum(valor_usd), 0) into v_liquido
    from public.painel_caixa_lancamentos
   where entidade_id = v_ent and dia = public.painel_dia_operador();

  if v_linhas < 3
     or not exists (select 1 from public.painel_caixa_lancamentos
                     where entidade_id = v_ent and origem = 'estimativa'
                       and valor_usd = 80 and dia = public.painel_dia_operador() - 1)
     or not exists (select 1 from public.painel_caixa_lancamentos
                     where entidade_id = v_ent and origem = 'medido'
                       and valor_usd = 30 and dia = public.painel_dia_operador())
  then
    raise exception 'FALHA: T58 D44b a semente não chegou ao livro: % linha(s), líquido de HOJE % (esperado ao menos 3 linhas — a estimativa de 80 datada de ONTEM, o estorno de hoje e a medição de 30 de hoje). Sem elas, "estimada=0" é silêncio, não invariante.',
      v_linhas, v_liquido;
  end if;

  v_estimada := public.painel_fila_estimativa_usd(v_conta);
  v_itens    := public.painel_fila_estimativa_itens(v_conta);

  if v_estimada = 0 and v_itens = 0 then
    raise exception 'RESULTADO: ok — T58 D44b o livro tem % linha(s) da entidade (líquido de hoje %, com a estimativa de 80 em ontem e a medição de 30 em hoje) e o estorno de estimativa de dia anterior não conta como estimativa de hoje: estimada=% itens=%',
      v_linhas, v_liquido, v_estimada, v_itens;
  end if;
  raise exception 'FALHA: T58 D44b esperado estimada=0 itens=0 (nunca negativo), obteve estimada=% itens=%',
    v_estimada, v_itens;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- T59 · D49 — nenhuma entidade ganha linha de ABERTURA depois de já ter sido
-- lançada (detector de dobra de dinheiro por reaplicação da 0019)
--
-- [Rodada 11] A idempotência do §7 da 0019 é a chave `abertura = true`. Sessão
-- que chega DEPOIS da abertura é lançada pelo gatilho
-- `painel_frentes_sessoes_lancar` com `abertura = false` — não colide com nada.
-- MEDIDO num Postgres 16 local, antes do conserto: reaplicar a 0019 levava uma
-- sessão pós-abertura de US$ 70 para US$ 140. O dia dobrava, em silêncio.
-- Agravante: o D48 (rodada 10, deste mesmo PR) tirou o freio — antes a 0019
-- ABORTAVA no §8 ao ser reaplicada sobre livro corrigido; depois dele ela
-- completa, e completava dobrando.
--
-- MÉDIO 7 (rodada 14): ESTE BLOCO NÃO PODIA FICAR VERMELHO NO CI. Ele varria o
-- livro sem semear nada e aprovava com `v_suspeitas = 0`. O crítico contou as
-- linhas das tabelas de dinheiro no banco do CI, com as 28 migrations
-- aplicadas e a suíte inteira executada: `lancamentos=0 aberturas=0 sessoes=0
-- itens=0`. `count(*)` de conjunto vazio é 0, `0 = 0` é verdade — constante-
-- verdadeiro, e ainda ocupando vaga no `PISO_DE_BLOCOS` e na manchete "78/78".
-- Bloco que não pode reprovar é pior que bloco nenhum, porque infla o número
-- que o operador lê.
-- AGORA ELE TESTA A SI MESMO, em duas fases — e nesta ordem, porque o livro
-- é IMUTÁVEL por gatilho (`painel_caixa_lancamentos_imutavel`): semente
-- lançada não se apaga, então ela entra DEPOIS da varredura limpa.
--   FASE 1 — varre o livro DE VERDADE e exige zero (o que o bloco já fazia);
--   FASE 2 — semeia a assinatura exata do dano (um lançamento comum e, DEPOIS
--     dele, uma abertura da mesma entidade) e EXIGE que o detector a acuse.
--     Detector que não acusa o caso semeado é detector desligado, e daí em
--     diante o `0` da fase 1 não significa nada.
-- Continua valendo contra o banco real: se a 0019 já tiver sido reaplicada em
-- produção depois de sessões novas, a fase 2 acusa aqui.
-- MUTAÇÃO QUE DEIXA ESTE BLOCO VERMELHO: trocar `an.criado_em < ab.criado_em`
-- por `>` ou por `<>` · tirar o `not an.abertura` · trocar a varredura por
-- `select 0` · qualquer entidade real do livro com abertura posterior.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_suspeitas integer;
  v_exemplo   text;
  v_na_isca   integer;
  v_conta     text := 'lsgpandora@gmail.com';
  v_ent       text := 'T59-isca-do-detector';
begin
  -- ── FASE 1 · o livro de verdade ──────────────────────────────────────────
  select count(*), min(x.entidade_id)
    into v_suspeitas, v_exemplo
    from (
      select ab.entidade_id
        from public.painel_caixa_lancamentos ab
       where ab.abertura
         and exists (
               select 1 from public.painel_caixa_lancamentos an
                where an.entidade_tipo = ab.entidade_tipo
                  and an.entidade_id   = ab.entidade_id
                  and not an.abertura
                  and an.criado_em < ab.criado_em)
    ) x;

  if v_suspeitas > 0 then
    raise exception 'FALHA: T59 D49 % entidade(s) com linha de abertura POSTERIOR a um lançamento comum (ex.: %) — assinatura de 0019 reaplicada sobre sessões pós-abertura, dinheiro possivelmente dobrado',
      v_suspeitas, v_exemplo;
  end if;

  -- ── FASE 2 · e o detector, ele acusa? ────────────────────────────────────
  -- Escrita direta na tabela DE PROPÓSITO: a assinatura do dano é justamente
  -- uma linha que nenhuma porta produz (a abertura é sempre o primeiro
  -- lançamento de cada entidade). Como o bloco termina em `raise`, nada
  -- persiste — e a barreira de teste da 0019 é diferida, então uma escrita que
  -- escapasse do rollback abortaria no commit.
  insert into public.painel_caixa_lancamentos
    (dia, conta, valor_usd, origem, abertura, entidade_tipo, entidade_id, criado_em, precedencia)
  values (public.painel_dia_operador(), v_conta, 70, 'medido', false, 'item', v_ent,
          now() - interval '2 hours', 30);
  insert into public.painel_caixa_lancamentos
    (dia, conta, valor_usd, origem, abertura, entidade_tipo, entidade_id, criado_em, precedencia)
  values (public.painel_dia_operador(), v_conta, 70, 'medido', true, 'item', v_ent,
          now() - interval '1 hour', 30);

  select count(*)
    into v_na_isca
    from (
      select ab.entidade_id
        from public.painel_caixa_lancamentos ab
       where ab.abertura
         and ab.entidade_id = v_ent
         and exists (
               select 1 from public.painel_caixa_lancamentos an
                where an.entidade_tipo = ab.entidade_tipo
                  and an.entidade_id   = ab.entidade_id
                  and not an.abertura
                  and an.criado_em < ab.criado_em)
    ) x;

  if v_na_isca = 1 then
    raise exception 'RESULTADO: ok — T59 D49 o livro real não tem nenhuma abertura posterior a lançamento comum, E o detector acusa a assinatura semeada (% acusação na isca) — o zero da fase 1 é medição, não silêncio',
      v_na_isca;
  end if;
  raise exception 'FALHA: T59 D49 o DETECTOR está desligado — a assinatura semeada (abertura criada depois de um lançamento comum da mesma entidade) devolveu % acusação(ões), esperado 1. Enquanto isto não acusar, o zero da varredura do livro não prova nada.',
    v_na_isca;
end $$;

-- ═════════════════════════════════════════════════════════════════════════════
-- RODADA PÓS-MERGE · os achados que CodeRabbit e Codex postaram DEPOIS do
-- último push do PR #21, e que entraram na `main` sem correção quando ele foi
-- mergeado. Migration que os corrige: 0025.
-- ═════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- T60 · D50 — MEDIR DE NOVO O MESMO VALOR TAMBÉM É MEDIR
-- `painel_frentes_sessoes_lancar` dispara em `atualizado_em` de propósito. Com
-- valor e origem iguais, a versão anterior devolvia "nada a fazer" e jogava
-- fora o `medido_em` novo: `painel_fila_medido_ate` congelava no instante
-- antigo e, passadas 12 h, `exigir_medicao_recente` recusava TODO pull daquela
-- conta — com a medição chegando normalmente o tempo todo.
-- MEDIDO no banco real em 21/09/2026, antes do conserto: 1 linha no livro e o
-- carimbo 20 h atrás. Depois: 3 linhas (estorno + novo), soma ainda 80 — o
-- dinheiro NÃO anda — e o carimbo renovado.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_conta  text := 'lsgpandora@gmail.com';
  v_ent    text := 'T60-medicao-repetida';
  v_t1     timestamptz := now() - interval '20 hours';
  v_t2     timestamptz := now();
  v_medido timestamptz;
  v_soma   numeric;
begin
  delete from public.painel_frentes_sessoes where conta = v_conta;
  delete from public.painel_fila_prompts where conta = v_conta;
  delete from public.painel_caixa_lancamentos where entidade_id = v_ent;

  perform public.painel_caixa_lancar('sessao', v_ent, v_conta, 80, 'medido', null, v_ent, v_t1);
  perform public.painel_caixa_lancar('sessao', v_ent, v_conta, 80, 'medido', null, v_ent, v_t2);

  select coalesce(sum(valor_usd), 0) into v_soma
    from public.painel_caixa_lancamentos where entidade_id = v_ent;
  select l.medido_em into v_medido
    from public.painel_caixa_lancamentos l
   where l.entidade_id = v_ent and l.origem <> 'estorno'
     and not exists (select 1 from public.painel_caixa_lancamentos e where e.estorna_id = l.id);

  if v_medido = v_t2 and v_soma = 80 then
    raise exception 'RESULTADO: ok — T60 D50 medição repetida renovou o carimbo (% ) sem mover dinheiro (soma=%)',
      v_medido, v_soma;
  end if;
  raise exception 'FALHA: T60 D50 carimbo=% (esperado %) soma=% (esperado 80)',
    coalesce(v_medido::text, 'null'), v_t2, v_soma;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- T61 · D51 — a recusa por MEDIÇÃO VELHA tem código próprio
-- A D46 fez a manual passar pela trava, mas o código continuou
-- `manual_nao_cabe_hoje` — cuja frase em português fala de espaço livre ("só
-- US$ X livres", "sem espaço livre agora"). A tela explicava falta de dinheiro
-- onde o problema é medição parada, e a conta tinha o teto inteiro livre.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_conta text := 'lsgpandora@gmail.com';
  v_r jsonb;
  v_codigo text;
  v_espaco numeric;
begin
  delete from public.painel_frentes_sessoes where conta = v_conta;
  delete from public.painel_fila_prompts where conta = v_conta;
  update public.painel_teto_diario set exigir_medicao_recente = true where conta = v_conta;

  v_r := public.fila_prompts_enfileirar(
    (select valor from private.lifeboard_config where chave = 'load_secret'),
    jsonb_build_object('prompt', 'T61 D51', 'complexidade', 'baixa', 'conta', v_conta));
  v_codigo := v_r->>'motivo_codigo';
  v_espaco := (v_r->>'espaco_livre_usd')::numeric;

  -- A conta foi limpa acima: sem medição, a trava morde. E sobra espaço — logo
  -- "não cabe hoje" seria uma explicação FALSA do que está acontecendo.
  if v_codigo = 'manual_medicao_velha' and v_espaco > 0 then
    raise exception 'RESULTADO: ok — T61 D51 recusa nomeada pela causa certa: codigo=% com US$ % livres',
      v_codigo, v_espaco;
  end if;
  raise exception 'FALHA: T61 D51 codigo=% (esperado manual_medicao_velha) espaco_livre=%',
    coalesce(v_codigo, 'null'), coalesce(v_espaco::text, 'null');
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- T62 · D52 — a checagem de dono da sessão trava a MESMA entidade do caixa
-- Publicar a sessão e vincular a sessão a um item podem correr juntas: a
-- checagem lia NULL antes do insert commitar (e passava, porque sessão não
-- publicada é o caso normal) enquanto o gatilho lançava na conta DELE. Como a
-- conta do lançamento é imutável (D39), todo lançamento posterior herdava a
-- conta errada.
--
-- O QUE ESTE BLOCO É, HONESTAMENTE: uma conferência de que a trava existe e
-- usa a MESMA chave do caixa. A corrida de duas conexões não é reproduzível de
-- dentro de uma transação só (mesma limitação declarada em T55/T59); o que dá
-- para provar aqui é que o lock é pedido e que a chave bate — se as chaves
-- divergirem, a serialização não acontece e o defeito volta em silêncio.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_sessao text := 'T62-sessao-de-prova';
  v_fonte  text := pg_get_functiondef('public.painel_sessao_dona(text)'::regprocedure);
  v_locks  integer;
  v_chave  bigint := hashtextextended('sessao:' || v_sessao, 0);
begin
  if position('pg_advisory_xact_lock' in v_fonte) = 0 then
    raise exception 'FALHA: T62 D52 painel_sessao_dona não pede lock nenhum — a checagem de dono corre solta';
  end if;

  perform public.painel_sessao_dona(v_sessao);

  -- `pg_locks` parte a chave de 64 bits em duas metades de 32 (`classid` alta,
  -- `objid` baixa). Comparar as metades evita a remontagem, que erra o sinal
  -- quando o hash é negativo.
  select count(*)::int into v_locks
    from pg_locks
   where locktype = 'advisory'
     and pid = pg_backend_pid()
     and classid::bigint = ((v_chave >> 32) & 4294967295)
     and objid::bigint   = (v_chave & 4294967295);

  if v_locks > 0 then
    raise exception 'RESULTADO: ok — T62 D52 a leitura do dono segura o lock da entidade sessao:% (mesma chave de painel_caixa_lancar)', v_sessao;
  end if;
  raise exception 'FALHA: T62 D52 nenhum lock advisory com a chave da entidade sessao:% — a chave do dono não bate com a do caixa', v_sessao;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- T63 · CRÍTICO 1 (rodada 12) — A ESTIMATIVA DA CASA NÃO APAGA A MEDIÇÃO REAL
-- O caso exato do crítico, no banco: item com sessão vinculada que já publicou
-- US$ 480 MEDIDOS; o worker morre (heartbeat de 2 h, tentativas esgotadas); o
-- pull seguinte mata o item e tenta lançar a estimativa de US$ 50 sobre a
-- MESMA entidade. Antes: +480, −480, +50 — o dia valia 50, o headroom voltava
-- para 450 e o pull despachava mais US$ 120 num teto de 500 (US$ 600 reais).
-- Agora: o lançamento de posto 10 não derruba o de posto 40. O dia continua
-- 480, o headroom é 20 e nada é despachado.
-- MUTAÇÃO QUE DEIXA ESTE BLOCO VERMELHO: tirar a trava de precedência de
-- `painel_caixa_lancar` (0027 §6) — o bloco fecha em 50, não em 480.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_conta text := 'lsgpandora@gmail.com';
  v_id uuid;
  v_id2 uuid;
  v_pull jsonb;
  v_medido numeric;
  v_depois numeric;
  v_despachado text;
begin
  delete from public.painel_frentes_sessoes where conta = v_conta;
  delete from public.painel_fila_prompts where conta = v_conta;

  insert into public.painel_fila_prompts (conta, prompt, complexidade, modelo_sugerido)
  values (v_conta, 'T63 item caro', 'maxima', 'Fable') returning id into v_id;
  update public.painel_fila_prompts set custo_estimado_usd = 50 where id = v_id;

  perform public.fila_prompts_pegar_interno(v_conta, 'w-T63');
  perform public.fila_prompts_heartbeat_interno(v_id, v_conta, 'w-T63', 'sess-T63-cara');
  insert into public.painel_frentes_sessoes (sessao_id, conta, titulo, estado, custo_usd, atualizado_em)
  values ('sess-T63-cara', v_conta, 'sessão cara', 'idle', 480, now());
  v_medido := public.painel_fila_consumo_hoje(v_conta);

  -- o worker some: heartbeat de 2 h e tentativas esgotadas
  update public.painel_fila_prompts
     set heartbeat_em = now() - interval '2 hours', tentativas = 3, max_tentativas = 3
   where id = v_id;

  -- um item de US$ 120 para provar que o pull NÃO abre espaço inventado
  insert into public.painel_fila_prompts (conta, prompt, complexidade, modelo_sugerido)
  values (v_conta, 'T63 item de 120', 'maxima', 'Fable') returning id into v_id2;
  update public.painel_fila_prompts set custo_estimado_usd = 120 where id = v_id2;

  v_pull := public.fila_prompts_pegar_interno(v_conta, 'w-T63-b');
  v_depois := public.painel_fila_consumo_hoje(v_conta);
  v_despachado := coalesce(v_pull->'item'->>'custoEstimadoUsd', 'nenhum');

  if v_medido = 480 and v_depois = 480
     and (v_pull->>'headroom_usd')::numeric = 20
     and v_despachado = 'nenhum'
     and (v_pull->>'mortos')::int = 1
     and (v_pull->>'mortos_usd')::numeric = 0
     and v_pull->>'motivo' like
         '%1 item morreu sem fechar neste disparo e não mudou o gasto do dia: o número real dele já estava medido%' then
    raise exception 'RESULTADO: ok — T63 CRÍTICO 1 a estimativa não apaga a medição: antes=% depois=% headroom=% despachado=% motivo=[%]',
      v_medido, v_depois, v_pull->>'headroom_usd', v_despachado, v_pull->>'motivo';
  end if;
  raise exception 'FALHA: T63 CRÍTICO 1 esperado consumo 480 headroom 20 nada despachado e mortos_usd 0 — obteve antes=% depois=% headroom=% despachado=% mortos_usd=% motivo=[%]',
    v_medido, v_depois, v_pull->>'headroom_usd', v_despachado, v_pull->>'mortos_usd', v_pull->>'motivo';
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- T64 · CRÍTICO 1 pela porta do OPERADOR — cancelar não apaga a medição
-- Sessão vinculada com US$ 300 medidos; o operador cancela o item em execução.
-- Antes: o dia caía para US$ 50 (a estimativa da casa) e a RPC anunciava o
-- lançamento. Agora o dia fica em 300 e `custo_lancado_usd` volta ZERO.
-- MUTAÇÃO: tirar a trava de precedência — o bloco fecha em 50.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_conta text := 'lsgpandora@gmail.com';
  v_id uuid;
  v_medido numeric;
  v_depois numeric;
  v_r jsonb;
begin
  delete from public.painel_frentes_sessoes where conta = v_conta;
  delete from public.painel_fila_prompts where conta = v_conta;

  insert into public.painel_fila_prompts (conta, prompt, complexidade, modelo_sugerido)
  values (v_conta, 'T64 cancelar sobre medido', 'maxima', 'Fable') returning id into v_id;
  update public.painel_fila_prompts set custo_estimado_usd = 50 where id = v_id;

  perform public.fila_prompts_pegar_interno(v_conta, 'w-T64');
  perform public.fila_prompts_heartbeat_interno(v_id, v_conta, 'w-T64', 'sess-T64');
  insert into public.painel_frentes_sessoes (sessao_id, conta, titulo, estado, custo_usd, atualizado_em)
  values ('sess-T64', v_conta, 'sessão medida', 'idle', 300, now());
  v_medido := public.painel_fila_consumo_hoje(v_conta);

  v_r := public.fila_prompts_cancelar(
    (select valor from private.lifeboard_config where chave = 'load_secret'), v_id);
  v_depois := public.painel_fila_consumo_hoje(v_conta);

  if v_medido = 300 and v_depois = 300
     and (v_r->>'custo_lancado_usd')::numeric = 0
     and (v_r->>'recusado_por_precedencia')::boolean then
    raise exception 'RESULTADO: ok — T64 CRÍTICO 1 cancelar não apaga a medição: antes=% depois=% lancado=%',
      v_medido, v_depois, v_r->>'custo_lancado_usd';
  end if;
  raise exception 'FALHA: T64 CRÍTICO 1 esperado 300 → 300 com lancado=0 — obteve antes=% depois=% lancado=% recusado=%',
    v_medido, v_depois, v_r->>'custo_lancado_usd', coalesce(v_r->>'recusado_por_precedencia', 'null');
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- T65 · CRÍTICO 2 (rodada 12) — TROCAR A SESSÃO NÃO CRIA UMA SEGUNDA ENTIDADE
-- Item morre sem fechar com a estimativa de US$ 50 em `sess-T65-ERRADA`; o
-- operador corrige para US$ 30 e digita `sess-T65-CERTA`. Antes o dia fechava
-- em 80 (a entidade antiga ficava com os 50 e ninguém a estornava) com a tela
-- dizendo "o gasto de hoje já considera o número real". Agora fecha em 30.
-- MUTAÇÃO: devolver a fusão da 0019 (só a órfã `item:<uuid>`) — fecha em 80.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_conta text := 'lsgpandora@gmail.com';
  v_id uuid;
  v_apos_morte numeric;
  v_final numeric;
  v_orfa numeric;
begin
  delete from public.painel_frentes_sessoes where conta = v_conta;
  delete from public.painel_fila_prompts where conta = v_conta;

  insert into public.painel_fila_prompts (conta, prompt, complexidade, modelo_sugerido)
  values (v_conta, 'T65 troca de sessão', 'maxima', 'Fable') returning id into v_id;
  update public.painel_fila_prompts set custo_estimado_usd = 50 where id = v_id;

  perform public.fila_prompts_pegar_interno(v_conta, 'w-T65');
  perform public.fila_prompts_heartbeat_interno(v_id, v_conta, 'w-T65', 'sess-T65-ERRADA');
  update public.painel_fila_prompts
     set heartbeat_em = now() - interval '2 hours', tentativas = 3, max_tentativas = 3
   where id = v_id;
  perform public.fila_prompts_pegar_interno(v_conta, 'w-T65-b');   -- mata o item
  v_apos_morte := public.painel_fila_consumo_hoje(v_conta);

  perform public.fila_prompts_ajustar_custo(
    (select valor from private.lifeboard_config where chave = 'load_secret'),
    v_id, 30, 'sess-T65-CERTA');
  v_final := public.painel_fila_consumo_hoje(v_conta);

  select coalesce(sum(l.valor_usd), 0) into v_orfa
    from public.painel_caixa_lancamentos l
   where l.entidade_tipo = 'sessao' and l.entidade_id = 'sess-T65-ERRADA';

  if v_apos_morte = 50 and v_final = 30 and v_orfa = 0 then
    raise exception 'RESULTADO: ok — T65 CRÍTICO 2 a entidade antiga foi drenada: morte=% ajuste=% sobrou na sessão errada=%',
      v_apos_morte, v_final, v_orfa;
  end if;
  raise exception 'FALHA: T65 CRÍTICO 2 esperado morte=50 ajuste=30 e nada na sessão errada — obteve morte=% ajuste=% sobrou=%',
    v_apos_morte, v_final, v_orfa;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- T66 · ALTO 1 (rodada 12) — A ORDEM DE CHEGADA NÃO DECIDE O TOTAL
-- Os mesmos dois fatos, nos dois sentidos: a rotina da conta publica US$ 100
-- para a sessão e o worker fecha o item com US$ 20. Antes: 20 num sentido,
-- 100 no outro — o número que governa o teto oscilava com o relógio de duas
-- rotinas independentes. Agora os dois sentidos dão 100, que é a promessa
-- escrita do DEPLOY.md (D6/D30): a medição PUBLICADA prevalece.
-- MUTAÇÃO: igualar os postos de `medido` e `publicado` — os sentidos divergem.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_conta text := 'lsgpandora@gmail.com';
  v_id uuid;
  v_ordem_publica_primeiro numeric;
  v_ordem_fecha_primeiro numeric;
begin
  delete from public.painel_frentes_sessoes where conta = v_conta;
  delete from public.painel_fila_prompts where conta = v_conta;

  -- sentido A: a sessão publica 100, depois o worker fecha com 20
  insert into public.painel_fila_prompts (conta, prompt, complexidade, modelo_sugerido)
  values (v_conta, 'T66 sentido A', 'baixa', 'Haiku') returning id into v_id;
  perform public.fila_prompts_pegar_interno(v_conta, 'w-T66a');
  perform public.fila_prompts_heartbeat_interno(v_id, v_conta, 'w-T66a', 'sess-T66-A');
  insert into public.painel_frentes_sessoes (sessao_id, conta, titulo, estado, custo_usd, atualizado_em)
  values ('sess-T66-A', v_conta, 's', 'idle', 100, now());
  perform public.fila_prompts_fechar_interno(v_id, v_conta, 'w-T66a', 'concluida', 20, 'sess-T66-A');
  -- O total sai da ENTIDADE, não da conta: os dois sentidos convivem no mesmo
  -- bloco e somar a conta inteira misturaria os dois.
  select coalesce(sum(l.valor_usd), 0) into v_ordem_publica_primeiro
    from public.painel_caixa_lancamentos l
   where l.entidade_tipo = 'sessao' and l.entidade_id = 'sess-T66-A';

  -- sentido B: o worker fecha com 20, depois a sessão publica 100
  delete from public.painel_frentes_sessoes where conta = v_conta;
  delete from public.painel_fila_prompts where conta = v_conta;
  insert into public.painel_fila_prompts (conta, prompt, complexidade, modelo_sugerido)
  values (v_conta, 'T66 sentido B', 'baixa', 'Haiku') returning id into v_id;
  perform public.fila_prompts_pegar_interno(v_conta, 'w-T66b');
  perform public.fila_prompts_heartbeat_interno(v_id, v_conta, 'w-T66b', 'sess-T66-B');
  perform public.fila_prompts_fechar_interno(v_id, v_conta, 'w-T66b', 'concluida', 20, 'sess-T66-B');
  insert into public.painel_frentes_sessoes (sessao_id, conta, titulo, estado, custo_usd, atualizado_em)
  values ('sess-T66-B', v_conta, 's', 'idle', 100, now());
  select coalesce(sum(l.valor_usd), 0) into v_ordem_fecha_primeiro
    from public.painel_caixa_lancamentos l
   where l.entidade_tipo = 'sessao' and l.entidade_id = 'sess-T66-B';

  if v_ordem_publica_primeiro = 100 and v_ordem_fecha_primeiro = 100 then
    raise exception 'RESULTADO: ok — T66 ALTO 1 os dois sentidos dão o mesmo total: publica→fecha=% fecha→publica=%',
      v_ordem_publica_primeiro, v_ordem_fecha_primeiro;
  end if;
  raise exception 'FALHA: T66 ALTO 1 a ordem de chegada decidiu o total: publica→fecha=% fecha→publica=%',
    v_ordem_publica_primeiro, v_ordem_fecha_primeiro;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- T67 · D53 — a ordem de precedência é a MESMA nos dois sentidos, entidade a
-- entidade. Quatro postos, seis pares: em qualquer ordem de chegada o líquido
-- da entidade é o do posto mais alto.
-- MUTAÇÃO: qualquer afrouxamento da trava de posto derruba ao menos um par.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_conta text := 'lsgpandora@gmail.com';
  v_falhas text := '';
  v_ent text;
  v_a record;
  v_b record;
  v_liq_ab numeric;
  v_liq_ba numeric;
  v_n int := 0;
  v_postos jsonb := $postos$[
    {"origem":"estimativa","posto":10,"valor":11},
    {"origem":"operador","posto":20,"valor":22},
    {"origem":"medido","posto":30,"valor":33},
    {"origem":"medido","posto":40,"valor":44}
  ]$postos$;
begin
  delete from public.painel_frentes_sessoes where conta = v_conta;
  delete from public.painel_fila_prompts where conta = v_conta;

  for v_a in select * from jsonb_to_recordset(v_postos) as x(origem text, posto int, valor numeric) loop
    for v_b in select * from jsonb_to_recordset(v_postos) as y(origem text, posto int, valor numeric) loop
      if v_a.posto >= v_b.posto then continue; end if;
      v_n := v_n + 1;

      v_ent := format('T67-%s-%s-ab', v_a.posto, v_b.posto);
      perform public.painel_caixa_lancar('item', v_ent, v_conta, v_a.valor, v_a.origem,
                                         null, null, now(), 'T67', v_a.posto);
      perform public.painel_caixa_lancar('item', v_ent, v_conta, v_b.valor, v_b.origem,
                                         null, null, now(), 'T67', v_b.posto);
      select coalesce(sum(l.valor_usd), 0) into v_liq_ab
        from public.painel_caixa_lancamentos l where l.entidade_id = v_ent;

      v_ent := format('T67-%s-%s-ba', v_a.posto, v_b.posto);
      perform public.painel_caixa_lancar('item', v_ent, v_conta, v_b.valor, v_b.origem,
                                         null, null, now(), 'T67', v_b.posto);
      perform public.painel_caixa_lancar('item', v_ent, v_conta, v_a.valor, v_a.origem,
                                         null, null, now(), 'T67', v_a.posto);
      select coalesce(sum(l.valor_usd), 0) into v_liq_ba
        from public.painel_caixa_lancamentos l where l.entidade_id = v_ent;

      if v_liq_ab is distinct from v_b.valor or v_liq_ba is distinct from v_b.valor then
        v_falhas := v_falhas || format(' | posto %s x %s: ab=%s ba=%s esperado=%s',
          v_a.posto, v_b.posto, v_liq_ab, v_liq_ba, v_b.valor);
      end if;
    end loop;
  end loop;

  -- VARREDURA DE GENERALIZAÇÃO (rodada 14) · PISO. Mesma forma do T42: com
  -- zero pares, `v_falhas = ''` é verdade e o bloco aprova tendo medido nada.
  if v_falhas = '' and v_n >= 6 then
    raise exception 'RESULTADO: ok — T67 D53 o posto mais alto vence nos dois sentidos em % de % pares (piso 6)', v_n, v_n;
  end if;
  raise exception 'FALHA: T67 D53 precedência dependente da ordem — pares medidos=% (piso 6)%', v_n, v_falhas;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- T68 · MÉDIO 3 (rodada 12) — A QUARTA CONTA RECEBE ITEM
-- Medido em produção em 21/09/2026: `painel_teto_diario` tem quatro contas e
-- `arborcactus@gmail.com` (teto 500) não era citada por função nenhuma da fila.
-- Tinha orçamento e não podia receber um item sequer.
-- MUTAÇÃO: voltar a lista de contas para 3 — `fila_prompts_enfileirar` recusa.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_conta text := 'arborcactus@gmail.com';
  v_teto numeric;
  v_r jsonb;
  v_pull jsonb;
  v_id uuid;
begin
  delete from public.painel_frentes_sessoes where conta = v_conta;
  delete from public.painel_fila_prompts where conta = v_conta;
  -- PR #42 (9ª rodada): a 4ª conta nasce travada pela medição recente até a
  -- Routine dela existir (T99 prova a trava). Este bloco prova o CICLO de uma
  -- conta pronta, então a trava sai aqui, em voz alta — como faria o operador
  -- depois de configurar a Routine (ou a primeira medição, que destrava sozinha).
  update public.painel_teto_diario set exigir_medicao_recente = false where conta = v_conta;

  select teto_usd into v_teto from public.painel_teto_diario where conta = v_conta;

  -- A recusa da 4ª conta vem como EXCEÇÃO ("conta precisa ser uma das N contas
  -- da casa"), e exceção não tratada aborta o bloco antes do veredito — o
  -- vermelho viraria silêncio. Aqui ela é capturada e vira FALHA com nome.
  begin
    v_r := public.fila_prompts_enfileirar(
      (select valor from private.lifeboard_config where chave = 'load_secret'),
      jsonb_build_object('prompt', 'T68 a quarta conta recebe item de verdade',
                         'complexidade', 'baixa', 'conta', v_conta));
  exception when others then
    raise exception 'FALHA: T68 a 4ª conta foi RECUSADA no enfileiramento: %', sqlerrm;
  end;
  v_id := (v_r->>'id')::uuid;

  begin
    v_pull := public.fila_prompts_pegar_interno(v_conta, 'w-T68');
  exception when others then
    raise exception 'FALHA: T68 a 4ª conta foi RECUSADA no pull: %', sqlerrm;
  end;

  if v_teto = 500
     and v_r->>'conta' = v_conta
     and v_pull->'item'->>'id' = v_id::text then
    raise exception 'RESULTADO: ok — T68 a 4ª conta enfileira e o pull despacha: teto=% conta=% item=%',
      v_teto, v_r->>'conta', v_pull->'item'->>'id';
  end if;
  raise exception 'FALHA: T68 a 4ª conta não fecha o ciclo: teto=% conta_enfileirada=% item_despachado=%',
    coalesce(v_teto::text, 'sem linha'), coalesce(v_r->>'conta', 'null'),
    coalesce(v_pull->'item'->>'id', 'nenhum');
end $$;

-- ═════════════════════════════════════════════════════════════════════════════
-- RODADA 13 · T69 a T73 — o crédito que não vira teto, o headroom que desconta
-- a execução, a tela que sabe o que o banco sabe e o padrão de permissão
-- ═════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- T69 · ALTO 2 (rodada 12→13) — O HEADROOM DESCONTA O QUE ESTÁ EM EXECUÇÃO
-- O buraco que o crítico provou com uma linha: trocar, na 0027 §1,
--   `v_headroom := v_teto - v_medido - v_execucao;`
-- por
--   `v_headroom := v_teto - v_medido;`
-- deixava 68/68 blocos verdes e 1393 testes verdes — e no mesmo banco seis
-- pulls despachavam seis itens de US$ 120 contra um teto de 500 (reservado
-- 720). Nenhum dos 68 blocos punha item EM EXECUÇÃO e conferia o desconto: T16
-- mede só a parcela MEDIDA.
-- O caso aqui é o mínimo que pega a mutação: teto 500, um item de US$ 200 em
-- execução (heartbeat fresco), um item de US$ 350 esperando. Headroom honesto
-- = 500 − 0 − 200 = 300 < 350 → nada sai, `pulados = 1`. Com a mutação o
-- headroom vira 500 e o item de 350 é despachado.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_conta text := 'lsgpandora@gmail.com';
  v_em_voo uuid;
  v_espera uuid;
  v_pull jsonb;
  v_reservado numeric;
begin
  delete from public.painel_frentes_sessoes where conta = v_conta;
  delete from public.painel_fila_prompts where conta = v_conta;
  delete from public.painel_caixa_lancamentos where conta = v_conta;
  update public.painel_teto_diario set teto_usd = 500, exigir_medicao_recente = false
   where conta = v_conta;

  insert into public.painel_fila_prompts (conta, prompt, complexidade, modelo_sugerido)
  values (v_conta, 'T69 item em execução', 'maxima', 'Fable') returning id into v_em_voo;
  update public.painel_fila_prompts set custo_estimado_usd = 200 where id = v_em_voo;
  -- pelo caminho real: o pull põe o item em execução com heartbeat vivo
  perform public.fila_prompts_pegar_interno(v_conta, 'w-T69-voo');

  insert into public.painel_fila_prompts (conta, prompt, complexidade, modelo_sugerido)
  values (v_conta, 'T69 item esperando', 'maxima', 'Fable') returning id into v_espera;
  update public.painel_fila_prompts set custo_estimado_usd = 350 where id = v_espera;

  v_reservado := public.painel_fila_reservado(v_conta);
  v_pull := public.fila_prompts_pegar_interno(v_conta, 'w-T69-b');

  if v_reservado = 200
     and public.painel_fila_consumo_hoje(v_conta) = 0
     and (v_pull->>'headroom_usd')::numeric = 300
     and (v_pull->'item' is null or v_pull->'item' = 'null'::jsonb)
     and (v_pull->>'pulados')::int = 1
     and (select estado from public.painel_fila_prompts where id = v_espera) = 'na_fila' then
    raise exception 'RESULTADO: ok — T69 ALTO 2 o headroom desconta a execução: reservado=% headroom=% pulados=% (item de 350 ficou na fila)',
      v_reservado, v_pull->>'headroom_usd', v_pull->>'pulados';
  end if;
  raise exception 'FALHA: T69 ALTO 2 esperado reservado 200, headroom 300, nada despachado e pulados 1 — obteve reservado=% headroom=% despachado=% pulados=% estado_do_esperando=%',
    v_reservado, v_pull->>'headroom_usd',
    coalesce(v_pull->'item'->>'custoEstimadoUsd', 'nenhum'), v_pull->>'pulados',
    (select estado from public.painel_fila_prompts where id = v_espera);
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- T70 · CRÍTICO 1 · D54 — A ROTINA BAIXAR O NÚMERO DE ONTEM NÃO ABRE TETO HOJE
-- A Probe G do crítico, sem morte de item nenhuma: a rotina da conta publicou
-- US$ 400 ONTEM e hoje recalcula a MESMA sessão para US$ 40. O estorno inteiro
-- caía em hoje (−400 + 40) e o dia de hoje valia −360: medido pelo crítico,
-- `headroom_usd = 860,00` num teto de 500 e US$ 840 despachados.
-- Agora o estorno é limitado ao que esta entidade pôs em HOJE — nada —, hoje
-- fica em 0 e o pull nunca despacha mais que o teto.
-- MUTAÇÃO QUE DEIXA ESTE BLOCO VERMELHO: devolver o estorno inteiro na 0027 §6
-- (`v_estornar := v_liquido;` sem o `least(...)`), ou tirar o piso da 0028 §1.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_conta text := 'lsgpandora@gmail.com';
  v_id uuid;
  v_pull jsonb;
  v_ontem numeric;
  v_hoje numeric;
  v_headroom numeric;
  v_cru numeric;
  v_despachado numeric := 0;
begin
  delete from public.painel_frentes_sessoes where conta = v_conta;
  delete from public.painel_fila_prompts where conta = v_conta;
  delete from public.painel_caixa_lancamentos where conta = v_conta;
  update public.painel_teto_diario set teto_usd = 500, exigir_medicao_recente = false
   where conta = v_conta;

  -- ONTEM: a rotina publicou US$ 400 (dia passado só se semeia por insert —
  -- nenhuma função escreve em dia fechado, e é esse o ponto).
  insert into public.painel_caixa_lancamentos
    (dia, conta, valor_usd, origem, entidade_tipo, entidade_id, sessao_id, medido_em, precedencia, nota)
  values (public.painel_dia_operador() - 1, v_conta, 400, 'medido', 'sessao', 'sess-T70', 'sess-T70',
          now() - interval '20 hours', 40, 'semente T70: a rotina publicou ontem');
  insert into public.painel_frentes_sessoes (sessao_id, conta, titulo, estado, custo_usd, atualizado_em)
  values ('sess-T70', v_conta, 'sessão de ontem', 'idle', 400, now() - interval '20 hours');

  -- HOJE: a MESMA sessão é recalculada para US$ 40 (posto 40 contra posto 40 —
  -- a precedência não recusa; quem segura é a D54).
  update public.painel_frentes_sessoes
     set custo_usd = 40, atualizado_em = now() where sessao_id = 'sess-T70';

  v_ontem := public.painel_fila_consumo_do_dia(v_conta, public.painel_dia_operador() - 1);
  v_hoje  := public.painel_fila_consumo_hoje(v_conta);
  -- As DUAS paredes, cada uma no seu lugar: `v_cru` é o livro sem piso nenhum
  -- (a primeira parede, D54 na 0027 §6 — o dia não CHEGA a ficar negativo) e
  -- `v_headroom` é o que o pull usa (a segunda, o piso da 0028 §1). Conferir só
  -- uma deixa a outra passar por baixo.
  v_cru   := public.painel_caixa_do_dia(v_conta, public.painel_dia_operador());

  for i in 1..7 loop
    insert into public.painel_fila_prompts (conta, prompt, complexidade, modelo_sugerido)
    values (v_conta, 'T70 item ' || i, 'maxima', 'Fable') returning id into v_id;
    update public.painel_fila_prompts set custo_estimado_usd = 120 where id = v_id;
  end loop;

  for i in 1..7 loop
    v_pull := public.fila_prompts_pegar_interno(v_conta, 'w-T70-' || i);
    if i = 1 then v_headroom := (v_pull->>'headroom_usd')::numeric; end if;
    if v_pull->'item' is not null and v_pull->'item' <> 'null'::jsonb then
      v_despachado := v_despachado + (v_pull->'item'->>'custoEstimadoUsd')::numeric;
    end if;
  end loop;

  if v_ontem = 400 and v_hoje = 0 and v_cru = 0
     and v_headroom = 500 and v_despachado <= 500 then
    raise exception 'RESULTADO: ok — T70 D54 o crédito de ontem não virou teto: ontem=% hoje=% livro_cru=% headroom=% despachado=% (teto 500)',
      v_ontem, v_hoje, v_cru, v_headroom, v_despachado;
  end if;
  raise exception 'FALHA: T70 D54 esperado ontem 400, hoje 0, livro cru 0 (nunca negativo), headroom 500 e despacho <= 500 — obteve ontem=% hoje=% livro_cru=% headroom=% despachado=%',
    v_ontem, v_hoje, v_cru, v_headroom, v_despachado;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- T71 · CRÍTICO 1 · D54 — ITEM QUE MORRE ONTEM E FECHA HOJE MAIS BARATO
-- A Probe D do crítico, pela porta D26: o item morre ontem com estimativa de
-- US$ 120 (lançada ONTEM) e hoje o último dono volta com o real de US$ 3.
-- Medido antes: ontem=120, `hoje = −117`, `headroom_usd = 617,00` num teto de
-- 500 — e o pull despachava mais um item de 120 por cima do teto.
-- Agora: ontem continua 120 (rodada 9, intacta), hoje vale os 3 que foram
-- medidos hoje, e o headroom é 497 — nunca 617.
-- MUTAÇÃO: a mesma de T70 (estorno inteiro de volta na 0027 §6).
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_conta text := 'lsgpandora@gmail.com';
  v_id uuid;
  v_outro uuid;
  v_pull jsonb;
  v_ontem numeric;
  v_hoje numeric;
begin
  delete from public.painel_frentes_sessoes where conta = v_conta;
  delete from public.painel_fila_prompts where conta = v_conta;
  delete from public.painel_caixa_lancamentos where conta = v_conta;
  update public.painel_teto_diario set teto_usd = 500, exigir_medicao_recente = false
   where conta = v_conta;

  insert into public.painel_fila_prompts (conta, prompt, complexidade, modelo_sugerido)
  values (v_conta, 'T71 morreu ontem', 'maxima', 'Fable') returning id into v_id;
  update public.painel_fila_prompts
     set custo_estimado_usd = 120,
         estado = 'falhou', worker_id = null, ultimo_worker_id = 'w-T71', tentativas = 3,
         custo_usd = 120, custo_e_estimativa = true, custo_origem = 'estimativa',
         motivo_falha = 'expirou 3 vezes sem fechamento',
         concluido_em = (public.painel_dia_operador() - 1)::timestamp at time zone 'America/Sao_Paulo' + interval '23 hours'
   where id = v_id;
  insert into public.painel_caixa_lancamentos
    (dia, conta, valor_usd, origem, entidade_tipo, entidade_id, item_id, precedencia, nota)
  values (public.painel_dia_operador() - 1, v_conta, 120, 'estimativa', 'item', v_id::text, v_id, 10,
          'semente T71: a casa lançou no dia da morte');

  -- HOJE, pela porta D26: o último dono fecha com o número real.
  perform public.fila_prompts_fechar_interno(
    p_id => v_id, p_conta => v_conta, p_worker_id => 'w-T71',
    p_estado => 'concluida', p_custo_usd => 3, p_session_id => 'sess-T71');

  v_ontem := public.painel_fila_consumo_do_dia(v_conta, public.painel_dia_operador() - 1);
  v_hoje  := public.painel_fila_consumo_hoje(v_conta);

  insert into public.painel_fila_prompts (conta, prompt, complexidade, modelo_sugerido)
  values (v_conta, 'T71 item de 120', 'maxima', 'Fable') returning id into v_outro;
  update public.painel_fila_prompts set custo_estimado_usd = 120 where id = v_outro;
  v_pull := public.fila_prompts_pegar_interno(v_conta, 'w-T71-b');

  if v_ontem = 120 and v_hoje = 3 and (v_pull->>'headroom_usd')::numeric = 497 then
    raise exception 'RESULTADO: ok — T71 D54 ontem=% (não reescrito) hoje=% headroom=% (era -117 e 617)',
      v_ontem, v_hoje, v_pull->>'headroom_usd';
  end if;
  raise exception 'FALHA: T71 D54 esperado ontem 120, hoje 3 e headroom 497 — obteve ontem=% hoje=% headroom=%',
    v_ontem, v_hoje, v_pull->>'headroom_usd';
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- T72 · MÉDIO 3 (rodada 13) — A LISTAGEM MANDA O QUE O LIVRO SABE
-- O estado que o crítico mediu pela porta real: item em execução cuja sessão
-- já publicou US$ 300; o operador cancela. A LINHA fica
-- `estado=cancelada custo_usd=50 custo_origem=estimativa` — e sobre ela a tela
-- oferecia o botão de ajuste que a RPC recusa, e prometia US$ 50 entrando no
-- gasto de hoje quando entram US$ 0,00.
-- A tela decidia pela COLUNA do item; o banco decide pelo LANÇAMENTO VIVO da
-- entidade. Agora `fila_prompts_listar` manda os dois, e eles divergem à vista:
-- `custoOrigem = estimativa` (a coluna) contra `livroOrigem = medido`,
-- `livroPrecedencia = 40`, `livroLiquidoUsd = 300` (o livro).
-- MUTAÇÃO QUE DEIXA ESTE BLOCO VERMELHO: tirar os três campos da 0028 §2.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_conta text := 'lsgpandora@gmail.com';
  v_id uuid;
  v_r jsonb;
  v_linha jsonb;
  v_cancel jsonb;
begin
  delete from public.painel_frentes_sessoes where conta = v_conta;
  delete from public.painel_fila_prompts where conta = v_conta;
  delete from public.painel_caixa_lancamentos where conta = v_conta;

  insert into public.painel_fila_prompts (conta, prompt, complexidade, modelo_sugerido)
  values (v_conta, 'T72 sessão já publicou', 'maxima', 'Fable') returning id into v_id;
  update public.painel_fila_prompts set custo_estimado_usd = 50 where id = v_id;

  perform public.fila_prompts_pegar_interno(v_conta, 'w-T72');
  perform public.fila_prompts_heartbeat_interno(v_id, v_conta, 'w-T72', 'sess-T72');
  insert into public.painel_frentes_sessoes (sessao_id, conta, titulo, estado, custo_usd, atualizado_em)
  values ('sess-T72', v_conta, 'sessão medida', 'idle', 300, now());

  v_cancel := public.fila_prompts_cancelar(
    (select valor from private.lifeboard_config where chave = 'load_secret'), v_id);

  v_r := public.fila_prompts_listar(
    (select valor from private.lifeboard_config where chave = 'load_secret'), 50);
  select l into v_linha from jsonb_array_elements(v_r->'fila') as l where l->>'id' = v_id::text;

  if v_linha->>'custoOrigem' = 'estimativa'
     and (v_linha->>'custoUsd')::numeric = 50
     and v_linha->>'livroOrigem' = 'medido'
     and (v_linha->>'livroPrecedencia')::int = 40
     and (v_linha->>'livroLiquidoUsd')::numeric = 300
     and (v_cancel->>'custo_lancado_usd')::numeric = 0 then
    raise exception 'RESULTADO: ok — T72 a listagem separa a COLUNA do LIVRO: custoOrigem=% custoUsd=% · livroOrigem=% posto=% liquido=%',
      v_linha->>'custoOrigem', v_linha->>'custoUsd',
      v_linha->>'livroOrigem', v_linha->>'livroPrecedencia', v_linha->>'livroLiquidoUsd';
  end if;
  raise exception 'FALHA: T72 esperado custoOrigem=estimativa/custoUsd=50 com livroOrigem=medido/posto=40/liquido=300 — obteve linha=% cancelamento=%',
    coalesce(v_linha::text, 'item não veio na listagem'), v_cancel;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- T73 · BAIXO 4 (rodada 13) + MÉDIO 3 (rodada 13) + ALTO 1 (rodada 14) —
-- NENHUMA FUNÇÃO DESTE BANCO TEM EXECUTE PÚBLICO ALÉM DAS EXCEÇÕES DECLARADAS
-- A versão da rodada 13 tinha este mesmo título e percorria um ARRAY DE CINCO
-- NOMES escritos à mão: quatro funções abertas ficavam de fora. A rodada 13
-- trocou os cinco nomes por uma varredura de `pg_proc` — e recortou a
-- varredura em TRÊS PREFIXOS DE NOME (`fila_prompts_%`, `lifeboard_%`,
-- `painel_%`). O crítico da rodada 14 mediu o que isso vale: criou, no esquema
-- `public`, uma função `caixa_teto_subir` `security definer` sem `revoke` —
-- nome fora dos três prefixos —, os CINCO PORTÕES ficaram verdes, e `anon`
-- subiu o teto
-- do dia de US$ 500 para US$ 999.999 pela função que a varredura não enxerga.
-- `create function` concede EXECUTE a PUBLIC por padrão, e nada no
-- repositório obriga função nova a obedecer à convenção de nome: não há lint
-- de nome, não há gatilho de DDL, não há teste comparando a lista de funções
-- do esquema com a lista de prefixos. Era o vício de novo, um nível acima — a
-- guarda media a HIPÓTESE ("toda função da casa se chama assim") e não o
-- PRODUTO ("nenhuma função deste banco está aberta").
-- AGORA A VARREDURA PARTE DO ESQUEMA: todas as funções de `public` e de
-- `private`, sem olhar o nome. As 36 funções do `pgcrypto` saem por
-- DEPENDÊNCIA DE EXTENSÃO (`pg_depend.deptype = 'e'`) — não por prefixo —, que
-- é o único recorte que uma extensão nova não atravessa.
-- MUTAÇÃO QUE DEIXA ESTE BLOCO VERMELHO: tirar qualquer `revoke` da 0027 §7b,
-- da 0028 §3 ou da 0029 §9 · criar função nova (qualquer nome, qualquer um dos
-- dois esquemas) sem `revoke` · pôr na allowlist um nome que não precisa estar
-- lá (o bloco também reprova exceção que sobra) · recortar a varredura de
-- volta por nome (o piso de varridas cai).
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  -- As ÚNICAS funções deste banco que podem ter execute para
  -- public/anon/authenticated, e por quê:
  --   · as 8 PORTAS COM SEGREDO — a tela as chama como `anon`/`authenticated`
  --     e elas mesmas exigem o `load_secret` antes de qualquer leitura;
  --   · `painel_frentes_leitor_autorizado` — é PREDICADO DE RLS (0007, linhas
  --     174 e 178, `for select to authenticated using (...)`). A policy é
  --     avaliada pelo papel do leitor: sem execute, a leitura do painel de
  --     frentes quebra para todo mundo;
  --   · `painel_dia_operador` — `(instante at time zone 'America/Sao_Paulo')
  --     ::date`, sem acesso a dado nenhum, chamada de dentro de gatilhos que
  --     disparam com o papel de quem escreve. Não é SECURITY DEFINER, então
  --     revogá-la quebraria esses gatilhos sem fechar buraco nenhum: ela não
  --     lê nem escreve linha alguma.
  -- A lista é QUALIFICADA POR ESQUEMA: nada em `private` é exceção (a 0029 §9
  -- revogou as duas que havia), e o último bloco desta suíte — o do esquema
  -- `private` — mede a premissa disso: que `private` não concede USAGE a
  -- anon/authenticated/public.
  -- O separador é `|`, não `.`: `public.<fn>` escrito aqui seria lido por duas
  -- guardas antigas de `prompts-espelho-sql.test.ts` como "este bloco CHAMA a
  -- função" — uma exige que toda `public.<fn>(` citada exista numa migration,
  -- a outra exige que todo bloco que chame `public.fila_prompts_*` limpe a
  -- conta de prova. Nenhuma das duas se aplica a um bloco que só lê o
  -- catálogo, e reescrever a guarda para abrir exceção seria afrouxá-la.
  v_permitidas text[] := array[
    'public|fila_prompts_enfileirar', 'public|fila_prompts_listar',
    'public|fila_prompts_cancelar', 'public|fila_prompts_ajustar_custo',
    'public|fila_prompts_consumo_do_dia', 'public|fila_prompts_extrato_do_dia',
    'public|lifeboard_load', 'public|lifeboard_mutate',
    'public|painel_frentes_leitor_autorizado', 'public|painel_dia_operador'];
  -- O piso: a varredura tem de ter MEDIDO o esquema, não um pedaço dele.
  -- Recortar por nome, por prefixo, ou esquecer `private` derruba este número
  -- e o bloco fica vermelho sem depender de nenhuma função estar aberta.
  -- Medido no banco com as 29 migrations aplicadas: 46 em `public` + 2 em
  -- `private` = 48 funções da casa, e 36 do `pgcrypto` excluídas por extensão.
  v_piso_varridas int := 46;
  v_sobrou text := '';
  v_exigidas text := '';
  v_varridas int := 0;
  v_publicas int := 0;
  v_de_extensao int := 0;
  -- SABOTAGEM MINHA, rodada 14 (S6): reverter a varredura aos TRÊS PREFIXOS
  -- deixava este bloco VERDE — medido, 85/85. O piso não pega o recorte,
  -- porque hoje quase toda função da casa OBEDECE à convenção de nome: 46 das
  -- 48 casam com os prefixos e o piso de 46 continua satisfeito. O recorte só
  -- aparecia quando já existia uma função fora dele, que é tarde.
  -- Então o UNIVERSO passa a ser medido, e não suposto: `v_do_esquema` conta,
  -- por uma consulta INDEPENDENTE, quantas funções da casa existem nos dois
  -- esquemas, e o bloco exige que a varredura tenha visto TODAS elas. Narrar
  -- o `where` do laço para menos faz os dois números divergirem; narrar os
  -- dois exige mexer em duas consultas, e isso aparece no diff.
  v_do_esquema int := 0;
  rec record;
  v_nome text;
begin
  select count(*) into v_do_esquema
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname in ('public', 'private')
     and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e');
  select count(*) into v_de_extensao
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname in ('public', 'private')
     and exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e');

  for rec in
    select n.nspname || '|' || p.proname as nome_completo,
           (has_function_privilege('public', p.oid, 'execute')
            or has_function_privilege('anon', p.oid, 'execute')
            or has_function_privilege('authenticated', p.oid, 'execute')) as aberta
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname in ('public', 'private')
       -- o ÚNICO recorte: o que pertence a uma extensão não é código da casa
       and not exists (select 1 from pg_depend d
                        where d.objid = p.oid and d.deptype = 'e')
     order by 1
  loop
    v_varridas := v_varridas + 1;
    if rec.aberta then
      v_publicas := v_publicas + 1;
      if not (rec.nome_completo = any (v_permitidas)) then
        v_sobrou := v_sobrou || rec.nome_completo || ' ';
      end if;
    end if;
  end loop;

  -- e o outro sentido: exceção que ninguém mais precisa é exceção que some
  foreach v_nome in array v_permitidas loop
    if not exists (
      select 1 from pg_proc p
       join pg_namespace n on n.oid = p.pronamespace
       where n.nspname || '|' || p.proname = v_nome
         and (has_function_privilege('public', p.oid, 'execute')
              or has_function_privilege('anon', p.oid, 'execute')
              or has_function_privilege('authenticated', p.oid, 'execute')))
    then
      v_exigidas := v_exigidas || v_nome || ' ';
    end if;
  end loop;

  if v_sobrou = '' and v_exigidas = ''
     and v_varridas >= v_piso_varridas
     and v_varridas = v_do_esquema then
    raise exception 'RESULTADO: ok — T73 varreu % de % funções da casa em public+private (% do pgcrypto fora por extensão); % com execute público, todas na lista de exceções justificadas',
      v_varridas, v_do_esquema, v_de_extensao, v_publicas;
  end if;
  raise exception 'FALHA: T73 varridas=% de % que existem nos esquemas public+private (piso %) — varrer menos do que existe é afirmar propriedade universal sobre um pedaço · com execute público FORA da lista: [%] · na lista mas SEM execute (exceção que sobra): [%]',
    v_varridas, v_do_esquema, v_piso_varridas, v_sobrou, v_exigidas;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- T74 · CRÍTICO 1 · a SEGUNDA parede — DIA JÁ NEGATIVO não vira teto
-- D54 (0027 §6) impede o dia negativo de NASCER. Mas produção rodou da 0019 à
-- 0026 com o estorno inteiro: lá pode já existir um dia com soma negativa, e
-- ele abriria teto na primeira leitura depois do deploy. O piso da 0028 §1 é a
-- parede que vale para esse dado — e ela não pode ser exercitada pela porta
-- real, porque a porta real não produz mais o defeito. Por isso o seed aqui é
-- um `insert` direto, com a FORMA que a versão anterior gravava: o estorno
-- inteiro de um lançamento de ONTEM caindo em HOJE.
-- Sem o piso: consumo −360, `headroom_usd` 860 num teto de 500.
-- MUTAÇÃO QUE DEIXA ESTE BLOCO VERMELHO: tirar o `greatest(..., 0)` da 0028 §1.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_conta text := 'lsgpandora@gmail.com';
  v_id uuid;
  v_pull jsonb;
  v_cru numeric;
  v_para_o_teto numeric;
begin
  delete from public.painel_frentes_sessoes where conta = v_conta;
  delete from public.painel_fila_prompts where conta = v_conta;
  delete from public.painel_caixa_lancamentos where conta = v_conta;
  update public.painel_teto_diario set teto_usd = 500, exigir_medicao_recente = false
   where conta = v_conta;

  insert into public.painel_caixa_lancamentos
    (dia, conta, valor_usd, origem, entidade_tipo, entidade_id, sessao_id, medido_em, precedencia, nota)
  values (public.painel_dia_operador() - 1, v_conta, 400, 'medido', 'sessao', 'sess-T74', 'sess-T74',
          now() - interval '20 hours', 40, 'semente T74: publicado ontem');
  -- a forma ANTIGA, gravada à mão: estorno inteiro de ontem lançado em HOJE
  insert into public.painel_caixa_lancamentos
    (dia, conta, valor_usd, origem, entidade_tipo, entidade_id, sessao_id, precedencia, nota)
  values (public.painel_dia_operador(), v_conta, -400, 'estorno', 'sessao', 'sess-T74', 'sess-T74', 40,
          'semente T74: o estorno inteiro que a versão anterior gravava');
  insert into public.painel_caixa_lancamentos
    (dia, conta, valor_usd, origem, entidade_tipo, entidade_id, sessao_id, medido_em, precedencia, nota)
  values (public.painel_dia_operador(), v_conta, 40, 'medido', 'sessao', 'sess-T74', 'sess-T74',
          now(), 40, 'semente T74: o número novo');

  v_cru         := public.painel_caixa_do_dia(v_conta, public.painel_dia_operador());
  v_para_o_teto := public.painel_fila_consumo_hoje(v_conta);

  insert into public.painel_fila_prompts (conta, prompt, complexidade, modelo_sugerido)
  values (v_conta, 'T74 item de 120', 'maxima', 'Fable') returning id into v_id;
  update public.painel_fila_prompts set custo_estimado_usd = 120 where id = v_id;
  v_pull := public.fila_prompts_pegar_interno(v_conta, 'w-T74');

  if v_cru = -360 and v_para_o_teto = 0 and (v_pull->>'headroom_usd')::numeric = 500 then
    raise exception 'RESULTADO: ok — T74 o dia negativo do livro antigo (%) não vira teto: para o teto=% headroom=% (sem o piso seria 860)',
      v_cru, v_para_o_teto, v_pull->>'headroom_usd';
  end if;
  raise exception 'FALHA: T74 esperado livro cru -360, para o teto 0 e headroom 500 — obteve cru=% teto=% headroom=%',
    v_cru, v_para_o_teto, v_pull->>'headroom_usd';
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- T75 · ALTO 2 (rodada 13) — A PORTA DE FECHAMENTO ACEITA O NÚMERO REAL, AINDA
-- QUE ELE SEJA MAIOR QUE O TETO DO DIA
-- O limite por item (`0 a 500`) tinha virado o MESMO número do teto diário, e
-- a porta que REGISTRA o gasto recusava a medição. O crítico mediu o desfecho:
-- item de estimativa 120 que custou 620 era recusado, morria em 45 min valendo
-- 120 no livro e abria US$ 380 de teto que não existiam — "num teto, errar
-- para baixo é buraco" (0027 §6).
-- Este bloco prova os dois lados da regra nova: o 620 REAL entra no livro, e o
-- pull seguinte NÃO despacha nada, porque quem barra despacho é o headroom.
-- MUTAÇÃO QUE DEIXA ESTE BLOCO VERMELHO: voltar `p_custo_usd > 500` na 0027 §2
-- (ou apontar o limite para o teto do dia em vez de painel_custo_maximo_por_item).
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_conta text := 'lsgpandora@gmail.com';
  v_id uuid;
  v_outro uuid;
  v_r jsonb;
  v_pull jsonb;
  v_livro numeric;
  v_custo numeric;
  v_origem text;
begin
  delete from public.painel_frentes_sessoes where conta = v_conta;
  delete from public.painel_fila_prompts where conta = v_conta;
  delete from public.painel_caixa_lancamentos where conta = v_conta;
  update public.painel_teto_diario set teto_usd = 500, exigir_medicao_recente = false
   where conta = v_conta;

  insert into public.painel_fila_prompts (conta, prompt, complexidade, modelo_sugerido)
  values (v_conta, 'T75 item que custou mais que o teto', 'maxima', 'Fable') returning id into v_id;
  -- `criado_em` explícito: dentro de UM MESMO bloco o `now()` é o mesmo para
  -- os dois inserts, e o desempate do pull cairia no uuid — o bloco passaria
  -- ou não conforme o sorteio.
  update public.painel_fila_prompts
     set custo_estimado_usd = 120, criado_em = now() - interval '10 minutes' where id = v_id;
  -- um segundo item barato, na fila, para o pull seguinte ter o que tentar
  insert into public.painel_fila_prompts (conta, prompt, complexidade, modelo_sugerido)
  values (v_conta, 'T75 item barato na fila', 'baixa', 'Haiku') returning id into v_outro;
  update public.painel_fila_prompts
     set custo_estimado_usd = 5, criado_em = now() - interval '1 minute' where id = v_outro;

  perform public.fila_prompts_pegar_interno(v_conta, 'w-T75');

  -- a sessão volta com o número REAL: 620, acima do teto de 500
  v_r := public.fila_prompts_fechar_interno(
           p_id => v_id, p_conta => v_conta, p_worker_id => 'w-T75',
           p_estado => 'concluida', p_custo_usd => 620, p_session_id => 'sess-T75');

  select custo_usd, custo_origem into v_custo, v_origem
    from public.painel_fila_prompts where id = v_id;
  v_livro := public.painel_caixa_do_dia(v_conta, public.painel_dia_operador());

  -- e agora o pull: o dia estourou, nada mais sai
  v_pull := public.fila_prompts_pegar_interno(v_conta, 'w-T75b');

  if (v_r->>'ok')::boolean and v_custo = 620 and v_origem = 'medido' and v_livro = 620
     and (v_pull->>'item') is null and (v_pull->>'headroom_usd')::numeric = 0 then
    raise exception 'RESULTADO: ok — T75 ALTO 2 o número real entrou no livro (custo=% origem=% livro=%) e o pull parou (headroom=%, item=null)',
      v_custo, v_origem, v_livro, v_pull->>'headroom_usd';
  end if;
  raise exception 'FALHA: T75 esperado custo=620 origem=medido livro=620 headroom=0 item=null — obteve retorno=% custo=% origem=% livro=% pull=%',
    v_r, v_custo, v_origem, v_livro, v_pull;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- T76 · ALTO 2 (rodada 13) — A CORREÇÃO DO OPERADOR TAMBÉM ACEITA O NÚMERO REAL
-- `fila_prompts_ajustar_custo` (0027 §10) tinha a mesma trava de 500. Um item
-- que morreu valendo a estimativa e custou 620 não podia ser corrigido nem
-- pela tela: o livro ficava com o palpite para sempre.
-- MUTAÇÃO QUE DEIXA ESTE BLOCO VERMELHO: voltar `p_custo_usd > 500` na 0027 §10.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_conta text := 'lsgpandora@gmail.com';
  v_segredo text := (select valor from private.lifeboard_config where chave = 'load_secret');
  v_id uuid;
  v_ajuste jsonb;
  v_livro numeric;
  v_origem text;
begin
  delete from public.painel_frentes_sessoes where conta = v_conta;
  delete from public.painel_fila_prompts where conta = v_conta;
  delete from public.painel_caixa_lancamentos where conta = v_conta;
  update public.painel_teto_diario set teto_usd = 500, exigir_medicao_recente = false
   where conta = v_conta;

  insert into public.painel_fila_prompts (conta, prompt, complexidade, modelo_sugerido)
  values (v_conta, 'T76 corrigido acima do teto', 'maxima', 'Fable') returning id into v_id;
  update public.painel_fila_prompts
     set estado = 'falhou', worker_id = null, ultimo_worker_id = 'w-T76',
         tentativas = 3, motivo_falha = 'expirou 3 vezes sem fechamento',
         custo_usd = 120, custo_e_estimativa = true, custo_origem = 'estimativa',
         pego_em = now() - interval '3 hours', concluido_em = now()
   where id = v_id;
  perform public.painel_caixa_lancar_item(v_id, 120, 'estimativa', null, 'semente T76');

  v_ajuste := public.fila_prompts_ajustar_custo(v_segredo, v_id, 620, null);
  select custo_origem into v_origem from public.painel_fila_prompts where id = v_id;
  v_livro := public.painel_caixa_do_dia(v_conta, public.painel_dia_operador());

  if (v_ajuste->>'custo_usd')::numeric = 620 and v_origem = 'operador' and v_livro = 620 then
    raise exception 'RESULTADO: ok — T76 ALTO 2 o operador corrigiu 120 → 620 acima do teto: origem=% livro=%',
      v_origem, v_livro;
  end if;
  raise exception 'FALHA: T76 esperado custo_usd=620 origem=operador livro=620 — obteve ajuste=% origem=% livro=%',
    v_ajuste, v_origem, v_livro;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- T77 · ALTO 2 (rodada 13) — O QUE SOBRA É SANIDADE, E ELA CONTINUA DE PÉ
-- Aceitar o número real não é aceitar qualquer número: `10^9` (unidade trocada,
-- dedo escorregado) continua barrado nas DUAS portas, e a recusa diz que o
-- limite não é o teto do dia. O número vem de um lugar só,
-- `public.painel_custo_maximo_por_item()` — derivado, não copiado em quatro
-- pontos, que foi como o 500 se espalhou.
-- MUTAÇÃO QUE DEIXA ESTE BLOCO VERMELHO: tirar a faixa de sanidade das portas,
-- ou fazer `painel_custo_maximo_por_item()` devolver o teto do dia.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_conta text := 'lsgpandora@gmail.com';
  v_segredo text := (select valor from private.lifeboard_config where chave = 'load_secret');
  v_id uuid;
  v_sanidade numeric;
  v_erro_fechar text := '';
  v_erro_ajuste text := '';
  v_estado text;
begin
  delete from public.painel_frentes_sessoes where conta = v_conta;
  delete from public.painel_fila_prompts where conta = v_conta;
  delete from public.painel_caixa_lancamentos where conta = v_conta;
  update public.painel_teto_diario set teto_usd = 500, exigir_medicao_recente = false
   where conta = v_conta;

  v_sanidade := public.painel_custo_maximo_por_item();

  insert into public.painel_fila_prompts (conta, prompt, complexidade, modelo_sugerido)
  values (v_conta, 'T77 unidade trocada', 'maxima', 'Fable') returning id into v_id;
  update public.painel_fila_prompts set custo_estimado_usd = 120 where id = v_id;
  perform public.fila_prompts_pegar_interno(v_conta, 'w-T77');

  begin
    perform public.fila_prompts_fechar_interno(
      p_id => v_id, p_conta => v_conta, p_worker_id => 'w-T77',
      p_estado => 'concluida', p_custo_usd => 1000000000, p_session_id => 'sess-T77');
  exception when others then v_erro_fechar := sqlerrm;
  end;

  select estado into v_estado from public.painel_fila_prompts where id = v_id;

  begin
    perform public.fila_prompts_ajustar_custo(v_segredo, v_id, 1000000000, null);
  exception when others then v_erro_ajuste := sqlerrm;
  end;

  if v_sanidade > 500
     and v_erro_fechar like '%fora da faixa de sanidade%'
     and v_erro_fechar like '%não é o teto do dia%'
     and v_erro_ajuste like '%precisa ser um número entre 0 e%'
     and v_estado = 'pega' then
    raise exception 'RESULTADO: ok — T77 sanidade=% recusa o absurdo nas duas portas e não fecha o item (estado=%): "%"',
      v_sanidade, v_estado, left(v_erro_fechar, 90);
  end if;
  raise exception 'FALHA: T77 esperado sanidade>500, recusa nas duas portas e item ainda pega — obteve sanidade=% estado=% fechar="%" ajuste="%"',
    v_sanidade, v_estado, v_erro_fechar, v_erro_ajuste;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- T78 · MÉDIO 5 (rodada 13) — O ORÇAMENTO DA CASA É 4 × 500 = US$ 2.000/DIA
-- A 0027 §4 semeia QUATRO contas com teto 500. A régua da casa
-- `teto-de-gasto-diario` dizia "500 por conta, nas TRÊS" — US$ 1.500 — e a
-- própria régua chama isso de violação ("alterar a trava sem atualizar este
-- arquivo"). Nenhuma guarda somava teto nem comparava com a régua: o total da
-- casa subiu 33% sem uma linha de aviso. O operador confirmou US$ 2.000/dia em
-- 22/09/2026 e a régua foi atualizada no mesmo ato.
-- Este bloco é a soma feita NO BANCO, depois de aplicar 0001…0028: é ele que
-- pega conta nova entrando sem ninguém reparar no orçamento total.
-- MUTAÇÃO QUE DEIXA ESTE BLOCO VERMELHO: acrescentar uma 5ª conta à seed da
-- 0027 §4 · mudar o teto de qualquer conta · tirar uma conta da seed.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_contas int;
  v_total numeric;
  v_fora text := '';
begin
  select count(*), coalesce(sum(teto_usd), 0) into v_contas, v_total
    from public.painel_teto_diario;

  select string_agg(conta || '=' || teto_usd, ' ' order by conta) into v_fora
    from public.painel_teto_diario where teto_usd <> 500;

  if v_contas = 4 and v_total = 2000 and v_fora is null then
    raise exception 'RESULTADO: ok — T78 o orçamento da casa é % contas × 500 = US$ %/dia (régua teto-de-gasto-diario, decisão de 14/09 confirmada em 22/09)',
      v_contas, v_total;
  end if;
  raise exception 'FALHA: T78 esperado 4 contas somando 2000 e nenhuma fora de 500 — obteve contas=% total=% fora_de_500=[%]',
    v_contas, v_total, coalesce(v_fora, '');
end $$;

-- ═════════════════════════════════════════════════════════════════════════════
-- RODADA 14 · T79 a T85 — a estimativa que não pode ser zero, o dia sem espaço
-- que não despacha, a trava do pull, a lista de contas com uma fonte só, a 4ª
-- conta atravessando TODAS as portas, a sanidade amarrada à coluna e o
-- esquema `private` fechado
-- ═════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- T79 · CRÍTICO 5 (rodada 14) — ESTIMATIVA ZERO NÃO É ESTIMATIVA (paredes 1 e 2)
-- O achado que mordia SEM ninguém mexer numa linha de código: a check da 0009
-- era `usd >= 0`, e `painel_custo_estimado` é, pelo `DEPLOY.md`, a tabela que o
-- operador ajusta. Zero é o número que alguém escreve para "Haiku é de graça".
-- Com uma complexidade em zero, o pull despacha TODOS os itens dela, um por
-- disparo, sem nunca reduzir o espaço livre: `0 <= headroom` é sempre verdade,
-- `painel_fila_reservado` soma zero e o gatilho de admissão não recusa
-- (`0 > 500` é falso). Medido pelo crítico: 6 sessões de Claude em voo na
-- mesma conta, reserva de US$ 0, painel anunciando US$ 499 livres.
-- `grep painel_custo_estimado` na suíte inteira, antes deste bloco: ZERO
-- ocorrências — o achado atravessava 78 blocos porque nenhum deles olhava a
-- tabela das estimativas.
-- POR QUE AS DUAS PAREDES DE BAIXO SÃO AS QUE CARREGAM O PESO. O crítico
-- pediu duas coisas: `CHECK (usd > 0)` e `v_headroom > 0` no pull. Medido aqui
-- (banco descartável, tudo dentro de `do $$ … raise $$`): com as duas paredes
-- de baixo derrubadas e o dia COM espaço (teto 500, 1 medido, headroom 499), a
-- parede do headroom não segura nada — seis pulls despacham SEIS itens, seis
-- sessões em voo, reserva US$ 0, painel anunciando US$ 499. `v_headroom > 0`
-- só cobre o dia SEM espaço (é o T80). Quem mata o cenário do crítico é a
-- estimativa deixar de poder ser zero, e é por isso que são TRÊS paredes e não
-- duas: a da tabela, a da coluna do item e a do pull.
-- ESTE BLOCO PROVA AS DUAS PAREDES DE BAIXO, e prova que elas são
-- INDEPENDENTES (não uma corrente):
--   parede 1 — `painel_custo_estimado.usd > 0`: o `update` do operador é
--     recusado pelo banco, em português;
--   parede 2 — `painel_fila_prompts.custo_estimado_usd > 0`: com a parede 1
--     derrubada dentro do bloco (o mundo antes da 0029), o item de estimativa
--     zero ainda não entra na fila.
-- MUTAÇÃO QUE DEIXA ESTE BLOCO VERMELHO: voltar qualquer das duas checks para
-- `>= 0` · apagar uma linha de `painel_custo_estimado` · pôr uma complexidade
-- em zero na seed.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_conta text := 'lsgpandora@gmail.com';
  v_erro_tabela text := '';
  v_erro_porta  text := '';
  v_erro_coluna text := '';
  v_complexidades int;
  v_abaixo_do_piso int;
  v_id uuid;
  v_id_legitimo uuid;
begin
  delete from public.painel_frentes_sessoes where conta = v_conta;
  delete from public.painel_fila_prompts where conta = v_conta;

  -- as quatro complexidades existem e NENHUMA está abaixo do piso (a tabela foi
  -- MEDIDA, não apenas "não achei linha ruim").
  -- RODADA 15: era `filter (where usd <= 0)` — a medição conferia o CASO (zero)
  -- e não a CLASSE. `usd = 0.0001` passava por aqui de cabeça erguida, e foi
  -- com ele que o coordenador despachou 40 sessões contra US$ 1,00 de espaço.
  select count(*), count(*) filter (where usd < public.painel_custo_minimo_por_item())
    into v_complexidades, v_abaixo_do_piso
    from public.painel_custo_estimado;

  -- um item LEGÍTIMO, criado com a tabela de estimativas sã: é sobre ele que a
  -- parede 3 é medida (o `update` direto na coluna, que a porta não vê).
  insert into public.painel_fila_prompts (conta, prompt, complexidade, modelo_sugerido)
  values (v_conta, 'T79 item legítimo', 'baixa', 'Haiku') returning id into v_id_legitimo;

  -- ── parede 1 · o operador não consegue zerar a estimativa ────────────────
  begin
    update public.painel_custo_estimado set usd = 0 where complexidade = 'baixa';
    v_erro_tabela := '(o update passou — estimativa zero foi aceita)';
  exception when others then v_erro_tabela := sqlerrm;
  end;

  -- ── parede 2 · com a parede 1 no chão, a PORTA DE ADMISSÃO recusa ────────
  -- Derrubar a check aqui dentro é legítimo: DDL é transacional e o bloco
  -- termina em `raise`, então a constraint volta. O que se prova é que as
  -- paredes são independentes — se a de cima cair num banco antigo, a de baixo
  -- ainda impede o item de estimativa zero de existir.
  -- RODADA 15: a porta de admissão (`painel_fila_prompts_checar_teto`, 0030 §9)
  -- passou a recusar em PORTUGUÊS antes de a constraint falar grafia de
  -- constraint na cara de quem chama. Ela é a parede 2; a coluna virou a 3.
  alter table public.painel_custo_estimado drop constraint painel_custo_estimado_usd_check;
  update public.painel_custo_estimado set usd = 0 where complexidade = 'baixa';

  begin
    insert into public.painel_fila_prompts (conta, prompt, complexidade, modelo_sugerido)
    values (v_conta, 'T79 item de graça', 'baixa', 'Haiku') returning id into v_id;
    v_erro_porta := '(o insert passou — item de estimativa zero entrou na fila)';
  exception when others then v_erro_porta := sqlerrm;
  end;

  -- ── parede 3 · a COLUNA, contra o `update` DIRETO ────────────────────────
  -- A porta de admissão deriva a estimativa e recusa (parede 2). A parede 3 é
  -- para quem não passa pela porta: um `update` na coluna de um item que já
  -- está na fila. É este o caminho que o gatilho não vê — ele é BEFORE INSERT.
  -- (O item legítimo foi criado no começo do bloco, quando a tabela de
  -- estimativas ainda estava sã: é o mesmo item que a rodada 14 não tinha.)
  begin
    update public.painel_fila_prompts set custo_estimado_usd = 0 where id = v_id_legitimo;
    v_erro_coluna := '(o update passou — item de estimativa zero ficou na fila)';
  exception when others then v_erro_coluna := sqlerrm;
  end;

  if v_complexidades = 4
     and v_abaixo_do_piso = 0
     and v_erro_tabela like '%painel_custo_estimado_usd_check%'
     and v_erro_porta like '%abaixo do piso%'
     and v_erro_coluna like '%painel_fila_prompts_custo_estimado_check%' then
    raise exception 'RESULTADO: ok — T79 % complexidades, nenhuma abaixo do piso de US$ % · parede 1 recusou o update ("%") · parede 2 (porta, em português) recusou o item ("%") · parede 3 (coluna) recusou o item ("%")',
      v_complexidades, public.painel_custo_minimo_por_item(),
      left(v_erro_tabela, 50), left(v_erro_porta, 50), left(v_erro_coluna, 50);
  end if;
  raise exception 'FALHA: T79 esperado 4 complexidades sem estimativa abaixo do piso e as TRÊS paredes recusando — obteve complexidades=% abaixo_do_piso=% parede1="%" parede2="%" parede3="%"',
    v_complexidades, v_abaixo_do_piso, v_erro_tabela, v_erro_porta, v_erro_coluna;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- T80 · CRÍTICO 5 (rodada 14) — DIA SEM ESPAÇO NÃO DESPACHA (parede 3)
-- A terceira parede, e a única que vale mesmo se as duas de baixo caírem por
-- um banco antigo ou por um `update` direto: a condição do pull era
-- `f.custo_estimado_usd <= v_headroom`, e `0 <= 0` é VERDADE. Um item de custo
-- declarado zero atravessava um dia SEM espaço nenhum.
-- O caso: teto 500, dia já com 500 medidos no livro (headroom exatamente 0),
-- as duas paredes de baixo derrubadas dentro do bloco e um item de estimativa
-- ZERO na fila. Seis pulls seguidos — que é exatamente o que o crítico mediu,
-- seis sessões em voo — e nenhum item sai. A reserva continua em zero porque
-- nada foi despachado, não porque o despacho não custa.
-- MUTAÇÃO QUE DEIXA ESTE BLOCO VERMELHO: tirar `and v_headroom > 0` da
-- condição do pull na 0029 §6.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_conta text := 'lsgpandora@gmail.com';
  v_id uuid;
  v_pull jsonb;
  v_despachados int := 0;
  v_i int;
  v_medido numeric;
  v_headroom numeric;
  v_reservado numeric;
  v_em_voo int;
begin
  delete from public.painel_frentes_sessoes where conta = v_conta;
  delete from public.painel_fila_prompts where conta = v_conta;
  delete from public.painel_caixa_lancamentos where conta = v_conta;
  update public.painel_teto_diario set teto_usd = 500, exigir_medicao_recente = false
   where conta = v_conta;

  -- o dia EXATAMENTE no teto: headroom = 500 − 500 − 0 = 0
  insert into public.painel_caixa_lancamentos
    (dia, conta, valor_usd, origem, entidade_tipo, entidade_id, sessao_id, medido_em, precedencia, nota)
  values (public.painel_dia_operador(), v_conta, 500, 'medido', 'sessao', 'sess-T80', 'sess-T80',
          now(), 40, 'semente T80: o dia já gastou o teto inteiro');

  -- as duas paredes de baixo no chão (o mundo antes da 0029 §§3-4) E o PISO da
  -- 0030 neutralizado (o mundo em que quem mudou o número foi um `create or
  -- replace`, que nenhuma guarda de migration reexecuta)
  alter table public.painel_custo_estimado drop constraint painel_custo_estimado_usd_check;
  alter table public.painel_fila_prompts drop constraint painel_fila_prompts_custo_estimado_check;
  create or replace function public.painel_custo_minimo_por_item()
  returns numeric language sql immutable set search_path = public, pg_temp
  as 'select 0::numeric';
  update public.painel_custo_estimado set usd = 0 where complexidade = 'baixa';

  insert into public.painel_fila_prompts (conta, prompt, complexidade, modelo_sugerido)
  values (v_conta, 'T80 item de estimativa zero', 'baixa', 'Haiku') returning id into v_id;

  if (select custo_estimado_usd from public.painel_fila_prompts where id = v_id) <> 0 then
    raise exception 'FALHA: T80 a semente não ficou com estimativa ZERO (obteve %) — sem ela este bloco não mede a parede 3',
      (select custo_estimado_usd from public.painel_fila_prompts where id = v_id);
  end if;

  v_medido := public.painel_fila_consumo_hoje(v_conta);

  for v_i in 1..6 loop
    v_pull := public.fila_prompts_pegar_interno(v_conta, 'w-T80-' || v_i);
    if v_pull->'item'->>'id' is not null then
      v_despachados := v_despachados + 1;
    end if;
  end loop;
  v_headroom := (v_pull->>'headroom_usd')::numeric;

  v_reservado := public.painel_fila_reservado(v_conta);
  select count(*) into v_em_voo from public.painel_fila_prompts
   where conta = v_conta and estado = 'pega';

  if v_medido = 500 and v_headroom = 0 and v_despachados = 0 and v_em_voo = 0 and v_reservado = 0 then
    raise exception 'RESULTADO: ok — T80 dia medido=% headroom=% · 6 pulls sobre um item de estimativa ZERO despacharam % itens (em voo=% reserva=%): dia sem espaço não despacha nada',
      v_medido, v_headroom, v_despachados, v_em_voo, v_reservado;
  end if;
  raise exception 'FALHA: T80 esperado medido=500 headroom=0 e ZERO despachos — obteve medido=% headroom=% despachados=% em_voo=% reservado=% (item de estimativa zero atravessou um dia sem espaço)',
    v_medido, v_headroom, v_despachados, v_em_voo, v_reservado;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- T81 · ALTO 2 (rodada 14) — O PULL TRAVA A LINHA DO TETO DAQUELA CONTA
-- `perform 1 from public.painel_teto_diario where conta = p_conta for update;`
-- (0029 §6, herdada da 0027 §1) é a ÚNICA coisa que impede dois workers da
-- mesma conta de lerem o mesmo headroom e despacharem dois itens que, somados,
-- estouram o teto. O `for update skip locked` do item impede que os dois
-- peguem o MESMO item — e é justamente por isso que, sem a trava de conta,
-- eles pegam itens DIFERENTES.
-- Não existia guarda nenhuma para ela. O crítico apagou a linha: os cinco
-- portões ficaram verdes, e com duas conexões reais mediu 300 + 300 = US$ 600
-- contra um teto de US$ 500. Décima-segunda aparição do vício: a guarda cobria
-- o livro-caixa (T52, contando `pg_locks`) e não cobria o DESPACHO, que é onde
-- o teto por conta é decidido.
-- Concorrência real precisa de duas conexões e esta suíte roda numa só. O que
-- se prova aqui é o MECANISMO, comportamentalmente, com DOIS marcadores:
--   · a transação passa a segurar um `RowShareLock` a mais sobre
--     `painel_teto_diario` (o que `select … for update` toma na relação);
--   · o `xmax` da LINHA daquela conta passa a ser o id desta transação — e o
--     de OUTRA conta continua em 0. É esta segunda parte que distingue
--     "travou a linha certa" de "tocou a tabela".
-- MUTAÇÃO QUE DEIXA ESTE BLOCO VERMELHO: apagar, comentar ou mover para
-- depois da leitura a linha do `for update` na 0029 §6.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_conta text := 'lsgpandora@gmail.com';
  v_outra text := 'almapetra.ltda@gmail.com';
  v_antes int;
  v_depois int;
  v_xmax_conta text;
  v_xmax_outra text;
  v_txid text;
  v_id uuid;
begin
  -- Este bloco NÃO pode escrever em `painel_teto_diario` antes do pull: um
  -- `update` marcaria o `xmax` da linha e o segundo marcador viraria enfeite.
  -- A semente do teto é a da 0027 §4 (500 nas quatro contas), que é o estado
  -- em que a suíte encontra o banco.
  delete from public.painel_frentes_sessoes where conta = v_conta;
  delete from public.painel_fila_prompts where conta = v_conta;

  insert into public.painel_fila_prompts (conta, prompt, complexidade, modelo_sugerido)
  values (v_conta, 'T81 item para o pull morder', 'baixa', 'Haiku') returning id into v_id;

  select count(*) into v_antes from pg_locks
   where pid = pg_backend_pid()
     and relation = 'public.painel_teto_diario'::regclass
     and mode = 'RowShareLock';

  perform public.fila_prompts_pegar_interno(v_conta, 'w-T81');

  select count(*) into v_depois from pg_locks
   where pid = pg_backend_pid()
     and relation = 'public.painel_teto_diario'::regclass
     and mode = 'RowShareLock';

  v_txid := pg_current_xact_id()::text;
  select xmax::text into v_xmax_conta from public.painel_teto_diario where conta = v_conta;
  select xmax::text into v_xmax_outra from public.painel_teto_diario where conta = v_outra;

  if v_depois = v_antes + 1 and v_xmax_conta = v_txid and v_xmax_outra = '0' then
    raise exception 'RESULTADO: ok — T81 o pull serializa por conta: RowShareLock em painel_teto_diario %->%, xmax da linha de % = esta transação (%), xmax de % = 0 (a trava é da LINHA certa)',
      v_antes, v_depois, v_conta, v_txid, v_outra;
  end if;
  raise exception 'FALHA: T81 o pull NÃO travou a linha do teto da conta: RowShareLock antes=% depois=% (esperado antes+1) · xmax de %=% · xmax de %=% · esta transação=% — sem esta trava dois workers da mesma conta leem o mesmo headroom e somados estouram o teto',
    v_antes, v_depois, v_conta, v_xmax_conta, v_outra, v_xmax_outra, v_txid;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- T82 · ALTO 6 (rodada 14) — A LISTA DE CONTAS TEM UMA FONTE SÓ
-- A mesma lista de quatro contas estava escrita à mão em CINCO lugares
-- (`fila_prompts_pegar_interno` 0027:144, `fila_prompts_fechar_interno`
-- 0027:420, `fila_prompts_enfileirar` 0027:1234 e as duas check constraints de
-- coluna, 0027:640 e 0027:644), mais a ordem de desempate como sexta. A 0029
-- §1 cria `painel_contas_da_casa()` e §§2/6/7/8 a consomem.
-- Este bloco confere o que sobrou de cópia, nos dois sentidos:
--   · nenhuma função VIVA crava e-mail de conta no corpo (`pg_proc.prosrc`) —
--     é a varredura que pega a próxima cópia nascendo, com qualquer nome;
--   · a fonte única e `painel_teto_diario` descrevem o MESMO conjunto, nos
--     dois sentidos (conta com teto e sem porta = a conta de 21/09 que tinha
--     orçamento e não recebia item; conta com porta e sem teto = pull que
--     recusa por "sem teto declarado");
--   · as duas check constraints citam a função, não a lista.
-- MUTAÇÃO QUE DEIXA ESTE BLOCO VERMELHO: reescrever a lista à mão dentro de
-- qualquer porta · tirar (ou acrescentar) conta em `painel_contas_da_casa()`
-- sem mexer em `painel_teto_diario` · trocar a check de coluna de volta pela
-- lista literal.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_fonte text[];
  v_com_lista text := '';
  v_sem_teto text := '';
  v_sem_porta text := '';
  v_checks int;
  v_funcoes int := 0;
  v_volateis text := '';
  v_de_check int := 0;
  v_nao_imutaveis int := 0;
  rec record;
begin
  v_fonte := public.painel_contas_da_casa();

  if coalesce(array_length(v_fonte, 1), 0) < 1 then
    raise exception 'FALHA: T82 painel_contas_da_casa() devolveu lista vazia — sem conta nenhuma toda porta recusa tudo e todo teto vira zero';
  end if;

  -- 1 · nenhuma função viva crava e-mail de conta no corpo
  for rec in
    select n.nspname || '.' || p.proname as nome, p.prosrc
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname in ('public', 'private')
       and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
       and p.proname <> 'painel_contas_da_casa'
     order by 1
  loop
    v_funcoes := v_funcoes + 1;
    if exists (select 1 from unnest(v_fonte) c where rec.prosrc like '%' || c || '%') then
      v_com_lista := v_com_lista || rec.nome || ' ';
    end if;
  end loop;

  -- 2 · a fonte única e a tabela do teto descrevem o mesmo conjunto
  select string_agg(c, ' ') into v_sem_teto
    from unnest(v_fonte) c
   where not exists (select 1 from public.painel_teto_diario t where t.conta = c);

  select string_agg(t.conta, ' ') into v_sem_porta
    from public.painel_teto_diario t
   where not (t.conta = any (v_fonte));

  -- 3 · as duas checks de coluna citam a FUNÇÃO
  select count(*) into v_checks
    from pg_constraint
   where conname in ('painel_teto_diario_conta_check', 'painel_fila_prompts_conta_check')
     and pg_get_constraintdef(oid) like '%painel_contas_da_casa%';

  -- 4 · SABOTAGEM MINHA (rodada 14, S10): troquei `immutable` por `volatile`
  -- na fonte única e os cinco portões ficaram verdes — o Postgres ACEITA
  -- função volátil dentro de CHECK constraint, ele só não a reavalia. Hoje é
  -- cosmético (a função é um `select array[…]` que não lê linha nenhuma), mas
  -- no dia em que o corpo dela ler uma tabela a constraint passa a valer o que
  -- valia no momento do `insert`, e nada mais. As funções que uma check
  -- constraint consulta têm de ser IMMUTABLE, e isto passa a ser medido.
  -- As duas funções são contadas E conferidas: `string_agg` de conjunto vazio
  -- é NULL, e `NULL = ''` não é verdade — foi assim que a primeira versão
  -- deste trecho reprovou a árvore limpa. Com o contador, "nenhuma volátil" e
  -- "nenhuma encontrada" deixam de ser a mesma resposta (é a forma do MÉDIO 4
  -- desta rodada, e ela aparece até dentro da correção dela).
  select count(*),
         count(*) filter (where p.provolatile <> 'i'),
         coalesce(string_agg(p.proname || '=' || p.provolatile::text, ' ')
                    filter (where p.provolatile <> 'i'), '')
    into v_de_check, v_nao_imutaveis, v_volateis
    from pg_proc p
   where p.pronamespace = 'public'::regnamespace
     and p.proname in ('painel_contas_da_casa', 'painel_custo_maximo_por_item');

  if v_funcoes >= 40
     and v_com_lista = ''
     and v_sem_teto is null
     and v_sem_porta is null
     and v_checks = 2
     and v_de_check = 2
     and v_nao_imutaveis = 0 then
    raise exception 'RESULTADO: ok — T82 % contas numa fonte só; % funções varridas e nenhuma crava e-mail de conta; painel_teto_diario casa nos dois sentidos; as % checks de coluna leem painel_contas_da_casa(); as % funções que as checks consultam são IMMUTABLE',
      array_length(v_fonte, 1), v_funcoes, v_checks, v_de_check;
  end if;
  raise exception 'FALHA: T82 funções varridas=% · função(ões) com a lista escrita à mão: [%] · conta na fonte e SEM teto: [%] · conta com teto e FORA da fonte: [%] · checks de coluna lendo a função: % (esperado 2) · funções que as checks consultam: % de 2 esperadas, % NÃO immutable: [%]',
    v_funcoes, v_com_lista, coalesce(v_sem_teto, ''), coalesce(v_sem_porta, ''), v_checks,
    v_de_check, v_nao_imutaveis, v_volateis;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- T83 · ALTO 6 (rodada 14) — A 4ª CONTA ATRAVESSA TODAS AS PORTAS, INCLUSIVE O
-- FECHAMENTO (é a porta que REGISTRA o dinheiro)
-- O T68 se chama "A QUARTA CONTA RECEBE ITEM" e nasceu deste exato problema.
-- Ele chama `fila_prompts_enfileirar` e `fila_prompts_pegar_interno`, e para
-- aí. A porta que REGISTRA o dinheiro — `fila_prompts_fechar_interno` — tinha
-- a sua própria cópia da lista e NENHUM bloco a chamava com a 4ª conta. O
-- crítico tirou `arborcactus@gmail.com` só de lá: os cinco portões ficaram
-- verdes e o desfecho medido foi o worker gastando US$ 430, o fechamento
-- recusado, o livro do dia da conta em ZERO e o item morrendo em 45 min
-- valendo a ESTIMATIVA da casa (120) — US$ 310 de teto falso, por conta, por
-- item. É o roteiro que a 0027 §0 descreve como o pior caso.
-- Este bloco fecha o ciclo INTEIRO com a 4ª conta e cobra o NÚMERO no livro:
-- enfileirar → pull → fechar com 430 → o dia da conta vale 430. E passa também
-- pelas portas de leitura com segredo (`consumo_do_dia`, `extrato_do_dia`,
-- `listar`), que é onde a tela lê.
-- MUTAÇÃO QUE DEIXA ESTE BLOCO VERMELHO: tirar a 4ª conta de
-- `painel_contas_da_casa()` · reescrever a lista à mão, sem ela, em QUALQUER
-- uma das três portas (enfileirar, pull ou fechamento).
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_conta text := 'arborcactus@gmail.com';
  v_segredo text := (select valor from private.lifeboard_config where chave = 'load_secret');
  v_r jsonb;
  v_pull jsonb;
  v_fechou jsonb;
  v_consumo jsonb;
  v_extrato jsonb;
  v_listar jsonb;
  v_id uuid;
  v_erro text := '';
  v_livro numeric;
  v_real numeric := 430;
begin
  delete from public.painel_frentes_sessoes where conta = v_conta;
  delete from public.painel_fila_prompts where conta = v_conta;
  delete from public.painel_caixa_lancamentos where conta = v_conta;
  update public.painel_teto_diario set teto_usd = 500, exigir_medicao_recente = false
   where conta = v_conta;

    -- Cada porta é chamada no SEU PRÓPRIO `begin … exception`, uma por uma.
  -- Envolver a cadeia inteira num handler só destruía a prova: em PL/pgSQL o
  -- bloco com `exception` é uma SUBTRANSAÇÃO, então a primeira porta que
  -- levantasse erro desfazia o enfileiramento, o pull E o fechamento que já
  -- tinham dado certo — e o livro do dia voltava a zero por rollback, não por
  -- recusa. (Medido aqui mesmo, na primeira versão deste bloco.)
  begin
    v_r := public.fila_prompts_enfileirar(
      v_segredo,
      jsonb_build_object('prompt', 'T83 a 4a conta fecha o ciclo inteiro',
                         'complexidade', 'maxima', 'conta', v_conta));
    v_id := (v_r->>'id')::uuid;
  exception when others then v_erro := v_erro || 'enfileirar: ' || sqlerrm || ' · ';
  end;

  begin
    v_pull := public.fila_prompts_pegar_interno(v_conta, 'w-T83');
  exception when others then v_erro := v_erro || 'pull: ' || sqlerrm || ' · ';
  end;

  -- A PORTA DO ACHADO: a que REGISTRA o dinheiro.
  begin
    v_fechou := public.fila_prompts_fechar_interno(
      p_id => v_id, p_conta => v_conta, p_worker_id => 'w-T83',
      p_estado => 'concluida', p_custo_usd => v_real, p_session_id => 'sess-T83');
  exception when others then v_erro := v_erro || 'fechamento: ' || sqlerrm || ' · ';
  end;

  -- e as portas de leitura com segredo, que é por onde a tela lê
  begin
    v_consumo := public.fila_prompts_consumo_do_dia(v_segredo, null);
  exception when others then v_erro := v_erro || 'consumo_do_dia: ' || sqlerrm || ' · ';
  end;
  begin
    v_extrato := public.fila_prompts_extrato_do_dia(v_segredo, v_conta, null);
  exception when others then v_erro := v_erro || 'extrato_do_dia: ' || sqlerrm || ' · ';
  end;
  begin
    v_listar := public.fila_prompts_listar(v_segredo, 10, null, null);
  exception when others then v_erro := v_erro || 'listar: ' || sqlerrm || ' · ';
  end;

  v_livro := public.painel_fila_consumo_hoje(v_conta);

  if v_erro = ''
     and v_r->>'conta' = v_conta
     and v_pull->'item'->>'id' = v_id::text
     and coalesce((v_fechou->>'ok')::boolean, false)
     and v_livro = v_real
     and v_consumo is not null
     and v_extrato is not null
     and v_listar is not null then
    raise exception 'RESULTADO: ok — T83 a 4ª conta (%) atravessa enfileirar, pull, FECHAMENTO e as três portas de leitura: fechou com US$ % e o livro do dia da conta vale US$ %',
      v_conta, v_real, v_livro;
  end if;
  raise exception 'FALHA: T83 a 4ª conta não fecha o ciclo: erro="%" · enfileirou=% · despachou=% · fechou=% · livro do dia=% (o real era %) — porta que recusa a conta transforma dinheiro gasto em zero no livro e o item morre pela estimativa da casa',
    v_erro, coalesce(v_r->>'conta', 'null'), coalesce(v_pull->'item'->>'id', 'nenhum'),
    coalesce(v_fechou->>'ok', 'null'), coalesce(v_livro::text, 'null'), v_real;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- T84 · BAIXO 8 (rodada 14) — A FAIXA DE SANIDADE CABE NA COLUNA
-- `painel_custo_maximo_por_item()` é o número que as portas de registro
-- aceitam. O T77 só afirma `> 500`, então o crítico subiu para 1.000.000 com
-- os cinco portões verdes — e a faixa passou a aceitar um número que
-- `painel_fila_prompts.custo_usd numeric(10,4)` não guarda: fechar com ele
-- devolvia `numeric field overflow`, erro cru de Postgres em inglês, na cara
-- de quem chama. Pela régua da casa (`response-protocol`, UI/UX), erro cru de
-- banco chegando a quem chama é violação.
-- A capacidade sai do CATÁLOGO (`information_schema`), não de um número
-- copiado aqui: `10^(precisão − escala) − 10^(−escala)`. E o bloco cobra as
-- duas coisas que o achado junta: o teto de sanidade cabe na coluna, E o
-- número do TOPO da faixa fecha um item de verdade, em português, sem
-- overflow. A 0029 §5 é a parede irmã, que ABORTA a migration no mesmo caso.
-- MUTAÇÃO QUE DEIXA ESTE BLOCO VERMELHO: subir
-- `painel_custo_maximo_por_item()` acima do que a coluna guarda · baixar a
-- precisão da coluna sem baixar a função.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_conta text := 'lsgpandora@gmail.com';
  v_precisao int;
  v_escala int;
  v_cabe numeric;
  v_sanidade numeric;
  v_id uuid;
  v_erro text := '';
  v_gravado numeric;
begin
  delete from public.painel_frentes_sessoes where conta = v_conta;
  delete from public.painel_fila_prompts where conta = v_conta;
  delete from public.painel_caixa_lancamentos where conta = v_conta;
  update public.painel_teto_diario set teto_usd = 500, exigir_medicao_recente = false
   where conta = v_conta;

  select numeric_precision, numeric_scale into v_precisao, v_escala
    from information_schema.columns
   where table_schema = 'public' and table_name = 'painel_fila_prompts'
     and column_name = 'custo_usd';

  if v_precisao is null or v_escala is null then
    raise exception 'FALHA: T84 não consegui ler a precisão de painel_fila_prompts.custo_usd no catálogo — sem ela a faixa de sanidade não está amarrada a nada';
  end if;

  v_cabe := power(10::numeric, v_precisao - v_escala) - power(10::numeric, -v_escala);
  v_sanidade := public.painel_custo_maximo_por_item();

  -- e o topo da faixa fecha um item DE VERDADE, sem overflow
  insert into public.painel_fila_prompts (conta, prompt, complexidade, modelo_sugerido)
  values (v_conta, 'T84 o topo da faixa de sanidade', 'maxima', 'Fable') returning id into v_id;
  perform public.fila_prompts_pegar_interno(v_conta, 'w-T84');
  begin
    perform public.fila_prompts_fechar_interno(
      p_id => v_id, p_conta => v_conta, p_worker_id => 'w-T84',
      p_estado => 'concluida', p_custo_usd => v_sanidade, p_session_id => 'sess-T84');
  exception when others then v_erro := sqlerrm;
  end;
  select custo_usd into v_gravado from public.painel_fila_prompts where id = v_id;

  if v_sanidade <= v_cabe and v_erro = '' and v_gravado = v_sanidade then
    raise exception 'RESULTADO: ok — T84 a faixa de sanidade (%) cabe em numeric(%,%) (máximo %) e o topo da faixa fecha um item de verdade: gravado=%',
      v_sanidade, v_precisao, v_escala, v_cabe, v_gravado;
  end if;
  raise exception 'FALHA: T84 sanidade=% × capacidade de numeric(%,%)=% · fechar com o topo da faixa deu erro="%" e gravou=% — faixa que passa do que a coluna guarda troca a recusa em português por "numeric field overflow" cru',
    v_sanidade, v_precisao, v_escala, v_cabe, v_erro, coalesce(v_gravado::text, 'null');
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- T85 · ALTO 1 (rodada 14) — O ESQUEMA `private` NÃO É ALCANÇÁVEL DE FORA
-- O bloco da varredura de privilégios passou a varrer `public` E `private`.
-- As duas funções de `private`
-- nasceram com EXECUTE para PUBLIC (o default de `create function`) e a 0029
-- §9 as revogou. Mas o que de fato as protege é o esquema: `private` não
-- concede USAGE a `anon`, `authenticated` nem `PUBLIC`, e sem USAGE no esquema
-- o EXECUTE na função não serve para nada.
-- Este bloco mede essa premissa em vez de confiar nela — é a diferença entre
-- "está fechado" e "achamos que está fechado". Um `grant usage on schema
-- private to anon` (uma linha, e é o tipo de linha que entra para "resolver"
-- um erro de permissão) abre as duas funções de escrita do grafo inteiro.
-- MUTAÇÃO QUE DEIXA ESTE BLOCO VERMELHO: `grant usage on schema private to
-- anon` (ou a authenticated, ou a public).
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_anon boolean;
  v_auth boolean;
  v_public boolean;
  v_funcoes int;
begin
  select has_schema_privilege('anon', oid, 'usage'),
         has_schema_privilege('authenticated', oid, 'usage'),
         has_schema_privilege('public', oid, 'usage')
    into v_anon, v_auth, v_public
    from pg_namespace where nspname = 'private';

  select count(*) into v_funcoes
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'private';

  if v_funcoes >= 2 and not v_anon and not v_auth and not v_public then
    raise exception 'RESULTADO: ok — T85 o esquema private guarda % função(ões) e não concede USAGE a anon/authenticated/public (anon=% authenticated=% public=%)',
      v_funcoes, v_anon, v_auth, v_public;
  end if;
  raise exception 'FALHA: T85 esquema private com USAGE aberto (anon=% authenticated=% public=%) ou vazio (funções=%) — com USAGE no esquema, o EXECUTE das funções de private volta a valer',
    v_anon, v_auth, v_public, v_funcoes;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- T86 · CRÍTICO (rodada 15) — A SONDA DO CENTAVO
-- O achado do coordenador sobre a árvore JÁ CORRIGIDA da rodada 14, e sem
-- derrubar nenhuma das três paredes que ela levantou. As três perguntam "é
-- diferente de zero?" — e a propriedade que o dinheiro precisa é "é grande o
-- bastante para reservar algo". Com `usd = 0.0001`:
--     dia medido 499 · teto 500 · DESPACHADOS 40 · em voo 40
--     RESERVA total US$ 0,0040 · headroom anunciado US$ 1,00
-- Ele parou em 40 porque foi quantos itens enfileirou: a US$ 0,0001 por item,
-- UM DÓLAR de espaço admite DEZ MIL sessões simultâneas.
-- Este bloco reproduz a sonda inteira e exige ZERO despachos. O item de
-- centavo é criado com as duas checks derrubadas e a porta de admissão
-- desligada — o mundo em que as paredes de baixo caíram —, para que o que
-- esteja sendo medido seja a parede do PULL e nada mais.
-- MUTAÇÃO QUE DEIXA ESTE BLOCO VERMELHO: tirar
-- `and f.custo_estimado_usd >= v_piso` da condição do pull (0030 §8).
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_conta text := 'lsgpandora@gmail.com';
  v_pull jsonb; v_despachados int := 0; v_i int;
  v_medido numeric; v_headroom numeric; v_reservado numeric; v_em_voo int;
  v_estimativa numeric; v_motivo text;
begin
  delete from public.painel_frentes_sessoes where conta = v_conta;
  delete from public.painel_fila_prompts where conta = v_conta;
  delete from public.painel_caixa_lancamentos where conta = v_conta;
  update public.painel_teto_diario set teto_usd = 500, exigir_medicao_recente = false
   where conta = v_conta;

  -- o dia quase no teto: sobrou 1 dólar
  insert into public.painel_caixa_lancamentos
    (dia, conta, valor_usd, origem, entidade_tipo, entidade_id, sessao_id, medido_em, precedencia, nota)
  values (public.painel_dia_operador(), v_conta, 499, 'medido', 'sessao', 'sess-T86', 'sess-T86',
          now(), 40, 'semente T86: sobrou 1 dólar no dia');

  -- os 40 itens entram LEGÍTIMOS (estimativa de `baixa`), com as paredes de
  -- pé — e só então as de baixo caem e a estimativa vira centavo pelo `update`
  -- DIRETO, que é o caminho que a porta de admissão (BEFORE INSERT) não vê.
  -- Assim a única parede em prova é a do PULL.
  -- A check da COLUNA sai antes dos inserts: `alter table` não roda depois de
  -- DML na mesma transação (a barreira de teste da 0019 é um CONSTRAINT
  -- TRIGGER diferido, e o Postgres recusa alterar tabela com evento pendente).
  alter table public.painel_fila_prompts drop constraint painel_fila_prompts_custo_estimado_check;

  for v_i in 1..40 loop
    insert into public.painel_fila_prompts (conta, prompt, complexidade, modelo_sugerido)
    values (v_conta, 'T86 sonda item ' || v_i, 'baixa', 'Haiku');
  end loop;

  alter table public.painel_custo_estimado drop constraint painel_custo_estimado_usd_check;
  update public.painel_custo_estimado set usd = 0.0001 where complexidade = 'baixa';
  update public.painel_fila_prompts set custo_estimado_usd = 0.0001 where conta = v_conta;
  select usd into v_estimativa from public.painel_custo_estimado where complexidade = 'baixa';

  v_medido := public.painel_fila_consumo_hoje(v_conta);
  for v_i in 1..40 loop
    v_pull := public.fila_prompts_pegar_interno(v_conta, 'w-T86-' || v_i);
    if v_pull->'item'->>'id' is not null then v_despachados := v_despachados + 1; end if;
  end loop;
  v_headroom  := (v_pull->>'headroom_usd')::numeric;
  v_reservado := public.painel_fila_reservado(v_conta);
  v_em_voo    := public.painel_fila_em_voo(v_conta);
  v_motivo    := v_pull->>'motivo';

  if v_estimativa = 0.0001
     and v_medido = 499
     and v_despachados = 0
     and v_em_voo = 0
     and v_reservado = 0
     and v_headroom = 1.00
     -- e a frase NÃO diz "nada cabe agora: o mais barato custa US$ 0,0001 e há
     -- US$ 1,00 livres" (autocontraditório): o não é do PISO, e quem ouve é
     -- quem pode consertar a estimativa
     and v_motivo = '40 itens da fila estão com estimativa abaixo do piso de US$ 5,00 e não entram em despacho: corrija a estimativa da complexidade deles' then
    raise exception 'RESULTADO: ok — T86 a sonda do centavo: estimativa=% dia=% teto=500 · 40 pulls despacharam % itens (em voo=% reserva=% headroom anunciado=%) — o piso de US$ % barra o que "> 0" aceitava · frase="%"',
      v_estimativa, v_medido, v_despachados, v_em_voo, v_reservado, v_headroom,
      public.painel_custo_minimo_por_item(), v_motivo;
  end if;
  raise exception 'FALHA: T86 esperado ZERO despachos sobre 40 itens de US$ 0,0001 num dia com US$ 1,00 de espaço e a frase do piso — obteve estimativa=% dia=% despachados=% em_voo=% reserva=% headroom=% motivo="%"',
    v_estimativa, v_medido, v_despachados, v_em_voo, v_reservado, v_headroom, v_motivo;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- T87 · CRÍTICO (rodada 15) — O PISO EXATO É VERDE, UM PASSO ABAIXO É VERMELHO
-- A régua que o coordenador pediu, nas duas direções, para que o piso não se
-- transforme em "fechar tudo": a estimativa NO PISO passa por todas as portas
-- e é despachada; a estimativa um passo abaixo (piso − 0,0001) é recusada
-- pelas três paredes, cada uma com a sua voz.
-- A complexidade mais barata da casa (`baixa` = US$ 5,00) é o piso EXATO — é
-- por isso que nada que o painel declara hoje é recusado.
-- MUTAÇÃO QUE DEIXA ESTE BLOCO VERMELHO: subir painel_custo_minimo_por_item()
-- acima da estimativa de `baixa` (aí o piso passa a recusar dia legítimo de
-- tarefa barata) ou baixá-lo abaixo de um passo (aí o vizinho passa).
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_conta text := 'lsgpandora@gmail.com';
  v_piso numeric := public.painel_custo_minimo_por_item();
  v_passo numeric := 0.0001;
  v_id uuid;
  v_id_legitimo uuid;
  v_pull jsonb;
  v_estimativa_no_piso numeric;
  v_despachou boolean := false;
  v_erro_tabela text := '';
  v_erro_porta  text := '';
  v_erro_coluna text := '';
begin
  delete from public.painel_frentes_sessoes where conta = v_conta;
  delete from public.painel_fila_prompts where conta = v_conta;
  delete from public.painel_caixa_lancamentos where conta = v_conta;
  update public.painel_teto_diario set teto_usd = 500, exigir_medicao_recente = false
   where conta = v_conta;

  -- ── o piso EXATO passa: a estimativa de `baixa` É o piso ─────────────────
  update public.painel_custo_estimado set usd = v_piso where complexidade = 'baixa';
  insert into public.painel_fila_prompts (conta, prompt, complexidade, modelo_sugerido)
  values (v_conta, 'T87 item no piso exato', 'baixa', 'Haiku') returning id into v_id;
  select custo_estimado_usd into v_estimativa_no_piso
    from public.painel_fila_prompts where id = v_id;
  -- um segundo item legítimo, para a parede 3 ser medida pelo `update` direto
  insert into public.painel_fila_prompts (conta, prompt, complexidade, modelo_sugerido)
  values (v_conta, 'T87 item legítimo', 'baixa', 'Haiku') returning id into v_id_legitimo;
  v_pull := public.fila_prompts_pegar_interno(v_conta, 'w-T87-no-piso');
  -- Os dois itens nascem no MESMO `now()` (mesma transação), então qual dos
  -- dois o pull pega é decidido pelo uuid — não se afirma o id, afirma-se o
  -- que interessa: saiu um item, e ele custa o PISO.
  v_despachou := (v_pull->'item'->>'id') is not null
                 and (v_pull->'item'->>'custoEstimadoUsd')::numeric = v_piso;

  -- ── um passo abaixo do piso: as três paredes recusam ─────────────────────
  begin
    update public.painel_custo_estimado set usd = v_piso - v_passo where complexidade = 'baixa';
    v_erro_tabela := '(o update passou — estimativa abaixo do piso foi aceita)';
  exception when others then v_erro_tabela := sqlerrm;
  end;

  alter table public.painel_custo_estimado drop constraint painel_custo_estimado_usd_check;
  update public.painel_custo_estimado set usd = v_piso - v_passo where complexidade = 'baixa';
  begin
    insert into public.painel_fila_prompts (conta, prompt, complexidade, modelo_sugerido)
    values (v_conta, 'T87 item um passo abaixo', 'baixa', 'Haiku');
    v_erro_porta := '(o insert passou — item abaixo do piso entrou na fila)';
  exception when others then v_erro_porta := sqlerrm;
  end;

  begin
    update public.painel_fila_prompts
       set custo_estimado_usd = v_piso - v_passo where id = v_id_legitimo;
    v_erro_coluna := '(o update passou — item abaixo do piso ficou na fila)';
  exception when others then v_erro_coluna := sqlerrm;
  end;

  if v_estimativa_no_piso = v_piso
     and v_despachou
     and v_erro_tabela like '%painel_custo_estimado_usd_check%'
     and v_erro_porta like '%abaixo do piso%'
     and v_erro_coluna like '%painel_fila_prompts_custo_estimado_check%' then
    raise exception 'RESULTADO: ok — T87 piso US$ %: NO piso (US$ %) o item é despachado; um passo abaixo (US$ %) as três paredes recusam ("%" / "%" / "%")',
      v_piso, v_estimativa_no_piso, v_piso - v_passo,
      left(v_erro_tabela, 40), left(v_erro_porta, 40), left(v_erro_coluna, 40);
  end if;
  raise exception 'FALHA: T87 esperado despacho NO piso e recusa nas três paredes um passo abaixo — obteve estimativa_no_piso=% despachou=% tabela="%" porta="%" coluna="%"',
    v_estimativa_no_piso, v_despachou, v_erro_tabela, v_erro_porta, v_erro_coluna;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- T88 · CRÍTICO (rodada 15) — O TETO DE SESSÕES EM VOO POR CONTA
-- A parede que corresponde ao DANO. O dano do achado não é de soma, é de
-- CONTAGEM: o que fere a casa é QUANTAS sessões caras rodam ao mesmo tempo na
-- mesma conta, e uma sessão real custa da ordem de US$ 200 (12/09/2026:
-- US$ 2.513,29 em 12 sessões) contra um teto de US$ 500 por conta.
-- O caso: dia INTEIRO livre (teto 500, zero medido) e dez itens legítimos de
-- `baixa` (US$ 5,00 — nenhuma parede de valor derrubada, nenhuma estimativa
-- mexida). Dez pulls. Só painel_fila_maximo_em_voo_por_conta() sessões saem;
-- o resto ouve a frase, e NENHUM item é declarado "em uso por outra operação".
-- MUTAÇÃO QUE DEIXA ESTE BLOCO VERMELHO: tirar `if not v_no_limite then` da
-- escolha do pull (0030 §8), ou fazer painel_fila_maximo_em_voo_por_conta()
-- devolver número maior que 4.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_conta text := 'lsgpandora@gmail.com';
  v_limite int := public.painel_fila_maximo_em_voo_por_conta();
  v_pull jsonb; v_i int; v_despachados int := 0;
  v_em_voo int; v_headroom numeric; v_reservado numeric;
  v_motivo text; v_travados int; v_elegiveis int; v_pulados int;
  v_em_voo_dito int; v_limite_dito int;
begin
  delete from public.painel_frentes_sessoes where conta = v_conta;
  delete from public.painel_fila_prompts where conta = v_conta;
  delete from public.painel_caixa_lancamentos where conta = v_conta;
  update public.painel_teto_diario set teto_usd = 500, exigir_medicao_recente = false
   where conta = v_conta;

  for v_i in 1..10 loop
    insert into public.painel_fila_prompts (conta, prompt, complexidade, modelo_sugerido)
    values (v_conta, 'T88 item ' || v_i, 'baixa', 'Haiku');
  end loop;

  for v_i in 1..10 loop
    v_pull := public.fila_prompts_pegar_interno(v_conta, 'w-T88-' || v_i);
    if v_pull->'item'->>'id' is not null then v_despachados := v_despachados + 1; end if;
  end loop;

  v_motivo      := v_pull->>'motivo';
  v_travados    := (v_pull->>'travados')::int;
  v_elegiveis   := coalesce((v_pull->>'menor_custo_elegivel_agora')::numeric, 0)::int;
  v_pulados     := (v_pull->>'pulados')::int;
  v_headroom    := (v_pull->>'headroom_usd')::numeric;
  v_em_voo_dito := (v_pull->>'em_voo')::int;
  v_limite_dito := (v_pull->>'limite_em_voo')::int;
  v_em_voo      := public.painel_fila_em_voo(v_conta);
  v_reservado   := public.painel_fila_reservado(v_conta);

  if v_despachados = v_limite
     and v_em_voo = v_limite
     and v_em_voo_dito = v_limite
     and v_limite_dito = v_limite
     and v_travados = 0
     and v_pulados = 10 - v_limite
     and v_headroom = 500 - v_reservado
     -- a frase é SÓ a oração do limite: com a conta cheia, `nada cabe agora`
     -- seria autocontraditório (o mais barato custa US$ 5,00 e há US$ 480,00)
     and v_motivo = '4 sessões desta conta estão em voo (limite 4): não despacho outra até uma delas fechar' then
    raise exception 'RESULTADO: ok — T88 dez pulls num dia inteiro livre despacharam % (o limite), em voo=% reserva=% headroom=% · travados=% (o limite não trava item nenhum) · frase="%"',
      v_despachados, v_em_voo, v_reservado, v_headroom, v_travados, v_motivo;
  end if;
  raise exception 'FALHA: T88 esperado % despachos, % em voo, travados=0, pulados=% e a frase do limite — obteve despachados=% em_voo=% em_voo_dito=% limite_dito=% travados=% pulados=% headroom=% reserva=% motivo="%"',
    v_limite, v_limite, 10 - v_limite,
    v_despachados, v_em_voo, v_em_voo_dito, v_limite_dito, v_travados, v_pulados,
    v_headroom, v_reservado, v_motivo;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- T89 · CRÍTICO (rodada 15) — O PAINEL NUNCA ANUNCIA ESPAÇO SEM DIZER O QUE
--        ESTÁ EM VOO
-- A segunda metade do achado, e a mais silenciosa: `headroom = teto − medido −
-- reserva` estava aritmeticamente CORRETO e factualmente falso — anunciava
-- US$ 1,00 de espaço com 40 sessões gastando dinheiro naquele instante. O
-- número que faltava não era o headroom; era a contagem ao lado dele.
-- Este bloco exige `em_voo` e `limite_em_voo` nos TRÊS ramos de retorno do
-- pull: o que despachou, o que não despachou e o que recusou por medição
-- velha (D32c) — o ramo que retorna ANTES de qualquer escrita.
-- MUTAÇÃO QUE DEIXA ESTE BLOCO VERMELHO: tirar `em_voo`/`limite_em_voo` de
-- qualquer um dos três `jsonb_build_object` do pull (0030 §8).
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_conta text := 'lsgpandora@gmail.com';
  v_limite int := public.painel_fila_maximo_em_voo_por_conta();
  v_pull jsonb; v_i int;
  v_despachou jsonb; v_barrado jsonb; v_velho jsonb;
begin
  delete from public.painel_frentes_sessoes where conta = v_conta;
  delete from public.painel_fila_prompts where conta = v_conta;
  delete from public.painel_caixa_lancamentos where conta = v_conta;
  update public.painel_teto_diario set teto_usd = 500, exigir_medicao_recente = false
   where conta = v_conta;

  for v_i in 1..8 loop
    insert into public.painel_fila_prompts (conta, prompt, complexidade, modelo_sugerido)
    values (v_conta, 'T89 item ' || v_i, 'baixa', 'Haiku');
  end loop;

  -- ramo 1 · despachou: o item deste disparo já conta como em voo
  v_despachou := public.fila_prompts_pegar_interno(v_conta, 'w-T89-1');

  -- enche a conta até o limite
  for v_i in 2..v_limite loop
    v_pull := public.fila_prompts_pegar_interno(v_conta, 'w-T89-' || v_i);
  end loop;

  -- ramo 2 · não despachou porque a conta está no limite
  v_barrado := public.fila_prompts_pegar_interno(v_conta, 'w-T89-barrado');

  -- ramo 3 · recusa por medição velha (D32c): retorna antes de qualquer escrita
  update public.painel_teto_diario set exigir_medicao_recente = true where conta = v_conta;
  v_velho := public.fila_prompts_pegar_interno(v_conta, 'w-T89-medicao');

  if (v_despachou->>'em_voo')::int = 1
     and (v_despachou->>'limite_em_voo')::int = v_limite
     and (v_barrado->>'em_voo')::int = v_limite
     and (v_barrado->>'limite_em_voo')::int = v_limite
     and (v_barrado->>'travados')::int = 0
     and (v_velho->>'em_voo')::int = v_limite
     and (v_velho->>'limite_em_voo')::int = v_limite
     and (v_velho->>'recusado_por_medicao')::boolean then
    raise exception 'RESULTADO: ok — T89 os três ramos do pull dizem em_voo/limite: despachou=%/% barrado=%/% (travados=%) recusado_por_medicao=%/%',
      (v_despachou->>'em_voo'), (v_despachou->>'limite_em_voo'),
      (v_barrado->>'em_voo'), (v_barrado->>'limite_em_voo'), (v_barrado->>'travados'),
      (v_velho->>'em_voo'), (v_velho->>'limite_em_voo');
  end if;
  raise exception 'FALHA: T89 esperado em_voo/limite_em_voo nos três ramos (1/%, %/%, %/%) e travados=0 no barrado — obteve despachou=%/% barrado=%/% travados=% velho=%/% recusado=%',
    v_limite, v_limite, v_limite, v_limite, v_limite,
    (v_despachou->>'em_voo'), (v_despachou->>'limite_em_voo'),
    (v_barrado->>'em_voo'), (v_barrado->>'limite_em_voo'), (v_barrado->>'travados'),
    (v_velho->>'em_voo'), (v_velho->>'limite_em_voo'), (v_velho->>'recusado_por_medicao');
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- T90 · CRÍTICO (rodada 15) — AS GUARDAS DE CIRCUNVENÇÃO DOS DOIS NÚMEROS
-- O coordenador pediu, para qualquer número escolhido, "uma guarda que reprove
-- quando ele for CONTORNADO, não quando ele mudar". O piso vale 1/100 do teto:
-- o caminho mais barato para desfazê-lo não é mexer no piso, é SUBIR O TETO e
-- deixar o piso onde está. Este bloco prova as duas guardas:
--   (a) subir o teto além de piso × razão é recusado na hora da escrita, em
--       português, nomeando o conserto — e BAIXAR o teto continua permitido
--       (a decisão do operador de nunca baixar os US$ 500 é dele, não do
--       banco: o que o banco não deixa é subir sem o piso acompanhar);
--   (b) os dois números casam com o que o BANCO declara: piso × razão cobre
--       todos os tetos declarados, e K itens no piso cabem no menor teto —
--       se não cabessem, a parede de valor morderia primeiro e a de contagem
--       seria enfeite.
-- MUTAÇÃO QUE DEIXA ESTE BLOCO VERMELHO: apagar o gatilho
-- painel_teto_diario_piso_sustenta (0030 §4) ou baixar
-- painel_custo_minimo_por_item() sem baixar os tetos declarados.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_conta text := 'lsgpandora@gmail.com';
  v_piso  numeric := public.painel_custo_minimo_por_item();
  v_razao int     := public.painel_fila_itens_simultaneos_maximos_por_valor();
  v_k     int     := public.painel_fila_maximo_em_voo_por_conta();
  v_maior numeric; v_menor numeric;
  v_erro_subir text := '';
  v_baixou numeric;
begin
  select max(teto_usd), min(teto_usd) into v_maior, v_menor from public.painel_teto_diario;

  -- (a) subir além do que o piso sustenta é recusado
  begin
    update public.painel_teto_diario set teto_usd = v_piso * v_razao + 1 where conta = v_conta;
    v_erro_subir := '(o update passou — teto acima do que o piso sustenta foi aceito)';
  exception when others then v_erro_subir := sqlerrm;
  end;

  -- ... e baixar continua permitido (o banco não decide orçamento)
  update public.painel_teto_diario set teto_usd = 400 where conta = v_conta;
  select teto_usd into v_baixou from public.painel_teto_diario where conta = v_conta;
  update public.painel_teto_diario set teto_usd = 500 where conta = v_conta;

  if v_erro_subir like '%exige piso de estimativa%'
     and v_baixou = 400
     and v_maior <= v_piso * v_razao
     and v_k * v_piso <= v_menor
     and v_piso > 0 and v_razao >= 1 and v_k >= 1 then
    raise exception 'RESULTADO: ok — T90 piso US$ % × razão % sustenta o maior teto declarado (US$ %) · % sessões em voo no piso somam US$ % e cabem no menor teto (US$ %) · subir o teto além disso foi recusado ("%") · baixar para US$ % continua permitido',
      v_piso, v_razao, v_maior, v_k, v_k * v_piso, v_menor, left(v_erro_subir, 60), v_baixou;
  end if;
  raise exception 'FALHA: T90 esperado recusa ao SUBIR o teto além de US$ %, permissão para baixar, e os dois números casando com o banco — obteve erro_subir="%" baixou=% maior_teto=% menor_teto=% piso=% razao=% k=%',
    v_piso * v_razao, v_erro_subir, v_baixou, v_maior, v_menor, v_piso, v_razao, v_k;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- T91 · CRÍTICO (rodada 15) — SESSÃO MUDA NÃO OCUPA VAGA NEM RESERVA DINHEIRO
-- Sabotagem minha (R13), que passou os cinco portões na primeira medição:
-- tirar a janela de heartbeat de `painel_fila_em_voo` — a contagem passa a
-- somar item `pega` mudo há horas. No PULL isso é inerte, porque o laço de
-- expiração roda antes da contagem e devolve/mata o que está mudo; mas o
-- PAINEL lê esta função direto, e aí ela diria "4 sessões em voo (limite 4)"
-- com uma delas morta — a conta pararia de despachar por causa de um fantasma.
-- É a mesma família do achado desta rodada: o número anunciado tem de ser o
-- número verdadeiro.
-- Este bloco mede a função como o painel a lê, SEM passar pelo pull, e exige
-- que ela e `painel_fila_reservado` concordem — as duas saem da mesma janela
-- (`painel_fila_janela_em_voo`), que é fonte única desde a 0030 §1.
-- MUTAÇÃO QUE DEIXA ESTE BLOCO VERMELHO: tirar o `coalesce(heartbeat_em,
-- pego_em) >= now() - painel_fila_janela_em_voo()` de painel_fila_em_voo, ou
-- fazer a janela de uma das duas funções divergir da outra.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_conta text := 'lsgpandora@gmail.com';
  v_vivo uuid; v_mudo uuid;
  v_em_voo int; v_reservado numeric; v_pega int;
  v_hb jsonb; v_expira_dito timestamptz; v_expira_real timestamptz;
begin
  delete from public.painel_frentes_sessoes where conta = v_conta;
  delete from public.painel_fila_prompts where conta = v_conta;
  delete from public.painel_caixa_lancamentos where conta = v_conta;
  update public.painel_teto_diario set teto_usd = 500, exigir_medicao_recente = false
   where conta = v_conta;

  insert into public.painel_fila_prompts (conta, prompt, complexidade, modelo_sugerido)
  values (v_conta, 'T91 sessão viva', 'baixa', 'Haiku') returning id into v_vivo;
  insert into public.painel_fila_prompts (conta, prompt, complexidade, modelo_sugerido)
  values (v_conta, 'T91 sessão muda', 'baixa', 'Haiku') returning id into v_mudo;

  -- as duas em voo; uma com sinal de agora, outra muda há duas horas
  update public.painel_fila_prompts
     set estado = 'pega', worker_id = 'w-T91-vivo', pego_em = now(), heartbeat_em = now()
   where id = v_vivo;
  update public.painel_fila_prompts
     set estado = 'pega', worker_id = 'w-T91-mudo',
         pego_em = now() - interval '2 hours', heartbeat_em = now() - interval '2 hours'
   where id = v_mudo;

  select count(*) into v_pega from public.painel_fila_prompts
   where conta = v_conta and estado = 'pega';
  v_em_voo    := public.painel_fila_em_voo(v_conta);
  v_reservado := public.painel_fila_reservado(v_conta);

  -- E o RELÓGIO que a Routine recebe é a MESMA janela (0030 §10). Era a última
  -- cópia à mão do `interval '45 minutes'`: um número anunciado ao operador que
  -- podia divergir em silêncio da janela que de fato expira o item.
  v_hb := public.fila_prompts_heartbeat_interno(v_vivo, v_conta, 'w-T91-vivo');
  v_expira_dito := (v_hb->>'expira_em')::timestamptz;
  select f.heartbeat_em + public.painel_fila_janela_em_voo() into v_expira_real
    from public.painel_fila_prompts f where f.id = v_vivo;

  if v_pega = 2 and v_em_voo = 1 and v_reservado = 5
     and (v_hb->>'ok')::boolean and v_expira_dito = v_expira_real then
    raise exception 'RESULTADO: ok — T91 % itens em estado `pega`, mas em voo=% e reserva=% — a sessão muda há 2 h não ocupa vaga no limite nem reserva dinheiro; e o expira_em anunciado (%) é heartbeat + painel_fila_janela_em_voo() (janela em UM lugar)',
      v_pega, v_em_voo, v_reservado, v_expira_dito;
  end if;
  raise exception 'FALHA: T91 esperado 2 itens `pega`, em_voo=1, reserva=5 e expira_em = heartbeat + janela única — obteve pega=% em_voo=% reserva=% hb_ok=% expira_dito=% expira_real=%',
    v_pega, v_em_voo, v_reservado, v_hb->>'ok', v_expira_dito, v_expira_real;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- T92 · Major do CodeRabbit + P2 do Codex (PR #42, 23/09) — A CÉLULA MOSTRA O
-- LANÇAMENTO VIGENTE, NÃO A SOMA DE TODOS OS DIAS
-- A estimativa da casa (120) caiu ONTEM; HOJE chega a medição real (3) na
-- mesma entidade. Pela D54 o estorno fica limitado ao que a entidade pôs hoje,
-- então a SOMA da entidade continua 120 — e era ela que a listagem mandava em
-- `livroLiquidoUsd`. Medido antes: `liquido=120` com `livroOrigem=medido`,
-- e a tela escrevia "US$ 120 · medido pela sessão (a casa estimava US$ 3)".
-- Agora: `livroLiquidoUsd = 3`, o valor do lançamento ativo.
-- MUTAÇÃO QUE DEIXA ESTE BLOCO VERMELHO: voltar `livro_liquido` da 0029 para
-- `sum(x.valor_usd)` sobre a entidade inteira.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_conta text := 'lsgpandora@gmail.com';
  v_id uuid;
  v_r jsonb;
  v_linha jsonb;
  v_soma numeric;
begin
  delete from public.painel_frentes_sessoes where conta = v_conta;
  delete from public.painel_fila_prompts where conta = v_conta;
  delete from public.painel_caixa_lancamentos where conta = v_conta;

  insert into public.painel_fila_prompts (conta, prompt, complexidade, modelo_sugerido)
  values (v_conta, 'T92 corrigido de um dia para o outro', 'maxima', 'Fable') returning id into v_id;
  update public.painel_fila_prompts
     set custo_estimado_usd = 120, custo_usd = 120, custo_e_estimativa = true,
         custo_origem = 'estimativa', estado = 'falhou', tentativas = 3,
         concluido_em = (public.painel_dia_operador() - 1)::timestamp at time zone 'America/Sao_Paulo' + interval '23 hours'
   where id = v_id;
  insert into public.painel_caixa_lancamentos
    (dia, conta, valor_usd, origem, entidade_tipo, entidade_id, item_id, precedencia, nota)
  values (public.painel_dia_operador() - 1, v_conta, 120, 'estimativa', 'item', v_id::text, v_id, 10,
          'semente T92: a casa lançou ontem');

  perform public.painel_caixa_lancar('item', v_id::text, v_conta, 3::numeric, 'medido',
                                     v_id, null::text, now(), 'T92: o real, hoje');
  update public.painel_fila_prompts
     set custo_usd = 3, custo_e_estimativa = false, custo_origem = 'medido'
   where id = v_id;

  select sum(valor_usd) into v_soma from public.painel_caixa_lancamentos
   where entidade_tipo = 'item' and entidade_id = v_id::text;

  v_r := public.fila_prompts_listar(
    (select valor from private.lifeboard_config where chave = 'load_secret'), 50);
  select l into v_linha from jsonb_array_elements(v_r->'fila') as l where l->>'id' = v_id::text;

  if v_soma = 120
     and v_linha->>'livroOrigem' = 'medido'
     and (v_linha->>'livroPrecedencia')::int = 30
     and (v_linha->>'livroLiquidoUsd')::numeric = 3 then
    raise exception 'RESULTADO: ok — T92 a célula recebe o vigente (liquido=%) e não a soma da entidade (%)',
      v_linha->>'livroLiquidoUsd', v_soma;
  end if;
  raise exception 'FALHA: T92 esperado soma da entidade 120 e livroLiquidoUsd 3 (medido, posto 30) — obteve soma=% linha=%',
    v_soma, coalesce(v_linha::text, 'item não veio na listagem');
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- T93 · P2 do Codex (PR #42, 2ª rodada) — O AJUSTE CONFERE A SESSÃO PROPOSTA
-- Item cancelado hoje, sem sessão, com a estimativa da casa (posto 10). O
-- operador ajusta para US$ 3 e PROPÕE uma sessão da mesma conta que já
-- publicou US$ 300 (posto 40) e não estava vinculada a item nenhum. A guarda
-- olhava a entidade ATUAL do item (o próprio item, posto 10) e deixava passar;
-- o livro recusava o valor por posto lá dentro e a RPC devolvia `ok: true` —
-- a tela dizia "custo ajustado" sobre um dia que não mudou, e o item ficava
-- gravado com US$ 3 do operador.
-- Agora: recusa com motivo, e nada no item muda (nem custo, nem sessão).
-- MUTAÇÃO QUE DEIXA ESTE BLOCO VERMELHO: voltar a guarda da 0027 para a
-- entidade atual E tirar o cinto `recusado_por_precedencia` do fim da RPC.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_conta text := 'lsgpandora@gmail.com';
  v_segredo text := (select valor from private.lifeboard_config where chave = 'load_secret');
  v_id uuid;
  v_erro text := '';
  v_r jsonb;
  v_custo numeric;
  v_sessao text;
  v_hoje numeric;
begin
  delete from public.painel_frentes_sessoes where conta = v_conta;
  delete from public.painel_fila_prompts where conta = v_conta;
  delete from public.painel_caixa_lancamentos where conta = v_conta;

  insert into public.painel_frentes_sessoes (sessao_id, conta, titulo, estado, custo_usd, atualizado_em)
  values ('sess-T93', v_conta, 'já publicou', 'idle', 300, now());

  insert into public.painel_fila_prompts (conta, prompt, complexidade, modelo_sugerido)
  values (v_conta, 'T93 sessão proposta já publicada', 'maxima', 'Fable') returning id into v_id;
  update public.painel_fila_prompts set custo_estimado_usd = 50 where id = v_id;
  perform public.fila_prompts_pegar_interno(v_conta, 'w-T93');
  perform public.fila_prompts_cancelar(v_segredo, v_id);

  begin
    v_r := public.fila_prompts_ajustar_custo(v_segredo, v_id, 3, 'sess-T93');
  exception when others then v_erro := sqlerrm;
  end;

  select custo_usd, session_id into v_custo, v_sessao from public.painel_fila_prompts where id = v_id;
  v_hoje := public.painel_fila_consumo_hoje(v_conta);

  if v_erro like '%já foi medido pela sessão%'
     and v_custo = 50 and v_sessao is null
     and v_hoje = 350 then
    raise exception 'RESULTADO: ok — T93 ajuste com sessão proposta já publicada é recusado e o item fica como estava (custo=% sessão=% dia=%)',
      v_custo, coalesce(v_sessao, 'nenhuma'), v_hoje;
  end if;
  raise exception 'FALHA: T93 esperado recusa "já foi medido", item com custo 50 sem sessão e dia 350 — obteve erro="%" retorno=% custo=% sessão=% dia=%',
    v_erro, v_r, v_custo, v_sessao, v_hoje;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- T94 · P1 do Codex (PR #42, 3ª rodada) — TROCAR DE SESSÃO NÃO APAGA O QUE A
-- SESSÃO ANTIGA PUBLICOU, MESMO QUE A ORIGEM TENHA SIDO ZERADA DEPOIS
-- A sessão A, vinculada ao item, publica US$ 100 (posto 40). Depois a linha
-- dela em `painel_frentes_sessoes` vai a zero — ausência de medição (D40): o
-- gatilho de publicação não mexe no livro. O item fecha por OUTRA sessão (B)
-- com US$ 5. A fusão de entidade lia o valor ATUAL da origem de A (0) e
-- estornava os 100: medido antes, o dia caía de 100 para 5.
-- Agora: A fica com os 100 que publicou, B com os 5 — dia 105.
-- MUTAÇÃO QUE DEIXA ESTE BLOCO VERMELHO: voltar a fusão da 0027 a ler
-- `painel_frentes_sessoes.custo_usd` em vez do lançamento de posto 40.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_conta text := 'lsgpandora@gmail.com';
  v_id uuid;
  v_antes numeric;
  v_hoje numeric;
  v_a numeric;
begin
  delete from public.painel_frentes_sessoes where conta = v_conta;
  delete from public.painel_fila_prompts where conta = v_conta;
  delete from public.painel_caixa_lancamentos where conta = v_conta;
  update public.painel_teto_diario set teto_usd = 500, exigir_medicao_recente = false
   where conta = v_conta;

  insert into public.painel_fila_prompts (conta, prompt, complexidade, modelo_sugerido)
  values (v_conta, 'T94 troca de sessão', 'maxima', 'Fable') returning id into v_id;
  update public.painel_fila_prompts set custo_estimado_usd = 50 where id = v_id;
  perform public.fila_prompts_pegar_interno(v_conta, 'w-T94');
  perform public.fila_prompts_heartbeat_interno(v_id, v_conta, 'w-T94', 'sess-T94-a');
  insert into public.painel_frentes_sessoes (sessao_id, conta, titulo, estado, custo_usd, atualizado_em)
  values ('sess-T94-a', v_conta, 'publicou e depois zerou', 'idle', 100, now());
  update public.painel_frentes_sessoes set custo_usd = 0 where sessao_id = 'sess-T94-a';
  v_antes := public.painel_fila_consumo_hoje(v_conta);

  perform public.fila_prompts_fechar_interno(
    p_id => v_id, p_conta => v_conta, p_worker_id => 'w-T94',
    p_estado => 'concluida', p_custo_usd => 5, p_session_id => 'sess-T94-b');

  v_hoje := public.painel_fila_consumo_hoje(v_conta);
  select coalesce(sum(valor_usd), 0) into v_a from public.painel_caixa_lancamentos
   where entidade_tipo = 'sessao' and entidade_id = 'sess-T94-a';

  if v_antes = 100 and v_a = 100 and v_hoje = 105 then
    raise exception 'RESULTADO: ok — T94 a sessão antiga fica com o que publicou (%) mesmo zerada na origem; dia=%',
      v_a, v_hoje;
  end if;
  raise exception 'FALHA: T94 esperado antes 100, sessão A com 100 e dia 105 — obteve antes=% A=% dia=%',
    v_antes, v_a, v_hoje;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- T95 · P2 do Codex (PR #42, 4ª rodada) — O HISTÓRICO DO CARD NÃO MOSTRA DIA
-- NEGATIVO LEGADO
-- Dois dias fechados: anteontem US$ 100; ontem −US$ 30 (um dia legado,
-- anterior à D54, em que um crédito anulou dinheiro de outro dia). A visão
-- crua continua dizendo −30 (auditoria); o min/máx/mediana que o card
-- imprime ao lado do teto dizia "mínimo −30, mediana 35". Agora: 0, 100, 50.
-- MUTAÇÃO QUE DEIXA ESTE BLOCO VERMELHO: tirar o `greatest(…, 0)` da
-- redefinição de `painel_fila_historico_medido` no fim da 0030.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_conta text := 'lsgpandora@gmail.com';
  v_h record;
  v_cru numeric;
begin
  delete from public.painel_frentes_sessoes where conta = v_conta;
  delete from public.painel_fila_prompts where conta = v_conta;
  delete from public.painel_caixa_lancamentos where conta = v_conta;

  insert into public.painel_caixa_lancamentos (dia, conta, valor_usd, origem, entidade_tipo, entidade_id, precedencia, nota)
  values (public.painel_dia_operador() - 2, v_conta, 100, 'estimativa', 'item', 'T95-a', 10, 'T95: dia comum'),
         (public.painel_dia_operador() - 1, v_conta, -30, 'operador', 'item', 'T95-b', 20, 'T95: dia legado negativo');

  select custo_usd into v_cru from public.painel_consumo_por_conta_dia
   where conta = v_conta and dia = public.painel_dia_operador() - 1;
  select * into v_h from public.painel_fila_historico_medido(v_conta);

  if v_cru = -30 and v_h.dias = 2 and v_h.min_usd = 0 and v_h.max_usd = 100 and v_h.mediana_usd = 50 then
    raise exception 'RESULTADO: ok — T95 o card lê piso zero (min=% máx=% mediana=%) e a visão crua guarda o legado (%)',
      v_h.min_usd, v_h.max_usd, v_h.mediana_usd, v_cru;
  end if;
  raise exception 'FALHA: T95 esperado cru −30 e histórico 2 dias min 0 máx 100 mediana 50 — obteve cru=% dias=% min=% máx=% mediana=%',
    v_cru, v_h.dias, v_h.min_usd, v_h.max_usd, v_h.mediana_usd;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- T96 · P2 do Codex (PR #42, 4ª rodada) — O ENFILEIRAMENTO AUTOMÁTICO DESVIA
-- DA CONTA QUE ESTÁ NO LIMITE DE SESSÕES EM VOO
-- Pela porta real. Todas as contas limpas e com o mesmo teto; a primeira da
-- ordem da casa (que ganharia o empate) tem QUATRO sessões em voo de US$ 5.
-- Antes, a escolha só via dinheiro — e o item novo ia para ela e ficava
-- parado atrás do limite. Agora vai para a próxima com vaga.
-- MUTAÇÃO QUE DEIXA ESTE BLOCO VERMELHO: tirar `em_voo`/`limite_em_voo` da
-- lista que `fila_prompts_enfileirar` monta (0029), ou a fase "com vaga" da
-- redefinição de `painel_fila_escolher_conta` (0030).
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_contas text[] := public.painel_contas_da_casa();
  v_cheia text := (public.painel_contas_da_casa())[1];
  v_i int;
  v_id uuid;
  v_r jsonb;
  v_manual jsonb;
begin
  -- As QUATRO contas são de prova aqui: a escolha automática olha todas.
  delete from public.painel_frentes_sessoes where conta = any (v_contas);
  delete from public.painel_fila_prompts where conta = any (v_contas);
  delete from public.painel_caixa_lancamentos where conta = any (v_contas);
  update public.painel_teto_diario set teto_usd = 500, exigir_medicao_recente = false
   where conta = any (v_contas);

  for v_i in 1..public.painel_fila_maximo_em_voo_por_conta() loop
    insert into public.painel_fila_prompts (conta, prompt, complexidade, modelo_sugerido, estado,
                                            worker_id, pego_em, heartbeat_em, custo_estimado_usd)
    values (v_cheia, format('T96 em voo %s', v_i), 'baixa', 'Haiku', 'pega',
            format('w-T96-%s', v_i), now(), now(), 5);
  end loop;
  -- As outras contas gastaram US$ 100 hoje: a cheia (500 − 20 em voo = 480)
  -- tem MAIS espaço que qualquer uma delas (400). Só o limite de voo explica
  -- ela não ganhar — sem isto o bloco passava pela diferença de dinheiro.
  for v_i in 2..array_length(v_contas, 1) loop
    insert into public.painel_caixa_lancamentos
      (dia, conta, valor_usd, origem, entidade_tipo, entidade_id, precedencia, nota)
    values (public.painel_dia_operador(), v_contas[v_i], 100, 'medido', 'item',
            format('T96-gasto-%s', v_i), 30, 'T96: gasto de hoje');
  end loop;

  v_r := public.fila_prompts_enfileirar(
    (select valor from private.lifeboard_config where chave = 'load_secret'),
    jsonb_build_object('prompt', 'T96 item novo', 'complexidade', 'alta'));
  -- 8ª rodada: a mesma conta cheia, escolhida À MÃO, avisa que não sai agora.
  v_manual := public.fila_prompts_enfileirar(
    (select valor from private.lifeboard_config where chave = 'load_secret'),
    jsonb_build_object('prompt', 'T96 manual na cheia', 'complexidade', 'alta', 'conta', v_cheia));

  if (v_manual->>'sem_vaga')::boolean is true
     and (v_r->>'sem_vaga')::boolean is false
     and public.painel_fila_em_voo(v_cheia) = public.painel_fila_maximo_em_voo_por_conta()
     and v_r->>'conta' is not null
     and v_r->>'conta' <> v_cheia
     and v_r->>'conta' = v_contas[2]
     -- 6ª rodada: a resposta diz que houve conta pulada, para a frase não
     -- chamar de "a mais folgada" uma conta que não é.
     and (v_r->>'puladas_sem_vaga')::int = 1 then
    raise exception 'RESULTADO: ok — T96 a conta no limite (% em voo) é pulada; o item foi para % (puladas_sem_vaga=%)',
      public.painel_fila_em_voo(v_cheia), v_r->>'conta', v_r->>'puladas_sem_vaga';
  end if;
  raise exception 'FALHA: T96 esperado o item fora de % (no limite) e em %, e a escolha manual da cheia com sem_vaga — obteve auto=% manual=%',
    v_cheia, v_contas[2], v_r, v_manual;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- T97 · P2 do Codex (PR #42, 7ª rodada) — COM TODAS AS CONTAS NO LIMITE DE
-- VOO, O ENFILEIRAMENTO DIZ QUE O ITEM VAI ESPERAR
-- Cada conta da casa com o limite cheio de sessões em voo. A escolha
-- automática volta a ser entre todas (alguma recebe o item), mas a resposta
-- agora traz `todas_sem_vaga=true` — sem ela, a frase de sucesso dizia "é a
-- conta com maior espaço livre" e omitia que nada sai até uma sessão fechar.
-- MUTAÇÃO QUE DEIXA ESTE BLOCO VERMELHO: tirar `todas_sem_vaga` do retorno de
-- `fila_prompts_enfileirar` (0029).
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_contas text[] := public.painel_contas_da_casa();
  v_c text;
  v_i int;
  v_r jsonb;
begin
  delete from public.painel_frentes_sessoes where conta = any (v_contas);
  delete from public.painel_fila_prompts where conta = any (v_contas);
  delete from public.painel_caixa_lancamentos where conta = any (v_contas);
  update public.painel_teto_diario set teto_usd = 500, exigir_medicao_recente = false
   where conta = any (v_contas);

  foreach v_c in array v_contas loop
    for v_i in 1..public.painel_fila_maximo_em_voo_por_conta() loop
      insert into public.painel_fila_prompts (conta, prompt, complexidade, modelo_sugerido, estado,
                                              worker_id, pego_em, heartbeat_em, custo_estimado_usd)
      values (v_c, format('T97 %s em voo %s', v_c, v_i), 'baixa', 'Haiku', 'pega',
              format('w-T97-%s-%s', v_c, v_i), now(), now(), 5);
    end loop;
  end loop;

  v_r := public.fila_prompts_enfileirar(
    (select valor from private.lifeboard_config where chave = 'load_secret'),
    jsonb_build_object('prompt', 'T97 item novo', 'complexidade', 'alta'));

  if v_r->>'conta' is not null
     and (v_r->>'todas_sem_vaga')::boolean is true
     and (v_r->>'puladas_sem_vaga')::int = 0 then
    raise exception 'RESULTADO: ok — T97 todas no limite: o item foi para % e a resposta avisa (todas_sem_vaga=%)',
      v_r->>'conta', v_r->>'todas_sem_vaga';
  end if;
  raise exception 'FALHA: T97 esperado todas_sem_vaga=true e puladas_sem_vaga=0 — obteve %', v_r;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- T98 · P2 do Codex (PR #42, 8ª rodada) — O ESTORNO NUNCA PASSA DO VALOR DO
-- LANÇAMENTO QUE ELE REFERENCIA
-- Anteontem a sessão mediu 100. Ontem foi corrigida para 40 (estorno de −40
-- apontando para os 100, lançamento de 40): pela D54 o líquido da entidade
-- ficou 100 e o vigente é o 40. Hoje, nova correção para 50. Antes: estorno
-- de −50 apontando para o lançamento de 40. Agora: −40 para o 40, +50 novo,
-- e o dia de hoje recebe os +10 da diferença.
-- MUTAÇÃO QUE DEIXA ESTE BLOCO VERMELHO: tirar o `least(…, valor do
-- lançamento referenciado)` de `painel_caixa_lancar` (0027).
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_conta text := 'lsgpandora@gmail.com';
  v_a uuid := gen_random_uuid();
  v_excede int;
  v_hoje numeric;
begin
  delete from public.painel_frentes_sessoes where conta = v_conta;
  delete from public.painel_fila_prompts where conta = v_conta;
  delete from public.painel_caixa_lancamentos where conta = v_conta;

  insert into public.painel_caixa_lancamentos
    (id, dia, conta, valor_usd, origem, entidade_tipo, entidade_id, precedencia, medido_em, nota)
  values (v_a, public.painel_dia_operador() - 2, v_conta, 100, 'medido', 'sessao', 'sess-T98', 30, now(), 'T98 anteontem');
  insert into public.painel_caixa_lancamentos
    (dia, conta, valor_usd, origem, entidade_tipo, entidade_id, estorna_id, precedencia, nota)
  values (public.painel_dia_operador() - 1, v_conta, -40, 'estorno', 'sessao', 'sess-T98', v_a, 30, 'T98 ontem: estorno');
  insert into public.painel_caixa_lancamentos
    (dia, conta, valor_usd, origem, entidade_tipo, entidade_id, precedencia, medido_em, nota)
  values (public.painel_dia_operador() - 1, v_conta, 40, 'medido', 'sessao', 'sess-T98', 30, now(), 'T98 ontem: 40');

  perform public.painel_caixa_lancar('sessao', 'sess-T98', v_conta, 50::numeric, 'medido',
                                     null::uuid, 'sess-T98', now(), 'T98 hoje: 50');

  select count(*) into v_excede
    from public.painel_caixa_lancamentos e
    join public.painel_caixa_lancamentos r on r.id = e.estorna_id
   where e.entidade_id = 'sess-T98' and -e.valor_usd > r.valor_usd;
  v_hoje := public.painel_fila_consumo_hoje(v_conta);

  if v_excede = 0 and v_hoje = 10 then
    raise exception 'RESULTADO: ok — T98 nenhum estorno passa do lançamento que referencia; hoje recebe % (a diferença 40→50)', v_hoje;
  end if;
  raise exception 'FALHA: T98 esperado 0 estornos maiores que o referenciado e hoje = 10 — obteve excedentes=% hoje=%',
    v_excede, v_hoje;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- T99 · P1 do Codex (PR #42, 9ª rodada) — A QUARTA CONTA NASCE TRAVADA ATÉ A
-- ROUTINE DELA EXISTIR
-- Num banco novo, `arborcactus@gmail.com` tinha `exigir_medicao_recente =
-- false` (o default): com o teto vazio de US$ 500, a escolha automática a via
-- como a mais folgada da casa e mandava item para uma conta sem Routine — o
-- item ficava na fila para sempre. Agora a semente da 0027 a trava; sem
-- nenhuma medição, ela não é autorizada, e a escolha automática vai para uma
-- conta com worker. A primeira medição dela (Routine configurada) destrava.
-- MUTAÇÃO QUE DEIXA ESTE BLOCO VERMELHO: voltar a semente da 4ª conta ao
-- default (sem `exigir_medicao_recente = true`) na 0027.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_quarta text := 'arborcactus@gmail.com';
  v_contas text[] := public.painel_contas_da_casa();
  v_trava boolean;
  v_r jsonb;
begin
  -- a semente, como a 0027 a deixou num banco novo
  select exigir_medicao_recente into v_trava from public.painel_teto_diario where conta = v_quarta;

  -- as outras três com um pouco de gasto hoje e medição fresca: a 4ª (vazia)
  -- seria a mais folgada se estivesse destravada
  delete from public.painel_frentes_sessoes where conta = any (v_contas);
  delete from public.painel_fila_prompts where conta = any (v_contas);
  delete from public.painel_caixa_lancamentos where conta = any (v_contas);
  update public.painel_teto_diario set teto_usd = 500 where conta = any (v_contas);
  update public.painel_teto_diario set exigir_medicao_recente = false where conta <> v_quarta and conta = any (v_contas);
  insert into public.painel_caixa_lancamentos
    (dia, conta, valor_usd, origem, entidade_tipo, entidade_id, precedencia, medido_em, nota)
  select public.painel_dia_operador(), c, 50, 'medido', 'item', 'T99-' || c, 30, now(), 'T99 gasto de hoje'
    from unnest(v_contas) c where c <> v_quarta;

  v_r := public.fila_prompts_enfileirar(
    (select valor from private.lifeboard_config where chave = 'load_secret'),
    jsonb_build_object('prompt', 'T99 item novo', 'complexidade', 'alta'));

  if v_trava is true and v_r->>'conta' is not null and v_r->>'conta' <> v_quarta then
    raise exception 'RESULTADO: ok — T99 a 4ª conta nasce travada (exigir_medicao_recente=%) e a escolha automática vai para %',
      v_trava, v_r->>'conta';
  end if;
  raise exception 'FALHA: T99 esperado a 4ª conta travada na semente e o item fora dela — obteve trava=% retorno=%',
    v_trava, v_r;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- T100 · P2 do Codex (PR #42, 10ª rodada) — CANCELAR NÃO LIBERA A VAGA ANTES
-- DE O WORKER OUVIR
-- `fila_prompts_cancelar` passa o item `pega` para `cancelada` na hora, mas a
-- sessão filha só é interrompida quando o worker faz o próximo heartbeat e
-- ouve `cancelado`. Antes, a vaga saía no mesmo instante: com a conta no
-- limite, cancelar uma deixava o pull seguinte abrir uma QUINTA sessão com a
-- quarta ainda rodando — e cancelar em série contornava o limite inteiro.
-- Agora a vaga fica ocupada até o worker DAQUELE item ouvir o cancelamento
-- (ou a janela de voo vencer, o mesmo relógio de um item mudo). Heartbeat de
-- outro worker não libera nada. Dinheiro não entra: a estimativa já foi
-- lançada no livro pelo cancelamento, então a reserva continua saindo na hora.
-- MUTAÇÃO QUE DEIXA ESTE BLOCO VERMELHO: tirar o ramo `estado = 'cancelada'`
-- de `painel_fila_em_voo` (0030 §1f), ou o gatilho que marca
-- `parada_pendente_desde` no cancelamento.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_conta text := 'lsgpandora@gmail.com';
  v_segredo text := (select valor from private.lifeboard_config where chave = 'load_secret');
  v_limite int := public.painel_fila_maximo_em_voo_por_conta();
  v_pull jsonb; v_i int; v_cancelado uuid;
  v_barrado jsonb; v_alheio jsonb; v_ouviu jsonb; v_depois jsonb;
  v_voo_barrado int; v_voo_alheio int; v_voo_ouviu int; v_reserva_cancelada numeric;
begin
  delete from public.painel_frentes_sessoes where conta = v_conta;
  delete from public.painel_fila_prompts where conta = v_conta;
  delete from public.painel_caixa_lancamentos where conta = v_conta;
  update public.painel_teto_diario set teto_usd = 500, exigir_medicao_recente = false
   where conta = v_conta;

  for v_i in 1..(v_limite + 2) loop
    insert into public.painel_fila_prompts (conta, prompt, complexidade, modelo_sugerido)
    values (v_conta, 'T100 item ' || v_i, 'baixa', 'Haiku');
  end loop;

  -- a conta no limite
  for v_i in 1..v_limite loop
    v_pull := public.fila_prompts_pegar_interno(v_conta, 'w-T100-' || v_i);
    if v_i = 1 then v_cancelado := (v_pull->'item'->>'id')::uuid; end if;
  end loop;

  -- o operador cancela a primeira enquanto ela roda
  perform public.fila_prompts_cancelar(v_segredo, v_cancelado);
  v_reserva_cancelada := public.painel_fila_reservado(v_conta);

  -- (a) o worker ainda não ouviu: o pull NÃO abre a quinta
  v_barrado := public.fila_prompts_pegar_interno(v_conta, 'w-T100-quinta');
  v_voo_barrado := public.painel_fila_em_voo(v_conta);

  -- (b) heartbeat de OUTRO worker sobre o item cancelado não libera a vaga
  v_alheio := public.fila_prompts_heartbeat_interno(v_cancelado, v_conta, 'w-T100-intruso');
  v_voo_alheio := public.painel_fila_em_voo(v_conta);

  -- (c) o worker do item ouve o cancelamento: agora a vaga sai
  v_ouviu := public.fila_prompts_heartbeat_interno(v_cancelado, v_conta, 'w-T100-1');
  v_voo_ouviu := public.painel_fila_em_voo(v_conta);
  v_depois := public.fila_prompts_pegar_interno(v_conta, 'w-T100-quinta');

  if v_barrado->'item'->>'id' is null
     and v_voo_barrado = v_limite
     and v_alheio->>'motivo' = 'cancelado'
     and v_voo_alheio = v_limite
     and v_ouviu->>'motivo' = 'cancelado'
     and v_voo_ouviu = v_limite - 1
     and v_depois->'item'->>'id' is not null
     and v_reserva_cancelada = 5 * (v_limite - 1) then
    raise exception 'RESULTADO: ok — T100 cancelar com a conta no limite: em voo continua % até o worker ouvir (intruso não libera: %), a reserva sai na hora (US$ %), e só depois do heartbeat do dono a vaga abre (em voo=%, o pull despacha)',
      v_voo_barrado, v_voo_alheio, v_reserva_cancelada, v_voo_ouviu;
  end if;
  raise exception 'FALHA: T100 esperado em voo %/% antes do dono ouvir, % depois, pull barrado e depois liberado, reserva % — obteve barrado=% voo_barrado=% alheio=% voo_alheio=% ouviu=% voo_ouviu=% depois=% reserva=%',
    v_limite, v_limite, v_limite - 1, 5 * (v_limite - 1),
    v_barrado->'item'->>'id', v_voo_barrado, v_alheio->>'motivo', v_voo_alheio,
    v_ouviu->>'motivo', v_voo_ouviu, v_depois->'item'->>'id', v_reserva_cancelada;
end $$;
