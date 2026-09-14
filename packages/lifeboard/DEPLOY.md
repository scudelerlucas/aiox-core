# OS-LIFEBOARD — Deploy (Vercel + Supabase + Login Google)

Estado atual: **schema aplicado no Supabase real, 18 tarefas reais do Calendar já
ingeridas, código live + login Google testado (54/54, build verde) e pushed.**
Falta só o deploy na Vercel + habilitar o provider Google no Supabase.

Já no ar (público, só métricas agregadas — sem conteúdo privado):
**https://hciiilopyivjaekaxfqp.supabase.co/functions/v1/lifeboard**

O dashboard COMPLETO (conteúdo das tarefas, protegido por login Google) sobe com
os passos abaixo.

---

## Passo 1 — Google OAuth Client (~2 min, Google Cloud Console)

1. https://console.cloud.google.com → APIs & Services → Credentials
2. **Create Credentials → OAuth client ID → Web application**
3. Em **Authorized redirect URIs**, adicione:
   ```
   https://hciiilopyivjaekaxfqp.supabase.co/auth/v1/callback
   ```
4. Copie o **Client ID** e o **Client Secret**.

## Passo 2 — Habilitar Google no Supabase (~1 min)

1. Supabase → **Authentication → Providers → Google** → Enable
2. Cole o **Client ID** e **Client Secret** do passo 1 → Save
3. Supabase → **Authentication → URL Configuration**:
   - **Site URL:** a URL da Vercel (ex.: `https://os-lifeboard.vercel.app`)
   - **Redirect URLs:** adicione `https://os-lifeboard.vercel.app/auth/callback`
     (ajuste o domínio quando souber a URL final da Vercel)

## Passo 3 — Deploy na Vercel (~2 min)

1. Vercel → **New Project → Import** `scudelerlucas/aiox-core`
2. **Root Directory:** `packages/lifeboard`
3. **Branch:** `claude/autonomous-implementation-p00mc8` (ou `main` após merge do PR #1)
4. **Environment Variables** (Production) — os valores reais o Claude te passou no chat:

   | Nome | Valor |
   |------|-------|
   | `LIFEBOARD_DATA_MODE` | `live` |
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://hciiilopyivjaekaxfqp.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | chave anon/publishable do projeto |
   | `LIFEBOARD_LOAD_SECRET` | segredo da RPC `lifeboard_load` |
   | `LIFEBOARD_ALLOWED_EMAILS` | `lucas.scudeler@pandoratreinamentos.com.br,lucasscudeler@gmail.com` (opcional — já é o default) |

5. **Segredo da RPC no banco (obrigatório em banco NOVO).** A função `lifeboard_load`
   lê o segredo de `private.lifeboard_config` (migration 0004/0005) — as migrations
   NÃO inserem o valor. Sem a linha, toda chamada devolve
   `lifeboard_load: segredo nao configurado` (não é "unauthorized" — se aparecer
   "unauthorized", o valor existe e está diferente do da Vercel). Inserir uma vez,
   no SQL Editor do projeto, com o MESMO valor de `LIFEBOARD_LOAD_SECRET`:

   ```sql
   insert into private.lifeboard_config (chave, valor) values ('load_secret', '<valor>')
   on conflict (chave) do update set valor = excluded.valor, atualizado_em = now();
   ```

   Rotação: rodar o mesmo comando com o valor novo e trocar a env var na Vercel no
   mesmo ato (redeploy). O valor nunca passa por chat, commit ou log.

   Risco aceito por escrito — **atualizado em 13/09/2026, P6:** o mesmo segredo que
   antes só liberava LEITURA (`lifeboard_load`) agora também libera ESCRITA
   (`lifeboard_mutate`), incluindo duas operações **destrutivas**: `nota_del`
   (apaga uma nota) e `aresta_del` (apaga uma relação). **Nota apagada não volta**
   — `task_notes` é a única tabela deste app sem nenhuma fonte de re-sincronização
   (é texto que só existe porque alguém escreveu ali; `ON DELETE RESTRICT` protege
   a tarefa-mãe de sumir com a nota junto, mas não protege a nota de um `nota_del`
   deliberado). A RPC é pública (`anon` executa) e **não tem rate limit nem
   lockout** — força bruta lenta contra um segredo de 24 caracteres é viável em
   teoria e invisível na prática (tentativa errada não deixa rastro); com escrita
   destrutiva no mesmo segredo, o custo de um vazamento subiu de "alguém lê o board"
   para "alguém apaga notas e relações sem deixar rastro". Mitigação hoje: a
   entropia do segredo + a rotação (item 5 acima) + os CHECKs de tamanho/domínio da
   migration `0008` (acham entrada abusiva antes dela virar linha). **Plano, antes
   de abrir o painel a mais leitores:** (1) colocar `lifeboard_mutate` atrás de uma
   Edge Function com contador por IP (mesmo desenho já cogitado para a leitura);
   (2) rotacionar o segredo no mesmo ato de trocar de fase (nunca reusar o valor
   que rodou em modo "só eu confio nele").

   Quem chama: o servidor da Vercel chama com a chave anon + segredo → `auth.uid()`
   é nulo → board do operador (é assim que a leitora sem login vê o painel). Um
   usuário **logado** com conta própria recebe o **próprio** board (vazio, se não
   for o dono) — para ver o board do operador, não logar.

   Também só existe no banco vivo, sem migration: `public.lifeboard_stats()` (agregado
   público, sem segredo) — em banco novo, recriar a partir de
   `supabase/functions/lifeboard/index.ts` antes de publicar a página de saúde.

6. **Deploy.** Depois de saber a URL final, volte ao Passo 2 e confirme que a
   Redirect URL da Vercel está na lista do Supabase.

## Depois do deploy

- Abrir a URL → página **"Entrar com Google"** → logar com
  `lucas.scudeler@pandoratreinamentos.com.br` (dono dos dados) ou
  `lucasscudeler@gmail.com`.
- Dashboard ALMA PETRA completo: grafo de dependências + lista "hoje" com as **18
  tarefas reais**, filtro por fonte, flags de fonte.
- Sair: botão **"Sair"** no canto superior direito (`/auth/signout`).
- Health-check público (sem login): `https://SUA-URL/api/health`.

## Segurança

- **Login Google + allowlist:** só os emails autorizados entram (middleware).
- **RLS (segunda camada):** `owner = auth.uid()` — mesmo que outro email logasse,
  só veria os próprios dados (vazios), nunca os de Lucas.
- **Leitura dos dados:** via RPC `SECURITY DEFINER` `lifeboard_load` protegida por
  segredo server-only; a chave anon/publishable é pública por design e só o
  necessário vai ao browser (nenhum segredo de leitura, nenhum motor HIERARQ —
  `import 'server-only'`, kill-switch nº 3).
- **Escrita (P6, 13/09/2026):** a página `/tarefa/[id]` (notas, subtarefas, meta/goal,
  átomos declarados, duração e as 4 relações) grava por UMA RPC
  `SECURITY DEFINER`, `lifeboard_mutate(p_secret, p_op, p_payload)`
  (`supabase/migrations/0006_lifeboard_v3_escrita.sql`), guardada pelo MESMO
  segredo de `lifeboard_load` (`private.lifeboard_config.load_secret`) — não há
  sessão Supabase por usuário para escrita, só o login Google do middleware.
  `p_op` escolhe a operação (`nota_add`, `nota_del`, `subtarefa_add`, `parent_set`,
  `goal_set`, `atomos_set`, `estimativa_set`, `status_set`, `aresta_add`,
  `aresta_del`); toda validação de forma é feita na função, em português, e as
  regras de negócio que já têm guarda no banco (ciclo de precedência, ciclo de
  hierarquia, domínio de `assimetria`, unicidade de aresta) não são duplicadas —
  a operação roda e a exceção do gatilho/CHECK é traduzida. `src/app/tarefa/
  actions.ts` chama essa RPC em modo live; em modo fixture (sem banco), as
  mesmas ações mutam um store em memória (`src/lib/repositories/
  tasks.fixture-store.ts`) para a página funcionar em dev/teste sem Supabase.

## Fila de prompts entre as 3 contas (P7 · rodada 5, 13/09/2026)

Pedido do operador: "poder promptar soluções pelo painel na conta que tem mais tokens
disponíveis para a complexidade da tarefa". Arquitetura decidida pelo mapa `!4z` do hub
(`docs/ops/LIFEBOARD-V3-4z-atomos-e-gargalo-2026-09-13.md`, R1/R2/R6): a cota real de uma conta
Max não é mensurável por nenhuma API (R1) — o roteador usa o INVERSO medido — e um painel numa
conta não abre sessão em outra (R2) — por isso o modelo é **PULL**: o painel escreve na fila; a
Routine diária de cada conta é o WORKER que pega o que é dela.

- **Migrations:** `0007_lifeboard_v3_fila_prompts.sql` (tabelas
  `painel_fila_prompts`/`painel_teto_diario`, seed US$150/dia — régua da casa
  `teto-de-gasto-diario`) → `0009_lifeboard_v3_fila_ajustes.sql` → `0011_lifeboard_v3_fila_ajustes_2.sql`
  → `0012_lifeboard_v3_fila_posse_e_tentativas.sql` (rodada 3: posse, tentativa com fim,
  elegibilidade por item) → `0013_lifeboard_v3_fila_contabilidade.sql` (rodada 4, D10–D20) →
  **`0014_lifeboard_v3_fila_pull_e_mensagens.sql`** (a rodada 5, aditiva e re-aplicável — nem
  `drop`, nem assinatura nova; o cabeçalho do arquivo traz D21–D24 por extenso).

### O que a rodada 5 mudou — o pull decide no `where`, e a frase chega à tela

> **O princípio:** **a decisão mora no `where`, não no laço; e toda frase que a casa calcula
> chega à tela.** Os dois ALTO do crítico eram a mesma doença — um número certo calculado e
> jogado fora (o item elegível da posição 51) e uma frase certa calculada e nunca renderizada
> (o cancelamento que lançou dinheiro no dia).

| | Decisão | Efeito |
|---|---|---|
| **D21** | **elegibilidade no `where`** | `fila_prompts_pegar_interno` iterava `limit 50 for update skip locked` e testava o teto DENTRO do laço: com 50 `maxima` (US$ 120) na frente, um `baixa` (US$ 5) na posição 51 era **invisível**, e o motivo mentia ("o mais barato da fila custa US$ 120,00"). Agora o item sai de `where … custo_estimado_usd <= headroom order by criado_em, id limit 1 for update skip locked`; `pulados` = `count(*)` dos disponíveis que não cabem e "o mais barato" = `min(custo_estimado_usd)` — os dois **sem limite**, sobre a fila inteira. Índice parcial novo: `painel_fila_prompts_na_fila_ordem_idx (conta, criado_em, id) where estado = 'na_fila'`. Provado ao vivo: 51 itens, headroom 110 → item = o `baixa`, `pulados: 50`, motivo `null`; e o inverso (50 `maxima` + 1 `alta`, headroom 40) → "o mais barato da fila custa US$ 50.00", nunca 120. |
| **D22** | **a frase calculada chega à tela** | `CancelarBotao` e `AjustarCustoBotao` (os componentes que a tabela monta) renderizam a MESMA `MensagemDaFila` do formulário, com `role="status"` que existe **antes** do texto (vazio = `sr-only`) e `erro` na mesma região. A frase de #11/D12 ("US$ 50,00 entram no gasto de hoje como estimativa") nunca era mostrada por ninguém e o sucesso do ajuste era mudo. As duas ações da linha ficam **sempre montadas** (`podeCancelar`/`podeAjustar` só escondem o gatilho): o `router.refresh()` do sucesso desmontava o componente e levava a frase junto. |
| **D23** | **pull que mata não diz "fila vazia"** | o `case` do motivo ganhou o ramo `mortos > 0` antes de "fila vazia": "1 item morreu sem fechar neste disparo e lançou US$ 50,00 no dia" (+ o sufixo de estimativa do dia). Provado: item na 3ª expiração → motivo começa por "1 item morreu", `mortos_usd: 50.00`. |
| **D24** | **o dia que reservou paga** | `painel_fila_itens_do_dia` atribuía o item ao dia de `concluido_em`: um item pego 23h50 e fechado 00h10 gastava o headroom do dia 13 e era cobrado do dia 14 — o dia 13 fechava com buraco e o dia 14 nascia devendo. A atribuição passa a ser `painel_dia_operador(coalesce(pego_em, criado_em))` (`coalesce` porque a expiração zera `pego_em`). Provado: item pego 23h50 do dia 13 e fechado 00h10 do dia 14 → **+US$ 120 no dia 13**; o mesmo desenho um dia antes → **+US$ 0 no dia 13** (pela regra velha era exatamente o contrário). |
| **#3** | **`raise` usa `%`, não `%s`** | "(este está concluidas)" / "(este está na_filas)" — o `%s` consumia o `%` e deixava o `s` colado no valor. Corrigido em 0014 (e o mesmo caractere em 0013, para a varredura fechar em zero). Prova: `(este está concluida)` e `(este está na_fila)`; teste `prompts-espelho-sql` varre as 6 migrations por `raise … %s` e exige lista vazia. |
| **#6** | **o backoff entrou no espelho** | `prompts-espelho-sql.test.ts` extrai `disponivel_em = now() + (interval '15 minutes' * …)` de 0013/0014 e compara com `BACKOFF_POR_TENTATIVA_MIN`. Mutação 15→99 no arquivo **falha** o teste (medido). |
| **#7** | **`ajustar_custo` checa a estimativa** | o comentário dizia "só o que a casa estimou" e o código nunca checava — um custo MEDIDO pelo worker podia ser reescrito pela tela. Agora: "Só custo estimado pela casa pode ser ajustado; este foi medido." |
| **#8** | **Enter salva o ajuste** | o painel virou `<form onSubmit>`; antes eram dois `<button type="button">` e um `<input>` sem formulário — quem digitava e apertava Enter não salvava nada e não recebia aviso. Provado no navegador (390 e 1280): Enter → "Custo ajustado — o gasto de hoje já considera o número real." e a célula passa a "US$ 12,30 · ajustado por você". |

### O que a rodada 4 mudou — a contabilidade do gasto

> **O princípio:** o gasto do dia **nunca diminui por dado externo não validado**; toda
> ambiguidade conta **para cima** e **aparece na tela**. As 14 reprovações da rodada anterior
> eram a mesma frase — "a contabilidade erra para baixo e cala".

| | Decisão | Efeito |
|---|---|---|
| **D10** | **subtração, não exclusão** | D6 tirava o item do consumo pela MERA EXISTÊNCIA de uma linha em `painel_frentes_sessoes` com o mesmo `session_id` — e **21 das 215 sessões reais têm `custo_usd` nulo**: publicar a sessão filha sem custo APAGAVA o custo medido pelo worker. Agora cada item contribui `greatest(custo_usd − coalesce(custo da sessão, 0), 0)` (`painel_fila_itens_do_dia`). Provado ao vivo: medido 118,40 → publicar **sem** custo = 118,40 → publicar com 100 = 118,40 (100 da sessão + 18,40 do item) → publicar com 130 = 130,00. |
| **D11** | **`session_id` é chave** | índice único parcial `painel_fila_prompts_session_unico`; `heartbeat_interno`/`fechar_interno` recusam `p_session_id = p_worker_id` ("session_id é o id da sessão FILHA, não o da Routine" — o doc do worker entregava os dois ids no mesmo bloco) e `session_id` já vinculado a outro item ("sessão já vinculada ao item X"). |
| **D12** | **cancelar não perdoa** | `fila_prompts_cancelar` sobre `pega` grava `custo_usd` = o ESTIMADO quando ainda não há custo; `painel_fila_consumo_hoje` passa a somar `cancelada` que já teve dono; e `fechar_interno` sobre `cancelada` **do próprio dono** é aceito e troca só `custo_usd`/`session_id` (estado continua `cancelada`, retorno `{ok:true, estado:'cancelada'}`) — é assim que a medição real substitui a estimativa. Provado: cancelar `pega` (estimado 50) → consumo 50; fechar depois com 33 → consumo 33. |
| **D13** | **uma régua só** | `headroom = teto − medido − em_execucao` decide admissão, pull e tela; "espaço livre com fila" (`headroom − na_fila`) só ESCOLHE a conta e alimenta a previsão. `cabe_hoje = estimado <= headroom`. **A tela nunca mostra número negativo** (clamp em 0 + "sem espaço livre agora" — o crítico mediu *"US$ -20,00 livres"*). Provado: headroom 30 + estimado 20 → `cabe_hoje:true`, inclusive com `espaco_livre_usd = -10,00`. |
| **D14** | **o SQL não escreve frase** | `fila_prompts_enfileirar` devolve `motivo_codigo` (`auto_maior_espaco` \| `auto_nao_cabe_hoje` \| `manual_cabe` \| `manual_nao_cabe_hoje`) + números; quem monta a frase é `src/app/prompts/actions.ts`, num **formatador único** para erro e sucesso (`fraseDoEnfileiramento`/`fraseDoCancelamento` em `core/prompts/tipos.ts`). Antes, em live, ia cru: *"roteamento automatico: maior espaco livre hoje (US$ 150.00)"*. Teste: `tests/unit/prompts-mensagem-live.test.tsx` (fetch mockado → ação → componente renderizado). |
| **D15** | **paginação keyset** | `fila_prompts_listar(p_secret, p_limite, p_antes_de, p_antes_id)` ordena por `(criado_em desc, id desc)` e corta por `(criado_em, id) < (p_antes_de, p_antes_id)`; devolve `proximoAntesDe`/`proximoAntesId`. A tela guarda o cursor em `?antes=<iso>&antesId=<uuid>` — antes, "mostrar mais" só engordava `?limite=`, que morre em 200 (numa fila de 205, 5 itens eram inalcançáveis). Provado: 205 itens → 5 páginas de 50 chegando ao 205º. |
| **D16** | **o fixture calcula de verdade** | `prompts-fila.fixture-store.ts` soma `concluida`/`falhou`/`cancelada com dono` do dia pela mesma regra (D10/D12) — o `medido` deixou de ser constante, e os testes de "o teto barra o pull" passaram a mexer no consumo de verdade. |
| **D17** | **o espelho olha o SQL** | `tests/unit/prompts-espelho-sql.test.ts` LÊ `0012`/`0013` do disco e compara: ordem das contas no `case` × `CONTAS`, janela de expiração × `JANELA_HEARTBEAT_MIN`, default de tentativas × `MAX_TENTATIVAS`. O espelho anterior era TS comparado com TS. |
| **D18** | **cadência do heartbeat** | `fila_prompts_heartbeat_interno` devolve `expira_em` (heartbeat + 45 min) para a Routine ver o relógio; o doc do worker passa a exigir renovação **a cada 10 min no máximo**, com a espera pela filha em laço de `list_events` + pausa de 5 min. |
| **D19** | **backoff** | coluna `disponivel_em`: item devolvido por expiração só volta a ser elegível depois de `15 min × tentativas`; o pull ignora quem está de castigo e nomeia "N itens em espera de nova tentativa". |
| **D20** | **estimativa marcada e ajustável** | item morto continua contando o estimado (nunca perdoar), mas a parcela é rastreada (`custo_e_estimativa`) e dita em voz alta no pull e no cartão: *"US$ X do consumo são estimativa de N itens que morreram sem fechar"*. Porta de saída: `fila_prompts_ajustar_custo(p_secret, p_id, p_custo_usd)` (só `falhou`/`cancelada` fechados HOJE) grava `custo_ajustado_em` e apaga a marca — botão "ajustar custo" na linha. |
| **#11** | **mensagens que não mentem** | `cancelar` devolve `motivo_codigo` distinguindo `cancelado_nunca_pego` (de graça) × `cancelado_apos_devolucao` × `cancelado_em_execucao`; pull que devolveu item e não pegou nada diz "1 item(ns) devolvido(s) para a fila, aguardando nova tentativa" em vez de "fila vazia". |
| **#12** | **desempate na ordem** | `order by criado_em, id` no pull e `(criado_em desc, id desc)` na listagem — dois itens do mesmo microssegundo tinham ordem indefinida entre chamadas. |
| **#14** | **`pega` sem `pego_em`** | `check (estado <> 'pega' or pego_em is not null)` (`not valid` + `validate`): sem `pego_em` **nem** `heartbeat_em`, nenhuma expiração alcançava o item — ele era imortal e reservava orçamento para sempre. |

### O que a rodada 3 tinha mudado (continua valendo)

| | Decisão | Efeito |
|---|---|---|
| **D1** | **posse + heartbeat** | colunas `worker_id`, `heartbeat_em`, `tentativas`, `max_tentativas` (3), `session_id`, `motivo_falha`. `fila_prompts_pegar_interno(p_conta, p_worker_id)` grava posse e incrementa a tentativa; `fechar_interno` só aceita de quem pegou (*fencing*). `p_worker_id` = o id da sessão da Routine (`get_session` sem argumento → `session_id`). |
| **D2** | **expiração com fim** | a régua é **45 min sem sinal** (não 6 h desde o `pego_em`): sessão longa e VIVA não é roubada; morta há 46 min devolve. `tentativas < max_tentativas` → volta para `na_fila`; senão → `falhou` com `motivo_falha = 'expirou N vezes sem fechamento'` e `custo_usd` = o ESTIMADO (conservador: quem sumiu gastou). Item devolvido **não** é re-pego pela mesma chamada. `pegar_interno` devolve `devolvidos` e `mortos`. |
| **D3** | **elegibilidade por item** | `painel_fila_reservado(conta)` soma só `pega` com heartbeat vivo (EM EXECUÇÃO); `na_fila` não reserva mais nada. O pull escolhe o mais antigo cujo `medido + em_execucao + estimado <= teto` (`for update skip locked`, ordem `criado_em`), pulando os que não cabem (`pulados`; quando nada cabe, o `motivo` nomeia o menor custo que sobrou). **Admissão só recusa o impossível** (`estimado > teto` da conta, ou conta inexistente) — item que não cabe hoje ENTRA na fila e roda quando houver espaço. `painel_fila_na_fila(conta)` existe só para ESCOLHER a conta. |
| **D4** | **vazão** | o doc do worker ganhou laço 5b→5g: até 3 itens por disparo, sequenciais (um `create_session` por vez), com heartbeat a cada passo. |
| **D5** | **desempate único** | roteamento automático = maior espaço livre (`teto − medido − em_execucao − na_fila`); empate pela ordem de `CONTAS` no TS (lucasscudeler, lsgpandora, almapetra). A regra mora em **um** lugar — `src/core/prompts/roteador.ts` — e o `case` do SQL cita esse caminho em comentário. `tests/unit/roteador-de-conta.test.ts` roda a mesma tabela de cenários contra um espelho da ordem SQL (mais 200 cenários aleatórios). |
| **D6** | **sem dupla contagem** | `fechar_interno` grava `p_session_id` (a sessão FILHA). `painel_fila_consumo_hoje` **não soma** o item da fila cuja sessão já aparece em `painel_frentes_sessoes` (mesma conta, mesmo dia do operador) — a medição publicada prevalece. |
| **D7** | **`pega` não é beco sem saída** | `fila_prompts_cancelar(p_secret, p_id)` aceita `na_fila` **e** `pega`; o item para de reservar na hora e `fila_prompts_heartbeat_interno` passa a devolver `{ok:false, motivo:'cancelado'}` — o worker interrompe a sessão filha (`interrupt_session`). Na tela, o botão cancelar aparece nos dois estados. |
| **D8** | **idempotência e paginação** | 2º `fechar_interno` do MESMO worker → `{ok:true, ja_fechado:true}` (de outro worker → erro de posse). `fila_prompts_listar(p_secret, p_limite default 50, p_antes_de default null)` pagina por `criado_em desc` e devolve `prompt` truncado em 300 caracteres + `promptTamanho`; a tela mostra 50 e um "mostrar mais 50" (`/prompts?limite=100`). |
| **D9** | **textos** | recusas e avisos usam `ROTULO_COMPLEXIDADE` ("máxima") e dinheiro com vírgula (`formatarUsd`): *"Nenhuma conta tem US$ 120,00 livres hoje para uma tarefa máxima. A mais próxima (Pandora) tem US$ 102,90."* Cartão no teto não sugere modelo — diz "teto atingido — próximo espaço amanhã". |

### Assinaturas (as antigas foram removidas de propósito)

| RPC | Quem chama | Assinatura |
|---|---|---|
| `fila_prompts_enfileirar` | painel (segredo) | `(p_secret text, p_payload jsonb)` → `{ok, id, conta, complexidade, modelo_sugerido, motivo_codigo, cabe_hoje, headroom_usd, espaco_livre_usd, custo_estimado_usd, na_fila_usd, itens_na_frente}` — **sem `motivo`**: nenhuma frase atravessa o banco (D14) |
| `fila_prompts_cancelar` | painel (segredo) | `(p_secret text, p_id uuid)` → `{ok, motivo_codigo, tentativas, custo_lancado_usd}` — aceita `na_fila` e `pega` |
| `fila_prompts_ajustar_custo` | painel (segredo) | `(p_secret text, p_id uuid, p_custo_usd numeric)` — só `falhou`/`cancelada` fechados hoje (D20) |
| `fila_prompts_listar` | painel (segredo) | `(p_secret text, p_limite integer default 50, p_antes_de timestamptz default null, p_antes_id uuid default null)` — **as versões de 1 e de 3 argumentos foram removidas** (duas assinaturas com default dariam "function is not unique") |
| `fila_prompts_pegar_interno` | worker (sem segredo) | `(p_conta text, p_worker_id text)` — **a de 1 argumento foi removida**: sem ela, um worker pegaria item sem gravar posse nem tentativa. Devolve, desde a rodada 5, `mortos_usd` (quanto os mortos deste disparo lançaram) e `headroom_usd` (a régua que decidiu quem cabia), além de `devolvidos`/`mortos`/`pulados`/`em_espera`/`estimativa_*` |
| `fila_prompts_heartbeat_interno` | worker (sem segredo) | `(p_id uuid, p_conta text, p_worker_id text, p_session_id text default null)` — nunca levanta exceção por ESTADO (devolve `{ok:false, motivo}`); levanta, sim, quando o `session_id` é o do worker ou já é de outro item (D11). Devolve `expira_em` (D18) |
| `fila_prompts_fechar_interno` | worker (sem segredo) | `(p_id uuid, p_conta text, p_worker_id text, p_estado text, p_custo_usd numeric, p_session_id text default null, p_sessao_url text default null, p_resultado text default null)` — **a de 6 argumentos foi removida** |

As três `_interno` são `SECURITY DEFINER` com `revoke all from public, anon, authenticated` — só
dono/`postgres` executa, que é o papel do MCP Supabase da PRÓPRIA conta
(`mcp__Supabase__execute_sql`), sem nenhum segredo de aplicação em trânsito. Provado ao vivo:
`has_function_privilege('anon'|'authenticated', …)` = `false` nas 3, e nas 4 funções auxiliares
(`painel_fila_consumo_hoje`, `painel_fila_reservado`, `painel_fila_na_fila`,
`painel_fila_medido_ate`) — e, desde a rodada 4, também em `painel_fila_itens_do_dia`,
`painel_fila_estimativa_usd`, `painel_fila_estimativa_itens` e `painel_fila_em_espera`.
`fila_prompts_ajustar_custo` é secret-gated como as demais RPCs do painel: chamada sem o segredo
(ou com o errado) devolve `fila_prompts_ajustar_custo: acesso negado`.

### O que continua valendo das rodadas anteriores

- **`painel_custo_estimado(complexidade, usd)`** — 1 fonte para o custo estimado (baixa 5 · media
  15 · alta 50 · maxima 120), lida pelo trigger E espelhada em `CUSTO_ESTIMADO_POR_COMPLEXIDADE`
  (`src/core/prompts/tipos.ts`). `custo_estimado_usd` é SEMPRE recalculado pelo trigger — nenhum
  caller pode forjar o valor.
- **Fuso do operador:** `painel_dia_operador()` (America/Sao_Paulo) em toda contagem de "hoje".
- **RLS fechada:** `painel_consumo_por_conta_dia` com `security_invoker = on` +
  `revoke select … from anon, authenticated`; leitura do painel reusa a allowlist de
  `painel_frentes_*` (`painel_frentes_leitor_autorizado()`, migration do hub
  `20260912a_painel_frentes_tres_contas.sql`).
- **`custo_usd` 0..500** na coluna e em `fechar_interno` (negativo zerava o freio do teto).
- O texto exato que a Routine de cada conta roda está em
  `Lucas-Contexto-Geral/docs/ops/PROMPT-ROUTINE-publicar-sessoes-outras-contas-2026-09-12.md`
  §"Fila de prompts (P7 · rodada 3)". Exige edição manual do operador nas 3 contas (a API de
  Routines não deixa uma sessão editar a Routine de outra conta).

### Página

`/prompts` — 3 cartões de conta (gasto medido + em execução vs teto, "medido até <última sync>",
livre em US$, o que espera na fila, cor ok/warn/crit, e no teto "próximo espaço amanhã" sem
sugerir modelo) + formulário "Novo prompt" (complexidade → modelo ao vivo; "não cabe hoje" é
AVISO, não bloqueio — só o impossível desabilita o envio) + tabela da fila com estado ("sem
sinal" quando o worker emudeceu), idade da execução, último sinal, tentativa N de M, prompt
truncado/expansível, cancelar em `na_fila` e `pega`, e "mostrar mais" por CURSOR (D15). Rodada 4
na tela: nenhum número negativo (D13 — "sem espaço livre agora"), a parcela de estimativa dita no
cartão e marcada na célula de custo ("estimativa da casa"), botão **ajustar custo** na linha de
item `falhou`/`cancelada` cujo número a casa estimou (D20), e a frase de resposta montada em TS
(D14). Modo fixture: store em memória (`src/lib/repositories/prompts-fila.fixture-store.ts`) que
espelha D1–D3/D7/D8 e, agora, D10/D12/D15/D16/D19/D20 — coberto por
`tests/unit/prompts-fila-fixture-store.test.ts`. Rodada 5 na tela: a frase de cancelamento e a
de ajuste de custo são renderizadas pelos PRÓPRIOS botões (D22), o painel de ajuste é um `<form>`
(Enter salva, #8) e as duas ações da linha ficam sempre montadas para o `router.refresh()` não
levar a frase embora.

## Rollback

Vercel instant rollback. `/api/health` é a sonda do rollback automático
(kill-switch nº 6). A página pública de status (Edge Function) segue no ar
independente da Vercel.

## Fase 2 (E6 — automação n8n)

Só depois de alguns dias de uso real da Fase 1 em prod (PRD §8). Não iniciada.
