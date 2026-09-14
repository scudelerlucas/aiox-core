-- ════════════════════════════════════════════════════════════════════════════
-- PASSO 0b — HISTÓRICO DE MIGRATIONS DESTE PROJETO (só leitura)
-- ════════════════════════════════════════════════════════════════════════════
-- O card do projeto mostra "LAST MIGRATION: harden_legacy_tnf_search_path",
-- um nome que não é do LifeBoard. Isso significa que este banco TEM histórico
-- de migrations, de outra coisa. Esta consulta lê esse histórico inteiro.
--
-- O que procurar no resultado:
--   · aparece `painel_frentes_tres_contas`?  -> a migration do hub JÁ rodou
--     aqui, e as tabelas foram apagadas depois (alguém dropou, ou um reset).
--   · NÃO aparece?                            -> ela rodou em outro projeto,
--     que hoje não existe mais nesta conta.
--   · aparecem nomes tipo `tnf`, ou de outro app -> este projeto Supabase é
--     compartilhado com outro sistema seu.
-- ════════════════════════════════════════════════════════════════════════════
select
  version                                     as versao,
  name                                        as nome,
  case when name ilike '%painel_frentes%' then '<<< A DO HUB'
       when name ilike '%lifeboard%' or name ilike '%fila_prompts%' or name ilike '%caixa%'
            or name ilike '%livro_razao%' then '<<< LIFEBOARD'
       else '' end                            as marcador
from supabase_migrations.schema_migrations
order by version;
