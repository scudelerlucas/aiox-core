"use client";

import { useEffect } from "react";

/**
 * OS-LIFEBOARD — rede de última instância do App Router.
 *
 * Nasce do incidente de 13/09/2026: um valor novo no banco derrubou a árvore
 * inteira e o navegador mostrou a tela crua do Next ("Application error: a
 * client-side exception has occurred"), que não diz nada a quem usa e não
 * oferece saída. Um defeito que só quebra no cliente — o grafo, por exemplo,
 * só monta os nós no navegador — nem chega a virar HTTP 500: sem este arquivo,
 * vira tela branca.
 *
 * Contrato: erro em português, sem detalhe técnico na tela (o detalhe vai para
 * o console do servidor/navegador), e sempre uma saída — tentar de novo ou ir
 * para os Assuntos.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): JSX.Element {
  useEffect(() => {
    console.error("[lifeboard] erro não tratado na tela:", error);
  }, [error]);

  return (
    <main className="mx-auto w-full max-w-[640px] px-4 pb-16 pt-16 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight text-bone-50">
        ALMA PETRA
      </h1>
      <div
        role="alert"
        className="mt-4 rounded-lg border border-state-warning/50 px-4 py-3 text-sm text-bone-100"
      >
        Alguma coisa quebrou nesta tela. Já registrei o que aconteceu — tente de
        novo em alguns minutos.
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={reset}
          className="inline-flex min-h-[44px] items-center rounded-md border border-navy-700 bg-navy-850 px-4 text-sm text-bone-100 hover:border-gold-600"
        >
          tentar de novo
        </button>
        <a
          href="/frentes"
          className="inline-flex min-h-[44px] items-center rounded-md border border-navy-700 bg-navy-850 px-4 text-sm text-bone-100 hover:border-gold-600"
        >
          ir para Assuntos
        </a>
      </div>
    </main>
  );
}
