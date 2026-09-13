import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SourceFilter } from "@/components/dashboard/source-filter";
import { TodayList } from "@/components/dashboard/today-list";
import { SourceIcon } from "@/components/ui/source-icon";
import { StatusChip } from "@/components/ui/status-chip";
import type { Source, SourceKind, Task, TaskStatus } from "@/types/canonical";

/**
 * Regressão de 13/09/2026 — a home devolvia HTTP 500 ("Element type is invalid:
 * expected a string … but got: undefined") porque um valor vindo do Postgres
 * (`sources.kind = "lms"`, a Cativa) não estava na união TypeScript, o mapa de
 * ícones devolvia `undefined` e o `<Icon/>` derrubava a árvore inteira.
 *
 * O teste renderiza a árvore de verdade (React server render) com a FORMA do
 * banco vivo — inclusive valores fora da união — em vez de testar só a função
 * de lookup. Antes da correção este arquivo falha; depois, passa.
 */

const FONTE_FORA_DA_UNIAO = "lms";
const ESTADO_FORA_DA_UNIAO = "arquivada";

function fonte(id: string, kind: string, label: string): Source {
  return {
    id,
    kind: kind as SourceKind,
    label,
    authMode: "manual",
    lastSyncAt: null,
  };
}

function tarefa(id: string, sourceId: string, status: string): Task {
  return {
    id,
    projectId: `proj-${id}`,
    title: `Tarefa ${id}`,
    notes: null,
    dueDate: null,
    status: status as TaskStatus,
    priorityHierarq: { s1: 2, s2: 2, s3: 2 },
    predecessorIds: [],
    successorIds: [],
    sourceId,
    externalRef: `ext-${id}`,
    updatedAt: "2026-09-13T00:00:00.000Z",
  };
}

/** Espelha `public.sources` em 13/09/2026: 3 `calendar` + 1 `lms`. */
const FONTES: Source[] = [
  fonte("s-1", "calendar", "Pandora Lucas"),
  fonte("s-2", "calendar", "Casa"),
  fonte("s-3", "calendar", "Alma Petra"),
  fonte("s-4", FONTE_FORA_DA_UNIAO, "Cativa"),
];

describe("render da home com a forma do banco vivo", () => {
  it("renderiza a lista de hoje com uma fonte fora da união (`lms`)", () => {
    const items = FONTES.map((f, i) => ({
      task: tarefa(`t-${i}`, f.id, "open"),
      reason: "ordem do HIERARQ",
    }));

    const html = renderToStaticMarkup(
      <TodayList items={items} sources={FONTES} />,
    );

    expect(html).toContain("Cativa");
    expect(html).not.toContain("undefined");
  });

  it("renderiza a lista de hoje com um estado de tarefa fora da união", () => {
    const items = [
      {
        task: tarefa("t-x", "s-4", ESTADO_FORA_DA_UNIAO),
        reason: "ordem do HIERARQ",
      },
    ];

    const html = renderToStaticMarkup(
      <TodayList items={items} sources={FONTES} />,
    );

    expect(html).toContain("sem estado");
  });

  it("renderiza o filtro de fontes com a fonte fora da união", () => {
    const html = renderToStaticMarkup(
      <SourceFilter
        options={FONTES.map((f) => ({
          kind: f.kind,
          label: f.label,
          count: 1,
        }))}
        selected={[]}
        onChange={() => undefined}
      />,
    );

    expect(html).toContain("Cativa");
  });

  it("os dois componentes-folha aguentam qualquer texto vindo do banco", () => {
    for (const valor of [FONTE_FORA_DA_UNIAO, "hotmart", "", "LMS"]) {
      expect(() =>
        renderToStaticMarkup(
          <SourceIcon kind={valor as SourceKind} label={valor} />,
        ),
      ).not.toThrow();
    }
    for (const valor of [ESTADO_FORA_DA_UNIAO, "cancelled", "", "DONE"]) {
      expect(() =>
        renderToStaticMarkup(<StatusChip status={valor as TaskStatus} />),
      ).not.toThrow();
    }
  });
});
