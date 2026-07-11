"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { SourceKind } from "@/types/canonical";

/**
 * OS-LIFEBOARD · E5 — Estado do filtro de fonte (spec §5).
 *
 * `selected` vazio = TODAS visíveis (sem filtro). Persistido em localStorage para
 * sobreviver a reload. Gotcha "Zustand Persist Type Inference" (arch §11 /
 * spec §5) APLICADO: `create<State>()(persist(...))` — parâmetro de tipo E
 * parênteses extras, senão a inferência quebra.
 */
export interface SourceFilterState {
  selected: SourceKind[];
  setSelected: (selected: SourceKind[]) => void;
}

export const useSourceFilter = create<SourceFilterState>()(
  persist(
    (set) => ({
      selected: [],
      setSelected: (selected): void => set({ selected }),
    }),
    { name: "lifeboard-source-filter" },
  ),
);
