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
  /** P5b (achado ALTO #4): para os testes de `atrasada`/marcador em `dueDate`. */
  dueDate?: string | null;
}

function task(input: TaskInput): Task {
  const hierarq: HierarqScore = { s1: 1, s2: 1, s3: 1 };
  return {
    id: input.id,
    projectId: "p",
    title: input.id,
    notes: null,
    dueDate: input.dueDate ?? null,
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
    // P5f (achado BAIXO A9, rodada 5): com `iniciadoEm` REAL o início não é
    // estimado — a barra pode ser sólida, ela afirma uma data que existe.
    expect(lateral.inicioEstimado).toBe(false);
  });

  it("fora do subgrafo do goal SEM iniciadoEm: início é fabricado — `inicioEstimado` avisa (achado BAIXO A9)", () => {
    const tasks = [
      task({ id: "SEM-INICIO", estimativaDias: 4 }),
      task({ id: "GOAL", estimativaDias: 1, isGoal: true }),
    ];
    const cpm = caminhoCritico(tasks, []);
    const props = montarLinhaDoTempo(tasks, [], [], SOURCES, cpm, HOJE);
    const semInicio = tarefaPorId(props, "SEM-INICIO");
    expect(semInicio.foraDoCpm).toBe(true);
    expect(semInicio.semDuracao).toBe(false);
    // A data existe só para a barra ter onde nascer — a tela precisa dizer isso.
    expect(semInicio.inicio).toBe(HOJE);
    expect(semInicio.inicioEstimado).toBe(true);
  });
});

describe("montarLinhaDoTempo — done fora do CPM nunca fabrica barra no futuro (achado ALTO #4)", () => {
  it("done sem iniciadoEm: vira ponto em updatedAt (semBarra), nunca hoje→hoje+1", () => {
    const tasks = [
      task({ id: "DONE-SOLTA", status: "done" }),
      task({ id: "GOAL", estimativaDias: 1, isGoal: true }),
    ];
    const cpm = caminhoCritico(tasks, []);
    const props = montarLinhaDoTempo(tasks, [], [], SOURCES, cpm, HOJE);
    const linha = tarefaPorId(props, "DONE-SOLTA");
    expect(linha.foraDoCpm).toBe(true);
    expect(linha.semBarra).toBe(true);
    expect(linha.pontoConcluidoEm).toBe("2026-07-09"); // updatedAt do helper `task()`
    expect(linha.inicio).toBe("2026-07-09");
    expect(linha.fim).toBe("2026-07-09");
  });

  it("aberta fora do CPM com estimativa < 1 dia (0,5): NUNCA marco (achado BAIXO #11, rodada 2) — a VIEW desenha barra curta, não diamante", () => {
    // P5c: `marco` antes comparava DATAS truncadas (`inicio === fim` como
    // string) — 0,5 dia soma menos de 24h e trunca pro MESMO dia, então virava
    // diamante como se a duração fosse zero. A duração aqui É POSITIVA (0,5,
    // não zero) — diamante é só para zero de verdade (`done`, ramo `semBarra`).
    const tasks = [
      task({ id: "MEIO-DIA", estimativaDias: 0.5 }),
      task({ id: "GOAL", estimativaDias: 1, isGoal: true }),
    ];
    const cpm = caminhoCritico(tasks, []);
    const props = montarLinhaDoTempo(tasks, [], [], SOURCES, cpm, HOJE);
    const linha = tarefaPorId(props, "MEIO-DIA");
    expect(linha.foraDoCpm).toBe(true);
    expect(linha.inicio).toBe(linha.fim); // datas de calendário iguais (sub-dia) — mas...
    expect(linha.marco).toBe(false); // ...NUNCA diamante: a duração é positiva.
    expect(linha.semDuracao).toBe(false); // tem estimativa VÁLIDA — só é curta demais para virar um dia inteiro
  });

  it("aberta fora do CPM sem estimativa: continua semDuracao=true (a view desenha tracejado)", () => {
    const tasks = [
      task({ id: "SOLTA-SEM-ESTIMATIVA", iniciadoEm: "2026-09-10T00:00:00.000Z" }),
      task({ id: "GOAL", estimativaDias: 1, isGoal: true }),
    ];
    const cpm = caminhoCritico(tasks, []);
    const props = montarLinhaDoTempo(tasks, [], [], SOURCES, cpm, HOJE);
    const linha = tarefaPorId(props, "SOLTA-SEM-ESTIMATIVA");
    expect(linha.semDuracao).toBe(true);
    expect(linha.foraDoCpm).toBe(true);
    expect(linha.marco).toBe(false);
    expect(linha.semBarra).toBe(false);
  });
});

describe("montarLinhaDoTempo — marco e atraso (achado ALTO #4/#8)", () => {
  it("done DENTRO do CPM nunca vira losango em hoje — ponto real em updatedAt (achado ALTO #3, rodada 3)", () => {
    // P5d (rodada 3): antes, `es === ef` (duração zero por construção do CPM)
    // virava `marco: true` na posição de "hoje" — um losango vermelho sobre
    // uma tarefa já CONCLUÍDA no passado. Checar `status === "done"` ANTES da
    // janela é o fix: sempre o ponto real (`updatedAt`), nunca "hoje".
    const tasks = [
      task({ id: "DONE-NO-CPM", status: "done", predecessorIds: [] }),
      task({ id: "GOAL", predecessorIds: ["DONE-NO-CPM"], estimativaDias: 2, isGoal: true }),
    ];
    const cpm = caminhoCritico(tasks, []);
    const props = montarLinhaDoTempo(tasks, [], [], SOURCES, cpm, HOJE);
    const linha = tarefaPorId(props, "DONE-NO-CPM");
    expect(linha.foraDoCpm).toBe(false);
    expect(linha.marco).toBe(false);
    expect(linha.semBarra).toBe(true);
    expect(linha.pontoConcluidoEm).toBe("2026-07-09"); // updatedAt do helper `task()`
    expect(linha.inicio).toBe(linha.fim);
    expect(linha.inicio).not.toBe(HOJE);
    expect(linha.critico).toBe(cpm.critico.has("DONE-NO-CPM"));
  });

  it("fixture task-setup: done e crítica dentro do CPM → semBarra, sem barra, sem losango, folga real (achado ALTO #3, rodada 3)", () => {
    const tasks = [
      task({ id: "task-setup", status: "done", predecessorIds: [] }),
      task({ id: "GOAL", predecessorIds: ["task-setup"], estimativaDias: 3, isGoal: true }),
    ];
    const cpm = caminhoCritico(tasks, []);
    const props = montarLinhaDoTempo(tasks, [], [], SOURCES, cpm, HOJE);
    const linha = tarefaPorId(props, "task-setup");
    expect(cpm.critico.has("task-setup")).toBe(true); // pré-condição do fixture: é de fato crítica
    expect(linha.critico).toBe(true);
    expect(linha.semBarra).toBe(true);
    expect(linha.marco).toBe(false);
    expect(linha.foraDoCpm).toBe(false);
    expect(linha.folga).toBe(0);
    expect(linha.pontoConcluidoEm).toBe("2026-07-09");
    expect(linha.inicio).not.toBe(HOJE);
  });

  it("dueDate no passado e não done → atrasada=true", () => {
    const tasks = [
      task({ id: "ATRASADA", dueDate: "2026-09-01" }),
      task({ id: "GOAL", estimativaDias: 1, isGoal: true }),
    ];
    const cpm = caminhoCritico(tasks, []);
    const props = montarLinhaDoTempo(tasks, [], [], SOURCES, cpm, HOJE);
    const linha = tarefaPorId(props, "ATRASADA");
    expect(linha.atrasada).toBe(true);
    expect(linha.dueDate).toBe("2026-09-01");
  });

  it("dueDate no passado MAS done → atrasada=false (já entregou)", () => {
    const tasks = [
      task({ id: "ENTREGUE-TARDE", status: "done", dueDate: "2026-09-01" }),
      task({ id: "GOAL", estimativaDias: 1, isGoal: true }),
    ];
    const cpm = caminhoCritico(tasks, []);
    const props = montarLinhaDoTempo(tasks, [], [], SOURCES, cpm, HOJE);
    const linha = tarefaPorId(props, "ENTREGUE-TARDE");
    expect(linha.atrasada).toBe(false);
  });

  it("dueDate podre ('abc'): nunca lança, dueDate cai para null, atrasada=false", () => {
    const tasks = [
      task({ id: "DUE-PODRE", dueDate: "abc" }),
      task({ id: "GOAL", estimativaDias: 1, isGoal: true }),
    ];
    const cpm = caminhoCritico(tasks, []);
    expect(() => montarLinhaDoTempo(tasks, [], [], SOURCES, cpm, HOJE)).not.toThrow();
    const props = montarLinhaDoTempo(tasks, [], [], SOURCES, cpm, HOJE);
    const linha = tarefaPorId(props, "DUE-PODRE");
    expect(linha.dueDate).toBeNull();
    expect(linha.atrasada).toBe(false);
  });
});

describe("montarLinhaDoTempo — assuntos: data inválida, datas inconsistentes e marco (achados MÉDIO #13 / ALTO #8)", () => {
  it("criado_em podre ('abc') nunca vira 'hoje' silencioso — dataInvalida=true, sem crash", () => {
    const prs: Pr[] = [
      pr({
        repo: "org/podre",
        numero: 9,
        titulo: "fix: data podre",
        estado: "mergeado",
        criado_em: "abc",
        mergeado_em: "2026-09-05T00:00:00.000Z",
      }),
    ];
    const cpm = caminhoCritico([], []);
    expect(() => montarLinhaDoTempo([], [], prs, SOURCES, cpm, HOJE)).not.toThrow();
    const props = montarLinhaDoTempo([], [], prs, SOURCES, cpm, HOJE);
    const linha = props.grupos.find((g) => g.titulo === "Assuntos")?.linhas[0];
    expect(linha?.kind).toBe("assunto");
    if (linha?.kind === "assunto") {
      expect(linha.dataInvalida).toBe(true);
      expect(linha.inicio).toBe(HOJE);
      expect(linha.fim).toBe(HOJE);
    }
  });

  it("mergeado_em < criado_em (intervalo negativo) → datasInconsistentes=true, nunca Math.max(4, negativo)", () => {
    const prs: Pr[] = [
      pr({
        repo: "org/invertido",
        numero: 10,
        titulo: "fix: mergeado antes de criado",
        estado: "mergeado",
        criado_em: "2026-09-10T00:00:00.000Z",
        mergeado_em: "2026-09-05T00:00:00.000Z",
      }),
    ];
    const cpm = caminhoCritico([], []);
    const props = montarLinhaDoTempo([], [], prs, SOURCES, cpm, HOJE);
    const linha = props.grupos.find((g) => g.titulo === "Assuntos")?.linhas[0];
    expect(linha?.kind).toBe("assunto");
    if (linha?.kind === "assunto") {
      expect(linha.datasInconsistentes).toBe(true);
      expect(linha.marco).toBe(false);
    }
  });

  it("PR do mesmo dia (criado_em === mergeado_em) → marco=true", () => {
    const prs: Pr[] = [
      pr({
        repo: "org/mesmodia",
        numero: 11,
        titulo: "fix: entrou no mesmo dia",
        estado: "mergeado",
        criado_em: "2026-09-05T08:00:00.000Z",
        mergeado_em: "2026-09-05T18:00:00.000Z",
      }),
    ];
    const cpm = caminhoCritico([], []);
    const props = montarLinhaDoTempo([], [], prs, SOURCES, cpm, HOJE);
    const linha = props.grupos.find((g) => g.titulo === "Assuntos")?.linhas[0];
    expect(linha?.kind).toBe("assunto");
    if (linha?.kind === "assunto") {
      expect(linha.marco).toBe(true);
      expect(linha.datasInconsistentes).toBe(false);
      expect(linha.dataInvalida).toBe(false);
    }
  });
});

describe("montarLinhaDoTempo — ordenação por rank em empate de ES (achado ALTO #10, rodada 2)", () => {
  it("setup → build → deploy, todas fora do CPM (mesmo ES=+Infinity): a ordem respeita a precedência, não só o id", () => {
    const tasks = [
      task({ id: "deploy", predecessorIds: ["build"] }),
      task({ id: "build", predecessorIds: ["setup"] }),
      task({ id: "setup" }),
      task({ id: "GOAL", estimativaDias: 1, isGoal: true }),
    ];
    const cpm = caminhoCritico(tasks, []);
    const props = montarLinhaDoTempo(tasks, [], [], SOURCES, cpm, HOJE);
    const grupo = props.grupos.find((g) => g.titulo === "Tarefas");
    const ordem = (grupo?.linhas ?? [])
      .map((l) => l.id)
      .filter((id) => id !== "GOAL");
    expect(ordem).toEqual(["setup", "build", "deploy"]);
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
