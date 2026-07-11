"use client";
import { SourceIcon } from "@/components/ui/source-icon";
import type { SourceKind } from "@/types/canonical";

export interface SourceFilterOption {
  kind: SourceKind;
  label: string;
  /** Nº de tarefas dessa fonte (badge). */
  count: number;
  /** Fonte desatualizada → ponto de aviso inline (§6). */
  isStale?: boolean;
}

export interface SourceFilterProps {
  options: SourceFilterOption[];
  /** Multi-select. Vazio = todas visíveis (sem filtro). */
  selected: SourceKind[];
  onChange: (next: SourceKind[]) => void;
}

/**
 * OS-LIFEBOARD · E5 — Filtro por fonte (spec §5). Alimenta grafo + lista ao mesmo
 * tempo. `selected` vazio OU todas = mostra tudo; só restringe num subconjunto
 * próprio. [Limpar] volta a "todas".
 */
export function SourceFilter({
  options,
  selected,
  onChange,
}: SourceFilterProps): JSX.Element {
  const allKinds = options.map((o) => o.kind);
  const effective = selected.length === 0 ? allKinds : selected;
  const isChecked = (k: SourceKind): boolean => effective.includes(k);

  const toggle = (k: SourceKind): void => {
    let next = isChecked(k)
      ? effective.filter((x) => x !== k)
      : [...effective, k];
    // Normaliza "todas marcadas" → [] (sem filtro).
    if (next.length === allKinds.length) next = [];
    onChange(next);
  };

  return (
    <fieldset className="flex h-full flex-col">
      <legend className="px-4 pb-2 pt-4 text-sm font-semibold text-bone-300">
        Filtrar por fonte
      </legend>

      <ul className="flex-1 space-y-1 px-2">
        {options.map((opt) => {
          const checked = isChecked(opt.kind);
          return (
            <li key={opt.kind}>
              <label
                className={`flex min-h-[40px] cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-navy-800 ${
                  checked ? "" : "opacity-60"
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(opt.kind)}
                  aria-label={`${opt.label}, ${opt.count} tarefas${opt.isStale ? ", desatualizada" : ""}`}
                  className="h-4 w-4 accent-gold-500"
                />
                <SourceIcon kind={opt.kind} label={opt.label} size={16} />
                <span className="flex-1 text-sm text-bone-100">{opt.label}</span>
                {opt.isStale ? (
                  <span
                    className="h-2 w-2 shrink-0 rounded-full bg-state-warning"
                    aria-hidden="true"
                    title="fonte desatualizada"
                  />
                ) : null}
                <span className="min-w-6 rounded-full bg-navy-700 px-1.5 text-center font-mono text-xs text-bone-300">
                  {opt.count}
                </span>
              </label>
            </li>
          );
        })}
      </ul>

      <div className="p-3">
        <button
          type="button"
          onClick={() => onChange([])}
          className="w-full rounded-md border border-navy-600 px-3 py-1.5 text-xs font-medium text-bone-300 hover:bg-navy-700 hover:text-bone-100"
        >
          Limpar
        </button>
      </div>
    </fieldset>
  );
}
