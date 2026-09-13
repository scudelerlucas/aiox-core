/**
 * OS-LIFEBOARD · P4 — Contrato server → client do grafo de dependências v3.
 *
 * Tipo PLANO (sem `Set`/`Map`, sem `server-only`): o servidor (`page.tsx`) calcula
 * `ResultadoCPM` + `Map<string, ScoreAssimetria | null>` (camada O, `core/prioritize/*`)
 * e serializa para este formato antes de descer a um Client Component
 * (`DependencyGraph`). Nunca importar `caminho-critico.ts`/`assimetria.ts` (ambos
 * `server-only`) de um Client Component — só os TIPOS deste arquivo e de
 * `tipos-v3.ts`, que não carregam a guarda `server-only`.
 *
 * Serializador: `@/lib/serializa-grafo-v3` (`serializaGrafoV3`).
 */

import type { JanelaCPM, ScoreAssimetria } from "@/core/prioritize/tipos-v3";
import type { TaskEdge } from "@/types/canonical";

export interface GrafoV3Props {
  /** Arestas declaradas v3 (predecessor · correlação · sinergia · obsolescência). */
  edges: TaskEdge[];
  /** Ids com folga zero no caminho até o goal (goal incluído). */
  critico: string[];
  /** Janela de CPM por id de tarefa. */
  janelas: Record<string, JanelaCPM>;
  /** Ids sem `estimativaDias` que entraram no CPM com a duração-placeholder. */
  semDuracao: string[];
  /** Ids excluídos do CPM por ciclo de dependência. */
  emCiclo: string[];
  /** Goal usado pelo CPM. `null` = nenhum goal na lista. */
  goalId: string | null;
  /** Duração total do caminho crítico, em dias. */
  duracaoTotal: number;
  /** Score de assimetria por id de tarefa. `null` = sem átomos declarados. */
  scores: Record<string, ScoreAssimetria | null>;
}
