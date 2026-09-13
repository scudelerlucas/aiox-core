"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { EstadoAcaoTarefa } from "@/app/tarefa/actions";

/**
 * OS-LIFEBOARD · P6 — equivalente a `useFormState`/`useActionState` para esta
 * árvore.
 *
 * O repositório fixa `react`/`react-dom` em 18.3.1 (checado antes de escrever
 * este arquivo: nenhum dos dois exporta `useFormState` nem `useActionState`
 * — os dois só existem a partir do 18.3 canary/19). O padrão pedido pela
 * spec ("erro em português perto do campo, nunca JSON", "useActionState/
 * useFormState") é reproduzido com `useState` + `useTransition`: o estado
 * anterior entra na chamada da Server Action (mesmo contrato de
 * `useFormState`), o retorno vira o novo estado, e `startTransition` dá o
 * `pending` sem bloquear a UI. `<form action={disparar}>` continua
 * funcionando (React aceita uma função qualquer, não só uma Server Action,
 * em `action`) — é só quem chama a Server Action que muda.
 *
 * Detalhe que custou um round de debug (smoke test com Playwright contra o
 * build de produção): chamar a Server Action IMPERATIVAMENTE — fora de um
 * `<form action={acaoDoServidor}>` literal — faz a mutação rodar de verdade
 * no servidor (o store/RPC grava, `revalidatePath` marca a rota como stale),
 * mas NÃO reidrata a árvore sozinho. `useFormState`/`useActionState` fariam
 * isso por baixo dos panos; sem eles, o cliente continuava mostrando a foto
 * antiga até este hook chamar `router.refresh()` explicitamente após um
 * sucesso.
 */
type AcaoServidor = (estado: EstadoAcaoTarefa, form: FormData) => Promise<EstadoAcaoTarefa>;

export interface AcaoTarefaControlada {
  estado: EstadoAcaoTarefa;
  pendente: boolean;
  disparar: (form: FormData) => void;
}

/**
 * `aoFalha` (achado MÉDIO #1, rodada 3 do crítico 13/09): chamado quando a
 * action devolve `{erro}` (`ok !== true`) — antes disto, um controle
 * otimista (`MaeForm`/`StatusForm`/`MetaForm`, que chamam `setValor(novo)`
 * ANTES do resultado da action) ficava mostrando o valor RECUSADO pelo
 * servidor: em `/tarefa/task-setup`, escolher uma mãe que criaria ciclo
 * mostrava o erro certo, mas o `<select>` continuava na mãe recusada — só
 * voltava ao valor real depois de um reload manual. Este callback devolve o
 * controle ao chamador para reverter o estado local ao último valor
 * CONFIRMADO (o que o servidor de fato aceitou), sem precisar de reload.
 */
export function useAcaoTarefa(
  acao: AcaoServidor,
  aoSucesso?: (estado: EstadoAcaoTarefa) => void,
  aoFalha?: (estado: EstadoAcaoTarefa) => void,
): AcaoTarefaControlada {
  const [estado, setEstado] = useState<EstadoAcaoTarefa>({});
  const [pendente, startTransition] = useTransition();
  const router = useRouter();

  function disparar(form: FormData): void {
    startTransition(() => {
      void (async () => {
        let resultado: EstadoAcaoTarefa;
        try {
          resultado = await acao(estado, form);
        } catch {
          // [MÉDIO #1, rodada 3] uma falha de REDE de verdade (fetch da
          // Server Action rejeita) nunca chega a devolver `{erro}` — sem
          // este `catch`, o `await` acima lançava, o resto da função nunca
          // rodava, e o controle otimista ficava preso no valor recusado
          // PARA SEMPRE (nem `aoFalha` nem `router.refresh()` disparavam).
          // Mensagem genérica em português — nunca a stack/erro cru na tela.
          resultado = { erro: "Não foi possível salvar agora — tente de novo." };
        }
        setEstado(resultado);
        if (resultado.ok === true) {
          aoSucesso?.(resultado);
          // `revalidatePath` (na action) só marca a rota como stale — quem
          // pede a foto nova é o cliente. Sem isto a lista de notas/
          // subtarefas/relações fica visualmente presa no estado anterior
          // mesmo com a gravação certa no servidor.
          router.refresh();
        } else {
          // [MÉDIO #1, rodada 3] a action recusou (erro de validação, ciclo
          // de hierarquia, falha de rede) — o controle otimista precisa
          // voltar ao último valor CONFIRMADO; quem chama decide o que isso
          // significa (revert de `useState` local).
          aoFalha?.(resultado);
        }
      })();
    });
  }

  return { estado, pendente, disparar };
}
