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

## Fila de prompts entre as 3 contas (P7, 13/09/2026 — corrigida 13/09/2026 após REPROVAÇÃO do crítico hostil)

Pedido do operador: "poder promptar soluções pelo painel na conta que tem mais tokens
disponíveis para a complexidade da tarefa". Arquitetura decidida pelo mapa `!4z` do hub
(`docs/ops/LIFEBOARD-V3-4z-atomos-e-gargalo-2026-09-13.md`, linhas R1/R2/R6): a cota real
de uma conta Max não é mensurável por nenhuma API (R1) — o roteador usa o INVERSO medido
(consumo do dia por conta) — e um painel numa conta não abre sessão em outra (R2) — por
isso o modelo é **PULL**: o painel só escreve na fila; a Routine diária de cada conta é
quem pega o que é dela.

- **Migrations:** `0007_lifeboard_v3_fila_prompts.sql` (tabelas
  `painel_fila_prompts`/`painel_teto_diario`, seed US$150/dia por conta — régua da casa
  `teto-de-gasto-diario`) + `0009_lifeboard_v3_fila_ajustes.sql` (correção da RODADA 1 do
  crítico hostil, 16 achados — trigger com reserva, worker sem segredo de app, fuso do
  operador, RLS fechada, etc.) + `0011_lifeboard_v3_fila_ajustes_2.sql` (correção da
  RODADA 2: boundary do teto alinhado entre TS e SQL — aceita sse
  `medido+reservado+estimado <= teto`, recusa só ao ULTRAPASSAR, nunca no empate; `falhou`
  agora conta no medido do dia; trigger ganha lock `FOR UPDATE` na linha do teto da conta
  — TOCTOU de dois inserts concorrentes; item `pega` há mais de 6h volta sozinho para
  `na_fila`; `painel_fila_reservado`/`painel_fila_medido_ate` fecham privilégio de
  anon/authenticated — ver o cabeçalho de cada arquivo para a lista inteira).
- **`painel_custo_estimado(complexidade, usd)`** — 1 fonte para o custo estimado por
  complexidade (baixa 5 · media 15 · alta 50 · maxima 120), lida pelo trigger E espelhada
  em `CUSTO_ESTIMADO_POR_COMPLEXIDADE` (`src/core/prompts/tipos.ts`). Cada item da fila
  grava `custo_estimado_usd` — SEMPRE recalculado pelo trigger a partir de
  `complexidade`, nunca aceito de fora.
- **Reserva de teto (achado CRÍTICO #1):** o trigger `BEFORE INSERT` em
  `painel_fila_prompts` recusa quando `medido_hoje + reservado (na_fila+pega) + este item
  > teto` (0011: era `>=`, empatava no exato valor do teto — corrigido para alinhar com o
  TS, que sempre aceitou em empate) — antes só olhava o medido, e 5 prompts Fable cabiam a
  US$149,99/150 porque nada somava o que já estava na fila. `painel_fila_reservado(conta)`
  faz essa soma (0011: ignora `pega` há mais de 6h — ver abaixo).
- **RPCs secret-gated (painel apenas):** `fila_prompts_enfileirar(p_secret, p_payload)` —
  cria o item; sem `conta` no payload, roteia pela conta com mais HEADROOM (não só menor
  consumo — uma conta quase no teto não cabe pra uma tarefa Fable mesmo com "espaço"
  nominal). `fila_prompts_cancelar(p_secret, p_id)` — só cancela `na_fila`.
  `fila_prompts_listar(p_secret)` — fila inteira + consumo/teto/reservado/`medidoAteEm`
  das 3 contas numa chamada só. Guardadas pelo MESMO segredo de
  `lifeboard_load`/`lifeboard_mutate` (`private.lifeboard_config.load_secret`).
- **O WORKER (Routine de cada conta) NUNCA usa o segredo do painel (achado CRÍTICO #4,
  DECISÃO do operador):** `fila_prompts_pegar_interno(p_conta)` e
  `fila_prompts_fechar_interno(p_id, p_conta, p_estado, p_custo_usd, p_sessao_url,
  p_resultado)` são `SECURITY DEFINER` com `revoke all from public/anon/authenticated` —
  só quem é dono/`postgres` executa, que é exatamente o papel do MCP Supabase da PRÓPRIA
  conta do operador (`mcp__Supabase__execute_sql`), sem nenhum segredo em trânsito.
  `fechar_interno` amarra chamador↔conta (`estado='pega' and conta=p_conta`) — uma conta
  não fecha o item de outra. As RPCs antigas `fila_prompts_pegar`/`fila_prompts_fechar`
  (secret-gated) foram REMOVIDAS em 0009 — o worker novo é só as `_interno`. O texto
  exato que a Routine de cada conta roda (SQL do `execute_sql` + o passo de
  `create_session` no modelo sugerido) está em
  `Lucas-Contexto-Geral/docs/ops/PROMPT-ROUTINE-publicar-sessoes-outras-contas-2026-09-12.md`
  §"Fila de prompts (P7)". Isto exige edição manual do operador nas 3 contas (a API de
  Routines não deixa uma sessão editar a Routine de outra conta).
- **Fuso do operador (achado ALTO #6):** `painel_dia_operador()` (America/Sao_Paulo)
  substitui `current_date`/UTC cru em toda contagem de "hoje" — view, função de consumo,
  trigger.
- **RLS fechada (achado ALTO #5):** `painel_consumo_por_conta_dia` ganhou
  `security_invoker = on` + `revoke select … from anon, authenticated` (antes vazava 60
  linhas pra `anon` enquanto a tabela-base devolvia 0); `painel_fila_consumo_hoje` não é
  mais chamável direto por `anon`/`authenticated` (só pelas RPCs secret-gated).
- **RLS de leitura do painel:** reusa a MESMA allowlist de `painel_frentes_*` — tabela
  `painel_frentes_leitores` + função `painel_frentes_leitor_autorizado()` (migration do
  hub, `20260912a_painel_frentes_tres_contas.sql`, já aplicada no mesmo projeto Supabase).
- **Página:** `/prompts` — 3 cartões de conta (medido + reservado vs teto, "medido até
  <última sync>", headroom livre em US$, cor ok/warn/crit) + formulário "Novo prompt"
  (complexidade → modelo sugerido ao vivo, conta opcional com aviso "no teto — vai
  recusar" quando sem espaço, tarefa opcional para linkar) + tabela da fila com prompt
  truncado/expansível e cancelar. Modo fixture: store em memória
  (`src/lib/repositories/prompts-fila.fixture-store.ts`), mesmo padrão de
  `tasks.fixture-store.ts` (P6).

## Rollback

Vercel instant rollback. `/api/health` é a sonda do rollback automático
(kill-switch nº 6). A página pública de status (Edge Function) segue no ar
independente da Vercel.

## Fase 2 (E6 — automação n8n)

Só depois de alguns dias de uso real da Fase 1 em prod (PRD §8). Não iniciada.
