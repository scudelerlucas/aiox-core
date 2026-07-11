-- =============================================================================
-- Teste local da migration 0001_init (Postgres efêmero, sem Supabase real).
-- Roda: DAG anti-ciclo (stress test 1 do PRD §11) + smoke de RLS/estrutura.
-- Uso:  psql -v ON_ERROR_STOP=0 -f 0001_init.test.sql
-- Requer stub auth.uid() (criado abaixo) porque não há GoTrue local.
-- =============================================================================

-- --- Stub de auth para ambiente local (Supabase provê isto em prod) ----------
create schema if not exists auth;
create or replace function auth.uid() returns uuid
  language sql stable
  as $$ select coalesce(
           nullif(current_setting('request.jwt.claim.sub', true), '')::uuid,
           '00000000-0000-0000-0000-000000000001'::uuid) $$;

\echo '=== Aplicando migration 0001_init.sql ==='
\i 0001_init.sql

-- IDs fixos para legibilidade dos testes.
-- A = ...aaa1 · B = ...bbb2 · C = ...ccc3
\set idA '''11111111-1111-1111-1111-111111111111'''
\set idB '''22222222-2222-2222-2222-222222222222'''
\set idC '''33333333-3333-3333-3333-333333333333'''
\set src '''99999999-9999-9999-9999-999999999999'''

\echo ''
\echo '=== Setup: 1 source + 1 project ==='
insert into public.sources (id, kind, label, auth_mode)
  values (:src, 'calendar', 'Test Cal', 'api');
insert into public.projects (id, source_id, external_ref, title, status)
  values ('88888888-8888-8888-8888-888888888888', :src, 'proj-1', 'P1', 'active');

-- ---------------------------------------------------------------------------
\echo ''
\echo '=== TEST 1: inserir A sem dependências (deve PASSAR) ==='
insert into public.tasks (id, project_id, source_id, external_ref, title)
  values (:idA, '88888888-8888-8888-8888-888888888888', :src, 'A', 'Task A');

\echo '=== TEST 2: inserir B com predecessor A (B depende de A) (deve PASSAR) ==='
insert into public.tasks (id, project_id, source_id, external_ref, title, predecessor_ids)
  values (:idB, '88888888-8888-8888-8888-888888888888', :src, 'B', 'Task B', array[:idA]::uuid[]);

\echo ''
\echo '=== TEST 3 (STRESS 1): fechar ciclo A->B->A via UPDATE (deve FALHAR) ==='
\echo '--- esperado: ERROR "DAG cycle detected" ---'
update public.tasks set predecessor_ids = array[:idB]::uuid[] where id = :idA;

\echo ''
\echo '=== TEST 4: auto-referência A->A (deve FALHAR) ==='
\echo '--- esperado: ERROR "cannot reference itself" ---'
update public.tasks set predecessor_ids = array[:idA]::uuid[] where id = :idA;

\echo ''
\echo '=== TEST 5: ciclo via successor_ids (representação alternativa) ==='
\echo '--- insere C com successor A; depois torna A antecessor de C via successor -> ciclo (deve FALHAR) ---'
insert into public.tasks (id, project_id, source_id, external_ref, title, successor_ids)
  values (:idC, '88888888-8888-8888-8888-888888888888', :src, 'C', 'Task C', array[:idA]::uuid[]);
-- Agora C->A existe (C antes de A). Fazer A->C (A antes de C) fecha ciclo:
update public.tasks set successor_ids = array[:idC]::uuid[] where id = :idA;

\echo ''
\echo '=== TEST 6: quebrar o ciclo, dependência linear A->B->C (deve PASSAR) ==='
-- Remove successor de C, deixa cadeia acíclica: A pred [], B pred [A], C pred [B]
update public.tasks set successor_ids = '{}'::uuid[] where id = :idC;
update public.tasks set predecessor_ids = array[:idB]::uuid[], successor_ids = '{}'::uuid[] where id = :idC;
\echo '--- estado atual das tasks ---'
select external_ref, predecessor_ids, successor_ids from public.tasks order by external_ref;

\echo ''
\echo '=== TEST 7: idempotência — reinserir (source_id, external_ref)=(src,A) deve FALHAR ==='
\echo '--- esperado: ERROR unique violation uq_tasks_source_extref ---'
insert into public.tasks (project_id, source_id, external_ref, title)
  values ('88888888-8888-8888-8888-888888888888', :src, 'A', 'dup A');

\echo ''
\echo '=== TEST 8: RLS — verificar que está habilitado nas 4 tabelas ==='
select relname, relrowsecurity
  from pg_class
  where relname in ('sources','projects','tasks','sync_log') and relnamespace = 'public'::regnamespace
  order by relname;

\echo ''
\echo '=== TEST 9: RLS — contagem de policies por tabela (esperado 4 cada) ==='
select tablename, count(*) as policies
  from pg_policies
  where schemaname = 'public'
  group by tablename order by tablename;

\echo ''
\echo '=== TEST 10: RLS negativa — usuário diferente NÃO vê linhas de outro owner ==='
-- Superuser ignora RLS mesmo com FORCE; por isso usamos um role não-superuser.
-- SET LOCAL + set_config(...,is_local=true) exigem bloco de transação (BEGIN/COMMIT).
do $$ begin
  if not exists (select 1 from pg_roles where rolname='lifeboard_test_user') then
    create role lifeboard_test_user nologin;
  end if;
end $$;
grant usage on schema public to lifeboard_test_user;
grant select on all tables in schema public to lifeboard_test_user;
grant execute on all functions in schema auth to lifeboard_test_user;
alter table public.tasks force row level security;

\echo '--- Como owner default (...0001): esperado ver 3 tasks ---'
begin;
  select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001', true);
  set local role lifeboard_test_user;
  select count(*) as tasks_como_owner from public.tasks;
commit;

\echo '--- Como outro usuário (...00ff): esperado 0 tasks (RLS isola) ---'
begin;
  select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000ff', true);
  set local role lifeboard_test_user;
  select count(*) as tasks_outro_usuario from public.tasks;
commit;

alter table public.tasks no force row level security;

\echo ''
\echo '=== FIM DOS TESTES ==='
