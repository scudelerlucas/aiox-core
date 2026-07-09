/**
 * OS-LIFEBOARD · E4 — Repositório FIXTURE de tasks (in-memory).
 *
 * ⚠️ O repositório REAL (Supabase, `lib/repositories/tasks.ts`) NÃO existe nesta
 * rodada — a Nota de execução autônoma (PRD / architecture.md) proíbe tocar o
 * Supabase real. Este fake in-memory serve o handler `GET /api/today` com um
 * grafo sintético, exercitando o motor HIERARQ ponta-a-ponta sem I/O de banco.
 *
 * A troca para produção é MECÂNICA (mesmo princípio fixture↔live dos adapters,
 * arch §5.2): basta implementar `TasksRepository` com o Supabase server client
 * (`lib/supabase/server.ts`, server-only) e injetá-lo no lugar deste fake.
 *
 * Não importa `server-only`: é dado sintético read-only, seguro em qualquer
 * ambiente (inclusive testes futuros). As tarefas usam o modelo canônico
 * (`@/types/canonical`) — nunca redefine tipos (coding standard §11).
 */

import { type HierarqScore, type Task } from "@/types/canonical";

/** Port de leitura do modelo canônico de tasks (Repository Pattern, arch §2.5). */
export interface TasksRepository {
  listAll(): Promise<Task[]>;
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
    sourceId: "source-fixture",
    externalRef: id,
    updatedAt: "2026-07-09T00:00:00.000Z",
    ...overrides,
  };
}

/**
 * Grafo sintético que demonstra o motor HIERARQ ponta-a-ponta:
 *   • task-setup   — concluída (predecessor resolvido de task-build)
 *   • task-build   — S=125, acionável (predecessor 'done')            ← 1º em "hoje"
 *   • task-docs    — S=60, s1=5, acionável                            ← 2º (produto 60)
 *   • task-review  — S=60, s1=3, acionável                            ← 3º (desempate s1)
 *   • task-deploy  — bloqueada (predecessor task-build ainda aberto)  ← fora de "hoje"
 */
const FIXTURE_TASKS: readonly Task[] = [
  makeTask("task-setup", { s1: 4, s2: 4, s3: 4 }, {
    title: "Configurar ambiente",
    status: "done",
  }),
  makeTask("task-build", { s1: 5, s2: 5, s3: 5 }, {
    title: "Implementar motor HIERARQ",
    predecessorIds: ["task-setup"],
  }),
  makeTask("task-docs", { s1: 5, s2: 4, s3: 3 }, {
    title: "Escrever documentação",
  }),
  makeTask("task-review", { s1: 3, s2: 4, s3: 5 }, {
    title: "Revisar PR",
  }),
  makeTask("task-deploy", { s1: 5, s2: 5, s3: 4 }, {
    title: "Deploy de produção",
    predecessorIds: ["task-build"],
  }),
];

export class FixtureTasksRepository implements TasksRepository {
  async listAll(): Promise<Task[]> {
    // Cópia defensiva (rasa) para que o consumidor não mute a fixture.
    return FIXTURE_TASKS.map((t) => ({ ...t }));
  }
}
