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
 *
 * v3 (P4, 13/09/2026) — caminho crítico: `task-deploy` é o único `isGoal`, com
 * `estimativaDias` em `task-setup`/`task-build`/`task-deploy`. Isso já é
 * suficiente para o CPM computar 2 arestas críticas (setup→build→deploy, folga
 * zero) sem precisar de nenhuma aresta nova — checado rodando `caminhoCritico`
 * contra este fixture (`critico = [task-setup, task-build, task-deploy]`).
 * `task-review` (a única aresta `TaskEdge` tipo=predecessor, →task-deploy) fica
 * com folga 2, então NÃO entra no crítico — mantido assim de propósito: prova
 * que o grafo mostra caminho crítico e aresta "sucessão comum" lado a lado.
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

export const FIXTURE_TASKS: readonly Task[] = [
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

  /*
   * ── Rodada 12 (achado ALTO 1) — os dois mecanismos que NUNCA nasciam ──────
   *
   * Medido no Chromium em 4 estados (1440/390 × Auto/Semana/Trimestre):
   * `lb-tl-slack` = 0 e `lb-tl-atraso` = 0 em TODOS. Duas camadas desenhadas
   * pela tela, cada uma afirmando uma data, com zero cobertura de navegador
   * em qualquer largura ou zoom — porque as duas únicas tarefas com barra da
   * fixture (`task-build`, `task-deploy`) estão as duas no caminho crítico,
   * com `folga: 0 d`, e o único `dueDate` cai fora da barra.
   *
   * As duas tarefas abaixo existem para que esses dois desenhos EXISTAM na
   * tela que a guarda mede. Elas não mexem no caminho crítico nem em
   * `duracaoTotal` (prova em `caminho-critico.test.ts`).
   */

  /*
   * `lb-tl-slack` — a hachura de folga, que afirma `fim → fimComFolga`.
   * Predecessora do goal com 1 dia de duração contra 3 dias de janela:
   * ES 0, EF 1, LF 3 → folga 2. A barra é de 1 dia e a hachura de 2, SEMPRE
   * relativas a "hoje" (o CPM conta a partir de hoje) — logo este desenho
   * não envelhece com o calendário.
   */
  makeTask("task-lint", { s1: 2, s2: 2, s3: 1 }, {
    title: "Rodar o lint antes do deploy",
    notes: "Folga de 2 dias: ficar pronta hoje não adianta a data do goal",
    sourceId: sourceIdFor("drive"),
    estimativaDias: 1,
    successorIds: ["task-deploy"],
  }),

  /*
   * `lb-tl-atraso` — o TRAÇO de prazo, que afirma `xFor(dueDate)` DENTRO da
   * barra. Para o prazo cair dentro da barra e a tarefa estar atrasada ao
   * mesmo tempo, ela precisa de início REAL no passado (`iniciadoEm`) e
   * duração que atravesse o prazo: uma tarefa do CPM começa em "hoje" ou
   * depois, e "atrasada" exige prazo ANTERIOR a hoje — as duas condições não
   * cabem na mesma tarefa do CPM. Por isso esta fica FORA do CPM (sem aresta
   * nenhuma), como `task-docs`.
   *
   * inicio 16/09 → prazo 18/09 → fim 28/09: o prazo está dentro da barra por
   * construção (as três datas são absolutas, a relação entre elas não muda).
   * O que muda com o calendário é a JANELA do zoom "Auto" (min(hoje−7, menor
   * início de barra)); nos zooms FIXOS a janela é ancorada no histórico
   * inteiro dos assuntos (03/08/2026) e cobre esta barra por ~420 dias. A
   * guarda mede os dois casos e REPROVA se a contagem voltar a zero — é essa
   * medida, e não este comentário, que impede a cobertura de sumir em
   * silêncio outra vez.
   */
  makeTask("task-migracao", { s1: 3, s2: 2, s3: 2 }, {
    title: "Migrar a tabela de leituras",
    notes: "Atrasada: o prazo caiu no meio da execução",
    sourceId: sourceIdFor("gmail"),
    estimativaDias: 12,
    iniciadoEm: "2026-09-16T09:00:00.000Z",
    dueDate: "2026-09-18T00:00:00.000Z",
    updatedAt: "2026-09-16T09:00:00.000Z",
  }),

  // ── P6 (13/09/2026) — subtarefa de demonstração da página da tarefa ───────
  // Filha de task-build, SEM predecessor/successor: fica fora dos ancestrais
  // do goal (task-deploy), então não entra no caminho crítico nem muda
  // `duracaoTotal` (continua 4 — prova em caminho-critico.test.ts). Tem
  // `estimativaDias` própria só para não aparecer em `semDuracao` à toa.
  makeTask("task-build-sub1", { s1: 1, s2: 1, s3: 1 }, {
    title: "Revisar testes do motor HIERARQ",
    parentId: "task-build",
    sourceId: sourceIdFor("notes"),
    estimativaDias: 0.5,
    assimetria: { opcionalidade: 1, esforco: 1, custo: 1 },
  }),
];

/**
 * v3 — uma aresta de cada tipo declarado, para o grafo e os testes exercitarem
 * as quatro camadas. A cadeia setup → build → deploy continua vindo dos arrays
 * (`predecessorIds`); aqui só o que os arrays não sabem dizer.
 */
export const FIXTURE_EDGES: readonly TaskEdge[] = [
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
    origem: "task-triage-inbox",
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

export const FIXTURE_NOTES: readonly TaskNote[] = [
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
  // P6 (13/09/2026) — 3ª nota de task-build, para a página da tarefa ter mais
  // de uma nota de origens diferentes na tela de demonstração.
  {
    id: "note-build-3",
    taskId: "task-build",
    texto: "Página da tarefa (P6) testada contra este fixture.",
    autor: "Claude",
    createdAt: "2026-07-09T12:30:00.000Z",
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
