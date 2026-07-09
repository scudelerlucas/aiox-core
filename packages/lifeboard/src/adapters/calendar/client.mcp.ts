import "server-only";
/**
 * OS-LIFEBOARD — Cliente REAL (MCP) de Calendar — ⚠️ PAUSADO NESTA RODADA.
 *
 * NÃO é exercido por nenhum teste desta rodada (fixture-only). O código abaixo é o
 * esqueleto funcional correto da implementação de produção: em `LIFEBOARD_DATA_MODE=
 * live`, a `factory` instancia esta classe, que consome o MCP `mcp__Google_Calendar__*`
 * (via `lib/mcp/google.ts`, credenciais da camada G) e mapeia cada evento de TODAS
 * as agendas para `RawCalendarEvent`. Read-only, zero escrita na fonte.
 *
 * `import 'server-only'` no topo (kill-switch nº 3 do PRD): garante em tempo de
 * build que credenciais/leitura de fonte crua NUNCA entram no bundle client.
 *
 * A troca fixture→live é MECÂNICA: `LIFEBOARD_DATA_MODE=live` + credenciais reais.
 * Nenhuma linha de lógica de negócio (normalize/filter) muda — só a origem do Raw.
 */

import type { CalendarClient } from "@/adapters/calendar/client";
import type { RawCalendarEvent } from "@/types/raw";

export class McpCalendarClient implements CalendarClient {
  readonly kind = "calendar" as const;
  readonly mode = "live" as const;

  async fetchRaw(): Promise<RawCalendarEvent[]> {
    // PAUSADO: implementação de produção (revisão manual da manhã).
    // Esqueleto do fluxo real:
    //   1. listar agendas do usuário  → mcp__Google_Calendar__list_calendars
    //   2. para cada agenda, listar eventos na janela desejada
    //        → mcp__Google_Calendar__list_events (calendarId)
    //   3. mapear cada evento nativo → RawCalendarEvent:
    //        { eventId, calendarId, calendarLabel, title, description,
    //          start, end, organizer }
    //   4. devolver o agregado (o filtro Lucas|LS roda depois, em normalize).
    throw new Error(
      "McpCalendarClient PAUSADO nesta rodada (E2 fixture-only). " +
        "Ative com LIFEBOARD_DATA_MODE=live após conectar credenciais Google reais.",
    );
  }
}
