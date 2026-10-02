-- ════════════════════════════════════════════════════════════════════════════
-- 0032 · LIFEBOARD v3 · D52 também chega pelo caminho real de produção
-- ════════════════════════════════════════════════════════════════════════════
--
-- A 0025 introduziu esta trava, mas nunca foi aplicada em produção. Aplicar
-- apenas 0027–0030 sobre aquele estado deixava viva a versão sql/stable da
-- 0018: a checagem podia ler "sessão sem dona" enquanto a Routine publicava a
-- mesma sessão. Esta redefinição re-aplicável põe D52 depois do pacote que o
-- DEPLOY manda aplicar em produção, independentemente da ordem histórica.

create or replace function public.painel_sessao_dona(p_sessao_id text)
returns text
language plpgsql
security definer
volatile
set search_path = public, pg_temp
as $$
declare
  v_conta text;
begin
  if p_sessao_id is null then
    return null;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('sessao:' || p_sessao_id, 0));

  select s.conta into v_conta
    from public.painel_frentes_sessoes s
   where s.sessao_id = p_sessao_id
   limit 1;

  return v_conta;
end;
$$;

comment on function public.painel_sessao_dona(text) is
  'D34a + D52 (reafirmada na 0032): a conta dona de uma sessão publicada, ou NULL quando ela ainda não foi publicada. A leitura acontece depois de pg_advisory_xact_lock na mesma chave sessao:<id> usada pelo livro; a 0032 garante a trava também no caminho de produção que não recebeu a 0025.';

revoke all on function public.painel_sessao_dona(text) from public, anon, authenticated;
