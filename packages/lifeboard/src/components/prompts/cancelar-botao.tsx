"use client";

import { cancelarPromptAction } from "@/app/prompts/actions";
import { useAcaoPrompt } from "@/components/prompts/usar-acao-prompt";

/**
 * OS-LIFEBOARD · P7 — botão "cancelar" de um item ainda `na_fila`. Confirmação
 * simples (`window.confirm`) porque a ação é irreversível para o item (a RPC
 * não desfaz `cancelada`), mesmo espírito de qualquer ação destrutiva do app.
 */
export function CancelarBotao({ id }: { id: string }): JSX.Element {
  const { estado, pendente, disparar } = useAcaoPrompt(cancelarPromptAction);

  function aoClicar(): void {
    if (!window.confirm("Cancelar este prompt da fila?")) return;
    const form = new FormData();
    form.set("id", id);
    disparar(form);
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={aoClicar}
        disabled={pendente}
        className="min-h-[32px] rounded-md border border-navy-700 bg-navy-850 px-2.5 text-xs font-medium text-bone-300 transition duration-150 ease-almapetra hover:border-state-blocked/60 hover:text-state-blocked disabled:opacity-50"
      >
        {pendente ? "cancelando…" : "cancelar"}
      </button>
      {estado.erro ? <p role="alert" className="text-[11px] text-state-blocked">{estado.erro}</p> : null}
    </div>
  );
}
