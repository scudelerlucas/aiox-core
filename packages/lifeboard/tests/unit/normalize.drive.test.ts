import { describe, expect, it } from "vitest";
import { FixtureDriveClient } from "@/adapters/drive/client.fixture";
import { normalizeDrive } from "@/adapters/drive/normalize";

describe("normalizeDrive — Raw → {projects, tasks}", () => {
  it("1 task por arquivo, 1 projeto por pasta", async () => {
    const raw = await new FixtureDriveClient().fetchRaw();
    const { projects, tasks } = normalizeDrive(raw);

    // 3 arquivos em 2 pastas.
    expect(tasks).toHaveLength(3);
    expect(projects).toHaveLength(2);
    expect(projects.map((p) => p.externalRef).sort()).toEqual([
      "Projeto Alma Petra",
      "Projeto Lifeboard",
    ]);
  });

  it("mapeia campos canônicos (externalRef = fileId, updatedAt = modifiedTime)", async () => {
    const raw = await new FixtureDriveClient().fetchRaw();
    const { tasks } = normalizeDrive(raw);
    const t = tasks.find((x) => x.externalRef === "file-almapetra-roteiro");
    expect(t).toBeDefined();
    expect(t?.title).toBe("Roteiro-VSL.md");
    expect(t?.updatedAt).toBe("2026-07-08T12:00:00-03:00");
    expect(t?.dueDate).toBeNull();
  });

  it("idempotência: normalizar 2× é idêntico; externalRefs únicos", async () => {
    const raw = await new FixtureDriveClient().fetchRaw();
    const a = normalizeDrive(raw);
    const b = normalizeDrive(raw);
    expect(a).toEqual(b);

    const refs = a.tasks.map((t) => t.externalRef);
    expect(new Set(refs).size).toBe(refs.length);
  });
});
