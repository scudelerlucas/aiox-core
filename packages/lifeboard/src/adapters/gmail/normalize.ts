/**
 * OS-LIFEBOARD — Normalização de Gmail (camada R, PURA).
 *
 * `RawGmailThread[]` → `{ projects, tasks }` (architecture.md §5.1):
 *  - Só threads COM label de projeto (`Projeto/...`) viram task; as demais são
 *    descartadas.
 *  - 1 projeto por label de projeto; `externalRef` do projeto = a própria label.
 *  - 1 task por thread marcada; `dueDate = null`; `externalRef = threadId`.
 *
 * Idempotência `(sourceId, externalRef)` via ids determinísticos.
 */

import { deterministicId } from "@/adapters/id";
import { projectLabelOf } from "@/adapters/gmail/client";
import type { SourceAdapter } from "@/adapters/types";
import { DEFAULT_HIERARQ, type Project, type Task } from "@/types/canonical";
import type { RawGmailThread } from "@/types/raw";

const KIND = "gmail" as const;
const SOURCE_ID = deterministicId("source", KIND);

export function normalizeGmail(raw: RawGmailThread[]): {
  projects: Project[];
  tasks: Task[];
} {
  const projects = new Map<string, Project>();
  const tasks: Task[] = [];

  for (const thread of raw) {
    const label = projectLabelOf(thread.labels);
    if (label === null) continue; // sem label de projeto → não ingere

    const projectId = deterministicId(`${KIND}:project`, label);
    if (!projects.has(projectId)) {
      projects.set(projectId, {
        id: projectId,
        sourceId: SOURCE_ID,
        externalRef: label,
        title: label.slice(label.indexOf("/") + 1),
        status: "active",
        updatedAt: thread.threadId, // sem timestamp nativo; estável por thread
      });
    }

    tasks.push({
      id: deterministicId(`${KIND}:task`, thread.threadId),
      projectId,
      title: thread.subject,
      notes: thread.snippet,
      dueDate: null,
      status: "open",
      priorityHierarq: { ...DEFAULT_HIERARQ },
      predecessorIds: [],
      successorIds: [],
      sourceId: SOURCE_ID,
      externalRef: thread.threadId,
      updatedAt: thread.threadId,
    });
  }

  return { projects: [...projects.values()], tasks };
}

export const gmailAdapter: SourceAdapter<RawGmailThread> = {
  kind: KIND,
  normalize: normalizeGmail,
};
