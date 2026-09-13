/**
 * OS-LIFEBOARD · E4/E5 — Repositório FIXTURE de tasks (in-memory).
 *
 * ⚠️ O repositório REAL (Supabase, `lib/repositories/tasks.ts`) NÃO existe nesta
 * rodada — a Nota de execução autônoma (PRD / architecture.md) proíbe tocar o
 * Supabase real. Este fake in-memory serve `GET /api/today` e o dashboard (E5)
 * com um grafo sintético, exercitando o motor HIERARQ ponta-a-ponta sem I/O.
 *
 * A troca para produção é MECÂNICA (mesmo princípio fixture↔live dos adapters,
 * arch §5.2): basta implementar `TasksRepository` com o Supabase server client
 * e injetá-lo no lugar deste fake.
 *
 * As tarefas usam o modelo canônico (`@/types/canonical`) — nunca redefine tipos
 * (coding standard §11). `sourceId = sourceIdFor(kind)` casa 1:1 com as linhas de
 * `sources.fixture.ts` (mesma convenção `deterministicId("source", kind)` dos
 * adapters), então o dashboard consegue rotular/filtrar cada nó por fonte.
 *
 * ── Dataset de demonstração E5 (spec §3/§4/§5) ───────────────────────────────
 * Multi-fonte (5 fontes), com CADEIA de dependência e tarefas BLOQUEADAS:
 *   • task-setup   (calendar, done) → task-build (drive) → task-deploy (drive)
 *   • task-review  (claude_chat)    → task-chat-followup (claude_chat)
 * Lista "hoje" resultante (HIERARQ, produto desc, desempate s1>s3>s2):
 *   1 task-build  S125 · 2 task-docs S60(s1=5) · 3 task-review S60(s1=3) ·
 *   4 task-triage S18 · 5 task-standup S8 · 6 task-notes-idea S6
 * Fora de "hoje": task-deploy e task-chat-followup (predecessor aberto);
 * task-setup e task-archive (done).
 */

import { sourceIdFor } from "@/lib/repositories/sources.fixture";
import {
  type HierarqScore,
  type Task,
  type TaskEdge,
  type TaskNote,
} from "@/types/canonical";

/** Port de leitura do modelo canônico de tasks (Repository Pattern, arch §2.5). */
export interface TasksRepository {
  listAll(): Promise<Task[]>;
  /** v3 — arestas declaradas (predecessor · correlação · sinergia · obsolescência). */
  listEdges(): Promise<TaskEdge[]>;
  /** v3 — notas em lista, mais recente primeiro. */
  listNotes(): Promise<TaskNote[]>;
}

function makeTask(
  id: string,
  hierarq: HierarqScore,
  overrides: Partial<Task> = {},
): Task {
  return {
    id,
    projectId: "proj-fixture",
    title: id,
    notes: null,
    dueDate: null,
    status: "open",
    priorityHierarq: hierarq,
    predecessorIds: [],
    successorIds: [],
    sourceId: sourceIdFor("calendar"),
    externalRef: id,
    updatedAt: "2026-07-09T00:00:00.000Z",
    // v3
    estimativaDias: null,
    iniciadoEm: null,
    parentId: null,
    isGoal: false,
    assimetria: null,
    ...overrides,
  };
}

const FIXTURE_TASKS: readonly Task[] = [
  // ── Cadeia principal: setup → build → deploy ──────────────────────────────
  makeTask("task-setup", { s1: 4, s2: 4, s3: 4 }, {
    title: "Configurar ambiente",
    notes: "Provisionar Supabase local e variáveis",
    status: "done",
    estimativaDias: 0.5,
    iniciadoEm: "2026-07-08T09:00:00.000Z",
    sourceId: sourceIdFor("calendar"),
    successorIds: ["task-build"],
    updatedAt: "2026-07-08T12:00:00.000Z",
  }),
  makeTask("task-build", { s1: 5, s2: 5, s3: 5 }, {
    title: "Implementar motor HIERARQ",
    notes: "S1×S2×S3, desempate s1>s3>s2",
    status: "in_progress",
    dueDate: "2026-07-10T00:00:00.000Z",
    sourceId: sourceIdFor("drive"),
    predecessorIds: ["task-setup"],
    estimativaDias: 3,
    iniciadoEm: "2026-07-08T12:00:00.000Z",
    assimetria: { opcionalidade: 3, esforco: 3, custo: 2 },
    successorIds: ["task-deploy"],
  }),
  makeTask("task-deploy", { s1: 5, s2: 5, s3: 4 }, {
    title: "Deploy de produção",
    notes: "Bloqueada: aguarda o build concluir",
    sourceId: sourceIdFor("drive"),
    predecessorIds: ["task-build"],
    // v3: é o GOAL do fixture — o caminho crítico corre daqui para trás.
    isGoal: true,
    estimativaDias: 1,
    assimetria: { opcionalidade: 2, esforco: 1, custo: 1 },
  }),

  // ── Trabalho acionável de várias fontes ───────────────────────────────────
  makeTask("task-docs", { s1: 5, s2: 4, s3: 3 }, {
    estimativaDias: 2,
    assimetria: { opcionalidade: 1, esforco: 2, custo: 1 },
    title: "Escrever documentação",
    sourceId: sourceIdFor("gmail"),
    dueDate: "2026-07-12T00:00:00.000Z",
  }),
  makeTask("task-review", { s1: 3, s2: 4, s3: 5 }, {
    title: "Revisar PR do time",
    sourceId: sourceIdFor("claude_chat"),
    successorIds: ["task-chat-followup"],
  }),
  makeTask("task-triage-inbox", { s1: 3, s2: 3, s3: 2 }, {
    title: "Triar inbox de projetos",
    sourceId: sourceIdFor("gmail"),
  }),
  makeTask("task-standup", { s1: 2, s2: 2, s3: 2 }, {
    title: "Daily standup",
    sourceId: sourceIdFor("calendar"),
    dueDate: "2026-07-09T00:00:00.000Z",
  }),
  makeTask("task-notes-idea", { s1: 2, s2: 3, s3: 1 }, {
    title: "Rascunhar ideia de feature",
    notes: "Colado das Notas do iPhone",
    sourceId: sourceIdFor("notes"),
  }),

  // ── Bloqueada por predecessor aberto (fora de "hoje", visível no grafo) ────
  makeTask("task-chat-followup", { s1: 1, s2: 2, s3: 2 }, {
    title: "Responder follow-up do chat",
    notes: "Bloqueada: aguarda a revisão do PR",
    sourceId: sourceIdFor("claude_chat"),
    predecessorIds: ["task-review"],
  }),

  // ── Concluída (grafo mostra esmaecida) ────────────────────────────────────
  makeTask("task-archive", { s1: 2, s2: 2, s3: 2 }, {
    title: "Arquivar docs antigos",
    status: "done",
    sourceId: sourceIdFor("drive"),
    updatedAt: "2026-07-07T09:00:00.000Z",
  }),
];

/**
 * v3 — uma aresta de cada tipo declarado, para o grafo e os testes exercitarem
 * as quatro camadas. A cadeia setup → build → deploy continua vindo dos arrays
 * (`predecessorIds`); aqui só o que os arrays não sabem dizer.
 */
const FIXTURE_EDGES: readonly TaskEdge[] = [
  {
    id: "edge-review-antes-do-deploy",
    origem: "task-review",
    destino: "task-deploy",
    tipo: "predecessor",
    peso: 1,
    nota: "Não sobe para produção sem o PR revisado.",
    createdAt: "2026-07-09T10:00:00.000Z",
  },
  {
    id: "edge-docs-correlaciona-build",
    origem: "task-docs",
    destino: "task-build",
    tipo: "correlacao",
    peso: 1,
    nota: "Documentação e motor andam juntos, sem ordem.",
    createdAt: "2026-07-09T10:01:00.000Z",
  },
  {
    id: "edge-triage-barateia-notes",
    origem: "task-triage",
    destino: "task-notes-idea",
    tipo: "sinergia",
    peso: 0.5,
    nota: "Triar a caixa de entrada deixa a ideia meio rascunhada.",
    createdAt: "2026-07-09T10:02:00.000Z",
  },
  {
    id: "edge-build-obsoleta-archive",
    origem: "task-build",
    destino: "task-archive",
    tipo: "obsolescencia",
    peso: 1,
    nota: "Com o motor pronto, arquivar os docs antigos deixa de importar.",
    createdAt: "2026-07-09T10:03:00.000Z",
  },
];

const FIXTURE_NOTES: readonly TaskNote[] = [
  {
    id: "note-build-1",
    taskId: "task-build",
    texto: "Desempate s1 > s3 > s2 confirmado com o operador.",
    autor: "Lucas",
    createdAt: "2026-07-09T11:00:00.000Z",
  },
  {
    id: "note-build-2",
    taskId: "task-build",
    texto: "Falta o teste do empate total.",
    autor: "Claude",
    createdAt: "2026-07-09T11:30:00.000Z",
  },
  {
    id: "note-deploy-1",
    taskId: "task-deploy",
    texto: "Goal do ciclo: subir até sexta.",
    autor: "Lucas",
    createdAt: "2026-07-09T12:00:00.000Z",
  },
];

export class FixtureTasksRepository implements TasksRepository {
  async listAll(): Promise<Task[]> {
    // Cópia defensiva (rasa) para que o consumidor não mute a fixture.
    return FIXTURE_TASKS.map((t) => ({ ...t }));
  }

  async listEdges(): Promise<TaskEdge[]> {
    return FIXTURE_EDGES.map((e) => ({ ...e }));
  }

  async listNotes(): Promise<TaskNote[]> {
    return FIXTURE_NOTES.map((n) => ({ ...n }));
  }
}
