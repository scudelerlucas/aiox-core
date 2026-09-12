/**
 * PAINEL DE ASSUNTOS — esqueleto de carregamento (aparece em qualquer espera
 * acima de ~400 ms, enquanto o servidor lê os dados). Mesma silhueta da tela
 * final, para nada "saltar" quando o conteúdo chega.
 */
export default function Carregando(): JSX.Element {
  const colunas = [0, 1, 2, 3];
  return (
    <main
      className="mx-auto w-full max-w-[1400px] px-4 pb-16 pt-5 sm:px-6"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">Carregando os assuntos…</span>
      <div className="h-8 w-40 rounded-md lb-shimmer" />
      <div className="mt-2 h-4 w-56 rounded-md lb-shimmer" />
      <div className="mt-5 h-[44px] w-full max-w-[520px] rounded-full lb-shimmer" />
      <div className="mt-6 grid gap-x-4 gap-y-6 md:grid-cols-2 xl:grid-cols-4">
        {colunas.map((coluna) => (
          <section key={coluna}>
            <div className="h-5 w-36 rounded-md lb-shimmer" />
            <div className="mt-3 flex flex-col gap-3">
              {[0, 1, 2].map((cartao) => (
                <div
                  key={cartao}
                  className="h-[112px] rounded-lg border border-navy-700 bg-navy-850 p-3"
                >
                  <div className="h-4 w-4/5 rounded lb-shimmer" />
                  <div className="mt-3 h-3 w-3/5 rounded lb-shimmer" />
                  <div className="mt-3 h-3 w-2/3 rounded lb-shimmer" />
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
