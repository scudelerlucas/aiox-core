# ACHADO ABERTO — P7: medição parcial e reserva da casa podem abrir teto falso

**Estado em 27/10/2026:** aberto, de propósito. É o ALTO 1 da revisão independente de 29/09. O PR #71 devolveu
a regra do caixa à precedência por posto (0027, D53), e o conserto deste achado vai para um **PR próprio**, com
crítico independente desde o começo (decisão 1-B do operador, 27/10). Nada disto está em produção: da 0027 em
diante, nada foi colado (`DEPLOY.md`).

## O defeito, em uma frase

Com a regra por posto (estimativa 10 · operador 20 · worker 30 · rotina 40), uma **publicação parcial** da
sessão (posto 40, número pequeno porque ela ainda trabalha) vence o **fechamento do worker** (30, número final
maior) e a **reserva** de cancelamento ou morte (10). O dia passa a contar menos do que se gastou, e o pull pode
despachar acima do teto (medido em 29/09: US$ 760 comprometidos contra teto de 500).

## O que já se sabe sobre o conserto (quatro rodadas no #71, todas reprovadas)

Cada tentativa resolveu um caso e abriu outro. O próximo desenho precisa passar por **todos** estes, e os
cenários estão descritos nos comentários do PR #71:

| Rodada | Regra tentada | Furo que o crítico mediu |
|---|---|---|
| #62 | "medição mais nova vence" | a ordem de chegada decide o total (T66, T67); fechar abortava (T110) |
| R1 | "a maior medição do dia vence" | a reserva era gravada como medição: o gasto real sumia na virada do dia (pull acima do teto); fechamento real depois de cancelar ficava na reserva; esvaziar na fusão (posto 99) era recusado |
| R2 | piso = maior medição real de hoje | recusava o recálculo para baixo da rotina no mesmo dia; o excesso virava falta no dia seguinte |
| R3 | piso com carimbo | a medição já substituída continuava no piso e recusava a reserva de cancelamento |
| R4 | piso com carimbo e sem substituídas | recálculo com o **mesmo carimbo** é recusado (a rotina corrige o custo sem atividade nova) |

**Duas fontes que discordam** (worker e sessão publicando números diferentes da mesma sessão) e a **virada do
dia** (D54 limita o estorno ao que hoje tem) são as duas raízes que todas as rodadas tocaram. Um desenho que
guarde, por entidade, "a última medição real e o carimbo dela" separado da "reserva da casa" parece ser o
ponto de partida — a confirmar no PR próprio.

## O teste que fica guardado aqui

O bloco T114 (do #62) descreve o comportamento desejado no caso mais simples e foi tirado da suíte junto com a
regra que o fazia passar. Ele volta para a suíte no PR do conserto:

```sql
-- ─────────────────────────────────────────────────────────────────────────────
-- T114 · ALTO 1 (revisão independente de 29/09) — MEDIÇÃO PARCIAL NÃO ABRE TETO
-- Publicar um custo pequeno enquanto a sessão ainda trabalha não pode recusar
-- o custo final maior do worker nem a reserva conservadora de cancelamento ou
-- morte. A 0027 decidia só pelo posto 40 > 30 > 10: 20 recusava 400, e 3
-- recusava a estimativa de 120. Agora medição mais nova vence outra medição;
-- uma estimativa maior pode elevar o alvo sem perder a proveniência medida.
-- MUTAÇÃO: remover a 0032 deixa fechamento=20, cancelamento=3 e morte=3.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_segredo text := (select valor from private.lifeboard_config where chave = 'load_secret');
  v_conta_fecha text := 'lucasscudeler@gmail.com';
  v_conta_cancela text := 'lsgpandora@gmail.com';
  v_conta_morre text := 'almapetra.ltda@gmail.com';
  v_id_fecha uuid; v_id_cancela uuid; v_id_morre uuid; v_id_isca uuid;
  v_fecha jsonb; v_cancela jsonb; v_pull jsonb;
  v_consumo_fecha numeric; v_consumo_cancela numeric; v_consumo_morre numeric;
  v_custo_linha numeric;
begin
  delete from public.painel_frentes_sessoes where conta in
    (v_conta_fecha, v_conta_cancela, v_conta_morre);
  delete from public.painel_fila_prompts
   where conta in (v_conta_fecha, v_conta_cancela, v_conta_morre);
  delete from public.painel_caixa_lancamentos
   where conta in (v_conta_fecha, v_conta_cancela, v_conta_morre);
  update public.painel_teto_diario
     set teto_usd = 500, exigir_medicao_recente = false
   where conta in (v_conta_fecha, v_conta_cancela, v_conta_morre);

  -- publicação parcial 20; o fechamento posterior e mais novo mede 400
  insert into public.painel_fila_prompts (conta, prompt, complexidade, modelo_sugerido)
  values (v_conta_fecha, 'T114 fechar maior', 'maxima', 'Fable') returning id into v_id_fecha;
  update public.painel_fila_prompts set custo_estimado_usd = 120 where id = v_id_fecha;
  perform public.fila_prompts_pegar_interno(v_conta_fecha, 'w-T114-fecha');
  perform public.fila_prompts_heartbeat_interno(v_id_fecha, v_conta_fecha, 'w-T114-fecha', 'sess-T114-fecha');
  insert into public.painel_frentes_sessoes (sessao_id, conta, titulo, estado, custo_usd, atualizado_em)
  values ('sess-T114-fecha', v_conta_fecha, 'parcial', 'working', 20, now() - interval '1 minute');
  v_fecha := public.fila_prompts_fechar_interno(
    v_id_fecha, v_conta_fecha, 'w-T114-fecha', 'concluida', 400, 'sess-T114-fecha');
  select custo_usd into v_custo_linha from public.painel_fila_prompts where id = v_id_fecha;
  v_consumo_fecha := public.painel_fila_consumo_hoje(v_conta_fecha);

  -- publicação parcial 3; cancelar mantém a reserva maior de 120
  insert into public.painel_fila_prompts (conta, prompt, complexidade, modelo_sugerido)
  values (v_conta_cancela, 'T114 cancelar maior', 'maxima', 'Fable') returning id into v_id_cancela;
  update public.painel_fila_prompts set custo_estimado_usd = 120 where id = v_id_cancela;
  perform public.fila_prompts_pegar_interno(v_conta_cancela, 'w-T114-cancela');
  perform public.fila_prompts_heartbeat_interno(v_id_cancela, v_conta_cancela, 'w-T114-cancela', 'sess-T114-cancela');
  insert into public.painel_frentes_sessoes (sessao_id, conta, titulo, estado, custo_usd, atualizado_em)
  values ('sess-T114-cancela', v_conta_cancela, 'parcial', 'working', 3, now());
  v_cancela := public.fila_prompts_cancelar(v_segredo, v_id_cancela);
  v_consumo_cancela := public.painel_fila_consumo_hoje(v_conta_cancela);

  -- a terceira expiração também conserva 120 sobre a publicação parcial 3
  insert into public.painel_fila_prompts (conta, prompt, complexidade, modelo_sugerido)
  values (v_conta_morre, 'T114 morrer maior', 'maxima', 'Fable') returning id into v_id_morre;
  update public.painel_fila_prompts set custo_estimado_usd = 120 where id = v_id_morre;
  perform public.fila_prompts_pegar_interno(v_conta_morre, 'w-T114-morre');
  perform public.fila_prompts_heartbeat_interno(v_id_morre, v_conta_morre, 'w-T114-morre', 'sess-T114-morre');
  insert into public.painel_frentes_sessoes (sessao_id, conta, titulo, estado, custo_usd, atualizado_em)
  values ('sess-T114-morre', v_conta_morre, 'parcial', 'working', 3, now());
  update public.painel_fila_prompts
     set heartbeat_em = now() - interval '2 hours', tentativas = 3, max_tentativas = 3
   where id = v_id_morre;
  insert into public.painel_fila_prompts (conta, prompt, complexidade, modelo_sugerido)
  values (v_conta_morre, 'T114 isca', 'baixa', 'Haiku') returning id into v_id_isca;
  v_pull := public.fila_prompts_pegar_interno(v_conta_morre, 'w-T114-isca');
  v_consumo_morre := public.painel_fila_consumo_hoje(v_conta_morre);

  if v_consumo_fecha = 400 and v_custo_linha = 400
     and not coalesce((v_fecha->'caixa'->>'recusado_por_precedencia')::boolean, false)
     and v_consumo_cancela = 120
     and (v_cancela->>'custo_lancado_usd')::numeric = 120
     and v_consumo_morre = 120
     and (v_pull->>'mortos')::int = 1
     and (v_pull->>'mortos_usd')::numeric = 117 then
    raise exception 'RESULTADO: ok — T114 parcial nunca abre teto: fechamento=% cancelamento=% morte=%',
      v_consumo_fecha, v_consumo_cancela, v_consumo_morre;
  end if;
  raise exception 'FALHA: T114 esperado fechamento=400 sem recusa, cancelamento=120 (alvo conservador) e morte=120 (+117) — obteve fecha=% linha=% caixa=% cancela=% retorno_cancel=% morte=% pull=%',
    v_consumo_fecha, v_custo_linha, v_fecha->'caixa', v_consumo_cancela, v_cancela,
    v_consumo_morre, v_pull;
end $$;
```

🕒 2026-10-27 22:44 (São Paulo) · ✍ lucasscudeler · 💬 🔥 !!! 30/10 · A75 · LIFEBOARD P7 → mergear #71 (volta ao posto) · #chat-6cTLMb
