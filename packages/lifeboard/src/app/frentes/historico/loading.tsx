/** PAINEL DE ASSUNTOS — esqueleto do histórico (espera acima de ~400 ms). */
export default function Carregando(): JSX.Element {
  return (
    <main
      className="mx-auto w-full max-w-[1100px] px-4 pb-16 pt-5 sm:px-6"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">Carregando a lista do que já fechou…</span>
      <div className="h-8 w-64 rounded-md lb-shimmer" />
      <div className="mt-2 h-4 w-48 rounded-md lb-shimmer" />
      <div className="mt-5 h-[44px] w-full max-w-[520px] rounded-full lb-shimmer" />
      <div className="mt-6 flex flex-col gap-2">
        {[0, 1, 2, 3, 4, 5, 6, 7].map((linha) => (
          <div key={linha} className="h-10 rounded-md lb-shimmer" />
        ))}
      </div>
    </main>
  );
}
