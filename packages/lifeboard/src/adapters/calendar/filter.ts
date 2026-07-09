/**
 * OS-LIFEBOARD — Filtro de Calendar (PRD §4 / architecture.md §5.1).
 *
 * Regra: aceita SÓ eventos cujo TÍTULO ou DESCRIÇÃO contenham o nome "Lucas" OU a
 * sigla "LS" — inclusive em agendas de TERCEIROS. É o que permite capturar um
 * evento de uma agenda que não é de Lucas mas que o marca via "LS".
 *
 * Decisões de matching (documentadas em vez de perguntar — modo semi sem gate):
 *  - Nome "Lucas": case-insensitive, borda de palavra (`\bLucas\b`). Não casa
 *    substrings acidentais.
 *  - Sigla "LS": token isolado por borda de palavra e CASE-SENSITIVE maiúsculo
 *    (`\bLS\b`). Case-sensitive evita falso positivo em palavras minúsculas que
 *    contenham "ls" (ex.: "controls", "detalhes"); a borda evita casar dentro de
 *    palavras como "LSD" ou "HTMLS".
 */

import type { RawCalendarEvent } from "@/types/raw";

const LUCAS_NAME = /\blucas\b/i;
const LS_SIGLA = /\bLS\b/;

/** True se o evento contém o nome de Lucas OU a sigla LS no título/descrição. */
export function matchesLucasOrLS(event: RawCalendarEvent): boolean {
  const haystack = `${event.title}\n${event.description ?? ""}`;
  return LUCAS_NAME.test(haystack) || LS_SIGLA.test(haystack);
}

/** Aplica o filtro Lucas|LS, preservando a ordem original. */
export function filterCalendarEvents(events: RawCalendarEvent[]): RawCalendarEvent[] {
  return events.filter(matchesLucasOrLS);
}
