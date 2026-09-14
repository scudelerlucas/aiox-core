"use client";

import { useState, type FormEvent } from "react";

import { ajustarCustoPromptAction } from "@/app/prompts/actions";
import { MensagemDaFila } from "@/components/prompts/mensagem-da-fila";
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
 * RODADA 5:
 *  · #8 — o painel virou `<form onSubmit>`: **Enter salva**. Antes eram dois
 *    `<button type="button">` soltos e um `<input>` sem formulário; quem
 *    digitava o número e apertava Enter não salvava nada e não recebia aviso
 *    nenhum.
 *  · D22 — o sucesso era MUDO: a action devolvia "Custo ajustado — o gasto de
 *    hoje já considera o número real." e ninguém renderizava. Agora a mesma
 *    `MensagemDaFila` do formulário mostra a frase (e o erro).
 *  · `podeAjustar` mantém o componente MONTADO depois do `router.refresh()`
 *    (o item deixa de ser "estimativa da casa" e sairia da tela levando a
 *    frase junto) — some o gatilho, fica a região viva.
 *
 * O gatilho só aparece em item `falhou`/`cancelada` cujo custo AINDA é
 * estimativa da casa — em item fechado por worker, com número medido, não há
 * nada a ajustar (e desde a rodada 5 o banco recusa: "Só custo estimado pela
 * casa pode ser ajustado; este foi medido.").
 */
export function AjustarCustoBotao({
  id,
  custoAtualUsd,
  podeAjustar = true,
}: {
  id: string;
  custoAtualUsd: number | null;
  podeAjustar?: boolean;
}): JSX.Element {
  const [aberto, setAberto] = useState(false);
  const [valor, setValor] = useState(custoAtualUsd === null ? "" : custoAtualUsd.toFixed(2));
  const { estado, pendente, disparar } = useAcaoPrompt(ajustarCustoPromptAction, () =>
    setAberto(false),
  );

  function aoEnviar(e: FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    const form = new FormData();
    form.set("id", id);
    form.set("custo_usd", valor);
    disparar(form);
  }

  return (
    <div className="flex flex-col items-end gap-1">
      {podeAjustar && !aberto ? (
        <button
          type="button"
          onClick={() => setAberto(true)}
          className="min-h-[32px] rounded-md border border-navy-700 bg-navy-850 px-2.5 text-xs font-medium text-bone-300 transition duration-150 ease-almapetra hover:border-gold-600 hover:text-gold-300"
        >
          ajustar custo
        </button>
      ) : null}

      {podeAjustar && aberto ? (
        <form onSubmit={aoEnviar} className="flex items-center gap-1.5">
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
            type="submit"
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
        </form>
      ) : null}

      <MensagemDaFila mensagem={estado.mensagem} erro={estado.erro} />
    </div>
  );
}
