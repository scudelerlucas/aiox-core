"use client";

import { useState } from "react";

import { ajustarCustoPromptAction } from "@/app/prompts/actions";
import { useAcaoPrompt } from "@/components/prompts/usar-acao-prompt";

/**
 * OS-LIFEBOARD · P7 — D20 (rodada 4): "ajustar custo".
 *
 * Um item que morreu sem fechar entra no gasto do dia pelo custo ESTIMADO da
 * complexidade — conservador de propósito (quem sumiu provavelmente gastou).
 * Só que uma estimativa de US$ 120 pode congelar a conta até a virada do dia
 * sobre um trabalho que custou US$ 3. Esta é a porta de saída: o operador põe
 * o número real e o teto volta a falar a verdade.
 *
 * Aparece só na linha de item `falhou`/`cancelada` cujo custo AINDA é
 * estimativa da casa — em item fechado por worker, com número medido, não há
 * nada a ajustar (e um botão que não muda nada é ruído).
 */
export function AjustarCustoBotao({
  id,
  custoAtualUsd,
}: {
  id: string;
  custoAtualUsd: number | null;
}): JSX.Element {
  const [aberto, setAberto] = useState(false);
  const [valor, setValor] = useState(custoAtualUsd === null ? "" : custoAtualUsd.toFixed(2));
  const { estado, pendente, disparar } = useAcaoPrompt(ajustarCustoPromptAction, () =>
    setAberto(false),
  );

  function salvar(): void {
    const form = new FormData();
    form.set("id", id);
    form.set("custo_usd", valor);
    disparar(form);
  }

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="min-h-[32px] rounded-md border border-navy-700 bg-navy-850 px-2.5 text-xs font-medium text-bone-300 transition duration-150 ease-almapetra hover:border-gold-600 hover:text-gold-300"
      >
        ajustar custo
      </button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-1.5">
        <label htmlFor={`custo-${id}`} className="text-[11px] text-bone-400">
          US$
        </label>
        <input
          id={`custo-${id}`}
          name="custo_usd"
          inputMode="decimal"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          disabled={pendente}
          className="min-h-[32px] w-[74px] rounded-md border border-navy-700 bg-navy-900 px-2 text-xs text-bone-100 focus:border-gold-500 focus:outline-none"
        />
        <button
          type="button"
          onClick={salvar}
          disabled={pendente}
          className="min-h-[32px] rounded-md border border-gold-500 bg-navy-800 px-2.5 text-xs font-semibold text-gold-300 disabled:opacity-50"
        >
          {pendente ? "salvando…" : "salvar"}
        </button>
        <button
          type="button"
          onClick={() => setAberto(false)}
          disabled={pendente}
          className="min-h-[32px] rounded-md border border-navy-700 bg-navy-850 px-2 text-xs text-bone-300"
        >
          cancelar
        </button>
      </div>
      {estado.erro ? (
        <p role="alert" className="text-[11px] text-state-blocked">
          {estado.erro}
        </p>
      ) : null}
    </div>
  );
}
