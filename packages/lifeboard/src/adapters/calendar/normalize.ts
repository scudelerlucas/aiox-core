/**
 * OS-LIFEBOARD — Normalização de Calendar (camada R, PURA).
 *
 * `RawCalendarEvent[]` → `{ projects, tasks }` canônicos (architecture.md §5.1):
 *  - Aplica o filtro Lucas|LS ANTES de normalizar (só o que passou vira task).
 *  - 1 projeto por agenda (`calendarId`); `externalRef` do projeto = calendarId.
 *  - 1 task por evento; `dueDate = start`; `externalRef = eventId`.
 *  - `priorityHierarq`, `predecessorIds`, `successorIds` são DECLARADOS depois
 *    (Lucas/curadoria) — o sync nunca os sobrescreve; aqui saem no default neutro.
 *
 * Idempotência `(sourceId, externalRef)`: ids determinísticos ⇒ rodar 2× sobre a
 * mesma entrada produz saída idêntica (ver `@/adapters/id`).
 */

import { deterministicId } from "@/adapters/id";
import { filterCalendarEvents } from "@/adapters/calendar/filter";
import type { SourceAdapter } from "@/adapters/types";
import { DEFAULT_HIERARQ, type Project, type Task } from "@/types/canonical";
import type { RawCalendarEvent } from "@/types/raw";

const KIND = "calendar" as const;
/** sourceId estável da fonte Calendar (mapeia para a linha `sources` em prod). */
const SOURCE_ID = deterministicId("source", KIND);

export function normalizeCalendar(raw: RawCalendarEvent[]): {
  projects: Project[];
  tasks: Task[];
} {
  const accepted = filterCalendarEvents(raw);
  const projects = new Map<string, Project>();
  const tasks: Task[] = [];

  for (const ev of accepted) {
    const projectId = deterministicId(`${KIND}:project`, ev.calendarId);
    if (!projects.has(projectId)) {
      projects.set(projectId, {
        id: projectId,
        sourceId: SOURCE_ID,
        externalRef: ev.calendarId,
        title: ev.calendarLabel,
        status: "active",
        updatedAt: ev.start,
      });
    }

    tasks.push({
      id: deterministicId(`${KIND}:task`, ev.eventId),
      projectId,
      title: ev.title,
      notes: ev.description,
      dueDate: ev.start,
      status: "open",
      priorityHierarq: { ...DEFAULT_HIERARQ },
      predecessorIds: [],
      successorIds: [],
      sourceId: SOURCE_ID,
      externalRef: ev.eventId,
      updatedAt: ev.end,
    });
  }

  return { projects: [...projects.values()], tasks };
}

/** Adapter de Calendar como `SourceAdapter` (contrato §5.2). */
export const calendarAdapter: SourceAdapter<RawCalendarEvent> = {
  kind: KIND,
  normalize: normalizeCalendar,
};
