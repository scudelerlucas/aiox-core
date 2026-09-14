"use client";

import { cancelarPromptAction } from "@/app/prompts/actions";
import { MensagemDaFila } from "@/components/prompts/mensagem-da-fila";
import { useAcaoPrompt } from "@/components/prompts/usar-acao-prompt";

/**
 * OS-LIFEBOARD · P7 — botão "cancelar". Desde a rodada 3 (D7) ele aparece
 * também em item `pega`: cancelar um item em execução é a única saída que o
 * operador tem quando a sessão filha travou (antes, o item ficava preso até
 * expirar). A confirmação muda de texto nesse caso, porque a consequência é
 * outra — a sessão que está rodando vai ser interrompida pelo worker no
 * próximo sinal de vida.
 *
 * D22 (rodada 5) — o buraco que o crítico mediu: `cancelarPromptAction` já
 * calculava a frase de #11/D12 ("Cancelado durante a execução. US$ 50,00
 * entram no gasto de hoje como estimativa…") e este componente só mostrava
 * `estado.erro`. A frase — a única coisa que avisa o operador de que aquele
 * cancelamento LANÇOU dinheiro no dia — morria no objeto de retorno. Agora ele
 * monta a MESMA `MensagemDaFila` do formulário.
 *
 * `podeCancelar` existe pela mesma razão, e não é decoração: depois do
 * cancelamento a ação chama `router.refresh()`, o item muda de estado e uma
 * renderização CONDICIONAL do botão o desmontaria — levando junto a frase que
 * acabara de nascer. O componente fica montado sempre; some só o botão.
 */
export function CancelarBotao({
  id,
  emExecucao = false,
  podeCancelar = true,
}: {
  id: string;
  emExecucao?: boolean;
  podeCancelar?: boolean;
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
      {podeCancelar ? (
        <button
          type="button"
          onClick={aoClicar}
          disabled={pendente}
          className="min-h-[32px] rounded-md border border-navy-700 bg-navy-850 px-2.5 text-xs font-medium text-bone-300 transition duration-150 ease-almapetra hover:border-state-blocked/60 hover:text-state-blocked disabled:opacity-50"
        >
          {pendente ? "cancelando…" : "cancelar"}
        </button>
      ) : null}
      <MensagemDaFila mensagem={estado.mensagem} erro={estado.erro} />
    </div>
  );
}
