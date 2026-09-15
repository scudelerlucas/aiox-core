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
