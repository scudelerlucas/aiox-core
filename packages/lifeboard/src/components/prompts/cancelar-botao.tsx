"use client";

import { useEffect, useRef, type KeyboardEvent } from "react";

import { focar } from "@/components/task/foco";

/**
 * OS-LIFEBOARD · P7 — botão "cancelar". Desde a rodada 3 (D7) ele aparece
 * também em item `pega`: cancelar um item em execução é a única saída que o
 * operador tem quando a sessão filha travou (antes, o item ficava preso até
 * expirar). A consequência é outra nesse caso — a sessão que está rodando vai
 * ser interrompida pelo worker no próximo sinal de vida —, e a confirmação diz
 * isso com todas as letras.
 *
 * RODADA 7 — o `window.confirm` nativo saiu. Ele BLOQUEIA a thread, não é
 * estilizável, não é anunciável e devolve o foco onde quiser. A confirmação é
 * de DOIS PASSOS dentro da página, no mesmo padrão da peça P6: o próprio botão
 * vira "confirmar cancelamento?", o foco NÃO sai dele, **Escape cancela** e,
 * sem confirmação, ele volta sozinho ao normal em 5 s.
 *
 * RODADA 8 — dois achados do crítico, os dois medidos:
 *
 *  · MÉDIO 5 · A CONFIRMAÇÃO NÃO CHEGAVA A LEITOR DE TELA. A frase que diz o
 *    que vai acontecer era um `<p>` solto: sem `aria-describedby`, sem
 *    `role="status"`, sem `aria-live`. O `window.confirm` que ela substituiu
 *    ERA lido em voz alta — a troca melhorou o teclado e piorou o áudio, na
 *    ÚNICA ação destrutiva da página. Agora ela é as duas coisas: uma região
 *    viva que existe ANTES do texto (vazia, é `sr-only` — um `role="status"`
 *    que nasce junto com o conteúdo não é anunciado, o mesmo achado de D22 em
 *    `mensagem-da-fila.tsx`) E a descrição acessível do botão, por
 *    `aria-describedby`. Cinto e suspensório, de propósito: é a ação que
 *    destrói trabalho.
 *
 *  · BAIXO 2 · `confirmando` era `useState` LOCAL. `fila-tabela.tsx` monta a
 *    linha DUAS vezes (tabela `hidden sm:block` + cartão `sm:hidden`), então a
 *    confirmação armada em 390 px sumia ao ir para 1280 px — exatamente o
 *    defeito que a rodada 7 corrigiu para o painel de ajuste e deixou passar
 *    aqui. O estado subiu para a LINHA, como `ajuste`; as duas instâncias leem
 *    e escrevem o mesmo booleano. O relógio de 5 s continua aqui (é efeito de
 *    UI, não estado compartilhado) e as duas instâncias desarmam o mesmo bit.
 */
export function CancelarBotao({
  id,
  emExecucao = false,
  podeCancelar = true,
  pendente = false,
  confirmando = false,
  aoMudarConfirmando,
  aoConfirmar,
}: {
  id: string;
  emExecucao?: boolean;
  podeCancelar?: boolean;
  pendente?: boolean;
  /** BAIXO 2: o passo da confirmação mora na LINHA — as duas instâncias o compartilham. */
  confirmando?: boolean;
  aoMudarConfirmando?: (id: string, armado: boolean) => void;
  /** A linha dispara a server action; este botão só decide QUANDO. */
  aoConfirmar?: (id: string) => void;
}): JSX.Element | null {
  const relogio = useRef<number | null>(null);
  const botaoRef = useRef<HTMLButtonElement>(null);
  const descricaoId = `cancelar-consequencia-${id}`;

  useEffect(() => {
    return () => {
      if (relogio.current !== null) window.clearTimeout(relogio.current);
    };
  }, []);

  function desarmar(): void {
    if (relogio.current !== null) window.clearTimeout(relogio.current);
    relogio.current = null;
    aoMudarConfirmando?.(id, false);
  }

  function aoClicar(): void {
    if (pendente) return;
    if (!confirmando) {
      aoMudarConfirmando?.(id, true);
      // Foco GERENCIADO: no macOS o Safari não dá foco a um `<button>` clicado,
      // e sem foco o Escape não chegaria ao handler abaixo — a saída do passo 2
      // viraria só o relógio de 5 s. Entregar o foco aqui torna o "Esc cancela"
      // verdadeiro em todo navegador, e é também o instante em que o leitor de
      // tela lê a descrição nova (`aria-describedby`). (Reusa `focar` da P6.)
      focar(botaoRef.current);
      if (relogio.current !== null) window.clearTimeout(relogio.current);
      relogio.current = window.setTimeout(() => aoMudarConfirmando?.(id, false), 5000);
      return;
    }
    desarmar();
    aoConfirmar?.(id);
  }

  // MÉDIO 5 (rodada 7): Escape cancela a confirmação. O foco está no próprio
  // botão (ele não sai do DOM entre os dois passos), então o handler mora aqui
  // — não há captura global a instalar nem a remover.
  function aoTeclar(e: KeyboardEvent<HTMLButtonElement>): void {
    if (e.key === "Escape" && confirmando) {
      e.preventDefault();
      desarmar();
    }
  }

  if (!podeCancelar) return null;

  const consequencia = emExecucao
    ? "A sessão que está rodando vai ser interrompida no próximo sinal de vida. Esc cancela."
    : "Ele sai da fila e não vai rodar. Esc cancela.";

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
        /* MÉDIO 5: a consequência é a DESCRIÇÃO deste botão, não um texto que
           por acaso está do lado. O `id` existe sempre; a descrição só ganha
           conteúdo no passo 2, que é quando o foco chega aqui. */
        aria-describedby={confirmando ? descricaoId : undefined}
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
      {/* MÉDIO 5: a região existe ANTES do texto — vazia ela é `sr-only` e não
          desenha nada, mas está no DOM quando o conteúdo chega, que é a única
          forma de um `role="status"` ser anunciado. */}
      <p
        id={descricaoId}
        role="status"
        aria-live="polite"
        className={
          confirmando ? "max-w-[240px] text-right text-[11px] text-state-progress" : "sr-only"
        }
      >
        {confirmando ? consequencia : ""}
      </p>
    </div>
  );
}
