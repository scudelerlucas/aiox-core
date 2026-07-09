/**
 * OS-LIFEBOARD — Teste de INTEGRAÇÃO do sync (architecture.md §10).
 *
 * Cobre o path de dados desta rodada ponta-a-ponta, com FIXTURES:
 *   Fixture Client → Adapter.normalize → Repository (mock in-memory) → HIERARQ
 *
 * Autor: Quinn (@qa) · escrito no gate E1→E5 para fechar a lacuna de integração
 * apontada em architecture.md §10 (a suíte pré-existente só tinha unit tests).
 *
 * Stress tests do PRD §11 cobertos aqui:
 *   • Stress 2 (fluxo até "hoje"): schema vazio → ingestão das 3 fontes Google
 *     (fixture) → normalização → repo → motor HIERARQ → lista "hoje" correta.
 *   • Stress 4 (degradação graciosa): uma fonte (Drive) falha no sync → o
 *     dashboard segue de pé com as demais + flag de desatualização ('error').
 *
 * Observação de fronteira: como não há `/api/sync` nem `lib/repositories/tasks.ts`
 * (Supabase real) nesta rodada, o ORQUESTRADOR de sync é montado aqui, refletindo
 * fielmente o fluxo documentado em architecture.md §5.2 (per-source try/catch,
 * upsert idempotente por (sourceId, externalRef), sync_log por fonte).
 */

import { describe, expect, it } from "vitest";

import { FixtureCalendarClient } from "@/adapters/calendar/client.fixture";
import { calendarAdapter } from "@/adapters/calendar/normalize";
import { FixtureDriveClient } from "@/adapters/drive/client.fixture";
import { driveAdapter } from "@/adapters/drive/normalize";
import { FixtureGmailClient } from "@/adapters/gmail/client.fixture";
import { gmailAdapter } from "@/adapters/gmail/normalize";
import type { SourceAdapter, SourceClient } from "@/adapters/types";
import { deterministicId } from "@/adapters/id";
import { buildTodayList } from "@/core/prioritize/today";
import { computeSourceStatuses } from "@/lib/source-status";
import type {
  Project,
  Source,
  SourceKind,
  SyncLog,
  Task,
} from "@/types/canonical";

// ---------------------------------------------------------------------------
// Infra de teste: repositório mock in-memory + orquestrador de sync
// ---------------------------------------------------------------------------

/** Repo mock: upsert idempotente por (sourceId, externalRef) — arch §5.1. */
class MockTasksRepository {
  private readonly byKey = new Map<string, Task>();
  private readonly projectsByKey = new Map<string, Project>();

  upsert(projects: Project[], tasks: Task[]): void {
    for (const p of projects) {
      this.projectsByKey.set(`${p.sourceId}::${p.externalRef}`, { ...p });
    }
    for (const t of tasks) {
      this.byKey.set(`${t.sourceId}::${t.externalRef}`, { ...t });
    }
  }

  listAll(): Task[] {
    return [...this.byKey.values()];
  }

  listProjects(): Project[] {
    return [...this.projectsByKey.values()];
  }
}

interface SourceSyncSpec<Raw> {
  kind: SourceKind;
  client: SourceClient<Raw>;
  adapter: SourceAdapter<Raw>;
}

interface SyncOutcome {
  repo: MockTasksRepository;
  syncLogs: SyncLog[];
  sources: Source[];
}

const sourceIdFor = (kind: SourceKind): string => deterministicId("source", kind);

/**
 * Orquestra o sync das fontes fornecidas: cada fonte roda ISOLADA em try/catch
 * (degradação graciosa, PRD §9). Falha em uma NÃO derruba as demais; grava
 * `sync_log.ok=false` e mantém o último estado bom das outras.
 */
async function orchestrateSync(
  specs: Array<SourceSyncSpec<unknown>>,
  runAt = "2026-07-09T06:00:00.000Z",
): Promise<SyncOutcome> {
  const repo = new MockTasksRepository();
  const syncLogs: SyncLog[] = [];
  const sources: Source[] = [];

  for (const spec of specs) {
    const sourceId = sourceIdFor(spec.kind);
    try {
      const raw = await spec.client.fetchRaw();
      const { projects, tasks } = spec.adapter.normalize(raw);
      repo.upsert(projects, tasks);
      syncLogs.push({
        id: `sync-${spec.kind}`,
        sourceId,
        runAt,
        itemsIngested: tasks.length,
        ok: true,
        error: null,
      });
      sources.push({
        id: sourceId,
        kind: spec.kind,
        label: spec.kind,
        authMode: "api",
        lastSyncAt: runAt,
      });
    } catch (error) {
      // Degradação graciosa: registra a falha, segue para a próxima fonte.
      syncLogs.push({
        id: `sync-${spec.kind}`,
        sourceId,
        runAt,
        itemsIngested: 0,
        ok: false,
        error: error instanceof Error ? error.message : "desconhecido",
      });
      sources.push({
        id: sourceId,
        kind: spec.kind,
        label: spec.kind,
        authMode: "api",
        lastSyncAt: null, // nunca sincronizou com sucesso
      });
    }
  }

  return { repo, syncLogs, sources };
}

const googleSpecs = (): Array<SourceSyncSpec<unknown>> => [
  {
    kind: "calendar",
    client: new FixtureCalendarClient(),
    adapter: calendarAdapter,
  } as SourceSyncSpec<unknown>,
  {
    kind: "gmail",
    client: new FixtureGmailClient(),
    adapter: gmailAdapter,
  } as SourceSyncSpec<unknown>,
  {
    kind: "drive",
    client: new FixtureDriveClient(),
    adapter: driveAdapter,
  } as SourceSyncSpec<unknown>,
];

// ---------------------------------------------------------------------------
// Stress 2 — fluxo até "hoje": schema vazio → 3 fontes Google → grafo → "hoje"
// ---------------------------------------------------------------------------

describe("PRD §11 stress-2 — fluxo fixture→adapter→repo→HIERARQ até 'hoje'", () => {
  it("parte de um repo vazio (schema vazio simulado)", () => {
    const repo = new MockTasksRepository();
    expect(repo.listAll()).toHaveLength(0);
    expect(buildTodayList(repo.listAll()).items).toHaveLength(0);
  });

  it("ingere as 3 fontes Google e normaliza para o modelo canônico", async () => {
    const { repo, syncLogs } = await orchestrateSync(googleSpecs());
    const tasks = repo.listAll();

    // Calendar: 4 eventos → filtro Lucas|LS aceita 3 (rejeita o 'Daily do time').
    // Gmail: 3 threads → 2 com label Projeto/*. Drive: 3 arquivos → 3 tasks.
    // Total = 3 + 2 + 3 = 8 tarefas canônicas.
    expect(tasks).toHaveLength(8);
    expect(syncLogs.every((l) => l.ok)).toBe(true);

    // O evento "LS" de agenda de TERCEIRO foi capturado (PRD §4, regra Lucas|LS).
    const titles = tasks.map((t) => t.title);
    expect(titles).toContain("Review de campanha [LS]");
    // O evento sem Lucas/LS foi descartado pelo filtro.
    expect(titles).not.toContain("Daily do time de design");
    // A newsletter de Gmail (sem label de projeto) foi descartada.
    expect(titles).not.toContain("Newsletter semanal de novidades");

    // Cada fonte contribuiu com o sourceId canônico esperado.
    const bySource = new Map<string, number>();
    for (const t of tasks)
      bySource.set(t.sourceId, (bySource.get(t.sourceId) ?? 0) + 1);
    expect(bySource.get(sourceIdFor("calendar"))).toBe(3);
    expect(bySource.get(sourceIdFor("gmail"))).toBe(2);
    expect(bySource.get(sourceIdFor("drive"))).toBe(3);
  });

  it("o motor HIERARQ monta a lista 'hoje' sobre o estado ingerido", async () => {
    const { repo } = await orchestrateSync(googleSpecs());
    const today = buildTodayList(repo.listAll());

    // Sem dependências declaradas (sync não infere — PRD §5.3), todas as 8 tarefas
    // são acionáveis, nenhuma bloqueada, nenhum ciclo → "hoje" tem as 8.
    expect(today.items).toHaveLength(8);
    expect(today.excludedCycles).toHaveLength(0);
    // Toda tarefa da lista carrega uma justificativa curta (PRD §4).
    expect(today.items.every((i) => i.reason.length > 0)).toBe(true);
  });

  it("é idempotente: rodar o sync 2× não duplica (chave (sourceId, externalRef))", async () => {
    const repo = new MockTasksRepository();
    for (let i = 0; i < 2; i++) {
      for (const spec of googleSpecs()) {
        const raw = await spec.client.fetchRaw();
        const { projects, tasks } = spec.adapter.normalize(raw);
        repo.upsert(projects, tasks);
      }
    }
    expect(repo.listAll()).toHaveLength(8); // não 16
  });

  it("declarar prioridade/dependência muda a ordem 'hoje' sem re-sync (curadoria)", async () => {
    const { repo } = await orchestrateSync(googleSpecs());
    // Simula a curadoria declarada (PRD §5.3): eleva 1 tarefa e encadeia outra.
    const tasks = repo.listAll();
    const top = tasks[0]!;
    const dependent = tasks[1]!;
    top.priorityHierarq = { s1: 5, s2: 5, s3: 5 }; // S=125
    dependent.predecessorIds = [top.id]; // depende do topo (ainda aberto)

    const today = buildTodayList(tasks);
    // O topo declarado lidera a lista "hoje".
    expect(today.items[0]?.task.id).toBe(top.id);
    // A dependente fica FORA de "hoje" (predecessor aberto) — respeita o grafo.
    expect(today.items.map((i) => i.task.id)).not.toContain(dependent.id);
  });
});

// ---------------------------------------------------------------------------
// Stress 4 — degradação graciosa: Drive falha, dashboard segue + flag 'error'
// ---------------------------------------------------------------------------

/** Cliente Drive que FALHA (simula MCP timeout / conector indisponível). */
class FailingDriveClient implements SourceClient<never> {
  readonly kind = "drive" as const;
  readonly mode = "live" as const;
  async fetchRaw(): Promise<never[]> {
    throw new Error("Drive MCP timeout após 30s (conector indisponível)");
  }
}

describe("PRD §11 stress-4 — uma fonte falha, o resto segue de pé + flag", () => {
  const specsWithFailingDrive = (): Array<SourceSyncSpec<unknown>> => [
    {
      kind: "calendar",
      client: new FixtureCalendarClient(),
      adapter: calendarAdapter,
    } as SourceSyncSpec<unknown>,
    {
      kind: "gmail",
      client: new FixtureGmailClient(),
      adapter: gmailAdapter,
    } as SourceSyncSpec<unknown>,
    {
      kind: "drive",
      client: new FailingDriveClient(),
      adapter: driveAdapter,
    } as SourceSyncSpec<unknown>,
  ];

  it("a falha do Drive NÃO derruba o sync das outras fontes", async () => {
    const { repo, syncLogs } = await orchestrateSync(specsWithFailingDrive());
    const tasks = repo.listAll();

    // Calendar (3) + Gmail (2) ingeriram; Drive (0) falhou → 5 tarefas.
    expect(tasks).toHaveLength(5);
    const bySource = new Map<string, number>();
    for (const t of tasks)
      bySource.set(t.sourceId, (bySource.get(t.sourceId) ?? 0) + 1);
    expect(bySource.get(sourceIdFor("calendar"))).toBe(3);
    expect(bySource.get(sourceIdFor("gmail"))).toBe(2);
    expect(bySource.has(sourceIdFor("drive"))).toBe(false);

    // O sync_log registra a falha isolada do Drive.
    const driveLog = syncLogs.find((l) => l.sourceId === sourceIdFor("drive"));
    expect(driveLog?.ok).toBe(false);
    expect(driveLog?.error).toContain("timeout");
    // As demais fontes seguem ok.
    expect(
      syncLogs.filter((l) => l.sourceId !== sourceIdFor("drive")).every((l) => l.ok),
    ).toBe(true);
  });

  it("o dashboard mostra a flag 'fonte desatualizada' (severity 'error') no Drive", async () => {
    const runAt = "2026-07-09T06:00:00.000Z";
    const { repo, syncLogs, sources } = await orchestrateSync(
      specsWithFailingDrive(),
      runAt,
    );
    // `now` explícito (= instante do sync) → determinístico, independe do relógio:
    // calendar/gmail sincronizaram agora (age 0 → saudável); Drive é 'error' por
    // ok=false, independente de tempo.
    const statuses = computeSourceStatuses(
      sources,
      syncLogs,
      repo.listAll(),
      Date.parse(runAt),
    );

    const drive = statuses.find((s) => s.kind === "drive");
    expect(drive?.severity).toBe("error");
    expect(drive?.lastError).toContain("timeout");
    expect(drive?.taskCount).toBe(0);

    // Calendar e Gmail permanecem saudáveis e com contagem correta.
    const calendar = statuses.find((s) => s.kind === "calendar");
    const gmail = statuses.find((s) => s.kind === "gmail");
    expect(calendar?.severity).toBeNull();
    expect(calendar?.taskCount).toBe(3);
    expect(gmail?.severity).toBeNull();
    expect(gmail?.taskCount).toBe(2);
  });

  it("a lista 'hoje' segue funcionando só com as fontes sãs", async () => {
    const { repo } = await orchestrateSync(specsWithFailingDrive());
    const today = buildTodayList(repo.listAll());
    // 5 tarefas sãs (calendar+gmail), todas acionáveis, serviço de pé.
    expect(today.items).toHaveLength(5);
    expect(today.excludedCycles).toHaveLength(0);
  });
});
