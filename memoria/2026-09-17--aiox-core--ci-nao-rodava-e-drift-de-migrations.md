# 2026-09-17 · aiox-core · O CI não rodava 1453 testes; e 3 migrações só existem no banco

## Feito
- **Job `package-tests` no CI.** Medido nos arquivos, não suposto: `jest.config.js` casa só
  `**/tests/**/*.test.js` e `tsconfig.json` não inclui `packages/`. Resultado: **1453 testes que
  passam nunca rodaram no CI** — lifeboard 1342 (vitest, `.ts`), idea-inbox 68 e idea-forge 43
  (`node --test`, `.mjs`). Toda mudança nesses 3 pacotes foi mergeada sem a suíte deles.
  O job roda o comando de teste DE CADA pacote + a verificação de tipos do lifeboard, e entra nos
  3 pontos do `validation-summary` (needs, linha de resultado, portão de falha).
- **`scripts/gerar-conferencia-drift.mjs` + `PASSO-0c-drift.sql`** (só leitura): compara o histórico
  do banco com os arquivos de `supabase/migrations/`. Quando o banco guarda o SQL (coluna
  `statements`), **devolve o SQL da migração perdida** — o conteúdo é recuperável, não reinventado.
- `DEPLOY.md` ganhou a linha do PASSO-0c. Missão de leitura em
  `docs/ops/PROMPT-CHROME-2026-09-17-lifeboard-drift-de-migrations.md`.

## Provado
- Comandos exatos do job após `npm ci`: 1342/1342, `tsc` limpo, 43/43, 68/68. No PR,
  `Package Tests (workspaces)` = verde em 50s.
- PASSO-0c contra réplica Postgres 16 que reproduz o caso real: acha as 3 órfãs, devolve o SQL das
  3, acha a `0016` duplicada. **Com a coluna `statements` removida do banco**, acha as 3 igual e
  avisa em vez de quebrar. Gerador determinístico (2 execuções, saída idêntica).

## Erros meus, registrados
- **O job novo saiu `skipped` no próprio PR que o introduz** — o filtro de caminhos não olhava
  `.github/workflows/**`. Eu ia entregar um portão nunca visto funcionando. Pior: um PR que quebre
  o arquivo do CI pulava os jobs que pegariam o estrago. Corrigido com filtro `ci` de alcance
  estreito (só na condição do job novo), para não virar mudança de política.
- **Anunciei "4 testes quebrados no idea-inbox" e estava errado** — era workspace não instalado
  (`npm install` feito de dentro de `packages/lifeboard`, não da raiz). Com a raiz: 68/68.
  Suíte vermelha em ambiente meio instalado não é evidência de nada.
- **Furei "um assunto por PR"**: os dois trabalhos caíram no #34 porque a branch da sessão é fixa e
  o PR já estava aberto. Declarado no topo do PR, não escondido; oferecida a divisão.

## Decisões do operador
- 15/09: D1-B, D2-A, D3-A, D4-A. Hoje: ligar os testes ao CI = trabalho separado (feito); atacar o
  drift = recomendação seguida; PR fica junto; parar até as missões rodarem.

## Pendências com dono
- **Rodar o PASSO-0c no painel** — dono: Lucas. Sem o resultado, escrever as 3 migrações seria chute.
- **Rodar a missão do erro 500 (15/09)** — dono: Lucas. H1/H3/H5/H6 seguem em aberto.
- **Endurecer o `DEPLOY.md` com `!estressar³`** — espera a causa do 500 fechar.

## Ferramentas usadas
Bash, Postgres 16 local (réplica de teste), MCP do GitHub, `yaml.safe_load` para validar o workflow.

## Vetos aceitos: 0

## Links
- PR #34 https://github.com/scudelerlucas/aiox-core/pull/34
