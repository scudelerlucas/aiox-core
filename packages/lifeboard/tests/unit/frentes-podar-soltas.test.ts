import { describe, expect, it } from "vitest";

import { materializarFrentes } from "@/lib/frentes/materializar";
import { podarConversasSoltas } from "@/lib/frentes/podar-soltas";
import type { DadosFrentes } from "@/lib/frentes/types";
import type { Task, TaskEdge } from "@/types/canonical";

const AGORA = Date.parse("2026-09-30T06:00:00.000Z");

function tarefa(id: string): Task {
  return {
    id,
    projectId: "p",
    title: id,
    notes: null,
    dueDate: null,
    status: "open",
    priorityHierarq: { s1: 1, s2: 1, s3: 1 },
    predecessorIds: [],
    successorIds: [],
    sourceId: "s",
    externalRef: id,
    updatedAt: new Date(AGORA).toISOString(),
    estimativaDias: 1,
    iniciadoEm: null,
    parentId: null,
    isGoal: false,
    assimetria: null,
  };
}

function aresta(origem: string, destino: string): TaskEdge {
  return {
    id: `${origem}-${destino}`,
    origem,
    destino,
    tipo: "predecessor",
    peso: 1,
    nota: null,
    createdAt: new Date(AGORA).toISOString(),
  };
}

describe("podarConversasSoltas", () => {
  it("remove só conversa materializada de grau zero", () => {
    const tasks = [tarefa("conversa-solta"), tarefa("branch"), tarefa("mudanca"), tarefa("banco")];
    const conversas = new Set(["conversa-solta"]);

    expect(podarConversasSoltas(tasks, [], conversas).map((t) => t.id)).toEqual([
      "branch",
      "mudanca",
      "banco",
    ]);
  });

  it("mantém conversa ligada e a aresta continua válida", () => {
    const tasks = [tarefa("conversa"), tarefa("branch")];
    const edges = [aresta("conversa", "branch")];
    const podadas = podarConversasSoltas(tasks, edges, new Set(["conversa"]));

    expect(podadas.map((t) => t.id)).toEqual(["conversa", "branch"]);
    expect(edges.every((e) => podadas.some((t) => t.id === e.origem || t.id === e.destino))).toBe(true);
  });

  it("não poda linha do banco com referência de sessão nem conjunto vazio", () => {
    const linhaDoBanco = { ...tarefa("banco"), externalRef: "session_01ABC" };
    expect(podarConversasSoltas([linhaDoBanco], [], new Set())).toEqual([linhaDoBanco]);
  });

  it("materialização declara exatamente o id da conversa", () => {
    const dados: DadosFrentes = {
      sessoes: [{
        sessao_id: "session_01ABC",
        conta: "conta",
        titulo: "Conversa",
        estado: "working",
        estado_detalhe: null,
        precisa_de: null,
        branches: ["feat/x"],
        repos: ["org/repo"],
        url: "https://github.com/org/repo/pull/1",
        criado_em: "2026-09-30T04:00:00.000Z",
        atualizado_em: "2026-09-30T05:00:00.000Z",
      }],
      branches: [{
        repo: "org/repo",
        branch: "feat/x",
        ultimo_commit_em: "2026-09-30T05:00:00.000Z",
        ultimo_commit_msg: "feat",
        tem_pr: true,
        sessao_ids: ["session_01ABC"],
      }],
      prs: [{
        repo: "org/repo",
        numero: 1,
        titulo: "Mudança",
        estado: "aberto",
        rascunho: false,
        branch: "feat/x",
        url: "https://github.com/org/repo/pull/1",
        atualizado_em: "2026-09-30T05:00:00.000Z",
        fechado_em: null,
        mergeado_em: null,
        checks: "verde",
        sessao_ids: ["session_01ABC"],
      }],
      sync: [],
    };
    const materializacao = materializarFrentes(dados, { agora: AGORA });
    const conversa = materializacao.tasks.find((t) => t.externalRef === "session_01ABC");

    expect([...materializacao.idsDeConversa]).toEqual([conversa?.id]);
  });
});
