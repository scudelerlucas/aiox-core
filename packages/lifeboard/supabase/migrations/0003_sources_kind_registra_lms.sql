-- OS-LIFEBOARD · 0003 — registra o kind `lms` no CHECK de `public.sources`.
--
-- Por que existe: em 13/09/2026 a rota `/` caiu com HTTP 500 ("Element type is
-- invalid … but got: undefined") porque o banco vivo já tinha uma fonte
-- `kind = 'lms'` (a Cativa, desde 12/08) que a união TypeScript `SourceKind`
-- não conhecia. Ao investigar, apareceu o drift de fundo: o CHECK do banco de
-- produção JÁ aceitava 'lms' — alguém o ampliou direto no painel — mas a
-- migration 0001 continuava listando só os cinco kinds originais. Um ambiente
-- novo criado a partir das migrations rejeitaria uma linha que a produção
-- aceita: o repositório mentia sobre o próprio schema.
--
-- Esta migration não muda a produção (o CHECK de lá já é este) — ela alinha o
-- arquivo ao que está no ar, para que a próxima leitura do repositório não
-- volte a sustentar a premissa errada que originou a queda.
--
-- Idempotente: pode rodar em banco novo ou em banco já ampliado.

alter table public.sources
  drop constraint if exists sources_kind_check;

alter table public.sources
  add constraint sources_kind_check
  check (kind in ('calendar', 'gmail', 'drive', 'notes', 'claude_chat', 'lms'));

comment on constraint sources_kind_check on public.sources is
  'Kinds aceitos. Ampliar aqui E em src/types/canonical.ts (SourceKind) no mesmo ato — a divergência entre os dois derrubou a home em 13/09/2026.';
