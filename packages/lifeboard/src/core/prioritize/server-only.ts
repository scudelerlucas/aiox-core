import "server-only";
/**
 * OS-LIFEBOARD · E4 — Barril de entrada server-only do motor HIERARQ (camada O).
 *
 * Ponto único de import para o shell (handlers `/api/`, server components).
 * Espelha o padrão de `adapters/<fonte>/client.mcp.ts` (`import "server-only"` no topo,
 * kill-switch nº 3 do PRD): qualquer Client Component que importe o motor por
 * este barril QUEBRA o build — é a "regra de ouro do server-only boundary"
 * (architecture.md §6): o kill-switch vira garantia estrutural, não disciplina.
 *
 * [AUTO-DECISION] O item 1 do enunciado descreveu apenas ESTE arquivo como guard.
 * Estendi `import "server-only"` também a hierarq.ts/dag.ts/today.ts (defesa em
 * profundidade) para honrar architecture.md §11 ("qualquer arquivo em
 * core/prioritize/** começa com import 'server-only'") — senão um client poderia
 * importar hierarq.ts DIRETO, furando o barril. A suíte Vitest aliasa
 * `server-only`→stub (vitest.config.ts), então os testes unitários seguem verdes
 * importando os módulos puros diretamente. Trade-off: nenhum (0 custo em teste).
 */

export { compareHierarq, scoreHierarq } from "@/core/prioritize/hierarq";
export {
  detectCycleIds,
  resolveActionable,
  type DagResult,
} from "@/core/prioritize/dag";
export {
  buildTodayList,
  type TodayItem,
  type TodayList,
} from "@/core/prioritize/today";
