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
  /**
   * Abre a página da tarefa (`/tarefa/[id]`). Achado BAIXO #15 do crítico
   * hostil ROUND 6: Enter e Espaço faziam a MESMA coisa (selecionar), e o
   * nome inteiro das 7 de 11 tarefas com título truncado só existia no
   * atributo `title` — que nem toque nem teclado alcançam. Agora Espaço
   * seleciona e Enter ABRE; o caminho por teclado até o nome inteiro existe.
   *
   * Mora no contexto (e não em `TaskNodeData`) pela mesma razão que
   * `onSelectTask`: o cartão continua puro de apresentação, sem precisar de um
   * router no próprio módulo — é `DependencyGraph` que injeta a navegação.
   */
  onAbrirTarefa: (taskId: string) => void;
}

export const GraphSelectionContext = createContext<GraphSelection>({
  selectedTaskId: null,
  onSelectTask: () => {},
  onAbrirTarefa: () => {},
});
