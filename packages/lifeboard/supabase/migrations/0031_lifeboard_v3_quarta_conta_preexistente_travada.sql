-- OS-LIFEBOARD · P7 — a quarta conta preexistente também fica travada
--
-- A 0027 protegia `arborcactus@gmail.com` somente quando a linha do teto ainda
-- não existia. Em produção, porém, a 0026 irmã já pode ter criado essa linha
-- com `exigir_medicao_recente = false`. Nesse estado, aplicar 0027–0030
-- mantinha uma conta sem Routine e sem medição elegível para a escolha
-- automática.
--
-- Esta correção é deliberadamente condicional: trava a conta apenas enquanto
-- ela nunca tiver produzido uma medição. Se já houver medição no livro, o
-- valor escolhido pelo operador permanece intocado.

create or replace function private.painel_fila_travar_conta_sem_medicao(p_conta text)
returns boolean
language plpgsql
set search_path = public, private, pg_temp
as $$
begin
  update public.painel_teto_diario t
     set exigir_medicao_recente = true
   where t.conta = p_conta
     and not t.exigir_medicao_recente
     and not exists (
       select 1
         from public.painel_caixa_lancamentos l
        where l.conta = t.conta
          and l.origem = 'medido'
     );

  return found;
end;
$$;

revoke all on function private.painel_fila_travar_conta_sem_medicao(text)
  from public, anon, authenticated;

select private.painel_fila_travar_conta_sem_medicao('arborcactus@gmail.com');

comment on function private.painel_fila_travar_conta_sem_medicao(text) is
  '0031: trava uma conta ainda sem nenhuma medição, inclusive quando a linha do teto já existia; não altera decisão do operador depois da primeira medição.';
