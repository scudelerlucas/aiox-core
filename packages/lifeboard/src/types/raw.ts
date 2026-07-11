/**
 * OS-LIFEBOARD — Tipos crus por fonte (architecture.md §5.1, tabela
 * "Como cada adapter normaliza para o modelo canônico").
 *
 * Um `SourceClient<Raw>` (I/O — fixture ou MCP) devolve `Raw[]`; a função pura
 * `normalize(raw)` converte para `{ projects, tasks }` canônicos. Esses tipos são
 * a fronteira exata entre a transcrição MCP→Raw (isolada em `client.mcp.ts`) e a
 * lógica de normalização testável (mesma em fixture e live).
 */

/** Calendar: 1 task por evento; dueDate = start; externalRef = eventId. */
export interface RawCalendarEvent {
  eventId: string; // id nativo do evento (externalRef / idempotência)
  calendarId: string; // id da agenda (própria de Lucas OU de terceiro)
  calendarLabel: string; // nome legível da agenda → vira title do projeto
  title: string; // título do evento (entra no filtro Lucas|LS)
  description: string | null; // descrição (também entra no filtro)
  start: string; // ISO — vira dueDate da task
  end: string; // ISO
  organizer: string | null; // e-mail do organizador (evidência de terceiro)
}

/** Gmail: 1 task por thread marcada; dueDate = null; externalRef = threadId. */
export interface RawGmailThread {
  threadId: string; // id nativo da thread (externalRef)
  subject: string; // assunto → title da task
  labels: string[]; // labels aplicadas; filtro usa label de projeto
  snippet: string; // trecho → notes da task
}

/** Drive: 1 task por arquivo relevante; externalRef = fileId; updatedAt = modifiedTime. */
export interface RawDriveFile {
  fileId: string; // id nativo do arquivo (externalRef)
  name: string; // nome do arquivo → title da task
  folder: string; // pasta de projeto → title do projeto
  modifiedTime: string; // ISO — vira updatedAt
}
