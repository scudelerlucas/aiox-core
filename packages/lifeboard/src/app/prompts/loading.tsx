/**
 * OS-LIFEBOARD · P7 — esqueleto de carregamento de `/prompts`. Mesma silhueta
 * da tela final (mesmo espírito de `frentes/loading.tsx`).
 */
export default function Carregando(): JSX.Element {
  return (
    <main
      className="mx-auto w-full max-w-[1100px] px-4 pb-16 pt-8 sm:px-6"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">Carregando os prompts…</span>
      <div className="h-8 w-32 rounded-md lb-shimmer" />
      <div className="mt-2 h-4 w-80 max-w-full rounded-md lb-shimmer" />
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-28 rounded-lg border border-navy-700 bg-navy-850 p-4">
            <div className="h-4 w-2/3 rounded lb-shimmer" />
            <div className="mt-4 h-2.5 w-full rounded-full lb-shimmer" />
          </div>
        ))}
      </div>
      <div className="mt-4 h-56 rounded-lg border border-navy-700 bg-navy-850" />
      <div className="mt-8 h-5 w-20 rounded-md lb-shimmer" />
      <div className="mt-4 h-40 rounded-lg border border-navy-700 bg-navy-850" />
    </main>
  );
}
