import { describe, expect, it, vi } from "vitest";

import {
  KIND_CONVERSA,
  KIND_GITHUB,
  idDaFontePadrao,
  idDaTarefaFrente,
} from "@/lib/frentes/materializar";
import {
  criarRepositoriosComFrentes,
  unirFrentesAoGrafo,
  type GrafoUnido,
} from "@/lib/frentes/no-grafo";
import type { DadosFrentes } from "@/lib/frentes/types";
import { FixtureSourcesRepository } from "@/lib/repositories/sources.fixture";
import { FixtureTasksRepository } from "@/lib/repositories/tasks.fixture";
import { computeSourceStatuses } from "@/lib/source-status";
import type { Source, Task } from "@/types/canonical";

/**
 * A junção no caminho de leitura (`getTasksRepository`): o grafo do banco +
 * as frentes materializadas, sem gravar nada e sem cair quando as frentes não
 * podem ser lidas.
 */

const AGORA = Date.parse("2026-09-25T12:00:00.000Z");
const h = (n: number): string => new Date(AGORA - n * 3_600_000).toISOString();
const HUB = "scudelerlucas/Lucas-Contexto-Geral";

function frentes(): DadosFrentes {
  return {
    sessoes: [
      {
        sessao_id: "session_01ABC",
        conta: "lucasscudeler@gmail.com",
        titulo: "Painel de assuntos",
        estado: "working",
        estado_detalhe: null,
        precisa_de: null,
        branches: ["claude/painel"],
        repos: [HUB],
        url: null,
        criado_em: h(30),
        atualizado_em: h(2),
      },
    ],
    branches: [
      {
        repo: HUB,
        branch: "claude/painel",
        ultimo_commit_em: h(3),
        ultimo_commit_msg: "feat: painel",
        tem_pr: true,
        sessao_ids: ["session_01ABC"],
      },
    ],
    prs: [
      {
        repo: HUB,
        numero: 7,
        titulo: "feat: painel",
        estado: "aberto",
        rascunho: false,
        branch: "claude/painel",
        url: "https://github.com/x/pull/7",
        atualizado_em: h(2),
        fechado_em: null,
        mergeado_em: null,
        checks: "verde",
        sessao_ids: [],
      },
    ],
    sync: [{ fonte: "github", executado_em: h(1), ok: true }],
  };
}

function tarefa(parcial: Partial<Task>): Task {
  return {
    id: "t-banco",
    projectId: "p",
    title: "do banco",
    notes: null,
    dueDate: null,
    status: "open",
    priorityHierarq: { s1: 1, s2: 1, s3: 1 },
    predecessorIds: [],
    successorIds: [],
    sourceId: "s",
    externalRef: "x",
    updatedAt: h(1),
    ...parcial,
  };
}

const idSessao = idDaTarefaFrente(KIND_CONVERSA, "session_01ABC");
const idBranch = idDaTarefaFrente(KIND_GITHUB, `${HUB}:claude/painel`);
const idPr = idDaTarefaFrente(KIND_GITHUB, `${HUB}#7`);

describe("unirFrentesAoGrafo (pura)", () => {
  it("soma as frentes ao grafo do banco e cria as fontes que faltam, com frescor", () => {
    const base: GrafoUnido = { tasks: [tarefa({})], edges: [], sources: [] };
    const unido = unirFrentesAoGrafo(base, frentes(), AGORA);

    expect(unido.tasks).toHaveLength(4);
    expect(unido.edges).toHaveLength(2);
    expect(unido.sources.map((s) => s.kind).sort()).toEqual(["claude_chat", "github"]);
    const github = unido.sources.find((s) => s.kind === "github");
    expect(github?.id).toBe(idDaFontePadrao("github"));
    expect(github?.lastSyncAt).toBe(h(1));
    expect(github?.authMode).toBe("api");
    // Nunca publicou → sem frescor, e o /api/health vai dizer 'warning', não cair.
    expect(unido.sources.find((s) => s.kind === "claude_chat")?.lastSyncAt).toBeNull();
  });

  it("usa a linha real de `sources` quando o banco já tem a fonte", () => {
    const real: Source = {
      id: "uuid-real-github",
      kind: "github",
      label: "GitHub",
      authMode: "api",
      lastSyncAt: h(5),
    };
    const unido = unirFrentesAoGrafo({ tasks: [], edges: [], sources: [real] }, frentes(), AGORA);
    expect(unido.sources.filter((s) => s.kind === "github")).toEqual([real]);
    const pr = unido.tasks.find((t) => t.externalRef === `${HUB}#7`);
    expect(pr?.sourceId).toBe("uuid-real-github");
  });

  it("a linha do banco vence a materializada pela mesma chave, e as arestas seguem o id real", () => {
    const jaGravada = tarefa({
      id: "uuid-real-do-pr",
      sourceId: idDaFontePadrao("github"),
      externalRef: `${HUB}#7`,
      title: "gravada em tasks",
    });
    const unido = unirFrentesAoGrafo(
      { tasks: [jaGravada], edges: [], sources: [] },
      frentes(),
      AGORA,
    );
    expect(unido.tasks).toHaveLength(3);
    expect(unido.tasks.find((t) => t.id === idPr)).toBeUndefined();
    const gravada = unido.tasks.find((t) => t.id === "uuid-real-do-pr");
    expect(gravada?.title).toBe("gravada em tasks");
    expect(gravada?.predecessorIds).toEqual([idBranch]);
    expect(unido.edges.map((e) => `${e.origem}->${e.destino}`).sort()).toEqual(
      [`${idBranch}->uuid-real-do-pr`, `${idSessao}->${idBranch}`].sort(),
    );
    const branch = unido.tasks.find((t) => t.id === idBranch);
    expect(branch?.successorIds).toEqual(["uuid-real-do-pr"]);
  });

  it("aresta já declarada no banco não entra duas vezes", () => {
    const base: GrafoUnido = {
      tasks: [],
      edges: [
        {
          id: "e-banco",
          origem: idBranch,
          destino: idPr,
          tipo: "predecessor",
          peso: 1,
          nota: null,
          createdAt: h(9),
        },
      ],
      sources: [],
    };
    const unido = unirFrentesAoGrafo(base, frentes(), AGORA);
    const repetidas = unido.edges.filter((e) => e.origem === idBranch && e.destino === idPr);
    expect(repetidas).toHaveLength(1);
    expect(repetidas[0]?.id).toBe("e-banco");
  });

  it("é idempotente: unir duas vezes a mesma entrada dá o mesmo grafo", () => {
    const base: GrafoUnido = { tasks: [tarefa({})], edges: [], sources: [] };
    expect(unirFrentesAoGrafo(base, frentes(), AGORA)).toEqual(
      unirFrentesAoGrafo(base, frentes(), AGORA),
    );
  });
});

describe("criarRepositoriosComFrentes (o par que o factory devolve)", () => {
  const base = () => ({
    tasks: new FixtureTasksRepository(),
    sources: new FixtureSourcesRepository(),
  });

  it("devolve o grafo unido pelos dois repositórios, lendo as frentes UMA vez", async () => {
    const ler = vi.fn(async () => frentes());
    const par = criarRepositoriosComFrentes(base(), ler, () => AGORA);

    const [tasks, edges, sources] = await Promise.all([
      par.tasks.listAll(),
      par.tasks.listEdges(),
      par.sources.listAll(),
    ]);
    const semFrentes = await base().tasks.listAll();

    expect(tasks.length).toBe(semFrentes.length + 3);
    expect(edges.some((e) => e.origem === idSessao && e.destino === idBranch)).toBe(true);
    expect(sources.some((s) => s.kind === "github")).toBe(true);
    expect(ler).toHaveBeenCalledTimes(1);
  });

  it("frentes indisponíveis (sem login, RLS fechada) não derrubam o grafo", async () => {
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const ler = vi.fn(async (): Promise<DadosFrentes> => {
      throw new Error("Não deu para ler os assuntos agora.");
    });
    const par = criarRepositoriosComFrentes(base(), ler, () => AGORA);

    const tasks = await par.tasks.listAll();
    const sources = await par.sources.listAll();
    const semFrentes = await base().tasks.listAll();

    expect(tasks).toEqual(semFrentes);
    expect(sources.some((s) => s.kind === "github")).toBe(false);
    expect(aviso).toHaveBeenCalledTimes(1);
    aviso.mockRestore();
  });

  it("/api/health continua 'degraded', nunca 'down': a fonte nova entra como aviso", async () => {
    const par = criarRepositoriosComFrentes(base(), async () => frentes(), () => AGORA);
    const [sources, syncLogs, tasks] = await Promise.all([
      par.sources.listAll(),
      par.sources.listSyncLogs(),
      par.tasks.listAll(),
    ]);
    const statuses = computeSourceStatuses(sources, syncLogs, tasks, AGORA);
    // A fixture já tem uma fonte `claude_chat` (com tarefas próprias): a conversa
    // materializada entra NELA — mais uma tarefa, nenhuma fonte em dobro.
    const semFrentes = (await base().tasks.listAll()).filter(
      (t) => t.sourceId === idDaFontePadrao("claude_chat"),
    ).length;
    const conversas = statuses.find((s) => s.kind === "claude_chat");
    expect(statuses.filter((s) => s.kind === "claude_chat")).toHaveLength(1);
    expect(conversas?.taskCount).toBe(semFrentes + 1);
    // GitHub não existia: nasce virtual, com o frescor de `painel_frentes_sync`
    // (há 1 h → saudável) e as duas tarefas (branch + mudança).
    const github = statuses.find((s) => s.kind === "github");
    expect(github?.severity).toBeNull();
    expect(github?.taskCount).toBe(2);
    // Nenhuma fonte com erro de leitura: o health nunca vira 'down' por causa da junção.
    expect(statuses.every((s) => s.severity !== "error" || s.kind !== "github")).toBe(true);
  });

  it("notas e sync_log continuam vindo do repositório base, intocados", async () => {
    const b = base();
    const par = criarRepositoriosComFrentes(b, async () => frentes(), () => AGORA);
    expect(await par.tasks.listNotes()).toEqual(await b.tasks.listNotes());
    expect(await par.sources.listSyncLogs()).toEqual(await b.sources.listSyncLogs());
  });
});
