"use client";

import { cancelarPromptAction } from "@/app/prompts/actions";
import { useAcaoPrompt } from "@/components/prompts/usar-acao-prompt";

/**
 * OS-LIFEBOARD · P7 — botão "cancelar". Desde a rodada 3 (D7) ele aparece
 * também em item `pega`: cancelar um item em execução é a única saída que o
 * operador tem quando a sessão filha travou (antes, o item ficava preso até
 * expirar). A confirmação muda de texto nesse caso, porque a consequência é
 * outra — a sessão que está rodando vai ser interrompida pelo worker no
 * próximo sinal de vida.
 */
export function CancelarBotao({
  id,
  emExecucao = false,
}: {
  id: string;
  emExecucao?: boolean;
}): JSX.Element {
  const { estado, pendente, disparar } = useAcaoPrompt(cancelarPromptAction);

  function aoClicar(): void {
    const pergunta = emExecucao
      ? "Este prompt está em execução. Cancelar mesmo assim? A sessão que está rodando vai ser interrompida."
      : "Cancelar este prompt da fila?";
    if (!window.confirm(pergunta)) return;
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
