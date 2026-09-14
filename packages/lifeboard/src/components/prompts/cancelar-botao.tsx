"use client";

import { useEffect, useRef, useState } from "react";

import { cancelarPromptAction, type EstadoAcaoPrompt } from "@/app/prompts/actions";
import { MensagemDaFila } from "@/components/prompts/mensagem-da-fila";
import { useAcaoPrompt } from "@/components/prompts/usar-acao-prompt";
import { focarComAlternativa } from "@/components/task/foco";

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
 *
 * RODADA 6 — dois achados do crítico, os dois medidos:
 *  · BAIXO 3 · o `<button>` some do DOM com o FOCO nele e o foco cai no
 *    `<body>`. Agora, no sucesso, o foco vai para a frase da resposta (a
 *    região `role="status"`, que aceita foco programático) e, se ela não
 *    aceitar, para o próprio contêiner da linha. Mesma função da peça P6
 *    (`focarComAlternativa`), reusada — não uma segunda implementação.
 *  · BAIXO 4 · o estado da resposta agora pode vir DE FORA (`resposta`), para
 *    as duas instâncias da linha (tabela e cartão) mostrarem a mesma frase.
 */
export function CancelarBotao({
  id,
  emExecucao = false,
  podeCancelar = true,
  resposta,
  aoResponder,
}: {
  id: string;
  emExecucao?: boolean;
  podeCancelar?: boolean;
  /** BAIXO 4: a resposta guardada pela LINHA — sobrevive à troca de breakpoint. */
  resposta?: EstadoAcaoPrompt;
  aoResponder?: (estado: EstadoAcaoPrompt) => void;
}): JSX.Element {
  const [pedidoDeFoco, setPedidoDeFoco] = useState(0);
  const mensagemRef = useRef<HTMLParagraphElement>(null);
  const caixaRef = useRef<HTMLDivElement>(null);
  const { estado, pendente, disparar } = useAcaoPrompt(
    cancelarPromptAction,
    () => setPedidoDeFoco((n) => n + 1),
    aoResponder,
  );
  const visivel = resposta ?? estado;

  // BAIXO 3: o foco é entregue DEPOIS da renderização que traz a frase — antes
  // dela, o alvo ainda é uma região `sr-only` sem `tabIndex`.
  useEffect(() => {
    if (pedidoDeFoco === 0) return;
    focarComAlternativa(mensagemRef.current, caixaRef.current);
  }, [pedidoDeFoco]);

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
    <div ref={caixaRef} tabIndex={-1} className="flex flex-col items-end gap-1 focus:outline-none">
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
      <MensagemDaFila
        mensagem={visivel.mensagem}
        erro={visivel.erro}
        tom={visivel.tom}
        refDaMensagem={mensagemRef}
      />
    </div>
  );
}
