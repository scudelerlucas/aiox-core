# O painel não abre porque aponta para o banco de outro sistema — e agora ele diz isso

- **Data:** 2026-09-18 (madrugada; continuação da sessão de 17/09)
- **Repo/tema:** aiox-core (packages/lifeboard)
- **Branch/PR:** `claude/happy-cerf-9fz8uk` — PR #35 **mergeado**, PR #36 aberto

## O que foi feito
Mergeei o PR #35 (as 3 migrações recuperadas do banco). Depois o Lucas mandou o print do painel
em produção: ao clicar em "Entrar com Google" ele saía do app e caía num JSON cru do Supabase —
`{"code":400,...,"msg":"Unsupported provider: provider is not enabled"}` — no host
`…gzmnivmkyop.supabase.co`.

**Não era bug novo.** O laudo `packages/lifeboard/DIAGNOSTICO-500-troca-de-projeto-2026-09-15.md`
já dizia, desde 15/09: a Vercel foi revertida para `ofskmjpzlgzmnivmkyop` (o banco do sistema de
RAG/embeddings, onde nenhuma migração do LifeBoard jamais rodou), *"que também não deixa ninguém
entrar — ele não tem o login do Google ligado"*, e *"não existe, hoje, um estado em que o painel
funcione"*. O ref do print é o fim desse mesmo ref, cortado pela barra do navegador. A hipótese
**H6** daquele laudo passa de EM ABERTO para **confirmada em produção**.

Abri o PR #36 com o que dá para consertar por código: antes de navegar, o clique pergunta ao
endpoint público `/auth/v1/settings` se o Google está ligado; se o Supabase responder que não, a
tela mostra a frase em português com o ref do projeto e onde ligá-lo, em vez de mandar a pessoa
embora (régua `kernel-inicio` §6/B11 — erro em português na tela, nunca JSON). Degrada como o
portão: só um "desligado" explícito segura o clique; rede fora ou resposta estranha deixam o login
seguir. 11 testes novos, com falsificação (removi a detecção → vermelho; devolvi → verde).

## Decisões tomadas
- Não ligar o Google no banco antigo, embora pareça o atalho (Claude): o login passaria e o painel
  quebraria na tela seguinte — as tabelas do LifeBoard nunca existiram lá.
- Consertar o código para a falha ficar **visível**, sem tentar consertar a configuração: mudar
  variável de deploy e ligar provedor é ato do dono clicando (`execucao-remota`).
- Recomendei ao operador fazer a troca **no computador**, não no celular (ele estava com 14% de
  bateria, e o procedimento envolve copiar chave entre dois painéis).

## Vetos aceitos: 0

## Pendências / próximos passos
- **Achado, não item de frente** (regra `item-so-entra-com-dono`: sem data e sem quem cobra, não
      entra; corrigido em 25/09 por achado do Codex no PR #36): **apontar a Vercel para
      `hciiilopyivjaekaxfqp` e ligar o Google lá** é ato do Lucas. Ordem completa (as 4 variáveis
      juntas, `LIFEBOARD_LOAD_SECRET` incluído, `DATA_MODE` por último) em
      `packages/lifeboard/DEPLOY.md` §"Ordem para migrar de projeto". **É o que destrava.** Vira
      frente no dia em que ele der a data e nomear quem cobra.
- [x] Revisar e mergear o PR #36 — passou a ser dirigido pela sessão `01GygEsmt2…` em 25/09
      (decisão 1-A do operador, 24/09); fecha quando a última thread do Codex for corrigida.
- [ ] `Jest Tests (Node 25)` falhou na `main` depois do merge do #35, em
      `tests/integration/pipeline-memory-integration.test.js` (1 teste em 7.870, pacote sem
      relação com lifeboard). **Passou verde no PR #36, mesmo código** → era instabilidade do
      teste, não regressão. Sem dono; fica registrado, não aberto como frente.

## Links
- PR #35 (mergeado): https://github.com/scudelerlucas/aiox-core/pull/35
- PR #36 (aberto): https://github.com/scudelerlucas/aiox-core/pull/36
- Painel (não abre até a troca): https://aiox-core-lifeboard-scudelerlucas-projects.vercel.app/
- Laudo que já previa isto: `packages/lifeboard/DIAGNOSTICO-500-troca-de-projeto-2026-09-15.md`

## Ferramentas usadas
Bash, MCP do GitHub, vitest/tsc/next build locais. A rede deste ambiente não alcança
`*.vercel.app` (`CONNECT 403`) — nenhuma verificação do painel foi feita daqui.
