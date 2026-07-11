/**
 * OS-LIFEBOARD · E5 — Tempo relativo em pt-BR para as flags de staleness (spec §6).
 *
 * PURO (sem I/O). Aceita um `now` injetável para determinismo em teste/SSR — o
 * default é `Date.now()`. Formatação sóbria: "há 2 dias", "há 3 h", "agora".
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function formatRelativeTime(
  iso: string | null,
  now: number = Date.now(),
): string {
  if (!iso) return "nunca sincronizada";
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "data desconhecida";

  const diff = Math.max(0, now - then);
  if (diff < MINUTE) return "agora mesmo";
  if (diff < HOUR) {
    const m = Math.round(diff / MINUTE);
    return `há ${m} min`;
  }
  if (diff < DAY) {
    const h = Math.round(diff / HOUR);
    return `há ${h} h`;
  }
  const d = Math.round(diff / DAY);
  return d === 1 ? "há 1 dia" : `há ${d} dias`;
}
