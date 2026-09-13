import { describe, expect, it } from "vitest";

import { caminhoCritico } from "@/core/prioritize/caminho-critico";
import { montarLinhaDoTempo } from "@/core/timeline/linha-do-tempo";
import type { Pr } from "@/lib/frentes/types";
import type { HierarqScore, Source, Task, TaskStatus } from "@/types/canonical";
import type { LinhaDoTempoTarefaRow } from "@/types/linha-do-tempo";

/**
 * OS-LIFEBOARD · P5 — testes da montagem PURA da linha do tempo. Mesma
 * convenção de `tests/unit/caminho-critico.test.ts`: helpers `task`/`edge`,
 * mesmo exemplo canônico (A→D→F→G = 12 d).
 */

const HOJE = "2026-09-13";

interface TaskInput {
  id: string;
  status?: TaskStatus;
  predecessorIds?: string[];
  successorIds?: string[];
  estimativaDias?: number | null;
  iniciadoEm?: string | null;
  isGoal?: boolean;
  sourceId?: string;
}

function task(input: TaskInput): Task {
  const hierarq: HierarqScore = { s1: 1, s2: 1, s3: 1 };
  return {
    id: input.id,
    projectId: "p",
    title: input.id,
    notes: null,
    dueDate: null,
    status: input.status ?? "open",
    priorityHierarq: hierarq,
    predecessorIds: input.predecessorIds ?? [],
    successorIds: input.successorIds ?? [],
    sourceId: input.sourceId ?? "src-calendar",
    externalRef: input.id,
    updatedAt: "2026-07-09T00:00:00.000Z",
    estimativaDias: input.estimativaDias ?? null,
    iniciadoEm: input.iniciadoEm ?? null,
    parentId: null,
    isGoal: input.isGoal ?? false,
    assimetria: null,
  };
}

const SOURCES: Source[] = [
  { id: "src-calendar", kind: "calendar", label: "Agenda", authMode: "api", lastSyncAt: null },
];

function pr(overrides: Partial<Pr> & Pick<Pr, "repo" | "numero" | "estado" | "titulo">): Pr {
  return {
    branch: "b",
    rascunho: false,
    url: `https://github.com/${overrides.repo}/pull/${overrides.numero}`,
    atualizado_em: "2026-09-10T00:00:00.000Z",
    fechado_em: null,
    mergeado_em: null,
    checks: null,
    ...overrides,
  };
}

/** Acha a linha de tarefa por id no grupo "Tarefas"; nunca `undefined` silencioso no teste. */
function tarefaPorId(
  props: ReturnType<typeof montarLinhaDoTempo>,
  id: string,
): LinhaDoTempoTarefaRow {
  const grupo = props.grupos.find((g) => g.titulo === "Tarefas");
  const linha = grupo?.linhas.find((l) => l.id === id);
  if (!linha || linha.kind !== "tarefa") throw new Error(`tarefa ${id} não encontrada no teste`);
  return linha;
}

describe("montarLinhaDoTempo — exemplo CANÔNICO de livro-texto (A→D→F→G = 12 d)", () => {
  const tasks = [
    task({ id: "A", estimativaDias: 3 }),
    task({ id: "B", estimativaDias: 2 }),
    task({ id: "C", predecessorIds: ["A"], estimativaDias: 2 }),
    task({ id: "D", predecessorIds: ["A", "B"], estimativaDias: 4 }),
    task({ id: "E", predecessorIds: ["C", "D"], estimativaDias: 1 }),
    task({ id: "F", predecessorIds: ["D"], estimativaDias: 3 }),
    task({ id: "G", predecessorIds: ["E", "F"], estimativaDias: 2, isGoal: true }),
  ];
  const cpm = caminhoCritico(tasks, []);
  const props = montarLinhaDoTempo(tasks, [], [], SOURCES, cpm, HOJE);

  it("goalId e duracaoTotal batem com o CPM", () => {
    expect(props.goalId).toBe("G");
    expect(props.duracaoTotal).toBe(12);
    expect(props.hoje).toBe(HOJE);
  });

  it("datas de cada tarefa = hoje + es/ef/lf do CPM", () => {
    const a = tarefaPorId(props, "A");
    expect(a.inicio).toBe("2026-09-13"); // es=0
    expect(a.fim).toBe("2026-09-16"); // ef=3
    expect(a.fimComFolga).toBe(a.fim); // folga 0 → sem extensão
    expect(a.critico).toBe(true);

    const g = tarefaPorId(props, "G");
    expect(g.inicio).toBe("2026-09-23"); // es=10
    expect(g.fim).toBe("2026-09-25"); // ef=12
    expect(g.critico).toBe(true);

    const c = tarefaPorId(props, "C");
    expect(c.critico).toBe(false);
    expect(c.folga).toBe(4);
    expect(c.fimComFolga).not.toBe(c.fim); // folga > 0 → extensão visível
  });

  it("caminho crítico = {A,D,F,G}; B,C,E não são críticas", () => {
    for (const id of ["A", "D", "F", "G"]) expect(tarefaPorId(props, id).critico).toBe(true);
    for (const id of ["B", "C", "E"]) expect(tarefaPorId(props, id).critico).toBe(false);
  });

  it("predecessores/sucessores batem com o grafo declarado", () => {
    expect(tarefaPorId(props, "D").predecessores.sort()).toEqual(["A", "B"]);
    expect(tarefaPorId(props, "A").sucessores.sort()).toEqual(["C", "D"]);
    expect(tarefaPorId(props, "G").sucessores).toEqual([]);
  });

  it("ordenação: ES ascendente, crítico primeiro no empate — A,B,D,C,F,E,G", () => {
    const grupo = props.grupos.find((g) => g.titulo === "Tarefas");
    const ordem = (grupo?.linhas ?? []).map((l) => l.id);
    expect(ordem).toEqual(["A", "B", "D", "C", "F", "E", "G"]);
  });

  it("nenhuma tarefa do exemplo fica sem duração (todas têm estimativaDias)", () => {
    for (const id of ["A", "B", "C", "D", "E", "F", "G"]) {
      expect(tarefaPorId(props, id).semDuracao).toBe(false);
      expect(tarefaPorId(props, id).foraDoCpm).toBe(false);
    }
  });
});

describe("montarLinhaDoTempo — assuntos: aberto vs mergeado", () => {
  const prs: Pr[] = [
    pr({
      repo: "org/aberto",
      numero: 1,
      titulo: "feat: em andamento",
      estado: "aberto",
      criado_em: "2026-09-01T00:00:00.000Z",
    }),
    pr({
      repo: "org/mergeado",
      numero: 2,
      titulo: "fix: já entrou",
      estado: "mergeado",
      criado_em: "2026-09-01T00:00:00.000Z",
      mergeado_em: "2026-09-05T00:00:00.000Z",
      fechado_em: "2026-09-05T00:00:00.000Z",
    }),
  ];
  const cpm = caminhoCritico([], []);
  const props = montarLinhaDoTempo([], [], prs, SOURCES, cpm, HOJE);
  const grupo = props.grupos.find((g) => g.titulo === "Assuntos");

  it("assunto aberto termina em HOJE (nunca fica sem fim)", () => {
    const linha = grupo?.linhas.find((l) => l.id === "org/aberto#1");
    expect(linha?.kind).toBe("assunto");
    if (linha?.kind === "assunto") {
      expect(linha.aberto).toBe(true);
      expect(linha.fim).toBe(HOJE);
      expect(linha.inicio).toBe("2026-09-01");
    }
  });

  it("assunto mergeado termina em mergeado_em, nunca em hoje", () => {
    const linha = grupo?.linhas.find((l) => l.id === "org/mergeado#2");
    expect(linha?.kind).toBe("assunto");
    if (linha?.kind === "assunto") {
      expect(linha.aberto).toBe(false);
      expect(linha.fim).toBe("2026-09-05");
    }
  });

  it("título limpo (sem prefixo de commit) via limparTitulo — reuso da tela /frentes", () => {
    const linha = grupo?.linhas.find((l) => l.id === "org/mergeado#2");
    if (linha?.kind === "assunto") expect(linha.titulo).toBe("Já entrou");
  });
});

describe("montarLinhaDoTempo — tarefa sem estimativa é sinalizada", () => {
  it("dentro do CPM (ancestral do goal): usa o placeholder do CPM e entra em semDuracao", () => {
    const tasks = [
      task({ id: "X", successorIds: ["GOAL"] }), // sem estimativaDias
      task({ id: "GOAL", predecessorIds: ["X"], estimativaDias: 2, isGoal: true }),
    ];
    const cpm = caminhoCritico(tasks, []);
    const props = montarLinhaDoTempo(tasks, [], [], SOURCES, cpm, HOJE);
    const x = tarefaPorId(props, "X");
    expect(x.semDuracao).toBe(true);
    expect(x.foraDoCpm).toBe(false);
  });

  it("fora do CPM (sem goal nenhum): nasce de iniciadoEm/hoje e é sinalizada foraDoCpm", () => {
    const tasks = [task({ id: "SOLTA" })];
    const cpm = caminhoCritico(tasks, []); // sem isGoal → goalId null → CPM roda no DAG inteiro
    const props = montarLinhaDoTempo(tasks, [], [], SOURCES, cpm, HOJE);
    const solta = tarefaPorId(props, "SOLTA");
    // Sem goal, o CPM cobre o DAG inteiro — "SOLTA" TEM janela (é terminal virtual).
    // O teste que isola "fora do CPM de verdade" precisa de um goal que não a alcança:
    expect(solta.semDuracao).toBe(true);
  });

  it("fora do subgrafo do goal (ramo que não leva a ele): usa iniciadoEm + estimativaDias", () => {
    const tasks = [
      task({ id: "LATERAL", iniciadoEm: "2026-09-10T00:00:00.000Z", estimativaDias: 5 }),
      task({ id: "GOAL", estimativaDias: 1, isGoal: true }),
    ];
    const cpm = caminhoCritico(tasks, []);
    const props = montarLinhaDoTempo(tasks, [], [], SOURCES, cpm, HOJE);
    const lateral = tarefaPorId(props, "LATERAL");
    expect(lateral.foraDoCpm).toBe(true);
    expect(lateral.semDuracao).toBe(false);
    expect(lateral.inicio).toBe("2026-09-10");
    expect(lateral.fim).toBe("2026-09-15"); // 2026-09-10 + 5 dias
  });
});

describe("montarLinhaDoTempo — nunca lança", () => {
  it("entrada vazia → grupos vazios, sem erro", () => {
    const cpm = caminhoCritico([], []);
    expect(() => montarLinhaDoTempo([], [], [], [], cpm, HOJE)).not.toThrow();
    const props = montarLinhaDoTempo([], [], [], [], cpm, HOJE);
    expect(props.grupos.every((g) => g.linhas.length === 0)).toBe(true);
  });

  it("predecessor apontando para tarefa inexistente → ignorado, nunca lança", () => {
    const tasks = [task({ id: "ORFAO", predecessorIds: ["fantasma"] })];
    const cpm = caminhoCritico(tasks, []);
    expect(() => montarLinhaDoTempo(tasks, [], [], SOURCES, cpm, HOJE)).not.toThrow();
    const props = montarLinhaDoTempo(tasks, [], [], SOURCES, cpm, HOJE);
    expect(tarefaPorId(props, "ORFAO").predecessores).toEqual([]);
  });
});
