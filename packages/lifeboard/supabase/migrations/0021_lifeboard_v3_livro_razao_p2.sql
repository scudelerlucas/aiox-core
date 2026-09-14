-- ════════════════════════════════════════════════════════════════════════════
-- 0021 · LIFEBOARD v3 · P7 rodada 10 — as três P2 de banco do Codex
-- ════════════════════════════════════════════════════════════════════════════
--
-- Migration separada da 0020 de propósito: a 0020 pode já ter sido aplicada
-- quando estas correções ficaram prontas, e "reaplique a 0020" é instrução
-- frágil. Um número novo é inequívoco.
--
--  D46 (P2) · a escolha MANUAL de conta também passa pela trava de medição.
--      O chooser já carregava a recusa por medição velha dentro do `cabe_hoje`
--      dele; a escolha manual decidia só por espaço livre. O enfileiramento
--      respondia `manual_cabe` para uma conta que o pull iria RECUSAR
--      categoricamente — e o cliente, que já checa a régua nova, dizia o
--      contrário na mesma tela.
--
--  D47 (P2) · o estorno aponta para o lançamento ATIVO, não para o vizinho
--      de microssegundo. `v_ultimo` saía de `order by criado_em desc, id desc`
--      — e numa correção o estorno e o lançamento novo entram na MESMA
--      transação, com o mesmo `now()`. O desempate virava o uuid, que é
--      aleatório em relação à ordem de inserção: a correção seguinte podia
--      apontar `estorna_id` para o ESTORNO anterior em vez do valor vigente,
--      quebrando a cadeia de auditoria que o extrato do livro expõe.
--      A leitura passa a ser por DEFINIÇÃO, não por ordenação: o lançamento
--      ativo é o que não é estorno e que ninguém estornou. Por construção há
--      no máximo um.
--
--  D48 (P2) · está na 0019, não aqui: a reconciliação legada da §8 daquela
--      migration passou a rodar só na abertura inicial. Ela compara a fórmula
--      ANTIGA com o livro, e depois da primeira correção os dois divergem por
--      construção — o livro guarda 120 no dia antigo e o -117 hoje, a fórmula
--      velha recalcula 3 no dia antigo. Re-aplicar a 0019 abortava, embora o
--      arquivo se declare re-aplicável.
--
-- Re-aplicável: tudo aqui é `create or replace`.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1 · D46 · a régua da medição velha, num lugar só ────────────────────────
-- Espelha exatamente o que `painel_fila_escolher_conta` aplica por dentro
-- (`v_exige and (v_defasagem is null or v_defasagem > 12)`) — a diferença é
-- que agora ela tem NOME e pode ser chamada de fora do laço do chooser.
create or replace function public.painel_fila_recusaria_por_medicao(p_conta text)
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select coalesce(t.exigir_medicao_recente, false)
     and (public.painel_fila_defasagem_horas(t.conta) is null
          or public.painel_fila_defasagem_horas(t.conta) > 12)
  from public.painel_teto_diario t
  where t.conta = p_conta;
$$;
comment on function public.painel_fila_recusaria_por_medicao(text) is
  'D46 (rodada 10, P2 do Codex): a conta seria RECUSADA pelo pull por medição velha? Mesma régua que painel_fila_escolher_conta aplica no laço (LIMITE_DEFASAGEM_HORAS = 12), agora nomeada para a escolha MANUAL de conta poder consultá-la — antes a manual decidia cabe_hoje só por espaço livre e prometia o que o pull recusaria.';
revoke all on function public.painel_fila_recusaria_por_medicao(text) from public, anon, authenticated;

-- ── 2 · D46 · fila_prompts_enfileirar, com a manual passando pela trava ─────
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
  -- [P2 do Codex, rodada 10] A ESCOLHA MANUAL TAMBÉM PASSA PELA TRAVA DE
  -- MEDIÇÃO. A conta vinda do chooser já carregava a recusa por medição velha
  -- no `cabe_hoje` dele; a manual decidia só por espaço livre. Resultado: o
  -- enfileiramento respondia `manual_cabe` para uma conta que
  -- `fila_prompts_pegar_interno` iria RECUSAR categoricamente — e o cliente,
  -- que já checa a régua nova, dizia o contrário na mesma tela.
  v_cabe_hoje := case
    when nullif(p_payload->>'conta','') is null then (v_escolha->>'cabe_hoje')::boolean
    when public.painel_fila_recusaria_por_medicao(v_conta) then false
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
comment on function public.fila_prompts_enfileirar(text, jsonb) is
  'D14/D29 + D42 (rodada 9) + D46 (rodada 10): a escolha de conta saiu do laço e virou painel_fila_escolher_conta — a MESMA regra de escolherConta no TS. D46: a escolha MANUAL de conta passou a consultar painel_fila_recusaria_por_medicao, senão ela respondia manual_cabe para uma conta que o pull recusaria por medição velha. Nenhuma frase: quem escreve em português é o TS.';
revoke all on function public.fila_prompts_enfileirar(text, jsonb) from public;
grant execute on function public.fila_prompts_enfileirar(text, jsonb) to anon, authenticated;

-- ── 3 · D47 · o estorno aponta para o lançamento ATIVO ──────────────────────
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

  -- D39: A CONTA É A DO PRIMEIRO LANÇAMENTO desta entidade, e estorno nenhum
  -- muda isso — por isso ela sai de uma leitura própria, pela ponta ANTIGA.
  select l.conta
    into v_conta
    from public.painel_caixa_lancamentos l
   where l.entidade_tipo = p_entidade_tipo and l.entidade_id = p_entidade_id
   order by l.criado_em asc, l.id asc
   limit 1;

  -- D47 (P2 do Codex, rodada 10): O LANÇAMENTO ATIVO, por DEFINIÇÃO e não por
  -- ordenação. Antes isto era `order by criado_em desc, id desc limit 1` — e
  -- numa correção o estorno e o lançamento novo entram na MESMA transação,
  -- com o mesmo `now()`. O desempate caía no uuid, que é aleatório em relação
  -- à ordem de inserção: a correção seguinte podia apontar `estorna_id` para o
  -- ESTORNO anterior em vez do valor vigente, quebrando a cadeia de auditoria
  -- que o extrato do livro expõe.
  -- Ativo = não é estorno, e ninguém o estornou. Por construção há no máximo
  -- um, e a leitura deixa de depender de relógio.
  select l.id, l.origem, l.medido_em
    into v_ultimo, v_origem_atual, v_medido_atual
    from public.painel_caixa_lancamentos l
   where l.entidade_tipo = p_entidade_tipo and l.entidade_id = p_entidade_id
     and l.origem <> 'estorno'
     and not exists (
           select 1 from public.painel_caixa_lancamentos e where e.estorna_id = l.id)
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
  'D37/D38/D39/D40 (rodada 9) + D42/D43 (rodada 10) + D47 (rodada 10): a única porta de escrita do caixa. D42: serializa por entidade com pg_advisory_xact_lock antes de ler o líquido. D43: valor igual só é não-lançamento quando a proveniência também bate. D47: o lançamento ATIVO (o que não é estorno e que ninguém estornou) é lido por definição, não por ordem de relógio — estorno e lançamento novo dividem o mesmo now() e o desempate por uuid apontava estorna_id para a linha errada.';
revoke all on function public.painel_caixa_lancar(text, text, text, numeric, text, uuid, text, timestamptz, text) from public, anon, authenticated;
