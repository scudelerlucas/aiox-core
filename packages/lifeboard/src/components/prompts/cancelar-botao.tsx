"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";

import { focar } from "@/components/task/foco";

/**
 * OS-LIFEBOARD · P7 — botão "cancelar". Desde a rodada 3 (D7) ele aparece
 * também em item `pega`: cancelar um item em execução é a única saída que o
 * operador tem quando a sessão filha travou (antes, o item ficava preso até
 * expirar). A consequência é outra nesse caso — a sessão que está rodando vai
 * ser interrompida pelo worker no próximo sinal de vida —, e a confirmação diz
 * isso com todas as letras.
 *
 * RODADA 7 — três achados do crítico:
 *
 *  · MÉDIO 5 · A ÚNICA AÇÃO DESTRUTIVA DA PÁGINA SAÍA PARA UM `window.confirm`
 *    NATIVO. Ele BLOQUEIA a thread (nada mais na página responde enquanto
 *    estiver aberto), não é estilizável, não é anunciável e devolve o foco onde
 *    quiser. A confirmação agora é de DOIS PASSOS dentro da página, no mesmo
 *    padrão que a peça P6 usa para excluir nota (`src/components/task/
 *    notas-painel.tsx`): o próprio botão vira "confirmar cancelamento?", o foco
 *    NÃO sai dele (é o mesmo nó), **Escape cancela** e, sem confirmação, ele
 *    volta sozinho ao normal. A janela é de 5 s — maior que os 3 s da P6 de
 *    propósito: aqui a confirmação vem acompanhada da frase que diz o que vai
 *    acontecer, e o operador precisa de tempo para LER antes de decidir.
 *
 *  · BAIXO 6 · alvo de toque de 32 px numa página cuja navegação usa 44. Agora
 *    são 44 px, como o resto.
 *
 *  · BAIXO 10 · 4 regiões `role="status"` por linha (2 ações × 2 breakpoints).
 *    Este componente não tem mais região própria: quem mostra a resposta é a
 *    LINHA (`AcoesDaLinha`, em `fila-tabela.tsx`), uma só, e é para ela que o
 *    foco vai quando o botão some do DOM (BAIXO 3, rodada 6, preservado).
 *
 * Ele também deixou de ter estado de ação próprio: `pendente`/`disparar` vêm da
 * linha, que é onde o hook mora agora — pelo mesmo motivo medido em BAIXO 4
 * (rodada 5), levado até o fim.
 */
export function CancelarBotao({
  id,
  emExecucao = false,
  podeCancelar = true,
  pendente = false,
  aoConfirmar,
}: {
  id: string;
  emExecucao?: boolean;
  podeCancelar?: boolean;
  pendente?: boolean;
  /** A linha dispara a server action; este botão só decide QUANDO. */
  aoConfirmar?: (id: string) => void;
}): JSX.Element | null {
  const [confirmando, setConfirmando] = useState(false);
  const relogio = useRef<number | null>(null);
  const botaoRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    return () => {
      if (relogio.current !== null) window.clearTimeout(relogio.current);
    };
  }, []);

  function desarmar(): void {
    if (relogio.current !== null) window.clearTimeout(relogio.current);
    relogio.current = null;
    setConfirmando(false);
  }

  function aoClicar(): void {
    if (pendente) return;
    if (!confirmando) {
      setConfirmando(true);
      // Foco GERENCIADO: no macOS o Safari não dá foco a um `<button>` clicado,
      // e sem foco o Escape não chegaria ao handler abaixo — a saída do passo 2
      // viraria só o relógio de 5 s. Entregar o foco aqui torna o "Esc cancela"
      // verdadeiro em todo navegador. (Reusa `focar` da peça P6.)
      focar(botaoRef.current);
      if (relogio.current !== null) window.clearTimeout(relogio.current);
      relogio.current = window.setTimeout(() => setConfirmando(false), 5000);
      return;
    }
    desarmar();
    aoConfirmar?.(id);
  }

  // MÉDIO 5: Escape cancela a confirmação. O foco está no próprio botão (ele
  // não sai do DOM entre os dois passos), então o handler mora aqui — não há
  // captura global a instalar nem a remover.
  function aoTeclar(e: KeyboardEvent<HTMLButtonElement>): void {
    if (e.key === "Escape" && confirmando) {
      e.preventDefault();
      desarmar();
    }
  }

  if (!podeCancelar) return null;

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        ref={botaoRef}
        type="button"
        onClick={aoClicar}
        onKeyDown={aoTeclar}
        onBlur={desarmar}
        aria-busy={pendente ? true : undefined}
        aria-disabled={pendente ? true : undefined}
        className={`inline-flex min-h-[44px] items-center rounded-md border px-2.5 text-xs font-medium transition duration-150 ease-almapetra focus:outline-none ${
          pendente ? "opacity-50" : ""
        } ${
          confirmando
            ? "border-state-blocked/70 bg-state-blocked/12 text-state-blocked"
            : "border-navy-700 bg-navy-850 text-bone-300 hover:border-state-blocked/60 hover:text-state-blocked focus:border-gold-500"
        }`}
      >
        {pendente ? "cancelando…" : confirmando ? "confirmar cancelamento?" : "cancelar"}
      </button>
      {confirmando ? (
        <p className="max-w-[240px] text-right text-[11px] text-state-progress">
          {emExecucao
            ? "A sessão que está rodando vai ser interrompida no próximo sinal de vida. Esc cancela."
            : "Ele sai da fila e não vai rodar. Esc cancela."}
        </p>
      ) : null}
    </div>
  );
}
