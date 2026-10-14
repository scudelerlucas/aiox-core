import { describe, expect, it } from "vitest";

import { montarGrafoDoDia } from "@/core/prioritize/grafo-do-dia";
import { colarBranchesNaMudanca } from "@/lib/frentes/colar-branches";
import { materializarFrentes } from "@/lib/frentes/materializar";
import type { DadosFrentes } from "@/lib/frentes/types";
import type { Task, TaskEdge } from "@/types/canonical";

const AGORA = Date.parse("2026-10-02T12:00:00.000Z");
const task = (id: string): Task => ({
  id, projectId: "p", title: id, notes: null, dueDate: null, status: "open",
  priorityHierarq: { s1: 1, s2: 1, s3: 1 }, predecessorIds: [], successorIds: [],
  sourceId: "s", externalRef: id, updatedAt: new Date(AGORA).toISOString(),
  estimativaDias: 1, iniciadoEm: null, parentId: null, isGoal: false, assimetria: null,
});
const edge = (id: string, origem: string, destino: string): TaskEdge => ({
  id, origem, destino, tipo: "predecessor", peso: 1, nota: null,
  createdAt: new Date(AGORA).toISOString(),
});

describe("colarBranchesNaMudanca", () => {
  it("troca conversa → branch → mudança por conversa → mudança e recalcula vizinhos", () => {
    const resultado = colarBranchesNaMudanca(
      [task("conversa"), task("branch"), task("mudanca")],
      [edge("e1", "conversa", "branch"), edge("e2", "branch", "mudanca")],
      new Map([["branch", "mudanca"]]),
    );
    expect(resultado.tasks.map((t) => t.id)).toEqual(["conversa", "mudanca"]);
    expect(resultado.edges.map((e) => [e.origem, e.destino])).toEqual([["conversa", "mudanca"]]);
    expect(resultado.tasks[0]?.successorIds).toEqual(["mudanca"]);
    expect(resultado.tasks[1]?.predecessorIds).toEqual(["conversa"]);
  });

  it("remove laço e duplicata, preservando a primeira aresta", () => {
    const resultado = colarBranchesNaMudanca(
      [task("conversa"), task("branch"), task("mudanca")],
      [
        edge("primeira", "conversa", "branch"),
        edge("duplicada", "conversa", "mudanca"),
        edge("laco", "branch", "mudanca"),
      ],
      new Map([["branch", "mudanca"]]),
    );
    expect(resultado.edges).toHaveLength(1);
    expect(resultado.edges[0]?.id).toBe("primeira");
    expect(resultado.tasks.flatMap((t) => [...t.predecessorIds, ...t.successorIds])).not.toContain("branch");
  });

  it("cola antes da poda: conversa ligada apenas pela branch continua no grafo", () => {
    const resultado = montarGrafoDoDia(
      [task("conversa"), task("branch"), task("mudanca")],
      [edge("e1", "conversa", "branch"), edge("e2", "branch", "mudanca")],
      { conversasMaterializadas: new Set(["conversa"]), branchesColadas: new Map([["branch", "mudanca"]]) },
    );
    expect(resultado.tasksDoGrafo.map((t) => t.id)).toEqual(["conversa", "mudanca"]);
    expect(resultado.edgesDoGrafo.map((e) => [e.origem, e.destino])).toEqual([["conversa", "mudanca"]]);
    expect(resultado.cpm.janelas.has("conversa")).toBe(true);
  });
});

function dadosComPrs(quantidade: number, estado: "aberto" | "fechado" = "aberto"): DadosFrentes {
  return {
    sessoes: [],
    branches: [{ repo: "o/r", branch: "feat/x", ultimo_commit_em: null, ultimo_commit_msg: null, tem_pr: true, sessao_ids: [] }],
    prs: Array.from({ length: quantidade }, (_, i) => ({
      repo: "o/r", numero: i + 1, titulo: `PR ${i + 1}`, estado, rascunho: false,
      branch: "feat/x", url: `https://github.com/o/r/pull/${i + 1}`,
      atualizado_em: new Date(AGORA).toISOString(), fechado_em: null,
      mergeado_em: null, checks: "verde" as const, sessao_ids: [],
    })),
    sync: [],
  };
}

describe("proveniência da materialização", () => {
  it("mapeia branch com exatamente uma mudança aberta", () => {
    expect(materializarFrentes(dadosComPrs(1), { agora: AGORA }).branchParaMudanca.size).toBe(1);
  });

  it("não mapeia branch com duas mudanças abertas nem com mudança fechada", () => {
    expect(materializarFrentes(dadosComPrs(2), { agora: AGORA }).branchParaMudanca.size).toBe(0);
    expect(materializarFrentes(dadosComPrs(1, "fechado"), { agora: AGORA }).branchParaMudanca.size).toBe(0);
  });
});
