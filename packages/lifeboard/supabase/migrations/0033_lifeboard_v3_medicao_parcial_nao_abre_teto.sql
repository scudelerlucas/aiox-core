-- OS-LIFEBOARD · P7 — medição parcial nunca abre teto falso
--
-- Corrige a precedência por fonte introduzida na 0027. A publicação parcial de
-- uma sessão não pode recusar uma medição posterior do worker nem uma reserva
-- conservadora maior. A função é substituída atomicamente; nenhuma aplicação é
-- feita fora da execução normal das migrations.
--
-- 08/10/2026 (correção da regressão do #62, por exceção declarada pelo operador):
-- este arquivo nasceu como `0032_…` no #62 e quebrou T66, T67 e T110 na `main`.
-- Duas mudanças, e o número passou a 0033 (a 0032 é a da trava D52, #64):
--   1. O PISO DO DIA É A MAIOR MEDIÇÃO REAL DE HOJE. Número menor que ela, de
--      qualquer porta e em qualquer ordem, é recusado (foto velha ou estimativa
--      abaixo do gasto conhecido). Medição real igual ou maior sempre vale,
--      inclusive sobre a reserva da casa. A reserva de cancelamento e morte
--      entra com a origem e o posto dela (estimativa), nunca como `medido`.
--      Era "a mais nova vence" (a ordem decidia o total: T66/T67) e, na 1ª
--      versão deste PR, "a maior entre medições" com a reserva regravada como
--      medição — o crítico independente de 08/10 reprovou: a reserva
--      atravessava a meia-noite e o dia seguinte contava zero com gasto real
--      de 410 (T115), e o fechamento real depois de cancelar ficava na
--      reserva (T116). Medição de dia anterior continua corrigível para baixo
--      hoje (T105); posto 99 (esvaziar na fusão) não passa pelo piso (T117).
--      Limite, erro só para cima: na virada do dia, uma foto velha que chega
--      antes da medição nova faz o dia contar a mais.
--   2. O fechamento NUNCA aborta porque o livro conservou outro valor. O item
--      fecha, e o retorno diz o número pedido e o que o livro guardou
--      (`custo_pedido_usd`, `livro_conservou_outro_valor`). Abortar deixava o
--      item preso até morrer valendo a estimativa (T110).

begin;
create or replace function public.painel_caixa_lancar(
  p_entidade_tipo text,
  p_entidade_id   text,
  p_conta         text,
  p_alvo_usd      numeric,
  p_origem        text,
  p_item_id       uuid default null,
  p_sessao_id     text default null,
  p_medido_em     timestamptz default null,
  p_nota          text default null,
  p_precedencia   integer default null
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
  v_item_atual     uuid;
  v_valor_atual    numeric;
  v_origem_atual   text;
  v_medido_atual   timestamptz;
  v_alvo           numeric;
  v_dia            date;
  v_estorno        uuid;
  v_dono_antigo    uuid;
  v_hoje_dono      numeric;
  v_parte_dono     numeric;
  v_novo           uuid;
  v_prec           smallint;
  v_prec_atual     smallint;
  v_hoje_ent       numeric;
  v_estornar       numeric;
  v_liquido_novo   numeric;
  v_adotou         boolean := false;
  v_piso           numeric;
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

  -- D53 (rodada 12): o POSTO deste lançamento. Sem posto explícito vale o da
  -- origem; quem publica a sessão pede 40 (a autoridade que o DEPLOY.md já
  -- prometia em D6/D30) e a transferência de entidade pede 99.
  v_prec := coalesce(p_precedencia::smallint, public.painel_caixa_precedencia(p_origem));

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
  select l.id, l.origem, l.medido_em,
         coalesce(l.precedencia, public.painel_caixa_precedencia(l.origem)),
         l.item_id, l.valor_usd
    into v_ultimo, v_origem_atual, v_medido_atual, v_prec_atual,
         v_item_atual, v_valor_atual
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

  -- D53 (rodada 12) · A TRAVA DE PRECEDÊNCIA — CRÍTICO 1 e ALTO 1.
  -- Um lançamento de posto MENOR não derruba o que está vigente. É o que
  -- impede a estimativa da casa (10) de apagar os US$ 480 que a sessão
  -- publicou (40), e o que faz a ordem de chegada entre a rotina que publica a
  -- sessão e o worker que fecha o item deixar de decidir o total do dia.
  -- Não é erro: quem chamou segue o seu caminho, só o NÚMERO não regride.
  --
  -- P2 do Codex (PR #42, 22ª rodada) · O POSTO RECUSA O NÚMERO, NÃO O DONO.
  -- A sessão filha publica (posto 40) ANTES de o worker dizer o `session_id`
  -- dela: sem item vinculado, a publicação entra sem dono. O fechamento
  -- vincula e chega aqui com posto 30 — recusado, e com ele ia embora a única
  -- chance de o item ser dono daquele dinheiro: a projeção por item junta pelo
  -- `item_id` gravado e nunca via a sessão. Quando o vigente NÃO TEM DONO e
  -- quem chama traz um item, o vigente é regravado com o MESMO valor, a MESMA
  -- origem, o MESMO carimbo e o MESMO posto — só o dono muda (estorno sem dono
  -- + relançamento com o item, os dois hoje). Vigente de OUTRO item não é
  -- adotado: dono gravado não se rouba. Bloco: T110.
  -- 08/10: a adoção só vale quando o número pedido NÃO é uma medição maior que
  -- a vigente. Medição maior não adota o número velho: ela vence (regra abaixo)
  -- e entra já com o item como dono.
  if v_ultimo is not null and v_prec < v_prec_atual
     and v_item_atual is null and p_item_id is not null
     and not (p_origem = 'medido' and v_origem_atual = 'medido'
              and v_alvo > v_valor_atual) then
    v_adotou    := true;
    v_alvo      := v_valor_atual;
    p_origem    := v_origem_atual;
    p_medido_em := v_medido_atual;
    v_prec      := v_prec_atual;
    p_nota      := 'o item passou a ser dono do que esta sessão já tinha publicado (mesmo valor, mesmo carimbo, mesmo posto)';
  end if;

  -- ALTO 1 (revisão independente de 29/09) · 08/10 (crítico do #71) — O PISO
  -- DO DIA É A MAIOR MEDIÇÃO REAL DE HOJE, E SÓ MEDIÇÃO REAL O FORMA.
  --
  -- Medição real (`medido`) é custo ACUMULADO de uma sessão: cresce enquanto
  -- ela trabalha. Então, dentro do dia, um número menor que a maior medição
  -- real já vista HOJE nesta entidade é foto velha (publicação parcial
  -- atrasada) ou estimativa abaixo do que já se sabe gasto — as duas abririam
  -- teto falso, e as duas são recusadas, de qualquer porta e em qualquer
  -- ordem. Medição real igual ou maior que o piso SEMPRE vale, substitua ela
  -- uma medição, uma estimativa ou a reserva da casa (D12/D26): é o gasto
  -- real, e o gasto real nunca fica abaixo de si mesmo.
  --
  -- A RESERVA DA CASA NÃO É MEDIÇÃO. Cancelar ou matar um item cuja sessão já
  -- publicou pouco lança a estimativa maior por cima (T114) — com a origem e o
  -- posto DELA (estimativa, 10), nunca regravada como `medido` de posto 40. A
  -- versão do #62 regravava, e daí: (a) a medição real seguinte, menor que a
  -- reserva, era recusada como "foto velha" — o dia guardava 480 de reserva
  -- em vez dos 60 reais, a reserva atravessava a meia-noite e a D54 zerava o
  -- dia seguinte com gasto real de 410 (o pull despachou US$ 400 com teto de
  -- 500); (b) o fechamento real de 5 depois de cancelar ficava em 120. Agora
  -- a medição real seguinte substitui a reserva no mesmo dia (T115, T116).
  --
  -- O piso é DE HOJE. Medição de dia anterior continua corrigível para baixo
  -- (a rotina recalcula a sessão — T105); a D54 limita o estorno ao que hoje
  -- tem. Limite conhecido, erro só para cima: na virada, uma foto velha que
  -- chega antes da medição nova faz o dia contar a mais (o piso de hoje ainda
  -- não existia quando ela chegou).
  --
  -- Posto 99 (esvaziar entidade na fusão, `painel_caixa_lancar_item`) não
  -- passa pelo piso: esvaziar não pode ser recusado, senão o dinheiro conta
  -- nas duas entidades (T117).
  if v_ultimo is not null and v_prec < 99 then
    select coalesce(max(l.valor_usd), 0)
      into v_piso
      from public.painel_caixa_lancamentos l
     where l.entidade_tipo = p_entidade_tipo and l.entidade_id = p_entidade_id
       and l.origem = 'medido'
       and l.dia = public.painel_dia_operador();
    if v_alvo < v_piso then
      return jsonb_build_object(
        'ok', true, 'movimentou', false, 'conta', v_conta,
        'liquido_usd', round(v_liquido, 2), 'dia', null,
        'recusado_por_precedencia', true,
        'motivo', 'abaixo_da_maior_medicao_real_de_hoje',
        'piso_medido_hoje_usd', round(v_piso, 2),
        'valor_vigente_usd', round(v_valor_atual, 2),
        'origem_vigente', v_origem_atual,
        'precedencia_vigente', v_prec_atual,
        'origem', p_origem,
        'precedencia_pedida', v_prec,
        'alvo_recusado_usd', round(v_alvo, 2));
    end if;
  end if;

  -- D53: fora da medição real, o POSTO ainda manda. Estimativa ou operador de
  -- posto menor só atravessa o vigente quando AUMENTA o número (reserva
  -- conservadora), e entra com a própria origem e o próprio posto.
  if v_ultimo is not null and p_origem <> 'medido' and v_prec < v_prec_atual then
    if v_alvo > v_valor_atual then
      p_nota := coalesce(p_nota, '') || ' [reserva conservadora acima do vigente]';
    else
      return jsonb_build_object(
        'ok', true, 'movimentou', false, 'conta', v_conta,
        'liquido_usd', round(v_liquido, 2), 'dia', null,
        'recusado_por_precedencia', true,
        'origem_vigente', v_origem_atual,
        'precedencia_vigente', v_prec_atual,
        'origem', p_origem,
        'precedencia_pedida', v_prec,
        'alvo_recusado_usd', round(v_alvo, 2));
    end if;
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
  -- D50 (pós-merge, P1 do Codex): E O CARIMBO. `medido` com valor igual e
  -- origem igual só é não-lançamento quando o carimbo pedido NÃO é mais novo
  -- que o guardado. Vindo mais novo, cai no caminho normal: estorno + novo,
  -- os dois hoje, que se anulam no total do dia — o dinheiro não anda e o
  -- `medido_em` novo passa a existir. Sem `p_medido_em` explícito não há
  -- evidência de medição nova, e continua não-lançamento.
  -- P2 do Codex (PR #42, 14ª rodada): E O DONO. O `item_id` também é
  -- proveniência. A fusão de entidade pede que a sessão antiga fique com o que
  -- publicou, agora SEM o item (`p_item_id => null`) — e com valor e origem
  -- iguais isto era não-lançamento: o lançamento de A seguia com o `item_id`
  -- e a projeção do item somava A e B (T103). Trocar o dono grava estorno e
  -- relançamento, que se anulam no dia. Só quando o lançamento vigente vale o
  -- próprio alvo: com crédito de dias anteriores no líquido (D54) o par não se
  -- anularia, e ali o não-lançamento de antes continua valendo.
  if v_liquido = v_alvo
     and (
       v_alvo = 0
       or (v_origem_atual is not distinct from p_origem
           and (p_origem <> 'medido'
                or (v_medido_atual is not null
                    and (p_medido_em is null or p_medido_em <= v_medido_atual)))
           and (v_item_atual is not distinct from p_item_id
                or v_valor_atual is distinct from v_alvo))
     )
  then
    return jsonb_build_object(
      'ok', true, 'movimentou', false, 'conta', v_conta,
      'liquido_usd', round(v_liquido, 2), 'dia', null);
  end if;

  -- D37: o dia é SEMPRE o de hoje, no fuso do operador.
  v_dia := public.painel_dia_operador();

  -- ══ D54 (rodada 13) · CRÍTICO 1 — O ESTORNO NÃO TIRA DE HOJE MAIS DO QUE
  --    HOJE TEM. ESCOLHA DE DESENHO, e o porquê em uma linha: entre mexer no
  --    dia passado (a rodada 9 fechou isso de propósito) e deixar um crédito
  --    de um dia FECHADO virar teto de hoje, a casa escolhe NÃO DAR TETO —
  --    crédito sem dia onde caber simplesmente não vira teto.
  --
  -- O mecanismo. O estorno é limitado ao que ESTA entidade já pôs no dia de
  -- HOJE (mais o número novo). Consequências, todas medidas:
  --   · correção DENTRO do dia (o caso comum: estimativa de 120 lançada hoje,
  --     fechamento real de 3 hoje) — o estorno continua INTEIRO, o dia cai de
  --     120 para 3. Nada de crédito legítimo é jogado fora.
  --   · correção de um dia ANTERIOR (item morreu ontem e fecha hoje mais
  --     barato; rotina publica 400 ontem e recalcula 40 hoje) — o que ontem
  --     contou fica em ontem, e a contribuição de hoje é ZERO em vez de −117
  --     ou −360. O dia deixa de poder ficar negativo, e `headroom` deixa de
  --     nascer inflado (era 617 e 860 num teto de 500).
  -- O custo, dito em voz alta: o total HISTÓRICO da casa pode ficar ACIMA do
  -- gasto real, porque o dia fechado guarda um número que depois se provou
  -- menor. Num teto, errar para cima é freio; errar para baixo é buraco.
  select coalesce(sum(l.valor_usd), 0)
    into v_hoje_ent
    from public.painel_caixa_lancamentos l
   where l.entidade_tipo = p_entidade_tipo and l.entidade_id = p_entidade_id
     and l.dia = v_dia;

  v_estornar := v_liquido;
  if v_liquido > 0 then
    v_estornar := least(v_liquido, greatest(v_hoje_ent, 0) + v_alvo);
    -- P2 do Codex (PR #42, 8ª rodada): o estorno também não passa do valor
    -- do lançamento que ele REFERENCIA (`estorna_id = v_ultimo`). Com a D54 o
    -- líquido da entidade pode guardar crédito de dias anteriores, maior que
    -- o lançamento vigente: 100 anteontem, corrigido para 40 ontem (líquido
    -- 100, vigente 40), corrigido para 50 hoje gravava −50 apontando para os
    -- 40 — um livro imutável dizendo que anulou mais do que existia. Agora o
    -- estorno é −40 e o dia de hoje recebe +10, a diferença real entre o
    -- vigente e o número novo. O crédito antigo continua sem dia (D54).
    -- Bloco que prova: T98.
    if v_ultimo is not null then
      v_estornar := least(
        v_estornar,
        greatest((select l.valor_usd from public.painel_caixa_lancamentos l where l.id = v_ultimo), 0));
    end if;
  end if;
  v_liquido_novo := v_liquido - v_estornar + v_alvo;

  -- Crédito que não achou dia: nada a gravar hoje. Não é erro — é a recusa
  -- explícita de transformar em teto um dinheiro que já foi contado ontem.
  if v_estornar = 0 and v_alvo = 0 then
    return jsonb_build_object(
      'ok', true, 'movimentou', false, 'conta', v_conta,
      'liquido_usd', round(v_liquido, 2), 'dia', null,
      'credito_sem_dia', true,
      'credito_sem_dia_usd', round(v_liquido, 2));
  end if;

  -- D38: a correção é um ESTORNO DATADO do líquido anterior, seguido do
  -- lançamento novo.
  -- P2 do Codex (PR #42, 12ª rodada): o estorno HERDA o `item_id` do
  -- lançamento que ele anula. A fusão de entidade (`painel_caixa_lancar_item`)
  -- chama esta função com `p_item_id => null` para esvaziar a sessão antiga, e
  -- o estorno saía sem dono: a projeção por item somava o +50 da sessão A
  -- (pelo item_id) e o +30 da sessão B, mas não o −50 — o item valia 80 com o
  -- livro da conta dizendo 30, e a parcela estimada via duas entidades. Um
  -- estorno pertence a quem pertencia o que ele anula — INCLUSIVE quando o
  -- anulado não tinha dono (16ª rodada: a 1ª versão caía no `p_item_id` de
  -- quem chamou nesse caso, e o estorno da publicação PRÓPRIA da sessão B
  -- virava dinheiro do item que acabara de se vincular a ela). O `p_item_id`
  -- só vale quando não há lançamento anulado. Blocos: T102 e T105.
  --
  -- P2 do Codex (PR #42, 17ª rodada) · O ITEM SÓ CEDE O QUE ELE TEM HOJE. Quando
  -- o dono muda DE UM ITEM para outro dono (a fusão desligando a sessão antiga
  -- do item), o estorno herdado inteiro virava gasto negativo do item no dia:
  -- ontem A publicou 100 com o item, hoje foi corrigida para 40 (−40 +40, hoje
  -- líquido zero para o item) e, ao desligar, o −40 caía no item — que
  -- projetava −35 com custo real de 5. A parte do estorno que fica com o dono
  -- antigo é no máximo o que ele moveu NESTA entidade HOJE; o resto é do novo
  -- dono (sem dono, na fusão). Dois estornos para o mesmo lançamento, somando o
  -- mesmo valor — o livro da conta não muda, só a atribuição. Dono antigo sem
  -- item (sessão que publicou por conta própria) continua herdando inteiro.
  if v_estornar <> 0 then
    v_dono_antigo := case when v_ultimo is not null
                          then (select l.item_id from public.painel_caixa_lancamentos l where l.id = v_ultimo)
                          else p_item_id end;
    v_parte_dono := v_estornar;
    if v_ultimo is not null and v_dono_antigo is not null
       and v_dono_antigo is distinct from p_item_id and v_estornar > 0 then
      select coalesce(sum(l.valor_usd), 0) into v_hoje_dono
        from public.painel_caixa_lancamentos l
       where l.entidade_tipo = p_entidade_tipo and l.entidade_id = p_entidade_id
         and l.dia = v_dia and l.item_id = v_dono_antigo;
      v_parte_dono := least(v_estornar, greatest(v_hoje_dono, 0));
    end if;

    if v_parte_dono <> 0 then
      insert into public.painel_caixa_lancamentos
        (dia, conta, valor_usd, origem, entidade_tipo, entidade_id, item_id, sessao_id, estorna_id, nota, precedencia)
      values
        (v_dia, v_conta, -v_parte_dono, 'estorno', p_entidade_tipo, p_entidade_id,
         v_dono_antigo, p_sessao_id, v_ultimo,
         coalesce(p_nota, 'estorno do líquido anterior desta entidade'),
         coalesce(v_prec_atual, v_prec))
      returning id into v_estorno;
    end if;
    if v_estornar - v_parte_dono <> 0 then
      insert into public.painel_caixa_lancamentos
        (dia, conta, valor_usd, origem, entidade_tipo, entidade_id, item_id, sessao_id, estorna_id, nota, precedencia)
      values
        (v_dia, v_conta, -(v_estornar - v_parte_dono), 'estorno', p_entidade_tipo, p_entidade_id,
         p_item_id, p_sessao_id, v_ultimo,
         coalesce(p_nota, 'estorno do líquido anterior desta entidade')
           || ' (parte que o item não tinha hoje: fica com o novo dono)',
         coalesce(v_prec_atual, v_prec))
      returning id into v_estorno;
    end if;
  end if;

  if v_alvo <> 0 then
    insert into public.painel_caixa_lancamentos
      (dia, conta, valor_usd, origem, entidade_tipo, entidade_id, item_id, sessao_id, medido_em, nota, precedencia)
    values
      (v_dia, v_conta, v_alvo, p_origem, p_entidade_tipo, p_entidade_id,
       p_item_id, p_sessao_id,
       case when p_origem = 'medido' then coalesce(p_medido_em, now()) else null end,
       p_nota, v_prec)
    returning id into v_novo;
  end if;

  -- D54: `delta_usd` é o que ESTE lançamento moveu NO DIA DE HOJE — não a
  -- diferença contra o líquido da entidade, que pode estar em outro dia.
  return jsonb_build_object(
    'ok', true, 'movimentou', true, 'conta', v_conta, 'dia', v_dia,
    'liquido_anterior_usd', round(v_liquido, 2),
    'liquido_usd', round(v_liquido_novo, 2),
    'delta_usd', round(v_alvo - v_estornar, 2),
    'credito_sem_dia', v_estornar < v_liquido,
    'credito_sem_dia_usd', round(greatest(v_liquido - v_estornar, 0), 2),
    'origem_anterior', v_origem_atual, 'origem', p_origem,
    -- 22ª rodada: com o dono adotado, o NÚMERO pedido continua recusado — só
    -- a proveniência andou. Quem lê `recusado_por_precedencia` segue certo.
    'recusado_por_precedencia', v_adotou,
    'dono_adotado', v_adotou,
    'precedencia_vigente', v_prec_atual, 'precedencia', v_prec,
    'estorno_id', v_estorno, 'lancamento_id', v_novo);
end;
$$;
comment on function public.painel_caixa_lancar(text, text, text, numeric, text, uuid, text, timestamptz, text, integer) is
  'D37/D38/D39/D40 + D42/D43/D47 + D50 + D53 (rodada 12): a única porta de escrita do caixa. D53 + 0033 (08/10): cada lançamento tem um POSTO (10 estimativa · 20 operador · 30 medido pelo worker · 40 publicado pela rotina da conta · 99 esvaziar na fusão). Nada abaixo da MAIOR MEDIÇÃO REAL DE HOJE da entidade entra (exceto posto 99); medição real igual ou maior sempre vale, também sobre a reserva da casa; estimativa e operador de posto menor só atravessam o vigente para cima. É o que impede a estimativa da casa de apagar a medição real (CRÍTICO 1) e o que faz os mesmos fatos do mesmo dia darem o mesmo total em qualquer ordem (ALTO 1). Recusa devolve movimentou=false com recusado_por_precedencia=true, nunca exceção. D54 (rodada 13): o ESTORNO é limitado ao que a entidade já pôs no dia de HOJE — crédito que anula dinheiro de um dia FECHADO não vira teto de hoje, e por isso nenhum dia pode somar negativo.';
revoke all on function public.painel_caixa_lancar(text, text, text, numeric, text, uuid, text, timestamptz, text, integer) from public, anon, authenticated;

-- 08/10: fechar NUNCA aborta porque o livro conservou outro valor (a versão do
-- #62 abortava e o item ficava preso até morrer valendo a estimativa — T110).
-- O item fecha; o retorno diz o número pedido e se o livro guardou outro.
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
     or not (p_conta = any (public.painel_contas_da_casa()))
  then
    raise exception 'conta precisa ser uma das % contas da casa: %',
      coalesce(array_length(public.painel_contas_da_casa(), 1), 0),
      array_to_string(public.painel_contas_da_casa(), ', ')
      using errcode = 'check_violation';
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
  -- ALTO 2 (rodada 13): a faixa é de SANIDADE (ver §0), não o teto do dia. Uma
  -- sessão que custou mais que o teto PRECISA poder ser relatada: o buraco
  -- não se fecha recusando a medição, se fecha no pull, que não despacha nada
  -- novo enquanto o dia não couber.
  if p_custo_usd < 0 or p_custo_usd > public.painel_custo_maximo_por_item() then
    raise exception 'custo_usd fora da faixa de sanidade (0 a %): % — este limite não é o teto do dia; quem barra despacho é o pull',
      public.painel_custo_maximo_por_item(), p_custo_usd
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

    -- D38 + D54 (rodada 13): o número real é lançado HOJE, e o estorno da
    -- estimativa é limitado ao que ela pôs em HOJE. Quando a morte foi ontem,
    -- ontem continua valendo o que foi relatado e hoje fica em zero — nunca
    -- negativo, nunca virando teto (era hoje = −117 com estimativa 120 e real 3).
    v_caixa := public.painel_caixa_lancar_item(
      v_row.id, p_custo_usd, 'medido', now(),
      'fechamento pelo último dono de item que tinha morrido sem fechar');


    return jsonb_build_object(
      'ok', true, 'ja_fechado', false, 'reaberto_e_fechado', true, 'estado', p_estado,
      'caixa', v_caixa,
      'custo_pedido_usd', round(p_custo_usd, 2),
      'livro_conservou_outro_valor', coalesce((v_caixa->>'recusado_por_precedencia')::boolean, false)
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
    -- P2 do Codex (PR #42, 11ª e 13ª rodadas): o dono que FECHA o item
    -- cancelado confirma a parada — ele interrompe a filha antes de fechar, ou
    -- a filha já terminou e entregou o número. Sem apagar a marca
    -- aqui, a corrida "cancelou × a filha acabou" deixava uma sessão fantasma
    -- ocupando vaga até a janela de 45 min vencer (§1e').
    --
    -- P2 do Codex (PR #42, 21ª rodada) · IDEMPOTÊNCIA, como a do D8 para
    -- concluída/falhou. O cancelado continua `cancelada` depois de fechado, e a
    -- segunda chamada (resposta perdida, worker repetindo) passava de novo por
    -- aqui: trocava o número e relançava com `now()` — um carimbo novo sem
    -- medição nova, que destravava conta com `exigir_medicao_recente`. Já
    -- medido pelo dono = já fechado; só a marca de parada ainda sai (T109).
    if v_row.custo_origem = 'medido'
       and not coalesce(v_row.custo_e_estimativa, false)
       and v_row.custo_usd is not null then
      update public.painel_fila_prompts
         set parada_pendente_desde = null
       where id = p_id and parada_pendente_desde is not null;
      return jsonb_build_object(
        'ok', true, 'ja_fechado', true, 'reaberto_e_fechado', false, 'estado', 'cancelada'
      );
    end if;
    update public.painel_fila_prompts
       set custo_usd = p_custo_usd,
           custo_e_estimativa = false,
           custo_origem = 'medido',
           session_id = coalesce(v_sess, session_id),
           sessao_url = coalesce(p_sessao_url, sessao_url),
           resultado = coalesce(p_resultado, resultado),
           concluido_em = coalesce(concluido_em, now()),
           parada_pendente_desde = null
     where id = p_id
    returning * into v_row;

    v_caixa := public.painel_caixa_lancar_item(
      v_row.id, p_custo_usd, 'medido', now(),
      'medição real sobre item cancelado durante a execução');


    return jsonb_build_object(
      'ok', true, 'ja_fechado', false, 'reaberto_e_fechado', false, 'estado', 'cancelada',
      'caixa', v_caixa,
      'custo_pedido_usd', round(p_custo_usd, 2),
      'livro_conservou_outro_valor', coalesce((v_caixa->>'recusado_por_precedencia')::boolean, false)
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
    'caixa', v_caixa,
    'custo_pedido_usd', round(p_custo_usd, 2),
    'livro_conservou_outro_valor', coalesce((v_caixa->>'recusado_por_precedencia')::boolean, false)
  );
end;
$$;
comment on function public.fila_prompts_fechar_interno(uuid, text, text, text, numeric, text, text, text) is
  'ALTO 6 (rodada 14): a lista de contas vem de painel_contas_da_casa(). Era a cópia que o crítico sabotou com uma vírgula a menos: o worker gastou US$ 430, o fechamento recusou "conta precisa ser uma das 3 contas da casa", o livro do dia ficou em ZERO e o item morreu valendo a estimativa (120) — US$ 310 de teto falso, com os cinco portões verdes. Quem cobre agora: T83 (a 4ª conta atravessa TODAS as portas, o fechamento inclusive) e T82 (a fonte única × painel_teto_diario, nos dois sentidos). P2 do Codex (PR #42, 11ª rodada, 0030 §1e''): o ramo do item cancelado apaga parada_pendente_desde — o dono que fecha também libera a vaga de sessão em voo (bloco T101).';
revoke all on function public.fila_prompts_fechar_interno(uuid, text, text, text, numeric, text, text, text) from public, anon, authenticated;
commit;
