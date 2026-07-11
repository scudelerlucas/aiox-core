/**
 * OS-LIFEBOARD — Fábrica de clientes de fonte (architecture.md §5.2, o flip mecânico).
 *
 * ÚNICO ponto que decide fixture vs live, lendo config validada (`@/config/env`).
 * Trocar para produção = `LIFEBOARD_DATA_MODE=live` + credenciais reais (camada G):
 * NENHUMA linha de lógica de negócio (normalize/filter) muda. Rejeitado espalhar
 * `if (mock)` pelos adapters (viola o flip mecânico) — a decisão fica centralizada aqui.
 *
 * Nesta rodada (default 'fixture'), as três fábricas devolvem os clientes de fixture.
 * Os clientes `*.mcp.ts` são `import 'server-only'` e PAUSADOS — instanciados só no
 * ramo 'live', após a revisão manual da manhã.
 */

import { FixtureCalendarClient } from "@/adapters/calendar/client.fixture";
import { McpCalendarClient } from "@/adapters/calendar/client.mcp";
import type { CalendarClient } from "@/adapters/calendar/client";
import { FixtureDriveClient } from "@/adapters/drive/client.fixture";
import { McpDriveClient } from "@/adapters/drive/client.mcp";
import type { DriveClient } from "@/adapters/drive/client";
import { FixtureGmailClient } from "@/adapters/gmail/client.fixture";
import { McpGmailClient } from "@/adapters/gmail/client.mcp";
import type { GmailClient } from "@/adapters/gmail/client";
import { env } from "@/config/env";

function isLive(): boolean {
  return env.LIFEBOARD_DATA_MODE === "live";
}

export function createCalendarClient(): CalendarClient {
  return isLive() ? new McpCalendarClient() : new FixtureCalendarClient();
}

export function createGmailClient(): GmailClient {
  return isLive() ? new McpGmailClient() : new FixtureGmailClient();
}

export function createDriveClient(): DriveClient {
  return isLive() ? new McpDriveClient() : new FixtureDriveClient();
}
