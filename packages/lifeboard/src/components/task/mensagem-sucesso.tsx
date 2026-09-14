"use client";

import { useEffect, useRef, useState } from "react";

/**
 * OS-LIFEBOARD · P6 — feedback de sucesso em texto (achado BAIXO #5, rodada
 * 4 do crítico): "Salvar duração" (e, no mesmo padrão, mãe/status/meta/
 * átomos/relação) podia ser 100% silencioso fora do caminho crítico — 0
 * `role="alert"`, nenhum `aria-live`. Notas e subtarefas já mudam a LISTA na
 * tela (a prova visual já existe); os formulários que só mudam um campo (ou
 * criam uma aresta) não tinham nada — `CampoErro` cobre o caminho de ERRO
 * (`role="alert"`), este cobre o de SUCESSO (`role="status"`/
 * `aria-live="polite"`, que não interrompe um leitor de tela como `alert`
 * faria) — some sozinho depois de `DURACAO_MS`.
 *
 * Par de contraste registrado em `scripts/checar-contraste.mjs`
 * (`state-done` × `navy-900`, o fundo do `<section>` que envolve estes
 * formulários em `/tarefa/[id]`).
 */
const DURACAO_MS = 4000;

export interface MensagemSucessoControlada {
  mensagem: string | null;
  /**
   * Mostra `texto` e agenda o próprio desaparecimento — chamar de novo
   * reinicia o relógio.
   *
   * [rodada 6] `persistente: true` = sem relógio: o texto fica até alguém
   * chamar `limpar()`. É o caso do "Excluída. Desfazer" e do "Relação criada.
   * Desfazer", cuja janela de desfazer dura 10 s — o texto sumir aos 4 s
   * deixaria um botão "Desfazer" solto, sem dizer desfazer O QUÊ.
   */
  mostrar: (texto: string, opcoes?: { persistente?: boolean }) => void;
  /** Apaga o texto agora (e cancela o relógio, se houver). */
  limpar: () => void;
}

export function useMensagemSucesso(): MensagemSucessoControlada {
  const [mensagem, setMensagem] = useState<string | null>(null);
  // `number`, não `ReturnType<typeof window.setTimeout>`: neste projeto
  // (`tsconfig.json` com `types: ["node"]` + `lib: [...,"DOM"]`), o TIPO da
  // propriedade `window.setTimeout` resolve para `NodeJS.Timeout` (o global
  // de `@types/node` vence na interseção `Window & typeof globalThis`), mas
  // a CHAMADA em si (`window.setTimeout(fn, ms)`) resolve por sobrecarga
  // para `number` (a assinatura do DOM) — os dois discordam. `number` é o
  // que a chamada de fato devolve em runtime de browser (e o que
  // `window.clearTimeout` espera).
  const timeoutRef = useRef<number | null>(null);

  function cancelarRelogio(): void {
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
  }

  function mostrar(texto: string, opcoes?: { persistente?: boolean }): void {
    cancelarRelogio();
    setMensagem(texto);
    if (opcoes?.persistente === true) return;
    timeoutRef.current = window.setTimeout(() => setMensagem(null), DURACAO_MS);
  }

  function limpar(): void {
    cancelarRelogio();
    setMensagem(null);
  }

  // Limpa o timer se o componente sair da árvore antes dos 4s (revalidação
  // do App Router pode remontar a seção) — nunca chama `setState` órfão.
  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    };
  }, []);

  return { mensagem, mostrar, limpar };
}

/**
 * [MÉDIO #3, rodada 5 do crítico] A região viva NASCIA JUNTO COM O TEXTO —
 * `return null` até haver mensagem. Um leitor de tela só anuncia o conteúdo
 * novo de uma região `aria-live` que **já estava no documento** quando o
 * texto entrou; uma região que aparece pronta, com o texto dentro, costuma
 * passar em silêncio (é o mesmo motivo pelo qual `CampoErro`, que usa
 * `role="alert"`, PODE nascer com o texto: `alert` é anunciado na inserção).
 *
 * Agora o `<p role="status">` está sempre no DOM — vazio quando não há nada
 * a dizer (sem margem e sem altura mínima, para não empurrar o layout um
 * pixel sequer) — e o texto entra e sai por TROCA DE CONTEÚDO, que é o
 * gatilho que `aria-live="polite"` de fato escuta. `aria-atomic="true"` faz
 * a frase ser lida inteira, não só o pedaço que mudou.
 *
 * As duas classes são literais completas (Tailwind 4 varre o fonte à
 * procura da string inteira — classe montada por concatenação não existiria
 * no CSS final).
 */
export function MensagemSucesso({ mensagem }: { mensagem: string | null }): JSX.Element {
  return (
    <p
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className={
        mensagem
          ? "mt-1.5 min-h-0 text-xs font-medium text-state-done"
          : "m-0 min-h-0 text-xs font-medium text-state-done"
      }
    >
      {mensagem ?? ""}
    </p>
  );
}
