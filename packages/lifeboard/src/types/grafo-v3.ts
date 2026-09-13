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

/**
 * P4d (achado MÉDIO #6 do crítico hostil ROUND 3): altura ÚNICA do cartão de
 * tarefa. Antes eram DOIS números hardcoded que só coincidiam por disciplina
 * manual — `h-[112px]` (classe Tailwind literal) em `task-node.tsx` e
 * `nodeH: 112` em `layout-do-grafo.ts`/`dependency-graph.tsx` — nenhum teste
 * comparava um contra o outro, então os três podiam divergir em silêncio (o
 * crítico provou: rodar com `h-[160px]`/`NODE_H: 112` fazia os 384 testes
 * passarem do mesmo jeito). Agora só existe ESTE número; `task-node.tsx`
 * consome via `style={{ height }}` (nunca uma classe Tailwind gerada
 * dinamicamente — o JIT do Tailwind só compila classes que aparecem como
 * STRING LITERAL no código-fonte, então um template `h-[${token}px]` nunca
 * seria compilado). `tests/unit/altura-do-cartao.test.ts` prova que os três
 * consumidores leem o mesmo valor.
 *
 * P4e (achado ALTO #2 do crítico hostil ROUND 4): o rodapé passou a ter DUAS
 * linhas fixas (linha 1 `S xx · folga: N d` + badge `A xx`; linha 2 o chip de
 * status com rótulo inteiro) — em UMA linha só, o `shrink-0` da folga empurrava
 * o badge e o chip para FORA da caixa e o `overflow-hidden` do cartão cortava
 * em silêncio ("A 18" renderizava "A 1": número plausível e FALSO). 144 é a
 * altura que a 2ª linha pede, medida no navegador (conteúdo real ≈ 137px:
 * 16 de padding + 20 do cabeçalho + 34 da nota + 67 do rodapé de 2 linhas).
 * Continua sendo o ÚNICO número — layout e cartão seguem o token.
 */
export const ALTURA_DO_CARTAO = 144;

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
