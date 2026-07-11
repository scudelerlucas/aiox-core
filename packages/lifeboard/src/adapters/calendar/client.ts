/**
 * OS-LIFEBOARD — Port do adapter de Calendar (architecture.md §5.2).
 *
 * `CalendarClient` é a port de I/O específica: busca `RawCalendarEvent[]` das
 * agendas (read-only). Duas implementações: `client.fixture.ts` (ativa) e
 * `client.mcp.ts` (PROD, PAUSADA). O flip é mecânico via `factory.ts`.
 */

import type { SourceClient } from "@/adapters/types";
import type { RawCalendarEvent } from "@/types/raw";

export type CalendarClient = SourceClient<RawCalendarEvent>;
