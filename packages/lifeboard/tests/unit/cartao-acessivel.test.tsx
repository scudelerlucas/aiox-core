import { renderToStaticMarkup } from "react-dom/server";
import { ReactFlowProvider } from "reactflow";
import { describe, expect, it } from "vitest";

import { TaskNode, type TaskNodeData } from "@/components/graph/task-node";
import { layoutDoGrafo } from "@/lib/layout-do-grafo";
import type { Task } from "@/types/canonical";
import { alturaDoCartao, ALTURA_DA_PASTILHA, ALTURA_DO_CARTAO } from "@/types/grafo-v3";

/**
 * OS-LIFEBOARD · P4g — achados MÉDIO #9 e MÉDIO #6 do crítico hostil ROUND 6.
 *
 * #9: o rótulo acessível do cartão era `"Configurar ambiente, status done,
 * fonte Agenda Lucas"` — o ESTADO EM INGLÊS numa página em português, sem
 * folga, sem META e sem dizer que o cartão está no caminho crítico. Quem ouve
 * a tela recebia menos do que quem olha.
 *
 * #6: o modo mapa escondia o conteúdo e mantinha os 180px de altura. 40
 * tarefas em 7 linhas pediam 1.764px de mundo; com a pastilha de 44 pedem 812.
 */

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: "t1",
    projectId: "p",
    title: "Configurar ambiente",
    notes: null,
    dueDate: null,
    status: "done",
    priorityHierarq: { s1: 2, s2: 3, s3: 4 },
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

function render(data: TaskNodeData): string {
  return renderToStaticMarkup(
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
}

function ariaDe(html: string): string {
  return /aria-label="([^"]*)"/.exec(html)?.[1] ?? "";
}

const BASE: TaskNodeData = {
  task: task(),
  sourceKind: "calendar",
  sourceLabel: "Agenda Lucas",
  blockedByPredecessor: false,
  inCycle: false,
};

describe("rótulo acessível do cartão — em português e completo (achado MÉDIO #9)", () => {
  it("o estado vem TRADUZIDO, com o mesmo texto do chip — nunca `status done`", () => {
    const aria = ariaDe(render(BASE));
    expect(aria).toContain("concluída");
    expect(aria).not.toContain("status done");
    expect(aria).not.toMatch(/\bdone\b/);
  });

  it("diz o que está visível: nome, S, folga, META e o caminho crítico", () => {
    const aria = ariaDe(
      render({
        ...BASE,
        task: task({ isGoal: true, title: "Deploy de produção" }),
        janela: { es: 0, ef: 1, ls: 3, lf: 4, folga: 3, duracao: 1 },
        score: { valor: 42, s1: 3, s2: 2, s3: 3, e: 1, c: 1, porque: "assimetria alta", obsoleta: false },
        isCritico: true,
        temMeta: true,
      }),
    );
    expect(aria).toContain("Deploy de produção");
    expect(aria).toContain("META");
    expect(aria).toContain("no caminho crítico");
    expect(aria).toContain("prioridade S 24");
    expect(aria).toContain("assimetria A 42");
    expect(aria).toContain("folga 3 dias");
    expect(aria).toContain("fonte Agenda Lucas");
  });

  it("folga aproximada (sem estimativa) é dita como aproximada, nunca como número firme", () => {
    const aria = ariaDe(
      render({
        ...BASE,
        semDuracao: true,
        temMeta: true,
        janela: { es: 0, ef: 1, ls: 0, lf: 1, folga: 0, duracao: 1 },
      }),
    );
    expect(aria).toContain("folga aproximada 0 dias");
  });

  it("anuncia o caminho de teclado até o nome inteiro (achado BAIXO #15)", () => {
    expect(ariaDe(render(BASE))).toContain("Enter abre a tarefa");
  });
});

describe("altura do cartão por MODO (achado MÉDIO #6)", () => {
  it("a pastilha é muito mais baixa que o cartão — e é um token, não um número solto", () => {
    expect(alturaDoCartao("cartao")).toBe(ALTURA_DO_CARTAO);
    expect(alturaDoCartao("mapa")).toBe(ALTURA_DA_PASTILHA);
    expect(alturaDoCartao("mapa")).toBeLessThan(alturaDoCartao("cartao"));
  });

  it("o layout SEGUE o modo: 7 linhas pedem 1.764px de mundo em cartão e 812 em mapa", () => {
    const ids = Array.from({ length: 42 }, (_, i) => `n${String(i).padStart(2, "0")}`);
    const alturaDaGrade = (modo: "cartao" | "mapa"): number => {
      const altura = alturaDoCartao(modo);
      const { nodes } = layoutDoGrafo({ ids, edges: [], maxColunas: 6, nodeH: altura });
      return Math.max(...[...nodes.values()].map((n) => n.y)) + altura;
    };
    expect(alturaDaGrade("cartao")).toBe(6 * (ALTURA_DO_CARTAO + 84) + ALTURA_DO_CARTAO);
    expect(alturaDaGrade("mapa")).toBe(6 * (ALTURA_DA_PASTILHA + 84) + ALTURA_DA_PASTILHA);
    expect(alturaDaGrade("cartao")).toBe(1764);
    expect(alturaDaGrade("mapa")).toBe(812);
  });

  it("no modo cartão (zoom 1, o default do provider) a altura desenhada é a do token", () => {
    expect(render(BASE)).toContain(`style="height:${ALTURA_DO_CARTAO}px"`);
  });
});
