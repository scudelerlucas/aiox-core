/**
 * OS-LIFEBOARD · P4 — Serializador `ResultadoCPM` + scores → `GrafoV3Props`.
 *
 * Função PURA, sem `server-only`: só transforma dados já calculados (o cálculo em
 * si — `caminhoCritico`/`scoreAssimetriaLote` — continua exclusivo do servidor).
 * `critico`/`semDuracao`/`emCiclo` (Set/array) e `janelas`/`scores` (Map) viram
 * array/objeto simples — o único jeito de atravessar o limite Server → Client
 * Component do Next (RSC só serializa JSON-plain).
 */

import type { ResultadoCPM, ScoreAssimetria } from "@/core/prioritize/tipos-v3";
import type { TaskEdge } from "@/types/canonical";
import type { GrafoV3Props } from "@/types/grafo-v3";

export function serializaGrafoV3(
  edges: TaskEdge[],
  cpm: ResultadoCPM,
  scores: ReadonlyMap<string, ScoreAssimetria | null>,
): GrafoV3Props {
  const janelas: GrafoV3Props["janelas"] = {};
  for (const [id, janela] of cpm.janelas) janelas[id] = janela;

  const scoresPlano: GrafoV3Props["scores"] = {};
  for (const [id, score] of scores) scoresPlano[id] = score;

  return {
    edges,
    critico: [...cpm.critico],
    janelas,
    semDuracao: [...cpm.semDuracao],
    emCiclo: [...cpm.emCiclo],
    goalId: cpm.goalId,
    duracaoTotal: cpm.duracaoTotal,
    scores: scoresPlano,
  };
}
