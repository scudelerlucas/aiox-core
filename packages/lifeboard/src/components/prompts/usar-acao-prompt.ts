"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { EstadoAcaoPrompt } from "@/app/prompts/actions";

/**
 * OS-LIFEBOARD · P7 — equivalente a `useFormState` para a fila de prompts.
 * Mesmo padrão (e mesmo motivo) de `@/components/task/usar-acao-tarefa.ts`:
 * `react`/`react-dom` 18.3.1 não têm `useFormState`/`useActionState`, e
 * chamar a Server Action fora de um `<form action={...}>` literal não
 * reidrata a árvore sozinho — daí o `router.refresh()` explícito no sucesso.
 */
type AcaoServidor = (estado: EstadoAcaoPrompt, form: FormData) => Promise<EstadoAcaoPrompt>;

export interface AcaoPromptControlada {
  estado: EstadoAcaoPrompt;
  pendente: boolean;
  disparar: (form: FormData) => void;
}

export function useAcaoPrompt(
  acao: AcaoServidor,
  aoSucesso?: (estado: EstadoAcaoPrompt) => void,
  /**
   * BAIXO 4 (crítico da rodada 5): cada ação da linha existe DUAS vezes no DOM
   * (tabela `sm:block` + cartão `sm:hidden`), com `useState` próprio em cada
   * instância — a frase de cancelamento clicada em 390 px não existia ao
   * redimensionar para 1280 px. Este callback devolve a resposta para a LINHA
   * (`fila-tabela.tsx`), que a guarda uma vez só e a passa para as duas
   * instâncias. Opcional: quem não precisa compartilhar não passa nada.
   */
  aoResponder?: (estado: EstadoAcaoPrompt) => void,
): AcaoPromptControlada {
  const [estado, setEstado] = useState<EstadoAcaoPrompt>({});
  const [pendente, startTransition] = useTransition();
  const router = useRouter();

  function disparar(form: FormData): void {
    startTransition(() => {
      void (async () => {
        const resultado = await acao(estado, form);
        setEstado(resultado);
        aoResponder?.(resultado);
        if (resultado.ok === true) {
          aoSucesso?.(resultado);
          router.refresh();
        }
      })();
    });
  }

  return { estado, pendente, disparar };
}
