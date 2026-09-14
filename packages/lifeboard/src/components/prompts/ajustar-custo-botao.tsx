"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

import { ajustarCustoPromptAction, type EstadoAcaoPrompt } from "@/app/prompts/actions";
import { MensagemDaFila } from "@/components/prompts/mensagem-da-fila";
import { useAcaoPrompt } from "@/components/prompts/usar-acao-prompt";
import { focarComAlternativa } from "@/components/task/foco";

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
 * RODADA 6 — três achados do crítico:
 *  · MÉDIO 3 · o gatilho aparecia para item `falhou`/`cancelada` de QUALQUER
 *    dia, e o ajuste de um item de ontem não movia número nenhum — com uma
 *    mensagem de sucesso por cima. Quem filtra por dia é `podeAjustarCusto` em
 *    `fila-tabela.tsx` (a régua do fuso do operador), e o banco recusa por
 *    baixo ("Só dá para ajustar o custo de item fechado hoje.").
 *  · D26 · campo OPCIONAL de sessão: vincular a sessão que rodou é o que
 *    impede o dia de somar a estimativa do item MAIS o custo real dela (o
 *    crítico mediu US$ 200 num trabalho de US$ 80). Fica opcional porque o
 *    operador nem sempre tem o id em mãos — e um campo obrigatório aqui
 *    fecharia a porta de saída que este painel É.
 *  · BAIXO 3 · ao salvar, o `<form>` some com o foco no submit e o foco caía
 *    no `<body>`. Agora ele volta para o gatilho "ajustar custo" (que
 *    reaparece) e, se ele não existir mais, para a frase da resposta.
 *
 * O gatilho só aparece em item `falhou`/`cancelada` FECHADO HOJE cujo custo
 * AINDA é estimativa da casa — em item fechado por worker, com número medido,
 * não há nada a ajustar (e desde a rodada 5 o banco recusa: "Só custo estimado
 * pela casa pode ser ajustado; este foi medido.").
 */
export function AjustarCustoBotao({
  id,
  custoAtualUsd,
  podeAjustar = true,
  resposta,
  aoResponder,
}: {
  id: string;
  custoAtualUsd: number | null;
  podeAjustar?: boolean;
  /** BAIXO 4: a resposta guardada pela LINHA — sobrevive à troca de breakpoint. */
  resposta?: EstadoAcaoPrompt;
  aoResponder?: (estado: EstadoAcaoPrompt) => void;
}): JSX.Element {
  const [aberto, setAberto] = useState(false);
  const [valor, setValor] = useState(custoAtualUsd === null ? "" : custoAtualUsd.toFixed(2));
  const [sessao, setSessao] = useState("");
  const [pedidoDeFoco, setPedidoDeFoco] = useState(0);
  const gatilhoRef = useRef<HTMLButtonElement>(null);
  const mensagemRef = useRef<HTMLParagraphElement>(null);
  const { estado, pendente, disparar } = useAcaoPrompt(
    ajustarCustoPromptAction,
    () => {
      setAberto(false);
      setPedidoDeFoco((n) => n + 1);
    },
    aoResponder,
  );
  const visivel = resposta ?? estado;

  /**
   * BAIXO 3: primeiro alvo, o gatilho que acabou de reaparecer; alternativa, a
   * frase da resposta (quando o item deixou de ser ajustável e o gatilho não
   * volta). Nunca o `<body>`.
   *
   * `podeAjustar` está nas dependências DE PROPÓSITO, e foi medido no
   * navegador: o sucesso do ajuste dispara `router.refresh()`, o servidor
   * devolve o item já SEM a marca de estimativa e o gatilho — que tinha
   * acabado de receber o foco — some do DOM. Sem esta dependência, o foco
   * medido em 1280px depois de salvar era o `<body>`. Com ela, a mudança de
   * `podeAjustar` re-entrega o foco à frase da resposta.
   */
  useEffect(() => {
    if (pedidoDeFoco === 0) return;
    focarComAlternativa(gatilhoRef.current, mensagemRef.current);
  }, [pedidoDeFoco, podeAjustar]);

  function aoEnviar(e: FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    const form = new FormData();
    form.set("id", id);
    form.set("custo_usd", valor);
    form.set("session_id", sessao);
    disparar(form);
  }

  return (
    <div className="flex flex-col items-end gap-1">
      {podeAjustar && !aberto ? (
        <button
          ref={gatilhoRef}
          type="button"
          onClick={() => setAberto(true)}
          className="min-h-[32px] rounded-md border border-navy-700 bg-navy-850 px-2.5 text-xs font-medium text-bone-300 transition duration-150 ease-almapetra hover:border-gold-600 hover:text-gold-300 focus:border-gold-500 focus:outline-none"
        >
          ajustar custo
        </button>
      ) : null}

      {podeAjustar && aberto ? (
        <form onSubmit={aoEnviar} className="flex flex-wrap items-center justify-end gap-1.5">
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
          <label htmlFor={`sessao-${id}`} className="text-[11px] text-bone-400">
            sessão (opcional)
          </label>
          <input
            id={`sessao-${id}`}
            name="session_id"
            value={sessao}
            onChange={(e) => setSessao(e.target.value)}
            disabled={pendente}
            placeholder="session_…"
            className="min-h-[32px] w-[128px] rounded-md border border-navy-700 bg-navy-900 px-2 text-xs text-bone-100 focus:border-gold-500 focus:outline-none"
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
            onClick={() => {
              setAberto(false);
              setPedidoDeFoco((n) => n + 1);
            }}
            disabled={pendente}
            className="min-h-[32px] rounded-md border border-navy-700 bg-navy-850 px-2 text-xs text-bone-300"
          >
            cancelar
          </button>
        </form>
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
