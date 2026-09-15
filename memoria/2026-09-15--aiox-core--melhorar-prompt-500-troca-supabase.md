# 2026-09-15 · aiox-core · !melhorar — o 500 da troca de projeto Supabase no LifeBoard

## Feito
- `!melhorar` (PEP v2 por escrito) sobre o pedido "investigar por que a troca da Vercel para
  `hciiilopyivjaekaxfqp` quebrou o middleware do LifeBoard com erro 500".
- Produto: `docs/lifeboard/00-PROMPT-MELHORADO-vercel-troca-supabase-500-v1.0.md` — 6 hipóteses
  medidas no código (H1 a H6), cada uma com o falsificador que a mata, mais o prompt pronto para
  colar numa sessão nova. **Nada foi executado** — rodar é a sessão seguinte.
- `!arsenal`: arma escolhida `!atom v2` (9,5) + Catálogo de Modos de Falha (8,5, sempre ligado).
  `!estressar³` fica sugerido (⚙), não disparado — é explícito-only.

## Achados novos (todos nível A, lidos no repo)
- **H1 — caminho duplo de credencial.** `src/middleware.ts` (portão) e `src/lib/supabase/browser.ts`
  leem `NEXT_PUBLIC_*` direto; `src/lib/supabase/auth-server.ts` (retorno do login Google) lê por
  `@/config/env`, que **prefere** `SUPABASE_URL`/`SUPABASE_ANON_KEY` sem prefixo. Se o par sem
  prefixo apontar para o projeto antigo, o retorno abre sessão num projeto e o portão procura no
  outro — vira loop de login. O `DEPLOY.md` avisa sobre o par em geral, mas não nomeia este caminho.
- **H2 (a mais provável) — exceção sem rede.** `await supabase.auth.getUser()` no middleware não
  está em `try`/`catch`. A biblioteca relança erro que não seja de autenticação; URL malformada
  (espaço, quebra de linha) vira 500 em todas as rotas menos `/login`, `/auth/*` e `/api/health`.
- **`src/middleware.ts` não tem nenhum teste** — é o portão de entrada do sistema.
- **`vitest.config.ts` só inclui `tests/**`** — teste escrito em `src/` não roda e parece verde.
- **A consulta a `painel_frentes_leitores` TEM `try`/`catch`** → explica "não entro", nunca 500.
- **RUÍNA:** o "rollback" não restaurou nada seguro — o projeto antigo está sem login Google, então
  o estado de hoje também bloqueia todo mundo. Não há estado seguro para ficar parado.
- **Três números para a mesma pergunta:** `DEPLOY.md` diz 20 marcadores (0011 `NAO VERIFICAVEL`),
  o resumo de 15/09 diz 15/15, o operador disse 21/21. Medir uma vez e corrigir os três.

## Decisões pendentes do operador
- D1 até onde a próxima sessão vai (recomendado: laudo + correção + guiar o Preview).
- D2 LifeBoard ganha projeto Supabase próprio? (recomendado: não agora).
- D3 unificar o número de migrations conferidas (recomendado: medir e corrigir).
- D4 `!estressar³` no `DEPLOY.md` depois da causa conhecida (recomendado: sim).

## Pendências com dono
- **Coletar a linha de log do 500 na Vercel** — dono: Lucas, pela missão de navegador que a próxima
  sessão exporta no primeiro turno. É o dado decisivo; sem ele tudo continua hipótese.

## Ferramentas usadas
Skill `melhorar-prompt`, skill `arsenal`, leitura do repo (Bash/grep).

## Vetos aceitos: 0

## Decisões do operador e o que foi executado (mesma sessão)
**D1-B · D2-A · D3-A · D4-A.**
- **Defeito real achado e corrigido (H2):** `src/middleware.ts` chamava `supabase.auth.getUser()`
  sem `try`/`catch`. A biblioteca relança erro que não é de autenticação → exceção crua no
  middleware → 500 em TODAS as rotas menos `/login`, `/auth/*` e `/api/health`. Agora degrada para
  o login, mesma disciplina de `linha-do-tempo-degrada` e `home-degrada-sem-cair`.
- **Teste que faltava:** `tests/unit/middleware.test.ts`, 9 casos. Provado nos dois sentidos —
  2 falham com o código antigo, 9 passam com a correção, voltam a falhar ao desfazer. O portão era
  a única peça do sistema sem nenhum teste.
- **Qualidade:** `tsc --noEmit` limpo, suíte 1342/1342 (eram 1333 + 9 novos).
- **`DEPLOY.md`, 2 emendas:** (a) a armadilha 1-b — o retorno do Google (`auth-server.ts`) lê por
  `@/config/env`, que prefere as variáveis SEM prefixo, enquanto portão e browser leem só as
  `NEXT_PUBLIC_*`; (b) o passo do Preview agora manda conferir o redirect URL no Supabase ANTES de
  testar, senão o Preview reprova por motivo errado.
- **D3 medido:** 21 migrations (0001–0021) · 20 conferíveis pelo `PASSO-0` v2 (a 0011 sai como
  `NAO VERIFICAVEL`) · o "15/15" do resumo anterior era a v1 do PASSO-0, do mesmo dia, antes da
  correção que o próprio cabeçalho do script registra. Os três números não se contradizem.
- **H4 descartada como causa do 500:** a consulta a `painel_frentes_leitores` já tem `try`/`catch`
  → vira redirecionamento, nunca 500. Continua sendo a parede seguinte.
- **H1, H3, H5, H6 em aberto:** dependem de tela que esta sessão não alcança. Missão exportada em
  `docs/ops/PROMPT-CHROME-2026-09-15-lifeboard-vercel-diagnostico.md` (só leitura, nenhum segredo).
- **D4 parcial:** as emendas entraram; o `!estressar³` completo no `DEPLOY.md` espera a causa fechar.

## Pendência com dono
- **Rodar a missão de navegador e trazer a linha de log do 500** — dono: Lucas, 15/09/2026.
  Sem ela, H2 é defeito provado mas não causa provada.

## Desfecho — dois PRs, não um
O PR #29 foi mergeado (17:02) ainda na versão só-documento; a correção de código saiu 6 min depois
e não entrou nele. Replantada em cima da `main` atualizada, virou o **PR #30**
(https://github.com/scudelerlucas/aiox-core/pull/30), **mergeado em 15/09 17:19**. Bilhete de
correção deixado no #29 para o histórico não atribuir a ele um conserto que não tem.

**Achado extra no #30, medido nos arquivos de config, não suposto:** `packages/lifeboard` não tem
NENHUMA cobertura no CI deste repositório — `jest.config.js` só casa `.js` (os testes do LifeBoard
são `.ts`/`.tsx`, vitest) e `tsconfig.json` não inclui `packages/`. Vale para todo PR já mergeado do
pacote, não só este. Decisão do operador (D-extra, mesma sessão): ligar ao CI fica **separado**,
não entra neste PR.

## Custo de vigilância (regra check-in-automatico-de-pr)
PR #29, rascunho só de documentação: **8 notificações recebidas, 0 acionáveis**. Quebra: 2 ecos da
própria inscrição, 2 avisos da Vercel (o mesmo comentário reescrito de *Building* para *Ready*, 2
projetos apontando para este repositório), 1 CodeRabbit dizendo que não revisa rascunho, 1 relatório
de cobertura vazio, 1 aviso de fim das verificações, 1 leitura de fila. As 27 verificações fecharam
sem falha; 17 delas foram puladas por não haver código no diff.
Aplicada a tabela: linha 1 não (o operador não pediu para vigiar este PR) · linha 2 não (verificações
terminais, sem conflito, nenhuma thread esperando ação minha) · **linha 3** → inscrição cancelada e
check-in apagado na hora, com aviso na mesma resposta. Rascunho parado em decisão do operador é o
caso-padrão de linha 3 que a regra já nomeia.

## Links
- `docs/lifeboard/00-PROMPT-MELHORADO-vercel-troca-supabase-500-v1.0.md`
- `packages/lifeboard/DEPLOY.md` (PR #26, mergeado)
