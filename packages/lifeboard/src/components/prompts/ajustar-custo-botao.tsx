"use client";

import { useRef, type FormEvent } from "react";

import { focarComAlternativa } from "@/components/task/foco";

/**
 * OS-LIFEBOARD · P7 — D20 (rodada 4): "ajustar custo".
 *
 * Um item que morreu sem fechar entra no gasto do dia pelo custo ESTIMADO da
 * complexidade — conservador de propósito (quem sumiu provavelmente gastou).
 * Só que uma estimativa de US$ 120 pode congelar a conta até a virada do dia
 * sobre um trabalho que custou US$ 3. Esta é a porta de saída: o operador põe o
 * número real e o teto volta a falar a verdade.
 *
 * RODADA 7 — o que mudou, e por que:
 *
 *  · MÉDIO 3 · O RESIZE SALVAVA A FRASE E PERDIA O QUE O OPERADOR ESTAVA
 *    DIGITANDO. `fila-tabela.tsx` monta a linha DUAS vezes (tabela
 *    `hidden sm:block` + cartão `sm:hidden`); na rodada 6 só a RESPOSTA subiu
 *    para a linha, enquanto `aberto`, `valor` e `sessao` continuaram em
 *    `useState` local de cada instância. Medido: abrir o ajuste em 390 px,
 *    digitar valor e id de sessão, ir para 1280 px → painel fechado e os dois
 *    campos vazios. Agora os três moram na LINHA, num mapa por id, e as duas
 *    instâncias leem e escrevem o mesmo estado.
 *
 *  · MÉDIO 4 · quando o custo já foi MEDIDO, o botão sumia e a tela não dizia
 *    por quê. A frase entra no lugar do botão (`textoSemAjuste`), e há uma
 *    exceção testada: custo medido IGUAL A ZERO É ajustável — é o modo de falha
 *    conhecido (a sessão fechou sem conseguir ler o usage).
 *
 *  · BAIXO 6 · 44 px em todos os controles (era 32, com a navegação da mesma
 *    página em 44).
 *
 *  · BAIXO 10 · sem região `role="status"` própria: quem mostra a resposta é a
 *    LINHA, uma região só. O foco no sucesso continua sendo entregue (BAIXO 3,
 *    rodada 6): primeiro alvo o gatilho que reaparece, alternativa a frase da
 *    linha — nunca o `<body>`.
 */
export interface EstadoDoAjuste {
  aberto: boolean;
  valor: string;
  sessao: string;
}

export function AjustarCustoBotao({
  id,
  podeAjustar = true,
  pendente = false,
  estado,
  aoMudarEstado,
  aoSalvar,
  fraseSemAjuste,
  refDaMensagem,
  refDoGatilho,
}: {
  id: string;
  podeAjustar?: boolean;
  pendente?: boolean;
  /** MÉDIO 3: aberto/valor/sessão vivem na LINHA, não aqui. */
  estado: EstadoDoAjuste;
  aoMudarEstado: (patch: Partial<EstadoDoAjuste>) => void;
  aoSalvar: (id: string, custoUsd: string, sessionId: string) => void;
  /** MÉDIO 4: o que aparece NO LUGAR do botão quando o número foi medido. */
  fraseSemAjuste?: string | null;
  /** BAIXO 3/BAIXO 10: a região viva da LINHA — alternativa de foco. */
  refDaMensagem?: React.RefObject<HTMLElement>;
  /** A linha guarda o ref do gatilho para devolver o foco depois do refresh. */
  refDoGatilho?: React.RefObject<HTMLButtonElement>;
}): JSX.Element {
  const proprioGatilho = useRef<HTMLButtonElement>(null);
  const gatilho = refDoGatilho ?? proprioGatilho;

  function aoEnviar(e: FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    if (pendente) return;
    aoSalvar(id, estado.valor, estado.sessao);
  }

  function fechar(): void {
    aoMudarEstado({ aberto: false });
    focarComAlternativa(gatilho.current, refDaMensagem?.current ?? null);
  }

  if (!podeAjustar) {
    return fraseSemAjuste ? (
      <p className="max-w-[220px] text-right text-[11px] text-bone-400">{fraseSemAjuste}</p>
    ) : (
      <></>
    );
  }

  if (!estado.aberto) {
    return (
      <button
        ref={gatilho}
        type="button"
        onClick={() => aoMudarEstado({ aberto: true })}
        className="inline-flex min-h-[44px] items-center rounded-md border border-navy-700 bg-navy-850 px-2.5 text-xs font-medium text-bone-300 transition duration-150 ease-almapetra hover:border-gold-600 hover:text-gold-300 focus:border-gold-500 focus:outline-none"
      >
        ajustar custo
      </button>
    );
  }

  return (
    <form onSubmit={aoEnviar} className="flex flex-wrap items-center justify-end gap-1.5">
      <label htmlFor={`custo-${id}`} className="text-[11px] text-bone-400">
        US$
      </label>
      <input
        id={`custo-${id}`}
        name="custo_usd"
        inputMode="decimal"
        value={estado.valor}
        onChange={(e) => aoMudarEstado({ valor: e.target.value })}
        aria-busy={pendente ? true : undefined}
        className="min-h-[44px] w-[84px] rounded-md border border-navy-700 bg-navy-900 px-2 text-xs text-bone-100 focus:border-gold-500 focus:outline-none"
      />
      <label htmlFor={`sessao-${id}`} className="text-[11px] text-bone-400">
        sessão (opcional)
      </label>
      <input
        id={`sessao-${id}`}
        name="session_id"
        value={estado.sessao}
        onChange={(e) => aoMudarEstado({ sessao: e.target.value })}
        aria-busy={pendente ? true : undefined}
        placeholder="session_…"
        className="min-h-[44px] w-[140px] rounded-md border border-navy-700 bg-navy-900 px-2 text-xs text-bone-100 focus:border-gold-500 focus:outline-none"
      />
      <button
        type="submit"
        aria-busy={pendente ? true : undefined}
        aria-disabled={pendente ? true : undefined}
        className={`inline-flex min-h-[44px] items-center rounded-md border border-gold-500 bg-navy-800 px-2.5 text-xs font-semibold text-gold-300 focus:outline-none ${
          pendente ? "opacity-50" : ""
        }`}
      >
        {pendente ? "salvando…" : "salvar"}
      </button>
      <button
        type="button"
        onClick={fechar}
        className="inline-flex min-h-[44px] items-center rounded-md border border-navy-700 bg-navy-850 px-2 text-xs text-bone-300 focus:border-gold-500 focus:outline-none"
      >
        fechar
      </button>
    </form>
  );
}
