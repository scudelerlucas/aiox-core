"use client";
import { createContext } from "react";

/**
 * OS-LIFEBOARD · E5 — Contexto de seleção do grafo.
 *
 * Permite que `TaskNode` (puro de apresentação, sem callback no seu `data` —
 * spec §8.1) dispare seleção por teclado (Enter/Space, spec §7.1) sem violar o
 * contrato `TaskNodeData`. `DependencyGraph` provê o valor; o nó consome. Opcional
 * (default no-op), então o nó funciona mesmo sem provider.
 */
export interface GraphSelection {
  selectedTaskId: string | null;
  onSelectTask: (taskId: string | null) => void;
}

export const GraphSelectionContext = createContext<GraphSelection>({
  selectedTaskId: null,
  onSelectTask: () => {},
});
