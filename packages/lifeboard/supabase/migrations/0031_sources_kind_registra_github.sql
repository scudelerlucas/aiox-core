-- OS-LIFEBOARD · 0031 — registra o kind `github` no CHECK de `public.sources`.
--
-- Por que existe (Tarefa Codex 01, 25/09/2026): as mudanças no código e as
-- branches de `painel_frentes_prs`/`painel_frentes_branches` passam a virar
-- tarefas ligadas no grafo, com `sources.kind = 'github'`. Hoje essa junção
-- acontece na LEITURA (`src/lib/frentes/no-grafo.ts`) — nada é gravado em
-- `tasks` nem em `sources`, então nenhuma tela depende desta migration para
-- funcionar. Ela existe pela lição de 13/09 (0003): a união TypeScript
-- `SourceKind` ganhou `'github'` e o arquivo do schema precisa dizer o mesmo,
-- senão o repositório volta a mentir sobre o próprio banco — e o dia em que
-- alguém quiser gravar uma fonte `github` de verdade, o CHECK já aceita.
--
-- As conversas do Claude usam o kind `claude_chat`, que o banco já tinha.
--
-- NÃO aplicada em produção por esta sessão: aplicar é passo do Lucas, no SQL
-- Editor do projeto hciiilopyivjaekaxfqp (kill-switch nº 1: gate humano).
-- Idempotente: pode rodar em banco novo ou já ampliado. Só-aditiva.

alter table public.sources
  drop constraint if exists sources_kind_check;

alter table public.sources
  add constraint sources_kind_check
  check (kind in ('calendar', 'gmail', 'drive', 'notes', 'claude_chat', 'lms', 'github'));

comment on constraint sources_kind_check on public.sources is
  'Kinds aceitos. Ampliar aqui E em src/types/canonical.ts (SourceKind) no mesmo ato — a divergência entre os dois derrubou a home em 13/09/2026. github: mudanças e branches lidas de painel_frentes_* (0031).';
