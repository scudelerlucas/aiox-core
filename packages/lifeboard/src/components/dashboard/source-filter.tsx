"use client";
import { SourceIcon } from "@/components/ui/source-icon";
import { corDaFonte } from "@/lib/cor-da-fonte";
import type { SourceKind } from "@/types/canonical";

export interface SourceFilterOption {
  kind: SourceKind;
  label: string;
  /** Nº de tarefas dessa fonte (badge). */
  count: number;
  /** Fonte desatualizada → ponto de aviso inline. */
  isStale?: boolean;
}

export interface SourceFilterProps {
  options: SourceFilterOption[];
  /** Multi-select. Vazio = todas visíveis (sem filtro). */
  selected: SourceKind[];
  onChange: (next: SourceKind[]) => void;
}

/**
 * OS-LIFEBOARD — Filtro por fonte. Alimenta grafo + lista ao mesmo tempo.
 * `selected` vazio = mostra tudo; só restringe num subconjunto próprio.
 *
 * v2 (13/09/2026): cada fonte carrega sua cor (a mesma da faixa do cartão na
 * lista), alvo de toque ≥ 44 px e contagem legível. Antes eram cinco linhas
 * cinzentas idênticas de 40 px, sem relação visual com a lista.
 */
export function SourceFilter({
  options,
  selected,
  onChange,
}: SourceFilterProps): JSX.Element {
  const allKinds = options.map((o) => o.kind);
  const semFiltro = selected.length === 0;
  const isChecked = (k: SourceKind): boolean =>
    semFiltro || selected.includes(k);

  const toggle = (k: SourceKind): void => {
    const base = semFiltro ? allKinds : selected;
    let next = isChecked(k) ? base.filter((x) => x !== k) : [...base, k];
    // Normaliza "todas marcadas" → [] (sem filtro).
    if (next.length === allKinds.length) next = [];
    onChange(next);
  };

  return (
    <fieldset className="flex h-full min-h-0 flex-col">
      <legend className="px-4 pb-1 pt-4 text-sm font-bold uppercase tracking-wider text-bone-400">
        Fontes
      </legend>
      <p className="px-4 pb-3 text-xs text-bone-400">
        {semFiltro
          ? "Mostrando todas."
          : `Mostrando ${selected.length} de ${allKinds.length}.`}
      </p>

      <ul className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-2.5">
        {options.map((opt) => {
          const checked = isChecked(opt.kind);
          const cor = corDaFonte(opt.kind);
          return (
            <li key={`${opt.kind}-${opt.label}`}>
              <label
                className={`flex min-h-[52px] cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 transition ${
                  checked
                    ? `${cor.borda} ${cor.fundo}`
                    : "border-navy-700 bg-navy-850 opacity-55 hover:opacity-80"
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(opt.kind)}
                  // 24 px é o piso da régua de UI/UX para alvo de toque.
                  className="h-6 w-6 shrink-0 accent-gold-400"
                />
                <SourceIcon
                  kind={opt.kind}
                  label={opt.label}
                  size={18}
                  className={checked ? cor.texto : "text-bone-400"}
                />
                <span
                  className={`min-w-0 flex-1 truncate text-sm font-semibold ${
                    checked ? "text-bone-100" : "text-bone-300"
                  }`}
                  title={opt.label}
                >
                  {opt.label}
                </span>
                {opt.isStale ? (
                  <span
                    aria-label="fonte desatualizada"
                    title="fonte desatualizada"
                    className="h-2 w-2 shrink-0 rounded-full bg-state-progress"
                  />
                ) : null}
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 font-mono text-xs font-semibold ${
                    checked ? `${cor.fundo} ${cor.texto}` : "bg-navy-800 text-bone-400"
                  }`}
                >
                  {opt.count}
                </span>
              </label>
            </li>
          );
        })}
      </ul>

      <div className="shrink-0 p-3">
        <button
          type="button"
          onClick={() => onChange([])}
          disabled={semFiltro}
          className="min-h-[44px] w-full rounded-xl border border-navy-600 text-sm font-semibold text-bone-200 transition hover:bg-navy-800 disabled:opacity-40 disabled:hover:bg-transparent"
        >
          Mostrar todas
        </button>
      </div>
    </fieldset>
  );
}
