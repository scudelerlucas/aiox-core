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
  /** Mostra `texto` e agenda o próprio desaparecimento — chamar de novo reinicia o relógio. */
  mostrar: (texto: string) => void;
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

  function mostrar(texto: string): void {
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    setMensagem(texto);
    timeoutRef.current = window.setTimeout(() => setMensagem(null), DURACAO_MS);
  }

  // Limpa o timer se o componente sair da árvore antes dos 4s (revalidação
  // do App Router pode remontar a seção) — nunca chama `setState` órfão.
  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    };
  }, []);

  return { mensagem, mostrar };
}

export function MensagemSucesso({ mensagem }: { mensagem: string | null }): JSX.Element | null {
  if (!mensagem) return null;
  return (
    <p role="status" aria-live="polite" className="mt-1.5 text-xs font-medium text-state-done">
      {mensagem}
    </p>
  );
}
