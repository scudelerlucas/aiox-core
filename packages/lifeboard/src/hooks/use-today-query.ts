"use client";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import type { TodayResponse } from "@/types/dashboard";

/**
 * OS-LIFEBOARD · E5 — Hook de leitura da lista "hoje" (spec §4.3).
 *
 * Gotcha "Fetch Error Handling" APLICADO: checa `response.ok` ANTES de `.json()`
 * (fetch não lança em 4xx/5xx). TanStack Query cobre race/cleanup (gotcha
 * "useEffect Cleanup"). `initialData` vem do server component (SSR) → render
 * imediato, sem flash de loading.
 */
async function fetchToday(): Promise<TodayResponse> {
  const res = await fetch("/api/today");
  if (!res.ok) {
    throw new Error(`/api/today respondeu ${res.status}`);
  }
  return (await res.json()) as TodayResponse;
}

export function useTodayQuery(
  initialData: TodayResponse,
): UseQueryResult<TodayResponse, Error> {
  return useQuery<TodayResponse, Error>({
    queryKey: ["today"],
    queryFn: fetchToday,
    initialData,
  });
}
