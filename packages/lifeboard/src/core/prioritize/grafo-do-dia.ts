import "server-only";
/**
 * OS-LIFEBOARD · P4 — O GRAFO DO DIA, CALCULADO NUM LUGAR SÓ.
 *
 * ## Por que este módulo existe (achado ALTO 1 da rodada 13)
 *
 * A guarda de navegador dizia comparar *"o canvas × o DADO"*. Os dois lados
 * saíam de `arestasVisuais`, no mesmo componente, a 16 linhas um do outro:
 * qualquer erro ACIMA daquela variável era publicado como "o dado" e depois
 * confirmado pelo desenho. Trocar o conjunto de ids críticos que alimenta as
 * ARESTAS (uma linha) deixava os cinco portões verdes com a tela dizendo que
 * o gargalo é outra cadeia.
 *
 * A cura tem duas metades. Esta é a primeira: **o dado bruto e o CPM passam a
 * ter um caminho de leitura que não atravessa o componente que desenha** —
 * `GET /api/grafo-bruto`, alimentado por esta função. A segunda metade está na
 * guarda, que deriva dali o universo esperado de arestas e o compara par a par
 * com o que o canvas pinta.
 *
 * A home (`src/app/page.tsx`) usa a MESMA função. Não é duplicação de
 * conveniência: se a página e a rota calculassem o goal de jeitos diferentes,
 * a comparação mediria a divergência entre duas contas em vez do produto.
 */

import { scoreAssimetriaLote } from "@/core/prioritize/assimetria";
import { caminhoCritico } from "@/core/prioritize/caminho-critico";
import type { ResultadoCPM } from "@/core/prioritize/tipos-v3";
import { serializaGrafoV3 } from "@/lib/serializa-grafo-v3";
import type { Task, TaskEdge } from "@/types/canonical";
import type { GrafoV3Props } from "@/types/grafo-v3";

/**
 * O goal do grafo: a primeira tarefa `isGoal`, por ordem determinística de id
 * (nunca a ordem de chegada do repositório). Explícito para que o goal usado
 * no CPM e o `goalId` de `GrafoV3Props` NUNCA divirjam.
 */
export function goalDoGrafo(tasks: readonly Task[]): string | null {
  return (
    [...tasks]
      .filter((t) => t.isGoal === true)
      .sort((a, b) => a.id.localeCompare(b.id))[0]?.id ?? null
  );
}

export interface GrafoDoDia {
  goalId: string | null;
  cpm: ResultadoCPM;
  grafoV3: GrafoV3Props;
}

/** CPM + scores + serialização, a partir do dado bruto já lido. */
export function montarGrafoDoDia(tasks: Task[], edges: TaskEdge[]): GrafoDoDia {
  const goalId = goalDoGrafo(tasks);
  const cpm = caminhoCritico(tasks, edges, goalId);
  const scores = scoreAssimetriaLote(tasks, edges, cpm);
  return { goalId, cpm, grafoV3: serializaGrafoV3(edges, cpm, scores) };
}
