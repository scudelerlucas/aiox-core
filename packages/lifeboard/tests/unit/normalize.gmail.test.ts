import { describe, expect, it } from "vitest";
import { FixtureGmailClient } from "@/adapters/gmail/client.fixture";
import { normalizeGmail } from "@/adapters/gmail/normalize";

describe("normalizeGmail — Raw → {projects, tasks}", () => {
  it("ingere só threads com label de projeto; descarta as demais", async () => {
    const raw = await new FixtureGmailClient().fetchRaw();
    const { projects, tasks } = normalizeGmail(raw);

    // 3 threads na fixture; 1 (Promoções, sem label de projeto) é descartada.
    expect(tasks).toHaveLength(2);

    const refs = tasks.map((t) => t.externalRef);
    expect(refs).toContain("thr-almapetra-001");
    expect(refs).toContain("thr-lifeboard-001");
    expect(refs).not.toContain("thr-newsletter-001");

    // 1 projeto por label de projeto.
    expect(projects).toHaveLength(2);
    expect(projects.map((p) => p.externalRef).sort()).toEqual([
      "Projeto/AlmaPetra",
      "Projeto/Lifeboard",
    ]);
  });

  it("mapeia campos canônicos (dueDate = null, externalRef = threadId)", async () => {
    const raw = await new FixtureGmailClient().fetchRaw();
    const { tasks } = normalizeGmail(raw);
    const t = tasks.find((x) => x.externalRef === "thr-almapetra-001");
    expect(t).toBeDefined();
    expect(t?.title).toBe("Contrato ALMA PETRA — revisão final");
    expect(t?.dueDate).toBeNull();
    expect(t?.status).toBe("open");
  });

  it("idempotência: normalizar 2× é idêntico; externalRefs únicos", async () => {
    const raw = await new FixtureGmailClient().fetchRaw();
    const a = normalizeGmail(raw);
    const b = normalizeGmail(raw);
    expect(a).toEqual(b);

    const refs = a.tasks.map((t) => t.externalRef);
    expect(new Set(refs).size).toBe(refs.length);
  });
});
