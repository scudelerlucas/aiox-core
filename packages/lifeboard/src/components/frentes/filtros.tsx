"use client";

/**
 * PAINEL DE ASSUNTOS — a única linha de controles: conta + busca.
 *
 * Tudo navegável por teclado (botões de verdade, com `aria-pressed`, e um campo
 * de texto com rótulo). Alvo de toque de 44 px no celular.
 */
export function Filtros({
  contas,
  conta,
  busca,
  onConta,
  onBusca,
}: {
  contas: string[];
  conta: string;
  busca: string;
  onConta: (valor: string) => void;
  onBusca: (valor: string) => void;
}): JSX.Element {
  const opcoes = ["", ...contas];
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div
        className="flex flex-wrap items-center gap-2"
        role="group"
        aria-label="Filtrar por conta"
      >
        {opcoes.map((opcao) => {
          const ativa = opcao === conta;
          return (
            <button
              key={opcao === "" ? "todas" : opcao}
              type="button"
              aria-pressed={ativa}
              onClick={() => onConta(opcao)}
              className={`min-h-[44px] rounded-full border px-3 text-sm transition-colors duration-150 ease-almapetra sm:min-h-[32px] ${
                ativa
                  ? "border-gold-500 bg-gold-500/20 text-bone-50"
                  : "border-navy-700 bg-navy-850 text-bone-300 hover:border-gold-600"
              }`}
            >
              {opcao === "" ? "Todas" : opcao}
            </button>
          );
        })}
      </div>

      <label className="flex min-h-[44px] w-full items-center gap-2 sm:ml-auto sm:min-h-[32px] sm:w-auto">
        <span className="sr-only">buscar assunto</span>
        <input
          type="search"
          value={busca}
          onChange={(evento) => onBusca(evento.target.value)}
          placeholder="buscar assunto"
          className="h-[44px] w-full min-w-[180px] rounded-md border border-navy-700 bg-navy-850 px-3 text-sm text-bone-100 placeholder:text-state-neutral sm:h-[32px] sm:w-56"
        />
      </label>
    </div>
  );
}
