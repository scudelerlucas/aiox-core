/**
 * OS-LIFEBOARD — Cliente FIXTURE de Calendar (ATIVO nesta rodada).
 *
 * Lê `tests/fixtures/calendar/*.json` (dados sintéticos, inclui evento "LS" de
 * agenda de terceiro). É a MESMA classe usada em dev-com-fixture e na suíte Vitest
 * — zero divergência dev/test (architecture.md §5.2). Não importa `server-only`:
 * é seguro rodar em qualquer ambiente de teste.
 */

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import type { CalendarClient } from "@/adapters/calendar/client";
import type { RawCalendarEvent } from "@/types/raw";

const FIXTURE_DIR = path.resolve(process.cwd(), "tests/fixtures/calendar");

export class FixtureCalendarClient implements CalendarClient {
  readonly kind = "calendar" as const;
  readonly mode = "fixture" as const;

  async fetchRaw(): Promise<RawCalendarEvent[]> {
    const files = (await readdir(FIXTURE_DIR))
      .filter((f) => f.endsWith(".json"))
      .sort();
    const all: RawCalendarEvent[] = [];
    for (const file of files) {
      const content = await readFile(path.join(FIXTURE_DIR, file), "utf8");
      const parsed = JSON.parse(content) as RawCalendarEvent[] | RawCalendarEvent;
      if (Array.isArray(parsed)) all.push(...parsed);
      else all.push(parsed);
    }
    return all;
  }
}
