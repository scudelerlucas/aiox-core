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

export function useAcaoTarefa(
  acao: AcaoServidor,
  aoSucesso?: (estado: EstadoAcaoTarefa) => void,
): AcaoTarefaControlada {
  const [estado, setEstado] = useState<EstadoAcaoTarefa>({});
  const [pendente, startTransition] = useTransition();
  const router = useRouter();

  function disparar(form: FormData): void {
    startTransition(() => {
      void (async () => {
        const resultado = await acao(estado, form);
        setEstado(resultado);
        if (resultado.ok === true) {
          aoSucesso?.(resultado);
          // `revalidatePath` (na action) só marca a rota como stale — quem
          // pede a foto nova é o cliente. Sem isto a lista de notas/
          // subtarefas/relações fica visualmente presa no estado anterior
          // mesmo com a gravação certa no servidor.
          router.refresh();
        }
      })();
    });
  }

  return { estado, pendente, disparar };
}
