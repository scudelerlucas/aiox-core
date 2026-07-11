/**
 * OS-LIFEBOARD — Normalização de Drive (camada R, PURA).
 *
 * `RawDriveFile[]` → `{ projects, tasks }` (architecture.md §5.1):
 *  - 1 projeto por pasta de projeto (`folder`); `externalRef` do projeto = folder.
 *  - 1 task por arquivo relevante; `externalRef = fileId`; `updatedAt = modifiedTime`.
 *
 * Idempotência `(sourceId, externalRef)` via ids determinísticos.
 */

import { deterministicId } from "@/adapters/id";
import type { SourceAdapter } from "@/adapters/types";
import { DEFAULT_HIERARQ, type Project, type Task } from "@/types/canonical";
import type { RawDriveFile } from "@/types/raw";

const KIND = "drive" as const;
const SOURCE_ID = deterministicId("source", KIND);

export function normalizeDrive(raw: RawDriveFile[]): {
  projects: Project[];
  tasks: Task[];
} {
  const projects = new Map<string, Project>();
  const tasks: Task[] = [];

  for (const file of raw) {
    const projectId = deterministicId(`${KIND}:project`, file.folder);
    if (!projects.has(projectId)) {
      projects.set(projectId, {
        id: projectId,
        sourceId: SOURCE_ID,
        externalRef: file.folder,
        title: file.folder,
        status: "active",
        updatedAt: file.modifiedTime,
      });
    }

    tasks.push({
      id: deterministicId(`${KIND}:task`, file.fileId),
      projectId,
      title: file.name,
      notes: null,
      dueDate: null,
      status: "open",
      priorityHierarq: { ...DEFAULT_HIERARQ },
      predecessorIds: [],
      successorIds: [],
      sourceId: SOURCE_ID,
      externalRef: file.fileId,
      updatedAt: file.modifiedTime,
    });
  }

  return { projects: [...projects.values()], tasks };
}

export const driveAdapter: SourceAdapter<RawDriveFile> = {
  kind: KIND,
  normalize: normalizeDrive,
};
