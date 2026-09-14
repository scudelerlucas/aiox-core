import { renderToStaticMarkup } from "react-dom/server";
import { ReactFlowProvider } from "reactflow";
import { describe, expect, it } from "vitest";

import { TaskNode, type TaskNodeData } from "@/components/graph/task-node";
import { layoutDoGrafo } from "@/lib/layout-do-grafo";
import type { Task } from "@/types/canonical";
import { ALTURA_DO_CARTAO } from "@/types/grafo-v3";

/**
 * OS-LIFEBOARD · P4d — achado MÉDIO #6 do crítico hostil ROUND 3: os testes
 * anteriores não seguravam a altura do cartão — com `DEFAULTS.nodeH: 96` +
 * `h-[96px]` + `NODE_H: 96` os 384 testes passavam, e passavam IGUAL com
 * `h-[160px]` + `NODE_H: 112` (nada comparava um número contra o outro). Este
 * arquivo prova que os DOIS consumidores (`task-node.tsx` via `style`,
 * `layout-do-grafo.ts` via o default de `nodeH`) leem o MESMO `ALTURA_DO_CARTAO`
 * — se algum dia divergirem de novo (alguém hardcodar um número local), um dos
 * dois testes abaixo quebra.
 */
function task(overrides: Partial<Task> = {}): Task {
  return {
    id: "t1",
    projectId: "p",
    title: "Tarefa",
    notes: null,
    dueDate: null,
    status: "open",
    priorityHierarq: { s1: 1, s2: 1, s3: 1 },
    predecessorIds: [],
    successorIds: [],
    sourceId: "s",
    externalRef: "t1",
    updatedAt: "2026-09-13T00:00:00.000Z",
    estimativaDias: null,
    iniciadoEm: null,
    parentId: null,
    isGoal: false,
    assimetria: null,
    ...overrides,
  };
}

describe("ALTURA_DO_CARTAO — token único (achado MÉDIO #6)", () => {
  it("task-node.tsx renderiza style=\"height:<ALTURA_DO_CARTAO>px\" — nunca uma classe Tailwind hardcoded", () => {
    const data: TaskNodeData = {
      task: task(),
      sourceKind: "calendar",
      sourceLabel: "Calendário",
      blockedByPredecessor: false,
      inCycle: false,
    };
    // `TaskNode` usa `useViewport()` (P4b, LOD por zoom) — só existe dentro
    // de um `ReactFlowProvider` (o mesmo motivo de `aresta-svg-render.test.tsx`
    // instanciar `ArestaSvgGroup` puro em vez de `V3Edge`, documentado no
    // cabeçalho de `aresta-svg.tsx`; aqui o provider basta, sem precisar de
    // `<ReactFlow>` inteiro).
    const html = renderToStaticMarkup(
      <ReactFlowProvider>
        <TaskNode
          id="t1"
          data={data}
          selected={false}
          type="task"
          zIndex={0}
          isConnectable
          xPos={0}
          yPos={0}
          dragging={false}
        />
      </ReactFlowProvider>,
    );
    expect(html).toContain(`style="height:${ALTURA_DO_CARTAO}px"`);
    // Nunca mais uma classe `h-[Npx]` fixa disputando com o `style` (a causa
    // original do achado: dois números que só coincidiam por disciplina).
    expect(html).not.toMatch(/\bh-\[\d+px\]/);
  });

  it("layoutDoGrafo usa ALTURA_DO_CARTAO como default de nodeH — a distância entre ranks prova o número", () => {
    const gapY = 84; // default de layout-do-grafo.ts
    const { nodes } = layoutDoGrafo({
      ids: ["a", "b"],
      edges: [{ origem: "a", destino: "b" }],
    });
    const a = nodes.get("a")!;
    const b = nodes.get("b")!;
    expect(b.y - a.y).toBe(ALTURA_DO_CARTAO + gapY);
  });
});
