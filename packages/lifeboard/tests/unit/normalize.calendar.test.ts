import { describe, expect, it } from "vitest";
import { FixtureCalendarClient } from "@/adapters/calendar/client.fixture";
import { matchesLucasOrLS } from "@/adapters/calendar/filter";
import { normalizeCalendar } from "@/adapters/calendar/normalize";
import type { RawCalendarEvent } from "@/types/raw";

function ev(partial: Partial<RawCalendarEvent>): RawCalendarEvent {
  return {
    eventId: "e",
    calendarId: "c",
    calendarLabel: "Cal",
    title: "",
    description: null,
    start: "2026-07-10T09:00:00-03:00",
    end: "2026-07-10T10:00:00-03:00",
    organizer: null,
    ...partial,
  };
}

describe("calendar filter — regra Lucas | LS", () => {
  it("captura evento de agenda de TERCEIRO cujo título contém a sigla LS", () => {
    const thirdParty = ev({
      calendarId: "equipe@company.com",
      title: "Review de campanha [LS]",
      description: "sync do time",
    });
    expect(matchesLucasOrLS(thirdParty)).toBe(true);
  });

  it("captura pelo nome de Lucas (case-insensitive)", () => {
    expect(matchesLucasOrLS(ev({ title: "Call com lucas" }))).toBe(true);
    expect(matchesLucasOrLS(ev({ description: "Lembrete do Lucas" }))).toBe(true);
  });

  it("captura LS presente apenas na descrição", () => {
    expect(
      matchesLucasOrLS(ev({ title: "Reunião externa", description: "LS deve validar" })),
    ).toBe(true);
  });

  it("REJEITA evento sem nome nem sigla", () => {
    expect(
      matchesLucasOrLS(ev({ title: "Daily do time de design", description: "sync interno" })),
    ).toBe(false);
  });

  it("não casa 'LS' embutido em outra palavra nem 'ls' minúsculo solto", () => {
    expect(matchesLucasOrLS(ev({ title: "Deploy de HTMLS no server" }))).toBe(false);
    expect(matchesLucasOrLS(ev({ title: "revisar os detalhes finais" }))).toBe(false);
  });
});

describe("normalizeCalendar — Raw → {projects, tasks}", () => {
  it("normaliza a fixture: 3 tasks aceitas, nomatch excluído, 2 projetos", async () => {
    const raw = await new FixtureCalendarClient().fetchRaw();
    const { projects, tasks } = normalizeCalendar(raw);

    // 4 eventos na fixture; 1 (nomatch de terceiro) é filtrado → 3 tasks.
    expect(tasks).toHaveLength(3);

    const refs = tasks.map((t) => t.externalRef);
    // caso-chave: evento de agenda de terceiro com LS foi capturado
    expect(refs).toContain("evt-terceiro-ls-001");
    // prova negativa: evento de terceiro sem match foi rejeitado
    expect(refs).not.toContain("evt-terceiro-nomatch-001");

    // 1 projeto por agenda (lucas@primary + equipe-marketing@company.com)
    expect(projects).toHaveLength(2);
    expect(projects.map((p) => p.externalRef).sort()).toEqual([
      "equipe-marketing@company.com",
      "lucas@primary",
    ]);
  });

  it("mapeia campos canônicos corretamente (dueDate = start, externalRef = eventId)", async () => {
    const raw = await new FixtureCalendarClient().fetchRaw();
    const { tasks } = normalizeCalendar(raw);
    const ls = tasks.find((t) => t.externalRef === "evt-terceiro-ls-001");
    expect(ls).toBeDefined();
    expect(ls?.title).toBe("Review de campanha [LS]");
    expect(ls?.dueDate).toBe("2026-07-10T14:00:00-03:00");
    expect(ls?.status).toBe("open");
    expect(ls?.priorityHierarq).toEqual({ s1: 1, s2: 1, s3: 1 });
  });

  it("idempotência: normalizar 2× a mesma entrada é idêntico; externalRefs únicos", async () => {
    const raw = await new FixtureCalendarClient().fetchRaw();
    const a = normalizeCalendar(raw);
    const b = normalizeCalendar(raw);
    expect(a).toEqual(b); // ids determinísticos por (source, externalRef)

    const refs = a.tasks.map((t) => t.externalRef);
    expect(new Set(refs).size).toBe(refs.length);
  });
});
